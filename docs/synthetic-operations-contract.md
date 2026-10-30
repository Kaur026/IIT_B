# Synthetic B2 operations workspace contract

This development-only workspace reads and mutates records through the existing
B2 API. It is separate from the browser-local Action Queue, Dashboard, and
Referrals demo. It does not map `BEN-*`, `ACT-*`, `AWC-*`, or `AWW-*` mock IDs
onto B2 IDs.

## Identity and scope

The browser sends only a provider-issued bearer token and resource identifiers
returned by B2. It takes role and scope from `GET /api/me` for display and
control visibility. B2 resolves identity, permissions, worker assignment, and
organization scope for every protected request. The normal app remains
fail-closed while `B2_AUTH_MODE=disabled`; the development page does not use a
demo persona or local mock store as an API identity or fallback.

The initial page supports one server-returned centre scope for task/referral
lists and centre briefing. It does not guess a centre from a sector/project
scope. DPO briefing can use the existing server-side district aggregation,
while DPO task access remains unavailable under the current role policy.

Beneficiary registration uses the existing `/api/beneficiaries` contract. The
browser submits date of birth, sex, and optional caregiver kinship only; B2
assigns beneficiary, worker, and centre identifiers from the authorized
principal. The page confirms the new identifier through a fresh beneficiary
list response before reporting completion.

## Read contracts

- `GET /api/briefing?centre_id=...` returns `centre_id`, `as_of`, `counts`,
  action items, source description, and a synthetic label. The backend
  calculates counts from saved records. A DPO may omit `centre_id`; B2 resolves
  authorized district scope and returns aggregate counts.
- `GET /api/tasks?centre_id=...` returns `{ centre_id, tasks, label }`. Task
  records retain B2 identifiers and fields, including `task_id`,
  `beneficiary_id`, `centre_id`, `flag_id`, `child_id`, `status`, `owner_id`,
  dates, colour/alert level, and event history.
- `GET /api/referrals?centre_id=...` returns `{ centre_id, as_of, referrals,
  label }`. Referral records retain B2 IDs and coded kind, reason, status,
  destination, dates, linked task, and timeline.
- Beneficiaries for referral creation are selected from
  `GET /api/beneficiaries?centre_id=...`; no IDs are synthesized by the UI.
- `GET /api/access-exceptions?centre_id=...` returns coded human-review
  barriers. Only LS may view and resolve scoped records; AWW and LS may create.
  This follows the least-privilege UI and documented supervisor review boundary;
  CDPO has no exception-list permission. Exception create/resolve permissions
  are not changed by this view policy.
  AWW does not have `view_exceptions`, so its create response is explicitly
  left unverified in the browser. Exception records do not deny access or
  determine eligibility.

## Supported operations exposed by this milestone

- Task: acknowledge an `assigned` or `escalated` task, start an `acknowledged`
  task, or record progress while `in_progress`. The page reads task lists again
  and checks the appended progress note and event before showing completion.
  Task cards expose the event history, ownership, due date, and escalation level
  returned by B2; the UI does not derive an owner or escalation from another
  data source.
  Task progress currently has no stable event ID or idempotency key. The safest
  available read-back requires an unchanged before-snapshot prefix plus exactly
  one new note and matching `progress_recorded` event. This verifies the history
  shape, but cannot uniquely attribute an identical concurrent write to this
  request. Concurrent or inconsistent changes remain ambiguous and keep the
  task locked until a manual fresh read reconciles the result; the browser never
  automatically retries the write.
- Referral: create a coded `general` or `deic` referral; acknowledge a `sent`
  referral; record attendance while `sent` or `acknowledged`; record an
  approved coded outcome after attendance. A fresh referral list must confirm
  the write before the page reports it as complete.
- Access exception: create a backend-allow-listed coded barrier; only LS may
  resolve it with an allow-listed resolution code. The UI verifies mutations
  against a fresh scoped list.
- Assignment, reassignment, escalation, and closure controls are not exposed.
  Assignment actions need a trusted task-owner directory in non-demo auth;
  closure requires the separate two-key confirmation workflow.

## Data ownership

The browser owns only form fields, selected records, and presentation state.
B2 owns beneficiary, task, referral, briefing-count, and audit records in its
prototype store. Existing `mockStore` data remains inside its current demo
screens and is never substituted when a B2 request fails.

## Verification boundary

Backend integration tests may use test-owned in-memory storage and a principal
dependency override on a newly created app instance. Such overrides must not
affect the module-level app. A green test suite does not prove Supabase-backed
authorization or live end-to-end operation. The browser workspace requires a
provider session, a server-resolved active profile, configured API URL, and
trusted B2 authorization data sources.
