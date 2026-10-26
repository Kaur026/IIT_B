"""Mock-first, record-grounded Day 1 AI service helpers.

No external model is called. Every explanation/history/suggestion is derived
only from saved synthetic records. Later model wording may replace these text
fields, but counts, permissions, rule decisions and workflow actions remain code-
controlled. These outputs are not diagnosis or treatment advice.
"""

from uuid import NAMESPACE_URL, uuid4, uuid5

from B2.demo_clock import DateLike, parse_date


class AIServiceError(ValueError):
    """Raised when a requested explanation or decision references missing data."""


def explain_case(store, beneficiary_id: str, flag_id: str):
    flag = store.get_flag(flag_id)
    if flag is None or flag.get("beneficiary_id") != beneficiary_id:
        raise AIServiceError("Saved flag not found for this beneficiary.")
    reasons = flag.get("reasons") or []
    missing = flag.get("missing_fields") or []
    source_values = flag.get("source_values") or {}
    rule_ids = sorted({str(r.get("rule_id")) for r in reasons if isinstance(r, dict) and r.get("rule_id")})
    text = (
        f"Saved record {flag.get('measurement_id')} was evaluated under rule version "
        f"{flag.get('rule_version')}. The stored flag is {flag.get('colour') or 'unavailable'}."
    )
    if reasons:
        text += " Recorded reasons: " + " ".join(str(r.get("text", "")) for r in reasons if isinstance(r, dict))
    if missing:
        text += " Missing or quality-check fields: " + ", ".join(missing) + "."
    return {
        "beneficiary_id": beneficiary_id,
        "flag_id": flag_id,
        "mode": "mock_record_grounded",
        "rule_ids": rule_ids,
        "rule_version": flag.get("rule_version"),
        "colour": flag.get("colour"),
        "source_measurement_id": flag.get("measurement_id"),
        "source_values": source_values,
        "reasons": reasons,
        "missing_fields": missing,
        "explanation": text,
        "needs_human_verification": True,
        "disclaimer": "A flag is not a diagnosis. This mock explanation only restates saved records and rules.",
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
    }


def history_summary(store, beneficiary_id: str):
    beneficiary = store.get_beneficiary(beneficiary_id)
    if beneficiary is None:
        raise AIServiceError("Beneficiary not found.")
    measurements = store.list_measurements(beneficiary_id)
    flags = store.list_flags(beneficiary_id=beneficiary_id)
    tasks = store.list_tasks(beneficiary_id=beneficiary_id)
    referrals = store.list_referrals(beneficiary_id=beneficiary_id)
    exceptions = store.list_exceptions(beneficiary_id=beneficiary_id)
    decisions = store.list_decisions(beneficiary_id=beneficiary_id)
    audits = store.list_audit(entity_type=None, entity_id=None, centre_id=beneficiary["centre_id"])
    relevant_ids = ({beneficiary_id}
                    | {t.get("task_id") for t in tasks}
                    | {f.get("flag_id") for f in flags}
                    | {m.get("measurement_id") for m in measurements}
                    | {r.get("referral_id") for r in referrals}
                    | {x.get("exception_id") for x in exceptions}
                    | {d.get("decision_id") for d in decisions})
    audits = [a for a in audits if a.get("entity_id") in relevant_ids]

    timeline = []
    for record in measurements:
        timeline.append({
            "at": record.get("recorded_at"), "type": record.get("source", "measurement"),
            "record_id": record.get("measurement_id"), "source_record_id": record.get("parent_measurement_id") or record.get("measurement_id"),
            "summary": "Measurement record saved; see linked record for original values.",
        })
    for flag in flags:
        timeline.append({"at": flag.get("created_at"), "type": "flag", "record_id": flag.get("flag_id"), "source_record_id": flag.get("measurement_id"), "summary": f"Saved {flag.get('colour')} flag; human verification required."})
    for task in tasks:
        timeline.append({"at": task.get("created_on"), "type": "task", "record_id": task.get("task_id"), "source_record_id": task.get("flag_id"), "summary": f"Task status: {task.get('status')}."})
    for referral in referrals:
        timeline.append({"at": referral.get("created_at"), "type": "referral", "record_id": referral.get("referral_id"), "source_record_id": referral.get("task_id") or beneficiary_id, "summary": f"{referral.get('referral_kind')} referral status: {referral.get('status')}."})
    for exception in exceptions:
        timeline.append({"at": exception.get("opened_at"), "type": "access_exception", "record_id": exception.get("exception_id"), "source_record_id": exception.get("task_id") or beneficiary_id, "summary": f"Access exception status: {exception.get('status')}; human review only."})
    for decision in decisions:
        timeline.append({"at": decision.get("created_at"), "type": "next_action_decision", "record_id": decision.get("decision_id"), "source_record_id": decision.get("flag_id"), "summary": f"Next-action suggestion was {decision.get('decision')} by {decision.get('actor_id')}."})
    for event in audits:
        timeline.append({"at": event.get("occurred_at"), "type": "audit", "record_id": event.get("event_id"), "source_record_id": event.get("entity_id"), "summary": f"{event.get('action')} by {event.get('actor_id')}"})
    timeline.sort(key=lambda item: (str(item.get("at") or ""), str(item.get("record_id") or "")))

    return {
        "beneficiary_id": beneficiary_id,
        "centre_id": beneficiary["centre_id"],
        "mode": "mock_timeline_summary",
        "counts": {"measurements": len(measurements), "flags": len(flags), "tasks": len(tasks),
                   "referrals": len(referrals), "access_exceptions": len(exceptions),
                   "next_action_decisions": len(decisions), "audit_events": len(audits)},
        "timeline": timeline,
        "original_records_preserved": True,
        "disclaimer": "Summary reflects only saved synthetic records; it does not infer health status or treatment.",
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
    }


def suggest_next_action(store, beneficiary_id: str, flag_id: str):
    flag = store.get_flag(flag_id)
    if flag is None or flag.get("beneficiary_id") != beneficiary_id:
        raise AIServiceError("Saved flag not found for this beneficiary.")
    measurements = store.list_measurements(beneficiary_id)
    source = store.get_measurement(flag.get("measurement_id"))
    tasks = [t for t in store.list_tasks(beneficiary_id=beneficiary_id) if t.get("status") != "closed"]

    source_valid = str(source.get("measurement_valid", True)).strip().lower() not in {"false", "0", "no"} if source else True
    if source and not source_valid:
        action, reason = "verify_measurement", "The saved measurement has a data-quality issue; request human remeasurement."
    elif not tasks:
        action, reason = "create_task", "The saved flag has no active task; route it for human review."
    else:
        latest = tasks[-1]
        transitions = {
            "open": ("assign", "Assign the open task to an authorized worker."),
            "assigned": ("acknowledge", "Ask the assigned worker to acknowledge the task."),
            "acknowledged": ("start", "The assigned worker may start the task."),
            "in_progress": ("record_progress", "Record a workflow progress update; this cannot close the task."),
            "escalated": ("acknowledge", "The authorized new owner may acknowledge the escalated task."),
        }
        action, reason = transitions.get(latest.get("status"), ("human_review", "Review the saved workflow state."))

    state_token = "|".join(
        f"{task.get('task_id')}:{task.get('status')}:{task.get('owner_id') or ''}"
        for task in tasks
    )
    suggestion_id = str(uuid5(NAMESPACE_URL, f"{beneficiary_id}:{flag_id}:{action}:{state_token}"))
    return {
        "beneficiary_id": beneficiary_id,
        "flag_id": flag_id,
        "suggestion_id": suggestion_id,
        "mode": "mock_rules_based",
        "action_code": action,
        "suggested_action": reason,
        "based_on": {"flag_id": flag_id, "measurement_ids": [m.get("measurement_id") for m in measurements], "active_task_ids": [t.get("task_id") for t in tasks]},
        "options": ["accept", "edit", "reject"],
        "can_close_task": False,
        "treatment_advice": False,
        "disclaimer": "A human must review this suggestion. It is not a diagnosis, eligibility decision, or treatment recommendation.",
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
    }


def record_next_action_decision(store, suggestion: dict, actor_id: str, decision: str, on: DateLike, edited_action: str = "", reason: str = "", action_code_override: str = ""):
    decision_value = str(decision or "").strip().lower()
    if decision_value not in {"accept", "edit", "reject"}:
        raise AIServiceError("decision must be accept, edit, or reject.")
    if decision_value == "edit" and not str(edited_action or "").strip():
        raise AIServiceError("edited_action is required when decision is edit.")
    if decision_value == "reject" and not str(reason or "").strip():
        raise AIServiceError("reason is required when a suggestion is rejected.")
    action_code = (action_code_override or suggestion["action_code"]) if decision_value != "edit" else (action_code_override or "edited")
    active_task_ids = suggestion.get("based_on", {}).get("active_task_ids", [])
    if action_code == "create_task":
        follow_up = {"method": "POST", "path": "/api/tasks", "payload_hint": {"flag_id": suggestion["flag_id"]}}
    elif action_code == "verify_measurement":
        follow_up = {"method": "POST", "path": "/api/verification", "payload_hint": {"beneficiary_id": suggestion["beneficiary_id"]}}
    elif action_code in {"assign", "acknowledge", "start", "record_progress"} and active_task_ids:
        follow_up = {"method": "POST", "path": f"/api/tasks/{active_task_ids[0]}/actions", "payload_hint": {"action": action_code}}
    else:
        follow_up = None
    was_dispatched = decision_value in {"accept", "edit"}
    record = {
        "decision_id": str(uuid4()),
        "beneficiary_id": suggestion["beneficiary_id"],
        "centre_id": suggestion.get("centre_id", ""),
        "flag_id": suggestion["flag_id"],
        "suggestion_id": suggestion["suggestion_id"],
        "actor_id": actor_id,
        "decision": decision_value,
        "action_code": action_code,
        "follow_up": follow_up if was_dispatched else None,
        "edited_action": str(edited_action or "").strip(),
        "reason": str(reason or "").strip(),
        "created_at": parse_date(on).isoformat(),
        "dispatch_required": was_dispatched,
        "normal_task_api_required": was_dispatched,
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
    }
    store.add_decision(record)
    return record


def daily_briefing(store, centre_id: str, as_of: DateLike):
    """Calculate an auditable non-AI briefing from saved records only."""
    from B2.summary import build_centre_summary

    snapshot = build_centre_summary(store, centre_id, as_of)
    source = snapshot["counts"]
    action_items = snapshot["action_items"]
    return {
        "centre_id": centre_id,
        "as_of": snapshot["as_of"],
        "mode": "deterministic_non_ai",
        "counts": {
            "flags": source["flags"]["total"],
            "by_colour": source["flags"]["by_colour"],
            "tasks": source["tasks"]["total"],
            "by_task_status": source["tasks"]["by_status"],
            "active_tasks": source["tasks"]["active"],
            "referrals": source["referrals"]["total"],
            "by_referral_status": source["referrals"]["by_status"],
            "overdue_referrals": source["referrals"]["overdue_with_explicit_due_date"],
            "access_exceptions": source["access_exceptions"]["total"],
            "measurements": source["measurements"],
            "remeasurements": source["remeasurements"],
        },
        "action_items": action_items,
        "counts_source": "saved backend records; calculated by code, not generated by AI",
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
    }
