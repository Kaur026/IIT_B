# BE2 end-to-end backend handoff (synthetic prototype)

## 1. Work completed in this BE2 branch

This branch starts from latest public `main` (`b25f0fe`) and keeps the work on `feature/be2-all-workflow`. BE2-owned work now includes:

- FastAPI routes and SQLite persistence for demo cases, measurements, immutable flags, tasks, audit events, decisions, referrals/DEIC, access exceptions, restricted maternal follow-ups, closure confirmations and immutable briefing snapshots.
- Explicit task transitions, server-side demo roles/centre scopes, fail-closed missing assignment checks and synthetic owner validation.
- A verification endpoint that delegates checks/rules to BE1, stores the new reading with a parent link, and never overwrites the original.
- Explain Case, History Summary and Next Action mock-first services. Accepted/edited Next Actions dispatch through the normal verification/task routes and then save/audit the decision.
- Non-AI briefing counts and snapshots from SQLite records; summary lines include source links.
- Two-key closure gate, configured per case type; no policy is enabled by default. A missing/unapproved policy blocks closure.
- Generic and DEIC follow-up states: `sent → acknowledged → attended → outcome_recorded`, plus overdue calculation only for a supplied due date.
- A coded access-exception tracker with human review/resolution. It never denies a benefit or makes an eligibility decision.
- Restricted adult maternal follow-up, disabled by default, with under-18 deferral and no treatment advice.
- Per-demo-actor local offline queue, pending/synced/failed/conflict states, retry, idempotency and explicit audited conflict resolution. It is only a local reconciliation simulator; no remote API sync is implemented.
- Audit API and persistent audit event for each successful workflow mutation and sync/closure resolution.
- Privacy guardrails for Aadhaar/OTP field names, numeric-like IDs in notes/queue payloads, and free text.

## 2. Ownership and dependencies

Only BE2-owned paths are changed: `B2/*` plus root `.gitignore`. No frontend, B1 or Member 3 code/data was edited. The React/Vite frontend in latest main is a standalone mock using localStorage; no frontend-to-Python connection or FE wireframe contract was supplied. The B1 twelve-dataset fixture/centre mapping, referral/maternal seeds, and team-signed API/closure/role policy were also not supplied. The C0001 → AWC-001 mapping is an explicitly synthetic test seed, not source truth.

See `BASELINE_AUDIT.md`, `API_CONTRACT_DAY1.md`, and `OFFLINE_SYNC_REVIEW.md` before integration. The API contract remains **proposed, not team-signed**.

## 3. Windows CMD setup from a clean checkout

1. Clone the latest public repository into a new directory:

   ```cmd
   cd /d "%USERPROFILE%"
   git clone https://github.com/Kaur026/IIT_B.git iit-b-be2-all
   cd /d "%USERPROFILE%\iit-b-be2-all"
   git switch -c feature/be2-all-workflow origin/main
   ```

2. Download `BE2_Complete_Workflow.zip` from the Arena file viewer and extract the files into this repository root, merging `B2` and replacing same-named BE2 files. Alternatively, use the archive's real path:

   ```cmd
   tar -xf "%USERPROFILE%\Downloads\BE2_Complete_Workflow.zip" -C "%USERPROFILE%\iit-b-be2-all"
   ```

3. Confirm Python 3.10 or newer (`py --version`), then create/activate a virtual environment and install dependencies:

   ```cmd
   py -m venv .venv
   .venv\Scripts\activate.bat
   python -m pip install --upgrade pip
   python -m pip install -r B2\requirements.txt
   ```

4. Run all BE2 tests:

   ```cmd
   python -m unittest discover -s B2 -p "test_*.py" -v
   ```

5. Start the local API:

   ```cmd
   python -m uvicorn B2.api:app --reload
   ```

6. Open `http://127.0.0.1:8000/docs`. In Swagger's `X-Demo-Actor` header use one of the synthetic keys listed below. Press Ctrl+C in the server terminal to stop.

The default SQLite file is `B2/.prototype.sqlite`; the local queue is under `B2/.offline/`. They are ignored by Git. Set `B2_DB_PATH` or `B2_OFFLINE_QUEUE_DIR` before launching if you want a separate local demo. Set `B2_DEMO_DATE` once for the shared synthetic reporting date; default is `2026-10-15`.

## 4. Safe local API walkthrough

Use only the synthetic fixture. `demo-supervisor` can create a task and supervisor-managed records; `demo-worker` is scoped to the synthetic C0001 assignment. The `demo-cdpo`, `demo-nodal`, `demo-state`, and `demo-india` actors are read-only at their configured centre/reporting scope. These keys simulate roles; they are not login/security credentials.

1. `GET /api/health` — confirm synthetic service/seed state.
2. `GET /api/cases/C0001/explain?flag_id=FLAG-C0001-BASELINE` (`demo-supervisor`) — inspect saved flag, source values, rule version, missing information and human-review notice.
3. `GET /api/beneficiaries/C0001/history` (`demo-supervisor`) — inspect the timeline and source links.
4. `POST /api/verification` (`demo-worker`) — submit a new date/reading. The response returns a new measurement ID, parent measurement ID, check result and new saved flag. Repeat GET history to see both records; the original remains unchanged.
5. `POST /api/tasks` (`demo-supervisor`) with the baseline flag; then `POST /api/tasks/{id}/actions` to `assign` to `W07`. `demo-worker` may then `acknowledge`, `start`, and `record_progress`. Every successful action is audited. The API rejects a single `close` action.
6. `GET /api/next-actions/{flag_id}` first and copy its `suggestion_id` into the decision request. Submit `POST /api/next-actions/{flag_id}/decision` with that ID plus `decision: "accept"`, `"edit"`, or `"reject"`. A stale ID returns HTTP 409; fetch a fresh suggestion rather than confirming an outdated action. `reject` requires a reason. `accept` or `edit` dispatches through the normal task/verification endpoint; a verification acceptance must include the measurement fields, and an edit must specify an allowed `action_code` in `action_data`.
7. `POST /api/referrals` with `referral_kind: "deic"` or `"general"`; apply `acknowledge`, `attend`, then `record_outcome` through the referral action route. A referral is marked overdue only when its caller supplies a due date; no policy deadline is invented.
8. `POST /api/access-exceptions` with an allowed coded barrier; a supervisor may resolve it using a coded outcome. This is a human-review tracker, not an automatic denial.
9. `GET /api/briefing?centre_id=AWC-001&as_of=2026-10-15` and `POST /api/briefing/snapshots` (`demo-supervisor`) — counts are calculated by code and saved snapshots are immutable.
10. `POST /api/offline/queue`, `GET /api/offline/queue`, and `POST /api/offline/sync/attempt` demonstrate the local queue simulator. `remote_sync_enabled` remains false; this does not contact or update a server.

## 5. Closure policy and maternal scope are opt-in

- **Closure:** `closure_policy.example.json` is a draft with `approved: false`. The exact keys/roles must be set by case type and confirmed by the supervisor/team. Until a reviewed policy file is supplied through `B2_CLOSURE_POLICY_FILE`, closure returns `closure_policy_not_approved`. The API will close only after every configured confirmation, distinct actors and a valid task outcome are recorded. Never flip the flag just to make a demo appear approved.
- **Maternal follow-up:** disabled by default. The team must approve scope and roles before setting `B2_MATERNAL_SCOPE_APPROVED=true`. Even in the opt-in prototype, access is restricted to the configured allow-list, under-18 cases are deferred without a stored follow-up, and the module stores no clinical treatment details.
- **Offline sync:** see `OFFLINE_SYNC_REVIEW.md`. Local JSON is unencrypted and no remote authenticated sync adapter exists. Do not put personal data in it.

## 6. Route inventory

`GET /api/health`, `GET /api/audit`, case explain/history, `POST /api/verification`, task create/list/actions/closure-confirmations, Next Action suggest/decision, Daily Briefing and briefing snapshots, referral create/list/detail/actions, access-exception create/list/detail/resolve, maternal follow-up create/list/actions (opt-in), offline queue/list/sync-attempt/retry/conflict-resolution.

Exact request/response fields and permission caveats are in `API_CONTRACT_DAY1.md`. Existing FE pages must be wired by FE1/FE2 after they accept that contract; this branch does not modify their files.

## 7. Workflow handoff order and completion status

1. **Step 0:** baseline audit is complete; API contract is proposed, not signed. Team confirmation still required.
2. **Steps 1–4:** BE1's agreed field list, five-record fixture, full seed/rule handoff and FE wireframes are absent from latest main. BE2 uses only the existing synthetic C0001 fixture; does not edit B1 or FE files.
3. **Steps 5–6:** task/status engine, remeasurement endpoint, role/centre enforcement and audit are implemented and covered by tests. FE1 wiring/bug list has not been supplied.
4. **Step 7:** grounded Explain Case and History Summary endpoints are implemented.
5. **Step 8:** accepted/edited Next Action dispatches through normal workflow service; non-AI Daily Briefing and immutable snapshots use backend counts.
6. **Step 9:** referral/DEIC state machine, coded access exceptions and policy-gated two-key closure are implemented. Policy values require team/supervisor sign-off before enabling.
7. **Step 10:** age-transition logic remains BE1-owned. Maternal module is implemented as opt-in restricted code; no approval or seed profile is present, so it stays off by default.
8. **Step 11:** offline queue/retry/conflict simulator is implemented only after documenting its local-only architecture boundary. Remote sync remains blocked until an architecture/security review.
9. **Steps 12–14:** FE1/FE2 end-to-end story and screenshots/video cannot be claimed complete because their integration handoff is not present. BE2 code/tests/docs are ready for their review and a bug list.

## 8. Safety and production boundary

All bundled/tested records are synthetic. A screening flag is not a diagnosis and does not prove worker error. AI is mock-first and does not give treatment or pregnancy-termination advice, determine eligibility/permissions/counts/closure, or autonomously act. No Aadhaar numbers or OTPs are stored. Age bands, SCM, ration-date and 40%-disability rules are not enabled. There is no live Poshan Tracker integration, real authentication, encrypted production database, or remote sync. Do not use this prototype with real beneficiary data.
