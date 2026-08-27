# Schema

The table is `events`. The app calls it a party everywhere else, so PostgREST embeds
have to be aliased: `parties:events(...)`, never `parties(...)`.

## profiles
| column        | type        | notes                                                |
|---------------|-------------|------------------------------------------------------|
| id            | uuid PK     | IS `auth.users.id` — no separate auth_user_id column  |
| firstname     | text        | nullable until onboarding fills it                    |
| lastname      | text        | nullable until onboarding fills it                    |
| avatar_url    | text        | nullable — initials avatar when empty                 |
| avatar_color  | text        | not null, default `#A336FF`                           |
| created_at    | timestamptz | default now()                                         |

`profiles.id → auth.users(id) ON DELETE CASCADE`. Deleting the auth user takes the
profile, and every FK below cascades from there, which is what makes `delete_self()`
a complete erasure.

**There is no date of birth and no age, anywhere.** The column was dropped on
21.08.2026 along with the onboarding step, the profile row and the line under every
name in the guest list. The 16+ minimum lives in the terms instead.

The reasoning, so nobody reintroduces it: Art. 8 DSGVO wants parental consent under
16, but it only applies where the legal basis is consent — running an account is
Art. 6(1)(b), performance of a contract. What actually pulled Art. 8 in was the
audience. A service aimed at 14-year-olds is 'directed at children' whatever the
terms say, so the audience moved to 16+ and the column became unnecessary. Asking
for a birthday now would only put the data back without buying anything.

## events
| column         | type        | notes                                    |
|----------------|-------------|------------------------------------------|
| id             | uuid PK     | default gen_random_uuid()                 |
| host_id        | uuid FK     | → profiles.id ON DELETE CASCADE           |
| title          | text        | not null                                  |
| description    | text        | nullable                                  |
| event_type     | text        | nullable — stubbed, no UI                 |
| invite_code    | text        | not null, UNIQUE — 10 hex chars           |
| event_date     | timestamptz | not null                                  |
| ends_at        | timestamptz | nullable — optional end time              |
| location       | text        | not null                                  |
| max_guests     | int         | nullable — null means no cap              |
| background_url | text        | nullable                                  |
| created_at     | timestamptz | default now()                             |

## rsvps
| column       | type        | notes                                          |
|--------------|-------------|------------------------------------------------|
| id           | uuid PK     | default gen_random_uuid()                       |
| event_id     | uuid FK     | → events.id ON DELETE CASCADE                   |
| user_id      | uuid FK     | → profiles.id ON DELETE CASCADE                 |
| status       | text        | CHECK in `going` / `maybe` / `not_going`        |
| responded_at | timestamptz | default now()                                   |

UNIQUE (event_id, user_id) — one answer per person per party.

Trigger `rsvps_enforce_capacity` — BEFORE INSERT OR UPDATE. `party_has_room` in the
INSERT/UPDATE policy counts the seats, but a policy is only an expression: it cannot
lock, and it knows nothing about the other transactions doing the same thing at the
same instant. Two guests answering together both read the same count, both pass, and
the party ends up one over. The trigger takes `pg_advisory_xact_lock` on the party id
before counting, so answers to the SAME party queue behind each other; answers to
different parties never wait. It only engages for `status = 'going'` on a party that
actually has a `max_guests`, so 'maybe', 'not_going' and uncapped parties never touch
a lock. Rejects with `Diese Party ist voll.` rather than the RLS message.

The policy stays as it is. The trigger does not replace it — the policy turns away the
ordinary case, the trigger the dead heat.

Three answers, not two. `host` is a fourth word the attendee RPCs invent to mark the
host in a guest list; it is never stored, because the insert policy forbids the host
from RSVPing to their own party.

## pools / pool_options / pool_responses
The voting feature. There is no `votes` table — this replaced it.

**pools**
| column              | type        | notes                                 |
|---------------------|-------------|---------------------------------------|
| id                  | uuid PK     | default gen_random_uuid()              |
| event_id            | uuid FK     | → events.id ON DELETE CASCADE          |
| question            | text        | not null                               |
| description         | text        | nullable                               |
| type                | text        | CHECK in `options` / `text_only`       |
| allow_text_response | boolean     | default false                          |
| allow_multiple      | boolean     | default false                          |
| created_at          | timestamptz | default now()                          |

**pool_options**
| column     | type        | notes                                  |
|------------|-------------|----------------------------------------|
| id         | uuid PK     | default gen_random_uuid()               |
| pool_id    | uuid FK     | → pools.id ON DELETE CASCADE            |
| label      | text        | not null                                |
| position   | int         | default 0                               |
| created_at | timestamptz | default now()                           |

UNIQUE (id, pool_id) — exists only so pool_responses can point at the pair.

**pool_responses**
| column        | type        | notes                                              |
|---------------|-------------|-----------------------------------------------------|
| id            | uuid PK     | default gen_random_uuid()                            |
| pool_id       | uuid FK     | → pools.id ON DELETE CASCADE                         |
| user_id       | uuid FK     | → profiles.id ON DELETE CASCADE                      |
| option_id     | uuid FK     | → pool_options(pool_id, id), ON DELETE SET NULL      |
| text_response | text        | nullable                                             |
| created_at    | timestamptz | default now()                                        |

Three things hold a row honest, because RLS cannot:
- The FK is **composite** — `(pool_id, option_id)` — so an option always belongs to
  the poll it was answered in. Null option_id still passes (MATCH SIMPLE), which is
  what lets a text-only answer write.
- UNIQUE (pool_id, user_id, option_id) — no voting for the same option twice.
- Trigger `pool_responses_single_answer` — when `allow_multiple = false`, one row per
  person per poll. `upsertPoolResponse` deletes before it inserts, so changing your
  mind still works.

## Not built yet
- **tasks** (checklist / who brings what) — V1 scope, no table.
- **Coming late + expected arrival time** — V1 scope, no column on rsvps.
- **party_score** — V2, no column. Do not assume it exists.

---

## RLS

Enabled on all six tables. Every policy is scoped to `authenticated`; `anon` holds no
table grant anywhere and reaches the database only through the three invite-code RPCs.

**profiles** — SELECT / INSERT / UPDATE, all `auth.uid() = id`. Only your own row.
Another person's name or age is never read from this table, only from an RPC.

**events**
- SELECT: `host_id = auth.uid() OR is_party_member(id)`
- INSERT: WITH CHECK `host_id = auth.uid()`
- UPDATE / DELETE: `host_id = auth.uid()`

**rsvps**
- SELECT: own row, or any row on a party you host
- INSERT / UPDATE: own row, **not** on your own party, and `party_has_room(...)` —
  max_guests is enforced here, not in the UI
- DELETE: own row, or the host removing a guest

**pools / pool_options** — members read, host writes.

**pool_responses** — members of the party read all answers and write their own.

### Two rules worth restating
- An RLS SELECT policy has to be satisfiable from the row's own columns.
  `.insert(...).select(...)` becomes `INSERT ... RETURNING`, which Postgres checks
  against the SELECT policy while the new row is still invisible to any function that
  looks it up again.
- RLS decides WHO writes a row, never WHAT is in it. The anon key ships in the browser
  bundle, so anything the UI merely declines to offer needs a CHECK, a UNIQUE, an FK
  or a trigger.

---

## CHECK-Constraints und Indizes

Die Regel aus CLAUDE.md — RLS entscheidet WER schreibt, nie WAS drinsteht — ist seit
dem 21.08.2026 auf allen Spalten umgesetzt, nicht mehr nur auf `rsvps.status` und
`pools.type`. Migration `20260820230226_bound_what_the_columns_may_hold`.

| Tabelle | Constraint | Regel |
|---|---|---|
| profiles | `profiles_avatar_color_check` | `^#[0-9A-Fa-f]{6}$` |
| profiles | `profiles_avatar_url_check` | NULL oder eine URL in den eigenen `avatars`-Bucket |
| profiles | `profiles_name_length_check` | firstname/lastname ≤ 200 |
| events | `events_text_length_check` | title ≤ 200, location ≤ 500, description ≤ 5000 |
| events | `events_max_guests_check` | NULL oder 1 … 100000 |
| events | `events_invite_code_check` | `^[0-9a-f]{8,32}$` |
| pools | `pools_text_length_check` | question ≤ 600, description ≤ 3000 |
| pool_options | `pool_options_label_length_check` | label ≤ 300 |
| pool_responses | `pool_responses_text_length_check` | text_response ≤ 5000 |

Jede Längengrenze liegt rund zehnmal über dem, was das Formular zulässt (`TITLE_MAX`
ist 20, die Spalte erlaubt 200). Absicht: die Constraint soll ein Megabyte Text
abwehren, nicht das Formular ein zweites Mal durchsetzen — eine Grenze enger als die
UI würde aus einer künftigen Textänderung einen fehlgeschlagenen Speichervorgang
machen.

`events_invite_code_check` erlaubt 8 Zeichen, obwohl `generateInviteCode` 10 erzeugt:
eine Party aus der Zeit vor der Verlängerung hat noch einen 8-stelligen Code, und eine
Constraint, die vorhandene Zeilen ablehnt, lässt sich gar nicht erst anlegen.

`profiles_avatar_url_check` ist die einzige davon, die nicht nur Unsinn abwehrt: die
Spalte landet in einem `<img src>`, das jeder andere Gast lädt. Ohne die Regel könnte
jemand seinen Avatar auf einen eigenen Server zeigen lassen und die IP-Adresse aller
mitlesen, die ihn in einer Gästeliste sehen.

Dazu sechs Indizes auf den Fremdschlüsseln, auf denen die Partyliste und die
Umfrage-RPCs joinen — Migration `20260820230141_index_the_foreign_keys_the_party_list_joins_on`.
Postgres legt für PRIMARY KEY und UNIQUE selbst einen an, für die verweisende Seite
eines FOREIGN KEY nie.

---

## Functions

All `SECURITY DEFINER` with `search_path` pinned. `SECURITY DEFINER` bypasses RLS, so
each one carries its own check — usually `is_party_member()`.

`is_party_member(event_id)` is what keeps the events ↔ rsvps policies from recursing:
the policy on `events` needs to read `rsvps`, whose policy needs to read `events`.

| function | check | reachable by |
|---|---|---|
| `is_party_member(uuid)` | — | authenticated |
| `party_has_room(uuid, uuid)` | — | authenticated |
| `get_event_attendees(uuid)` | is_party_member | authenticated |
| `get_event_attendees_by_invite_code(text)` | **none — the link is the claim** | authenticated |
| `get_event_attendees_for_events(uuid[])` | is_party_member | authenticated |
| `get_rsvp_counts_for_events(uuid[])` | is_party_member | authenticated |
| `get_host_info_for_events(uuid[])` | is_party_member | authenticated |
| `get_pool_responses_by_event(uuid)` | inline membership | authenticated |
| `get_party_by_invite_code(text)` | Bremse: 30 Fehlversuche/IP/Minute | **anon** |
| `get_party_pools_by_invite_code(text)` | none — the link is the claim | authenticated |
| `get_event_host(uuid)` | is_party_member | authenticated |
| `get_rsvp_counts_by_status(uuid)` | is_party_member | authenticated |
| `get_event_host_by_invite_code(text)` | none — the link is the claim | **anon** |
| `get_rsvp_counts_by_status_by_invite_code(text)` | none — the link is the claim | **anon** |
| `delete_self()` | auth.uid() | authenticated |
| `rsvps_enforce_capacity()` | trigger only | **nobody** — revoked from anon and authenticated |

Seit dem 27.08.2026 ist der Einladungscode auch wirklich der einzige Schlüssel, den
ein Besucher ohne Konto braucht — und der einzige, den er benutzen kann. Vorher nahmen
`get_event_host` und `get_rsvp_counts_by_status` die Party-UUID und prüften nichts:
Wer irgendwo eine solche UUID aufschnappte (sie steht in jeder Hintergrundbild-Adresse),
bekam ohne Konto den vollen Namen des Gastgebers. Beide gibt es jetzt zweimal — als
`…_by_invite_code` für `anon`, und als UUID-Fassung für `authenticated` mit
`is_party_member`-Prüfung, die nur noch die Detailseite benutzt.

`get_party_by_invite_code` trägt seit dem 27.08.2026 als einzige Funktion eine
Bremse. Sie zählt in `private.invite_lookup_misses` **nur Fehlversuche** je IP und
Kalenderminute und weist ab 30 mit `PT429` ab, was PostgREST zu HTTP 429 macht. Nur
Fehlversuche, weil ein echter Gast immer einen gültigen Code trifft und deshalb nie
gezählt wird — und weil die serverseitige Chat-Vorschau für alle Besucher von wenigen
Vercel-IPs kommt und eine Bremse auf allen Aufrufen genau die getroffen hätte. Die
Prüfung steht vor dem Hochzählen, weil ein `raise` die Transaktion zurückrollt und ein
Hochzählen im selben Aufruf damit verloren wäre. Das Schema `private` liegt ausserhalb
der API: die Tabelle ist über PostgREST nicht erreichbar, `anon` und `authenticated`
haben kein Recht darauf.

Am 27.08.2026 gelöscht, weil kein Aufruf sie je erreicht hat: `get_rsvp_count(uuid)`
— die Oberfläche zählt über `get_rsvp_counts_by_status` und
`get_rsvp_counts_for_events` — und `get_attendee_avatars_for_events(uuid[])`, deren
eigene Migration schon festhielt, sie sei "genau dafür gebaut und dann nie" benutzt
worden. Mit der ersten fällt zugleich eine der für `anon` ausführbaren
SECURITY-DEFINER-Funktionen weg.

Die drei verbliebenen `_for_events(uuid[])`-Funktionen existieren, damit die
Partyliste in einer festen Zahl von Anfragen gelesen werden kann statt in einem Satz
pro Party. `get_event_attendees_for_events`
and `get_rsvp_counts_for_events` are derived line for line from their single-party
versions — same statuses, same host-as-fourth-status special case, same ordering — so
swapping them in changed nothing on screen. Verified per party against the originals
before the client was switched over.

One difference worth knowing: `get_event_host` has **no** membership check (the public
invite page needs it), while `get_host_info_for_events` does. They are only
interchangeable where membership is guaranteed, which the guest tab satisfies by
construction — every party there comes from the reader's own RSVP.

The three anon-reachable lookups are what make `/e/[invite_code]` work without an
account. `get_event_host` and the two counters take a raw event id rather than the
code, so an id alone is enough for a host's name and a headcount. Event ids are not
published anywhere, so this is small — but keying them on the invite code too would
leave exactly one public entry point.

Both attendee RPCs return names and avatars only. They returned `birthday` until
20.08.2026 and `age int` for one day after that; both are gone with the column.
