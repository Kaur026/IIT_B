# validation.py - checks each reading WITHOUT looking at the answer key
import pandas as pd

# Fixed dataset reference date for reproducible validation of planted future dates.
# This is intentionally not the machine's current date.
REFERENCE_DATE = pd.Timestamp("2026-10-15")
TODAY = REFERENCE_DATE  # compatibility alias for existing callers
HANDOFF_MEASUREMENT_COLUMNS = (
    "child_id",
    "age_months",
    "measurement_date",
    "weight_kg",
    "height_cm",
)


def duplicate_measurement_mask(m):
    """Return True for every row sharing a child ID and measurement date."""
    return m.duplicated(subset=["child_id", "measurement_date"], keep=False)


def validate_handoff_measurements(m):
    """Reject answer keys and any schema other than the approved five columns."""
    hidden = {"faltering_truth", "error_truth"}.intersection(m.columns)
    if hidden:
        raise ValueError(f"Hidden ground-truth columns cannot be handed off: {sorted(hidden)}")
    if tuple(m.columns) != HANDOFF_MEASUREMENT_COLUMNS:
        raise ValueError(
            "Handoff measurements must contain exactly these columns in order: "
            f"{list(HANDOFF_MEASUREMENT_COLUMNS)}"
        )
    return m

def check_reading(row):
    """Check one reading's fields; duplicate status is evaluated separately."""
    if pd.isna(row["weight_kg"]):
        return "missing_weight"
    if row["measurement_date"] > REFERENCE_DATE:
        return "future_date"
    if row["height_cm"] < 40:
        return "swapped"
    if row["weight_kg"] > 30:
        return "decimal_slip"
    return "ok"


def add_validation_status(m):
    """Add row-quality, duplicate, and final detection-usability results."""
    m = m.copy()
    m["validation_flag"] = m.apply(check_reading, axis=1)
    m["duplicate_date"] = duplicate_measurement_mask(m)
    m["usable_for_detection"] = (
        (m["validation_flag"] == "ok") & ~m["duplicate_date"]
    )
    # Keep the prior output name, but make it represent final usability.
    m["measurement_valid"] = m["usable_for_detection"]
    return m


if __name__ == "__main__":
    m = pd.read_csv("measurements.csv", parse_dates=["measurement_date"])
    m = add_validation_status(m)
    print(pd.crosstab(m["error_truth"], m["validation_flag"]))
    print("Usable for detection:", int(m["usable_for_detection"].sum()), "/", len(m))
