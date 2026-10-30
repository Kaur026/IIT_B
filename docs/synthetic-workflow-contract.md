# Synthetic workflow contract v1

This contract describes one isolated integration-test fixture for beneficiary
listing and first-measurement recording. It does not map, replace, or seed the
existing frontend demo records or the existing B2 `C0001` fixture. Its values
are stored in `contracts/synthetic-workflow-v1.json` and are test-only.

## Identifiers and scope

The test principal is `PAL-IT-WORKER-001` with the synthetic AWW role and the
test centre `PAL-IT-CENTRE-001`. It is assigned the test beneficiary
`PAL-IT-BEN-001`. These relationships exist only in the new in-memory test
fixture. They do not establish any real account, worker roster, organization
hierarchy, or mapping to IDs such as `AWW-409`, `AWC-702`, `W07`, or `AWC-001`.

The browser sends a requested `centre_id` only as a resource selector. The
backend principal and `require_centre_scope`/`require_case_scope` remain the
authority. The worker ID and centre are never accepted from a measurement
request body.

## Wire records

- Beneficiaries use B2 field names: `beneficiary_id`, `centre_id`,
  `assigned_worker_id`, `date_of_birth`, and `sex`. The list response carries
  `centre_id`, `beneficiaries`, and a synthetic-data label.
- First-measurement requests contain `beneficiary_id`, `measurement`,
  `recorded_at`, and optionally `today` (which the normal disabled-auth app
  does not accept as an evaluation-clock override). Measurement fields use `weight_kg`,
  `height_cm`, `muac_mm`, `oedema`, and `danger_sign`; MUAC is millimetres.
- The successful write response contains the saved `measurement` and its
  immutable `flag`. The measurement contains the server evaluation; the flag
  references the same beneficiary, centre, and measurement IDs.
- A subsequent `GET /api/beneficiaries/{id}/measurements` returns saved
  measurements and flags for that scoped beneficiary. The UI displays those
  returned values and does not manufacture a result from local state.

## Validation and lifecycle

B2 validates date parsing, supported measurement fields, finite numeric
measurements, yes/no compatible oedema and danger-sign values, beneficiary
age, and the first-measurement-only rule. B1 performs the existing measurement
checks and deterministic evaluation. Measurement plus flag must save atomically;
the original records are append-only. A malformed or duplicate request must
not leave a measurement without its flag or vice versa.

The browser owns only unsaved form fields, selection, and presentation state.
B2 owns beneficiary, measurement, evaluation, flag, and audit records in the
prototype store. B1 owns the existing validation/evaluation logic. The current
`mockStore` owns the separate frontend demo and is not read as a fallback by
this API-backed view.

## Test identity boundary

Backend integration tests create a new FastAPI app with `auth_mode="disabled"`
and an in-memory `PrototypeStore`. They override the Phase 1 principal
dependency on that app instance with a test-owned `Principal`. The test
override does not use `B2_AUTH_MODE=demo`, a demo header, a public test route,
or the normal module-level app. Tests without that override continue to prove
that disabled authentication denies protected requests.

This is a synthetic test fixture, not an identity adapter and not evidence of
real-user authorization. The regular application remains fail-closed while
`B2_AUTH_MODE` is disabled.
