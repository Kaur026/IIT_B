# simulate_fair.py - FAIR comparison: same overall action chance, only timing differs
# SYNTHETIC and ILLUSTRATIVE. Does not prove any health impact.
import numpy as np
import pandas as pd

# ---- PLACEHOLDER ASSUMPTIONS (replace after field interviews) ----
WINDOW_DAYS = 30
P_ACT = 0.70                    # SAME in both workflows
SQ_MEAN_DELAY = 12              # status quo: typical wait in days
LADDER_STEPS = [0, 2, 5, 10]    # worker, supervisor, ANM/block, district
LADDER_LAG = 2                  # a person acts 0-2 days after the task reaches them
REF_DONE = 0.60                 # SAME in both: urgent referrals with outcome logged
N_RUNS = 200

# per-step chance so the ladder's total equals P_ACT
Q_STEP = 1 - (1 - P_ACT) ** (1 / len(LADDER_STEPS))

def sq_days(rng):
    if rng.random() >= P_ACT:
        return None
    while True:
        d = rng.exponential(SQ_MEAN_DELAY)
        if d <= WINDOW_DAYS:
            return int(round(d))

def ladder_days(rng):
    for start in LADDER_STEPS:
        if rng.random() < Q_STEP:
            return start + int(rng.integers(0, LADDER_LAG + 1))
    return None

def one_run(urgent_flags, seed):
    rng = np.random.default_rng(seed)
    n, n_urgent = len(urgent_flags), max(sum(urgent_flags), 1)
    rows = []
    for name, fn in [("status_quo", sq_days), ("ladder", ladder_days)]:
        days = [fn(rng) for _ in urgent_flags]
        got = [d for d in days if d is not None]
        ref_ok = sum(1 for d, u in zip(days, urgent_flags)
                     if d is not None and u and rng.random() < REF_DONE)
        rows.append({
            "workflow": name,
            "acted_pct": 100 * len(got) / n,
            "within_7d_pct": 100 * sum(d <= 7 for d in got) / n,
            "median_days": float(np.median(got)) if got else np.nan,
            "urgent_ref_pct": 100 * ref_ok / n_urgent,
        })
    return rows

if __name__ == "__main__":
    alerts = pd.read_csv("alerts.csv", parse_dates=["measurement_date"])
    latest = alerts.groupby("child_id").tail(1)
    flagged = latest[latest["alert_level"] != "none"]
    urgent_flags = (flagged["alert_level"] == "urgent").tolist()
    print(f"Flagged: {len(urgent_flags)} (urgent: {sum(urgent_flags)}) | runs: {N_RUNS}")
    print(f"Matched assumptions: P_ACT={P_ACT}, REF_DONE={REF_DONE}, ladder step chance={Q_STEP:.2f}")

    res = pd.DataFrame([r for s in range(N_RUNS) for r in one_run(urgent_flags, s)])
    for metric in ["acted_pct", "within_7d_pct", "median_days", "urgent_ref_pct"]:
        print(f"\n{metric}")
        for wf in ["status_quo", "ladder"]:
            v = res[res["workflow"] == wf][metric]
            print(f"  {wf:11s} median {v.median():5.1f}   (5th-95th: {v.quantile(.05):.1f} to {v.quantile(.95):.1f})")