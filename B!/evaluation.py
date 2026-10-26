"""BE1 - evaluation scripts. The ONLY module that reads the answer key.

Reports flag precision, missed errors, false positives by rule, review time, follow-up
completion and audit completeness. Results are SYNTHETIC-PROTOTYPE findings, not
real-world accuracy.
Freeze the final data (Step 13):  python -m be1.evaluation --freeze
"""
import json
import sys
from collections import Counter, defaultdict
from datetime import date
from statistics import mean, median

from . import rules_engine
from .dataio import DATA, KEY, REPORTS, FIXTURES, load_all, load_config, read_csv, sha256, to_date
from .error_rates import centre_flag_rates, ranked_centres

EXP_AUDIT = {"assigned": 1, "acknowledged": 2, "in_progress": 3, "closed": 4}


def load_key():
    rows = read_csv(KEY / "answer_key.csv")
    planted = {(r["dataset"], r["record_id"], r["rule_id"]) for r in rows if r["kind"] == "planted_error"}
    benign = {(r["dataset"], r["record_id"], r["rule_id"]) for r in rows if r["kind"] == "benign_valid_reading"}
    return planted, benign


def flag_quality(flags, planted, benign):
    found = {(f["dataset"], f["record_id"], f["rule_id"]) for f in flags}
    scope = {k for k in planted if k[2] != "AUDIT_GAP"}
    tp, fp, fn = found & scope, found - scope, scope - found
    by_rule = {}
    for rule in sorted({k[2] for k in scope} | {k[2] for k in found}):
        t = {k for k in tp if k[2] == rule}
        p = {k for k in fp if k[2] == rule}
        m = {k for k in fn if k[2] == rule}
        by_rule[rule] = {"planted": len(t) + len(m), "found": len(t), "missed": len(m),
                         "false_positives": len(p),
                         "false_positives_documented_benign": len(p & benign),
                         "false_positives_unexplained": len(p - benign),
                         "precision": round(len(t) / (len(t) + len(p)), 4) if t or p else None,
                         "recall": round(len(t) / (len(t) + len(m)), 4) if t or m else None}
    return {"flags_raised": len(found), "planted_errors": len(scope), "true_positives": len(tp),
            "false_positives": len(fp), "missed_errors": len(fn),
            "precision": round(len(tp) / len(found), 4) if found else None,
            "recall": round(len(tp) / len(scope), 4) if scope else None,
            "false_positives_documented_benign": len(fp & benign),
            "false_positives_unexplained": len(fp - benign),
            "by_rule": by_rule,
            "missed_sample": sorted(fn)[:20], "unexplained_false_positive_sample": sorted(fp - benign)[:20]}


def review_time(reviews):
    done = [(to_date(r["reviewed_on"]) - to_date(r["flagged_on"])).days for r in reviews if r["reviewed_on"]]
    return {"reviews_total": len(reviews), "reviews_completed": len(done),
            "reviews_pending": len(reviews) - len(done),
            "mean_days_flag_to_review": round(mean(done), 2) if done else None,
            "median_days_flag_to_review": median(done) if done else None,
            "share_reviewed_within_7_days": round(sum(1 for d in done if d <= 7) / len(done), 4) if done else None,
            "decisions": dict(Counter(r["decision"] for r in reviews if r["decision"]))}


def followup(tasks, referrals, ver, rep):
    due = [t for t in tasks if to_date(t["due_on"]) <= rep]
    closed_due = [t for t in due if t["status"] == "closed"]
    ref_states = Counter(r["state"] for r in referrals)
    overdue_ref = [r for r in referrals if r["state"] == "sent" and to_date(r["due_on"]) < rep]
    open_ver = [v for v in ver if v["status"] != "resolved"]
    return {"tasks_total": len(tasks), "tasks_due_by_reporting_date": len(due),
            "task_followup_completion": round(len(closed_due) / len(due), 4) if due else None,
            "task_status": dict(Counter(t["status"] for t in tasks)),
            "referrals_total": len(referrals), "referral_states": dict(ref_states),
            "referral_loop_completion": round(ref_states["outcome_recorded"] / len(referrals), 4) if referrals else None,
            "referrals_overdue": len(overdue_ref),
            "access_exceptions_open": len(open_ver), "access_exceptions_total": len(ver)}


def audit_completeness(tasks, planted):
    gaps = {t["task_id"] for t in tasks if int(t["audit_entries"]) < EXP_AUDIT[t["status"]]}
    key_gaps = {k[1] for k in planted if k[2] == "AUDIT_GAP"}
    return {"tasks_checked": len(tasks), "tasks_with_audit_gap": len(gaps),
            "audit_completeness": round(1 - len(gaps) / len(tasks), 4) if tasks else None,
            "planted_gaps": len(key_gaps), "planted_gaps_found": len(gaps & key_gaps),
            "unexpected_gaps": sorted(gaps - key_gaps)}


def centre_ranking_check(flags, measurements, rep):
    hot = set(json.load(open(KEY / "hot_centres.json"))["centres"])
    rates = centre_flag_rates(measurements, flags, rep, months=12)
    ranked = ranked_centres(rates)
    top = {r["centre_id"] for r in ranked[:len(hot)]}
    return {"hot_centres_planted": len(hot), "hot_in_top_n_by_flag_rate": len(top & hot),
            "note": "Shows whether the flag rate surfaces centres that were seeded with more errors."}


def fixture_check(cfg):
    fx = json.load(open(FIXTURES / "fixture_5.json"))
    flags = rules_engine.run_all(fx["measurements"], fx["beneficiaries"], cfg)
    got = {(f["dataset"], f["record_id"], f["rule_id"]) for f in flags}
    exp = {(e["dataset"], e["record_id"], e["rule_id"]) for e in fx["expected_flags"]}
    return {"expected": sorted(exp), "got": sorted(got), "match": got == exp}


def run_evaluation():
    cfg = load_config()
    rep = date.fromisoformat(cfg["reporting_date"])
    data = load_all(DATA)
    flags = rules_engine.run_all(data["measurements"], data["beneficiaries"], cfg)
    planted, benign = load_key()
    res = {"label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
           "caveat": "Synthetic-prototype findings only. These numbers describe how the rules behave on planted synthetic errors, not real-world accuracy.",
           "config_version": cfg["config_version"], "reporting_date": cfg["reporting_date"],
           "flag_quality": flag_quality(flags, planted, benign),
           "review_time": review_time(data["review_history"]),
           "followup_completion": followup(data["tasks_seed"], data["referrals"], data["verification_records"], rep),
           "audit_completeness": audit_completeness(data["tasks_seed"], planted),
           "centre_ranking": centre_ranking_check(flags, data["measurements"], rep),
           "fixture_check": fixture_check(cfg)}
    return res, flags


def to_markdown(r):
    q = r["flag_quality"]
    L = ["# BE1 evaluation report", "", f"_{r['label']}_", "", f"> {r['caveat']}", "",
         f"Rule config {r['config_version']} · reporting date {r['reporting_date']}", "",
         "## Flag quality", "",
         f"- Flags raised: {q['flags_raised']} · planted errors: {q['planted_errors']}",
         f"- True positives {q['true_positives']} · missed {q['missed_errors']} · false positives {q['false_positives']} "
         f"({q['false_positives_documented_benign']} documented valid-but-unusual, {q['false_positives_unexplained']} unexplained)",
         f"- Precision {q['precision']} · recall {q['recall']}", "",
         "| Rule | Planted | Found | Missed | False pos. | Precision | Recall |", "|---|---|---|---|---|---|---|"]
    for k, v in q["by_rule"].items():
        L.append(f"| {k} | {v['planted']} | {v['found']} | {v['missed']} | {v['false_positives']} | {v['precision']} | {v['recall']} |")
    t, f, a, c = r["review_time"], r["followup_completion"], r["audit_completeness"], r["centre_ranking"]
    L += ["", "## Review time", "",
          f"- Reviews completed {t['reviews_completed']} of {t['reviews_total']} (pending {t['reviews_pending']})",
          f"- Mean {t['mean_days_flag_to_review']} days · median {t['median_days_flag_to_review']} days · within 7 days: {t['share_reviewed_within_7_days']}",
          "", "## Follow-up completion", "",
          f"- Tasks due by reporting date: {f['tasks_due_by_reporting_date']} · completion {f['task_followup_completion']}",
          f"- Referral loop completion {f['referral_loop_completion']} · overdue referrals {f['referrals_overdue']}",
          f"- Access exceptions open {f['access_exceptions_open']} of {f['access_exceptions_total']}",
          "", "## Audit completeness", "",
          f"- {a['tasks_with_audit_gap']} of {a['tasks_checked']} tasks have an audit gap (completeness {a['audit_completeness']}); "
          f"planted gaps found {a['planted_gaps_found']}/{a['planted_gaps']}; unexpected gaps {len(a['unexpected_gaps'])}",
          "", "## Centre ranking", "",
          f"- Seeded high-error centres found in the top {c['hot_centres_planted']} by flag rate: {c['hot_in_top_n_by_flag_rate']}",
          "", "## Fixture check", "", f"- Fixture flags match expected: {r['fixture_check']['match']}", ""]
    return "\n".join(L)


def freeze():
    files = sorted(DATA.glob("*.csv"))
    manifest = {p.name: sha256(p) for p in files}
    (DATA / "FROZEN.json").write_text(json.dumps({"note": "Final data frozen. Nobody changes data after this step.",
                                                  "sha256": manifest}, indent=1))
    return manifest


def verify_frozen():
    m = json.loads((DATA / "FROZEN.json").read_text())["sha256"]
    return {n: sha256(DATA / n) == h for n, h in m.items()}


if __name__ == "__main__":
    if "--freeze" in sys.argv:
        print(json.dumps(freeze(), indent=1))
    else:
        res, flags = run_evaluation()
        REPORTS.mkdir(parents=True, exist_ok=True)
        (REPORTS / "evaluation_report.json").write_text(json.dumps(res, indent=1, default=str))
        (REPORTS / "evaluation_report.md").write_text(to_markdown(res))
        print(to_markdown(res))
