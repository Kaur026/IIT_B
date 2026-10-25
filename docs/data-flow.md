# Data flow and user workflows

## Frontend journey

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

The route list and route guards are in `frontend/src/App.tsx` and `context/AuthContext.tsx`; session roles are simulated by the UI. Public dashboard access and browser persistence do not imply backend access control or durable shared records. Some screens are illustrative; inspect their implementation before treating a displayed workflow as a connected service.

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

Task/referral operations are direct Python calls. `sync.py` can persist a local queue and reconcile against an in-memory state passed by a caller; it does not connect to an actual server. Roles/capacity checks are separate helpers and require callers to invoke them. The escalation timing documented in Member 3's handoff is a placeholder assumption, not validated operational or clinical guidance.

## Validation and errors

B1 checks return issue dictionaries with codes, messages, suggestions, and affected measurements; rule settings raise `RuleSettingsError` for invalid requests. B2 functions validate arguments and raise module-specific `ValueError` subclasses; task/referral objects remain caller-managed. Frontend casework utilities validate local inputs and the UI reports interactions through toast/context patterns. None of these error paths crosses a network boundary because no API exists.

## Testing and execution flow

```mermaid
flowchart LR
  npmtest[npm test] --> FEutil[Frontend utility test]
  nplint[npm run lint] --> TS[TypeScript no-emit check]
  npbuild[npm run build] --> Vite[Vite production bundle]
  B1test[python B1/test_be1.py] --> Temp[Temporary copied B1 data]
  B2test[python -m unittest B2.test_tasks B2.test_day2 -v] --> B2checks[B2 unit tests]
```

The checks are separate and do not validate an end-to-end integrated flow. See root setup commands and module READMEs.
