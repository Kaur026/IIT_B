# simulate.py - status quo vs escalation ladder (SYNTHETIC, ILLUSTRATIVE)
import numpy as np
import pandas as pd

rng = np.random.default_rng(7)

# ---- PLACEHOLDER ASSUMPTIONS: replace after field interviews ----
WINDOW_DAYS = 30            # we watch each flag for 30 days
SQ_ACT_PROB = 0.50          # status quo: chance a flag is ever noticed
SQ_MEAN_DELAY = 12          # status quo: average days until action
SQ_REFERRAL_DONE = 0.40     # status quo: urgent referrals with outcome logged
LADDER = [("worker", 0, 0.50), ("supervisor", 2, 0.60),
          ("ANM_block", 5, 0.60), ("district", 10, 0.70)]  # (who, day, chance they act)
LADDER_LAG = 2              # a person acts 0-2 days after the task reaches them
LADDER_REFERRAL_DONE = 0.75 # ladder: referrals tracked, so more get logged

def status_quo_days():
    if rng.random() < SQ_ACT_PROB:
        d = rng.exponential(SQ_MEAN_DELAY)
        if d <= WINDOW_DAYS:
            return int(round(d))
    return None

def ladder_days():
    for who, start, p in LADDER:
        if rng.random() < p:
            return start + int(rng.integers(0, LADDER_LAG + 1)), who
    return None, None

alerts = pd.read_csv("alerts.csv", parse_dates=["measurement_date"])
children = pd.read_csv("children.csv")[["child_id", "assigned_worker_id"]]
latest = alerts.groupby("child_id").tail(1)
flagged = latest[latest["alert_level"] != "none"]
flagged = flagged[["child_id", "alert_level", "measurement_date"]]
flagged = flagged.rename(columns={"measurement_date": "flag_date"})
flagged = flagged.merge(children, on="child_id").reset_index(drop=True)

tasks, sq_days, sq_ref = [], [], 0
n_urgent = 0
for _, r in flagged.iterrows():
    urgent = r["alert_level"] == "urgent"
    n_urgent += urgent
    sq = status_quo_days()                     # --- status quo ---
    if sq is not None:
        sq_days.append(sq)
        if urgent and rng.random() < SQ_REFERRAL_DONE:
            sq_ref += 1
    days, who = ladder_days()                  # --- our ladder ---
    if days is None:
        ref, status, action_date = "none" if urgent else "not_needed", "open", pd.NaT
    else:
        action_date = r["flag_date"] + pd.Timedelta(days=days)
        if not urgent:
            ref, status = "not_needed", "closed"
        elif rng.random() < LADDER_REFERRAL_DONE:
            ref, status = "outcome_logged", "closed"
        else:
            ref = "issued"
            status = "acknowledged" if who == "worker" else "escalated"
    tasks.append({"child_id": r["child_id"], "assigned_worker_id": r["assigned_worker_id"],
                  "alert_level": r["alert_level"], "flag_date": r["flag_date"].date(),
                  "action_date": action_date, "acted_by": who,
                  "task_status": status, "referral_status": ref,
                  "days_to_action": days})

t = pd.DataFrame(tasks)
t.to_csv("tasks.csv", index=False)

n = len(t)
print(f"Flagged children: {n} (urgent: {n_urgent})")
print(f"STATUS QUO: acted {len(sq_days)}/{n} | median days {np.median(sq_days)}"
      f" | urgent referrals logged {sq_ref}/{n_urgent}")
lad = t["days_to_action"].dropna()
lad_ref = (t["referral_status"] == "outcome_logged").sum()
print(f"LADDER:     acted {len(lad)}/{n} | median days {lad.median()}"
      f" | urgent referrals logged {lad_ref}/{n_urgent}")
print(t["task_status"].value_counts().to_string())