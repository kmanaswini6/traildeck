# Phase 1 — Walking Skeleton

## Day 2: Prisma schema, migration, and seed

- [x] Configure Prisma and Prisma Client 6.19.0.
- [x] Define User, Client, and Case models and required enums.
- [x] Add required relations, constraints, indexes, and restrictive delete behavior.
- [x] Validate schema and generate Prisma Client.
- [x] Create and apply `init_core_models` migration to the development database.
- [x] Run the seed script twice.
- [x] Verify exactly one User, one Client, and one Case after seeding.
- [x] Confirm local `server/.env` is ignored by Git.
- [x] Run `git diff --check`; no output was returned.
- [x] Review final changes, lockfile, and Prisma config backup.
- [ ] Commit (user performs this).

### Result log

- `npx prisma validate` — passed.
- `npx prisma generate` — passed.
- `npx prisma migrate dev --name init_core_models` — passed; migration applied.
- `npx prisma migrate status` — passed; database schema up to date.
- `npx prisma db seed` — passed twice; output: `Seeded: lawyer, client, case`.
- Temporary seed verification script — passed; User: 1, Client: 1, Case: 1.
- `npm ls prisma @prisma/client --depth=0` — both packages reported 6.19.0.
- `git check-ignore server/.env` — returned `server/.env`.
- `git diff --check` — passed with no output.
- Auth API tests — not run; belongs to the next task.
- Cleanup review (2026-10-13): `npx prisma validate` — passed (schema valid; Prisma 7 deprecation warning about `package.json#prisma` seed key is expected on 6.19.0).
- Cleanup review (2026-10-13): `npm ls prisma @prisma/client --depth=0` — both 6.19.0, matching package.json, lockfile, and installed node_modules.
- Cleanup review (2026-10-13): lockfile 694 → 287 packages; shrink fully explained by approved Prisma 8.0.0-rc.22 / client 7.10.0 → 6.19.0 downgrade (removed composer/alchemy/rolldown/AWS bulk); package.json diff touches only the two Prisma version lines plus the seed key.
- Cleanup review (2026-10-13): `git diff --check` — passed with no output; `git check-ignore -v server/.env` — ignored via root `.gitignore:152:.env`.
- Cleanup review (2026-10-13): migrate/seed rerun — not run; no concrete reason, per task instructions.

### Notes

- Prisma dependencies were changed to stable 6.19.0 with user approval.
- `server/prisma.config.ts` was renamed to `server/prisma.config.ts.bak` because the original configuration was incompatible with the selected Prisma CLI. Preserve the backup until cleanup is reviewed.
- Cleanup review (2026-10-13): the backup held Prisma 7-style `definePrismaConfig` (`prisma/config` import, `skills` block), unused by the 6.19.0 CLI; validation passes without any config file, so the deletion stands and the `.bak` was removed from disk (it was untracked and never committed).
- The package lockfile has a large diff after the Prisma version change; review before committing.
- Never include `.env` values in logs or commits.
- No commit or push has been performed.

## Next task: Day 2 — Auth API

Plan register, login, and `/me` endpoints with tests. Read `AGENTS.md`, `docs/progress/README.md`, and this phase file first. Start in Plan mode, list files and risks, and wait for user approval before editing.
