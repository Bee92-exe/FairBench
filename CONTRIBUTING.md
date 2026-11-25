# Contributing to FairBench

Thanks for looking. This project is small enough that the fastest path to a
merged change is: open an issue, describe the behaviour you want, then send a
focused pull request.

## Getting set up

Follow [Getting started](README.md#getting-started) in the README. In short:

```bash
cd backend  && npm install && cp .env.example .env   # fill in the values
cd ../database && npm install && npm run migrate && npm run seed
cd ../backend  && npm run dev                         # http://localhost:4000
cd ../frontend && npm install && cp .env.example .env && npm run dev
```

The seed script is optional demo data. Skip it if you are pointing at your own
Supabase project and want an empty lab.

## Before you open a pull request

```bash
cd backend && npm test        # 14 suites, 47 tests
cd frontend && npm run build  # must build cleanly
```

Both must pass. If you touched the scheduler, the determinism test is the one
that matters most: the same input must always produce the same plan.

If you touched a route, the services layer or the schema, also run the smoke test
against a real database — it exercises the write paths the unit suite cannot:

```bash
cd backend && npm run smoke              # submit, cancel, preview; cleans up after itself
cd backend && npm run smoke -- --with-apply   # also applies an admin change
```

## What to work on

The architecture keeps four layers apart, and a change should stay inside one of
them:

| Layer | Folder | Rule |
|---|---|---|
| Routes | `backend/src/routes` | HTTP, validation, error shape. No business rules |
| Services | `backend/src/services` | Workflows, transactions, audit, notifications |
| Scheduler | `backend/src/scheduler` | Pure logic. No database, no HTTP, no clock |
| Data | `database/`, `backend/src/db` | Schema, constraints, RLS, queries |

If you find yourself writing scheduling logic in a route, it belongs in
`scheduler/`. If you find yourself writing SQL in a service, it belongs in
`db/queries.js`.

## Style

- ES modules, no build step, no TypeScript.
- Match the surrounding code. Comments explain **why**, never what.
- Every user-visible outcome needs a plain-language reason — that is the whole
  point of the product.
- Never log secrets or personal data.

## Commit messages

Conventional prefixes, one concern per commit:

```
feat(api): add outage preview
fix(scheduler): stop buffer spilling into the next booking
docs(scheduler): explain the repair step
chore(db): add index on bookings(machine_id, start_at)
```

## Branches and review

- `main` is protected in spirit: land changes through a pull request.
- Branch from `main`, name it after the work (`fix/repair-step`).
- Delete the branch after merging; a merged branch that keeps receiving commits
  will silently revert newer work when it is merged again.

## Security

- Never commit `.env`, keys, or the service-role key. `.gitignore` covers the
  common paths; `git check-ignore -v path/to/file` tells you whether a file is
  actually ignored before you stage it.
- The service-role key bypasses row level security. It belongs in the backend
  environment only, never in the frontend bundle.
- Report a vulnerability privately to the maintainers rather than in a public
  issue.

## Licence

By contributing you agree that your work is released under the [MIT Licence](LICENSE).
