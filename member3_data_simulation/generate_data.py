# generate_data.py - step 1: make fake children (NO real data)
import numpy as np
import pandas as pd

SEED = 42
rng = np.random.default_rng(SEED)   # fixed seed: same data every run for this generator version

N_CHILDREN = 1000
N_WORKERS = 25

def make_children():
    workers = [f"W{i:02d}" for i in range(1, N_WORKERS + 1)]
    return pd.DataFrame({
        "child_id": [f"C{i:04d}" for i in range(1, N_CHILDREN + 1)],
        "sex": rng.choice(["M", "F"], size=N_CHILDREN),
        "age_months": rng.integers(0, 60, size=N_CHILDREN),
        "assigned_worker_id": rng.choice(workers, size=N_CHILDREN),
    })

MONTHS = 6
START_DATE = pd.Timestamp("2026-04-15")
FALTERING_SHARE = 0.12   # assumption

# Approximate median values at these ages (months). Verify vs WHO tables.
AGES = [0, 6, 12, 24, 36, 48, 60]
WEIGHT_MEDIAN = {"M": [3.3, 7.9, 9.6, 12.2, 14.3, 16.3, 18.3],
                 "F": [3.2, 7.3, 8.9, 11.5, 13.9, 16.1, 18.2]}
HEIGHT_MEDIAN = {"M": [49.9, 67.6, 75.7, 87.1, 96.1, 103.3, 110.0],
                 "F": [49.1, 65.7, 74.0, 85.7, 95.1, 102.7, 109.4]}

def make_measurements(children):
    rows = []
    for _, c in children.iterrows():
        z = rng.normal(0, 1)                      # this child's natural size
        faltering = rng.random() < FALTERING_SHARE
        rate = 0.05 if (faltering and rng.random() < 0.25) else 0.02
        for m in range(MONTHS):
            age = c["age_months"] + m
            # Under-five analysis excludes readings from age 60 onward.
            # Stopping here changes how many values the shared RNG consumes,
            # so later children will not match the previous generator version.
            if age >= 60:
                break
            w_med = np.interp(age, AGES, WEIGHT_MEDIAN[c["sex"]])
            h_med = np.interp(age, AGES, HEIGHT_MEDIAN[c["sex"]])
            weight = w_med * (1 + 0.11 * z) + rng.normal(0, 0.1)
            if faltering:
                    weight *= 1 - rate * max(0, m - 1)   # slowing gain# slowing gain
            height = h_med * (1 + 0.04 * z) + rng.normal(0, 0.3)
            rows.append({
                "child_id": c["child_id"],
                "age_months": age,
                "measurement_date": START_DATE + pd.Timedelta(days=30 * m),
                "weight_kg": round(weight, 2),
                "height_cm": round(height, 1),
                "faltering_truth": "faltering" if faltering else "healthy",
            })
    return pd.DataFrame(rows)

ERROR_SHARE = 0.08   # assumption: 8% of readings have a recording error

def plant_errors(m):
    m = m.copy()
    m["error_truth"] = "none"
    n_bad = int(len(m) * ERROR_SHARE)
    bad_rows = rng.choice(m.index, size=n_bad, replace=False)
    kinds = rng.choice(
        ["decimal_slip", "swapped", "future_date", "missing_weight"],
        size=n_bad)
    for i, kind in zip(bad_rows, kinds):
        if kind == "decimal_slip":
            m.loc[i, "weight_kg"] = round(m.loc[i, "weight_kg"] * 10, 2)
        elif kind == "swapped":
            w, h = m.loc[i, "weight_kg"], m.loc[i, "height_cm"]
            m.loc[i, "weight_kg"], m.loc[i, "height_cm"] = h, w
        elif kind == "future_date":
            m.loc[i, "measurement_date"] = pd.Timestamp("2027-06-01")
        else:
            m.loc[i, "weight_kg"] = np.nan
        m.loc[i, "error_truth"] = kind
    return m

if __name__ == "__main__":
    children = make_children()
    children.to_csv("children.csv", index=False)
    measurements = make_measurements(children)
    measurements = plant_errors(measurements)
    measurements.to_csv("measurements.csv", index=False)
    print(children.shape, measurements.shape)
    print(measurements.head(8))
    print(measurements["error_truth"].value_counts())
