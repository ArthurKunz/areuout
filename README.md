# areuout

A web app for planning private parties. Create a party, share the link, and keep the
whole plan in one place. Built for people between 16 and 26.

Most parties still get planned in a WhatsApp group, where the plan is spread over
hundreds of messages and every change buries it deeper. areuout replaces the thread
with a single link: the host edits the party, the guests answer, and everyone sees the
same current version.

## How it is run

areuout is run by a private individual, not a company. No registered business and no
intention to earn from it: no ads, no paid tiers, no payment provider, and no data
passed to anyone for money. Every service it depends on stays inside its free tier.

## Stack

- Next.js 16, App Router only
- React 19, TypeScript in strict mode
- Supabase — Postgres, Auth, Storage, with Row Level Security on every table
- Tailwind CSS v4

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

The app then runs on http://localhost:3000.

## Environment variables

Everything is read from `process.env`; nothing is hard-wired. `.env.example` is the
template and the only `.env` file in version control.

| Variable | What for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The Supabase project. It ships in the browser bundle by design — what protects the data is Row Level Security, not keeping this secret |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | The map preview (Static Maps API). Restrict it to your own domain in the Google Cloud Console |
| `NEXT_PUBLIC_SITE_URL` | Your own domain, once there is one. Without it `lib/site.ts` falls back to the Vercel production domain, then to localhost |

`SUPABASE_SERVICE_ROLE_KEY` appears nowhere in the source and belongs in neither
`.env.local` nor the deployment configuration.

## Commands

```bash
npm run dev          # localhost:3000
npm run build        # production build
npm run lint         # eslint
npm run type-check   # tsc --noEmit
```

## Documentation

| Question | File |
|---|---|
| The binding project rules, and the shortest overview for a human | [CLAUDE.md](CLAUDE.md) |
| How the database is secured and which traps it has | [SCHEMA.md](SCHEMA.md) |
| Which migrations are actually on the database | [supabase/migrations/README.md](supabase/migrations/README.md) |
| Every environment variable and what it is for | [.env.example](.env.example) |

Columns, types and RPC signatures live in `types/database.types.ts`, which is generated
from the schema.
