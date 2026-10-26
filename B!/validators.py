"""BE1 - dataset validator. Checks STRUCTURE and referential integrity of the 12 datasets.

It does not hunt for the planted data-quality errors (that is the rules engine's job);
it confirms the files are well-formed so the engine and the other three people can rely
on them. Writes reports/validator_report.json and .md.
"""
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

from .dataio import DATA, KEY, REPORTS, load_all, load_config, to_date
from .schemas import DATASETS

ID_PATTERNS = {
    "centres": ("centre_id", r"^AWC-\d{3}$"), "workers": ("worker_id", r"^WRK-\d{3}$"),
    "beneficiaries": ("beneficiary_id", r"^BEN-\d{4}$"), "measurements": ("measurement_id", r"^MEA-(F)?\d{4,6}$"),
    "verification_records": ("verification_id", r"^VER-(F)?\d{4,5}$"), "referrals": ("referral_id", r"^REF-\d{4}$"),
    "maternal_profiles": ("maternal_id", r"^MAT-(F)?\d{4}$"), "service_records": ("service_id", r"^SVC-\d{5}$"),
    "home_visits": ("visit_id", r"^VIS-\d{5}$"), "review_history": ("review_id", r"^REV-\d{5}$"),
    "tasks_seed": ("task_id", r"^TSK-\d{4,5}$"), "age_bands_reference": ("band_id", r"^BAND-\d$"),
}
DATE_FIELDS = {"beneficiaries": ["date_of_birth", "enrolment_date"], "measurements": ["measured_on"],
               "verification_records": ["opened_on", "resolved_on"],
               "referrals": ["sent_on", "acknowledged_on", "attended_on", "outcome_on", "due_on"],
               "maternal_profiles": ["registered_on", "last_visit_on", "next_visit_due_on"],
               "service_records": ["service_date"], "home_visits": ["visit_date"],
               "review_history": ["flagged_on", "reviewed_on"], "tasks_seed": ["created_on", "due_on", "closed_on"]}
ENUMS = {"beneficiaries": {"category": {"child", "pregnant_woman", "lactating_mother"},
                           "mobile_verification_status": {"verified", "pending", "not_available"}},
         "verification_records": {"status": {"open", "in_progress", "resolved"},
                                  "barrier_type": {"pending_mobile_auth", "document_missing", "auth_failed", "other"}},
         "referrals": {"state": {"sent", "acknowledged", "attended", "outcome_recorded"}},
         "tasks_seed": {"status": {"assigned", "acknowledged", "in_progress", "closed"}},
         "review_history": {"decision": {"confirmed_error", "valid_reading", "needs_remeasure", None}}}
REFS = {"beneficiary_id": "beneficiaries", "centre_id": "centres"}
SENSITIVE = re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b")     # 12-digit Aadhaar-like numbers must never appear


def validate(folder=DATA):
    cfg = load_config()
    data = load_all(folder)
    issues, stats = [], {}
    ids = {n: {r[ID_PATTERNS[n][0]] for r in rows} for n, rows in data.items()}
    for name, rows in data.items():
        fields = DATASETS[name]
        idf, pat = ID_PATTERNS[name]
        ctr = Counter(r[idf] for r in rows)
        stats[name] = {"rows": len(rows)}
        header_path = Path(folder) / f"{name}.csv"
        header = header_path.read_text(encoding="utf-8").splitlines()[0].split(",")
        if header != fields:
            issues.append({"dataset": name, "check": "header", "detail": f"header {header} != agreed {fields}"})
        for r in rows:
            rid = r[idf]
            if not re.match(pat, rid or ""):
                issues.append({"dataset": name, "check": "id_format", "record": rid})
            if ctr[rid] > 1:
                issues.append({"dataset": name, "check": "duplicate_id", "record": rid})
            if r.get("synthetic_flag") != "SYNTHETIC":
                issues.append({"dataset": name, "check": "synthetic_flag", "record": rid})
            for f in DATE_FIELDS.get(name, []):
                if r.get(f) and to_date(r[f]) is None:
                    issues.append({"dataset": name, "check": "date_format", "record": rid, "field": f})
            for f, allowed in ENUMS.get(name, {}).items():
                if r.get(f) not in allowed:
                    issues.append({"dataset": name, "check": "enum", "record": rid, "field": f, "value": r.get(f)})
            for f, tgt in REFS.items():
                if f in r and r[f] and r[f] not in ids[tgt]:
                    issues.append({"dataset": name, "check": "referential", "record": rid, "field": f, "value": r[f]})
            for v in r.values():
                if v and isinstance(v, str) and SENSITIVE.search(v):
                    issues.append({"dataset": name, "check": "sensitive_number_pattern", "record": rid})
        stats[name]["empty_cells"] = {f: sum(1 for r in rows if r.get(f) is None) for f in fields
                                      if any(r.get(f) is None for r in rows)}
    for m in data["measurements"]:
        if m["supersedes_id"] and m["supersedes_id"] not in ids["measurements"]:
            issues.append({"dataset": "measurements", "check": "supersedes_missing", "record": m["measurement_id"]})
    if (Path(folder) / "answer_key.csv").exists() or any(Path(folder).glob("*key*")):
        issues.append({"dataset": "-", "check": "answer_key_in_data_folder", "detail": "answer key must be kept separate"})
    rep = {"label": "SYNTHETIC DATA / PROPOSED INTEGRATION", "config_version": cfg["config_version"],
           "reporting_date": cfg["reporting_date"], "datasets": stats,
           "structural_issue_count": len(issues), "issue_counts_by_check": dict(Counter(i["check"] for i in issues)),
           "issues_sample": issues[:50],
           "note": "Planted data-quality errors (missing values, unit mismatches, etc.) are expected and are not structural issues; the rules engine finds them."}
    return rep


def write_report(rep):
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / "validator_report.json").write_text(json.dumps(rep, indent=1))
    lines = ["# Validator report", "", f"_{rep['label']}_  ", f"Reporting date: {rep['reporting_date']} · rule config {rep['config_version']}", "",
             f"**Structural issues: {rep['structural_issue_count']}**", "", "| Dataset | Rows | Columns with empty cells |", "|---|---|---|"]
    for n, s in rep["datasets"].items():
        lines.append(f"| {n} | {s['rows']} | {', '.join(s['empty_cells']) or '-'} |")
    lines += ["", rep["note"]]
    (REPORTS / "validator_report.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    r = validate()
    write_report(r)
    print(json.dumps({k: r[k] for k in ("structural_issue_count", "issue_counts_by_check")}))
