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
