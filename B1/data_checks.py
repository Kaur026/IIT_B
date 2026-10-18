# data_checks.py - F3 data trust check (BE1). SYNTHETIC prototype.
# Checks a child's or mother's reading BEFORE the rules engine trusts it.
# Frontend (FE1) shows the 'message' and 'suggestion' texts and the Recheck flow.
import math
import pandas as pd
import who_growth

REFERENCE_DATE = pd.Timestamp("2026-10-15")   # dataset 'today' (BE2's demo clock can pass another date)

# Plausible ranges (fixed safety limits, not clinical thresholds)
WEIGHT_RANGE = (1.5, 30.0)      # kg
HEIGHT_RANGE = (40.0, 125.0)    # cm
MUAC_RANGE = (60, 200)          # mm
WFH_Z_LIMIT = 5.0               # WHO: |weight-for-height z| above 5 is not believable
WFA_Z_LOW, WFA_Z_HIGH = -6.0, 5.0

MOTHER_RANGES = {
    "hb_g_dl": (3.0, 18.0),
    "bmi": (11.0, 45.0),
    "height_cm": (120.0, 190.0),
    "muac_cm": (15.0, 40.0),
    "weight_gain_kg_month": (-5.0, 10.0),
}


def _num(v):
    """Return float or None (handles blank, NaN, text)."""
    try:
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return None
        f = float(v)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _date(v):
    try:
        d = pd.to_datetime(v)
        return None if pd.isna(d) else d
    except Exception:
        return None


def _issue(code, message, suggestion="", affects="anthro"):
    return {"code": code, "message": message, "suggestion": suggestion, "affects": affects}


def check_child(row, today=None):
    """Check one child row.
    Returns {"ok": bool, "issues": [...], "measurement_valid": bool}.
    ok / measurement_valid = False means weight/height cannot be trusted (RECHECK needed).
    An issue with affects='muac' only distrusts the MUAC value."""
    today = pd.Timestamp(today) if today is not None else REFERENCE_DATE
    issues = []
    w, h = _num(row.get("weight_kg")), _num(row.get("height_cm"))
    muac = _num(row.get("muac_mm"))
    age = _num(row.get("age_months"))
    d = _date(row.get("measurement_date"))
    sex = str(row.get("sex", "")).strip().upper()

    if sex not in ("M", "F"):
        issues.append(_issue("bad_sex", "Sex is missing or not M/F.", "Fill in the child's sex."))
    if age is None or not (0 <= age <= 59):
        issues.append(_issue("bad_age", "Age is missing or outside 0-59 months.", "Check the date of birth."))
    if d is None:
        issues.append(_issue("missing_date", "Measurement date is missing.", "Enter the date of measurement."))
    elif d > today:
        issues.append(_issue("future_date", f"Measurement date {d.date()} is in the future.", "Correct the date."))

    if w is None:
        issues.append(_issue("missing_weight", "Weight is missing.", "Weigh the child again."))
    if h is None:
        issues.append(_issue("missing_height", "Height is missing.", "Measure the child's height again."))

    if w is not None and h is not None and h < HEIGHT_RANGE[0] and w > HEIGHT_RANGE[0]:
        issues.append(_issue("swapped", f"Weight ({w:g}) and height ({h:g}) look swapped.",
                             f"Try weight {h:g} kg and height {w:g} cm."))
    else:
        if w is not None and w > WEIGHT_RANGE[1]:
            fix = round(w / 10, 2)
            sug = f"Did you mean {fix:g} kg?" if WEIGHT_RANGE[0] <= fix <= WEIGHT_RANGE[1] else "Weigh the child again."
            issues.append(_issue("decimal_slip", f"Weight {w:g} kg is too high for a child under five.", sug))
        elif w is not None and w < WEIGHT_RANGE[0]:
            issues.append(_issue("weight_too_low", f"Weight {w:g} kg is too low to be believed.", "Weigh the child again."))
        if h is not None and not (HEIGHT_RANGE[0] <= h <= HEIGHT_RANGE[1]):
            issues.append(_issue("height_out_of_range", f"Height {h:g} cm is outside {HEIGHT_RANGE[0]:g}-{HEIGHT_RANGE[1]:g} cm.",
                                 "Measure the child's height again."))

    # Z-score sanity (only if basic checks passed so far)
    if not issues and sex in ("M", "F") and age is not None:
        zwh = who_growth.weight_for_height_z(sex, int(age), w, h)
        zwa = who_growth.weight_for_age_z(sex, int(age), w)
        if zwh is not None and abs(zwh) > WFH_Z_LIMIT:
            issues.append(_issue("implausible_wfh", f"Weight-for-height is {zwh:+.1f} SD - not believable.",
                                 "Check the weight and height, then measure again."))
        elif zwa is not None and not (WFA_Z_LOW <= zwa <= WFA_Z_HIGH):
            issues.append(_issue("implausible_wfa", f"Weight-for-age is {zwa:+.1f} SD - not believable.",
                                 "Check the weight and age, then measure again."))

    if muac is not None and not (MUAC_RANGE[0] <= muac <= MUAC_RANGE[1]):
        issues.append(_issue("muac_implausible", f"MUAC {muac:g} mm is outside {MUAC_RANGE[0]}-{MUAC_RANGE[1]} mm.",
                             "Measure MUAC again.", affects="muac"))

    anthro_ok = not any(i["affects"] == "anthro" for i in issues)
    return {"ok": not issues, "measurement_valid": anthro_ok, "issues": issues}


def check_mother(row):
    """Check one mother row. Returns {"ok", "values_valid", "issues"} (issues name the bad field in 'field')."""
    issues = []
    status = str(row.get("status", "")).strip().lower()
    if status not in ("pregnant", "lactating"):
        issues.append(_issue("bad_status", "Status must be pregnant or lactating.", "Fix the status.", affects="all"))
    tri = _num(row.get("trimester"))
    if status == "pregnant" and (tri is None or tri not in (1, 2, 3)):
        issues.append(_issue("bad_trimester", "Pregnant mother needs trimester 1, 2 or 3.", "Fill in the trimester.", affects="all"))
    for field, (lo, hi) in MOTHER_RANGES.items():
        v = _num(row.get(field))
        if v is None:
            continue   # blank is allowed (lowers confidence in the engine), only bad values are errors
        if not (lo <= v <= hi):
            i = _issue("mother_value_out_of_range", f"{field} = {v:g} is outside {lo:g}-{hi:g}.", "Measure or enter it again.", affects=field)
            i["field"] = field
            issues.append(i)
    return {"ok": not issues, "values_valid": not any(i["affects"] == "all" for i in issues), "issues": issues}


def check_children_df(df, today=None):
    """Add measurement_valid (bool) and check_issues (text) columns to a children table.
    Also catches repeated child_id rows."""
    df = df.copy()
    valid, texts = [], []
    for _, r in df.iterrows():
        res = check_child(r, today)
        valid.append(res["measurement_valid"])
        texts.append("; ".join(i["code"] for i in res["issues"]))
    df["measurement_valid"] = valid
    df["check_issues"] = texts
    dup = df.duplicated(subset=["child_id"], keep=False)
    df.loc[dup, "measurement_valid"] = False
    df.loc[dup, "check_issues"] = (df.loc[dup, "check_issues"] + "; duplicate_child_id").str.strip("; ")
    return df


def trust_summary(df, today=None):
    """Counts for the supervisor: how many readings are trusted and which problems are most common."""
    checked = check_children_df(df, today)
    codes = checked["check_issues"].str.split("; ").explode()
    codes = codes[codes.notna() & (codes != "")]
    return {
        "total": int(len(checked)),
        "trusted": int(checked["measurement_valid"].sum()),
        "need_recheck": int((~checked["measurement_valid"]).sum()),
        "by_problem": {k: int(v) for k, v in codes.value_counts().items()},
    }


def recheck_child(row, new_weight_kg=None, new_height_cm=None, new_muac_mm=None, new_date=None, today=None):
    """Recheck flow (FE1 button): apply a fresh measurement, re-run the check and the rules.
    Returns {"row", "check", "before", "after", "changed"} - 'before'/'after' are rules-engine results."""
    import rules_engine   # local import: rules_engine imports this file too
    before = rules_engine.evaluate_child(row, today)
    new = dict(row)
    if new_weight_kg is not None:
        new["weight_kg"] = new_weight_kg
    if new_height_cm is not None:
        new["height_cm"] = new_height_cm
    if new_muac_mm is not None:
        new["muac_mm"] = new_muac_mm
    new["measurement_date"] = str(pd.Timestamp(new_date if new_date is not None else (today or REFERENCE_DATE)).date())
    res = check_child(new, today)
    new["measurement_valid"] = res["measurement_valid"]
    after = rules_engine.evaluate_child(new, today)
    return {"row": new, "check": res, "before": before, "after": after,
            "changed": before["colour"] != after["colour"]}
