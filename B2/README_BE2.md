# BE2 workflow handoff (prototype; synthetic data only)

## BE2 files

- `demo_clock.py` — deterministic demo date; defaults to BE1's 2026-10-15 reference date.
- `tasks.py` — F4 task creation, acknowledgement, reassignment, due escalation, completion outcomes, and event history.
- `referrals.py` — F5 referral issuance, contact attempts, outcome logging, next-step suggestions, and summary counts.
- `fallback.py` — F6 manual/offline fallback records. Authentication failures never grant access to protected records.
- `roles.py` — F7 prototype role permissions, task visibility, worker-capacity guard, and ISO-week workload grouping.
- `audit.py` — F10 append-only audit-event model and consent history.
- `sync.py` — F9 atomic local JSON queue and version/conflict-aware synchronization primitives. No remote server connection is implemented.
- `test_tasks.py`, `test_day2.py` — standard-library unit tests.

## Shared BE1 contract

BE1's `B1/README_BE1.md` and `B1/children.csv` provide:

- Child identifier: `child_id` (Child A is `C0001`).
- Initial worker: `assigned_worker_id` (Child A is `W07`).
- BE1 decision: `evaluate_child(row)` returns `colour` (`RED`, `AMBER`, `GREEN`, `GREY`) and `reasons`.
- `GREY` means the measurement is not trusted and needs rechecking; it is not a confirmed clinical finding.
- BE1's CSV may contain `task_status` values such as `new` or `none`; BE2 creates a separate workflow task and does not rewrite BE1's CSV.

`create_task(child_row, evaluation, created_on=None, task_id=None)` returns:

- `None` for GREEN cases.
- A JSON-compatible task dictionary for RED, AMBER, or GREY cases. The task includes an owner, status, created/due dates, escalation level, reasons, and event history.

## UI/backend contracts and prototype assumptions

- `OUTCOME_OPTIONS` and the referral reason/outcome constants are initial interface proposals. BE1/BE2/FE1/FE2 must agree on them before integration.
- The day-0 worker, day-2 supervisor, day-5 ANM/block, day-10 district escalation ladder comes from Member 3's handoff, which explicitly labels it a placeholder pending field validation. It is not clinical guidance.
- `roles.py` has a proposed role/permission matrix. It is suitable for a demo only; a UI role switch is not authentication or production authorization.
- The workload guard takes `max_active_tasks` as an input; BE2 does not invent a capacity limit.
- `audit.py` and task/referral timelines are in-memory Python dictionaries. They are not a durable audit database and do not establish legal consent.
- `sync.py` saves synthetic operations locally and detects version conflicts. It does not connect to a remote API or provide encryption, authentication, or conflict resolution UI.
- F6 fallback offers an approved manual-process path; it never bypasses authorization or enables protected-data access after authentication failure.
- Referral suggestions are neutral workflow prompts, not medical advice or treatment decisions.

## Run BE2 tests

From the repository root with Python 3.9 or newer:

```bat
python -m unittest discover -s B2 -p "test_*.py" -v
```

No third-party packages are needed for B2 tests. BE1's rule engine uses pandas; install it separately if it is not already available:

```bat
python -m pip install pandas
```

## Not production-ready yet

Before any use with real people or data: get team/field approval for workflow timings and outcomes; add authenticated identity and server-side authorization; persist audit, consent, referral, and task data in a reviewed database; encrypt/protect local and remote data; connect sync to an authenticated server with retry/monitoring; define retention and recovery; and complete privacy, clinical-safety, and operational review. All repository data is synthetic and every integration is proposed.
