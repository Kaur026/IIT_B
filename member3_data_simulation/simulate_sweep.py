# simulate_sweep.py - change ONE assumption at a time (SYNTHETIC, ILLUSTRATIVE)
import pandas as pd
import simulate_fair as sf

DEFAULTS = {"P_ACT": 0.70, "SQ_MEAN_DELAY": 12, "LADDER_LAG": 2}
SWEEP = {"P_ACT": [0.5, 0.7, 0.9],
         "SQ_MEAN_DELAY": [6, 12, 18],
         "LADDER_LAG": [0, 2, 4]}

def run_with(settings, urgent_flags):
    sf.P_ACT = settings["P_ACT"]
    sf.SQ_MEAN_DELAY = settings["SQ_MEAN_DELAY"]
    sf.LADDER_LAG = settings["LADDER_LAG"]
    # ladder step chance must be recomputed so its total equals P_ACT
    sf.Q_STEP = 1 - (1 - sf.P_ACT) ** (1 / len(sf.LADDER_STEPS))
    res = pd.DataFrame([r for s in range(sf.N_RUNS)
                        for r in sf.one_run(urgent_flags, s)])
    sq = res[res["workflow"] == "status_quo"]
    ld = res[res["workflow"] == "ladder"]
    return {"sq_within7": sq["within_7d_pct"].median(),
            "ladder_within7": ld["within_7d_pct"].median(),
            "sq_median_days": sq["median_days"].median(),
            "ladder_median_days": ld["median_days"].median()}

if __name__ == "__main__":
    alerts = pd.read_csv("alerts.csv", parse_dates=["measurement_date"])
    latest = alerts.groupby("child_id").tail(1)
    flagged = latest[latest["alert_level"] != "none"]
    urgent_flags = (flagged["alert_level"] == "urgent").tolist()
    print(f"Flagged: {len(urgent_flags)} | runs per setting: {sf.N_RUNS}")

    rows = []
    for name, values in SWEEP.items():
        for v in values:
            settings = dict(DEFAULTS)
            settings[name] = v
            r = run_with(settings, urgent_flags)
            rows.append({"assumption": name, "value": v, **r,
                         "gap_within7": r["ladder_within7"] - r["sq_within7"]})
    out = pd.DataFrame(rows).round(1)
    out.to_csv("sweep_results.csv", index=False)
    print(out.to_string(index=False))