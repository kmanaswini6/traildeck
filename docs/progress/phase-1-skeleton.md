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

### Day 2: Auth API (register, login, me) with tests — DONE, awaiting commit

- [x] `POST /api/auth/register` creates role CLIENT, returns 201 `{ user, token }`.
- [x] `POST /api/auth/login` returns 200; wrong password and unknown email give identical 401s.
- [x] `GET /api/auth/me` returns 200 `{ user }`; expired/deleted-user/missing/garbage tokens give 401s.
- [x] All failures use `{ error: { code, message, details } }`; unexpected faults give 500 `INTERNAL_ERROR` with no leak.
- [x] Auth tests pass (28/28); full backend suite passes (same file, only suite).
- [x] `node --check` passes on all 8 new/changed `.js` files.
- [x] `npx prisma validate` passes; schema/migrations untouched.
- [x] `git diff --check` clean; lockfile unchanged; diff secret scan clean.
- [ ] Lint — not run (no lint script in `server/package.json`).
- [ ] Commit (user performs this).

### Result log (Auth API, 2026-10-13, branch `feat/auth-api`)

- `npx vitest run src/routes/auth.test.js` (from `server`) — 1 file passed, 28 tests passed (10.42s).
- `npm test` (`vitest run`, full suite) — 1 file passed, 28 tests passed (2.20s).
- Re-verification (2026-10-13, resume): `npm test` — 1 file passed, 28 tests passed (2.21s); `npx --no-install vitest run src/routes/auth.test.js` — 28 passed (2.32s).
- `node --check` on `src/prisma.js`, `src/errors.js`, `src/auth.js`, `src/routes/auth.js`, `src/app.js`, `src/server.js`, `src/routes/auth.test.js`, `vitest.config.js` — all exit 0.
- `npx prisma validate` (from `server`) — passed, schema valid.
- Re-verification (resume): local executable `node ./node_modules/prisma/build/index.js validate` (Prisma 6.19.0, from `server`) — passed, schema valid. `npm ls prisma @prisma/client --depth=0` — both 6.19.0.
- `git diff --check` — passed with no output; `git diff --stat` — 2 tracked files (`server/.env.example` +1, `server/package.json` 1 line) plus untracked `server/src/`, `server/vitest.config.js`.
- `git diff --quiet -- server/package-lock.json` — exit 0, lockfile unchanged.
- Secret scan of tracked diff — 1 hit: the empty `JWT_SECRET=` placeholder line in `.env.example` (name only, no value; safe). Source scan — no connection strings, tokens, or keys; only the fake `test-only-fake-secret` in the test file.
- Lint — NOT RUN (no lint script exists).

### Notes (Auth API)

- Public registration creates `role: "CLIENT"` per user correction (plan had LAWYER from the earlier draft; corrected before implementation). Body `role` is stripped by Zod and never read; `create` data is built explicitly.
- No `JWT_EXPIRES_IN` existed, so approved new name added (`server/.env.example` placeholder `1d`, code default `1d`); `JWT_SECRET` stays mandatory with a clear startup/first-use failure.
- Backend was greenfield: no app entry, routes, error handler, Prisma module, or test setup existed — all added as NEW `server/src/*` files; `app` is exported without listening for Supertest.
- Prisma `P2002` code could not be confirmed from a readable local source (minified bundles only); tests construct `PrismaClientKnownRequestError` with `code: "P2002"` directly, so no live-DB dependence.
- Mishap: `npx prisma validate` first run from repo root made npx try to fetch Prisma 8.0.0-rc.22 and timed out; no repo effect. Re-ran from `server/` (local 6.19.0) — passed. Always run Prisma/npm commands from `server/`.
- Resume (2026-10-13): root-cause of the timeout confirmed — repo root has no local Prisma install, so bare `npx prisma` resolved the `latest` tag (8.0.0-rc.22) and tried to download it. Local `server/node_modules/prisma` is intact at 6.19.0; validation via the local executable passes. Nothing was installed; versions unchanged.
- Resume: `server/package.json` contains exactly one `test` key (`vitest run`) — the earlier diff display was just `-`/`+` lines, no duplicate key; no correction needed.
- Resume: malformed-JSON probe (`POST /api/auth/login` with `{bad json`) returns generic 500 `INTERNAL_ERROR`, no leaked details. Semantically a 400 would be nicer, but no leak and outside the task's test scope — left unchanged; approve a follow-up if you want it mapped to 400 `VALIDATION_ERROR`.
- No Neon contact, no server started, `.env` never read; no dependencies changed; no commit or push performed.

Plan register, login, and `/me` endpoints with tests. Read `AGENTS.md`, `docs/progress/README.md`, and this phase file first. Start in Plan mode, list files and risks, and wait for user approval before editing.
