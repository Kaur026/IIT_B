"""Deterministic centre summaries and immutable snapshot payloads."""

from collections import Counter
from datetime import datetime, timezone
from uuid import uuid4

from B2.demo_clock import DateLike, parse_date


ACTIVE_TASK_STATES = {"open", "assigned", "acknowledged", "in_progress", "escalated"}


def build_centre_summary(store, centre_id: str, as_of: DateLike):
    report_date = parse_date(as_of).isoformat()
    beneficiaries = store.list_beneficiaries(centre_id)
    flags = [f for f in store.list_flags(centre_id=centre_id)
             if str(f.get("created_at", ""))[:10] <= report_date]
    tasks = [t for t in store.list_tasks(centre_id=centre_id)
             if str(t.get("created_on", ""))[:10] <= report_date]
    referrals = [r for r in store.list_referrals(centre_id=centre_id)
                 if str(r.get("created_at", ""))[:10] <= report_date]
    exceptions = [x for x in store.list_exceptions(centre_id=centre_id)
                  if str(x.get("opened_at", ""))[:10] <= report_date]
    measurements = []
    for beneficiary in beneficiaries:
        measurements.extend(store.list_measurements(beneficiary["beneficiary_id"]))
    measurements = [m for m in measurements if str(m.get("recorded_at", ""))[:10] <= report_date]

    flag_counts = Counter(str(f.get("colour", "unknown")).lower() for f in flags)
    task_counts = Counter(str(t.get("status", "unknown")).lower() for t in tasks)
    referral_counts = Counter(str(r.get("status", "unknown")).lower() for r in referrals)
    exception_counts = Counter(str(x.get("status", "unknown")).lower() for x in exceptions)
    active = [t for t in tasks if t.get("status") in ACTIVE_TASK_STATES]
    overdue_referrals = [r for r in referrals if r.get("due_on")
                         and str(r.get("due_on"))[:10] < report_date
                         and r.get("status") not in {"outcome_recorded", "not_needed"}]
    action_items = []
    task_flag_ids = {t.get("flag_id") for t in tasks if t.get("flag_id")}
    for flag in flags:
        if flag.get("flag_id") not in task_flag_ids and str(flag.get("colour", "")).upper() != "GREEN":
            action_items.append({
                "item_type": "flag_without_active_task", "item_id": flag["flag_id"],
                "beneficiary_id": flag.get("beneficiary_id"), "status": flag.get("colour"),
                "source_id": flag.get("measurement_id"),
                "link": f"/api/cases/{flag.get('beneficiary_id')}/explain?flag_id={flag['flag_id']}",
            })
    for task in active:
        action_items.append({
            "item_type": "task", "item_id": task["task_id"],
            "beneficiary_id": task.get("beneficiary_id"), "status": task.get("status"),
            "source_id": task.get("flag_id"),
            "link": f"/api/beneficiaries/{task.get('beneficiary_id')}/history",
        })
    for referral in overdue_referrals:
        action_items.append({
            "item_type": "overdue_referral", "item_id": referral["referral_id"],
            "beneficiary_id": referral.get("beneficiary_id"), "status": referral.get("status"),
            "source_id": referral.get("task_id") or referral["referral_id"],
            "link": f"/api/referrals/{referral['referral_id']}",
        })
    for item in exceptions:
        if item.get("status") == "open":
            action_items.append({
                "item_type": "open_access_exception", "item_id": item["exception_id"],
                "beneficiary_id": item.get("beneficiary_id"), "status": item.get("status"),
                "source_id": item.get("task_id") or item["exception_id"],
                "link": f"/api/access-exceptions/{item['exception_id']}",
            })

    return {
        "snapshot_id": str(uuid4()),
        "centre_id": centre_id,
        "as_of": report_date,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": "deterministic_backend_counts",
        "counts": {
            "beneficiaries": len(beneficiaries),
            "measurements": len(measurements),
            "remeasurements": sum(m.get("source") == "remeasurement" for m in measurements),
            "flags": {"total": len(flags), "by_colour": dict(flag_counts)},
            "tasks": {"total": len(tasks), "by_status": dict(task_counts), "active": len(active)},
            "referrals": {"total": len(referrals), "by_status": dict(referral_counts), "overdue_with_explicit_due_date": len(overdue_referrals)},
            "access_exceptions": {"total": len(exceptions), "by_status": dict(exception_counts)},
        },
        "action_items": action_items,
        "source": "backend SQLite records; counts computed by deterministic code, never supplied by AI",
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
    }
