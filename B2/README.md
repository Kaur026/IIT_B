# B2: workflow primitives

B2 contains Python standard-library prototypes for task and referral workflows, role checks, manual fallback, event/consent models, and an offline JSON queue. It has no web server, database, or automatic connection to B1 or the frontend. Use synthetic data only.

## Modules

- `demo_clock.py`: deterministic date parsing and a controllable prototype clock, defaulting to `2026-10-15`.
- `tasks.py`: create, acknowledge, reassign, escalate, complete, and summarize task dictionaries, retaining event history. `create_task(child_row, evaluation, created_on=None, task_id=None)` returns `None` for GREEN and a JSON-compatible task for RED/AMBER/GREY.
- `referrals.py`: referral lifecycle, contact attempts, outcomes, next-step prompts, and summaries. Prompts are workflow suggestions, not medical advice.
- `roles.py`: proposed role permissions, task visibility, caller-provided workload cap, and weekly groupings. It is not authentication or server authorization.
- `fallback.py`: manual/offline fallback record helpers. Authentication failure does not grant protected-record access.
- `audit.py`: append-only in-memory event and consent-history models. These do not provide durable audit storage or establish legal consent.
- `sync.py`: atomic local JSON queue and version-aware reconciliation against state explicitly supplied by the caller. There is no network transport or remote server.
- `test_tasks.py`, `test_day2.py`: standard-library unit tests.

## B1 boundary

The intended direct-call contract uses B1's `child_id`, `assigned_worker_id`, and evaluation `colour`/`reasons`. B2 does not load B1 CSVs itself. A caller must evaluate a row with B1 and pass both the row and evaluation to B2. B1's family helper can produce a joint-visit-shaped dictionary, but no built-in adapter persists that object as a B2 task.

The day-0/day-2/day-5/day-10 escalation ladder in the simulation handoff is an unvalidated placeholder. Workflow outcomes and role matrix also need team/field agreement.

## Run tests (Windows PowerShell)

From repository root:

```powershell
python -m unittest B2.test_tasks B2.test_day2 -v
```

No third-party packages are required. There are no API endpoints or standalone service command. Call module functions from Python and persist returned objects only through explicit caller code.

## Readiness limits

Before real-world use, provide reviewed identity and server-side authorization, protected durable storage, encryption, audit/retention/recovery controls, authenticated remote sync with monitoring and conflict review, and privacy/operational/safety review. No such production integrations are implemented here.
