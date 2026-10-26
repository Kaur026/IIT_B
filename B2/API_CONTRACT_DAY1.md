# BE2 integrated API contract — PROPOSED, NOT TEAM-SIGNED

**Scope:** BE2-only backend routes for the Oct 24 four-person workflow. This contract is not approved by BE1/FE1/FE2 or the supervisor. Confirm field names, shared IDs, reporting date, centre mapping, role/action policy and error behavior before wiring frontend screens.

## Global conventions

- Every route is under `/api`. Mutating and protected reads require `X-Demo-Actor`, resolved by a backend-only synthetic allow-list. The client cannot submit a role or centre scope.
- Demo keys: `demo-worker`, `demo-supervisor`, `demo-cdpo`, `demo-nodal`, `demo-state`, `demo-india`. They are not real authentication.
- Every response carries a synthetic/proposed label where appropriate. Synthetic identity and centre fixtures are for tests only.
- Common error shape: `{"error":{"code":"...","message":"...","retryable":false}}`.
- `B2_DEMO_DATE` configures the shared reporting date (defaults to BE1's synthetic 2026-10-15 reference date). A route can accept an explicit `as_of` or action date for deterministic tests.
- Original measurement/flag and briefing snapshots are immutable. Mutable task/referral/exception/follow-up states update their saved snapshot and append an audit event.
- Unknown centre mappings fail closed. The C0001 → AWC-001 seed mapping is explicitly synthetic and must be replaced by BE1's agreed fixture.
- No Aadhaar/OTP keys or values are accepted in offline JSON/free-text workflow notes. No live Poshan Tracker integration is present.

## Proposed routes

| Method and path | Permission/boundary | Behavior |
|---|---|---|
| `GET /api/health` | Public demo metadata only | Mode, seed status, synthetic label; no secrets. |
| `GET /api/audit?centre_id=...` | Centre-scoped `view_audit` | Returns audit events, filtered to the worker's assigned cases when caller is a worker. |
| `GET /api/cases/{beneficiary_id}/explain?flag_id=...` | Case and centre scope | Mock-first explanation grounded in the saved flag, rule version, source values and missing fields. |
| `GET /api/beneficiaries/{beneficiary_id}/history` | Case and centre scope | Saved timeline for original/remeasurements, flags, tasks, referrals, access exceptions and audit links; restricted maternal records are excluded. |
| `POST /api/verification` | Assigned worker/supervisor + centre scope | Run BE1 checks/rules, append a new linked measurement, preserve original. |
| `POST /api/tasks`; `GET /api/tasks?centre_id=...` | Create permission for supervisor; worker list is own assigned tasks | Create from a saved non-GREEN flag; prevent duplicate active task for the same flag. |
| `POST /api/tasks/{task_id}/actions` | Task and centre scope | Assign, reassign, acknowledge, start, record progress, escalate. Single-key `close` is rejected. |
| `POST /api/tasks/{task_id}/closure-confirmations` | Approved policy for the task's case type | Append confirmation keys. Close only after all distinct required confirmations and a valid outcome; no approved policy means fail closed. |
| `GET /api/next-actions/{flag_id}` | Case and centre scope | Deterministic suggestion derived from saved flag/task state. |
| `POST /api/next-actions/{flag_id}/decision` | Case and centre scope | Send the `suggestion_id` returned by GET; stale IDs return 409. Save accept/edit/reject. Accepted/edited operations dispatch through the ordinary verification/task service, never a model or direct state update. |
| `GET /api/briefing?centre_id=...&as_of=...` | Centre-scoped | Non-AI counts/links computed from saved records. No AI-generated totals. |
| `POST /api/briefing/snapshots`; `GET /api/briefing/snapshots` | Supervisor creates; configured reporting roles read | Save/retrieve immutable count snapshots with reporting date and source description. Maternal counts are excluded. |
| `POST /api/referrals`; `GET /api/referrals` | Case/centre scoped | Generic or DEIC workflow: sent → acknowledged → attended → outcome_recorded. Overdue is derived only when an explicit due date exists. |
| `POST /api/referrals/{referral_id}/actions` | Case/centre scoped | Apply one referral transition and append audit. It does not make eligibility or clinical decisions. |
| `POST /api/access-exceptions`; `GET /api/access-exceptions` | Assigned case/centre scope | Record coded barrier for human review; never deny access or decide eligibility. |
| `POST /api/access-exceptions/{exception_id}/resolve` | Supervisor proposal | Record a coded human resolution and audit. No Aadhaar/OTP fields. |
| `POST/GET /api/maternal-followups`; `POST /api/maternal-followups/{id}/actions` | Restricted role and centre scope; opt-in | Disabled unless maternal scope is explicitly approved. Under-18 cases are deferred and not saved; no clinical advice. |
| `POST /api/offline/queue`; `GET /api/offline/queue` | Per-demo-actor queue and entity scope | Save a synthetic pending local operation with a stable id. |
| `POST /api/offline/sync/attempt`; retry and conflict-resolution routes | Per-actor queue; explicit resolution | Simulator only: pending/synced/failed/conflict, retry, duplicate detection and audited resolution. No remote sync endpoint. |

## Workflow invariants

1. **Task:** allowed transitions are explicit; every successful mutation is audited. Task status is not closed by an AI suggestion.
2. **Verification:** the new reading receives a unique ID and parent measurement link; the original row is never updated.
3. **Closure:** case-type policy must be supplied with `approved: true`; otherwise endpoint returns a policy-not-approved conflict. Policy keys/roles and outcome are reviewed by the responsible supervisor/team outside this code. Different actors supply required keys.
4. **Referral/DEIC:** code-only operational states. Outcome is recorded separately from sending, acknowledgment and attendance.
5. **Access exceptions:** codes describe a process barrier, not a denial, identity decision or eligibility rule.
6. **Maternal:** no endpoint is active until scope approval; access is role-restricted; age under 18 is deferred without saving a follow-up record.
7. **Briefing:** counts are from SQLite records. Saved snapshots are append-only and reproducible for their `as_of` date.
8. **AI:** no external provider is called; saved source record links and human review remain visible.
9. **Offline:** the local simulator never applies generic queue payloads to database workflows. The JSON queue is unencrypted and is not appropriate for personal data.

## Handoffs still required

- **BE1:** agreed 12 dataset/field list, centre/beneficiary IDs, five-person planted-error fixture, referral/pending-verification/maternal fixtures, rule version/source values, and actual approved reporting date.
- **FE1/FE2:** wireframes, exact field/button contracts, and frontend bug list. The latest React/Vite app still uses mock/localStorage state; no FE source files were changed here.
- **Supervisor/team:** closure confirmation policy by case type, operational roles and outcome requirements; maternal scope and restricted role list; route/status sign-off.
- **Architecture review:** replace synthetic offline simulation only after authentication, encryption, retry, conflict review, versioning and audit design is approved.
