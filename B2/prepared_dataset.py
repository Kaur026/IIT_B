"""Typed, immutable, read-only access to the prepared synthetic CSV dataset.

This module reads CSV files only from the backend data directory.  It never
serializes source rows or includes their values in validation errors.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from types import MappingProxyType
from typing import Mapping, TypedDict, cast


DATA_DIR = Path(__file__).resolve().parents[1] / "B!" / "data"

SCHEMAS = {
    "age_bands_reference.csv": ("band_id", "label", "min_months", "max_months", "service_name", "verified", "status", "synthetic_flag"),
    "beneficiaries.csv": ("beneficiary_id", "centre_id", "category", "name", "sex", "date_of_birth", "enrolment_date", "guardian_name", "mobile_verification_status", "possible_duplicate_of", "synthetic_flag"),
    "centres.csv": ("centre_id", "name", "block", "district", "state", "worker_id", "synthetic_flag"),
    "home_visits.csv": ("visit_id", "beneficiary_id", "centre_id", "visit_date", "visited_by", "outcome", "synthetic_flag"),
    "maternal_profiles.csv": ("maternal_id", "beneficiary_id", "centre_id", "stage", "registered_on", "last_visit_on", "next_visit_due_on", "access_level", "synthetic_flag"),
    "measurements.csv": ("measurement_id", "beneficiary_id", "centre_id", "measured_on", "recorded_by", "weight_value", "weight_unit", "height_value", "height_unit", "muac_cm", "is_baseline", "supersedes_id", "entry_source", "synthetic_flag"),
    "referrals.csv": ("referral_id", "beneficiary_id", "centre_id", "referral_type", "state", "sent_on", "acknowledged_on", "attended_on", "outcome_on", "outcome_note", "due_on", "synthetic_flag"),
    "review_history.csv": ("review_id", "flag_id", "measurement_id", "centre_id", "reviewed_by", "flagged_on", "reviewed_on", "decision", "synthetic_flag"),
    "service_records.csv": ("service_id", "beneficiary_id", "centre_id", "service_type", "service_date", "quantity", "synthetic_flag"),
    "tasks_seed.csv": ("task_id", "flag_id", "beneficiary_id", "centre_id", "owner_role", "status", "created_on", "due_on", "closed_on", "outcome", "audit_entries", "synthetic_flag"),
    "verification_records.csv": ("verification_id", "beneficiary_id", "centre_id", "barrier_type", "status", "opened_on", "resolved_on", "resolution_note", "synthetic_flag"),
    "workers.csv": ("worker_id", "name", "centre_id", "role", "synthetic_flag"),
}

PRIMARY_KEYS = {
    "age_bands_reference.csv": "band_id",
    "beneficiaries.csv": "beneficiary_id",
    "centres.csv": "centre_id",
    "home_visits.csv": "visit_id",
    "maternal_profiles.csv": "maternal_id",
    "measurements.csv": "measurement_id",
    "referrals.csv": "referral_id",
    "review_history.csv": "review_id",
    "service_records.csv": "service_id",
    "tasks_seed.csv": "task_id",
    "verification_records.csv": "verification_id",
    "workers.csv": "worker_id",
}

CATEGORY_VALUES = ("child", "pregnant_woman", "lactating_mother")
TASK_STATUS_VALUES = ("assigned", "acknowledged", "in_progress", "closed")
REFERRAL_STATE_VALUES = ("sent", "acknowledged", "attended", "outcome_recorded")

# These are the categorical domains present in the prepared dataset contract.
STATUS_VALUES = {
    ("age_bands_reference.csv", "verified"): frozenset({"false", "true"}),
    ("age_bands_reference.csv", "status"): frozenset({"draft"}),
    ("beneficiaries.csv", "category"): frozenset(CATEGORY_VALUES),
    ("beneficiaries.csv", "sex"): frozenset({"F", "M"}),
    ("beneficiaries.csv", "mobile_verification_status"): frozenset({"not_available", "pending", "verified"}),
    ("workers.csv", "role"): frozenset({"anganwadi_worker"}),
    ("measurements.csv", "weight_unit"): frozenset({"g", "kg"}),
    ("measurements.csv", "height_unit"): frozenset({"cm", "m"}),
    ("measurements.csv", "is_baseline"): frozenset({"0", "1"}),
    ("measurements.csv", "entry_source"): frozenset({"mobile", "paper_entry"}),
    ("tasks_seed.csv", "owner_role"): frozenset({"anganwadi_worker", "supervisor"}),
    ("tasks_seed.csv", "status"): frozenset(TASK_STATUS_VALUES),
    ("tasks_seed.csv", "outcome"): frozenset({"", "reading_verified", "reassigned"}),
    ("referrals.csv", "referral_type"): frozenset({"disability_deic", "health_facility"}),
    ("referrals.csv", "state"): frozenset(REFERRAL_STATE_VALUES),
    ("review_history.csv", "decision"): frozenset({"", "confirmed_error", "needs_remeasure", "valid_reading"}),
    ("home_visits.csv", "outcome"): frozenset({"advice_given", "found_well", "not_home", "referred"}),
    ("service_records.csv", "service_type"): frozenset({"growth_monitoring", "hot_cooked_meal", "supplement", "take_home_ration"}),
    ("verification_records.csv", "barrier_type"): frozenset({"auth_failed", "document_missing", "other", "pending_mobile_auth"}),
    ("verification_records.csv", "status"): frozenset({"in_progress", "open", "resolved"}),
    ("maternal_profiles.csv", "stage"): frozenset({"postnatal_0_6m", "trimester_1", "trimester_2", "trimester_3"}),
    ("maternal_profiles.csv", "access_level"): frozenset({"deferred_under_18", "restricted"}),
}

OPTIONAL_BLANKS = {
    "beneficiaries.csv": frozenset({"guardian_name", "possible_duplicate_of"}),
    "measurements.csv": frozenset({"weight_value", "height_value", "supersedes_id"}),
    "tasks_seed.csv": frozenset({"closed_on", "outcome"}),
    "referrals.csv": frozenset({"acknowledged_on", "attended_on", "outcome_on", "outcome_note"}),
    "review_history.csv": frozenset({"reviewed_on", "decision"}),
    "verification_records.csv": frozenset({"resolved_on", "resolution_note"}),
}

DATE_FIELDS = {
    "beneficiaries.csv": ("date_of_birth", "enrolment_date"),
    "home_visits.csv": ("visit_date",),
    "maternal_profiles.csv": ("registered_on", "last_visit_on", "next_visit_due_on"),
    "measurements.csv": ("measured_on",),
    "referrals.csv": ("sent_on", "acknowledged_on", "attended_on", "outcome_on", "due_on"),
    "review_history.csv": ("flagged_on", "reviewed_on"),
    "service_records.csv": ("service_date",),
    "tasks_seed.csv": ("created_on", "due_on", "closed_on"),
    "verification_records.csv": ("opened_on", "resolved_on"),
}

NUMERIC_FIELDS = {
    "age_bands_reference.csv": ("min_months", "max_months"),
    "measurements.csv": ("weight_value", "height_value", "muac_cm"),
    "service_records.csv": ("quantity",),
    "tasks_seed.csv": ("audit_entries",),
}

IDENTIFIER_FIELDS = {
    "age_bands_reference.csv": ("band_id",),
    "beneficiaries.csv": ("beneficiary_id", "centre_id", "possible_duplicate_of"),
    "centres.csv": ("centre_id", "worker_id"),
    "home_visits.csv": ("visit_id", "beneficiary_id", "centre_id", "visited_by"),
    "maternal_profiles.csv": ("maternal_id", "beneficiary_id", "centre_id"),
    "measurements.csv": ("measurement_id", "beneficiary_id", "centre_id", "recorded_by", "supersedes_id"),
    "referrals.csv": ("referral_id", "beneficiary_id", "centre_id"),
    "review_history.csv": ("review_id", "flag_id", "measurement_id", "centre_id", "reviewed_by"),
    "service_records.csv": ("service_id", "beneficiary_id", "centre_id"),
    "tasks_seed.csv": ("task_id", "flag_id", "beneficiary_id", "centre_id"),
    "verification_records.csv": ("verification_id", "beneficiary_id", "centre_id"),
    "workers.csv": ("worker_id", "centre_id"),
}


class PreparedDataUnavailable(Exception):
    """The server-side prepared dataset is missing or violates its contract."""


class AgeBandRow(TypedDict):
    band_id: str
    label: str
    min_months: str
    max_months: str
    service_name: str
    verified: str
    status: str
    synthetic_flag: str


class BeneficiaryRow(TypedDict):
    beneficiary_id: str
    centre_id: str
    category: str
    name: str
    sex: str
    date_of_birth: str
    enrolment_date: str
    guardian_name: str
    mobile_verification_status: str
    possible_duplicate_of: str
    synthetic_flag: str


class CentreRow(TypedDict):
    centre_id: str
    name: str
    block: str
    district: str
    state: str
    worker_id: str
    synthetic_flag: str


class HomeVisitRow(TypedDict):
    visit_id: str
    beneficiary_id: str
    centre_id: str
    visit_date: str
    visited_by: str
    outcome: str
    synthetic_flag: str


class MaternalProfileRow(TypedDict):
    maternal_id: str
    beneficiary_id: str
    centre_id: str
    stage: str
    registered_on: str
    last_visit_on: str
    next_visit_due_on: str
    access_level: str
    synthetic_flag: str


class MeasurementRow(TypedDict):
    measurement_id: str
    beneficiary_id: str
    centre_id: str
    measured_on: str
    recorded_by: str
    weight_value: str
    weight_unit: str
    height_value: str
    height_unit: str
    muac_cm: str
    is_baseline: str
    supersedes_id: str
    entry_source: str
    synthetic_flag: str


class ReferralRow(TypedDict):
    referral_id: str
    beneficiary_id: str
    centre_id: str
    referral_type: str
    state: str
    sent_on: str
    acknowledged_on: str
    attended_on: str
    outcome_on: str
    outcome_note: str
    due_on: str
    synthetic_flag: str


class ReviewHistoryRow(TypedDict):
    review_id: str
    flag_id: str
    measurement_id: str
    centre_id: str
    reviewed_by: str
    flagged_on: str
    reviewed_on: str
    decision: str
    synthetic_flag: str


class ServiceRecordRow(TypedDict):
    service_id: str
    beneficiary_id: str
    centre_id: str
    service_type: str
    service_date: str
    quantity: str
    synthetic_flag: str


class TaskRow(TypedDict):
    task_id: str
    flag_id: str
    beneficiary_id: str
    centre_id: str
    owner_role: str
    status: str
    created_on: str
    due_on: str
    closed_on: str
    outcome: str
    audit_entries: str
    synthetic_flag: str


class VerificationRow(TypedDict):
    verification_id: str
    beneficiary_id: str
    centre_id: str
    barrier_type: str
    status: str
    opened_on: str
    resolved_on: str
    resolution_note: str
    synthetic_flag: str


class WorkerRow(TypedDict):
    worker_id: str
    name: str
    centre_id: str
    role: str
    synthetic_flag: str


def _invalid(filename: str, row_number: int | None = None, field: str | None = None) -> PreparedDataUnavailable:
    location = filename
    if row_number is not None:
        location += f" row {row_number}"
    if field:
        location += f" field {field}"
    return PreparedDataUnavailable(f"Prepared dataset validation failed at {location}.")


def _valid_identifier(value: str) -> bool:
    return bool(value) and len(value) <= 128 and value == value.strip() and all(
        character.isprintable() and not character.isspace() for character in value
    )


def _read_rows(directory: Path, filename: str) -> tuple[dict[str, str], ...]:
    path = directory / filename
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as source:
            reader = csv.DictReader(source, strict=True)
            if tuple(reader.fieldnames or ()) != SCHEMAS[filename]:
                raise _invalid(filename, field="header")
            rows = []
            for row_number, row in enumerate(reader, start=2):
                if None in row or any(value is None for value in row.values()):
                    raise _invalid(filename, row_number, "column_count")
                rows.append(cast(dict[str, str], row))
    except PreparedDataUnavailable:
        raise
    except (OSError, UnicodeError, csv.Error) as exc:
        raise PreparedDataUnavailable(f"Prepared dataset file {filename} is unavailable or malformed.") from exc
    return tuple(rows)


def _validate_rows(filename: str, rows: tuple[dict[str, str], ...]) -> None:
    optional = OPTIONAL_BLANKS.get(filename, frozenset())
    identifiers = IDENTIFIER_FIELDS.get(filename, ())
    domains = {field: allowed for (table, field), allowed in STATUS_VALUES.items() if table == filename}
    for row_number, row in enumerate(rows, start=2):
        for field in SCHEMAS[filename]:
            value = row[field]
            if not value.strip() and field not in optional:
                raise _invalid(filename, row_number, field)
            if value != value.strip() and field in identifiers:
                raise _invalid(filename, row_number, field)
            if field in identifiers and value and not _valid_identifier(value):
                raise _invalid(filename, row_number, field)
            if field == "synthetic_flag" and value != "SYNTHETIC":
                raise _invalid(filename, row_number, field)
            if field in domains and value not in domains[field]:
                raise _invalid(filename, row_number, field)

        for field in DATE_FIELDS.get(filename, ()):
            value = row[field]
            if value:
                try:
                    date.fromisoformat(value)
                except ValueError as exc:
                    raise _invalid(filename, row_number, field) from exc

        for field in NUMERIC_FIELDS.get(filename, ()):
            value = row[field]
            if not value:
                if field not in optional:
                    raise _invalid(filename, row_number, field)
                continue
            try:
                number = Decimal(value)
            except InvalidOperation as exc:
                raise _invalid(filename, row_number, field) from exc
            if not number.is_finite() or number < 0:
                raise _invalid(filename, row_number, field)
            if filename == "measurements.csv" and number == 0:
                raise _invalid(filename, row_number, field)
            if filename == "service_records.csv" and field == "quantity" and number == 0:
                raise _invalid(filename, row_number, field)
            if filename in {"age_bands_reference.csv", "tasks_seed.csv"} and number != number.to_integral_value():
                raise _invalid(filename, row_number, field)


def _index(filename: str, rows: tuple[dict[str, str], ...]) -> dict[str, dict[str, str]]:
    key = PRIMARY_KEYS[filename]
    values = [row[key] for row in rows]
    if len(values) != len(set(values)):
        raise _invalid(filename, field=key)
    return {row[key]: row for row in rows}


def _validate_references(tables: dict[str, tuple[dict[str, str], ...]]) -> None:
    by_name = {name: _index(name, rows) for name, rows in tables.items()}
    beneficiaries = by_name["beneficiaries.csv"]
    centres = by_name["centres.csv"]
    workers = by_name["workers.csv"]
    measurements = by_name["measurements.csv"]
    reviews = tables["review_history.csv"]
    reviews_by_flag: dict[str, list[dict[str, str]]] = {}
    for review in reviews:
        reviews_by_flag.setdefault(review["flag_id"], []).append(review)

    for row in tables["beneficiaries.csv"]:
        if row["centre_id"] not in centres:
            raise _invalid("beneficiaries.csv", field="centre_id")
        duplicate = row["possible_duplicate_of"]
        if duplicate and (duplicate not in beneficiaries or duplicate == row["beneficiary_id"]):
            raise _invalid("beneficiaries.csv", field="possible_duplicate_of")

    for row in tables["centres.csv"]:
        worker = workers.get(row["worker_id"])
        if worker is None or worker["centre_id"] != row["centre_id"]:
            raise _invalid("centres.csv", field="worker_id")
    for row in tables["workers.csv"]:
        centre = centres.get(row["centre_id"])
        if centre is None or centre["worker_id"] != row["worker_id"]:
            raise _invalid("workers.csv", field="centre_id")

    beneficiary_linked_files = (
        "home_visits.csv", "maternal_profiles.csv", "measurements.csv", "referrals.csv",
        "service_records.csv", "tasks_seed.csv", "verification_records.csv",
    )
    for filename in beneficiary_linked_files:
        for row in tables[filename]:
            beneficiary = beneficiaries.get(row["beneficiary_id"])
            if beneficiary is None or beneficiary["centre_id"] != row["centre_id"]:
                raise _invalid(filename, field="beneficiary_id/centre_id")

    for row in tables["measurements.csv"]:
        worker = workers.get(row["recorded_by"])
        if worker is None or worker["centre_id"] != row["centre_id"]:
            raise _invalid("measurements.csv", field="recorded_by")
        previous_id = row["supersedes_id"]
        if previous_id:
            previous = measurements.get(previous_id)
            if (previous is None or previous["beneficiary_id"] != row["beneficiary_id"]
                    or previous["centre_id"] != row["centre_id"]):
                raise _invalid("measurements.csv", field="supersedes_id")

    for row in tables["home_visits.csv"]:
        worker = workers.get(row["visited_by"])
        if worker is None or worker["centre_id"] != row["centre_id"]:
            raise _invalid("home_visits.csv", field="visited_by")

    for row in tables["review_history.csv"]:
        measurement = measurements.get(row["measurement_id"])
        if measurement is None or measurement["centre_id"] != row["centre_id"]:
            raise _invalid("review_history.csv", field="measurement_id")

    # The prepared source has no complete flags table. Review history is
    # partial, so an unmatched task flag is not treated as an invented failure.
    # If a task flag is represented in review history, validate its known links.
    for task in tables["tasks_seed.csv"]:
        for review in reviews_by_flag.get(task["flag_id"], ()):
            measurement = measurements[review["measurement_id"]]
            if (review["centre_id"] != task["centre_id"]
                    or measurement["beneficiary_id"] != task["beneficiary_id"]):
                raise _invalid("tasks_seed.csv", field="flag_id")

    for row in tables["tasks_seed.csv"]:
        closed = row["status"] == "closed"
        if closed != bool(row["closed_on"]) or closed != bool(row["outcome"]):
            raise _invalid("tasks_seed.csv", field="status/closed_on/outcome")
    for row in tables["referrals.csv"]:
        required_date = {
            "sent": "sent_on", "acknowledged": "acknowledged_on",
            "attended": "attended_on", "outcome_recorded": "outcome_on",
        }[row["state"]]
        if not row[required_date]:
            raise _invalid("referrals.csv", field=f"state/{required_date}")
        if row["state"] == "outcome_recorded" and not row["outcome_note"]:
            raise _invalid("referrals.csv", field="outcome_note")
    for row in tables["verification_records.csv"]:
        resolved = row["status"] == "resolved"
        if resolved != bool(row["resolved_on"]) or resolved != bool(row["resolution_note"]):
            raise _invalid("verification_records.csv", field="status/resolved_on/resolution_note")
    for row in tables["review_history.csv"]:
        if bool(row["decision"]) != bool(row["reviewed_on"]):
            raise _invalid("review_history.csv", field="decision/reviewed_on")


def _freeze_rows(rows: tuple[dict[str, str], ...]) -> tuple[Mapping[str, str], ...]:
    return tuple(MappingProxyType(dict(row)) for row in rows)


@dataclass(frozen=True)
class PreparedDataset:
    age_bands: tuple[AgeBandRow, ...]
    beneficiaries: tuple[BeneficiaryRow, ...]
    centres: tuple[CentreRow, ...]
    home_visits: tuple[HomeVisitRow, ...]
    maternal_profiles: tuple[MaternalProfileRow, ...]
    measurements: tuple[MeasurementRow, ...]
    referrals: tuple[ReferralRow, ...]
    review_history: tuple[ReviewHistoryRow, ...]
    service_records: tuple[ServiceRecordRow, ...]
    tasks: tuple[TaskRow, ...]
    verification_records: tuple[VerificationRow, ...]
    workers: tuple[WorkerRow, ...]


def read_prepared_dataset(data_dir: Path | None = None) -> PreparedDataset:
    """Load and validate all prepared source tables without mutating them."""
    directory = Path(data_dir) if data_dir is not None else DATA_DIR
    tables = {filename: _read_rows(directory, filename) for filename in SCHEMAS}
    for filename, rows in tables.items():
        _validate_rows(filename, rows)
    _validate_references(tables)
    frozen = {filename: _freeze_rows(rows) for filename, rows in tables.items()}
    return PreparedDataset(
        age_bands=cast(tuple[AgeBandRow, ...], frozen["age_bands_reference.csv"]),
        beneficiaries=cast(tuple[BeneficiaryRow, ...], frozen["beneficiaries.csv"]),
        centres=cast(tuple[CentreRow, ...], frozen["centres.csv"]),
        home_visits=cast(tuple[HomeVisitRow, ...], frozen["home_visits.csv"]),
        maternal_profiles=cast(tuple[MaternalProfileRow, ...], frozen["maternal_profiles.csv"]),
        measurements=cast(tuple[MeasurementRow, ...], frozen["measurements.csv"]),
        referrals=cast(tuple[ReferralRow, ...], frozen["referrals.csv"]),
        review_history=cast(tuple[ReviewHistoryRow, ...], frozen["review_history.csv"]),
        service_records=cast(tuple[ServiceRecordRow, ...], frozen["service_records.csv"]),
        tasks=cast(tuple[TaskRow, ...], frozen["tasks_seed.csv"]),
        verification_records=cast(tuple[VerificationRow, ...], frozen["verification_records.csv"]),
        workers=cast(tuple[WorkerRow, ...], frozen["workers.csv"]),
    )
