Visit SITE: https://iit-b-ev3q.vercel.app
# Poshan Tracker Action Layer

Prototype workspace for exploring a nutrition action workflow: synthetic beneficiary and measurement data, configurable screening rules, data-quality checks, and follow-up task concepts. The original React screens remain local demos; separate development-only synthetic workflow pages call the B2 FastAPI prototype. Neither the original screens nor B2 are connected to operational data or trusted production identity. All bundled beneficiary data is synthetic.

## Objectives and status

The project explores how screening signals might be reviewed and turned into verification, referral, and follow-up work. It provides working prototype logic and user-interface flows for discussion. It is not a production health system, clinical decision tool, authentication system, or validated source of clinical guidance.

| Implemented in this repository | Planned, proposed, or incomplete |
| --- | --- |
| React/Vite mock screens with simulated roles and local browser persistence, including a deterministic 600-beneficiary cohort; separate development-only B2 workflow pages; a private-source B1 parser contract used only in tests | Trusted B1 CSV serving, frontend-to-B2 operational integration for real users, and production backend identity/storage |
| B1 rule evaluation, measurement trust checks, configurable thresholds, approval/override operations, and mother-child family links | Clinical/field validation of rule thresholds and operational schedules |
| B2 synthetic FastAPI workflow API, task/referral/fallback/role/audit primitives, and local offline queue/synchronization prototype | Production identity/database adapters, remote authenticated synchronization, durable production storage, encryption, operational hierarchy assignments |
| Member 3 synthetic data generation, analysis, and handoff utilities | Production data import, governance, retention, monitoring, recovery, and privacy/safety review |

## Technology

- Frontend: React, TypeScript, React Router, Vite, Tailwind CSS, and localStorage.
- B1 and B2: Python. B1 uses pandas; `who_growth.py` uses the repository's bundled `who_lms.json` table. B2's API dependencies are listed in `B2/requirements.txt`; its workflow helper modules use the standard library.
- Simulation: Python with pandas, NumPy, and Matplotlib (see `member3_data_simulation/requirements.txt`).
- Tests: Node's built-in frontend unit/service tests; Python `unittest` modules for B2; a standalone B1 assertion script.

## Architecture

```mermaid
flowchart LR
  U[User] --> FE[React/Vite frontend]
  FE --> LS[(Browser localStorage<br/>synthetic demo state)]
  CFG[ B1 thresholds JSON ] --> B1[B1 rules and data checks]
  CSV[B1 synthetic CSV files] --> B1
  LMS[WHO LMS JSON table] --> B1
  B1 --> E[Evaluations, issues, family/task proposals]
  B2[B2 Python workflow primitives] --> T[Tasks, referrals, role checks, audit models, local sync queue]
  SIM[Member 3 simulation and handoff data] --> OUT[CSV reports / handoff files]
  FE -. no API connection .- B1
  FE -->|development-only synthetic workspace| B2
  FE -. original dashboard, queue, and referrals remain mockStore-backed .- B2
  B1 -. no automatic connection .- B2
```

See [architecture](docs/architecture.md), [data flow](docs/data-flow.md), and the [backend/frontend API contract](docs/backend-frontend-contract.md). B2 has a local prototype API and isolated development-only frontend workflows; protected requests remain unavailable while authentication is disabled.

## Repository layout

```text
B1/                       Screening rules, validation, synthetic CSV/JSON, standalone checks
B2/                       Python workflow modules, synthetic FastAPI prototype, local SQLite store, and unittest tests
frontend/                 React/Vite mock demo, separate B2 client workflows, and B1 source-contract tests
member3_data_simulation/  Synthetic data generation, alert analysis, validation, and handoff utilities
docs/                     Architecture and data-flow documentation
```

Module-specific setup and behavior: [B1/README.md](B1/README.md), [B2/README.md](B2/README.md), [frontend/README.md](frontend/README.md).

## Prerequisites

- Windows PowerShell.
- Node.js and npm compatible with the versions declared by the frontend lockfile/package manifest. Vite 8 requires a modern Node release; use a current supported Node LTS.
- Python 3.9+ for B2. B1 requires Python and pandas. Simulation dependencies are listed separately.
- No `.env` file or credentials are required for the current application. There is no configured Gemini/API integration despite inherited template dependencies and frontend template text.

## Install and run

### Frontend

```powershell
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Vite prints the local URL (the manifest requests port 3000). The frontend is a standalone prototype. Role selection is simulated, and records persist in browser localStorage. See [frontend setup](frontend/README.md).

### B1 rule engine

```powershell
cd B1
python -m pip install pandas
python .\test_be1.py
```

`test_be1.py` copies B1 files to a temporary directory and runs its assertions against that copy. The rule engine can be imported by Python callers; it does not start a server. `build_data.py` regenerates synthetic data and can overwrite the checked-in CSV files, so do not run it unless regeneration is intended.

### B2 workflow API and library

From the repository root:

```powershell
python -m unittest B2.test_beneficiaries B2.test_authorization B2.test_tasks B2.test_day2 -v
```

B2 API: with its dependencies already provisioned, run `python -m uvicorn B2.api:app --reload` from the repository root. Keep `B2_AUTH_MODE=disabled`; protected endpoints intentionally deny access until trusted identity and authorization adapters exist. The development-only B2 workspace is separate from the original `mockStore` demo pages and will show an unavailable state while protected B2 access is disabled. Do not enable demo auth or put real beneficiary data into this prototype. See [B2 setup](B2/README.md) and the [contract](docs/backend-frontend-contract.md).

### Static mock-data demonstration

The frontend can be built without a B2 URL. For a production static demo that should include the local role picker, set `VITE_ENABLE_DEMO_MODE=true` in the build environment; leave `VITE_B2_API_URL` and Supabase variables unset for a mock-only demonstration. All `VITE_` variables are public browser values. The role picker is a presentation-only simulation and does not grant B2 access. The dedicated B2 pages remain unavailable in production builds and never fall back to mock data. Configure the selected static host's SPA fallback to `index.html` before relying on direct route URLs. See [auth and demo setup](docs/auth-integration-setup.md).

### Simulation utilities

```powershell
cd member3_data_simulation
python -m pip install -r requirements.txt
```

Inspect each script's arguments/source before running it: generation and handoff scripts write files, and simulation thresholds and operational schedules are explicitly proposed assumptions. See `handoff/README.txt`.

## Tests and build

From `frontend/`, run `npm test`, `npm run lint`, and `npm run build`. From the repository root, run the B2 unittest command above and `python .\B1\test_be1.py` (with pandas installed). These suites are independent; there is no end-to-end integration test because there is no integrated backend or API.

## Configuration and data

- B1 active rule values: `B1/thresholds.json`; reset baseline: `B1/thresholds_default.json`. `B1/rule_settings.py` keeps drafts/logs in its data directory. `BE1_DATA_DIR` changes the B1 CSV/settings directory and `THRESHOLDS_PATH` changes the active rule JSON path. These are Python environment variables, not frontend settings.
- Frontend fixtures and workflows: `frontend/src/store/mockStore.ts`; rule-like UI data is demo state and is not loaded from B1. The frontend stores its session and demo state in localStorage.
- B2 sync queue: caller-supplied local JSON path; the sync module does not contact a server.
- All checked-in CSV/person records are synthetic. Do not substitute real beneficiary data.

## Known limitations

- The development-only synthetic workflow and operations pages call the B2 API, but the original Dashboard, Action Queue, and Referrals screens remain `mockStore` demos. There is no shared record mapping or production persistence.
- Frontend route guards and role labels are client-side demonstrations, not security controls. The dashboard and screens should be treated as demo workflows.
- B2's synthetic API uses local prototype SQLite; its offline JSON queue does not provide remote synchronization or encryption.
- Rule values and workflow timing assumptions need qualified review before any operational use. See each module README for details.

## Development guidelines

- Preserve the synthetic-data label and clearly distinguish executable code from proposals.
- Keep business rules in Python modules/configuration rather than duplicating them in UI text; when an integration is implemented, define and test an explicit shared contract first.
- Do not add credentials or real personal data. Keep generated outputs, caches, local environments, and dependency directories out of version control while retaining lockfiles and required fixtures.
- Make focused changes, run the affected module checks, and describe limitations honestly. Do not commit, merge, or push as part of this documentation review.

## Troubleshooting

- **npm install peer resolution:** use the documented `npm install --legacy-peer-deps` command for the current dependency declarations; resolve manifest/lockfile compatibility deliberately before removing the flag.
- **B1 import error for pandas:** install it with `python -m pip install pandas` in the Python environment used to run B1.
- **Frontend data differs from CSV:** expected; frontend fixtures/localStorage and B1 CSV data are separate. Clear the demo state via the UI's reset controls or browser storage if a stale demo session is the issue.
- **Rule edits affect local files:** set a temporary `BE1_DATA_DIR` and `THRESHOLDS_PATH` before invoking rule settings, or use the bundled B1 test which isolates writes in a temp copy.
