# BE2 workflow handoff (prototype; synthetic data only)

## Current files

- `demo_clock.py`: deterministic demo date; defaults to BE1's 2026-10-15 reference date.
- `tasks.py`: F4 task creation, acknowledgement, reassignment, due escalation, completion outcomes, and event history.
- `test_tasks.py`: standard-library unit tests for today's F4 work.

## Shared handoff contract used

BE1's `B1/README_BE1.md` and `B1/children.csv` provide:

- Child identifier: `child_id` (Child A is `C0001`).
- Initial worker: `assigned_worker_id` (Child A is `W07`).
- BE1 decision: `evaluate_child(row)` returns `colour` (`RED`, `AMBER`, `GREEN`, `GREY`) and `reasons`.
- BE1's file may contain `task_status` (`new` for Child A and `none` for some other rows); BE2's workflow API currently creates a separate task object and does not rewrite BE1's CSV.

`create_task(child_row, evaluation, created_on=None, task_id=None)` returns:

- `None` for GREEN cases.
- A JSON-serializable task dictionary for RED/AMBER/GREY cases, with `task_id`, `child_id`, `alert_level`, `colour`, `status`, `owner_id`, `owner_role`, `created_on`, `due_on`, `escalation_level`, `outcome`, `reasons`, `events`, and a visible prototype-policy label.

Main action functions return a **new dictionary** and leave the input task unchanged:

- `acknowledge_task(task, actor_id, on)`
- `reassign_task(task, actor_id, new_owner_id, on, reason)`
- `get_escalation_due(task, on)`
- `escalate_task(task, actor_id, target_owner_id, on, reason)`
- `complete_task(task, actor_id, outcome, on, notes="")`
- `task_is_overdue(task, on)`
- `list_due_escalations(tasks, on)`

## Prototype assumptions that need FE/team confirmation

- The day-0 worker, day-2 supervisor, day-5 ANM/block, day-10 district ladder is copied from `member3_data_simulation/handoff/README.txt`, which explicitly calls the timings placeholders pending field interviews.
- The outcome list (`reached`, `not_reached`, `referred`, `recheck_required`, `no_action_needed`, `other`) is an initial UI contract proposal, not a final clinical or program policy. `other` requires a note.
- Escalation requires a caller-supplied target user ID. BE2 F7 role/user mapping will be added separately; this module never invents an account ID.
- All outputs are labelled synthetic/proposed. They are not a clinical decision-support system and must not be used for real patient care.

## Run today's tests

From the repository root, with Python 3.9 or newer:

```bat
python -m unittest discover -s B2 -p "test_*.py" -v
```

No third-party dependencies are needed for these BE2 tests.
