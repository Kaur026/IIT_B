# build_data.py - makes the SYNTHETIC children.csv, mothers.csv, family_links.csv, test_children.csv, child_a.json
# Run once (fixed seed, same output every time). After Step 11 the data is FROZEN - do not re-run.
import json
import numpy as np
import pandas as pd
import who_growth

SEED = 2026
rng = np.random.default_rng(SEED)
TODAY = pd.Timestamp("2026-10-15")
N_CHILDREN, N_MOTHERS, N_WORKERS = 1000, 600, 25
CHILD_A, MOTHER_A = "C0001", "M0001"

CHILD_COLS = ["child_id", "sex", "age_months", "measurement_date", "weight_kg", "height_cm", "muac_mm", "oedema",
              "measurement_valid", "referral_status", "assigned_worker_id", "task_status",
              # extra fields asked for by the screens (Step 2)
              "enrolled", "enrolment_date", "last_visit_date", "referral_date", "danger_sign",
              "weight_prev1_kg", "weight_prev2_kg"]
MOTHER_COLS = ["mother_id", "status", "trimester", "hb_g_dl", "bmi", "height_cm", "muac_cm", "weight_gain_kg_month"]

AGES = [0, 6, 12, 24, 36, 48, 60]
HMED = {"M": [49.9, 67.6, 75.7, 87.1, 96.1, 103.3, 110.0], "F": [49.1, 65.7, 74.0, 85.7, 95.1, 102.7, 109.4]}


def d(x):
    return str(pd.Timestamp(x).date())


def make_child(i):
    sex = rng.choice(["M", "F"])
    age = int(rng.integers(0, 60))
    hmin, hmax = who_growth.height_range(age)
    h = np.interp(age, AGES, HMED[sex]) * (1 + 0.04 * rng.normal(0, 1)) + rng.normal(0, 0.3)
    h = round(float(np.clip(h, hmin + 1, hmax - 1)), 1)
    u = rng.random()
    zt = rng.uniform(-3.9, -3.05) if u < 0.05 else rng.uniform(-2.95, -2.05) if u < 0.17 else float(np.clip(rng.normal(-0.4, 0.85), -1.95, 2.5))
    w = round(who_growth.weight_for_height_value(sex, age, h, zt), 2)
    muac = None
    if age >= 6 and rng.random() > 0.10:
        muac = int(round(150 + 12 * zt + rng.normal(0, 4)))
    oedema = "yes" if rng.random() < 0.015 else "no"
    danger = "yes" if rng.random() < 0.02 else "no"
    delay = int(rng.choice(range(0, 30))) if rng.random() < 0.94 else int(rng.integers(36, 70))
    mdate = TODAY - pd.Timedelta(days=delay)
    enrolled = "yes" if (zt < -2 or oedema == "yes") and rng.random() < 0.75 else "no"
    row = dict(child_id=f"C{i:04d}", sex=sex, age_months=age, measurement_date=d(mdate), weight_kg=w, height_cm=h,
               muac_mm=muac, oedema=oedema, measurement_valid=True, referral_status="none",
               assigned_worker_id=f"W{int(rng.integers(1, N_WORKERS + 1)):02d}", task_status="none",
               enrolled=enrolled, enrolment_date=None, last_visit_date=None, referral_date=None, danger_sign=danger,
               weight_prev1_kg=None, weight_prev2_kg=None)
    if enrolled == "yes":
        enr = TODAY - pd.Timedelta(days=int(rng.integers(5, 150)))
        row["enrolment_date"] = d(enr)
        lim = 7 if (TODAY - enr).days <= 30 else 14
        gap = int(rng.integers(0, lim + 1)) if rng.random() < 0.8 else lim + int(rng.integers(1, 10))
        row["last_visit_date"] = d(max(enr, TODAY - pd.Timedelta(days=gap)))
        if rng.random() < 0.25:     # faltering: no gain two weeks in a row
            p1 = round(w + rng.uniform(0, 0.15), 2)
            p2 = round(p1 + rng.uniform(0, 0.15), 2)
        else:
            p1 = round(w - rng.uniform(0.05, 0.25), 2)
            p2 = round(p1 - rng.uniform(0.05, 0.2), 2)
        row["weight_prev1_kg"], row["weight_prev2_kg"] = p1, p2
    if zt < -3 or oedema == "yes" or (muac is not None and muac < 115):
        r = rng.random()
        if r < 0.6:
            row["referral_status"] = str(rng.choice(["issued", "attended", "outcome_logged"], p=[0.5, 0.25, 0.25]))
            row["referral_date"] = d(TODAY - pd.Timedelta(days=int(rng.integers(1, 15))))
    return row


def plant_errors(df):
    """About 3% of readings get a typical recording mistake (so the data trust check has work to do)."""
    df = df.copy()
    idx = rng.choice(df.index[1:], size=int(len(df) * 0.03), replace=False)   # never touch Child A (row 0)
    for n, i in enumerate(idx):
        kind = ["decimal_slip", "swapped", "future_date", "missing_weight", "height_slip"][n % 5]
        if kind == "decimal_slip":
            df.loc[i, "weight_kg"] = round(df.loc[i, "weight_kg"] * 10, 2)
        elif kind == "swapped":
            w, h = df.loc[i, "weight_kg"], df.loc[i, "height_cm"]
            df.loc[i, "weight_kg"], df.loc[i, "height_cm"] = h, w
        elif kind == "future_date":
            df.loc[i, "measurement_date"] = "2027-06-01"
        elif kind == "missing_weight":
            df.loc[i, "weight_kg"] = np.nan
        else:
            df.loc[i, "height_cm"] = round(df.loc[i, "height_cm"] / 10, 1)
    return df


def make_children():
    rows = [make_child(i) for i in range(2, N_CHILDREN + 1)]
    # Child A: 14-month-old girl, worker W07, severe wasting + low MUAC, not yet referred
    h = 74.0
    wa = round(who_growth.weight_for_height_value("F", 14, h, -3.4), 2)
    a = dict(child_id=CHILD_A, sex="F", age_months=14, measurement_date=d(TODAY - pd.Timedelta(days=1)), weight_kg=wa, height_cm=h,
             muac_mm=111, oedema="no", measurement_valid=True, referral_status="none", assigned_worker_id="W07", task_status="new",
             enrolled="yes", enrolment_date=d(TODAY - pd.Timedelta(days=40)), last_visit_date=d(TODAY - pd.Timedelta(days=9)),
             referral_date=None, danger_sign="no", weight_prev1_kg=round(wa + 0.05, 2), weight_prev2_kg=round(wa + 0.12, 2))
    df = pd.DataFrame([a] + rows)[CHILD_COLS]
    return plant_errors(df)


def make_mothers(children):
    rows = []
    lact_kids = list(children[(children.age_months < 24) & (children.child_id != CHILD_A)].child_id)
    preg_kids = list(children[(children.age_months >= 6) & (children.child_id != CHILD_A)].child_id)
    rng.shuffle(lact_kids)
    rng.shuffle(preg_kids)
    links = []
    used = {CHILD_A}
    for n in range(1, N_MOTHERS + 1):
        mid = f"M{n:04d}"
        if mid == MOTHER_A:
            row = dict(mother_id=mid, status="lactating", trimester=None, hb_g_dl=7.6, bmi=17.4, height_cm=151.0, muac_cm=22.0, weight_gain_kg_month=None)
            kid = CHILD_A
        else:
            status = "lactating" if rng.random() < 0.58 else "pregnant"
            pool = lact_kids if status == "lactating" else preg_kids
            kid = None
            while pool:
                c = pool.pop()
                if c not in used:
                    kid = c
                    break
            if kid is None:
                continue
            used.add(kid)
            tri = int(rng.choice([1, 2, 3])) if status == "pregnant" else None
            hb = float(np.clip(rng.normal(11.2 if status == "pregnant" else 12.2, 1.4), 5.5, 14.5))
            row = dict(mother_id=mid, status=status, trimester=tri, hb_g_dl=round(hb, 1),
                       bmi=round(float(np.clip(rng.normal(21.5, 3.0), 14, 34)), 1),
                       height_cm=round(float(np.clip(rng.normal(152, 6), 134, 172)), 1),
                       muac_cm=round(float(np.clip(rng.normal(24, 2.5), 17, 33)), 1),
                       weight_gain_kg_month=round(float(np.clip(rng.normal(2.0, 0.9), -0.5, 4.5)), 1) if (status == "pregnant" and tri >= 2) else None)
        w = children.loc[children.child_id == kid, "assigned_worker_id"].iloc[0]
        links.append(dict(family_id=f"F{n:04d}", child_id=kid, mother_id=mid, household_id=f"H{n:04d}", assigned_worker_id=w))
        rows.append(row)
    m = pd.DataFrame(rows)[MOTHER_COLS]
    bad = rng.choice(m.index[1:], size=int(len(m) * 0.02), replace=False)   # planted entry mistakes
    for n, i in enumerate(bad):
        if n % 2 == 0:
            m.loc[i, "hb_g_dl"] = round(m.loc[i, "hb_g_dl"] * 10, 1)
        else:
            m.loc[i, "height_cm"] = round(m.loc[i, "height_cm"] / 10, 1)
    return m, pd.DataFrame(links)


if __name__ == "__main__":
    import data_checks
    kids = make_children()
    kids = data_checks.check_children_df(kids).drop(columns=["check_issues"])   # fills measurement_valid
    kids = kids[CHILD_COLS]
    mothers, links = make_mothers(kids)
    kids["muac_mm"] = kids["muac_mm"].astype("Int64")
    mothers["trimester"] = mothers["trimester"].astype("Int64")
    kids.to_csv("children.csv", index=False)
    mothers.to_csv("mothers.csv", index=False)
    links.to_csv("family_links.csv", index=False)
    print(len(kids), "children,", len(mothers), "mothers,", len(links), "family links")
