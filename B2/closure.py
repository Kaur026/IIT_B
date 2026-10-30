"""Configurable two-key case closure gate.

The API enforces the configured confirmation keys and recorded outcome. No
closure policy is activated by default: the supervisor/team must supply an
approved per-case-type policy before this gate can close any case.
"""

from copy import deepcopy
from uuid import uuid4

from B2.demo_clock import DateLike, parse_date
from B2.tasks import OUTCOME_OPTIONS


def _canonical_confirmation_role(role: str) -> str:
    value = str(role or "").strip().lower()
    return {"worker": "aww", "supervisor": "ls", "anm_block": "ls"}.get(value, value)


class ClosureError(ValueError):
    """Raised when a closure policy or confirmation is invalid/incomplete."""


def policy_for(policies: dict, case_type: str):
    if not isinstance(policies, dict) or policies.get("approved") is not True:
        return None
    version = policies.get("version")
    if not isinstance(version, str) or not version.strip():
        return None
    case_types = policies.get("case_types")
    if not isinstance(case_types, dict):
        return None
    selected = case_types.get(case_type) or case_types.get("default")
    if not isinstance(selected, dict):
        return None
    keys = selected.get("confirmations")
    if not isinstance(keys, list) or len(keys) < 2:
        return None
    valid = []
    seen = set()
    for item in keys:
        if not isinstance(item, dict):
            return None
        key, role = item.get("key"), item.get("role")
        if not isinstance(key, str) or not key.strip() or not isinstance(role, str) or not role.strip():
            return None
        if key in seen:
            return None
        seen.add(key)
        valid.append({"key": key.strip(), "role": role.strip()})
    if len({_canonical_confirmation_role(item["role"]) for item in valid}) < 2:
        return None
    return {"policy_version": version.strip(),
            "case_type": case_type, "confirmations": valid,
            "outcome_required": selected.get("outcome_required", True) is True}


def record_confirmation(confirmations: list, policy: dict, confirmation_key: str,
                        actor_id: str, actor_role: str, on: DateLike,
                        outcome: str = "", notes: str = ""):
    if not isinstance(confirmations, list) or not isinstance(policy, dict):
        raise ClosureError("confirmations and an approved policy are required.")
    key = str(confirmation_key or "").strip()
    actor = str(actor_id or "").strip()
    role = str(actor_role or "").strip()
    required = next((item for item in policy["confirmations"] if item["key"] == key), None)
    if required is None:
        raise ClosureError("confirmation_key is not required by the approved policy.")
    if _canonical_confirmation_role(role) != _canonical_confirmation_role(required["role"]):
        raise ClosureError("actor role does not match the required confirmation role.")
    if not actor:
        raise ClosureError("actor_id is required.")
    records = deepcopy(confirmations)
    if any(item.get("policy_version") != policy["policy_version"] for item in records):
        raise ClosureError("Existing confirmations were recorded under a different closure-policy version.")
    if any(item.get("confirmation_key") == key for item in records):
        raise ClosureError("This confirmation key has already been recorded.")
    if any(item.get("actor_id") == actor for item in records):
        raise ClosureError("The same actor cannot provide both closure confirmations.")
    value = str(outcome or "").strip().lower()
    if value and value not in OUTCOME_OPTIONS:
        raise ClosureError("outcome is not an allowed task outcome.")
    note = str(notes or "").strip()
    if value == "other" and not note:
        raise ClosureError("A note is required when outcome is 'other'.")
    prior_outcomes = {item.get("outcome") for item in records if item.get("outcome")}
    if value and prior_outcomes and value not in prior_outcomes:
        raise ClosureError("Closure confirmations have conflicting outcomes.")
    records.append({
        "confirmation_id": str(uuid4()), "confirmation_key": key,
        "actor_id": actor, "role": role, "at": parse_date(on).isoformat(),
        "outcome": value or None, "notes": note,
        "policy_version": policy["policy_version"],
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
    })
    return records


def closure_readiness(confirmations: list, policy: dict):
    if not isinstance(confirmations, list) or not isinstance(policy, dict):
        raise ClosureError("confirmations and policy are required.")
    by_key = {item.get("confirmation_key"): item for item in confirmations}
    missing = [item["key"] for item in policy["confirmations"] if item["key"] not in by_key]
    outcomes = {item.get("outcome") for item in confirmations if item.get("outcome")}
    if not outcomes:
        missing.append("outcome")
    actors = [item.get("actor_id") for item in confirmations]
    # This workflow always requires a recorded task outcome before closure,
    # even if an experimental policy incorrectly tries to make it optional.
    ready = not missing and len(actors) == len(set(actors)) and len(outcomes) == 1
    if len(outcomes) > 1:
        ready = False
    return {"ready": ready, "missing_confirmations": missing,
            "outcome": next(iter(outcomes)) if len(outcomes) == 1 else None,
            "policy_version": policy["policy_version"],
            "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}
