"""BE1 - centre flag rates and review trends, with denominators and sample sizes (Step 8).

"Flag rate" = share of a centre's readings that were flagged for human verification.
A flag is not proof of worker error, so this is a review-workload signal, not a score.
Small samples are marked instead of showing a misleading rate.
"""
from collections import defaultdict
from datetime import date, timedelta
from statistics import median

from .dataio import to_date

MIN_SAMPLE_WINDOW = 30      # readings in the window before a centre rate is shown
MIN_SAMPLE_MONTH = 10


def month_key(d):
    return f"{d.year}-{d.month:02d}"


def last_months(rep, n):
    out, y, m = [], rep.year, rep.month
    for _ in range(n):
        out.append(f"{y}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(out))


def centre_flag_rates(measurements, flags, rep, months=6):
    """Per centre: window totals plus a monthly series. Denominator = original readings."""
    keys = last_months(rep, months)
    flagged_ids = {f["record_id"] for f in flags if f["dataset"] == "measurements"}
    tot, bad = defaultdict(lambda: defaultdict(int)), defaultdict(lambda: defaultdict(int))
    for m in measurements:
        d = to_date(m["measured_on"])
        if d is None or m.get("supersedes_id"):
            continue
        mk = month_key(d)
        if mk not in keys:
            continue
        c = m["centre_id"]
        tot[c][mk] += 1
        if m["measurement_id"] in flagged_ids:
            bad[c][mk] += 1
    out = {}
    for c in sorted(tot):
        n_all, n_bad = sum(tot[c].values()), sum(bad[c].values())
        series = []
        for k in keys:
            n, b = tot[c].get(k, 0), bad[c].get(k, 0)
            series.append({"month": k, "readings": n, "flagged": b,
                           "flag_rate": round(b / n, 4) if n >= MIN_SAMPLE_MONTH else None,
                           "sample_note": None if n >= MIN_SAMPLE_MONTH else f"sample {n} < {MIN_SAMPLE_MONTH}"})
        out[c] = {"centre_id": c, "readings": n_all, "flagged": n_bad,
                  "flag_rate": round(n_bad / n_all, 4) if n_all >= MIN_SAMPLE_WINDOW else None,
                  "sample_note": None if n_all >= MIN_SAMPLE_WINDOW else f"sample {n_all} < {MIN_SAMPLE_WINDOW}",
                  "denominator": "original readings in window", "monthly": series}
    return out


def review_trends(review_history, rep, months=6):
    """Per centre, per month reviewed: count and median days from flag to review."""
    keys = last_months(rep, months)
    d = defaultdict(lambda: defaultdict(list))
    pending = defaultdict(int)
    for r in review_history:
        c = r["centre_id"]
        if not r.get("reviewed_on"):
            pending[c] += 1
            continue
        rv, fl = to_date(r["reviewed_on"]), to_date(r["flagged_on"])
        mk = month_key(rv)
        if mk in keys:
            d[c][mk].append((rv - fl).days)
    out = {}
    for c in sorted(set(d) | set(pending)):
        out[c] = {"centre_id": c, "pending_reviews": pending[c],
                  "monthly": [{"month": k, "reviews_completed": len(d[c].get(k, [])),
                               "median_days_to_review": median(d[c][k]) if d[c].get(k) else None}
                              for k in keys]}
    return out


def ranked_centres(rates):
    """Centres with a shown rate, highest first."""
    return sorted((v for v in rates.values() if v["flag_rate"] is not None),
                  key=lambda v: (-v["flag_rate"], v["centre_id"]))
