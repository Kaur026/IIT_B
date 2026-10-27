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
# BE2 baseline audit — latest public main

**Audited revision:** `b25f0fe` (`Document project architecture and workflows`), fetched from `Kaur026/IIT_B` main on 26 Oct 2026. The active work branch is `feature/be2-all-workflow`, created from that revision.

## Baseline inventory

| Area | Latest main contents | BE2 integration finding |
|---|---|---|
| B1 | Synthetic CSVs, rule engine, data checks, rule settings, family links, WHO growth table | Python functions and fixtures are available. Current child IDs include `C0001`; `B1/children.csv` has no `centre_id`. The Oct 24 12-dataset/5-record handoff is not present in this checkout. |
| B2 | Pure-Python tasks, referral, fallback, roles, audit/consent and local sync queue helpers | No HTTP server, shared durable store, endpoint authorization boundary, persistent referral/exception/closure records, or integrated workflow routes existed at baseline. |
| Frontend | React/Vite screens and mock store; local demo state uses browser `localStorage` | Existing pages are not connected to the Python backend. FE files are owned by FE1/FE2 and are not edited in this BE2 branch. |
| Docs | Repository architecture and data-flow notes | They describe the prototype as disconnected and non-production. |
| Dependencies/tests | B2 standard-library `unittest` suite; B1 uses pandas | Baseline B2 suite: **29 tests passed** before BE2 API work. A baseline B1 reset assertion is a known separate issue. |

## Baseline routes, roles, and storage

- There were no Python API routes at baseline.
- Existing B2 workflow functions accept JSON-compatible dictionaries and mostly return updated copies; they were not tied to a database.
- Frontend role selection is a demo simulation; it does not authenticate a caller to Python.
- Existing B2 audit and consent helpers were in-memory models, not durable records.
- Existing `sync.py` used an atomic local JSON queue and version comparison utilities; it had no remote authenticated adapter or sync UI.

## Day 1 integration limits retained in this branch

1. API contract remains **proposed, not team-signed**; FE1/FE2 wireframes and the BE1 field/fixture handoff were not included in latest main.
2. The API demo imports only the existing synthetic C0001 row. `AWC-001` is a clearly labelled demo-only centre assignment so centre permissions can be exercised; it is not source data.
3. No B1, FE1, FE2, `docs/`, or Member 3-owned files were changed.
4. No live Poshan Tracker connection, real login, or real beneficiary data is claimed.

## Safety boundary

A flag is not a diagnosis; the source measurement is immutable; a remeasurement is a new linked record. Mock explanations/suggestions are grounded in saved synthetic records. AI never gives treatment/termination advice or decides counts, eligibility, permissions, or closure. Unverified operational rules remain disabled or labelled draft/demo-only. No Aadhaar numbers or OTPs are stored.
