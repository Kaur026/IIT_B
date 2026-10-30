"""Authoritative server-side roles, permissions, and organization scope checks.

Demo actors exist only for explicitly selected synthetic local/test mode. They
are not authenticated identities and must never be enabled for production.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID

from B2.demo_clock import parse_date


class RolePermissionError(PermissionError):
    """Raised when an identity, role, or organization assignment is not allowed."""


class AuthorizationServiceUnavailable(RolePermissionError):
    """Raised when trusted authorization storage cannot safely answer a request."""


@dataclass(frozen=True)
class OrganizationScope:
    """A trusted server-side assignment to a node in the organization tree."""

    kind: str
    organization_id: str

    def __post_init__(self):
        if self.kind not in {"centre", "sector", "project", "district"}:
            raise ValueError("Unsupported organization scope type.")
        if not isinstance(self.organization_id, str) or not self.organization_id.strip():
            raise ValueError("organization_id is required.")


class OrganizationHierarchy(Protocol):
    def validate_scope(self, scope: "OrganizationScope") -> bool:
        """Validate the assigned node and every ancestor are present and active."""
        ...

    def contains_centre(self, scope_type: str, scope_id: str, centre_id: str) -> bool:
        """Return ancestry from trusted server-side organization records."""
        ...

    def centres_in_scope(self, scope_type: str, scope_id: str) -> tuple[str, ...]:
        """Return centre IDs below a trusted organization assignment."""
        ...


class ApplicationAccountRepository(Protocol):
    def get_by_subject(self, subject_id: UUID) -> "ApplicationAccountRecord | None":
        """Load one application account by verified Supabase subject UUID."""
        ...


class RoleAssignmentRepository(Protocol):
    def list_for_subject(self, subject_id: UUID) -> tuple["RoleAssignmentRecord", ...]:
        """Load trusted current and historical assignment records for a subject."""
        ...


class AssignmentResolver(Protocol):
    def resolve_assignments(self, subject_id: UUID) -> "AccountAuthorizationRecord | None":
        """Resolve account and assignments using trusted repository interfaces."""
        ...


class WorkerMappingResolver(Protocol):
    def resolve_mappings(self, subject_id: UUID, centre_id: str) -> tuple["WorkerMappingRecord", ...]:
        """Load trusted current and historical worker mappings for this account and centre."""
        ...


class OrganizationNodeRepository(Protocol):
    def get_node(self, kind: str, organization_id: str) -> "OrganizationNodeRecord | None":
        """Load one trusted organization node by type and ID."""
        ...

    def list_nodes(self, kind: str) -> tuple["OrganizationNodeRecord", ...]:
        """List trusted nodes of one type for aggregate scope expansion."""
        ...


@dataclass(frozen=True)
class Principal:
    actor_id: str
    role: str
    centre_ids: tuple = ()  # Explicit synthetic-only centre assignments.
    assigned_worker_id: str = ""
    organization_scopes: tuple[OrganizationScope, ...] = ()
    is_active: bool = True
    subject_id: str = ""


@dataclass(frozen=True)
class RoleAssignmentRecord:
    """One trusted assignment row returned by the server-side resolver.

    ``scope_type='global'`` with no ``scope_id`` represents the global scope
    allowed for public/administrative roles.
    """

    role: str
    scope_type: str
    scope_id: str | None
    valid_from: datetime
    valid_until: datetime | None = None
    revoked_at: datetime | None = None
    is_active: bool = True


@dataclass(frozen=True)
class ApplicationAccountRecord:
    subject_id: UUID
    is_active: bool


@dataclass(frozen=True)
class AccountAuthorizationRecord:
    """Trusted account state plus assignment rows loaded for a subject UUID."""

    subject_id: UUID
    is_active: bool
    assignments: tuple[RoleAssignmentRecord, ...]


@dataclass(frozen=True)
class WorkerMappingRecord:
    subject_id: UUID
    worker_id: str
    centre_id: str
    valid_from: datetime
    valid_until: datetime | None = None
    revoked_at: datetime | None = None
    is_active: bool = True
    worker_is_active: bool = True


@dataclass(frozen=True)
class OrganizationNodeRecord:
    kind: str
    organization_id: str
    parent_type: str | None
    parent_id: str | None
    is_active: bool = True


class RepositoryAssignmentResolver:
    """Compose server-side account and assignment repositories (no DB driver)."""

    def __init__(self, accounts: ApplicationAccountRepository, assignments: RoleAssignmentRepository):
        self._accounts = accounts
        self._assignments = assignments

    def resolve_assignments(self, subject_id: UUID) -> AccountAuthorizationRecord | None:
        if not isinstance(subject_id, UUID):
            raise RolePermissionError("A verified subject UUID is required.")
        if self._accounts is None or self._assignments is None:
            raise AuthorizationServiceUnavailable("Trusted account and assignment repositories are unavailable.")
        try:
            account = self._accounts.get_by_subject(subject_id)
        except Exception:
            raise AuthorizationServiceUnavailable("Trusted account lookup is unavailable.") from None
        if account is None:
            return None
        if not isinstance(account, ApplicationAccountRecord) or account.subject_id != subject_id:
            raise RolePermissionError("Trusted account record is inconsistent.")
        try:
            rows = self._assignments.list_for_subject(subject_id)
        except Exception:
            raise AuthorizationServiceUnavailable("Trusted assignment lookup is unavailable.") from None
        if not isinstance(rows, (tuple, list)):
            raise RolePermissionError("Trusted assignment repository returned malformed records.")
        if any(not isinstance(row, RoleAssignmentRecord) for row in rows):
            raise RolePermissionError("Trusted assignment repository returned malformed records.")
        return AccountAuthorizationRecord(subject_id, account.is_active, tuple(rows))


class RepositoryOrganizationHierarchy:
    """Validate organization scope against an injected trusted node repository."""

    _parent_types = {
        "district": None,
        "project": "district",
        "sector": "project",
        "centre": "sector",
    }

    def __init__(self, nodes: OrganizationNodeRepository):
        self._nodes = nodes

    def validate_scope(self, scope: OrganizationScope) -> bool:
        if self._nodes is None:
            raise AuthorizationServiceUnavailable("Organization hierarchy repository is unavailable.")
        if not isinstance(scope, OrganizationScope):
            return False
        kind = scope.kind
        organization_id = scope.organization_id
        visited = set()
        try:
            while kind in self._parent_types:
                key = (kind, organization_id)
                if key in visited:
                    return False
                visited.add(key)
                node = self._nodes.get_node(kind, organization_id)
                if (
                    not isinstance(node, OrganizationNodeRecord)
                    or node.kind != kind
                    or node.organization_id != organization_id
                    or node.is_active is not True
                ):
                    return False
                expected_parent = self._parent_types[kind]
                if expected_parent is None:
                    return node.parent_type is None and node.parent_id is None
                if node.parent_type != expected_parent or not isinstance(node.parent_id, str) or not node.parent_id.strip():
                    return False
                kind, organization_id = expected_parent, node.parent_id
        except Exception:
            raise AuthorizationServiceUnavailable("Organization hierarchy lookup is unavailable.") from None
        return False

    def contains_centre(self, scope_type: str, scope_id: str, centre_id: str) -> bool:
        try:
            if not self.validate_scope(OrganizationScope(scope_type, scope_id)):
                return False
            if not self.validate_scope(OrganizationScope("centre", centre_id)):
                return False
            node = self._nodes.get_node("centre", centre_id)
            while isinstance(node, OrganizationNodeRecord):
                if (node.kind, node.organization_id) == (scope_type, scope_id):
                    return True
                if node.parent_type is None or node.parent_id is None:
                    return False
                node = self._nodes.get_node(node.parent_type, node.parent_id)
        except Exception:
            raise AuthorizationServiceUnavailable("Organization ancestry lookup is unavailable.") from None
        return False

    def centres_in_scope(self, scope_type: str, scope_id: str) -> tuple[str, ...]:
        try:
            scope = OrganizationScope(scope_type, scope_id)
            if not self.validate_scope(scope):
                return ()
            centres = self._nodes.list_nodes("centre")
            return tuple(sorted({
                node.organization_id
                for node in centres
                if isinstance(node, OrganizationNodeRecord)
                and self.contains_centre(scope_type, scope_id, node.organization_id)
            }))
        except Exception:
            raise AuthorizationServiceUnavailable("Organization directory lookup is unavailable.") from None


def resolve_authorized_principal(subject_id: UUID, resolver, hierarchy,
                                 *, worker_mapping_resolver: WorkerMappingResolver | None = None,
                                 now: datetime | None = None) -> Principal:
    """Resolve one current server assignment into a request-scoped principal.

    The resolver receives only the verified provider subject UUID. It must load
    account state and assignments from trusted server storage. No browser role,
    scope, worker ID, or JWT metadata is accepted here.
    """
    if not isinstance(subject_id, UUID):
        raise RolePermissionError("A verified subject UUID is required.")
    if resolver is None:
        raise AuthorizationServiceUnavailable("Trusted assignment service is unavailable.")
    try:
        account = resolver.resolve_assignments(subject_id)
    except AuthorizationServiceUnavailable:
        raise
    except Exception:
        raise AuthorizationServiceUnavailable("Trusted assignment lookup is unavailable.") from None
    if account is None:
        raise RolePermissionError("No application account assignment is available.")
    if not isinstance(account, AccountAuthorizationRecord):
        raise AuthorizationServiceUnavailable("Trusted account assignment data is unavailable.")
    if account.subject_id != subject_id or account.is_active is not True:
        raise RolePermissionError("The application account is disabled or inconsistent.")

    current_time = now or datetime.now(timezone.utc)
    if (
        not isinstance(current_time, datetime)
        or current_time.tzinfo is None
        or current_time.utcoffset() is None
    ):
        raise RolePermissionError("Authorization time must include a timezone.")
    rows = account.assignments
    if not isinstance(rows, (tuple, list)):
        raise RolePermissionError("Trusted assignment data is malformed.")
    effective = []
    for row in rows:
        if not isinstance(row, RoleAssignmentRecord):
            raise RolePermissionError("Trusted assignment data is malformed.")
        if not isinstance(row.valid_from, datetime) or row.valid_from.tzinfo is None or row.valid_from.utcoffset() is None:
            raise RolePermissionError("Trusted assignment validity is malformed.")
        if row.valid_until is not None and (
            not isinstance(row.valid_until, datetime)
            or row.valid_until.tzinfo is None
            or row.valid_until.utcoffset() is None
            or row.valid_until <= row.valid_from
        ):
            raise RolePermissionError("Trusted assignment validity is malformed.")
        if row.revoked_at is not None and (
            not isinstance(row.revoked_at, datetime)
            or row.revoked_at.tzinfo is None
            or row.revoked_at.utcoffset() is None
        ):
            raise RolePermissionError("Trusted assignment revocation is malformed.")
        if (
            row.is_active is True
            and row.revoked_at is None
            and row.valid_from <= current_time
            and (row.valid_until is None or current_time < row.valid_until)
        ):
            effective.append(row)
    if len(effective) != 1:
        raise RolePermissionError("Exactly one current, active assignment is required.")

    assignment = effective[0]
    role = assignment.role
    scope_kinds = {
        "AWW": {"centre"},
        "LS": {"sector", "centre"},
        "CDPO": {"project"},
        "DPO": {"district"},
        "User": {"global"},
        "System Administrator": {"global"},
        "Rule Administrator": {"global"},
    }
    if not isinstance(role, str) or role not in scope_kinds:
        raise RolePermissionError("Unsupported or inconsistent role assignment.")
    if not isinstance(assignment.scope_type, str) or assignment.scope_type not in scope_kinds[role]:
        raise RolePermissionError("Role and organization scope are incompatible.")
    if assignment.scope_type == "global":
        if assignment.scope_id is not None:
            raise RolePermissionError("Global assignments cannot name an organization node.")
        scope = None
    else:
        if not isinstance(assignment.scope_id, str) or not assignment.scope_id.strip():
            raise RolePermissionError("A valid assigned organization node is required.")
        if hierarchy is None:
            raise AuthorizationServiceUnavailable("Organization hierarchy is unavailable.")
        scope = OrganizationScope(assignment.scope_type, assignment.scope_id)
        try:
            valid_scope = hierarchy.validate_scope(scope)
        except AuthorizationServiceUnavailable:
            raise
        except Exception:
            raise AuthorizationServiceUnavailable("Organization hierarchy is unavailable.") from None
        if valid_scope is not True:
            raise RolePermissionError("Assigned organization node or ancestry is inactive or missing.")

    worker_id = ""
    if role == "AWW":
        if worker_mapping_resolver is not None:
            try:
                mappings = worker_mapping_resolver.resolve_mappings(subject_id, scope.organization_id)
            except Exception:
                raise AuthorizationServiceUnavailable("Trusted worker mapping lookup is unavailable.") from None
            if not isinstance(mappings, (tuple, list)):
                raise AuthorizationServiceUnavailable("Trusted worker mapping data is unavailable.")
            effective_mappings = []
            for mapping in mappings:
                if not isinstance(mapping, WorkerMappingRecord) or mapping.subject_id != subject_id:
                    raise RolePermissionError("Trusted worker mapping is inconsistent.")
                if not isinstance(mapping.valid_from, datetime) or mapping.valid_from.tzinfo is None or mapping.valid_from.utcoffset() is None:
                    raise RolePermissionError("Trusted worker mapping validity is malformed.")
                if mapping.valid_until is not None and (
                    not isinstance(mapping.valid_until, datetime)
                    or mapping.valid_until.tzinfo is None
                    or mapping.valid_until.utcoffset() is None
                    or mapping.valid_until <= mapping.valid_from
                ):
                    raise RolePermissionError("Trusted worker mapping validity is malformed.")
                if mapping.revoked_at is not None and (
                    not isinstance(mapping.revoked_at, datetime)
                    or mapping.revoked_at.tzinfo is None
                    or mapping.revoked_at.utcoffset() is None
                ):
                    raise RolePermissionError("Trusted worker mapping revocation is malformed.")
                if (
                    mapping.is_active is True
                    and mapping.worker_is_active is True
                    and mapping.revoked_at is None
                    and mapping.valid_from <= current_time
                    and (mapping.valid_until is None or current_time < mapping.valid_until)
                ):
                    effective_mappings.append(mapping)
            if len(effective_mappings) > 1:
                raise RolePermissionError("AWW worker mapping is ambiguous; access denied.")
            if effective_mappings:
                mapping = effective_mappings[0]
                if mapping.centre_id != scope.organization_id:
                    raise RolePermissionError("AWW worker mapping is outside the assigned centre.")
                if not isinstance(mapping.worker_id, str) or not mapping.worker_id.strip():
                    raise RolePermissionError("AWW worker mapping is malformed.")
                worker_id = mapping.worker_id.strip()

    return Principal(
        actor_id=str(subject_id),
        role=role,
        assigned_worker_id=worker_id,
        organization_scopes=() if scope is None else (scope,),
        is_active=True,
        subject_id=str(subject_id),
    )


# Canonical role policy is deliberately default-deny. The stored role must come
# from trusted server-side assignments; request bodies and client state are not
# accepted by these functions.
ROLE_PERMISSIONS = {
    "User": frozenset({"view_public_aggregates"}),
    "AWW": frozenset({
        "view_case", "view_history", "view_briefing", "view_tasks", "task_action",
        "acknowledge_task", "start_task", "record_task_progress", "closure_confirm",
        "register_beneficiary", "record_measurement", "explain_case", "history_summary", "suggest_action",
        "decide_action", "view_referrals", "create_referral", "update_referral",
        "create_exception",
        "offline_enqueue", "view_offline_queue",
        "view_own_tasks", "acknowledge_task_legacy", "complete_task", "record_contact_attempt",
    }),
    "LS": frozenset({
        "view_case", "view_history", "view_briefing", "view_tasks", "task_action",
        "create_task", "acknowledge_task", "start_task", "record_task_progress",
        "assign_task", "reassign_task", "escalate_task", "verify_measurement",
        "explain_case", "history_summary", "suggest_action", "decide_action",
        "view_audit", "view_referrals", "create_referral", "update_referral",
        "resolve_referral", "view_exceptions", "create_exception", "resolve_exception",
        "closure_confirm", "view_maternal", "create_maternal", "update_maternal",
        "create_snapshot", "view_snapshots", "offline_enqueue", "view_offline_queue",
        "offline_sync", "view_all_tasks", "acknowledge_task_legacy", "complete_task",
        "reassign_task_legacy", "escalate_task_legacy", "view_workload",
        "record_contact_attempt", "log_referral_outcome",
    }),
    "CDPO": frozenset({
        "view_case", "view_history", "view_briefing", "view_tasks", "task_action",
        "create_task", "assign_task", "reassign_task", "explain_case", "history_summary",
        "view_audit", "view_referrals", "create_referral", "update_referral",
        "resolve_referral", "view_snapshots", "view_reports",
        "view_all_tasks", "view_workload",
    }),
    "DPO": frozenset({"view_briefing", "view_aggregate_reports"}),
    "System Administrator": frozenset({"manage_accounts", "manage_roles", "manage_org_assignments", "view_authorization_audit"}),
    "Rule Administrator": frozenset({"draft_rule_change", "submit_rule_change", "view_rule_changes"}),
}

ROLE_ALIASES = {
    "worker": "AWW",
    "supervisor": "LS",
    "anm_block": "LS",
    "cdpo": "CDPO",
    "nodal": "DPO",
    "state": "DPO",
    "india": "DPO",
    "district": "DPO",
    "admin": "System Administrator",
}

# Explicitly synthetic identities retained only for local prototype tests.
DEMO_ACTORS = {
    "demo-worker": Principal("W07", "worker", ("AWC-001",), "W07"),
    "demo-supervisor": Principal("SUP-001", "supervisor", ("AWC-001", "AWC-002")),
    "demo-cdpo": Principal("CDPO-001", "cdpo", ("AWC-001", "AWC-002")),
    "demo-nodal": Principal("NODAL-001", "nodal", ("AWC-001", "AWC-002")),
    "demo-state": Principal("STATE-001", "state", ("AWC-001", "AWC-002")),
    "demo-india": Principal("INDIA-001", "india", ("AWC-001", "AWC-002")),
}

ACTIVE_TASK_STATUSES = frozenset({"open", "assigned", "acknowledged", "in_progress", "escalated"})


def canonical_role(role: str) -> str:
    """Map legacy prototype names to the approved role vocabulary."""
    value = str(role or "").strip()
    return ROLE_ALIASES.get(value.lower(), value)


def permissions_for(role: str):
    return ROLE_PERMISSIONS.get(canonical_role(role), frozenset())


def resolve_demo_actor(actor_key: str) -> Principal:
    if not isinstance(actor_key, str) or actor_key not in DEMO_ACTORS:
        raise RolePermissionError("Unknown demo actor; access denied.")
    return DEMO_ACTORS[actor_key]


def has_permission(role: str, permission: str) -> bool:
    """Return whether a role has a defined permission; unknown roles deny."""
    role_key = str(role or "").strip()
    permission_key = str(permission or "").strip()
    if role_key in {"worker", "supervisor", "anm_block", "district", "admin"}:
        # Keep the legacy workload helper contract while using canonical policy.
        legacy_permission_map = {
            "worker": {"view_own_tasks", "acknowledge_task", "complete_task", "record_contact_attempt"},
            "supervisor": {"view_all_tasks", "acknowledge_task", "complete_task", "reassign_task", "escalate_task", "view_workload", "record_contact_attempt", "log_referral_outcome"},
            "anm_block": {"view_all_tasks", "acknowledge_task", "complete_task", "reassign_task", "escalate_task", "view_workload", "record_contact_attempt", "log_referral_outcome"},
            "district": {"view_all_tasks", "view_workload", "view_referral_summary"},
            "admin": {"view_all_tasks", "view_workload", "manage_demo_roles"},
        }
        if permission_key in legacy_permission_map[role_key]:
            return True
    return permission_key in permissions_for(role_key)


def require_permission(role: str, permission: str) -> None:
    if not has_permission(role, permission):
        raise RolePermissionError(f"Role {role!r} cannot perform {permission!r}.")


def require_api_permission(principal: Principal, permission: str) -> None:
    if not isinstance(principal, Principal) or not principal.is_active:
        raise RolePermissionError("An active, server-resolved identity is required.")
    if permission not in permissions_for(principal.role):
        raise RolePermissionError(f"Role {principal.role!r} cannot perform {permission!r}.")


def require_centre_scope(principal: Principal, centre_id: str,
                         hierarchy: OrganizationHierarchy | None = None) -> None:
    if not isinstance(principal, Principal) or not principal.is_active:
        raise RolePermissionError("An active, server-resolved identity is required.")
    if not isinstance(centre_id, str) or not centre_id.strip():
        raise RolePermissionError("A valid centre is required.")
    if centre_id in principal.centre_ids:
        return
    if hierarchy is None:
        raise RolePermissionError("Organization hierarchy is unavailable; access denied.")
    for scope in principal.organization_scopes:
        if hierarchy.contains_centre(scope.kind, scope.organization_id, centre_id):
            return
    raise RolePermissionError("Centre is outside this actor's assigned organization scope.")


def require_case_scope(principal: Principal, centre_id: str, action: str,
                       assigned_worker_id: str = "",
                       hierarchy: OrganizationHierarchy | None = None) -> None:
    require_api_permission(principal, action)
    require_centre_scope(principal, centre_id, hierarchy)
    if canonical_role(principal.role) == "AWW":
        if not principal.assigned_worker_id or assigned_worker_id != principal.assigned_worker_id:
            raise RolePermissionError("AWW may only access cases explicitly assigned to them.")


def require_task_action(principal: Principal, action: str) -> None:
    permission = {
        "assign": "assign_task",
        "reassign": "reassign_task",
        "escalate": "escalate_task",
        "acknowledge": "acknowledge_task",
        "start": "start_task",
        "record_progress": "record_task_progress",
    }.get(str(action or "").strip().lower())
    if permission is None:
        raise RolePermissionError("Task action is not permitted by the role policy.")
    require_api_permission(principal, permission)


def require_referral_action(principal: Principal, action: str) -> None:
    verb = str(action or "").strip().lower()
    if verb in {"acknowledge", "attend"}:
        require_api_permission(principal, "update_referral")
    elif verb == "record_outcome":
        require_api_permission(principal, "resolve_referral")
    else:
        raise RolePermissionError("Referral action is not permitted by the role policy.")


def require_rule_approval(role: str, submitter_id: str, approver_id: str) -> None:
    """Approval is deliberately unavailable until an authority is configured."""
    raise RolePermissionError("Rule approval is disabled until the approving authority is designated.")


def visible_tasks(tasks: list, actor_id: str, role: str) -> list:
    """Filter prototype tasks by role; workers only see their assigned tasks."""
    if not isinstance(tasks, list):
        raise ValueError("tasks must be a list.")
    role_value = str(role or "").strip().lower()
    if role_value not in {"worker", "supervisor", "anm_block", "district", "admin"}:
        raise RolePermissionError("Unknown role.")
    if role_value == "worker":
        if not isinstance(actor_id, str) or not actor_id.strip():
            raise RolePermissionError("Worker identity is required.")
        return [task for task in tasks if isinstance(task, dict) and task.get("owner_id") == actor_id.strip()]
    require_permission(role_value, "view_all_tasks")
    return [task for task in tasks if isinstance(task, dict)]


def tasks_per_worker(tasks: list) -> dict:
    if not isinstance(tasks, list):
        raise ValueError("tasks must be a list.")
    result = {}
    for task in tasks:
        if not isinstance(task, dict) or task.get("status") not in ACTIVE_TASK_STATUSES:
            continue
        owner = task.get("owner_id") or "unassigned"
        row = result.setdefault(owner, {"total_active": 0, "by_status": {status: 0 for status in sorted(ACTIVE_TASK_STATUSES)}})
        row["total_active"] += 1
        row["by_status"][task["status"]] += 1
    return result


def worker_capacity(tasks: list, worker_id: str, max_active_tasks: int) -> dict:
    if not isinstance(worker_id, str) or not worker_id.strip():
        raise ValueError("worker_id is required.")
    if isinstance(max_active_tasks, bool) or not isinstance(max_active_tasks, int) or max_active_tasks < 0:
        raise ValueError("max_active_tasks must be a non-negative integer.")
    active = tasks_per_worker(tasks).get(worker_id.strip(), {}).get("total_active", 0)
    return {"worker_id": worker_id.strip(), "active_tasks": active,
            "max_active_tasks": max_active_tasks, "can_assign": active < max_active_tasks,
            "label": "PROPOSED WORKLOAD CAP — confirm with the team"}


def require_capacity(tasks: list, worker_id: str, max_active_tasks: int) -> None:
    result = worker_capacity(tasks, worker_id, max_active_tasks)
    if not result["can_assign"]:
        raise RolePermissionError(
            f"Worker {worker_id} has reached the configured active-task limit "
            f"({result['active_tasks']}/{result['max_active_tasks']})."
        )


def weekly_grouping(tasks: list) -> dict:
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
