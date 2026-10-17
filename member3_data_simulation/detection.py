# detection.py - flags children whose weight is flat or falling
import pandas as pd
from validation import add_validation_status

WATCH_GAIN = 0.0     # proposed, to be verified
URGENT_GAIN = -1.0   # proposed, to be verified

def add_alerts(m):
    m = add_validation_status(m)
    m = m.sort_values(["child_id", "measurement_date"], kind="mergesort")
    valid = m[m["usable_for_detection"]].copy()
    prev = valid.groupby("child_id")["weight_kg"].shift(2)
    prev_date = valid.groupby("child_id")["measurement_date"].shift(2)
    # Compare each row with its second preceding valid reading. The interval
    # can vary when readings are missing or invalid. gain_2m stays for compatibility.
    valid["gain_2m"] = valid["weight_kg"] - prev
    valid["comparison_days"] = (valid["measurement_date"] - prev_date).dt.days
    valid["alert_level"] = "none"
    valid.loc[valid["gain_2m"] <= WATCH_GAIN, "alert_level"] = "watch"
    valid.loc[valid["gain_2m"] <= URGENT_GAIN, "alert_level"] = "urgent"
    return valid

if __name__ == "__main__":
    m = pd.read_csv("measurements.csv", parse_dates=["measurement_date"])
    v = add_alerts(m)
    v.to_csv("alerts.csv", index=False)
    latest = v.groupby("child_id").tail(1)   # newest valid reading per child
    print(pd.crosstab(latest["faltering_truth"], latest["alert_level"]))
