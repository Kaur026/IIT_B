"""BE1 - agreed field lists for the 12 synthetic datasets (Step 1 handoff).

Every record is SYNTHETIC DATA / PROPOSED INTEGRATION. IDs: AWC-001, BEN-0001.
Dates are ISO strings (YYYY-MM-DD). Original readings are never overwritten:
a remeasurement is a NEW row in `measurements` with `supersedes_id` set.
"""

DATASETS = {
    "centres": [
        "centre_id", "name", "block", "district", "state", "worker_id", "synthetic_flag",
    ],
    "workers": [
        "worker_id", "name", "centre_id", "role", "synthetic_flag",
    ],
    "beneficiaries": [
        "beneficiary_id", "centre_id", "category",  # child | pregnant_woman | lactating_mother
        "name", "sex", "date_of_birth", "enrolment_date", "guardian_name",
        "mobile_verification_status",  # verified | pending | not_available
        "possible_duplicate_of", "synthetic_flag",
    ],
    "measurements": [
        "measurement_id", "beneficiary_id", "centre_id", "measured_on", "recorded_by",
        "weight_value", "weight_unit", "height_value", "height_unit",
        "muac_cm", "is_baseline", "supersedes_id", "entry_source", "synthetic_flag",
    ],
    "verification_records": [
        "verification_id", "beneficiary_id", "centre_id", "barrier_type",
        # pending_mobile_auth | document_missing | auth_failed | other
        "status",  # open | in_progress | resolved
        "opened_on", "resolved_on", "resolution_note", "synthetic_flag",
        # No Aadhaar numbers or OTPs are ever stored.
    ],
    "referrals": [
        "referral_id", "beneficiary_id", "centre_id", "referral_type",  # disability_deic | health_facility
        "state",  # sent | acknowledged | attended | outcome_recorded
        "sent_on", "acknowledged_on", "attended_on", "outcome_on", "outcome_note",
        "due_on", "synthetic_flag",
    ],
    "maternal_profiles": [
        "maternal_id", "beneficiary_id", "centre_id", "stage", "registered_on",
        "last_visit_on", "next_visit_due_on", "access_level", "synthetic_flag",
        # restricted access; no treatment advice stored; under-18 deferred
    ],
    "service_records": [
        "service_id", "beneficiary_id", "centre_id", "service_type",
        "service_date", "quantity", "synthetic_flag",
    ],
    "home_visits": [
        "visit_id", "beneficiary_id", "centre_id", "visit_date", "visited_by",
        "outcome", "synthetic_flag",
    ],
    "review_history": [
        "review_id", "flag_id", "measurement_id", "centre_id", "reviewed_by",
        "flagged_on", "reviewed_on", "decision",  # confirmed_error | valid_reading | needs_remeasure
        "synthetic_flag",
    ],
    "tasks_seed": [
        "task_id", "flag_id", "beneficiary_id", "centre_id", "owner_role", "status",
        "created_on", "due_on", "closed_on", "outcome", "audit_entries", "synthetic_flag",
    ],
    "age_bands_reference": [
        "band_id", "label", "min_months", "max_months", "service_name",
        "verified", "status", "synthetic_flag",  # all unverified -> demo-only
    ],
}

FIXTURE_NAMES = ["BEN-9001", "BEN-9002", "BEN-9003", "BEN-9004", "BEN-9005"]
