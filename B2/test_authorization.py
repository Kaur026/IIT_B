"""Regression tests for the Part 2 role and organization authorization policy."""

import unittest
from datetime import datetime, timezone
from uuid import UUID

from B2 import closure
from B2.roles import (
    AuthorizationServiceUnavailable,
    OrganizationScope,
    AccountAuthorizationRecord,
    ApplicationAccountRecord,
    OrganizationNodeRecord,
    Principal,
    RepositoryAssignmentResolver,
    RepositoryOrganizationHierarchy,
    RoleAssignmentRecord,
    RolePermissionError,
    WorkerMappingRecord,
    has_permission,
    require_api_permission,
    require_case_scope,
    require_centre_scope,
    require_rule_approval,
    resolve_authorized_principal,
)
from B2.security import safe_validation_errors


class TestHierarchy:
    """Tiny trusted hierarchy fixture; it never accepts request-supplied scope."""

    parents = {
        "centre:CTR-1": ("sector", "SEC-1"),
        "sector:SEC-1": ("project", "PRJ-1"),
        "project:PRJ-1": ("district", "DST-1"),
        "centre:CTR-2": ("sector", "SEC-2"),
        "sector:SEC-2": ("project", "PRJ-2"),
        "project:PRJ-2": ("district", "DST-2"),
    }
    def __init__(self):
        self.parents = dict(type(self).parents)
        self.inactive_nodes = set()

    @property
    def nodes(self):
        return {
            tuple(key.split(":")) for key in self.parents
        } | set(self.parents.values())

    def validate_scope(self, scope):
        node = (scope.kind, scope.organization_id)
        if node not in self.nodes or node in self.inactive_nodes:
            return False
        seen = set()
        while f"{node[0]}:{node[1]}" in self.parents:
            if node in seen:
                return False
            seen.add(node)
            node = self.parents[f"{node[0]}:{node[1]}"]
            if node not in self.nodes or node in self.inactive_nodes:
                return False
        return node[0] == "district"

    def contains_centre(self, scope_type, scope_id, centre_id):
        current_type, current_id = "centre", centre_id
        while True:
            if current_type == scope_type and current_id == scope_id:
                return True
            parent = self.parents.get(f"{current_type}:{current_id}")
            if parent is None:
                return False
            current_type, current_id = parent


class AuthorizationPolicyTests(unittest.TestCase):
    SUBJECT = UUID("87c6dd4f-4d83-4f06-8f53-80b7be6d6c51")
    NOW = datetime(2026, 10, 28, tzinfo=timezone.utc)
    DEFAULT_HIERARCHY = object()

    def assignment(self, role="AWW", scope_type="centre", scope_id="CTR-1", **overrides):
        fields = {
            "role": role,
            "scope_type": scope_type,
            "scope_id": scope_id,
            "valid_from": datetime(2020, 1, 1, tzinfo=timezone.utc),
        }
        fields.update(overrides)
        return RoleAssignmentRecord(**fields)

    def account(self, *assignments, subject_id=None, active=True):
        return AccountAuthorizationRecord(
            subject_id=subject_id or self.SUBJECT,
            is_active=active,
            assignments=tuple(assignments),
        )

    def resolve(self, account, hierarchy=DEFAULT_HIERARCHY, worker_mapping_resolver=None):
        class Resolver:
            seen_subject = None

            def resolve_assignments(self, subject_id):
                self.seen_subject = subject_id
                return account

        resolver = Resolver()
        principal = resolve_authorized_principal(
            self.SUBJECT,
            resolver,
            TestHierarchy() if hierarchy is self.DEFAULT_HIERARCHY else hierarchy,
            worker_mapping_resolver=worker_mapping_resolver,
            now=self.NOW,
        )
        return principal, resolver

    def test_trusted_resolver_receives_only_verified_subject_uuid(self):
        principal, resolver = self.resolve(self.account(self.assignment()))
        self.assertEqual(resolver.seen_subject, self.SUBJECT)
        self.assertEqual(principal.subject_id, str(self.SUBJECT))
        self.assertEqual(principal.role, "AWW")
        self.assertEqual(principal.organization_scopes, (OrganizationScope("centre", "CTR-1"),))
        with self.assertRaises(RolePermissionError):
            resolve_authorized_principal("not-a-uuid", resolver, TestHierarchy(), now=self.NOW)

    def test_zero_one_and_multiple_effective_assignments(self):
        with self.assertRaises(RolePermissionError):
            self.resolve(self.account())
        principal, _ = self.resolve(self.account(self.assignment()))
        self.assertEqual(principal.role, "AWW")
        with self.assertRaises(RolePermissionError):
            self.resolve(self.account(self.assignment(), self.assignment(scope_id="CTR-2")))

    def test_disabled_mismatched_and_unavailable_account_or_resolver_are_denied(self):
        with self.assertRaises(RolePermissionError):
            self.resolve(self.account(self.assignment(), active=False))
        with self.assertRaises(RolePermissionError):
            self.resolve(self.account(self.assignment(), subject_id=UUID(int=4)))
        with self.assertRaises(RolePermissionError):
            resolve_authorized_principal(self.SUBJECT, None, TestHierarchy(), now=self.NOW)
        with self.assertRaises(RolePermissionError):
            resolve_authorized_principal(self.SUBJECT, object(), None, now=self.NOW)

    def test_expired_revoked_and_inactive_assignments_are_not_effective(self):
        expired = self.assignment(valid_until=datetime(2026, 1, 1, tzinfo=timezone.utc))
        revoked = self.assignment(revoked_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
        inactive = self.assignment(is_active=False)
        for row in (expired, revoked, inactive):
            with self.subTest(row=row), self.assertRaises(RolePermissionError):
                self.resolve(self.account(row))

    def test_invalid_role_scope_and_global_scope_combinations_are_denied(self):
        invalid = (
            self.assignment(role="DPO", scope_type="centre", scope_id="CTR-1"),
            self.assignment(role="Unknown", scope_type="centre", scope_id="CTR-1"),
            self.assignment(role="User", scope_type="centre", scope_id="CTR-1"),
            self.assignment(role="System Administrator", scope_type="global", scope_id="CTR-1"),
        )
        for row in invalid:
            with self.subTest(role=row.role, scope=row.scope_type), self.assertRaises(RolePermissionError):
                self.resolve(self.account(row))

    def test_global_roles_have_exactly_one_global_assignment_and_no_geo_scope(self):
        for role in ("User", "System Administrator", "Rule Administrator"):
            row = self.assignment(role=role, scope_type="global", scope_id=None)
            principal, _ = self.resolve(self.account(row), hierarchy=None)
            self.assertEqual(principal.role, role)
            self.assertEqual(principal.organization_scopes, ())
            if role == "System Administrator":
                self.assertTrue(has_permission(principal.role, "manage_accounts"))
                self.assertFalse(has_permission(principal.role, "view_case"))
            if role == "Rule Administrator":
                self.assertTrue(has_permission(principal.role, "submit_rule_change"))
                self.assertFalse(has_permission(principal.role, "approve_rule_change"))
        with self.assertRaises(RolePermissionError):
            self.resolve(self.account(
                self.assignment(role="User", scope_type="global", scope_id=None),
                self.assignment(role="User", scope_type="global", scope_id=None),
            ))

    def test_scope_node_and_each_ancestor_must_be_present_and_active(self):
        hierarchy = TestHierarchy()
        hierarchy.inactive_nodes = {("project", "PRJ-1")}
        with self.assertRaises(RolePermissionError):
            self.resolve(self.account(self.assignment()), hierarchy)
        missing_ancestor = TestHierarchy()
        missing_ancestor.parents.pop("project:PRJ-1")
        with self.assertRaises(RolePermissionError):
            self.resolve(self.account(self.assignment()), missing_ancestor)
        with self.assertRaises(RolePermissionError):
            self.resolve(self.account(self.assignment(scope_id="MISSING")))
        class UnavailableHierarchy:
            def validate_scope(self, _scope):
                raise RuntimeError("synthetic unavailable hierarchy")
        with self.assertRaises(RolePermissionError):
            self.resolve(self.account(self.assignment()), UnavailableHierarchy())

    def test_repository_hierarchy_checks_each_parent_and_resource_centre(self):
        rows = (
            OrganizationNodeRecord("district", "DST-1", None, None),
            OrganizationNodeRecord("project", "PRJ-1", "district", "DST-1"),
            OrganizationNodeRecord("sector", "SEC-1", "project", "PRJ-1"),
            OrganizationNodeRecord("centre", "CTR-1", "sector", "SEC-1"),
            OrganizationNodeRecord("district", "DST-2", None, None),
            OrganizationNodeRecord("project", "PRJ-2", "district", "DST-2"),
            OrganizationNodeRecord("sector", "SEC-2", "project", "PRJ-2"),
            OrganizationNodeRecord("centre", "CTR-2", "sector", "SEC-2"),
        )

        class Nodes:
            def __init__(self, nodes):
                self.nodes = {(node.kind, node.organization_id): node for node in nodes}

            def get_node(self, kind, organization_id):
                return self.nodes.get((kind, organization_id))

            def list_nodes(self, kind):
                return tuple(node for node in self.nodes.values() if node.kind == kind)

        repository = Nodes(rows)
        hierarchy = RepositoryOrganizationHierarchy(repository)
        self.assertTrue(hierarchy.validate_scope(OrganizationScope("district", "DST-1")))
        self.assertTrue(hierarchy.validate_scope(OrganizationScope("project", "PRJ-1")))
        self.assertTrue(hierarchy.validate_scope(OrganizationScope("sector", "SEC-1")))
        self.assertTrue(hierarchy.validate_scope(OrganizationScope("centre", "CTR-1")))
        self.assertTrue(hierarchy.contains_centre("project", "PRJ-1", "CTR-1"))
        self.assertFalse(hierarchy.contains_centre("project", "PRJ-1", "CTR-2"))
        self.assertEqual(hierarchy.centres_in_scope("district", "DST-1"), ("CTR-1",))

        repository.nodes[("project", "PRJ-1")] = OrganizationNodeRecord(
            "project", "PRJ-1", "district", "DST-1", is_active=False,
        )
        self.assertFalse(hierarchy.validate_scope(OrganizationScope("centre", "CTR-1")))
        self.assertFalse(hierarchy.contains_centre("project", "PRJ-1", "CTR-1"))

        repository.nodes[("project", "PRJ-1")] = OrganizationNodeRecord(
            "project", "PRJ-1", "sector", "SEC-1",
        )
        self.assertFalse(hierarchy.validate_scope(OrganizationScope("project", "PRJ-1")))

        class BrokenNodes:
            def get_node(self, _kind, _organization_id):
                raise RuntimeError("synthetic hierarchy failure")

            def list_nodes(self, _kind):
                raise RuntimeError("synthetic hierarchy failure")

        with self.assertRaises(AuthorizationServiceUnavailable):
            RepositoryOrganizationHierarchy(BrokenNodes()).validate_scope(
                OrganizationScope("district", "DST-1")
            )

    def test_missing_worker_mapping_denies_operations_requiring_worker_identity(self):
        missing = self.assignment()
        principal, _ = self.resolve(self.account(missing))
        self.assertEqual(principal.assigned_worker_id, "")
        with self.assertRaises(RolePermissionError):
            require_case_scope(
                principal, "CTR-1", "view_case", assigned_worker_id="TEST-ROSTER-WORKER-1",
                hierarchy=TestHierarchy(),
            )

    def test_worker_mapping_requires_one_active_roster_record_in_assigned_centre(self):
        assignment = self.assignment()

        class WorkerMappings:
            def __init__(self, rows):
                self.rows = rows
                self.seen = None

            def resolve_mappings(self, subject_id, centre_id):
                self.seen = (subject_id, centre_id)
                return self.rows

        def mapping(**overrides):
            fields = {
                "subject_id": self.SUBJECT,
                "worker_id": "TEST-ROSTER-WORKER-1",
                "centre_id": "CTR-1",
                "valid_from": datetime(2020, 1, 1, tzinfo=timezone.utc),
            }
            fields.update(overrides)
            return WorkerMappingRecord(**fields)

        valid = WorkerMappings([mapping()])
        principal, _ = self.resolve(self.account(assignment), worker_mapping_resolver=valid)
        self.assertEqual(principal.assigned_worker_id, "TEST-ROSTER-WORKER-1")
        self.assertEqual(valid.seen, (self.SUBJECT, "CTR-1"))

        for rows in ([], [mapping(is_active=False)], [mapping(worker_is_active=False)]):
            resolver = WorkerMappings(rows)
            principal, _ = self.resolve(self.account(assignment), worker_mapping_resolver=resolver)
            self.assertEqual(principal.assigned_worker_id, "")

        with self.assertRaises(RolePermissionError):
            self.resolve(
                self.account(assignment),
                worker_mapping_resolver=WorkerMappings([mapping(), mapping()]),
            )
        with self.assertRaises(RolePermissionError):
            self.resolve(
                self.account(assignment),
                worker_mapping_resolver=WorkerMappings([mapping(centre_id="CTR-2")]),
            )

        class FailedWorkerMappings:
            def resolve_mappings(self, _subject_id, _centre_id):
                raise RuntimeError("synthetic roster outage")

        with self.assertRaises(RolePermissionError):
            self.resolve(self.account(assignment), worker_mapping_resolver=FailedWorkerMappings())

    def test_repository_resolver_uses_only_subject_uuid_and_fails_closed(self):
        assignment = self.assignment()

        class Accounts:
            seen_subject = None

            def get_by_subject(self, subject_id):
                self.seen_subject = subject_id
                return ApplicationAccountRecord(subject_id, True)

        class Assignments:
            seen_subject = None

            def list_for_subject(self, subject_id):
                self.seen_subject = subject_id
                return (assignment,)

        accounts, assignments = Accounts(), Assignments()
        resolver = RepositoryAssignmentResolver(accounts, assignments)
        result = resolver.resolve_assignments(self.SUBJECT)
        self.assertEqual(result.subject_id, self.SUBJECT)
        self.assertEqual(result.assignments, (assignment,))
        self.assertEqual(accounts.seen_subject, self.SUBJECT)
        self.assertEqual(assignments.seen_subject, self.SUBJECT)
        with self.assertRaises(RolePermissionError):
            resolver.resolve_assignments("forged-subject")

        class MissingAccounts:
            def get_by_subject(self, subject_id):
                self.asserted_subject = subject_id
                return None

        class AssignmentsMustNotLoad:
            def list_for_subject(self, _subject_id):
                raise AssertionError("assignments must not load for a missing account")

        missing = RepositoryAssignmentResolver(MissingAccounts(), AssignmentsMustNotLoad())
        self.assertIsNone(missing.resolve_assignments(self.SUBJECT))

        class MalformedAccounts:
            def get_by_subject(self, _subject_id):
                return {"is_active": True}

        with self.assertRaises(RolePermissionError):
            RepositoryAssignmentResolver(MalformedAccounts(), Assignments()).resolve_assignments(self.SUBJECT)

        class OfflineAccounts:
            def get_by_subject(self, _subject_id):
                raise RuntimeError("synthetic account storage detail")

        with self.assertRaises(AuthorizationServiceUnavailable):
            RepositoryAssignmentResolver(OfflineAccounts(), Assignments()).resolve_assignments(self.SUBJECT)

    def test_authorization_storage_outages_are_distinct_from_denied_assignments(self):
        class OfflineResolver:
            def resolve_assignments(self, _subject_id):
                raise RuntimeError("synthetic database connection detail")

        with self.assertRaises(AuthorizationServiceUnavailable) as raised:
            resolve_authorized_principal(
                self.SUBJECT, OfflineResolver(), TestHierarchy(), now=self.NOW,
            )
        self.assertNotIn("connection detail", str(raised.exception))

        class UnassignedResolver:
            def resolve_assignments(self, _subject_id):
                return None

        with self.assertRaises(RolePermissionError) as unassigned:
            resolve_authorized_principal(
                self.SUBJECT, UnassignedResolver(), TestHierarchy(), now=self.NOW,
            )
        self.assertNotIsInstance(unassigned.exception, AuthorizationServiceUnavailable)

        with self.assertRaises(RolePermissionError) as denied:
            self.resolve(self.account())
        self.assertNotIsInstance(denied.exception, AuthorizationServiceUnavailable)

    def test_approved_role_actions_and_default_deny(self):
        self.assertTrue(has_permission("AWW", "record_measurement"))
        self.assertTrue(has_permission("AWW", "register_beneficiary"))
        self.assertFalse(has_permission("LS", "register_beneficiary"))
        self.assertFalse(has_permission("AWW", "verify_measurement"))
        self.assertFalse(has_permission("AWW", "resolve_case"))
        self.assertTrue(has_permission("LS", "verify_measurement"))
        self.assertTrue(has_permission("CDPO", "view_reports"))
        self.assertFalse(has_permission("CDPO", "approve_rule_change"))
        self.assertTrue(has_permission("Rule Administrator", "submit_rule_change"))
        self.assertFalse(has_permission("Rule Administrator", "approve_rule_change"))
        self.assertTrue(has_permission("System Administrator", "manage_accounts"))
        self.assertFalse(has_permission("System Administrator", "view_case"))
        self.assertFalse(has_permission("DPO", "view_beneficiary_detail"))
        self.assertFalse(has_permission("unknown-role", "view_case"))
        with self.assertRaises(RolePermissionError):
            require_api_permission(Principal("dpo-1", "DPO"), "view_all_tasks")

    def test_rule_approval_fails_closed_without_designated_authority(self):
        for role in ("Rule Administrator", "CDPO", "System Administrator", "DPO"):
            with self.subTest(role=role), self.assertRaises(RolePermissionError):
                require_rule_approval(role, submitter_id="user-1", approver_id="user-2")

    def test_closure_policy_requires_distinct_canonical_roles(self):
        policy = {
            "approved": True, "version": "test-v1",
            "case_types": {"default": {"confirmations": [
                {"key": "first", "role": "AWW"},
                {"key": "second", "role": "worker"},
            ]}},
        }
        self.assertIsNone(closure.policy_for(policy, "default"))
        policy["case_types"]["default"]["confirmations"][1]["role"] = "LS"
        self.assertIsNotNone(closure.policy_for(policy, "default"))

    def test_closure_confirmations_match_role_aliases_but_require_distinct_actors(self):
        configured = {
            "approved": True, "version": "test-v2",
            "case_types": {"default": {"confirmations": [
                {"key": "worker_completion", "role": "AWW"},
                {"key": "supervisor_review", "role": "LS"},
            ]}},
        }
        policy = closure.policy_for(configured, "default")
        first = closure.record_confirmation(
            [], policy, "worker_completion", "worker-1", "worker", "2026-10-15", "reached",
        )
        with self.assertRaises(closure.ClosureError):
            closure.record_confirmation(
                first, policy, "supervisor_review", "worker-1", "supervisor", "2026-10-15",
            )
        second = closure.record_confirmation(
            first, policy, "supervisor_review", "supervisor-1", "supervisor", "2026-10-15",
        )
        self.assertTrue(closure.closure_readiness(second, policy)["ready"])

    def test_validation_error_sanitizer_does_not_echo_sensitive_input(self):
        result = safe_validation_errors([{
            "loc": ("body", "phone"), "type": "int_parsing",
            "msg": "Input should be a valid integer", "input": "987654321012",
            "ctx": {"secret": "do-not-return"},
        }])
        self.assertEqual(result, [{
            "loc": ["body", "phone"], "code": "int_parsing",
            "message": "Invalid or missing field.",
        }])

    def test_scope_requires_active_server_assignments_and_hierarchy(self):
        ls = Principal(
            actor_id="ls-1", role="LS", organization_scopes=(OrganizationScope("sector", "SEC-1"),)
        )
        require_centre_scope(ls, "CTR-1", TestHierarchy())
        with self.assertRaises(RolePermissionError):
            require_centre_scope(ls, "CTR-2", TestHierarchy())
        with self.assertRaises(RolePermissionError):
            require_centre_scope(ls, "CTR-1", None)

    def test_disabled_or_unassigned_principals_cannot_access_records(self):
        disabled = Principal(actor_id="u-1", role="AWW", is_active=False,
                             organization_scopes=(OrganizationScope("centre", "CTR-1"),))
        unassigned = Principal(actor_id="u-2", role="AWW")
        for principal in (disabled, unassigned):
            with self.subTest(principal=principal.actor_id), self.assertRaises(RolePermissionError):
                require_case_scope(principal, "CTR-1", "view_case", hierarchy=TestHierarchy())

    def test_assignment_scope_cannot_be_replaced_by_a_centre_argument(self):
        dpo = Principal(
            actor_id="dpo-1", role="DPO", organization_scopes=(OrganizationScope("district", "DST-1"),)
        )
        require_centre_scope(dpo, "CTR-1", TestHierarchy())
        with self.assertRaises(RolePermissionError):
            require_centre_scope(dpo, "CTR-2", TestHierarchy())


if __name__ == "__main__":
    unittest.main()
