"""BE2 F7 role and workload helpers for a synthetic UI prototype.

These helpers enforce prototype actions only. A UI role switch is not
authentication; production authorization must derive a verified user and role
from a trusted identity provider/server session.
"""

from collections import defaultdict

from B2.demo_clock import parse_date


ROLE_PERMISSIONS = {
    "worker": frozenset({"view_own_tasks", "acknowledge_task", "complete_task", "record_contact_attempt"}),
    "supervisor": frozenset({"view_all_tasks", "acknowledge_task", "complete_task", "reassign_task", "escalate_task", "view_workload", "record_contact_attempt", "log_referral_outcome"}),
    "anm_block": frozenset({"view_all_tasks", "acknowledge_task", "complete_task", "reassign_task", "escalate_task", "view_workload", "record_contact_attempt", "log_referral_outcome"}),
    "district": frozenset({"view_all_tasks", "view_workload", "view_referral_summary"}),
    "admin": frozenset({"view_all_tasks", "view_workload", "manage_demo_roles"}),
}
ACTIVE_TASK_STATUSES = frozenset({"open", "acknowledged", "escalated"})


class RolePermissionError(PermissionError):
    """Raised when a prototype role cannot perform an action."""


def has_permission(role: str, permission: str) -> bool:
    """Return whether the named prototype role has an action permission."""
    role_value = str(role or "").strip().lower()
    permission_value = str(permission or "").strip()
    return permission_value in ROLE_PERMISSIONS.get(role_value, frozenset())


def require_permission(role: str, permission: str) -> None:
    """Raise a readable error if the prototype role lacks a permission."""
    if not has_permission(role, permission):
        raise RolePermissionError(f"Role {role!r} cannot perform {permission!r}.")


def visible_tasks(tasks: list, actor_id: str, role: str) -> list:
    """Filter tasks by prototype role; workers only see tasks assigned to them."""
    if not isinstance(tasks, list):
        raise ValueError("tasks must be a list.")
    role_value = str(role or "").strip().lower()
    if role_value not in ROLE_PERMISSIONS:
        raise RolePermissionError("Unknown role.")
    if role_value == "worker":
        if not isinstance(actor_id, str) or not actor_id.strip():
            raise RolePermissionError("Worker identity is required.")
        return [t for t in tasks if isinstance(t, dict) and t.get("owner_id") == actor_id.strip()]
    require_permission(role_value, "view_all_tasks")
    return [t for t in tasks if isinstance(t, dict)]


def tasks_per_worker(tasks: list) -> dict:
    """Count active tasks by owner, including status breakdowns."""
    if not isinstance(tasks, list):
        raise ValueError("tasks must be a list.")
    result = {}
    for task in tasks:
        if not isinstance(task, dict) or task.get("status") not in ACTIVE_TASK_STATUSES:
            continue
        owner = task.get("owner_id") or "unassigned"
        row = result.setdefault(owner, {"total_active": 0, "by_status": {s: 0 for s in sorted(ACTIVE_TASK_STATUSES)}})
        row["total_active"] += 1
        row["by_status"][task["status"]] += 1
    return result


def worker_capacity(tasks: list, worker_id: str, max_active_tasks: int) -> dict:
    """Return a transparent workload guard; cap is caller-supplied, not invented."""
    if not isinstance(worker_id, str) or not worker_id.strip():
        raise ValueError("worker_id is required.")
    if isinstance(max_active_tasks, bool) or not isinstance(max_active_tasks, int) or max_active_tasks < 0:
        raise ValueError("max_active_tasks must be a non-negative integer.")
    counts = tasks_per_worker(tasks)
    active = counts.get(worker_id.strip(), {}).get("total_active", 0)
    return {
        "worker_id": worker_id.strip(),
        "active_tasks": active,
        "max_active_tasks": max_active_tasks,
        "can_assign": active < max_active_tasks,
        "label": "PROPOSED WORKLOAD CAP — confirm with the team",
    }


def require_capacity(tasks: list, worker_id: str, max_active_tasks: int) -> None:
    """Raise before assignment when a worker has reached the configured cap."""
    result = worker_capacity(tasks, worker_id, max_active_tasks)
    if not result["can_assign"]:
        raise RolePermissionError(
            f"Worker {worker_id} has reached the configured active-task limit "
            f"({result['active_tasks']}/{result['max_active_tasks']})."
        )


def weekly_grouping(tasks: list) -> dict:
    """Group tasks by ISO week of creation and current owner for a prototype chart."""
    if not isinstance(tasks, list):
        raise ValueError("tasks must be a list.")
    groups = defaultdict(lambda: {"total": 0, "by_status": {}, "by_worker": {}})
    for task in tasks:
        if not isinstance(task, dict) or not task.get("created_on"):
            continue
        created = parse_date(task["created_on"])
        iso = created.isocalendar()
        week_key = f"{iso.year}-W{iso.week:02d}"
        row = groups[week_key]
        row["total"] += 1
        status = str(task.get("status", "unknown"))
        row["by_status"][status] = row["by_status"].get(status, 0) + 1
        worker = task.get("owner_id") or "unassigned"
        row["by_worker"][worker] = row["by_worker"].get(worker, 0) + 1
    return {week: groups[week] for week in sorted(groups)}
