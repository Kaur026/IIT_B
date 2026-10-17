# alert_report.py - lists which children are urgent / watch (IDs only)
import pandas as pd


ALERT_LIST_COLUMNS = [
    "child_id",
    "alert_level",
    "age_months",
    "sex",
    "weight_kg",
    "weight_gain",
    "weight_loss",
    "comparison_days",
    "assigned_worker_id",
]


def build_alert_list(alerts, children):
    """Build the handoff alert list with each weight change's actual interval."""
    latest = alerts.sort_values(
        ["child_id", "measurement_date"], kind="mergesort"
    ).groupby("child_id").tail(1)
    flagged = latest[latest["alert_level"] != "none"]
    flagged = flagged.merge(
        children[["child_id", "sex", "assigned_worker_id"]], on="child_id"
    )
    flagged = flagged.sort_values(
        ["alert_level", "gain_2m"], kind="mergesort"
    ).copy()
    flagged["gain_2m"] = flagged["gain_2m"].round(2)
    flagged["weight_gain"] = flagged["gain_2m"].clip(lower=0)
    flagged["weight_loss"] = (-flagged["gain_2m"]).clip(lower=0)
    return flagged[ALERT_LIST_COLUMNS]


def main():
    alerts = pd.read_csv("alerts.csv", parse_dates=["measurement_date"])
    children = pd.read_csv("children.csv")
    flagged = build_alert_list(alerts, children)
    flagged.to_csv("alert_list.csv", index=False)

    print("URGENT:", (flagged["alert_level"] == "urgent").sum(),
          "| WATCH:", (flagged["alert_level"] == "watch").sum())
    print("\n--- URGENT children ---")
    print(flagged[flagged["alert_level"] == "urgent"].to_string(index=False))
    print("\n--- WATCH children (first 10; full list in alert_list.csv) ---")
    print(flagged[flagged["alert_level"] == "watch"].head(10).to_string(index=False))


if __name__ == "__main__":
    main()
