---
description: Run lint and type-check, the two checks CLAUDE.md requires before calling any task done. Use when Arthur asks to verify, check, or run the checks.
---

Run these two checks and report plainly:

1. `npm run lint`
2. `npm run type-check`

Show the exact output if either fails. If both pass, say so in one line — no extra
commentary. Don't run `npm run build` here; only run it if Arthur asks separately.
