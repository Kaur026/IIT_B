# Step 0 baseline audit — Poshan Action Layer

**Reviewed:** public `main` snapshot `6b4eca0` (merge commit for PR #2), local feature branch `feature/be2-day1-updated` created for this draft.  
**Purpose:** record the existing prototype before the revised BE2 work; no existing B1 records or thresholds are modified by this audit.

## Repository inventory

| Area | Current contents | Baseline observation |
|---|---|---|
| B1 | CSV synthetic child/mother/family data, thresholds JSON, rules engine, checks, rule settings, family links and a manual test script | Rules are callable Python functions; the CSV currently has `child_id` values such as `C0001`, not the new proposed `BEN-0001` contract, and no `centre_id` column. |
| B2 | Pure-Python task, referrals, fallback, audit, roles and local queue modules, plus 29 unit tests | No HTTP API, no shared persistent record store, no centre-scope enforcement at an application boundary, and no verify/history/AI-service endpoints. Several modules are standalone helpers rather than an integrated workflow. |
| Member 3 | Simulation code and synthetic handoff CSVs | Separate schemas/IDs from B1; do not assume these are the final shared data contract. |
| Frontend | No `app.py`, `pages/`, React app or other screen code in this snapshot | FE screens and their request/response contracts are not present to verify. |
| Runtime/dependencies | No root `requirements.txt` / `pyproject.toml`; Member 3 has its own requirements file | B1 imports pandas; a new FastAPI service needs an explicit dependency file. |
| HTTP/API | No FastAPI/Flask app or routes found | Day 1 must add a proposed API boundary or wait for team sign-off on a different host framework. |
| Persistence | No database/store for task actions, verifications, decisions or audit records | Existing in-memory functions/CSV data are not a durable workflow backend. |

## Baseline checks

- Existing B2 suite: `python -m unittest discover -s B2 -p "test_*.py" -v` — **29 passed** at review time.
- Existing B1 `test_be1.py` has previously failed the reset assertion (`reset restores starting values`) in this environment. It is outside the B2 changes and should be separately re-run/reported to BE1.
- No UI screenshot was available in the repository, so no baseline screenshot is included. FE1/FE2 should capture one when the working prototype exists.

## Important boundary

All repository data is synthetic. This baseline is a source-tree audit, not a security, clinical, legal, or field validation. The revised flow requires the team to approve the shared IDs, centre mapping, roles/scopes, status enums, and API contract before frontend integration.
