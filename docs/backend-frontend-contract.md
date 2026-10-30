# Backend and frontend API handoff

This document describes the current B2 FastAPI prototype and the development-only B2 workspace. It is not a production API guarantee and is not suitable for real beneficiary data. The workspace uses B2 responses only; the original Dashboard, Action Queue, and Referrals pages remain separate `mockStore` demos.

## Startup and authentication

The API module is `B2.api:app`; the base path is `/api`.

With dependencies already provisioned, run from the repository root:

```powershell
python -m uvicorn B2.api:app --reload
```

Keep `B2_AUTH_MODE=disabled`. This is the normal fail-closed mode: protected routes return `401`; only public health is available until trusted authentication adapters are configured. Do not enable demo mode to make the browser workspace appear operational. Supabase verification, trusted assignments, organization hierarchy, worker mapping, and an operational repository are not configured. Do not send real beneficiary data to this prototype.

`GET /api/health` is public and reports prototype mode. Protected routes require the configured identity boundary. Never use the demo header as production authentication.

## Current endpoints

Protected routes return `401` for absent/invalid identity or missing/invalid server-side assignments, `403` for an authenticated identity without permission/scope, and `503` when the identity or trusted authorization service cannot safely answer. Not-found responses may be used to avoid disclosing an out-of-scope resource. The `503` authorization response is generic and retryable; it does not expose repository or provider error details.

| Method and path | Purpose and current limits |
|---|---|
| `GET /api/health` | Public service/mode indicator. |
| `GET /api/me` | Protected profile assembled from `principal()` after identity verification and trusted assignment/hierarchy resolution. Returns `subject_id`, canonical `role`, `scopes` (`type` and `id`), `is_active`, `identity_mode`, and `demo`. It does not return email, provider metadata, or worker mapping. Disabled/invalid/unassigned identities fail closed; authorization-adapter outages return generic `503`. Explicit demo mode returns a synthetic label and no provider subject. |
| `GET /api/audit?centre_id=...&entity_type=...&entity_id=...` | Scoped audit events; prototype store only. |
| `GET /api/beneficiaries?centre_id=...` | Lists saved beneficiaries in the requested centre after server-side scope checks. AWW results are further filtered to their assigned worker ID. DPO and public User roles have no beneficiary-list permission. |
| `POST /api/beneficiaries` | AWW-only child registration. Body: `{ "beneficiary_id": "BEN-1001", "date_of_birth": "2026-06-15", "sex": "F", "caregiver_kinship": "Mother" }`. ID is optional; generated IDs use `BEN-` plus random uppercase hex. Centre and assigned worker are derived from the authenticated principal, never accepted from the body. Only B1-supported child sex values `M`/`F` are accepted. |
| `GET /api/beneficiaries/{beneficiary_id}` | Retrieves one saved beneficiary after role, assigned-worker, and organization-scope checks. |
| `GET /api/beneficiaries/{beneficiary_id}/measurements` | Returns saved measurements for the scoped beneficiary. |
| `POST /api/measurements` | AWW-only first measurement. Body uses the same shape as `/api/verification`: `{ "beneficiary_id": "BEN-1001", "measurement": { "measurement_date": "2026-10-15", "weight_kg": 7.0, "height_cm": 64.0, "muac_mm": 115, "oedema": "no", "danger_sign": "no" }, "recorded_at": "2026-10-15" }`. Existing B1 checks/evaluation run and an immutable flag snapshot is written with the measurement. Data-quality issues are retained as an evaluation/flag for recheck; malformed field types and duplicate initial measurements are rejected. `today`, if supplied, affects evaluation only in demo mode. |
| `GET /api/cases/{beneficiary_id}/explain?flag_id=...` | Saved case explanation; deterministic/prototype output, not an external AI model. |
| `GET /api/beneficiaries/{beneficiary_id}/history` | Saved measurement history summary. |
| `POST /api/verification` | LS-only remeasurement/verification. Appends a remeasurement, reevaluates existing B1 rules, and records a flag snapshot. Body: `{ "beneficiary_id": "C0001", "measurement": { "measurement_date": "2026-10-16", "weight_kg": 7.1, "height_cm": 64.2 }, "recorded_at": "2026-10-16", "today": "2026-10-16" }`. AWW cannot use this endpoint to verify or approve measurements. `today` is honored only in explicit demo mode; other modes use the server clock. |
| `POST /api/tasks` | Creates a task from an existing saved flag. Body: `{ "flag_id": "FLAG-C0001-BASELINE", "created_on": "YYYY-MM-DD" }`. |
| `GET /api/tasks?centre_id=...` | Lists tasks visible to the actor in the centre. AWW results are filtered by assigned worker and beneficiary mapping. |
| `POST /api/tasks/{task_id}/actions` | Supports acknowledge, start, and progress recording under server role/scope policy. Assignment/reassignment/escalation fail with `409 assignment_directory_unavailable` outside explicit demo mode because no trusted target-user directory is configured. The development workspace does not expose these actions. |
| `POST /api/tasks/{task_id}/closure-confirmations` | Adds a configured two-key closure confirmation. Closure fails closed without an approved case-type policy and distinct canonical actors/roles. The development workspace does not expose closure. |
| `GET /api/next-actions/{flag_id}` | Deterministic next-action suggestion from saved prototype state. |
| `POST /api/next-actions/{flag_id}/decision` | Records `decision` plus optional `edited_action`, `reason`, and `on`; not an external model call. |
| `GET /api/briefing?centre_id=...&as_of=...` | Role-filtered briefing. DPO receives aggregate-only information. |
| `POST /api/referrals` | Creates a referral from an existing case. Body contract is `FollowupReferralRequest` in `B2/api.py`. |
| `GET /api/referrals?centre_id=...&as_of=...` | Lists scoped referrals. |
| `GET /api/referrals/{referral_id}` | Reads one scoped referral. |
| `POST /api/referrals/{referral_id}/actions` | Supports acknowledge, attendance, or coded outcome after attendance, under server role/scope policy. It does not currently record contact-attempt details in this follow-up referral model. Body contract is `FollowupReferralActionRequest` in `B2/api.py`. |
| `POST /api/access-exceptions` | Requests a limited access exception; this prototype workflow does not itself establish production identity. |
| `GET /api/access-exceptions?centre_id=...` | Lists scoped exception records. |
| `GET /api/access-exceptions/{exception_id}` | Reads one exception record within scope. |
| `POST /api/access-exceptions/{exception_id}/resolve` | Resolves an exception under role policy. |
| `POST /api/maternal-followups` | Disabled unless explicitly enabled; restricted prototype workflow. |
| `GET /api/maternal-followups?centre_id=...` | Disabled unless explicitly enabled. |
| `POST /api/maternal-followups/{followup_id}/actions` | Disabled unless explicitly enabled. |
| `POST /api/briefing/snapshots` | Saves a centre briefing snapshot. |
| `GET /api/briefing/snapshots?centre_id=...` | Lists scoped snapshots. |
| `GET /api/briefing/snapshots/{snapshot_id}` | Reads one scoped snapshot. |
| `POST /api/offline/queue` | Writes a local prototype queue entry only. |
| `GET /api/offline/queue?status=...` | Reads the local actor queue. |
| `POST /api/offline/sync/attempt` | Simulates sync against supplied prototype state; not a remote backend synchronization. |
| `POST /api/offline/queue/{operation_id}/retry` | Retries a local queue operation. |
| `POST /api/offline/queue/{operation_id}/resolve-conflict` | Resolves a local queue conflict under prototype policy. |

Request model details for task actions, next-action decisions, referrals, exceptions, closure, maternal follow-ups, snapshots, and offline operations are defined by corresponding `*Request` classes near the top of `B2/api.py`. Extra fields are rejected. Responses are JSON; registration returns `{ "beneficiary": ..., "label": ... }`, measurements return `{ "measurement": ..., "flag": ..., "history_link": ..., "label": ... }`, and successful task/referral mutations wrap the resulting record. The SQLite prototype persists beneficiaries, measurements, flags, tasks, referrals, decisions, and audit entries; measurement plus its flag snapshot are committed atomically. Offline operations persist to a local JSON queue, not a remote service.

## Errors

Errors use `{ "error": { "code": "...", "message": "...", "retryable": false } }`. Validation failures use HTTP `422` with sanitized field locations and generic messages; rejected input values are not echoed. Common statuses are `401` authentication required/invalid or assignment denied, `403` forbidden, `404` missing or concealed resource, `409` stale/invalid workflow transition, `422` invalid fields, `503` identity/authorization service unavailable, and `400` invalid operation. Clients should use `error.code` for handling and must not parse internal exception text.

## IDs and integration gaps

The B2 synthetic fixture uses beneficiary `C0001`, centre `AWC-001`, and source worker `W07`. New beneficiaries use caller-provided `BEN-...` IDs or generated `BEN-<12 hex>` IDs; measurement, flag, task, and referral IDs are opaque UUID strings (the seeded flag keeps `FLAG-C0001-BASELINE`). The frontend mock fixtures use IDs such as `BEN-0142`, `AWC-702`, `AWW-409`, and `MEA-...`. The `BEN-...` beneficiary identifier can be passed through as an opaque string, but there is no approved mapping from frontend centre `AWC-702` to API centre assignments, or worker `AWW-409` to server worker `W07`. Do not translate IDs by display name or accept frontend centre/worker fields as authority; wire the UI only after the server identity and assignment identifiers are provided.

The API supports child registration and first measurement, not adult beneficiary categories, bulk import, or source-system synchronization. The development-only pages `SyntheticWorkflowPage` and `SyntheticOperationsPage` call B2; they require a provider session and a trusted server profile, neither of which currently yields operational access in this checkout. The original `DashboardPage`, `ActionQueuePage`, and `ReferralsPage` continue to use `mockStore`. They link to the separate B2 workspace in development but do not combine its counts or records. No production identity adapter, operational database repository, hierarchy resolver, task-assignee directory, rule approval authority, or remote offline sync transport is configured. B2 SQLite remains a local prototype store. `B1/` and `B!/` are separate packages; this API imports B1 rule/data helpers and does not treat B! as interchangeable.

The frontend client in `frontend/src/services/b2Api.ts` validates profile, beneficiary, measurement-history, task, briefing, referral, and exception responses. It requires a caller-supplied access token, uses the configured B2 API URL, and never sends browser role or scope claims. Synthetic workflow pages do not call `mockStore` and show unavailable/error states when B2 cannot be reached. Their tests use mocked fetch and do not prove a live authenticated journey. Do not use frontend demo IDs as API centre or worker IDs or present provider sign-in as operational authorization.

Migration `002_trusted_authorization.sql` remains a draft. Its reader RLS condition limits `app_users` and `user_role_assignments` to a transaction-local `poshan.subject_id`; only trusted backend code may set that context after token verification, on the same private connection and transaction. The context is not cryptographic identity proof and does not protect against arbitrary SQL execution under that role. Organization directory rows remain readable to the reader for ancestry validation. The reserved `poshan_auth_admin` role has no table grants or write policies until an authenticated account/organization management workflow and audit actor contract are approved. The migration includes an overlap preflight before its exclusion constraint. These draft policies and grants have not been executed against PostgreSQL; static tests do not establish SQL validity or runtime RLS behavior.

## Tests

In an environment already provisioned with the dependencies listed in `B2/requirements.txt`, run the full backend suite from the repository root:

```powershell
python -m unittest discover -s B2 -p "test_*.py" -v
```

The API tests require FastAPI, Pydantic, and HTTPX; the beneficiary rule-evaluation tests also use the existing B1 pandas dependency. For the currently available non-API tests, use:

```powershell
python -m unittest B2.test_beneficiaries B2.test_authorization B2.test_tasks B2.test_day2 -v
```

### Prior verification record

The following command was run with `TEMP` and `TMP` set to `C:\IIT_B\B2` so the SQLite-backed tests use workspace-local temporary storage:

```powershell
python -m unittest B2.test_authorization_migration B2.test_auth B2.test_authorization B2.test_beneficiaries B2.test_tasks B2.test_day2 -v
```

Historical result: **66 tests passed** at the time of the prior verification. This includes service, policy, prototype-store, mocked identity-verifier, and static SQL-draft contract tests. The SQL tests inspect draft text only; they do not parse or execute PostgreSQL. See the current run's final report for verification performed after later changes.

Frontend checks run against the current checkout:

```powershell
node --test src/utils/casework.test.ts src/services/b2Api.test.ts
npm.cmd run lint
npm.cmd run build
```

Historical result: **32 frontend tests passed** at the time of the prior verification. The current client tests use mocked `fetch`; they do not prove live frontend/backend integration. See the current run's final report for later verification.

The earlier HTTP-test attempt below predates the current installed FastAPI environment:

```powershell
python -m unittest B2.test_api_day1 B2.test_complete_workflow -v
```

Historical result: those modules could not import because FastAPI was then absent. FastAPI is installed in the current Anaconda environment; the current full-suite attempt is reported below.

### Current verification (2026-10-28)

The frontend test command `npm.cmd test` passed **55 tests**. TypeScript checking passed using `tsc --noEmit --tsBuildInfoFile C:\IIT_B\.test-tmp\codex-tscheck-final.tsbuildinfo`, keeping the protected `frontend/tsconfig.tsbuildinfo` untouched. The production build passed using Vite `build --outDir C:\IIT_B\.test-tmp\codex-build-20261028-final`; that exact temporary output and check metadata were removed afterwards. Vite reported the existing native config-loader `__dirname` warning and a chunk-size warning.

The backend pure-unit command covering `B2.test_auth`, `B2.test_authorization`, `B2.test_authorization_migration`, `B2.test_beneficiaries`, `B2.test_config`, `B2.test_tasks`, and `B2.test_day2` passed **72 tests**. It used Anaconda Python 3.13.9, `B2_AUTH_MODE=disabled`, `B2_DB_PATH=:memory:`, and workspace-local `TEMP`/`TMP`.

Full discovery was attempted with `python -m unittest discover -s B2 -p 'test_*.py' -v` under those same environment settings, but it stalled on its first FastAPI `TestClient` request (`test_authentication_disabled_fails_closed_even_for_demo_header` in `B2.test_api_day1`). A minimal reproduction showed module import, `create_app`, and `TestClient` construction complete; faulthandler then showed the request blocked before ASGI startup while AnyIO creates a Windows Proactor event loop. The stack stops in Python `socket.py` `_fallback_socketpair`, waiting in `socket.accept()`. Selecting `WindowsSelectorEventLoopPolicy` in the test process did not resolve the stall. Installed versions are FastAPI 0.143.0, Starlette 1.7.0, httpx 0.28.1, and Anaconda Python 3.13.9; Starlette emits a deprecation warning for its httpx TestClient integration. This points to an environment/Windows event-loop socketpair problem before app route, middleware, or database code. The run was stopped without changing dependencies. Thus API route tests are **incomplete**, not passed. A local server was not reachable at `127.0.0.1:8000` during this check. `git diff --check` passed; Git emitted only existing LF/CRLF conversion notices.

Frontend tests were rerun after adding demo-mode boundary coverage: **57 passed**. TypeScript no-emit checking and an isolated temporary-output production build passed. The build retains the `__dirname` Vite native config-loader warning and >500 kB bundle warning. A Vercel rewrite configuration was not added; configure an SPA fallback to `/index.html` in the selected hosting project before deploying direct routes.

No dependencies were installed, no migrations or SQL were applied, and no external service was contacted.
