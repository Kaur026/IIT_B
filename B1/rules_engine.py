# rules_engine.py - F2 logic (BE1). SYNTHETIC prototype.
# evaluate_child(row) and evaluate_mother(row) are the shared functions everyone calls.
# Both return a dict:
#   colour      "RED" | "AMBER" | "GREEN" | "GREY" (GREY = cannot trust the reading, RECHECK)
#   reasons     list of {rule_id, text, flag, source, locked, value_seen, threshold}
#   confidence  "HIGH" | "MEDIUM" | "LOW"
#   confidence_note, issues (from data_checks), id, who
# All numbers come from thresholds.json (never typed into screen code).
import json
import os
import pandas as pd

import data_checks
import who_growth

HERE = os.path.dirname(os.path.abspath(__file__))
THRESHOLDS_PATH = os.environ.get("THRESHOLDS_PATH", os.path.join(HERE, "thresholds.json"))
COLOURS = ("RED", "AMBER", "GREEN", "GREY")
_cache = {"mtime": None, "path": None, "rules": None}


def load_rules(path=None):
    """Return {rule_id: rule}. Re-reads the file when it changes (so approved settings apply at once)."""
    path = path or THRESHOLDS_PATH
    m = os.path.getmtime(path)
    if _cache["path"] != path or _cache["mtime"] != m:
        with open(path) as f:
            data = json.load(f)
        _cache.update(path=path, mtime=m, rules={r["id"]: r for r in data["rules"]})
    return _cache["rules"]


def _num(v):
    return data_checks._num(v)


def _date(v):
    return data_checks._date(v)


def _reason(rule, text, seen, threshold):
    return {"rule_id": rule["id"], "text": text, "flag": rule["flag"], "source": rule["source"],
            "locked": rule["locked"], "value_seen": seen, "threshold": threshold}


def _yes(v):
    return str(v).strip().lower() in ("yes", "y", "true", "1", "present")


def _finish(kind, ident, reasons, confidence, notes, issues, invalid):
    if any(r["flag"] == "RED" for r in reasons):
        colour = "RED"
    elif any(r["flag"] == "AMBER" for r in reasons):
        colour = "AMBER"
    elif invalid:
        colour = "GREY"
    else:
        colour = "GREEN"
    if invalid and colour == "GREY":
        confidence = "LOW"
    elif invalid and confidence == "HIGH":
        confidence = "MEDIUM"
    reasons = sorted(reasons, key=lambda r: 0 if r["flag"] == "RED" else 1)
    return {"id": ident, "who": kind, "colour": colour, "reasons": reasons, "confidence": confidence,
            "confidence_note": "; ".join(notes) if notes else "All needed readings present and believable.",
            "issues": issues}


# ----------------------------------------------------------------------------- child
def evaluate_child(row, today=None, rules=None):
    R = rules or load_rules()
    today = pd.Timestamp(today) if today is not None else data_checks.REFERENCE_DATE
    check = data_checks.check_child(row, today)
    valid = check["measurement_valid"] and str(row.get("measurement_valid", True)).strip().lower() != "false"
    muac_bad = any(i["affects"] == "muac" for i in check["issues"])
    reasons, notes = [], []
    sex = str(row.get("sex", "")).strip().upper()
    age = _num(row.get("age_months"))
    w, h, muac = _num(row.get("weight_kg")), _num(row.get("height_cm")), _num(row.get("muac_mm"))
    enrolled = _yes(row.get("enrolled", "no"))

    if not valid:
        for i in check["issues"]:
            if i["affects"] == "anthro":
                notes.append("Reading not trusted: " + i["message"])
        if not check["measurement_valid"] is False and not notes:
            notes.append("Reading marked not valid: recheck.")

    # --- weight-based rules (only with a trusted weight/height)
    if valid and sex in ("M", "F") and age is not None:
        zwh = who_growth.weight_for_height_z(sex, int(age), w, h)
        zwa = who_growth.weight_for_age_z(sex, int(age), w)
        if zwh is None:
            notes.append("Height outside the WHO table, weight-for-height not worked out.")
        else:
            c1, c5 = R["C1"], R["C5"]
            if zwh < c1["value"]:
                reasons.append(_reason(c1, f"Weight-for-height is {zwh:.1f} SD (RED below {c1['value']} SD).", round(zwh, 2), c1["value"]))
            elif zwh < c5["value"]:
                reasons.append(_reason(c5, f"Weight-for-height is {zwh:.1f} SD (AMBER from {c1['value']} to {c5['value']} SD).", round(zwh, 2), c5["value"]))
        if zwa is not None:
            c6 = R["C6"]
            if zwa < c6["value"]:
                reasons.append(_reason(c6, f"Weight-for-age is {zwa:.1f} SD (AMBER below {c6['value']} SD).", round(zwa, 2), c6["value"]))

    # --- MUAC (6-59 months, only if recorded)
    if age is not None and 6 <= age <= 59:
        if muac is None:
            notes.append("MUAC not recorded.")
        elif muac_bad:
            notes.append("MUAC value not believable, ignored.")
        elif muac < R["C2"]["value"]:
            reasons.append(_reason(R["C2"], f"MUAC is {muac:g} mm (RED below {R['C2']['value']} mm).", muac, R["C2"]["value"]))

    # --- oedema and danger signs (do not depend on weight)
    if _yes(row.get("oedema", "no")):
        reasons.append(_reason(R["C3"], "Swelling of both feet (oedema) is present.", "yes", "present"))
    if _yes(row.get("danger_sign", "no")):
        reasons.append(_reason(R["C4"], "A danger sign is ticked.", "yes", "any"))

    # --- C7: weight loss / no gain two weeks in a row (enrolled children, weekly weights)
    if enrolled:
        p1, p2 = _num(row.get("weight_prev1_kg")), _num(row.get("weight_prev2_kg"))
        if valid and w is not None and p1 is not None and p2 is not None:
            if w <= p1 and p1 <= p2:
                reasons.append(_reason(R["C7"], f"No weight gain for 2 weeks in a row ({p2:g} -> {p1:g} -> {w:g} kg).", [p2, p1, w], 2))
        elif valid:
            notes.append("Last two weekly weights missing.")

    # --- C8: no valid measurement for more than 35 days
    d = _date(row.get("measurement_date"))
    last_valid = d if (valid and d is not None) else None
    c8 = R["C8"]
    if last_valid is None:
        # a reading that failed the data check is handled by GREY/Recheck, not by this rule,
        # unless its date shows it is already older than the limit
        if d is not None and (today - d).days > c8["value"]:
            reasons.append(_reason(c8, f"No valid measurement for {(today - d).days} days (limit {c8['value']} days).", (today - d).days, c8["value"]))
    else:
        age_days = (today - last_valid).days
        if age_days > c8["value"]:
            reasons.append(_reason(c8, f"Last valid measurement was {age_days} days ago (limit {c8['value']} days).", age_days, c8["value"]))

    # --- C9: home visit overdue (enrolled children): weekly in month 1, then every 2 weeks
    if enrolled:
        enr, last = _date(row.get("enrolment_date")), _date(row.get("last_visit_date"))
        c9 = R["C9"]
        if enr is not None:
            limit = c9["first_month_days"] if (today - enr).days <= 30 else c9["later_days"]
            since = (today - (last if last is not None else enr)).days
            if since > limit:
                reasons.append(_reason(c9, f"Home visit overdue: {since - limit} days past the {limit}-day schedule.", since - limit, limit))
        else:
            notes.append("Enrolment date missing, visit schedule not checked.")

    # --- C10: referral issued but not attended within 7 days
    if str(row.get("referral_status", "none")).strip().lower() == "issued":
        rd, c10 = _date(row.get("referral_date")), R["C10"]
        if rd is None:
            notes.append("Referral date missing.")
        elif (today - rd).days > c10["value"]:
            reasons.append(_reason(c10, f"Referral issued {(today - rd).days} days ago and not attended (limit {c10['value']} days).", (today - rd).days, c10["value"]))

    conf = "MEDIUM" if (notes and valid) else "HIGH"
    return _finish("child", row.get("child_id"), reasons, conf, notes, check["issues"], not valid)


# ----------------------------------------------------------------------------- mother
def evaluate_mother(row, rules=None):
    R = rules or load_rules()
    check = data_checks.check_mother(row)
    status = str(row.get("status", "")).strip().lower()
    bad = {i["affects"] for i in check["issues"]}
    reasons, notes = [], []
    for i in check["issues"]:
        notes.append("Not trusted: " + i["message"])
    hb, bmi = _num(row.get("hb_g_dl")), _num(row.get("bmi"))
    ht, gain, tri = _num(row.get("height_cm")), _num(row.get("weight_gain_kg_month")), _num(row.get("trimester"))
    ok = lambda f: f not in bad and "all" not in bad

    # Haemoglobin: M1 / M3 are RED, M2 is AMBER
    if ok("hb_g_dl"):
        if hb is None:
            notes.append("Haemoglobin not recorded.")
        elif status == "pregnant":
            m1, m2 = R["M1"], R["M2"]
            if hb < m1["value"]:
                reasons.append(_reason(m1, f"Haemoglobin is {hb:g} g/dL (RED below {m1['value']}, pregnant).", hb, m1["value"]))
            elif hb < m2["value"]:
                reasons.append(_reason(m2, f"Haemoglobin is {hb:g} g/dL (AMBER below {m2['value']}, pregnant).", hb, m2["value"]))
        elif status == "lactating":
            m3, m2 = R["M3"], R["M2"]
            cut = m2.get("value_lactating", m2["value"])
            if hb < m3["value"]:
                reasons.append(_reason(m3, f"Haemoglobin is {hb:g} g/dL (RED below {m3['value']}, lactating).", hb, m3["value"]))
            elif hb < cut:
                reasons.append(_reason(m2, f"Haemoglobin is {hb:g} g/dL (AMBER below {cut}, lactating).", hb, cut))

    # M4 BMI
    if ok("bmi"):
        m4 = R["M4"]
        if bmi is None:
            notes.append("BMI not recorded.")
        elif bmi < m4["red_value"]:
            r = _reason(m4, f"BMI is {bmi:g} (RED below {m4['red_value']}).", bmi, m4["red_value"])
            r["flag"] = "RED"
            reasons.append(r)
        elif bmi < m4["value"]:
            reasons.append(_reason(m4, f"BMI is {bmi:g} (AMBER below {m4['value']}).", bmi, m4["value"]))

    if status == "pregnant":
        if ok("height_cm") and ht is not None and ht < R["M5"]["value"]:
            reasons.append(_reason(R["M5"], f"Height is {ht:g} cm (below {R['M5']['value']} cm).", ht, R["M5"]["value"]))
        m6 = R["M6"]
        if tri is not None and tri >= 2:
            if gain is None:
                notes.append("Monthly weight gain not recorded.")
            elif ok("weight_gain_kg_month") and (gain < m6["low"] or gain > m6["high"]):
                reasons.append(_reason(m6, f"Weight gain is {gain:g} kg/month (expected {m6['low']} to {m6['high']}).", gain, f"{m6['low']} to {m6['high']}"))

    invalid = not check["values_valid"]
    return _finish("mother", row.get("mother_id"), reasons, "MEDIUM" if (notes and not invalid) else "HIGH", notes, check["issues"], invalid)


# ----------------------------------------------------------------------------- bulk helpers
def evaluate_children_df(df, today=None, rules=None):
    """Add colour, reasons_text, confidence, reason_ids columns to a children table."""
    out = df.copy()
    res = [evaluate_child(r, today, rules) for _, r in out.iterrows()]
    out["colour"] = [r["colour"] for r in res]
    out["confidence"] = [r["confidence"] for r in res]
    out["reason_ids"] = [",".join(x["rule_id"] for x in r["reasons"]) for r in res]
    out["reasons_text"] = [" | ".join(x["text"] for x in r["reasons"]) for r in res]
    return out


def evaluate_mothers_df(df, rules=None):
    out = df.copy()
    res = [evaluate_mother(r, rules) for _, r in out.iterrows()]
    out["colour"] = [r["colour"] for r in res]
    out["confidence"] = [r["confidence"] for r in res]
    out["reason_ids"] = [",".join(x["rule_id"] for x in r["reasons"]) for r in res]
    out["reasons_text"] = [" | ".join(x["text"] for x in r["reasons"]) for r in res]
    return out


def colour_counts(df_with_colour):
    c = df_with_colour["colour"].value_counts()
    return {k: int(c.get(k, 0)) for k in COLOURS}
