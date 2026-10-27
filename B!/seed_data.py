"""BE1 - synthetic seed generator.

Produces the 12 datasets (about 3,000 beneficiaries, 122 centres) with planted
errors. The answer key is written to answer_key/, never to data/.
Run:  python -m be1.seed_data
Everything is SYNTHETIC DATA / PROPOSED INTEGRATION.
"""
import json
import math
import random
from datetime import date, timedelta

from .dataio import DATA, KEY, FIXTURES, CONFIG, write_csv, load_config
from .schemas import DATASETS

SEED = 2026
FIRST = ["Asha", "Meera", "Sita", "Lata", "Geeta", "Rekha", "Sunita", "Kavita", "Pooja", "Anita",
         "Ravi", "Amit", "Suresh", "Ramesh", "Vijay", "Mohan", "Deepak", "Arjun", "Rahul", "Kiran",
         "Divya", "Nisha", "Priya", "Radha", "Savita", "Usha", "Manoj", "Sanjay", "Ajay", "Vikas"]
LAST = ["Patil", "Shinde", "Pawar", "Jadhav", "More", "Kale", "Gaikwad", "Deshmukh", "Kulkarni", "Joshi",
        "Yadav", "Singh", "Kumar", "Devi", "Khan", "Sharma", "Verma", "Das", "Nair", "Reddy"]
DISTRICTS = ["District-A", "District-B", "District-C", "District-D", "District-E", "District-F"]

N_CENTRES = 122
N_CHILD, N_PREG, N_LACT = 2400, 350, 250
HOT_CENTRES = 15
PLANT = {"MISSING_FIELD": 60, "UNIT_MISMATCH": 60, "FUTURE_DATE": 30, "DUPLICATE": 40,
         "IMPLAUSIBLE_VALUE": 40, "UNUSUAL_CHANGE": 60, "GROWTH_TREND_DATA_CHECK": 25}
N_BEN_DUP = 25
N_BENIGN = 15


def weight_model(a):
    return 3.3 + 7.5 * (1 - math.exp(-a / 14)) + 0.08 * a


def height_model(a):
    return 50 + 28 * (1 - math.exp(-a / 12)) + 0.45 * a


def rnd1(x):
    return round(x + 1e-9, 1)


def generate(seed=SEED):
    rng = random.Random(seed)
    cfg = load_config()
    REP = date.fromisoformat(cfg["reporting_date"])
    D = lambda d: d.isoformat()

    # ---- centres and workers
    centres, workers = [], []
    for i in range(1, N_CENTRES + 1):
        cid, wid = f"AWC-{i:03d}", f"WRK-{i:03d}"
        centres.append({"centre_id": cid, "name": f"Anganwadi Centre {i:03d}",
                        "block": f"Block-{(i - 1) // 8 + 1}", "district": DISTRICTS[(i - 1) % 6],
                        "state": "Synthetic State", "worker_id": wid, "synthetic_flag": "SYNTHETIC"})
        workers.append({"worker_id": wid, "name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
                        "centre_id": cid, "role": "anganwadi_worker", "synthetic_flag": "SYNTHETIC"})
    cids = [c["centre_id"] for c in centres]
    hot = set(rng.sample(cids, HOT_CENTRES))

    # ---- beneficiaries and measurement series
    cats = ["child"] * N_CHILD + ["pregnant_woman"] * N_PREG + ["lactating_mother"] * N_LACT
    rng.shuffle(cats)
    bens, series = [], {}       # series: beneficiary_id -> list of measurement dicts
    under18_left = 5
    for i, cat in enumerate(cats):
        bid = f"BEN-{i + 1:04d}"
        cid = cids[i] if i < N_CENTRES else rng.choice(cids)
        last = rng.choice(LAST)
        name = f"{rng.choice(FIRST)} {last}"
        mv = rng.choices(["verified", "pending", "not_available"], [0.80, 0.15, 0.05])[0]
        b = {"beneficiary_id": bid, "centre_id": cid, "category": cat, "name": name,
             "mobile_verification_status": mv, "possible_duplicate_of": None, "synthetic_flag": "SYNTHETIC"}
        if cat == "child":
            age_m = rng.randint(7, 71)
            dob = REP - timedelta(days=int(age_m * 30.4375) + rng.randint(0, 29))
            b.update(sex=rng.choice(["F", "M"]), date_of_birth=D(dob),
                     guardian_name=f"{rng.choice(FIRST)} {last}")
            n = rng.choices([3, 4, 5], [0.30, 0.35, 0.35])[0]
            end = REP - timedelta(days=rng.randint(0, 25))
            dates = [end]
            for _ in range(n - 1):
                dates.append(dates[-1] - timedelta(days=rng.randint(28, 35)))
            dates.reverse()
            wscale, hoff = 1 + rng.uniform(-0.10, 0.10), rng.uniform(-3, 3)
            rows = []
            for k, d in enumerate(dates):
                a = (d - dob).days / 30.4375
                rows.append({"measurement_id": None, "beneficiary_id": bid, "centre_id": cid,
                             "measured_on": D(d), "recorded_by": f"WRK-{cids.index(cid) + 1:03d}",
                             "weight_value": rnd1(weight_model(a) * wscale + rng.uniform(-0.25, 0.25)),
                             "weight_unit": "kg",
                             "height_value": rnd1(height_model(a) + hoff + rng.uniform(-0.3, 0.3)),
                             "height_unit": "cm", "muac_cm": rnd1(rng.uniform(12.5, 15.5)),
                             "is_baseline": 1 if k == 0 else 0, "supersedes_id": None,
                             "entry_source": rng.choice(["mobile", "paper_entry"]),
                             "synthetic_flag": "SYNTHETIC"})
            series[bid] = rows
            b["enrolment_date"] = D(max(dob, dates[0] - timedelta(days=rng.randint(0, 20))))
        else:
            if cat == "pregnant_woman" and under18_left > 0:
                age_y = rng.randint(16, 17)
                under18_left -= 1
            else:
                age_y = rng.randint(19, 38)
            b.update(sex="F", date_of_birth=D(REP - timedelta(days=age_y * 365 + rng.randint(0, 300))),
                     guardian_name=None, enrolment_date=D(REP - timedelta(days=rng.randint(30, 400))))
            b["_age_y"] = age_y
        bens.append(b)

    child_ids = list(series)
    cen_of = {b["beneficiary_id"]: b["centre_id"] for b in bens}

    # ---- planting (disjoint children; hot centres sampled 4x more often)
    used = set()

    def pick(k, need=lambda rows: True):
        pool = [bid for bid in child_ids if bid not in used and need(series[bid])]
        keyed = sorted(pool, key=lambda bid: rng.random() ** (1.0 / (4 if cen_of[bid] in hot else 1)),
                       reverse=True)[:k]
        used.update(keyed)
        return keyed

    # growth-trend data check: 4 equal weights in a row (copy-paste pattern)
    for bid in pick(PLANT["GROWTH_TREND_DATA_CHECK"], lambda r: len(r) == 5):
        rows = series[bid]
        for r in rows[2:5]:
            r["weight_value"] = rows[1]["weight_value"]
        rows[4]["_plant"] = "GROWTH_TREND_DATA_CHECK"

    # unusual change (spike up, spike down, height decrease)
    for bid in pick(PLANT["UNUSUAL_CHANGE"]):
        rows = series[bid]
        r = rows[rng.randrange(1, len(rows))]
        kind = rng.choice(["w_up", "w_down", "h_down"])
        if kind == "w_up":
            r["weight_value"] = rnd1(r["weight_value"] + rng.uniform(3.0, 5.0))
        elif kind == "w_down":
            r["weight_value"] = rnd1(r["weight_value"] * rng.uniform(0.60, 0.78))
        else:
            r["height_value"] = rnd1(r["height_value"] - rng.uniform(6, 12))
        r["_plant"] = "UNUSUAL_CHANGE"

    # implausible values
    for bid in pick(PLANT["IMPLAUSIBLE_VALUE"]):
        r = rng.choice(series[bid])
        kind = rng.choice(["w_hi", "w_lo", "h_hi"])
        if kind == "w_hi":
            r["weight_value"] = rnd1(rng.uniform(40, 95))
        elif kind == "w_lo":
            r["weight_value"] = rnd1(rng.uniform(0.2, 1.2))
        else:
            r["height_value"] = rnd1(rng.uniform(160, 250))
        r["_plant"] = "IMPLAUSIBLE_VALUE"

    # unit mismatch
    for bid in pick(PLANT["UNIT_MISMATCH"]):
        r = rng.choice(series[bid])
        kind = rng.choice(["w_g", "w_kg_but_grams", "h_m", "h_cm_but_m"])
        if kind == "w_g":
            r["weight_value"], r["weight_unit"] = round(r["weight_value"] * 1000), "g"
        elif kind == "w_kg_but_grams":
            r["weight_value"] = round(r["weight_value"] * 1000)
        elif kind == "h_m":
            r["height_value"], r["height_unit"] = round(r["height_value"] / 100, 2), "m"
        else:
            r["height_value"] = round(r["height_value"] / 100, 2)
        r["_plant"] = "UNIT_MISMATCH"

    # missing field
    for bid in pick(PLANT["MISSING_FIELD"]):
        r = rng.choice(series[bid])
        r[rng.choice(["weight_value", "height_value"])] = None
        r["_plant"] = "MISSING_FIELD"

    # future date
    for bid in pick(PLANT["FUTURE_DATE"]):
        r = rng.choice(series[bid])
        r["measured_on"] = D(REP + timedelta(days=rng.randint(5, 60)))
        r["_plant"] = "FUTURE_DATE"

    # duplicate measurement rows (copy inserted right after the original)
    for bid in pick(PLANT["DUPLICATE"]):
        rows = series[bid]
        j = rng.randrange(len(rows))
        cp = dict(rows[j])
        cp.update(is_baseline=0, _plant="DUPLICATE")
        rows.insert(j + 1, cp)

    # benign: genuine catch-up gain that the rule will still flag (documented false positives)
    for bid in pick(N_BENIGN):
        rows = series[bid]
        j = rng.randrange(1, len(rows))
        shift = rng.uniform(2.4, 3.0)
        for r in rows[j:]:
            r["weight_value"] = rnd1(r["weight_value"] + shift)
        rows[j]["_benign"] = True

    # beneficiary duplicates (clone row, new ID)
    dup_src = pick(N_BEN_DUP)
    by_id = {b["beneficiary_id"]: b for b in bens}
    next_id = len(bens) + 1
    ben_key = []
    for src in dup_src:
        s = by_id[src]
        cl = dict(s)
        cl.update(beneficiary_id=f"BEN-{next_id:04d}", possible_duplicate_of=src,
                  enrolment_date=D(date.fromisoformat(s["enrolment_date"]) + timedelta(days=rng.randint(5, 60))))
        bens.append(cl)
        by_id[cl["beneficiary_id"]] = cl
        ben_key.append(cl["beneficiary_id"])
        next_id += 1

    # ---- assign measurement IDs, build answer key
    measurements, key = [], []
    n = 1
    for bid in child_ids:
        for r in series[bid]:
            r["measurement_id"] = f"MEA-{n:06d}"
            n += 1
            measurements.append(r)
            if r.get("_plant"):
                key.append({"dataset": "measurements", "record_id": r["measurement_id"],
                            "rule_id": r["_plant"], "kind": "planted_error", "centre_id": r["centre_id"]})
            if r.get("_benign"):
                key.append({"dataset": "measurements", "record_id": r["measurement_id"],
                            "rule_id": "UNUSUAL_CHANGE", "kind": "benign_valid_reading",
                            "centre_id": r["centre_id"]})
    for bid in ben_key:
        key.append({"dataset": "beneficiaries", "record_id": bid, "rule_id": "DUPLICATE",
                    "kind": "planted_error", "centre_id": cen_of.get(bid) or by_id[bid]["centre_id"]})

    # ---- verification records
    ver, vn = [], 1
    for b in bens:
        if b["possible_duplicate_of"]:
            continue
        mv = b["mobile_verification_status"]
        if mv == "verified" and rng.random() > 0.08:
            continue
        opened = REP - timedelta(days=rng.randint(2, 120))
        if mv == "verified":
            status, resolved = "resolved", opened + timedelta(days=rng.randint(1, 20))
        else:
            status = rng.choices(["open", "in_progress", "resolved"], [0.55, 0.30, 0.15])[0]
            resolved = opened + timedelta(days=rng.randint(1, 25)) if status == "resolved" else None
        if resolved and resolved > REP:
            resolved = REP
        ver.append({"verification_id": f"VER-{vn:05d}", "beneficiary_id": b["beneficiary_id"],
                    "centre_id": b["centre_id"],
                    "barrier_type": rng.choice(["pending_mobile_auth", "document_missing", "auth_failed", "other"]),
                    "status": status, "opened_on": D(opened), "resolved_on": D(resolved) if resolved else None,
                    "resolution_note": "Resolved at centre visit (synthetic)" if resolved else None,
                    "synthetic_flag": "SYNTHETIC"})
        vn += 1

    # ---- referrals (5 hand-placed to cover every state + overdue, then bulk)
    refs = []
    kids = [b for b in bens if b["category"] == "child" and not b["possible_duplicate_of"]]
    rng.shuffle(kids)

    def ref(rid, b, rtype, state, sent_days_ago, due_days=14):
        sent = REP - timedelta(days=sent_days_ago)
        ack = sent + timedelta(days=2) if state in ("acknowledged", "attended", "outcome_recorded") else None
        att = ack + timedelta(days=5) if state in ("attended", "outcome_recorded") else None
        out = att + timedelta(days=3) if state == "outcome_recorded" else None
        return {"referral_id": rid, "beneficiary_id": b["beneficiary_id"], "centre_id": b["centre_id"],
                "referral_type": rtype, "state": state, "sent_on": D(sent),
                "acknowledged_on": D(ack) if ack else None, "attended_on": D(att) if att else None,
                "outcome_on": D(out) if out else None,
                "outcome_note": "Outcome recorded (synthetic)" if out else None,
                "due_on": D(sent + timedelta(days=due_days)), "synthetic_flag": "SYNTHETIC"}
    for i, (st, ago) in enumerate([("sent", 6), ("acknowledged", 20), ("attended", 30),
                                   ("outcome_recorded", 45), ("sent", 40)]):
        refs.append(ref(f"REF-{9001 + i}", kids[i], "disability_deic", st, ago))   # REF-9005 is overdue
    for i in range(5, 85):
        st = rng.choices(["sent", "acknowledged", "attended", "outcome_recorded"], [0.25, 0.25, 0.20, 0.30])[0]
        refs.append(ref(f"REF-{i - 4:04d}", kids[i], rng.choice(["disability_deic", "health_facility"]),
                        st, rng.randint(3, 90)))

    # ---- maternal profiles (restricted; under-18 deferred)
    mat = []
    for b in bens:
        if b["category"] == "child" or b["possible_duplicate_of"]:
            continue
        last_visit = REP - timedelta(days=rng.randint(0, 60))
        under18 = b.get("_age_y", 99) < 18
        mat.append({"maternal_id": f"MAT-{len(mat) + 1:04d}", "beneficiary_id": b["beneficiary_id"],
                    "centre_id": b["centre_id"],
                    "stage": rng.choice(["trimester_1", "trimester_2", "trimester_3"])
                    if b["category"] == "pregnant_woman" else "postnatal_0_6m",
                    "registered_on": D(last_visit - timedelta(days=rng.randint(30, 200))),
                    "last_visit_on": D(last_visit), "next_visit_due_on": D(last_visit + timedelta(days=30)),
                    "access_level": "deferred_under_18" if under18 else "restricted",
                    "synthetic_flag": "SYNTHETIC"})

    # ---- service records and home visits
    svc = []
    for b in bens:
        if b["possible_duplicate_of"]:
            continue
        for _ in range(rng.randint(1, 2)):
            svc.append({"service_id": f"SVC-{len(svc) + 1:05d}", "beneficiary_id": b["beneficiary_id"],
                        "centre_id": b["centre_id"],
                        "service_type": rng.choice(["take_home_ration", "hot_cooked_meal", "growth_monitoring", "supplement"]),
                        "service_date": D(REP - timedelta(days=rng.randint(0, 90))),
                        "quantity": rng.randint(1, 4), "synthetic_flag": "SYNTHETIC"})
    visits = []
    for _ in range(1200):
        b = rng.choice(bens)
        visits.append({"visit_id": f"VIS-{len(visits) + 1:05d}", "beneficiary_id": b["beneficiary_id"],
                       "centre_id": b["centre_id"], "visit_date": D(REP - timedelta(days=rng.randint(0, 120))),
                       "visited_by": f"WRK-{cids.index(b['centre_id']) + 1:03d}",
                       "outcome": rng.choice(["found_well", "not_home", "referred", "advice_given"]),
                       "synthetic_flag": "SYNTHETIC"})

    # ---- review history (historical supervisor reviews of flags)
    mrow = {m["measurement_id"]: m for m in measurements}
    reviews, flag_dates = [], {}
    for k in key:
        if k["dataset"] != "measurements" or rng.random() > 0.70:
            continue
        m = mrow[k["record_id"]]
        md = date.fromisoformat(m["measured_on"])
        flagged = md + timedelta(days=rng.randint(1, 3)) if md + timedelta(days=3) <= REP \
            else REP - timedelta(days=rng.randint(1, 60))
        if flagged > REP:
            flagged = REP
        delay = rng.randint(3, 14) if k["centre_id"] in hot else rng.randint(1, 7)
        reviewed = flagged + timedelta(days=delay)
        done = reviewed <= REP
        if k["kind"] == "benign_valid_reading":
            decision = "valid_reading"
        else:
            decision = rng.choices(["confirmed_error", "needs_remeasure", "valid_reading"], [0.7, 0.2, 0.1])[0]
        fid = f"FLG-{k['record_id']}-{k['rule_id']}"
        flag_dates[fid] = flagged
        reviews.append({"review_id": f"REV-{len(reviews) + 1:05d}", "flag_id": fid,
                        "measurement_id": k["record_id"], "centre_id": k["centre_id"],
                        "reviewed_by": "supervisor", "flagged_on": D(flagged),
                        "reviewed_on": D(reviewed) if done else None,
                        "decision": decision if done else None, "synthetic_flag": "SYNTHETIC"})

    # ---- tasks seed (flags -> tasks, with a few planted audit gaps)
    EXP_AUDIT = {"assigned": 1, "acknowledged": 2, "in_progress": 3, "closed": 4}
    planted_m = [k for k in key if k["dataset"] == "measurements" and k["kind"] == "planted_error"]
    rng.shuffle(planted_m)
    tasks, audit_gap_key = [], []
    for k in planted_m[:150]:
        fid = f"FLG-{k['record_id']}-{k['rule_id']}"
        created = flag_dates.get(fid) or REP - timedelta(days=rng.randint(3, 100))
        status = rng.choices(list(EXP_AUDIT), [0.20, 0.15, 0.20, 0.45])[0]
        due = created + timedelta(days=7)
        closed = None
        if status == "closed":
            closed = min(created + timedelta(days=rng.randint(1, 14)), REP)
        tasks.append({"task_id": f"TSK-{len(tasks) + 1:05d}", "flag_id": fid,
                      "beneficiary_id": mrow[k["record_id"]]["beneficiary_id"], "centre_id": k["centre_id"],
                      "owner_role": "supervisor" if rng.random() < 0.4 else "anganwadi_worker",
                      "status": status, "created_on": D(created), "due_on": D(due),
                      "closed_on": D(closed) if closed else None,
                      "outcome": "reading_verified" if closed else None,
                      "audit_entries": EXP_AUDIT[status], "synthetic_flag": "SYNTHETIC"})
    for t in rng.sample([t for t in tasks if t["status"] != "assigned"], 4):   # planted audit gaps
        t["audit_entries"] -= 1
        audit_gap_key.append({"dataset": "tasks_seed", "record_id": t["task_id"], "rule_id": "AUDIT_GAP",
                              "kind": "planted_error", "centre_id": t["centre_id"]})
    # one flag with two tasks over time (first closed as reassigned, second still open)
    ref_m = planted_m[0]
    fid2 = f"FLG-{ref_m['record_id']}-{ref_m['rule_id']}"
    c2 = REP - timedelta(days=30)
    for i, (st, closed, outcome, aud) in enumerate([("closed", c2 + timedelta(days=6), "reassigned", 4),
                                                    ("in_progress", None, None, 3)]):
        tasks.append({"task_id": f"TSK-{9001 + i}", "flag_id": fid2,
                      "beneficiary_id": mrow[ref_m["record_id"]]["beneficiary_id"],
                      "centre_id": ref_m["centre_id"], "owner_role": "anganwadi_worker", "status": st,
                      "created_on": D(c2 + timedelta(days=7 * i)), "due_on": D(c2 + timedelta(days=7 * i + 7)),
                      "closed_on": D(closed) if closed else None, "outcome": outcome,
                      "audit_entries": aud, "synthetic_flag": "SYNTHETIC"})
    key += audit_gap_key

    # ---- age band reference (all unverified -> demo only)
    bands = [{"band_id": f"BAND-{i + 1}", "label": f"UNVERIFIED age band {i + 1} (demo)",
              "min_months": lo, "max_months": hi, "service_name": f"UNVERIFIED service {chr(65 + i)} (demo)",
              "verified": "false", "status": "draft", "synthetic_flag": "SYNTHETIC"}
             for i, (lo, hi) in enumerate([(0, 6), (6, 36), (36, 72)])]

    out = {"centres": centres, "workers": workers, "beneficiaries": bens, "measurements": measurements,
           "verification_records": ver, "referrals": refs, "maternal_profiles": mat, "service_records": svc,
           "home_visits": visits, "review_history": reviews, "tasks_seed": tasks, "age_bands_reference": bands}
    return out, key, sorted(hot)


def write_all():
    out, key, hot = generate()
    for name, rows in out.items():
        write_csv(DATA / f"{name}.csv", DATASETS[name], rows)
    write_csv(KEY / "answer_key.csv", ["dataset", "record_id", "rule_id", "kind", "centre_id"], key)
    with open(KEY / "hot_centres.json", "w") as f:
        json.dump({"note": "centres with planted error rate ~4x higher; evaluation only", "centres": hot}, f, indent=1)
    summary = {n: len(r) for n, r in out.items()}
    planted = {}
    for k in key:
        planted[f"{k['kind']}:{k['rule_id']}"] = planted.get(f"{k['kind']}:{k['rule_id']}", 0) + 1
    return summary, planted


def write_fixture():
    """Tiny fixture of 5 beneficiaries (Step 1 handoff). Separate IDs (BEN-9001...)."""
    S = "SYNTHETIC"
    ben = lambda i, cat, name, dob, **kw: {"beneficiary_id": f"BEN-{9000 + i}", "centre_id": "AWC-001",
        "category": cat, "name": name, "sex": kw.get("sex", "F"), "date_of_birth": dob,
        "enrolment_date": kw.get("enrol", "2026-08-01"), "guardian_name": kw.get("guardian"),
        "mobile_verification_status": kw.get("mv", "verified"),
        "possible_duplicate_of": kw.get("dup"), "synthetic_flag": S}
    meas = lambda n, bid, d, w, h, **kw: {"measurement_id": f"MEA-F{n:04d}", "beneficiary_id": bid,
        "centre_id": "AWC-001", "measured_on": d, "recorded_by": "WRK-001", "weight_value": w,
        "weight_unit": "kg", "height_value": h, "height_unit": "cm", "muac_cm": 14.0,
        "is_baseline": kw.get("base", 0), "supersedes_id": kw.get("sup"), "entry_source": "mobile",
        "synthetic_flag": S}
    fx = {
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
        "centres": [{"centre_id": "AWC-001", "name": "Anganwadi Centre 001", "block": "Block-1",
                     "district": "District-A", "state": "Synthetic State", "worker_id": "WRK-001",
                     "synthetic_flag": S}],
        "beneficiaries": [
            ben(1, "child", "Fixture Child One", "2025-08-01", guardian="Fixture Guardian"),
            ben(2, "child", "Fixture Child Two", "2025-06-15", guardian="Fixture Guardian", mv="pending"),
            ben(3, "pregnant_woman", "Fixture Mother Three", "1999-03-10", mv="verified"),
            ben(4, "child", "Fixture Child Four", "2024-12-05", guardian="Fixture Guardian"),
            ben(5, "child", "Fixture Child Four", "2024-12-05", guardian="Fixture Guardian",
                dup="BEN-9004", enrol="2026-09-10"),
        ],
        "measurements": [
            meas(1, "BEN-9001", "2026-08-12", 8.0, 70.0, base=1),
            meas(2, "BEN-9001", "2026-09-12", 8.2, 71.2),
            meas(3, "BEN-9001", "2026-10-10", 12.9, 72.3),                    # suspicious reading
            meas(4, "BEN-9001", "2026-10-14", 8.6, 72.4, sup="MEA-F0003"),     # remeasurement = new record
            meas(5, "BEN-9002", "2026-10-05", 8.9, 69.8, base=1),
            meas(6, "BEN-9004", "2026-08-10", 10.1, 76.0, base=1),
            meas(7, "BEN-9004", "2026-09-09", 10.4, 76.9),
            meas(8, "BEN-9004", "2026-10-08", 10.6, 77.7),
        ],
        "verification_records": [{"verification_id": "VER-F0001", "beneficiary_id": "BEN-9002",
            "centre_id": "AWC-001", "barrier_type": "pending_mobile_auth", "status": "open",
            "opened_on": "2026-10-01", "resolved_on": None, "resolution_note": None, "synthetic_flag": S}],
        "maternal_profiles": [{"maternal_id": "MAT-F0001", "beneficiary_id": "BEN-9003",
            "centre_id": "AWC-001", "stage": "trimester_2", "registered_on": "2026-08-20",
            "last_visit_on": "2026-10-12", "next_visit_due_on": "2026-11-11",
            "access_level": "restricted", "synthetic_flag": S}],
    }
    fx["expected_flags"] = [
        {"dataset": "measurements", "record_id": "MEA-F0003", "rule_id": "UNUSUAL_CHANGE"},
        {"dataset": "beneficiaries", "record_id": "BEN-9005", "rule_id": "DUPLICATE"}]
    FIXTURES.mkdir(parents=True, exist_ok=True)
    with open(FIXTURES / "fixture_5.json", "w") as f:
        json.dump(fx, f, indent=1)
    return fx


if __name__ == "__main__":
    s, p = write_all()
    write_fixture()
    print("rows:", s)
    print("planted:", p)
