# BE2 workflow handoff (prototype; synthetic data only)

## BE2 files

- `BASELINE_AUDIT.md` — baseline inventory of the checked-out public repository.
- `API_CONTRACT_DAY1.md` — proposed, not team-signed Day 1 routes and payload boundaries.
- `api.py` — FastAPI prototype endpoints; actor keys are synthetic demo identities only.
- `store.py` — SQLite repository for synthetic beneficiary, measurement, flag, task, decision, and audit records.
- `verification.py` — append-only remeasurement service using BE1 checks and rules.
- `ai_service.py` — mock-first grounded Explain Case, History Summary, Next Action and deterministic briefing helpers.
- `demo_clock.py` — deterministic demo date; defaults to BE1's 2026-10-15 reference date.
- `tasks.py` — F4 task creation, explicit status transitions, due escalation, completion outcomes, and event history. API Day 1 intentionally blocks close until two-key closure is implemented/approved.
- `referrals.py` — F5 referral issuance, contact attempts, outcome logging, next-step suggestions, and summary counts.
- `fallback.py` — F6 manual/offline fallback records. Authentication failures never grant access to protected records.
- `roles.py` — F7 prototype role permissions, centre scope, task visibility, worker-capacity guard, and ISO-week workload grouping.
- `audit.py` — F10 append-only audit-event model and consent history.
- `sync.py` — F9 atomic local JSON queue and version/conflict-aware synchronization primitives. No remote server connection is implemented.
- `test_tasks.py`, `test_day2.py`, `test_api_day1.py` — tests for workflow modules and Day 1 API behavior.

## Shared BE1 contract

BE1's `B1/README_BE1.md` and `B1/children.csv` provide:

- Child identifier: `child_id` (Child A is `C0001`).
- Initial worker: `assigned_worker_id` (Child A is `W07`).
- BE1 decision: `evaluate_child(row)` returns `colour` (`RED`, `AMBER`, `GREEN`, `GREY`) and `reasons`.
- `GREY` means the measurement is not trusted and needs rechecking; it is not a confirmed clinical finding.
- BE1's CSV may contain `task_status` values such as `new` or `none`; BE2 creates a separate workflow task and does not rewrite BE1's CSV.
- `AWC-001` is assigned only to the local C0001 demo seed; the BE1 CSV has no centre field. It is not a source-system mapping.

## Run the FastAPI prototype (Windows / VS Code)

1. Open a terminal at the repository root (the directory containing `B1` and `B2`).
2. Create and activate a virtual environment:

   ```bat
   py -m venv .venv
   .venv\\Scripts\\activate
   ```

3. Install the API and BE1 dependencies:

   ```bat
   python -m pip install -r B2/requirements.txt
   ```

4. Start the server:

   ```bat
   python -m uvicorn B2.api:app --reload
   ```

5. Open `http://127.0.0.1:8000/docs` for the local interactive API docs. Use one of the documented synthetic actor keys in the `X-Demo-Actor` header: `demo-worker`, `demo-supervisor`, `demo-cdpo`, `demo-nodal`, `demo-state`, or `demo-india`.

The service seeds only the existing synthetic BE1 `C0001` row. It stores a demo-only centre assignment (`AWC-001`) and a local SQLite file at `B2/.prototype.sqlite`. Do not add real or identifying information. Set `B2_DB_PATH` to use a different local path, or pass an in-memory `PrototypeStore` in tests. The local SQLite file is git-ignored.

## Proposed Day 1 API

- `GET /api/health`
- `GET /api/cases/{beneficiary_id}/explain?flag_id=...`
- `GET /api/beneficiaries/{beneficiary_id}/history`
- `POST /api/verification`
- `POST /api/tasks`
- `GET /api/tasks?centre_id=...`
- `POST /api/tasks/{task_id}/actions`
- `GET /api/next-actions/{flag_id}` and `POST /api/next-actions/{flag_id}/decision`
- `GET /api/briefing?centre_id=...&as_of=YYYY-MM-DD`

The route names are still a proposal and must be confirmed with BE1/FE1/FE2 before wiring. Explain/history/next-action are deterministic mock services; no external AI provider is called. Briefing counts are calculated from saved records in code. Accepted next-action decisions are logged for review and must be followed by the corresponding ordinary task/verification endpoint; the suggestion endpoint itself does not perform an action.

`POST /api/verification` accepts the `beneficiary_id`, a `measurement` dictionary containing only `measurement_date`, `weight_kg`, `height_cm`, `muac_mm`, `oedema`, and/or `danger_sign`, plus `recorded_at` and optional `today`. It appends a new measurement with a link to the prior measurement; it never edits the original record. Data checks and flags are evaluated through BE1 modules.

Day 1 deliberately refuses `close` task actions. Two-key closure, referrals/DEIC, exception tracking, restricted maternal follow-up and offline save/sync remain later work; they need the stated handoffs and approvals. No treatment advice, automated eligibility, clinical diagnosis, AI-generated counts, Aadhaar/OTP storage, or live Poshan Tracker integration is implemented or claimed.

## Run tests

From the repository root:

```bat
python -m unittest discover -s B2 -p "test_*.py" -v
```

This command runs the legacy standard-library unit tests plus API tests; FastAPI, pandas and httpx must be installed as above. It does not replace a team integration review or production security review.

## Existing module assumptions

- `create_task(child_row, evaluation, created_on=None, task_id=None)` returns `None` for GREEN; RED, AMBER, and GREY produce a JSON-compatible task record.
- `OUTCOME_OPTIONS` and the referral reason/outcome constants are initial interface proposals. BE1/BE2/FE1/FE2 must agree on them before integration.
- The day-0 worker, day-2 supervisor, day-5 ANM/block, day-10 district escalation ladder comes from Member 3's handoff, explicitly a placeholder pending field validation. It is not clinical guidance.
- A UI role switch is not authentication or production authorization. A real identity provider/server session and security review are required before real data.
- The workload guard takes `max_active_tasks` as an input; BE2 does not invent a capacity limit.
- `sync.py` saves synthetic operations locally and detects version conflicts. It does not connect to a remote API or provide encryption, authentication, or conflict resolution UI.
- F6 fallback offers a manual-process path; it never bypasses authorization or enables protected-data access after authentication failure.
- Referral suggestions are neutral workflow prompts, not medical advice or treatment decisions.

## Not production-ready

Before any use with real people or data: get team/field approval for workflow timings, outcomes, route contracts and closure checks; add verified identity and server-side authorization; review database, encryption, audit, consent and retention; connect sync to an authenticated server with retry/monitoring; define recovery; and complete privacy, safety, and operational review. All repository data and demo actors are synthetic, and every new integration is proposed.
