"""Read-only aggregate summary for the prepared BE1 synthetic dataset.

This module deliberately returns counts only. It never returns beneficiary,
worker, centre, measurement, task, or referral identifiers or row contents.
"""

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, Mapping, Protocol

from pydantic import BaseModel, ConfigDict, Field

from B2 import prepared_dataset
from B2.prepared_dataset import PreparedDataUnavailable, read_prepared_dataset


@dataclass(frozen=True)
class PreparedCentreMappingRecord:
    """Owner-approved crosswalk from one prepared centre to an org centre."""

    prepared_centre_id: str
    organization_centre_id: str
    valid_from: datetime
    valid_until: datetime | None = None
    revoked_at: datetime | None = None
    is_active: bool = True


@dataclass(frozen=True)
class PreparedWorkerMappingRecord:
    """Owner-approved crosswalk from an org worker to a prepared worker."""

    organization_worker_id: str
    organization_centre_id: str
    prepared_worker_id: str
    valid_from: datetime
    valid_until: datetime | None = None
    revoked_at: datetime | None = None
    is_active: bool = True


class PreparedDatasetMappingResolver(Protocol):
    """Trusted, server-side adapter for explicit prepared/org ID crosswalks.

    Implementations must return current and historical rows for the requested
    organization scope, using an owner-approved source. They must not infer a
    mapping from equal ID strings or display names.
    """

    def list_centre_mappings(self, organization_centre_ids: tuple[str, ...]) -> tuple[PreparedCentreMappingRecord, ...]:
        ...

    def list_worker_mappings(
        self, organization_worker_id: str, organization_centre_ids: tuple[str, ...],
    ) -> tuple[PreparedWorkerMappingRecord, ...]:
        ...


def _effective_mapping(record, now: datetime) -> bool:
    if not isinstance(record.valid_from, datetime) or record.valid_from.tzinfo is None or record.valid_from.utcoffset() is None:
        raise ValueError("Prepared data mapping validity is malformed.")
    if record.valid_until is not None and (
        not isinstance(record.valid_until, datetime)
        or record.valid_until.tzinfo is None
        or record.valid_until.utcoffset() is None
        or record.valid_until <= record.valid_from
    ):
        raise ValueError("Prepared data mapping validity is malformed.")
    if record.revoked_at is not None and (
        not isinstance(record.revoked_at, datetime)
        or record.revoked_at.tzinfo is None
        or record.revoked_at.utcoffset() is None
    ):
        raise ValueError("Prepared data mapping revocation is malformed.")
    return (
        record.is_active is True
        and record.revoked_at is None
        and record.valid_from <= now
        and (record.valid_until is None or now < record.valid_until)
    )


def authorized_prepared_centres(dataset, actor, hierarchy, mapping_resolver) -> set[str]:
    """Resolve prepared centre IDs only through explicit, current crosswalks."""
    from B2.roles import AuthorizationServiceUnavailable, RolePermissionError

    if mapping_resolver is None or hierarchy is None:
        raise AuthorizationServiceUnavailable("Prepared dataset scope mappings are unavailable.")
    organization_centres: set[str] = set()
    try:
        for scope in actor.organization_scopes:
            values = hierarchy.centres_in_scope(scope.kind, scope.organization_id)
            if not isinstance(values, (tuple, list)) or any(not isinstance(value, str) or not value for value in values):
                raise ValueError("Organization centre scope is malformed.")
            organization_centres.update(values)
        if not organization_centres:
            raise RolePermissionError("No organization centres are assigned to this account.")
        centre_rows = mapping_resolver.list_centre_mappings(tuple(sorted(organization_centres)))
        if not isinstance(centre_rows, (tuple, list)) or any(not isinstance(row, PreparedCentreMappingRecord) for row in centre_rows):
            raise ValueError("Prepared centre mappings are malformed.")
    except (AuthorizationServiceUnavailable, RolePermissionError):
        raise
    except Exception:
        raise AuthorizationServiceUnavailable("Prepared centre mapping lookup is unavailable.") from None

    source_centres = {row["centre_id"] for row in dataset.centres}
    now = datetime.now(timezone.utc)
    active_centres = []
    try:
        for row in centre_rows:
            if not _effective_mapping(row, now):
                continue
            if row.organization_centre_id not in organization_centres or row.prepared_centre_id not in source_centres:
                raise ValueError("Prepared centre mapping references an unknown or out-of-scope centre.")
            active_centres.append(row)
    except Exception:
        raise AuthorizationServiceUnavailable("Prepared centre mapping data is inconsistent.") from None
    prepared_to_org = {}
    org_to_prepared = {}
    for row in active_centres:
        if row.prepared_centre_id in prepared_to_org or row.organization_centre_id in org_to_prepared:
            raise RolePermissionError("Prepared centre mapping is ambiguous.")
        prepared_to_org[row.prepared_centre_id] = row.organization_centre_id
        org_to_prepared[row.organization_centre_id] = row.prepared_centre_id

    if actor.role != "AWW":
        if not prepared_to_org:
            raise RolePermissionError("No prepared centres are mapped into the assigned organization scope.")
        return set(prepared_to_org)

    if not actor.assigned_worker_id:
        raise RolePermissionError("A trusted organization worker mapping is required for prepared records.")
    try:
        worker_rows = mapping_resolver.list_worker_mappings(actor.assigned_worker_id, tuple(sorted(org_to_prepared)))
        if not isinstance(worker_rows, (tuple, list)) or any(not isinstance(row, PreparedWorkerMappingRecord) for row in worker_rows):
            raise ValueError("Prepared worker mappings are malformed.")
        active_workers = [
            row for row in worker_rows
            if _effective_mapping(row, now)
            and row.organization_worker_id == actor.assigned_worker_id
            and row.organization_centre_id in org_to_prepared
        ]
    except Exception:
        raise AuthorizationServiceUnavailable("Prepared worker mapping lookup is unavailable.") from None

    worker_to_source = {}
    for row in active_workers:
        key = (row.organization_worker_id, row.organization_centre_id)
        if key in worker_to_source:
            raise RolePermissionError("Prepared worker mapping is ambiguous.")
        worker_to_source[key] = row.prepared_worker_id
    workers_by_centre = {
        row["centre_id"]: {worker["worker_id"] for worker in dataset.workers if worker["centre_id"] == row["centre_id"]}
        for row in dataset.centres
    }
    allowed = set()
    for organization_centre_id, prepared_centre_id in org_to_prepared.items():
        prepared_worker_id = worker_to_source.get((actor.assigned_worker_id, organization_centre_id))
        if prepared_worker_id and prepared_worker_id in workers_by_centre.get(prepared_centre_id, set()):
            allowed.add(prepared_centre_id)
    if not allowed:
        raise RolePermissionError("No prepared worker and centre mapping is available in the assigned scope.")
    return allowed


DATA_DIR = prepared_dataset.DATA_DIR
LABEL = "SYNTHETIC DATA / PROPOSED INTEGRATION"
SCHEMAS = prepared_dataset.SCHEMAS

CATEGORY_VALUES = ("child", "pregnant_woman", "lactating_mother")
TASK_STATUS_VALUES = ("assigned", "acknowledged", "in_progress", "closed")
REFERRAL_STATE_VALUES = ("sent", "acknowledged", "attended", "outcome_recorded")
PREPARED_SOURCE = "B!-PREPARED-SYNTHETIC-DATA"

# Local preview projections are intentionally separate from the authenticated
# /api/prepared-data/* contracts. Fields absent from these tuples never leave
# the backend through the local preview routes.
PREVIEW_DATASETS = {
    "age_bands_reference": {
        "attribute": "age_bands", "file": "age_bands_reference.csv", "label": "Age bands reference",
        "primary_key": "band_id",
        "fields": ("band_id", "label", "min_months", "max_months", "service_name", "verified", "status", "synthetic_flag"),
        "filters": ("status", "verified"), "sort_fields": ("band_id", "min_months", "max_months", "label"),
        "excluded": {},
    },
    "beneficiaries": {
        "attribute": "beneficiaries", "file": "beneficiaries.csv", "label": "Beneficiaries",
        "primary_key": "beneficiary_id",
        "fields": ("beneficiary_id", "centre_id", "category", "sex", "enrolment_date", "synthetic_flag"),
        "filters": ("category", "centre_id", "sex"), "sort_fields": ("beneficiary_id", "centre_id", "category", "sex", "enrolment_date"),
        "excluded": {"name": "direct identifier", "date_of_birth": "sensitive demographic detail", "guardian_name": "caregiver identity", "mobile_verification_status": "identity verification detail", "possible_duplicate_of": "sensitive linkage detail"},
    },
    "centres": {
        "attribute": "centres", "file": "centres.csv", "label": "Centres",
        "primary_key": "centre_id",
        "fields": ("centre_id", "name", "block", "district", "state", "synthetic_flag"),
        "filters": ("block", "district", "state"), "sort_fields": ("centre_id", "name", "block", "district", "state"),
        "excluded": {"worker_id": "workforce mapping is not needed for this view"},
    },
    "measurements": {
        "attribute": "measurements", "file": "measurements.csv", "label": "Measurements",
        "primary_key": "measurement_id",
        "fields": ("measurement_id", "beneficiary_id", "centre_id", "measured_on", "weight_value", "weight_unit", "height_value", "height_unit", "muac_cm", "is_baseline", "synthetic_flag"),
        "filters": ("beneficiary_id", "centre_id", "measured_on", "is_baseline"), "sort_fields": ("measurement_id", "beneficiary_id", "centre_id", "measured_on"),
        "excluded": {"recorded_by": "worker identity is unnecessary", "supersedes_id": "lineage detail is unnecessary for this preview", "entry_source": "not needed to inspect source values"},
    },
    "tasks": {
        "attribute": "tasks", "file": "tasks_seed.csv", "label": "Prepared tasks",
        "primary_key": "task_id",
        "fields": ("task_id", "flag_id", "beneficiary_id", "centre_id", "owner_role", "status", "created_on", "due_on", "closed_on", "outcome", "synthetic_flag"),
        "filters": ("centre_id", "owner_role", "status"), "sort_fields": ("task_id", "beneficiary_id", "centre_id", "status", "created_on", "due_on"),
        "excluded": {"audit_entries": "internal audit detail is not needed for preview"},
    },
    "referrals": {
        "attribute": "referrals", "file": "referrals.csv", "label": "Prepared referrals",
        "primary_key": "referral_id",
        "fields": ("referral_id", "beneficiary_id", "centre_id", "referral_type", "state", "sent_on", "acknowledged_on", "attended_on", "outcome_on", "due_on", "synthetic_flag"),
        "filters": ("centre_id", "referral_type", "state"), "sort_fields": ("referral_id", "beneficiary_id", "centre_id", "state", "sent_on", "due_on"),
        "excluded": {"outcome_note": "free-text outcome may contain sensitive detail"},
    },
    "home_visits": {
        "attribute": "home_visits", "file": "home_visits.csv", "label": "Home visits",
        "primary_key": "visit_id",
        "fields": ("visit_id", "beneficiary_id", "centre_id", "visit_date", "outcome", "synthetic_flag"),
        "filters": ("beneficiary_id", "centre_id", "outcome"), "sort_fields": ("visit_id", "beneficiary_id", "centre_id", "visit_date", "outcome"),
        "excluded": {"visited_by": "worker identity is unnecessary"},
    },
    "maternal_profiles": {
        "attribute": "maternal_profiles", "file": "maternal_profiles.csv", "label": "Maternal profiles",
        "primary_key": "maternal_id",
        "fields": ("maternal_id", "beneficiary_id", "centre_id", "synthetic_flag"),
        "filters": ("beneficiary_id", "centre_id"), "sort_fields": ("maternal_id", "beneficiary_id", "centre_id"),
        "excluded": {"stage": "sensitive maternal health information", "registered_on": "sensitive health timeline", "last_visit_on": "sensitive health timeline", "next_visit_due_on": "sensitive health timeline", "access_level": "sensitive access classification"},
    },
    "service_records": {
        "attribute": "service_records", "file": "service_records.csv", "label": "Service records",
        "primary_key": "service_id",
        "fields": ("service_id", "beneficiary_id", "centre_id", "service_type", "service_date", "quantity", "synthetic_flag"),
        "filters": ("beneficiary_id", "centre_id", "service_type"), "sort_fields": ("service_id", "beneficiary_id", "centre_id", "service_type", "service_date"),
        "excluded": {},
    },
    "review_history": {
        "attribute": "review_history", "file": "review_history.csv", "label": "Review history",
        "primary_key": "review_id",
        "fields": ("review_id", "flag_id", "measurement_id", "centre_id", "flagged_on", "reviewed_on", "decision", "synthetic_flag"),
        "filters": ("measurement_id", "centre_id", "decision"), "sort_fields": ("review_id", "measurement_id", "centre_id", "flagged_on", "reviewed_on"),
        "excluded": {"reviewed_by": "reviewer identity is unnecessary"},
    },
    "verification_records": {
        "attribute": "verification_records", "file": "verification_records.csv", "label": "Verification records",
        "primary_key": "verification_id",
        "fields": ("verification_id", "beneficiary_id", "centre_id", "status", "opened_on", "resolved_on", "synthetic_flag"),
        "filters": ("beneficiary_id", "centre_id", "status"), "sort_fields": ("verification_id", "beneficiary_id", "centre_id", "status", "opened_on"),
        "excluded": {"barrier_type": "sensitive identity/access issue", "resolution_note": "free-text resolution may contain sensitive detail"},
    },
    "workers": {
        "attribute": "workers", "file": "workers.csv", "label": "Workers",
        "primary_key": "worker_id",
        "fields": ("worker_id", "centre_id", "role", "synthetic_flag"),
        "filters": ("centre_id", "role"), "sort_fields": ("worker_id", "centre_id", "role"),
        "excluded": {"name": "direct identifier"},
    },
}

PREVIEW_MAX_PAGE_SIZE = 100


class PreparedPreviewCatalog(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["SYNTHETIC DATA — LOCAL DEVELOPMENT PREVIEW"]
    datasets: list[dict]


class PreparedPreviewPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["SYNTHETIC DATA — LOCAL DEVELOPMENT PREVIEW"]
    dataset: str
    label: str
    fields: list[str]
    excluded_fields: dict[str, str]
    items: list[dict[str, str]]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=PREVIEW_MAX_PAGE_SIZE)
    offset: int = Field(ge=0)


def prepared_preview_catalog(dataset: prepared_dataset.PreparedDataset) -> dict:
    """Return safe metadata/counts for each explicit local-preview projection."""
    return {
        "mode": "SYNTHETIC DATA — LOCAL DEVELOPMENT PREVIEW",
        "datasets": [
            {
                "key": key,
                "label": definition["label"],
                "fields": list(definition["fields"]),
                "excluded_fields": dict(definition["excluded"]),
                "filters": list(definition["filters"]),
                "sort_fields": list(definition["sort_fields"]),
                "total": len(getattr(dataset, definition["attribute"])),
            }
            for key, definition in PREVIEW_DATASETS.items()
        ],
    }


def page_prepared_preview(
    dataset: prepared_dataset.PreparedDataset,
    dataset_key: str,
    *,
    limit: int,
    offset: int,
    filter_by: str | None = None,
    filter_value: str | None = None,
    sort_by: str | None = None,
    sort_order: Literal["asc", "desc"] = "asc",
) -> dict:
    """Build a stable page using only the dataset's declared preview contract."""
    from B2.prepared_dataset import PreparedDataUnavailable

    definition = PREVIEW_DATASETS.get(dataset_key)
    if definition is None:
        raise KeyError("Unknown prepared preview dataset.")
    if filter_by is None and filter_value is not None or filter_by is not None and filter_value is None:
        raise ValueError("A preview filter requires both a field and a value.")
    if filter_by is not None and filter_by not in definition["filters"]:
        raise ValueError("Preview filter field is not allowed for this dataset.")
    if sort_by is not None and sort_by not in definition["sort_fields"]:
        raise ValueError("Preview sort field is not allowed for this dataset.")
    if sort_order not in {"asc", "desc"}:
        raise ValueError("Preview sort direction is invalid.")
    if not 1 <= limit <= PREVIEW_MAX_PAGE_SIZE or offset < 0:
        raise ValueError("Preview pagination is outside the allowed bounds.")

    try:
        source_rows = getattr(dataset, definition["attribute"])
        primary_key = definition["primary_key"]
        rows = [row for row in source_rows if filter_by is None or row[filter_by] == filter_value]
        # Establish a deterministic primary-key base order before a stable
        # requested-field sort, so equal values never shuffle between pages.
        rows.sort(key=lambda row: row[primary_key])
        if sort_by is not None:
            rows.sort(key=lambda row: row[sort_by], reverse=sort_order == "desc")
        elif sort_order == "desc":
            rows.reverse()
        fields = definition["fields"]
        items = [{field: row[field] for field in fields} for row in rows[offset:offset + limit]]
    except (AttributeError, KeyError, TypeError) as exc:
        raise PreparedDataUnavailable("Prepared preview projection is unavailable or invalid.") from exc
    return {
        "mode": "SYNTHETIC DATA — LOCAL DEVELOPMENT PREVIEW",
        "dataset": dataset_key,
        "label": definition["label"],
        "fields": list(fields),
        "excluded_fields": dict(definition["excluded"]),
        "items": items,
        "total": len(rows),
        "limit": limit,
        "offset": offset,
    }


class PreparedBeneficiaryRecord(BaseModel):
    """Allowlisted row projection; deliberately excludes direct contact fields."""

    model_config = ConfigDict(extra="forbid")

    beneficiary_id: str
    centre_id: str
    category: str
    sex: str
    synthetic_flag: Literal["SYNTHETIC"]


class PreparedMeasurementRecord(BaseModel):
    """Allowlisted measurement values from the source CSV, preserving strings."""

    model_config = ConfigDict(extra="forbid")

    measurement_id: str
    beneficiary_id: str
    centre_id: str
    measured_on: str
    weight_value: str
    weight_unit: str
    height_value: str
    height_unit: str
    muac_cm: str
    is_baseline: str
    synthetic_flag: Literal["SYNTHETIC"]


class PreparedBeneficiaryPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: Literal["B!-PREPARED-SYNTHETIC-DATA"]
    items: list[PreparedBeneficiaryRecord]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


class PreparedMeasurementPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: Literal["B!-PREPARED-SYNTHETIC-DATA"]
    items: list[PreparedMeasurementRecord]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


_BENEFICIARY_FIELDS = tuple(PreparedBeneficiaryRecord.model_fields)
_MEASUREMENT_FIELDS = tuple(PreparedMeasurementRecord.model_fields)


def page_prepared_beneficiaries(
    dataset: prepared_dataset.PreparedDataset,
    centre_ids: set[str],
    *,
    limit: int,
    offset: int,
    category: str | None = None,
) -> dict:
    """Project authorized centres to a bounded, field-allowlisted page."""
    rows = [
        row for row in dataset.beneficiaries
        if row["centre_id"] in centre_ids and (category is None or row["category"] == category)
    ]
    return {
        "source": PREPARED_SOURCE,
        "items": [{field: row[field] for field in _BENEFICIARY_FIELDS} for row in rows[offset:offset + limit]],
        "total": len(rows),
        "limit": limit,
        "offset": offset,
    }


def page_prepared_measurements(
    dataset: prepared_dataset.PreparedDataset,
    centre_ids: set[str],
    *,
    limit: int,
    offset: int,
    beneficiary_id: str | None = None,
) -> dict:
    """Project authorized-centre measurements without deriving clinical values."""
    rows = [
        row for row in dataset.measurements
        if row["centre_id"] in centre_ids
        and (beneficiary_id is None or row["beneficiary_id"] == beneficiary_id)
    ]
    return {
        "source": PREPARED_SOURCE,
        "items": [{field: row[field] for field in _MEASUREMENT_FIELDS} for row in rows[offset:offset + limit]],
        "total": len(rows),
        "limit": limit,
        "offset": offset,
    }


def _count_by(rows: tuple[Mapping[str, str], ...], field: str, allowed: tuple[str, ...]) -> dict[str, int]:
    counts = Counter(row.get(field, "") for row in rows)
    if any(value not in allowed for value in counts):
        raise PreparedDataUnavailable
    return {value: counts.get(value, 0) for value in allowed}


def read_prepared_summary() -> dict:
    """Validate all prepared source tables and return aggregate counts only."""
    dataset = read_prepared_dataset(DATA_DIR)
    beneficiaries = dataset.beneficiaries
    centres = dataset.centres
    measurements = dataset.measurements
    tasks = dataset.tasks
    referrals = dataset.referrals
    categories = _count_by(beneficiaries, "category", CATEGORY_VALUES)
    task_statuses = _count_by(tasks, "status", TASK_STATUS_VALUES)
    referral_states = _count_by(referrals, "state", REFERRAL_STATE_VALUES)

    return {
        "source": "B!-PREPARED-SYNTHETIC-DATA",
        "label": LABEL,
        "counts": {
            "beneficiaries_total": len(beneficiaries),
            "beneficiaries_by_category": categories,
            "centres_total": len(centres),
            "measurements_total": len(measurements),
            "tasks_total": len(tasks),
            "tasks_by_status": task_statuses,
            "referrals_total": len(referrals),
            "referrals_by_state": referral_states,
        },
    }
