"""BE1 - unusual-change and growth-trend DATA checks (Feature 1).

These are data-quality checks on a dated series. They do not interpret growth and do
not diagnose. Growth interpretation (GROWTH_INTERPRETATION) stays disabled until
reference standards are verified.
"""
from collections import defaultdict

from .dataio import to_float, to_date

AVG_MONTH_DAYS = 30.4375


def _reading(m):
    return {"id": m["measurement_id"], "date": to_date(m["measured_on"]),
            "w": to_float(m["weight_value"]), "h": to_float(m["height_value"]), "row": m}


def build_series(measurements, excluded_ids):
    """Per-beneficiary series of usable readings (complete, not hard-flagged), date ordered."""
    s = defaultdict(list)
    for m in measurements:
        if m["measurement_id"] in excluded_ids:
            continue
        r = _reading(m)
        if r["date"] is None or r["w"] is None or r["h"] is None:
            continue
        s[m["beneficiary_id"]].append(r)
    for k in s:
        s[k].sort(key=lambda r: (r["date"], r["id"]))
    return s


def _change_problems(a, b, p):
    """Reasons that going from reading a to reading b is an unusual change."""
    gap = max((b["date"] - a["date"]).days, p["min_gap_days"])
    months = gap / AVG_MONTH_DAYS
    out = []
    dw, dh = b["w"] - a["w"], b["h"] - a["h"]
    if dw / months > p["max_weight_gain_kg_per_month"]:
        out.append(f"weight rose {dw:+.1f} kg in {gap} days ({dw / months:.1f} kg/month; limit {p['max_weight_gain_kg_per_month']})")
    if a["w"] > 0 and (-dw / a["w"] * 100) > p["max_weight_loss_pct"]:
        out.append(f"weight fell {-dw / a['w'] * 100:.0f}% (limit {p['max_weight_loss_pct']}%)")
    if -dh > p["height_decrease_tolerance_cm"]:
        out.append(f"height fell {-dh:.1f} cm (tolerance {p['height_decrease_tolerance_cm']} cm)")
    if dh / months > p["max_height_gain_cm_per_month"]:
        out.append(f"height rose {dh:+.1f} cm in {gap} days ({dh / months:.1f} cm/month; limit {p['max_height_gain_cm_per_month']})")
    return out


def unusual_change_flags(series, cfg, make_flag):
    rule = cfg["rules"]["UNUSUAL_CHANGE"]
    p = rule["params"]
    flags = []
    for bid, rows in series.items():
        ref = rows[0]
        for i in range(1, len(rows)):
            cur = rows[i]
            probs = _change_problems(ref, cur, p)
            if not probs:
                ref = cur
                continue
            nxt = rows[i + 1] if i + 1 < len(rows) else None
            flags.append(make_flag(
                cfg, "UNUSUAL_CHANGE", "measurements", cur["row"],
                "Change since previous reading is outside the configured range: " + "; ".join(probs)
                + ". Needs human verification (a flag is not a diagnosis).",
                {"previous_reading": {"measurement_id": ref["id"], "measured_on": ref["date"].isoformat(),
                                      "weight_kg": ref["w"], "height_cm": ref["h"]},
                 "this_reading": {"measurement_id": cur["id"], "measured_on": cur["date"].isoformat(),
                                  "weight_kg": cur["w"], "height_cm": cur["h"]},
                 "thresholds_used": p}))
            # spike (next reading is back in range of ref) -> keep ref; level shift -> move ref
            if nxt is not None and _change_problems(ref, nxt, p):
                ref = cur
    return flags


def growth_trend_flags(series, cfg, make_flag):
    rule = cfg["rules"]["GROWTH_TREND_DATA_CHECK"]
    p = rule["params"]
    n_flat = p["flat_weight_run_length"]
    flags = []
    for bid, rows in series.items():
        if len(rows) < p["min_points"]:
            continue
        run = 1
        for i in range(1, len(rows)):
            run = run + 1 if rows[i]["w"] == rows[i - 1]["w"] else 1
            if run == n_flat:      # flag once, on the reading that completes the run
                seg = rows[i - n_flat + 1:i + 1]
                flags.append(make_flag(
                    cfg, "GROWTH_TREND_DATA_CHECK", "measurements", rows[i]["row"],
                    f"{n_flat} consecutive readings have the identical weight ({rows[i]['w']} kg), "
                    "which can indicate copied values. Needs human verification; not a growth interpretation.",
                    {"readings": [{"measurement_id": r["id"], "measured_on": r["date"].isoformat(),
                                   "weight_kg": r["w"]} for r in seg],
                     "thresholds_used": p}))
    return flags


def run_trend_checks(measurements, excluded_ids, cfg):
    from .rules_engine import make_flag, rule_active
    series = build_series(measurements, excluded_ids)
    flags = []
    if rule_active(cfg, "UNUSUAL_CHANGE"):
        flags += unusual_change_flags(series, cfg, make_flag)
    if rule_active(cfg, "GROWTH_TREND_DATA_CHECK"):
        flags += growth_trend_flags(series, cfg, make_flag)
    return flags
