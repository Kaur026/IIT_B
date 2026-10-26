"""BE1 - rules engine v1 (structural checks + hook for trend checks).

A flag is NOT a diagnosis and does not prove worker error. It says a record needs
human verification. Original readings are never modified. Thresholds come only from
rule_config.json. Disabled/draft rules never run.
"""
from datetime import date

from .dataio import load_config, to_float, to_date

HARD_RULES = {"MISSING_FIELD", "UNIT_MISMATCH", "FUTURE_DATE", "IMPLAUSIBLE_VALUE", "DUPLICATE"}


def rule_active(cfg, rule_id):
    r = cfg["rules"].get(rule_id)
    return bool(r and r.get("enabled") and not r.get("demo_only"))


def make_flag(cfg, rule_id, dataset, record, reason, source_values, extra=None):
    r = cfg["rules"][rule_id]
    f = {
        "flag_id": f"FLG-{record[dataset_id_field(dataset)]}-{rule_id}",
        "dataset": dataset,
        "record_id": record[dataset_id_field(dataset)],
        "beneficiary_id": record.get("beneficiary_id"),
        "centre_id": record.get("centre_id"),
        "rule_id": rule_id,
        "rule_version": r["version"],
        "rule_status": r["status"],
        "config_version": cfg["config_version"],
        "reason": reason,
        "source_values": source_values,
        "needs_human_verification": True,
        "is_diagnosis": False,
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
    }
    if extra:
        f.update(extra)
    return f


def dataset_id_field(dataset):
    return {"measurements": "measurement_id", "beneficiaries": "beneficiary_id"}[dataset]


def _vals(m):
    return {k: m.get(k) for k in ("measured_on", "weight_value", "weight_unit", "height_value", "height_unit", "muac_cm")}


def check_measurement(m, cfg, rep):
    flags = []
    # MISSING_FIELD
    if rule_active(cfg, "MISSING_FIELD"):
        missing = [f for f in cfg["rules"]["MISSING_FIELD"]["params"]["required_fields"] if m.get(f) in (None, "")]
        if missing:
            flags.append(make_flag(cfg, "MISSING_FIELD", "measurements", m,
                                   "Required field(s) empty: " + ", ".join(missing) + ". Needs human verification.",
                                   {"missing_fields": missing, **_vals(m)}))
    w, h = to_float(m.get("weight_value")), to_float(m.get("height_value"))
    wu, hu = m.get("weight_unit"), m.get("height_unit")
    # FUTURE_DATE
    d = to_date(m.get("measured_on"))
    if rule_active(cfg, "FUTURE_DATE") and d and d > rep:
        flags.append(make_flag(cfg, "FUTURE_DATE", "measurements", m,
                               f"Measurement date {d} is after the reporting date {rep}. Needs human verification.",
                               {"measured_on": m["measured_on"], "reporting_date": rep.isoformat()}))
    # UNIT_MISMATCH (+ remember which fields cannot be range-checked)
    unit_bad = set()
    if rule_active(cfg, "UNIT_MISMATCH"):
        p = cfg["rules"]["UNIT_MISMATCH"]["params"]
        probs = []
        if w is not None and wu:
            if wu != p["expected_weight_unit"] or w > p["weight_looks_like_grams_above"]:
                probs.append(f"weight {w} recorded as '{wu}'; expected {p['expected_weight_unit']}")
                unit_bad.add("weight")
        if h is not None and hu:
            if hu != p["expected_height_unit"] or h < p["height_looks_like_metres_below"]:
                probs.append(f"height {h} recorded as '{hu}'; expected {p['expected_height_unit']}")
                unit_bad.add("height")
        if probs:
            flags.append(make_flag(cfg, "UNIT_MISMATCH", "measurements", m,
                                   "Unit looks inconsistent: " + "; ".join(probs) + ". Needs human verification.",
                                   _vals(m)))
    # IMPLAUSIBLE_VALUE (data-quality range only; skipped for fields with a unit problem)
    if rule_active(cfg, "IMPLAUSIBLE_VALUE"):
        p = cfg["rules"]["IMPLAUSIBLE_VALUE"]["params"]
        probs = []
        if w is not None and "weight" not in unit_bad and not (p["weight_kg_min"] <= w <= p["weight_kg_max"]):
            probs.append(f"weight {w} kg outside {p['weight_kg_min']}-{p['weight_kg_max']}")
        if h is not None and "height" not in unit_bad and not (p["height_cm_min"] <= h <= p["height_cm_max"]):
            probs.append(f"height {h} cm outside {p['height_cm_min']}-{p['height_cm_max']}")
        mu = to_float(m.get("muac_cm"))
        if mu is not None and not (p["muac_cm_min"] <= mu <= p["muac_cm_max"]):
            probs.append(f"MUAC {mu} cm outside {p['muac_cm_min']}-{p['muac_cm_max']}")
        if probs:
            flags.append(make_flag(cfg, "IMPLAUSIBLE_VALUE", "measurements", m,
                                   "Value outside the plausible data range: " + "; ".join(probs) + ". Needs human verification.",
                                   _vals(m)))
    return flags


def check_duplicates(measurements, beneficiaries, cfg):
    flags = []
    if not rule_active(cfg, "DUPLICATE"):
        return flags
    seen = {}
    for m in sorted(measurements, key=lambda x: x["measurement_id"]):
        if m.get("supersedes_id") or not m.get("measured_on"):
            continue                      # remeasurements are new records, not duplicates
        k = (m["beneficiary_id"], m["measured_on"])
        if k in seen:
            flags.append(make_flag(cfg, "DUPLICATE", "measurements", m,
                                   f"Another reading for {m['beneficiary_id']} exists on {m['measured_on']} "
                                   f"({seen[k]}). Needs human verification.",
                                   {"same_as": seen[k], **_vals(m)}))
        else:
            seen[k] = m["measurement_id"]
    g = {}
    for b in sorted(beneficiaries, key=lambda x: x["beneficiary_id"]):
        k = ((b.get("name") or "").strip().lower(), b.get("date_of_birth"), b.get("centre_id"))
        if k in g:
            flags.append(make_flag(cfg, "DUPLICATE", "beneficiaries", b,
                                   f"Same name, date of birth and centre as {g[k]}. Possible duplicate; needs human verification.",
                                   {"same_as": g[k], "name": b.get("name"), "date_of_birth": b.get("date_of_birth"),
                                    "centre_id": b.get("centre_id")}))
        else:
            g[k] = b["beneficiary_id"]
    return flags


def run_all(measurements, beneficiaries, cfg=None):
    """Return all flags (structural + trend). Does not modify inputs."""
    from .trend_checks import run_trend_checks
    cfg = cfg or load_config()
    rep = date.fromisoformat(cfg["reporting_date"])
    flags = []
    for m in measurements:
        flags += check_measurement(m, cfg, rep)
    flags += check_duplicates(measurements, beneficiaries, cfg)
    hard = {f["record_id"] for f in flags if f["dataset"] == "measurements" and f["rule_id"] in HARD_RULES}
    flags += run_trend_checks(measurements, hard, cfg)
    # annotate superseded readings so the UI can show the remeasurement link
    sup = {m["supersedes_id"]: m["measurement_id"] for m in measurements if m.get("supersedes_id")}
    for f in flags:
        if f["dataset"] == "measurements" and f["record_id"] in sup:
            f["superseded_by"] = sup[f["record_id"]]
    return flags
