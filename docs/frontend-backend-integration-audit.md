# Frontendâ€“backend integration audit

**Review date:** 2026-10-28
**Scope:** Current repository state after adding the Vercel SPA rewrite. This is a code and test review, not a live Supabase or production integration test. `B2_AUTH_MODE` remains disabled.

## Status key and evidence limits

- **Verified in code/tests:** the implementation or behavior is directly supported by inspected code and an applicable test. This does not imply a live production integration.
- **Partial:** a path exists, but the workflow or verification is incomplete.
- **Mock-only:** data/action behavior is browser-local and synthetic.
- **Blocked:** required auth, roster, hierarchy, or operational infrastructure is absent or deliberately disabled.
- **Unverified:** there is no successful runtime test evidence in this environment.

Frontend service tests stub `fetch`; they verify request construction, validation, and error handling but do not call FastAPI. `B2.test_frontend_workflow` uses an isolated in-memory store and a test-app dependency override. The Windows FastAPI `TestClient` request hang means that HTTP suite must not be counted as passed here. Earlier recorded backend pure-unit checks passed, but do not prove frontend-to-server transport. No Supabase project was contacted.

## Frontend screens and data ownership

### B1 dataset access update

The B1 `children.csv` remains private and is not copied into `frontend/public/`, imported into the Vite bundle, or requested by the browser. `frontend/src/services/b1CsvDataSource.ts` defines the typed 19-column `B1ChildRow`, strict CSV parser, and source-only filters. Its parser is exercised by a repository test that reads the source fixture during Node test execution; the test file is not imported by the application build. The `/b1-explorer` page and its beneficiary-list link are not registered in the frontend. Parser tests do not imply that the deployed browser can read the CSV.

The current B2 service has no authenticated endpoint that returns the B1 CSV. `B2/api.py` imports B1 rule helpers and its prototype seeder imports only the existing `C0001` fixture into local SQLite with a demo-only centre assignment; `/api/beneficiaries` lists from that store, not the CSV. Normal backend auth remains disabled. Supabase auth mode cannot start without a trusted token verifier, account/assignment repository, organization hierarchy, worker mapping where needed, and operational-store adapter. Those prerequisites must be approved and implemented before a secured B1 data route can be designed. A B1 row's worker field is not a trusted centre mapping.

The dashboard and reports use the canonical browser-local mock store, which deterministically seeds 600 fictional beneficiaries: 24 children aged 0â€“6 months, 146 aged 6 monthsâ€“3 years, 152 aged 3â€“6 years, 50 adolescent girls aged 10â€“19 years, 137 pregnant women, and 91 lactating mothers, with linked records. Provider-session views remain unavailable rather than showing mock records as operational account data. B2 briefing counts remain in the separate operations workspace and do not replace mock-store population-category statistics. The Prepared Data Overview is not a frontend dashboard feature.

| Screen/workflow | Data and actions | Status/evidence |
|---|---|---|
| `/` landing and interactive showcase | Presentation/demo component state; no B2 API client | **Mock/showcase only.** `LandingPage.tsx`, `InteractiveDemo.tsx`. Not an operational case record. |
| `/signin` | Supabase SDK email/password session and restoration; optional mock persona in `poshan_staff_session_v1` only when dev or explicitly demo-enabled | **Provider flow implemented; live provider use unverified.** `AuthContext.tsx`, `SignInPage.tsx`, `services/authLifecycle.ts`. Auth lifecycle tests use stubs. |
| `/dashboard` | Browser-local mock-store metrics and cohort charts in demo mode; unavailable for provider sessions. No prepared-data API request. | **Mock-only.** Dashboard figures derive from the canonical deterministic 600-beneficiary dataset. `MockDashboardView.tsx`, `mockStore.ts`. |
| B1 source contract | Private B1 CSV parser contract, exercised by Node tests only | **Not routed or loaded by the application.** `b1CsvDataSource.ts`; the checked-in CSV stays outside the browser bundle. |
| `/beneficiaries` | In explicit demo mode, browser-local records with shared search/filter/pagination; provider sessions receive an unavailable state. | **Mock-only demo / unavailable for provider accounts.** No prepared-data API request. `BeneficiaryListPage.tsx`, `mockStore.ts`, `beneficiaryDirectory.ts`. |
| `/beneficiaries/register`, `/beneficiaries/:id` | Browser-local mock records/actions in demo mode; blocked for provider sessions because prepared detail and approved registration persistence are absent. | **Mock-only demo / unavailable for provider accounts.** No mapping to B2 prototype IDs. `RegisterBeneficiaryPage.tsx`, `ChildProfilePage.tsx`, `PortalLayout.tsx`. |
| `/measurements` | In explicit demo mode, browser-local measurement/evaluation workflow; provider sessions receive an unavailable state. | **Mock-only demo / unavailable for provider accounts.** No prepared-data API request. `MeasurementPage.tsx`, `mockStore.ts`. |
| `/queue` | `mockStore` cases, task-like actions, local audit | **Mock-only.** `ActionQueuePage.tsx`; not `/api/tasks`. |
| `/referrals` | `mockStore` referral and follow-up actions | **Mock-only.** `ReferralsPage.tsx`; not `/api/referrals`. |
| `/rules` | `mockStore` rule settings | **Mock-only.** `RuleSettingsPage.tsx`; no backend rule administration integration. |
| `/reports` | `mockStore` audit and aggregate views/export | **Mock-only.** `ReportsPage.tsx`; not `/api/audit` or backend reports. |
| `/profile` | `mockStore` metrics/reset controls and browser state | **Mock-only.** `StaffProfilePage.tsx`. |
| `/synthetic-workflow` | B2 beneficiary listing/registration and initial measurement/history | **B2 API-backed prototype, blocked for ordinary runtime now.** `SyntheticWorkflowPage.tsx` requires a Supabase session, server profile, AWW role and one centre scope. Route is only rendered in Vite development (`App.tsx`). No mock fallback. |
| `/synthetic-operations` | B2 briefing, task/referral/exception listing and actions | **B2 API-backed prototype, blocked for ordinary runtime now.** `SyntheticOperationsPage.tsx`; route is only rendered in Vite development. No mock fallback. |

`mockStore.ts` serializes synthetic demo state to browser localStorage and seeds the deterministic 600-beneficiary dataset if stored state cannot be restored. Mock-backed pages remain available through the separate demo path, but the portal layout blocks those screens for provider sessions rather than showing local records as that user's account data. The beneficiary and measurement routes do not request prepared-data APIs. B1 source parsing remains separate and is exercised only by tests. `frontend/src/services/b2Api.test.ts`, `mockStore.test.ts`, and `b1CsvDataSource.test.ts` cover source separation, data integrity, and API errors.

## Frontend B2 client operations and backend contracts

The client is in `frontend/src/services/b2Api.ts`; routes are registered in `B2/api.py`. Success paths currently return HTTP **200** (including POST operations); FastAPI request validation returns **422**. The backend generally wraps errors as `{"error":{"code","message","retryable",...}}`. The client intentionally emits safe generic errors, but maps 400, 409 and 422 to the same `invalid_request` code.

All requests use a bearer access token, `credentials: omit`, redirect rejection and a 10-second timeout. Browser-supplied role or scope is not sent as authority. The API client restricts non-loopback URLs to HTTPS. Client methods validate selected response fields and reject malformed or mismatched payloads; TypeScript interfaces are not complete runtime schemas for every optional field.

| Client operation | Request to B2 | Request body / query | Expected success response | Status and integration notes |
|---|---|---|---|---|
| `getMyProfile` | `GET /api/me` | No body | `{subject_id, role, scopes:[{type,id}], is_active, identity_mode, demo}` | **Blocked** under current disabled auth (401). Role/scope must come from server assignment resolution. `isMyProfile` validates core fields. |
| `listBeneficiaries` | `GET /api/beneficiaries?centre_id=â€¦` | Centre query | `{centre_id, beneficiaries:[beneficiary]}` | AWW filtered to assigned worker on backend; centre permission enforced. Client checks centre linkage and `assigned_worker_id` presence. |
| `registerBeneficiary` | `POST /api/beneficiaries` | `{beneficiary_id?, date_of_birth, sex, caregiver_kinship?}` | `{beneficiary: beneficiary, label?}` | Server derives centre and worker from principal. Pydantic request forbids extra fields. UI performs a fresh list read and compares ID, centre, worker and supplied demographics. Only AWW with exactly one trusted centre and worker can register. |
| `listMeasurements` | `GET /api/beneficiaries/{id}/measurements` | Path beneficiary ID | `{beneficiary_id, centre_id, measurements:[measurement], flags:[flag]}` | Backend case/history scope; client requires every measurement to have exactly one corresponding flag and verifies beneficiary/centre/measurement/evaluation linkage. Empty history is valid. |
| `recordFirstMeasurement` | `POST /api/measurements` | `{beneficiary_id, measurement:{measurement_date,weight_kg,height_cm,muac_mm?,oedema?,danger_sign?}, recorded_at}` | `{measurement, flag, history_link, label?}` | Initial write is atomic in `PrototypeStore`; duplicate initial measurement rejected. UI fresh-reads history and checks submitted values and the saved evaluation/flag. API Pydantic model types `measurement` as an unstructured `dict`; domain validation in `beneficiaries.record_initial_measurement` is authoritative. Only assigned AWW can record. |
| `getBriefing` | `GET /api/briefing[?centre_id=â€¦]` | Optional centre query | `{centre_id? / scope?, as_of, counts, counts_source, label?}` | Backend permits assigned-centre briefing; DPO may receive aggregate scope. The UI validates as-of and core counts. |
| `listTasks` | `GET /api/tasks?centre_id=â€¦` | Centre query | `{centre_id, tasks:[task]}` | Backend checks `view_tasks` and centre scope; AWW sees only tasks owned by their mapped worker and beneficiaries mapped to that worker. |
| `applyTaskAction` | `POST /api/tasks/{id}/actions` | `{action, notes?, on?}`; UI uses `acknowledge`, `start`, `record_progress` | `{task, label?}` | Server action policy checks role and beneficiary scope. UI checks fresh status for acknowledge/start. Progress uses before/after list comparison and locks ambiguous writes; the API has no event ID/idempotency key, so identical concurrent writes cannot be uniquely attributed. Assignment/reassignment/escalation are not exposed by this client/UI and backend returns 409 outside explicit demo mode because the trusted target-owner directory is absent. Single-key close returns 409; two-key confirmation endpoint is not in the client. |
| `listReferrals` | `GET /api/referrals?centre_id=â€¦` | Centre query; optional backend `as_of` is not passed by this method | `{centre_id, as_of, referrals:[referral]}` | Backend checks `view_referrals`, centre scope, and worker mapping for AWW. Client checks each referral centre. |
| `createReferral` | `POST /api/referrals` | `{beneficiary_id, referral_kind, destination, reason_code, task_id?, due_on?}` | `{referral, label?}` | Backend checks beneficiary and optional task linkage, persists plus audits. UI reads list back and compares ID, beneficiary, centre, kind, reason, and `sent` status. It does not compare destination/due date during this read-back. |
| `applyReferralAction` | `POST /api/referrals/{id}/actions` | `{action, outcome_code?}`; actions `acknowledge`, `attend`, `record_outcome` | `{referral, label?}` | Server requires update permission for acknowledge/attend and resolve permission for outcome. UI fresh-reads expected status and (for outcome) outcome code. The client does not validate every returned referral field. |
| `listAccessExceptions` | `GET /api/access-exceptions?centre_id=â€¦` | Centre query | `{centre_id, exceptions:[exception]}` | LS has list permission; AWW does not. Backend filters by centre and AWW worker mapping, but current AWW permission policy allows create only. Client checks centre and core exception fields. |
| `createAccessException` | `POST /api/access-exceptions` | `{beneficiary_id, exception_type, task_id?}` | `{exception, label?}` | `create_exception` is allowed to AWW and LS, with beneficiary and worker/centre scope enforced server-side. UI only reports verified persistence for a role that can list: it reads list back and checks record fields/status. For AWW the write is explicitly reported **unverified** because the role cannot list. |
| `resolveAccessException` | `POST /api/access-exceptions/{id}/resolve` | `{resolution_code}` | `{exception, label?}` | Backend `resolve_exception` permission is LS-only and validates case scope; UI fresh-reads and checks resolved status/code. |

`B2/api.py` also exposes operations with **no matching frontend client method/screen**: `/api/audit`, case explanation/history, remeasurement verification, task creation, next-action suggestion/decision, closure confirmations, maternal follow-up, briefing snapshots, and offline queue/sync/retry/conflict resolution. Their existence is not evidence that the frontend uses them. Maternal operations return 409 unless separately enabled and allow-listed; remote offline sync explicitly reports disabled.

## Authentication, permissions and scope

- The production application defaults to `B2_AUTH_MODE=disabled`; protected requests return 401, including `/api/me`. A demo persona is a browser-local mock role and is not a bearer identity. B2 `auth_mode=demo` exists for explicitly configured synthetic API/test apps; it is not enabled by the normal app settings.
- In future Supabase mode, `SupabaseAuthVerifier` verifies bearer identity through Supabase Auth, then `resolve_authorized_principal` must resolve a trusted server-side account/role/assignment, organization hierarchy, andâ€”where AWW access needs itâ€”a current worker mapping. `create_app` refuses Supabase mode without these adapters and refuses to pair it with seeded demo records or `PrototypeStore`.
- Server checks are independent of frontend route visibility: `require_api_permission`, `require_centre_scope`, and `require_case_scope` are applied at endpoints/helpers. AWW case operations additionally require exact assigned-worker mapping; hierarchy checks authorize wider scopes only when a trusted hierarchy exists. No browser role, centre, or worker value substitutes for this principal.
- `B2/test_frontend_workflow.py` applies `phase_one_principal_dependency` overrides to newly constructed test apps with an in-memory `PrototypeStore`; the default module app is asserted to remain disabled and deny a demo header. Other legacy API tests explicitly create demo-mode test apps and are synthetic tests, not production auth.
- Role policy in `B2/roles.py`: AWW can register/measure, create referrals/exceptions, and act on own assigned tasks; LS can view audit/exceptions, resolve exceptions/referrals, manage task actions and review; CDPO has supervisory/list/report capabilities but no exception resolution; DPO is aggregate briefing only. Actual server permission and scope enforcement is the security boundary; client button visibility is not.

**Evidence status:** role/helper and test-app behavior are supported by unit and test source inspection. A full HTTP request against the live Windows TestClient path is **unverified** because the environment hangs before ASGI startup. Real provider token verification, real account assignments and live network behavior are also **unverified**.

## Persistence and read-back

`B2/store.py` is a SQLite `PrototypeStore`, normally at `B2/.prototype.sqlite` unless `B2_DB_PATH` is set. It atomically stores initial measurement plus flag and keeps audit events in SQLite. This is local prototype persistence, not production operational storage. Test workflow apps use `:memory:`. No PostgreSQL operational repository is wired; the Supabase SQL files are drafts and are not evidence of applied schema.

Read-back claims differ by workflow:

- Measurement registration and first measurement: UI performs a new B2 list/history request and validates selected identity/value/linkage fields. This is meaningful prototype read-back, not proof against a durable production DB.
- Task acknowledge/start and referral/exception mutations: UI performs fresh list reads and verifies selected IDs/status fields. Referral creation omits checking destination and due date; check coverage is therefore partial for full-payload integrity.
- Task progress: has ambiguity handling, but without server event IDs or idempotency keys concurrent identical writes cannot be uniquely distinguished.
- AWW exception creation: API response may be successful but the UI cannot read the exception list with AWW permission, so it correctly does not claim persistence verification.
- API service tests return mocked `Response` values. Backend HTTP tests use actual isolated stores in code, but their current execution is blocked by the Windows TestClient hang; consequently integrated persistence assertions are **present in tests but not verified by a completed HTTP run in this environment**.

## Mismatches and integration blockers

1. **Production routes do not expose the B2 workspaces.** `App.tsx` redirects both synthetic routes to `/` outside `import.meta.env.DEV`. Normal staff `RoleRoute`/`StaffRoute` rely on mock `staffUser` persona, not `backendProfile`; provider sign-in does not convert the trusted backend profile into operational route access. This is a deliberate current boundary but blocks authenticated production UI integration.
2. **Auth and storage adapters are absent.** Backend defaults disabled. No trusted account assignment repository, hierarchy repository, worker roster/mapping adapter, or operational PostgreSQL repository is configured. `/api/me` cannot grant operational access in this state.
3. **No frontend client exists for several backend routes** listed above, including closure, audit, verification, next-action decisions, snapshots and offline sync. They are unsupported by the current frontend, not silently handled by mock data.
4. **Response schemas are mostly hand-validated dictionaries.** FastAPI response models are not declared; client validators check key fields but permit extra properties and unknown optional values. The measurement requestâ€™s nested map is also broad at the transport schema level, although domain validation restricts it.
5. **Error classification is lossy.** Backend 409 conflicts become the same client `invalid_request` code as 400/422. Safe messages are retained, but callers cannot distinguish conflict from malformed input by `B2ApiError.code`.
6. **Read-back validation is selective.** Referral create read-back does not compare destination/due date; action validation similarly checks selected lifecycle fields, not every response attribute.
7. **CORS defaults to localhost origins.** A deployed frontend origin must be explicitly configured in backend `B2_CORS_ORIGINS`; current `B2_AUTH_MODE=disabled` and absent backend deployment make this a future configuration requirement, not a live deployment check.
8. **Synthetic and demo identifiers remain distinct.** No code or audit finding establishes a mapping between frontend fixture identifiers (such as `BEN-0142`, `AWC-702`, `AWW-409`) and B2 prototype IDs. Do not bridge these datasets without an approved contract and mapping source.

## Test evidence matrix

| Claim | Evidence | Result classification |
|---|---|---|
| Frontend mock demo persistence and role gates | `frontend/src/utils/casework.test.ts` (`mockStore` consistency, validation, role/scope, demo persona, screen boundary) | **Verified as frontend unit behavior**, local only. |
| B2 request paths, schemas, response validation and safe API errors | `frontend/src/services/b2Api.test.ts` | **Verified against mocked fetch responses**, not a server. |
| Supabase lifecycle and profile handling | `frontend/src/services/authLifecycle.test.ts` | **Verified with mocked auth/API actions**, live provider unverified. |
| Isolated synthetic workflow writes/read-back, invalid input, duplicate writes, scope, role and fail-closed default | `B2/test_frontend_workflow.py` | **Assertions present; execution unverified** while TestClient hangs before app startup. |
| Server role assignment and hierarchy helper rules | `B2/test_authorization.py`, `B2/test_authorization_migration.py` | Unit coverage exists; do not infer live database behavior. |
| Other B2 route statuses, audit and transitions | `B2/test_api_day1.py`, `B2/test_complete_workflow.py`, `B2/test_me_api.py` | HTTP coverage exists in source; current Windows HTTP execution is **unverified**. |
| Frontend static build and SPA rewrite JSON | `npm.cmd test`, isolated TypeScript check/build, JSON parsing of `frontend/vercel.json` | Frontend checks are run below; rewrite is syntax/config validated only, not deployed or tested with Vercel routing. |

## Vercel routing configuration

`frontend/vercel.json` supplies an SPA fallback from client routes to `/index.html`. Deploy with Vercel project root set to `frontend`; the Vite output remains its default `dist`. This config does not configure auth, B2 URLs, CORS or backend deployment.

## Verification performed for this audit

- `python.exe -m json.tool frontend/vercel.json` â€” passed; the file parses as JSON. This checks syntax, not deployed Vercel rewrite behavior.
- `npm.cmd test` from `frontend/` â€” **57 passed, 0 failed**. Service tests use mocked fetch responses; this is not a live API test.
- `tsc.cmd --noEmit --tsBuildInfoFile C:\IIT_B\.test-tmp\integration-audit-tscheck-20261028.tsbuildinfo` from `frontend/` â€” passed. Temporary metadata was removed; `frontend/tsconfig.tsbuildinfo` was preserved.
- `vite.cmd build --outDir C:\IIT_B\.test-tmp\integration-audit-build-20261028` from `frontend/` â€” passed after transforming 2,157 modules. Temporary build output was removed. Existing Vite native-config `__dirname` and >500 kB chunk warnings remain. The isolated build used blank B2/Supabase configuration and `VITE_ENABLE_DEMO_MODE=true` to verify the mock-only frontend build boundary.
- `git diff --check` â€” passed; Git may still print line-ending conversion notices.
- No Vercel CLI or deployment was used. No backend HTTP test was run for this audit; the last reproduced Windows `TestClient` hang remains a verification limitation, not a passed result.
