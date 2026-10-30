# B2: workflow API and primitives

B2 contains task, referral, authorization, audit, and offline-queue workflow modules plus a FastAPI service backed by a local SQLite prototype store. The API uses synthetic data and protected routes fail closed by default. The development-only synthetic workflow pages call this API; original Dashboard, Action Queue, and Referrals pages remain separate `mockStore` demos. No production identity/database infrastructure is connected. Use synthetic data only.

## Modules

- `demo_clock.py`: deterministic date parsing and a controllable prototype clock, defaulting to `2026-10-15`.
- `tasks.py`: create, acknowledge, reassign, escalate, complete, and summarize task dictionaries, retaining event history. `create_task(child_row, evaluation, created_on=None, task_id=None)` returns `None` for GREEN and a JSON-compatible task for RED/AMBER/GREY.
- `referrals.py`: referral lifecycle, contact attempts, outcomes, next-step prompts, and summaries. Prompts are workflow suggestions, not medical advice.
- `roles.py`: default-deny backend permission policy, scope checks, task visibility, caller-provided workload cap, and weekly groupings. Production identity and organization adapters are not configured.
- `api.py`, `auth.py`, `store.py`, `beneficiaries.py`, `verification.py`: prototype HTTP routes, verified-identity boundary, SQLite store, child registration, measurement recording/evaluation, and history.
- `fallback.py`: manual/offline fallback record helpers. Authentication failure does not grant protected-record access.
- `audit.py`: append-only in-memory event and consent-history models. These do not provide durable audit storage or establish legal consent.
- `sync.py`: atomic local JSON queue and version-aware reconciliation against state explicitly supplied by the caller. There is no network transport or remote server.
- `test_tasks.py`, `test_day2.py`, `test_beneficiaries.py`, `test_authorization.py`, `test_api_day1.py`, `test_complete_workflow.py`: unit and API regression tests. API tests require the declared FastAPI dependencies.

## B1 boundary

The intended direct-call contract uses B1's `child_id`, `assigned_worker_id`, and evaluation `colour`/`reasons`. B2 does not load B1 CSVs itself. A caller must evaluate a row with B1 and pass both the row and evaluation to B2. B1's family helper can produce a joint-visit-shaped dictionary, but no built-in adapter persists that object as a B2 task.

The day-0/day-2/day-5/day-10 escalation ladder in the simulation handoff is an unvalidated placeholder. Workflow outcomes and role matrix also need team/field agreement.

## Run tests (Windows PowerShell)

From repository root:

```powershell
python -m unittest B2.test_beneficiaries B2.test_authorization B2.test_tasks B2.test_day2 -v
```

With dependencies from `B2/requirements.txt` already provisioned, run `python -m uvicorn B2.api:app --reload` from the repository root. Keep `B2_AUTH_MODE=disabled`; protected routes fail closed until trusted identity, assignment, hierarchy, and repository adapters are configured. Do not enable demo authentication to make the UI work. B2 SQLite is prototype-only. See `docs/backend-frontend-contract.md` for routes and request details.

## Readiness limits

Before real-world use, provide reviewed identity and server-side organization assignments, durable operational storage, encryption, audit/retention/recovery controls, authenticated remote sync with monitoring and conflict review, and privacy/operational/safety review. No such production integrations are implemented here.
