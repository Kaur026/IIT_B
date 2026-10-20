"""Unit tests for BE2 F5/F6/F7/F9/F10 prototype helpers."""

import tempfile
import unittest
from pathlib import Path

from B2.audit import (
    AuditRecordError,
    append_event,
    audit_consent_change,
    change_consent_status,
    create_consent_record,
)
from B2.fallback import can_continue_safely, create_fallback_record, mark_fallback_action
from B2.referrals import (
    ReferralError,
    issue_referral,
    log_referral_outcome,
    mark_not_needed,
    record_contact_attempt,
    referral_summary,
    suggested_next_step,
)
from B2.roles import (
    RolePermissionError,
    has_permission,
    require_capacity,
    tasks_per_worker,
    visible_tasks,
    weekly_grouping,
    worker_capacity,
)
from B2.sync import (
    SyncError,
    apply_sync_results,
    enqueue_operation,
    load_operations,
    reconcile_operations,
)


class ReferralTests(unittest.TestCase):
    def setUp(self):
        self.referral = issue_referral(
            child_id="C0001",
            issued_by="W07",
            destination="Synthetic clinic A",
            reason="Synthetic BE2 test reason",
            on="2026-10-15",
            task_id="TASK-C0001",
            referral_id="REF-C0001",
        )

    def test_contact_not_reached_records_reason_and_suggestion(self):
        updated = record_contact_attempt(
            self.referral, "W07", "2026-10-16", False, "no_answer"
        )
        self.assertEqual(updated["status"], "issued")
        self.assertFalse(updated["reached"])
        self.assertEqual(updated["last_contact_reason"], "no_answer")
        self.assertIn("next approved contact", suggested_next_step(updated)["text"])
        self.assertEqual(len(self.referral["timeline"]), 1)
        self.assertEqual(self.referral["timeline"][0]["event"], "referral_issued")

    def test_not_reached_requires_reason_and_other_requires_note(self):
        with self.assertRaises(ReferralError):
            record_contact_attempt(self.referral, "W07", "2026-10-16", False)
        with self.assertRaises(ReferralError):
            record_contact_attempt(self.referral, "W07", "2026-10-16", False, "other")

    def test_outcome_is_separate_from_contact_and_updates_status(self):
        contacted = record_contact_attempt(self.referral, "W07", "2026-10-16", True)
        result = log_referral_outcome(contacted, "W07", "attended", "2026-10-18")
        self.assertEqual(result["status"], "outcome_logged")
        self.assertEqual(result["outcome"], "attended")
        self.assertEqual(len(result["timeline"]), 3)

    def test_summary_counts_status_and_reasons(self):
        missed = record_contact_attempt(self.referral, "W07", "2026-10-16", False, "transport_barrier")
        no_ref = mark_not_needed("C0002", "SUP01", "2026-10-15", "Not indicated in this synthetic scenario")
        summary = referral_summary([missed, no_ref])
        self.assertEqual(summary["total"], 2)
        self.assertEqual(summary["by_status"]["issued"], 1)
        self.assertEqual(summary["by_contact_reason"]["transport_barrier"], 1)


class FallbackTests(unittest.TestCase):
    def test_auth_failure_offers_manual_path_without_bypassing_access(self):
        record = create_fallback_record(
            "C0001", "audit", "authentication_failed", "2026-10-15",
            "W07", "TASK-C0001", fallback_id="FB1",
        )
        self.assertTrue(can_continue_safely(record))
        self.assertFalse(record["automated_action_allowed"])
        self.assertFalse(record["protected_data_access_allowed"])
        self.assertIn("Protected records remain unavailable", record["next_action"])

    def test_manual_action_is_copy_on_write_and_not_protected_access(self):
        record = create_fallback_record("C0001", "sync", "offline", "2026-10-15", fallback_id="FB2")
        updated = mark_fallback_action(record, "W07", "2026-10-16", "Followed approved manual process")
        self.assertEqual(record["state"], "manual_action_pending")
        self.assertEqual(updated["state"], "manual_action_recorded")
        self.assertFalse(updated["protected_data_access_allowed"])


class AuditAndConsentTests(unittest.TestCase):
    def test_audit_append_is_immutable_and_redacts_nothing_implicitly(self):
        empty = []
        result = append_event(empty, "W07", "task_acknowledged", "task", "TASK1", "2026-10-15", {"status": "acknowledged"}, "EV1")
        self.assertEqual(empty, [])
        self.assertEqual(result[0]["event_id"], "EV1")
        with self.assertRaises(AuditRecordError):
            append_event(result, "W07", "duplicate", "task", "TASK1", "2026-10-15", event_id="EV1")

    def test_consent_changes_append_a_history_and_audit_event(self):
        record = create_consent_record("C0001", "W07", "synthetic demo", "granted", "2026-10-15", method="in_person", consent_id="CONS1")
        declined = change_consent_status(record, "W07", "withdrawn", "2026-10-16", "Synthetic test withdrawal")
        self.assertEqual(record["current_status"], "granted")
        self.assertEqual(declined["current_status"], "withdrawn")
        self.assertEqual(len(declined["events"]), 2)
        audit = audit_consent_change([], declined, "2026-10-16")
        self.assertEqual(audit[0]["action"], "consent_status_changed")
        self.assertEqual(audit[0]["details"]["to_status"], "withdrawn")


class RolesAndWorkloadTests(unittest.TestCase):
    def setUp(self):
        self.tasks = [
            {"task_id": "T1", "child_id": "C1", "owner_id": "W1", "status": "open", "created_on": "2026-10-15"},
            {"task_id": "T2", "child_id": "C2", "owner_id": "W1", "status": "acknowledged", "created_on": "2026-10-16"},
            {"task_id": "T3", "child_id": "C3", "owner_id": "W2", "status": "closed", "created_on": "2026-10-17"},
        ]

    def test_worker_views_only_own_tasks_and_permission_matrix(self):
        self.assertEqual(len(visible_tasks(self.tasks, "W1", "worker")), 2)
        self.assertFalse(has_permission("worker", "view_all_tasks"))
        self.assertTrue(has_permission("supervisor", "view_all_tasks"))
        with self.assertRaises(RolePermissionError):
            visible_tasks(self.tasks, "W1", "unrecognized")

    def test_capacity_guard_counts_only_active_tasks(self):
        counts = tasks_per_worker(self.tasks)
        self.assertEqual(counts["W1"]["total_active"], 2)
        self.assertEqual(worker_capacity(self.tasks, "W1", 3)["can_assign"], True)
        with self.assertRaises(RolePermissionError):
            require_capacity(self.tasks, "W1", 2)

    def test_weekly_grouping_reports_iso_week_and_worker_counts(self):
        grouping = weekly_grouping(self.tasks)
        self.assertEqual(grouping["2026-W42"]["total"], 3)
        self.assertEqual(grouping["2026-W42"]["by_worker"]["W1"], 2)


class SyncTests(unittest.TestCase):
    def test_offline_queue_persists_and_duplicate_enqueue_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "offline.json"
            first = enqueue_operation(path, "task", "T1", {"status": "acknowledged"}, 0, "2026-10-15", operation_id="OP1")
            duplicate = enqueue_operation(path, "task", "T1", {"status": "acknowledged"}, 0, "2026-10-15", operation_id="OP1")
            self.assertEqual(first, duplicate)
            self.assertEqual(len(load_operations(path, "pending")), 1)
            with self.assertRaises(SyncError):
                enqueue_operation(path, "task", "T1", {"status": "closed"}, 0, "2026-10-15", operation_id="OP1")

    def test_sync_applies_versioned_change_once_and_flags_conflict(self):
        operation = {
            "operation_id": "OP2", "entity_type": "task", "entity_id": "T1",
            "action": "upsert", "base_version": 1,
            "payload": {"status": "acknowledged"}, "created_at": "2026-10-15",
        }
        initial = {"task:T1": {"version": 1, "status": "open"}}
        result = reconcile_operations([operation], initial)
        self.assertEqual(result["results"][0]["status"], "synced")
        self.assertEqual(result["server_state"]["task:T1"]["version"], 2)
        duplicate = reconcile_operations([operation], result["server_state"], result["applied_operation_ids"])
        self.assertEqual(duplicate["results"][0]["status"], "duplicate")

        conflict = reconcile_operations([operation], {"task:T1": {"version": 2, "status": "closed"}})
        self.assertEqual(conflict["results"][0]["status"], "conflict")
        self.assertEqual(conflict["server_state"]["task:T1"]["status"], "closed")

    def test_sync_results_mark_queue_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "offline.json"
            enqueue_operation(path, "referral", "R1", {"status": "issued"}, 0, "2026-10-15", operation_id="OP3")
            changed = apply_sync_results(path, [{"operation_id": "OP3", "status": "synced"}])
            self.assertEqual(changed[0]["sync_status"], "synced")
            self.assertEqual(load_operations(path, "pending"), [])


if __name__ == "__main__":
    unittest.main()
