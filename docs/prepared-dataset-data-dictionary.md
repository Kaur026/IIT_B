# Prepared synthetic dataset data dictionary

## Scope and verification

This inventory describes the server-side source at `B!/data`, read by
`B2/prepared_dataset.py`. The CSVs remain unchanged and are not frontend
assets. The backend reader loaded all 12 files and passed its schema, value,
primary-key, synthetic marker, and cross-file validation on 2026-10-30.
Counts below are observed from that validation run; they are not constants in
the application. CSV source values are represented as strings by the reader;
date and numeric domains are validated before the immutable dataset is
returned.

Field notes marked **sensitive** identify fields that need owner-approved
field-level review before any row API is enabled. They are not an access
policy. `synthetic_flag` is required to equal `SYNTHETIC` on every source row.

Blank values are permitted only in these fields: beneficiary `guardian_name`
and `possible_duplicate_of`; measurement `weight_value`, `height_value`, and
`supersedes_id`; task `closed_on` and `outcome`; referral
`acknowledged_on`, `attended_on`, `outcome_on`, and `outcome_note`;
review-history `reviewed_on` and `decision`; verification
`resolved_on` and `resolution_note`. Other schema fields are required by the
reader.

## Files and schemas

| File | Rows | Primary key | Columns |
|---|---:|---|---|
| `age_bands_reference.csv` | 3 | `band_id` | `band_id`, `label`, `min_months`, `max_months`, `service_name`, `verified`, `status`, `synthetic_flag` |
| `beneficiaries.csv` | 3,025 | `beneficiary_id` | `beneficiary_id`, `centre_id`, `category`, `name`, `sex`, `date_of_birth`, `enrolment_date`, `guardian_name`, `mobile_verification_status`, `possible_duplicate_of`, `synthetic_flag` |
| `centres.csv` | 122 | `centre_id` | `centre_id`, `name`, `block`, `district`, `state`, `worker_id`, `synthetic_flag` |
| `home_visits.csv` | 1,200 | `visit_id` | `visit_id`, `beneficiary_id`, `centre_id`, `visit_date`, `visited_by`, `outcome`, `synthetic_flag` |
| `maternal_profiles.csv` | 600 | `maternal_id` | `maternal_id`, `beneficiary_id`, `centre_id`, `stage`, `registered_on`, `last_visit_on`, `next_visit_due_on`, `access_level`, `synthetic_flag` |
| `measurements.csv` | 9,715 | `measurement_id` | `measurement_id`, `beneficiary_id`, `centre_id`, `measured_on`, `recorded_by`, `weight_value`, `weight_unit`, `height_value`, `height_unit`, `muac_cm`, `is_baseline`, `supersedes_id`, `entry_source`, `synthetic_flag` |
| `referrals.csv` | 85 | `referral_id` | `referral_id`, `beneficiary_id`, `centre_id`, `referral_type`, `state`, `sent_on`, `acknowledged_on`, `attended_on`, `outcome_on`, `outcome_note`, `due_on`, `synthetic_flag` |
| `review_history.csv` | 246 | `review_id` | `review_id`, `flag_id`, `measurement_id`, `centre_id`, `reviewed_by`, `flagged_on`, `reviewed_on`, `decision`, `synthetic_flag` |
| `service_records.csv` | 4,518 | `service_id` | `service_id`, `beneficiary_id`, `centre_id`, `service_type`, `service_date`, `quantity`, `synthetic_flag` |
| `tasks_seed.csv` | 152 | `task_id` | `task_id`, `flag_id`, `beneficiary_id`, `centre_id`, `owner_role`, `status`, `created_on`, `due_on`, `closed_on`, `outcome`, `audit_entries`, `synthetic_flag` |
| `verification_records.csv` | 773 | `verification_id` | `verification_id`, `beneficiary_id`, `centre_id`, `barrier_type`, `status`, `opened_on`, `resolved_on`, `resolution_note`, `synthetic_flag` |
| `workers.csv` | 122 | `worker_id` | `worker_id`, `name`, `centre_id`, `role`, `synthetic_flag` |

### Fields requiring a sensitivity review

- `beneficiaries.csv`: `name`, `date_of_birth`, `guardian_name`,
  `possible_duplicate_of`; `mobile_verification_status` is an identity-related
  status.
- `workers.csv`: `name` and worker identifiers.
- `measurements.csv`: weight, height, MUAC, measurement dates, and recorder
  identifiers are health/workforce data.
- `maternal_profiles.csv`: stage, visit dates, and `access_level` are
  particularly sensitive.
- `referrals.csv`: referral type, status, dates, and `outcome_note`.
- `home_visits.csv`, `service_records.csv`, `review_history.csv`,
  `tasks_seed.csv`, and `verification_records.csv`: beneficiary linkage,
  activity/status history, outcomes, review notes, and actor identifiers.

Do not treat synthetic status as approval for public row access.

## Relationships checked by the reader

- Each beneficiary refers to a known centre. A nonblank
  `possible_duplicate_of` points to another known beneficiary and cannot point
  to itself.
- Each centre's worker and each worker's centre refer back to one another.
- Home visits, maternal profiles, measurements, referrals, service records,
  tasks, and verification records reference a beneficiary at the same centre.
- Each measurement recorder and home-visit worker exists and belongs to that
  centre. `supersedes_id`, when present, refers to a measurement for the same
  beneficiary and centre.
- Each review-history measurement exists at the same centre. Where a task's
  `flag_id` occurs in review history, its known review, measurement,
  beneficiary, and centre links must agree. The source has no complete flags
  table, so an unmatched task flag is not treated as a missing or fabricated
  review record.
- Task closure status must agree with `closed_on` and `outcome`. Referral
  states require their corresponding event date, and `outcome_recorded`
  requires a nonblank note. Verification resolution fields and review decision
  dates must agree with their statuses.

These checks validate links inside this dataset only. They do not establish a
relationship to `B1/children.csv`, `member3_data_simulation/handoff`, frontend
demo identifiers, an organization hierarchy, or a live worker roster.

## Integration and access status

`B2/prepared_data.py` provides count-only summary calculation and allowlisted,
paginated projections for beneficiaries and measurements. `B2/api.py` exposes
the summary, beneficiary, and measurement routes. The summary and row routes
are off by default; row routes additionally require trusted authentication,
authorization scope, and explicit prepared/organization mappings. No concrete
database-backed account, role, hierarchy, worker-roster, or prepared-ID
crosswalk repositories are configured. No prepared endpoints currently serve
centres, workers, home visits, maternal profiles, referrals, reviews, service
records, tasks, verification records, or age-band references.

Existing B2 task/referral routes use the separate prototype store. They do not
read or update these prepared CSVs. Prepared records are read-only; no write
operation should claim to persist changes to the source files.

## Local preview projection contract

The separately gated, loopback-only preview exposes the fields below. All
values retain their source representation; each returned row includes its
original `SYNTHETIC` marker. Fields not listed under **Withheld fields** are
not returned by the preview API. This allowlist is a local-development
inspection policy, not approval for deployment or live-user access.

| Dataset key / file | Exposed fields | Withheld fields and reason |
|---|---|---|
| `age_bands_reference` / `age_bands_reference.csv` | `band_id`, `label`, `min_months`, `max_months`, `service_name`, `verified`, `status`, `synthetic_flag` | None |
| `beneficiaries` / `beneficiaries.csv` | `beneficiary_id`, `centre_id`, `category`, `sex`, `enrolment_date`, `synthetic_flag` | `name` (direct identifier); `date_of_birth` (sensitive demographic detail); `guardian_name` (caregiver identity); `mobile_verification_status` (identity verification detail); `possible_duplicate_of` (sensitive linkage detail) |
| `centres` / `centres.csv` | `centre_id`, `name`, `block`, `district`, `state`, `synthetic_flag` | `worker_id` (workforce mapping not needed for this view) |
| `measurements` / `measurements.csv` | `measurement_id`, `beneficiary_id`, `centre_id`, `measured_on`, `weight_value`, `weight_unit`, `height_value`, `height_unit`, `muac_cm`, `is_baseline`, `synthetic_flag` | `recorded_by` (worker identity unnecessary); `supersedes_id` (lineage detail unnecessary); `entry_source` (not needed to inspect source values) |
| `tasks` / `tasks_seed.csv` | `task_id`, `flag_id`, `beneficiary_id`, `centre_id`, `owner_role`, `status`, `created_on`, `due_on`, `closed_on`, `outcome`, `synthetic_flag` | `audit_entries` (internal audit detail not needed) |
| `referrals` / `referrals.csv` | `referral_id`, `beneficiary_id`, `centre_id`, `referral_type`, `state`, `sent_on`, `acknowledged_on`, `attended_on`, `outcome_on`, `due_on`, `synthetic_flag` | `outcome_note` (free-text may contain sensitive detail) |
| `home_visits` / `home_visits.csv` | `visit_id`, `beneficiary_id`, `centre_id`, `visit_date`, `outcome`, `synthetic_flag` | `visited_by` (worker identity unnecessary) |
| `maternal_profiles` / `maternal_profiles.csv` | `maternal_id`, `beneficiary_id`, `centre_id`, `synthetic_flag` | `stage`, `registered_on`, `last_visit_on`, `next_visit_due_on` (sensitive maternal health information/timeline); `access_level` (sensitive access classification) |
| `service_records` / `service_records.csv` | `service_id`, `beneficiary_id`, `centre_id`, `service_type`, `service_date`, `quantity`, `synthetic_flag` | None |
| `review_history` / `review_history.csv` | `review_id`, `flag_id`, `measurement_id`, `centre_id`, `flagged_on`, `reviewed_on`, `decision`, `synthetic_flag` | `reviewed_by` (reviewer identity unnecessary) |
| `verification_records` / `verification_records.csv` | `verification_id`, `beneficiary_id`, `centre_id`, `status`, `opened_on`, `resolved_on`, `synthetic_flag` | `barrier_type` (sensitive identity/access issue); `resolution_note` (free-text may contain sensitive detail) |
| `workers` / `workers.csv` | `worker_id`, `centre_id`, `role`, `synthetic_flag` | `name` (direct identifier) |

The only routes for this projection are `GET /api/preview/prepared-data/datasets`
and `GET /api/preview/prepared-data/{dataset_key}`. The first returns the
dataset keys, labels, row counts, field allowlists, withheld-field reasons,
and filter/sort allowlists. The second returns a page with `items`, `total`,
`limit`, and `offset`. Page size defaults to 25 and is capped at 100; offset
is capped at 1,000,000. Only catalog-declared exact-value filters and sort
fields are accepted. Ordering uses the source primary key, with requested
sorting applied stably. Unsupported query parameters are rejected.

No records are joined by matching coincidental identifier strings. The source
reader validates its explicitly defined CSV relationships before any preview
projection is built. These routes are disabled unless the dedicated local
preview switch and safe local environment checks all pass; they additionally
reject non-loopback client, host, server, and forwarded requests. Do not enable
this mode in a deployed environment.
