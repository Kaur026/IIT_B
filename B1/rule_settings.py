# rule_settings.py - F1 Rule Settings logic (BE1). SYNTHETIC prototype.
# Flow: draft -> request approval -> approve / reject. Reset restores the starting values.
# Locked (GUIDELINE) rules cannot be drafted; use override_with_reason (needs a written reason, always logged).
# The active numbers live in thresholds.json; the starting copy lives in thresholds_default.json.
import json
import os
import shutil
import uuid
from datetime import datetime

import pandas as pd

import rules_engine

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("BE1_DATA_DIR", HERE)
ACTIVE = rules_engine.THRESHOLDS_PATH
DEFAULT = os.path.join(HERE, "thresholds_default.json")
DRAFTS = os.path.join(DATA_DIR, "rule_drafts.json")
LOG = os.path.join(DATA_DIR, "rule_settings_log.json")
MIN_REASON_CHARS = 10


class RuleSettingsError(ValueError):
    """Raised with a plain-language message the screen can show."""


def _now():
    return datetime.now().isoformat(timespec="seconds")


def _read(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def _write(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _log(action, rule_id, user, **extra):
    log = _read(LOG, [])
    log.append({"time": _now(), "action": action, "rule_id": rule_id, "user": user, **extra})
    _write(LOG, log)


def _ensure_default():
    if not os.path.exists(DEFAULT):
        shutil.copy(ACTIVE, DEFAULT)


def get_rules():
    """All rules for the Rule Settings tab (value, source label, locked flag, whether it can be changed)."""
    return list(rules_engine.load_rules().values())


def _check_value(rule, value):
    if not rule.get("adjustable", True):
        raise RuleSettingsError(f"{rule['id']} is not a single number, so it cannot be changed here.")
    try:
        value = float(value)
    except (TypeError, ValueError):
        raise RuleSettingsError("Enter a number.")
    if not (rule["min"] <= value <= rule["max"]):
        raise RuleSettingsError(f"{rule['id']}: value must be between {rule['min']} and {rule['max']}.")
    return int(value) if value == int(value) else value


def _with_value(rule_id, value):
    rules = {k: dict(v) for k, v in rules_engine.load_rules().items()}
    rules[rule_id]["value"] = value
    return rules


def preview_impact(rule_id, new_value, today=None, sample=10):
    """What would change if this number were used? Counts of RED/AMBER/GREEN/GREY before and after + sample ids."""
    rule = rules_engine.load_rules().get(rule_id)
    if rule is None:
        raise RuleSettingsError(f"Unknown rule {rule_id}.")
    value = _check_value(rule, new_value)
    new_rules = _with_value(rule_id, value)
    if rule["who"] == "child":
        df = pd.read_csv(os.path.join(DATA_DIR, "children.csv"))
        idc, ev = "child_id", lambda r, rules: rules_engine.evaluate_child(r, today, rules)
    else:
        df = pd.read_csv(os.path.join(DATA_DIR, "mothers.csv"))
        idc, ev = "mother_id", lambda r, rules: rules_engine.evaluate_mother(r, rules)
    before, after, changed = {}, {}, []
    for _, r in df.iterrows():
        a, b = ev(r, None), ev(r, new_rules)
        before[a["colour"]] = before.get(a["colour"], 0) + 1
        after[b["colour"]] = after.get(b["colour"], 0) + 1
        if a["colour"] != b["colour"]:
            changed.append({"id": r[idc], "from": a["colour"], "to": b["colour"]})
    return {"rule_id": rule_id, "old_value": rule["value"], "new_value": value,
            "before": before, "after": after, "people_changed": len(changed), "sample_changed": changed[:sample]}


# ---------------------------------------------------------------- draft -> request -> approve / reject
def create_draft(rule_id, new_value, author, note=""):
    rule = rules_engine.load_rules().get(rule_id)
    if rule is None:
        raise RuleSettingsError(f"Unknown rule {rule_id}.")
    if rule["locked"]:
        raise RuleSettingsError(f"{rule_id} is a locked GUIDELINE rule. Use 'override with reason' instead.")
    value = _check_value(rule, new_value)
    drafts = _read(DRAFTS, [])
    d = {"draft_id": uuid.uuid4().hex[:8], "rule_id": rule_id, "old_value": rule["value"], "new_value": value,
         "author": author, "note": note, "status": "DRAFT", "created": _now()}
    drafts.append(d)
    _write(DRAFTS, drafts)
    _log("draft", rule_id, author, old=rule["value"], new=value)
    return d


def list_drafts(status=None):
    drafts = _read(DRAFTS, [])
    return [d for d in drafts if status is None or d["status"] == status]


def _get_draft(draft_id):
    drafts = _read(DRAFTS, [])
    for d in drafts:
        if d["draft_id"] == draft_id:
            return drafts, d
    raise RuleSettingsError(f"Draft {draft_id} not found.")


def request_approval(draft_id, user):
    drafts, d = _get_draft(draft_id)
    if d["status"] != "DRAFT":
        raise RuleSettingsError(f"Draft is already {d['status']}.")
    d["status"], d["requested_by"], d["requested"] = "PENDING_APPROVAL", user, _now()
    d["impact"] = preview_impact(d["rule_id"], d["new_value"])
    _write(DRAFTS, drafts)
    _log("request_approval", d["rule_id"], user, draft_id=draft_id)
    return d


def approve(draft_id, approver):
    drafts, d = _get_draft(draft_id)
    if d["status"] != "PENDING_APPROVAL":
        raise RuleSettingsError("Only a draft waiting for approval can be approved.")
    if approver == d["author"] or approver == d.get("requested_by"):
        raise RuleSettingsError("The person who drafted it cannot approve it. Ask another approver.")
    _apply(d["rule_id"], d["new_value"], source="APPROVED")
    d["status"], d["decided_by"], d["decided"] = "APPROVED", approver, _now()
    _write(DRAFTS, drafts)
    _log("approve", d["rule_id"], approver, draft_id=draft_id, old=d["old_value"], new=d["new_value"])
    return d


def reject(draft_id, approver, reason):
    if len((reason or "").strip()) < 3:
        raise RuleSettingsError("Give a short reason for rejecting.")
    drafts, d = _get_draft(draft_id)
    if d["status"] != "PENDING_APPROVAL":
        raise RuleSettingsError("Only a draft waiting for approval can be rejected.")
    d["status"], d["decided_by"], d["decided"], d["reject_reason"] = "REJECTED", approver, _now(), reason
    _write(DRAFTS, drafts)
    _log("reject", d["rule_id"], approver, draft_id=draft_id, reason=reason)
    return d


def _apply(rule_id, value, source=None, overridden_reason=None):
    with open(ACTIVE) as f:
        data = json.load(f)
    for r in data["rules"]:
        if r["id"] == rule_id:
            r["value"] = value
            if overridden_reason:
                r["overridden"] = {"reason": overridden_reason, "time": _now()}
    data["version"] = data.get("version", 1) + 1
    _write(ACTIVE, data)


def override_with_reason(rule_id, new_value, user, reason):
    """Change ANY adjustable rule, including locked GUIDELINE ones, with a written reason. Always logged."""
    rule = rules_engine.load_rules().get(rule_id)
    if rule is None:
        raise RuleSettingsError(f"Unknown rule {rule_id}.")
    if len((reason or "").strip()) < MIN_REASON_CHARS:
        raise RuleSettingsError(f"Write a reason of at least {MIN_REASON_CHARS} characters.")
    value = _check_value(rule, new_value)
    old = rule["value"]
    _apply(rule_id, value, overridden_reason=reason)
    _log("override", rule_id, user, old=old, new=value, reason=reason, locked=rule["locked"])
    return {"rule_id": rule_id, "old_value": old, "new_value": value, "reason": reason}


def reset(user, rule_id=None):
    """Put one rule (or all rules) back to the starting values. Pending drafts are kept."""
    _ensure_default()
    with open(DEFAULT) as f:
        default = json.load(f)
    if rule_id is None:
        with open(ACTIVE) as f:
            cur = json.load(f)
        default["version"] = cur.get("version", 1) + 1
        _write(ACTIVE, default)
    else:
        dv = {r["id"]: r for r in default["rules"]}
        if rule_id not in dv:
            raise RuleSettingsError(f"Unknown rule {rule_id}.")
        with open(ACTIVE) as f:
            cur = json.load(f)
        cur["rules"] = [dict(dv[r["id"]]) if r["id"] == rule_id else r for r in cur["rules"]]
        cur["version"] = cur.get("version", 1) + 1
        _write(ACTIVE, cur)
    _log("reset", rule_id or "ALL", user)


def history():
    """Change log, newest first (for the audit view)."""
    return list(reversed(_read(LOG, [])))


_ensure_default()
