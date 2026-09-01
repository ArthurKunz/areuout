# SCHEMA.md

What this database does that you cannot read off `types/database.types.ts`.

The columns, types and RPC signatures live in that generated file, and the live
policies, grants and constraints live in the database itself — ask it, don't trust a
document. So nothing of that kind is repeated here. Every line below had to pass one
test:

> Would this still be missing after querying the database?

What is left is the reasoning: why it is built this way, and the traps that cost a bug
each. Section 8 has the queries to check the rest.

Verified against the live database on 2026-09-01.

## 1. How security works here, in four sentences

RLS is on for all six tables in `public`, and every policy is written for the
`authenticated` role. A signed-in person reaches their own rows and the rows of parties
they belong to — nothing else. Everything an anonymous visitor sees comes from
`SECURITY DEFINER` functions, never from a table. Host and guest are not stored
anywhere: host is `events.host_id`, guest is a row in `rsvps`, and both are derived on
every screen, because the same person hosts one party and attends another in the same
session.

## 2. The anon trap

**`anon` holds SELECT, INSERT, UPDATE and DELETE on all six tables.** That is the
Supabase default and it has never been revoked.

What stops it is that **no policy for the `anon` role exists**. RLS denies whatever no
policy allows, so anon gets zero rows and zero writes. The protection is an absence, not
a wall.

Which means: a single policy written `TO public` — or with the role left off, which is
the same thing — opens that table to the whole internet immediately, because the GRANT
is already in place. There is no second line of defence behind it.

**Rule: every policy names its role explicitly, and that role is `authenticated`.** If
you ever want an exception, that is a security decision, not an implementation detail.

## 3. What RLS cannot do

**It cannot serialise.** A policy is an expression Postgres evaluates. It takes no lock
and knows nothing about the other transaction doing the same thing right now, so two
guests can both pass a capacity check and both take the last seat. Anything that has to
hold across concurrent writers — a capacity, a quota, an 'only one of these may exist' —
needs a BEFORE trigger that locks first. `rsvps_enforce_capacity` is the worked example:
it takes a `pg_advisory_xact_lock` on the event id before counting. `party_has_room` in
the INSERT policy counts along, but it does not replace the trigger.

**It checks `INSERT ... RETURNING` against the SELECT policy.** `.insert(...).select(...)`
in the client becomes exactly that, and Postgres checks the returned row against the
SELECT policy while the row is still invisible to any function that looks it up again.
So a SELECT policy has to be satisfiable from the row's own columns.

**And it never decides what is in a row, only who writes it.** The anon key ships in the
browser bundle, so anything the interface merely declines to offer needs a CHECK, a
UNIQUE, an FK or a trigger behind it. The UI is not a constraint.

## 4. The three RPCs anon can reach

This is the complete public attack surface:

- `get_party_by_invite_code`
- `get_event_host_by_invite_code`
- `get_rsvp_counts_by_status_by_invite_code`

Every other function is `authenticated` and up. Two things are worth knowing about the
first one, because both are load-bearing:

It carries the brake. Thirty failed lookups per IP per calendar minute, counted in
`private.invite_lookup_misses`, then it raises `PT429`. The IP comes from
`cf-connecting-ip` with `x-forwarded-for` as the fallback. That table has RLS switched
off and is still unreachable, because neither `anon` nor `authenticated` holds USAGE on
the `private` schema — the schema is the boundary, not the policy.

And it blanks the address. Once the party is over and the caller is not the host,
`location` comes back as `''`, not NULL, because both screens call `lastIndexOf(',')` on
it unconditionally. The six hours it assumes mirror `ASSUMED_PARTY_HOURS` in
`lib/utils.ts` — change one, change the other.

## 5. Storage: public means public

Both buckets, `avatars` and `event-backgrounds`, are `public = true`. **Every file in
them is fetchable by URL with no login at all.**

The SELECT policies on `storage.objects` govern *listing* through the API, not fetching.
They stop a signed-in account from enumerating other people's files; they do not stop
anyone who has the URL. If something ever needs to be genuinely private, it needs a
private bucket and signed URLs — a policy will not get you there.

All eight storage policies hang on one convention: the first path segment is the
uploader's `auth.uid()`, so a file lives at `{uid}/...`. Uploads carry a timestamp in
the name (`{host}/{party}/background-{ms}.jpg`) because a fixed name is the same URL, and
the cache would serve the old image for hours after a change.

## 6. PostgREST traps

**Embeds resolve by the real table name, not by the app's wording.** The table is
`events` and the app calls it a party everywhere, so an embed is written
`parties:events(...)`, never `parties(...)`.

**Never read a list one request per row.** Every screen showing many parties goes
through the `_for_events(uuid[])` RPCs — an array of ids in, one round trip back. A
per-party loop turns ten parties into twenty network hops, and on a phone that is the
whole loading experience.

**A SQLSTATE of the form `PTxxx` becomes HTTP status `xxx`.** That is how the invite
brake returns a 429 instead of a 500.

## 7. Deletion: the cascade from auth.users

`delete_self()` deletes exactly one row — from `auth.users`. Everything else follows,
because every foreign key in `public` is ON DELETE CASCADE, with one exception:
`pool_responses.option_id` is SET NULL. `profiles.id` is `auth.users.id` and cascades
from it, and every other table cascades from `profiles` or `events`.

That chain is the whole reason account deletion is complete. A new table holding
anything personal has to join it — an FK without CASCADE makes the erasure silently
partial, and nothing will fail to tell you.

## 8. Checking this file against the database

Do not trust the above. The database answers all of it, and the Supabase MCP is the
fastest way to ask. `supabase/migrations/` is **not** a substitute: it runs 22
migrations behind the live database, for the reasons in `supabase/migrations/README.md`.

```sql
-- Policies: who may do what, per table
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, cmd;

-- Grants: the layer underneath the policies (section 2)
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated');

-- Functions: which are SECURITY DEFINER, and who may execute them (section 4)
select p.proname, p.prosecdef, p.proconfig,
       pg_get_function_identity_arguments(p.oid)
from pg_proc p where p.pronamespace = 'public'::regnamespace order by p.proname;

-- Triggers: where a policy was not enough (section 3)
select c.relname, t.tgname, pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid = t.tgrelid
where c.relnamespace = 'public'::regnamespace and not t.tgisinternal;

-- Constraints and indexes: what the UI cannot be trusted to enforce
select conname, contype, confdeltype, pg_get_constraintdef(oid)
from pg_constraint where connamespace = 'public'::regnamespace;
select indexname, tablename, indexdef from pg_indexes
where schemaname in ('public', 'private');

-- Storage: bucket visibility (section 5)
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
```

## 9. Open questions

Found on 2026-09-01 and deliberately not touched. Changing the database is its own task
with its own migrations.

1. **A poll option cannot always be deleted.** `pool_responses.option_id` is ON DELETE
   SET NULL, and `pool_responses_pool_user_text_key` is UNIQUE on `(pool_id, user_id)
   WHERE option_id IS NULL`. On a poll with `allow_multiple = true`, one person's two
   answers both become `option_id NULL` when their options are deleted — and collide, so
   the delete fails with a unique violation. Never seen in production: `pools`,
   `pool_options` and `pool_responses` are all empty.
2. **A redundant unique index.** `pool_responses_pool_id_user_id_option_id_key` sits
   next to the two partial indexes that already cover it.
3. **`profiles` policies break the naming convention.** They are called
   `Users can read their own profile` and so on, where every other table uses
   `table_cmd_who`. (That `profiles` has no DELETE policy is deliberate — deletion goes
   through `delete_self()` and the cascade.)
4. **`get_party_by_invite_code` is granted to PUBLIC as well as `anon`.** PUBLIC is
   wider than needed and includes any role added later.
5. **`delete_self` runs with `search_path = ''`, every other function with
   `search_path = public`.** The empty one is the hardened form.
