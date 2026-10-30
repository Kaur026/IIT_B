"""Beneficiary registration and initial measurement services for the API prototype.

The service stores identifiers and workflow state only. B1 remains the source
of measurement trust checks and deterministic screening decisions.
"""

import json
import math
import sys
from pathlib import Path
from uuid import uuid4

from B2.demo_clock import parse_date
from B2.store import StoreError
from B2.verification import build_flag_snapshot

ROOT = Path(__file__).resolve().parents[1]
B1_DIR = ROOT / "B1"
if str(B1_DIR) not in sys.path:
    sys.path.insert(0, str(B1_DIR))

MEASUREMENT_FIELDS = {"measurement_date", "weight_kg", "height_cm", "muac_mm", "oedema", "danger_sign"}
NUMERIC_FIELDS = {"weight_kg", "height_cm", "muac_mm"}


class BeneficiaryError(ValueError):
    """Invalid beneficiary or measurement request."""


def _age_months(date_of_birth: str, on: str) -> int:
    born = parse_date(date_of_birth)
    current = parse_date(on)
    if born > current:
        raise BeneficiaryError("Date of birth cannot be in the future.")
    months = (current.year - born.year) * 12 + current.month - born.month
    if current.day < born.day:
        months -= 1
    return months


def register_beneficiary(store, *, beneficiary_id: str | None, date_of_birth: str,
                         sex: str, centre_id: str, assigned_worker_id: str,
                         caregiver_kinship: str = "", registered_at: str):
    """Save a child profile; centre and worker must already be server-resolved."""
    dob = parse_date(date_of_birth).isoformat()
    registered = parse_date(registered_at).isoformat()
    if parse_date(dob) > parse_date(registered):
        raise BeneficiaryError("Date of birth cannot be in the future.")
    if sex not in {"M", "F"}:
        raise BeneficiaryError("B1 child screening requires sex M or F.")
    if not centre_id.strip() or not assigned_worker_id.strip():
        raise BeneficiaryError("An assigned centre and worker are required.")
    ident = (beneficiary_id or f"BEN-{uuid4().hex[:12].upper()}").strip()
    if len(ident) > 80 or not ident.startswith("BEN-"):
        raise BeneficiaryError("Beneficiary ID must use the BEN- prefix.")
    record = {
        "beneficiary_id": ident,
        "child_id": ident,
        "centre_id": centre_id,
        "assigned_worker_id": assigned_worker_id,
        "date_of_birth": dob,
        "sex": sex,
        "category": "child_under_6",
        "caregiver_kinship": caregiver_kinship.strip(),
        "registered_at": registered,
        "source_row": {
            "child_id": ident,
            "assigned_worker_id": assigned_worker_id,
            "sex": sex,
            "date_of_birth": dob,
        },
        "label": "SYNTHETIC DATA / PROTOTYPE API",
    }
    try:
        return store.add_beneficiary(record)
    except StoreError as exc:
        raise BeneficiaryError("Beneficiary ID already exists or the record is invalid.") from exc


def record_initial_measurement(store, beneficiary: dict, values: dict, actor_id: str,
                               recorded_at: str, today: str | None = None):
    """Validate and append the first measurement and matching rule snapshot."""
    if not isinstance(values, dict) or not values:
        raise BeneficiaryError("Measurement fields are required.")
    if set(values) - MEASUREMENT_FIELDS:
        raise BeneficiaryError("Unsupported measurement fields were supplied.")
    if not {"measurement_date", "weight_kg", "height_cm"}.issubset(values):
        raise BeneficiaryError("Measurement date, weight, and height are required.")
    if store.list_measurements(beneficiary["beneficiary_id"]):
        raise BeneficiaryError("An initial measurement already exists; use the remeasurement workflow.")
    measurement_date = parse_date(values["measurement_date"]).isoformat()
    recorded_date = parse_date(recorded_at).isoformat()
    evaluation_date = parse_date(today or recorded_date).isoformat()
    if not actor_id.strip():
        raise BeneficiaryError("A verified actor is required.")
    normalized = dict(values)
    normalized["measurement_date"] = measurement_date
    for key in NUMERIC_FIELDS.intersection(normalized):
        value = normalized[key]
        if isinstance(value, bool):
            raise BeneficiaryError("Measurement values must be finite numbers.")
        try:
            number = float(value)
        except (TypeError, ValueError) as exc:
            raise BeneficiaryError("Measurement values must be finite numbers.") from exc
        if not math.isfinite(number):
            raise BeneficiaryError("Measurement values must be finite numbers.")
        normalized[key] = number
    for key in {"oedema", "danger_sign"}.intersection(normalized):
        value = normalized[key]
        if isinstance(value, bool):
            normalized[key] = "yes" if value else "no"
        elif str(value).strip().lower() not in {"yes", "no", "y", "n", "true", "false", "1", "0", "present"}:
            raise BeneficiaryError("Oedema and danger-sign fields must be boolean values.")

    try:
        import data_checks
        import rules_engine
    except ImportError as exc:
        raise BeneficiaryError("B1 screening dependencies are unavailable.") from exc

    age_months = _age_months(beneficiary["date_of_birth"], measurement_date)
    source_row = dict(beneficiary.get("source_row") or {})
    source_row.update({
        "child_id": beneficiary["beneficiary_id"],
        "assigned_worker_id": beneficiary["assigned_worker_id"],
        "sex": beneficiary["sex"],
        "age_months": age_months,
        **normalized,
    })
    check = data_checks.check_child(source_row, today=evaluation_date)
    source_row["measurement_valid"] = bool(check.get("measurement_valid"))
    evaluation = rules_engine.evaluate_child(source_row, today=evaluation_date)
    measurement = {
        "measurement_id": str(uuid4()),
        "beneficiary_id": beneficiary["beneficiary_id"],
        "centre_id": beneficiary["centre_id"],
        "source": "initial",
        "parent_measurement_id": "",
        "recorded_at": recorded_date,
        "recorded_by": actor_id,
        "age_months": age_months,
        "measurement_valid": bool(check.get("measurement_valid")),
        "data_quality_issues": check.get("issues", []),
        "evaluation": evaluation,
        "label": "SYNTHETIC DATA / PROTOTYPE API",
        **{key: source_row.get(key) for key in MEASUREMENT_FIELDS},
    }
    try:
        rule_version = json.loads((B1_DIR / "thresholds.json").read_text(encoding="utf-8")).get("version", "unknown")
    except (OSError, json.JSONDecodeError):
        rule_version = "unknown"
    flag = build_flag_snapshot(
        beneficiary, measurement, evaluation, check, rule_version, recorded_date,
    )
    save_pair = getattr(store, "save_measurement_and_flag", None)
    if not callable(save_pair):
        raise BeneficiaryError("The configured repository does not support atomic measurement evaluation storage.")
    try:
        save_pair(measurement, flag)
    except StoreError as exc:
        raise BeneficiaryError("Measurement and evaluation could not be saved.") from exc
    return {"measurement": measurement, "flag": flag}
