# Phase 2 — Clients and Cases

Source: TrailDeck Project Baseline (client management, case management,
Lawyer/Client roles, confidential-data protection). Backend first (mocked-Prisma
Vitest + Supertest, same pattern as Phase 1 Auth API), UI slice per area after.
One task, one branch, one review at a time. No documents/hearings/RAG work here.

Standing rules (every task): lawyer id from the verified token only; single-record
reads/writes filter by record id AND lawyerId in the same query; another lawyer's
record returns 404 (not 403); all failures use
{ "error": { "code", "message", "details": [] } }; no dependency changes;
no .env values in logs; no Neon migration beyond what the task approves.

## Task 2.1 (backend): lawyer client management — DONE, awaiting commit
- [x] Lawyer-only CRUD on own clients: create (name/email/phone), edit, view
      profile with case history (relation include), list with search + filter
      + pagination.
- [x] Isolation: every query scoped by token lawyerId; cross-lawyer access 404s.
- [x] Tests incl. two-lawyer isolation asserting mocked Prisma `where` args.
- [ ] Result log / Notes entries.

Acceptance: endpoints under the existing API prefix; Zod validation (400
VALIDATION_ERROR); safe field selection (no hashes — clients carry none);
vitest suite green; `git diff --check` clean; lockfile unchanged.

## Task 2.2 (UI): clients pages
- [ ] List/search/filter, profile + case history, create/edit forms calling 2.1.
- [ ] Result log / Notes entries.

## Task 2.3 (backend): case management
- [ ] Lawyer-only CRUD on own cases: create (title/caseNumber/court/type/
      opposingParty/status), edit, view, list with search + filter + pagination.
- [ ] Create verifies body `clientId` belongs to the same lawyer, else 404
      (untrusted input, never trusted directly).
- [ ] Duplicate caseNumber per lawyer → 409 via composite-unique violation.
- [ ] Status limited to OPEN/IN_PROGRESS/CLOSED (schema enum).
- [ ] Delete behavior: Restrict FKs mean deleting a client/case with dependents
      fails at the DB — surface as 409, never cascade, never 500 leak.
- [ ] Tests incl. two-lawyer isolation asserting mocked Prisma `where` args.
- [ ] Result log / Notes entries.

## Task 2.4 (UI): cases pages
- [ ] List/search/filter, detail with client link + history, create/edit forms.
- [ ] Result log / Notes entries.

### Result log
- Task 2.1 (2026-10-13, branch `feat/clients-api`): baseline `npm test` before changes — 1 file, 29 passed.
- Task 2.1: `npx --no-install vitest run src/routes/clients.test.js src/roles.test.js` — 2 files, 32 passed.
- Task 2.1: `npm test` (full suite) — 3 files, 61 passed (29 baseline + 32 new).
- Task 2.1: `node --check` on `src/auth.js`, `src/errors.js`, `src/pagination.js`, `src/clients.js`, `src/routes/clients.js`, `src/routes/auth.js`, `src/app.js`, `src/roles.test.js`, `src/routes/clients.test.js` — all exit 0.
- Task 2.1: local `node ./node_modules/prisma/build/index.js validate` (6.19.0, from `server`) — schema valid.
- Task 2.1: `git diff --check` — clean; `git diff --quiet -- server/package.json server/package-lock.json` — exit 0; `git diff --quiet -- server/prisma/schema.prisma server/prisma/migrations` — exit 0.
- Task 2.1: secret scan of diff and new sources — no hits (only the fake `test-only-fake-secret` in test files).
- Task 2.1: lint — NOT RUN (no lint script exists).
- (per task: commands + real results; skipped checks marked NOT RUN)

### Frozen API contract (Task 2.1 — backend client management; UI task builds from this)

Auth: all endpoints require `Authorization: Bearer <lawyer-JWT>` → `requireAuth`, then `requireRole("LAWYER")`. No token → 401 `UNAUTHENTICATED`; non-LAWYER role → 403 `FORBIDDEN`. `lawyerId` always comes from the token; body/query `lawyerId` is ignored.

- `POST /api/clients` — body `{ name, email?, phone? }` (unknown keys dropped). 201 `{ client }`. Errors: 400 `VALIDATION_ERROR`, 401, 403.
- `GET /api/clients` — query `page` (dflt 1), `pageSize` (dflt 20, max 100), `q` (search name/email/phone), `hasCases` (`true|false`), `sortBy` (`name|createdAt|updatedAt`, dflt `createdAt`), `order` (`asc|desc`, dflt `desc`). Out-of-range/non-integer pagination or disallowed sort → 400 `VALIDATION_ERROR`. 200 `{ data, page, pageSize, total, totalPages }` (rows: `id, name, email, phone, createdAt, updatedAt`; no `lawyerId`/`userId`, no cases).
- `GET /api/clients/:id` — UUID required (else 400). 200 `{ client }` with `cases` (`id, title, caseNumber, status, court, type, createdAt`, newest first, same-lawyer only). Missing/other-lawyer → 404 `NOT_FOUND`.
- `PATCH /api/clients/:id` — UUID required; body ≥1 of `name/email/phone` (else 400); `name` cannot be null; `email`/`phone: null` clears. Unknown keys dropped. 200 `{ client }`. Missing/other-lawyer → 404 `NOT_FOUND`.
- `DELETE /api/clients/:id` — UUID required. 204 empty. Missing/other-lawyer → 404 `NOT_FOUND`. Client with cases → 409 `CLIENT_HAS_CASES` (Restrict, never cascade).

Client fields returned: `id, name, email, phone, createdAt, updatedAt` (+ `cases` on profile only). All errors use `{ error: { code, message, details: [] } }`; unexpected faults → 500 `INTERNAL_ERROR` with no leak.

### Notes
- Task 2.1: installed Prisma 6.19.0 types confirm `update`/`delete` accept `where: { id, lawyerId }` in one call (`ClientWhereUniqueInput`); P2025→404 and P2003→409 mappings asserted via constructed errors in tests (codes documented, not read from a local source).
- Task 2.1: `validationDetails` moved from `src/routes/auth.js` to `src/errors.js` and reused by both routers (auth suite still 29/29).
- Task 2.1: `hasCases` filter implemented per approval (`cases: { some: {} }` / `{ none: {} }`, AND-ed beside `lawyerId`).
- (decisions, surprises, deferred items)

### Confirmed decisions (user-approved; each task is still planned and reviewed individually)
1. Client registration = lawyer-created client profile only (name, email, phone).
   No client login account or invitation flow in this phase.
2. Extra case fields/history deferred: no speculative fields or migrations.
   Case implementation uses the existing schema as-is; client case history uses
   the existing Client–Case relationship.
3. Client and case management endpoints are lawyer-only until Phase 6. Enforce
   authentication, role authorization, and lawyer-level record isolation.
4. Seed unchanged (no second seeded lawyer). Cross-lawyer isolation is tested
   with mocked Prisma and Vitest/Supertest, including assertions on query
   `where` arguments.
5. Pagination: page defaults to 1, page size defaults to 20, maximum page size
   100. Validate pagination inputs; allowlist sortable fields and sort
   directions; deterministic ordering. Proposed client sorting: name and
   creation date. Proposed case sorting: case number, status, creation date.
   Confirm these fields exist in the schema before implementation.
6. Introduce reusable `requireRole` middleware in Task 2.1, consistent with the
   existing `requireAuth` architecture. Keep authentication and role
   authorization separate.
