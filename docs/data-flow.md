# Data flow and user workflows

## Frontend journey

The original Dashboard, Action Queue, and Referrals routes use browser-local `mockStore`; each remains an explicitly synthetic demo. In development builds, links open `/synthetic-workflow` or `/synthetic-operations`, separate pages that call B2 through `frontend/src/services/b2Api.ts`. They require a provider session and an active profile returned by B2. B2 currently has no configured trusted authentication adapters, so protected API requests remain unavailable with the required disabled-auth setting. No mock records are substituted when B2 fails, and no demo IDs are mapped to B2 IDs.

```mermaid
flowchart TD
  Visit[Open /] --> Landing[Landing page]
  Landing --> PublicDash[Dashboard demo]
  Landing --> Signin[Simulated staff sign-in]
  Signin --> Session[AuthContext saves synthetic role/session in localStorage]
  Session --> Routes[Role-gated React routes]
  Routes --> Pages[Beneficiaries / measurement / queue / referrals / rules / reports]
  Pages --> Store[Mock store: seeded synthetic records and local actions]
  Store --> Browser[(Browser localStorage)]
  PublicDash --> Store
```

The original demo route list and role guards are in `frontend/src/App.tsx` and `context/AuthContext.tsx`; those role labels are UI state and do not imply backend access control or durable shared records. The synthetic workspace uses the provider session token for the server profile/API request, but that is not sufficient for access until B2 can resolve trusted assignments and scope.

## B1 input, checks, decisions, and settings

```mermaid
flowchart LR
  ChildCSV[children.csv] --> Check[data_checks.py]
  MotherCSV[mothers.csv] --> Check
  Links[family_links.csv] --> Family[family_link.py]
  Thresholds[thresholds.json] --> Engine[rules_engine.py]
  LMS[who_lms.json] --> Engine
  Check --> Engine
  Engine --> Result[Evaluation: colour, reasons, confidence, issues]
  Result --> Family
  Family --> Joint[Optional joint-visit-shaped task for linked flagged pair]
  Settings[rule_settings.py] --> Draft[Draft and preview]
  Draft --> Approval[Approval / reject / override / reset]
  Approval --> Thresholds
```

The engine validates child measurement trust before using anthropometric calculations, considers configured child/mother rules, and returns `RED`, `AMBER`, `GREEN`, or `GREY` (`GREY` means recheck rather than confirmed finding). `family_link.py` joins linked rows and can create one joint-visit task-shaped dictionary when both are RED/AMBER. It does not persist that task into B2. Rule settings write JSON state and can alter active thresholds; isolate data paths when experimenting.

## B2 task and referral workflow

```mermaid
flowchart TD
  Caller[Python caller supplies row and evaluation] --> Create[tasks.create_task]
  Create --> Task[JSON-compatible task or None for GREEN]
  Task --> Lifecycle[Acknowledge / reassign / escalate / complete]
  Caller2[Python caller supplies referral data] --> Referral[referrals functions]
  Referral --> Attempts[Contact attempts, outcome, next-step suggestions]
  Task --> Audit[audit event model, when explicitly called]
  Referral --> Audit
  Task --> Queue[sync.enqueue_operation, when explicitly called]
  Queue --> Conflict[Version comparison / conflict result]
  Conflict -. no remote transport .-> Server[Caller-provided in-memory server snapshot]
```

The B2 FastAPI prototype exposes routes for saved workflow operations using the local SQLite prototype store. `sync.py` can persist a local queue and reconcile against an in-memory state passed by a caller; it does not connect to an actual server. Protected API access defaults to disabled. Do not enable demo identities in the normal application. Roles/capacity helpers are not frontend authentication. The escalation timing documented in Member 3's handoff is a placeholder assumption, not validated operational or clinical guidance.

## Validation and errors

B1 checks return issue dictionaries with codes, messages, suggestions, and affected measurements; rule settings raise `RuleSettingsError` for invalid requests. B2 functions validate arguments and raise module-specific `ValueError` subclasses; the FastAPI wrapper returns JSON errors and sanitizes request validation details. Original demo pages validate local inputs and report local interactions; separate synthetic workspace pages validate B2 responses and verify writes with fresh reads where the contract supports it. See [backend/frontend contract](backend-frontend-contract.md) and [synthetic operations contract](synthetic-operations-contract.md).

## Testing and execution flow

```mermaid
flowchart LR
  npmtest[npm test] --> FEutil[Frontend utility test]
  nplint[npm run lint] --> TS[TypeScript no-emit check]
  npbuild[npm run build] --> Vite[Vite production bundle]
  B1test[python B1/test_be1.py] --> Temp[Temporary copied B1 data]
  B2test[python -m unittest B2.test_beneficiaries B2.test_authorization B2.test_tasks B2.test_day2 -v] --> B2checks[non-API unit tests]
```

The checks are separate and do not validate an end-to-end integrated flow. See root setup commands and module READMEs.
