@AGENTS.md

# CLAUDE.md

areuout — a party app for 16 to 26 year olds in Leipzig. Hosts create a party, guests
RSVP through a shared link. Arthur runs it as a private individual: no business, no
monetisation, every service inside its free tier.

This file holds what you cannot read off the code — how to work, and the rules that
outlive any single change. Everything factual has a home elsewhere; see 'Where to look'.

Sections 1 to 4 are adapted from `multica-ai/andrej-karpathy-skills`. **Tradeoff:** they
bias toward caution over speed. For trivial tasks, use judgment.

## Working with Arthur

- Address him as Arthur in every reply.
- Ask before committing, before pushing, and before writing anything into the vault.
- End every reply with a summary of all changes in bullet points.
- Keep this file current after a change. Never add a 'Current state' section, and never
  reintroduce one.

Commit format: `KEYWORD(file or feature): what changed and why`

`feat` new feature · `fix` bug fix · `refactor` no behaviour change · `style` formatting
and small UI · `docs` · `test` · `chore` maintenance · `perf` · `build` build config ·
`ci` GitHub Actions. Always push after a commit.

## 1. Think before coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity first

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No 'flexibility' or 'configurability' that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: 'Would a senior engineer say this is overcomplicated?' If yes, simplify.

## 3. Surgical changes

**Touch only what you must. Clean up only your own mess.**

- Don't 'improve' adjacent code, comments or formatting.
- Don't refactor what isn't broken. Match the surrounding style, even where you would
  do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove the imports, variables and functions that YOUR changes made unused. Nothing
  else.

The test: every changed line traces directly to the request.

## 4. Goal-driven execution

**Define success criteria. Loop until verified.**

- 'Add validation' → 'write the failing case first, then make it pass'
- 'Fix the bug' → 'reproduce it, then make the reproduction pass'
- 'Refactor X' → 'green before and after'

For multi-step work, state the plan as steps with a check each:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

This repo has no test suite. The three checks below are the criteria — run them before
calling anything done, and say so plainly if one of them fails.

## Stack and commands

Next.js 16, App Router only · React 19 · TypeScript strict · Tailwind CSS v4
Supabase — Postgres, Auth via `@supabase/ssr`, Storage

```bash
npm run dev          # localhost:3000
npm run build        # production build
npm run lint         # eslint
npm run type-check   # tsc --noEmit
```

`AGENTS.md` applies: this Next.js version differs from your training data. Read the
relevant guide in `node_modules/next/dist/docs/` before writing anything
framework-specific. `proxy.ts` is the Next 16 name for what you know as middleware, and
the auth check in it is optimistic — every screen still guards itself, and RLS is what
actually protects the data.

## Hard rules

- Never `any`. Never `"` where `'` works.
- App Router only. Never a Pages Router pattern.
- Server components by default. `'use client'` only where the component needs it.
- `createServerClient` on the server, `createBrowserClient` in the browser — both in
  `lib/supabase/`. Only the anon key, in both. The service role key never appears.
- Every table has RLS. Every column with a fixed set of values has a CHECK. RLS decides
  WHO writes a row, never WHAT is in it: the anon key ships in the browser bundle, so
  anything the UI merely declines to offer needs a CHECK, a UNIQUE, an FK or a trigger
  behind it.
- After a schema change, regenerate `types/database.types.ts` in the same commit. All
  three clients carry `<Database>`, so a stale file breaks the typecheck instead of
  rotting quietly.
- No date of birth, no age, no gender — not as a column, not as a sign-up question. The
  16+ minimum lives in the terms of use. The Datenschutzerklärung names these as not
  collected, and `supabase/migrations/README.md` records three migrations deleted to
  stop them coming back. Reintroducing one contradicts a published legal text.
- `ASSUMED_PARTY_HOURS` in `lib/utils.ts` and `c_assumed_hours` in the migrations are
  the same six hours written twice. Change one, change the other — together they decide
  when the database stops handing out a finished party's address.
- Colours, sizes and spacing come from the variables in `app/globals.css`. If no variable fits, ask before adding one.
- Icons come from `lucide-react`. Never hand-roll an `<svg>` for an icon.
- No monetisation. Not ads, not paid tiers, not a payment provider, not an affiliate
  link. If a change would push past a free tier, say so before writing it.
- Do not suggest: Prisma, Firebase, PlanetScale, Clerk, NextAuth, React Router, Redux,
  Zustand.

## Where to look before you write

| Question | Where |
|---|---|
| Tables, columns, RPC signatures | `types/database.types.ts` |
| Why the database is built the way it is — RLS, anon, storage, the traps | `SCHEMA.md` |
| The live truth: policies, grants, triggers, constraints | the database itself, over the Supabase MCP. `SCHEMA.md` carries the queries |
| Which migrations are actually on the database | `supabase/migrations/README.md` |
| Environment variables and what each one is for | `.env.example` |
| Setup and deployment | `README.md` |
| Product, audience, tone, scope, roadmap, dates | the vault, below |

Read the relevant one before you write. Do not copy its contents back into this file.

## Second Brain context

Arthur keeps the product side in an Obsidian vault ('Arthur's Second Brain'), registered
for this project as an additional working directory. The paths below are relative to the
vault root. The files are readable from here, but nothing in the vault loads
automatically — not even its own CLAUDE.md. Go and read the file.

- `00 Context/Writing Style.md` — READ BEFORE writing any text a user will see: UI
  strings, button labels, empty states, error messages, prose in the legal pages, Open
  Graph text, and anything Arthur asks for as a caption, post or copy. This is the one
  file to reach for unprompted.
- `00 Context/ICP.md` — who areuout is for and what they actually struggle with.
- `00 Context/Offer.md` — the offer and what makes it different.
- `00 Context/Branding.md` — colours, fonts, logo. Once it is filled in, it decides
  those, not this file.
- `00 Context/About Me.md` — who Arthur is and how he works.
- `02 Projects/areuout/` — `About areuout.md` (what it is and for whom), `Scope.md`
  (what shipped, what is permanently out, what a later version might hold),
  `Constraints.md` (how it is operated and what that rules out), `Status.md`,
  `To-Dos.md`, `Context.md`.
- `Phase 1.md` and `Plan.md` at the vault root — the roadmap, the stages and every real
  date. This file carries no dates on purpose.

The vault decides product, audience, tone, scope and dates. This file decides the stack
and the rules above. The hard rules outrank anything the vault describes as a future
feature. If the vault contradicts one of them, report it instead of resolving it quietly.

Two rules look like they collide and do not: `Writing Style.md` bans emoji in prose and
copy, while this app uses Apple emoji as interface flavour and lucide for the interface
itself. Prose follows the vault, interface chrome follows this file.

Reading the vault is free. Writing to it is not: ask first, exactly as for a commit here,
and follow the vault's own conventions — read its CLAUDE.md at the vault root. In short:
YAML frontmatter (`tags`, `status`, `date`), `[[Wikilinks]]` between notes, English
content, `Descriptive Name.md` file names, daily notes as `YYYY-MM-DD.md` in
`05 Daily Notes/`, and never move anything into `06 Archive/` unasked.

The previous `CLAUDE.md`, `AGENTS.md`, `SCHEMA.md` and `RECHTLICHES-BESTANDSAUFNAHME.md`
sit in `04 Resources/Claude Code/areuout Repo Backup 2026-09-01/`. That is a backup, not
a source. Do not read them unless Arthur asks for them by name.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites
due to overcomplication, and clarifying questions come before implementation rather than
after mistakes.
