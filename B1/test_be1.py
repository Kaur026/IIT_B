# test_be1.py - run:  python3 test_be1.py   (works on a temp copy, never changes your real files)
import json, os, shutil, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
tmp = tempfile.mkdtemp()
for f in os.listdir(HERE):
    p = os.path.join(HERE, f)
    if os.path.isfile(p):
        shutil.copy(p, tmp)
os.environ["BE1_DATA_DIR"] = tmp
os.environ["THRESHOLDS_PATH"] = os.path.join(tmp, "thresholds.json")
sys.path.insert(0, tmp)
os.chdir(tmp)
import pandas as pd
import rules_engine as e, data_checks as dc, rule_settings as rs, family_link as fl

n = 0
def ok(cond, msg):
    global n
    n += 1
    assert cond, "FAILED: " + msg
    print("ok -", msg)

# 5-child test file
t = pd.read_csv("test_children.csv")
exp = {"T0001": "RED", "T0002": "AMBER", "T0003": "GREEN", "T0004": "RED", "T0005": "GREY"}
for _, r in t.iterrows():
    ok(e.evaluate_child(r)["colour"] == exp[r.child_id], f"{r.child_id} is {exp[r.child_id]}")

# Child A
k = pd.read_csv("children.csv"); m = pd.read_csv("mothers.csv")
a = e.evaluate_child(k[k.child_id == "C0001"].iloc[0])
ok(a["colour"] == "RED" and {"C1", "C2", "C7"} <= {x["rule_id"] for x in a["reasons"]}, "Child A is RED with C1, C2, C7")
ma = e.evaluate_mother(m[m.mother_id == "M0001"].iloc[0])
ok(ma["colour"] == "RED" and ma["reasons"][0]["rule_id"] == "M3", "Mother of Child A is RED (M3)")
fam = fl.get_family(child_id="C0001")
ok(fam["joint_visit"] and fam["worker_id"] == "W07", "Child A family gets a joint visit by W07")
ok(any(t_["child_id"] == "C0001" for t_ in fl.joint_visit_tasks()), "joint task list has Child A")

# rule details
base = dict(child_id="X", sex="F", age_months=20, measurement_date="2026-10-14", weight_kg=10.0, height_cm=80, muac_mm=130, oedema="no")
ok(e.evaluate_child({**base, "oedema": "yes"})["colour"] == "RED", "oedema -> RED")
ok(e.evaluate_child({**base, "danger_sign": "yes"})["colour"] == "RED", "danger sign -> RED")
ok(e.evaluate_child({**base, "measurement_date": "2026-08-01"})["reasons"][0]["rule_id"] == "C8", "old reading -> C8 AMBER")
ok(e.evaluate_child({**base, "referral_status": "issued", "referral_date": "2026-10-01"})["colour"] == "RED", "referral not attended -> C10 RED")
ok(e.evaluate_child({**base, "muac_mm": ""})["confidence"] == "MEDIUM", "missing MUAC lowers confidence")
ok(e.evaluate_mother({"mother_id": "Z", "status": "pregnant", "trimester": 2, "hb_g_dl": 6.5, "bmi": 22, "height_cm": 150, "weight_gain_kg_month": 2})["colour"] == "RED", "pregnant Hb 6.5 RED")
ok(e.evaluate_mother({"mother_id": "Z", "status": "pregnant", "trimester": 3, "hb_g_dl": 12, "bmi": 22, "height_cm": 135, "weight_gain_kg_month": 4})["reasons"][0]["rule_id"] in ("M5", "M6"), "short height / gain -> AMBER")
ok(e.evaluate_mother({"mother_id": "Z", "status": "lactating", "hb_g_dl": 12.5, "bmi": 15.5, "height_cm": 150})["colour"] == "RED", "BMI under 16 RED")

# data checks
ok(dc.check_child({**base, "weight_kg": 105.0})["issues"][0]["code"] == "decimal_slip", "decimal slip found")
ok("10.5" in dc.check_child({**base, "weight_kg": 105.0})["issues"][0]["suggestion"], "decimal slip suggests 10.5 kg")
ok(dc.check_child({**base, "weight_kg": 80.0, "height_cm": 10.0})["issues"][0]["code"] == "swapped", "swapped found")
ok(dc.check_child({**base, "measurement_date": "2027-06-01"})["measurement_valid"] is False, "future date not valid")
rc = dc.recheck_child({**base, "weight_kg": 105.0}, new_weight_kg=10.5)
ok(rc["before"]["colour"] == "GREY" and rc["after"]["colour"] != "GREY", "recheck turns GREY into a real colour")
ok(sum(dc.trust_summary(k)["by_problem"].values()) >= 20, "trust summary counts planted errors")

# rule settings
try: rs.create_draft("C1", -2.5, "sup1"); ok(False, "locked rule must refuse draft")
except rs.RuleSettingsError: ok(True, "locked rule refuses a plain draft")
d = rs.create_draft("C8", 28, "sup1")
imp = rs.preview_impact("C8", 28)
ok(imp["people_changed"] > 0, f"preview shows {imp['people_changed']} children change")
rs.request_approval(d["draft_id"], "sup1")
try: rs.approve(d["draft_id"], "sup1"); ok(False, "self approval must fail")
except rs.RuleSettingsError: ok(True, "drafter cannot approve own change")
rs.approve(d["draft_id"], "dist1")
ok(e.load_rules()["C8"]["value"] == 28, "approved value is live in the engine")
d2 = rs.create_draft("C10", 5, "sup1"); rs.request_approval(d2["draft_id"], "sup1")
rs.reject(d2["draft_id"], "dist1", "too strict")
ok(e.load_rules()["C10"]["value"] == 7, "rejected draft changes nothing")
try: rs.override_with_reason("C2", 120, "dist1", "short"); ok(False, "override needs reason")
except rs.RuleSettingsError: ok(True, "override without a real reason refused")
rs.override_with_reason("C2", 120, "dist1", "State order raises MUAC cut-off for pilot")
ok(e.load_rules()["C2"]["value"] == 120, "override applied to locked rule")
try: rs.override_with_reason("C1", -9, "dist1", "testing a silly number"); ok(False, "range check")
except rs.RuleSettingsError: ok(True, "out-of-range value refused")
rs.reset("dist1")
ok(e.load_rules()["C8"]["value"] == 35 and e.load_rules()["C2"]["value"] == 115, "reset restores starting values")
ok(len(rs.history()) >= 6, "every change is in the log")
print(f"\nALL {n} CHECKS PASSED")
shutil.rmtree(tmp, ignore_errors=True)
