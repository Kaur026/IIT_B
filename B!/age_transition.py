"""BE1 - age-transition due-date logic and reminder list (Feature 6).

DISABLED by default: the age bands and service names are unverified. The list is only
produced with demo_mode=True and every item is labelled DEMO ONLY / UNVERIFIED.
All dates derive from the single configurable reporting date.
"""
import calendar
from datetime import date, timedelta

from .dataio import to_date, to_float

DEMO_LABEL = "DEMO ONLY - age bands and service names UNVERIFIED"


def add_months(d, months):
    y, m = divmod(d.month - 1 + months, 12)
    y += d.year
    m += 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def age_in_months(dob, on):
    months = (on.year - dob.year) * 12 + on.month - dob.month
    return months - (1 if on.day < dob.day else 0)


def transition_events(beneficiaries, bands):
    """For each child, the date they reach the start of each later band."""
    ordered = sorted(bands, key=lambda b: to_float(b["min_months"]))
    for b in beneficiaries:
        if b["category"] != "child" or b.get("possible_duplicate_of"):
            continue
        dob = to_date(b["date_of_birth"])
        if dob is None:
            continue
        for prev, nxt in zip(ordered, ordered[1:]):
            yield b, prev, nxt, add_months(dob, int(to_float(nxt["min_months"])))


def reminder_list(beneficiaries, bands, cfg, demo_mode=False):
    rule = cfg["rules"]["AGE_TRANSITION"]
    rep = date.fromisoformat(cfg["reporting_date"])
    if not rule.get("enabled") and not demo_mode:
        return {"enabled": False, "label": DEMO_LABEL, "items": [],
                "notice": "Age-transition rule is disabled until age bands and service names are verified."}
    lead = rule["params"]["reminder_lead_days"]
    unverified = [b["band_id"] for b in bands if str(b.get("verified")).lower() != "true"]
    items = []
    for b, prev, nxt, due in transition_events(beneficiaries, bands):
        days = (due - rep).days
        if -lead <= days <= lead:
            items.append({"beneficiary_id": b["beneficiary_id"], "centre_id": b["centre_id"],
                          "from_band": prev["label"], "to_band": nxt["label"],
                          "service_name": nxt["service_name"], "transition_date": due.isoformat(),
                          "days_until": days, "status": "overdue" if days < 0 else "upcoming",
                          "demo_only": True, "label": DEMO_LABEL})
    items.sort(key=lambda i: i["days_until"])
    return {"enabled": bool(rule.get("enabled")), "demo_only": True, "label": DEMO_LABEL,
            "reporting_date": rep.isoformat(), "unverified_bands": unverified,
            "rule_version": rule["version"], "rule_status": rule["status"], "items": items}
