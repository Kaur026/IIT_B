"""End-to-end tests for BE2's added safety/workflow routes (synthetic only)."""

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from B2.api import create_app
from B2.store import PrototypeStore
from B2 import closure, exceptions as access_exceptions, maternal, referrals, sync, tasks


DEMO_CLOSURE_POLICY = {
    "approved": True,
    "version": "test-policy-v1",
    "case_types": {
        "default": {
            "confirmations": [
                {"key": "worker_completion", "role": "worker"},
                {"key": "supervisor_review", "role": "supervisor"},
            ],
            "outcome_required": True,
        }
    },
}


class CompleteWorkflowApiTests(unittest.TestCase):
    def setUp(self):
        self.store = PrototypeStore(":memory:")
        self.temp = tempfile.TemporaryDirectory()
        self.app = create_app(
            store=self.store,
            seed_demo=True,
            closure_policies=DEMO_CLOSURE_POLICY,
            maternal_enabled=True,
            maternal_allowed_roles=("supervisor",),
            offline_queue_dir=Path(self.temp.name) / "queues",
        )
        self.client = TestClient(self.app)
        self.sup = {"X-Demo-Actor": "demo-supervisor"}
        self.worker = {"X-Demo-Actor": "demo-worker"}

    def tearDown(self):
        self.client.close()
        self.store.close()
        self.temp.cleanup()

    def _create_in_progress_task(self):
        response = self.client.post("/api/tasks", headers=self.sup, json={"flag_id": "FLAG-C0001-BASELINE"})
        self.assertEqual(response.status_code, 200, response.text)
        task_id = response.json()["task"]["task_id"]
        response = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.sup, json={
            "action": "assign", "owner_id": "W07", "on": "2026-10-15",
        })
        self.assertEqual(response.status_code, 200, response.text)
        response = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.worker, json={
            "action": "acknowledge", "on": "2026-10-15",
        })
        self.assertEqual(response.status_code, 200, response.text)
        response = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.worker, json={
            "action": "start", "on": "2026-10-15",
        })
        self.assertEqual(response.status_code, 200, response.text)
        return task_id

    def test_final_closure_confirmation_cannot_strand_missing_outcome(self):
        task_id = self._create_in_progress_task()
        first = self.client.post(f"/api/tasks/{task_id}/closure-confirmations", headers=self.worker, json={
            "confirmation_key": "worker_completion", "on": "2026-10-15",
        })
        self.assertEqual(first.status_code, 200, first.text)
        missing = self.client.post(f"/api/tasks/{task_id}/closure-confirmations", headers=self.sup, json={
            "confirmation_key": "supervisor_review", "on": "2026-10-15",
        })
        self.assertEqual(missing.status_code, 422)
        self.assertEqual(len(self.store.list_closure_confirmations(task_id)), 1)
        final = self.client.post(f"/api/tasks/{task_id}/closure-confirmations", headers=self.sup, json={
            "confirmation_key": "supervisor_review", "outcome": "reached", "on": "2026-10-15",
        })
        self.assertEqual(final.status_code, 200, final.text)
        self.assertTrue(final.json()["closed"])

    def test_two_key_closure_requires_policy_both_distinct_confirmations_and_outcome(self):
        task_id = self._create_in_progress_task()
        with self.assertRaises(tasks.TaskActionError):
            tasks.apply_task_action(self.store.get_task(task_id), "close", "SUP-001", "2026-10-15", outcome="reached")
        direct_close = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.sup, json={
            "action": "close", "outcome": "reached",
        })
        self.assertEqual(direct_close.status_code, 409)

        first = self.client.post(f"/api/tasks/{task_id}/closure-confirmations", headers=self.worker, json={
            "confirmation_key": "worker_completion", "outcome": "reached", "on": "2026-10-15",
        })
        self.assertEqual(first.status_code, 200, first.text)
        self.assertFalse(first.json()["closed"])
        self.assertEqual(first.json()["readiness"]["missing_confirmations"], ["supervisor_review"])

        same_actor = self.client.post(f"/api/tasks/{task_id}/closure-confirmations", headers=self.worker, json={
            "confirmation_key": "supervisor_review", "on": "2026-10-15",
        })
        self.assertEqual(same_actor.status_code, 400)

        second = self.client.post(f"/api/tasks/{task_id}/closure-confirmations", headers=self.sup, json={
            "confirmation_key": "supervisor_review", "on": "2026-10-15",
        })
        self.assertEqual(second.status_code, 200, second.text)
        self.assertTrue(second.json()["closed"])
        self.assertEqual(second.json()["task"]["status"], "closed")
        actions = [e["action"] for e in self.store.list_audit(entity_type="task", entity_id=task_id)]
        self.assertIn("task_closed_two_key", actions)
        self.assertEqual(len(self.store.list_closure_confirmations(task_id)), 2)

    def test_closure_fails_closed_without_approved_case_policy(self):
        store = PrototypeStore(":memory:")
        app = create_app(store=store, seed_demo=True, closure_policies={}, offline_queue_dir=Path(self.temp.name) / "empty")
        client = TestClient(app)
        try:
            created = client.post("/api/tasks", headers=self.sup, json={"flag_id": "FLAG-C0001-BASELINE"})
            self.assertEqual(created.status_code, 200, created.text)
            task_id = created.json()["task"]["task_id"]
            response = client.post(f"/api/tasks/{task_id}/closure-confirmations", headers=self.sup, json={
                "confirmation_key": "supervisor_review", "outcome": "reached",
            })
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.json()["error"]["code"], "closure_policy_not_approved")
        finally:
            client.close()
            store.close()

    def test_referral_deic_workflow_and_overdue_uses_only_explicit_due_date(self):
        created = self.client.post("/api/referrals", headers=self.sup, json={
            "beneficiary_id": "C0001", "referral_kind": "deic",
            "destination": "DEIC-DEMO-01", "reason_code": "disability_service_follow_up",
            "due_on": "2026-10-14", "on": "2026-10-10",
        })
        self.assertEqual(created.status_code, 200, created.text)
        referral_id = created.json()["referral"]["referral_id"]
        self.assertEqual(created.json()["referral"]["status"], "sent")

        listing = self.client.get("/api/referrals", params={"centre_id": "AWC-001", "as_of": "2026-10-15"}, headers=self.sup)
        self.assertEqual(listing.status_code, 200, listing.text)
        self.assertTrue(listing.json()["referrals"][0]["overdue"])

        for action, extra, expected in (
            ("acknowledge", {}, "acknowledged"),
            ("attend", {}, "attended"),
            ("record_outcome", {"outcome_code": "appointment_recorded"}, "outcome_recorded"),
        ):
            result = self.client.post(f"/api/referrals/{referral_id}/actions", headers=self.worker, json={
                "action": action, "on": "2026-10-15", **extra,
            })
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()["referral"]["status"], expected)
        self.assertEqual(len(self.store.list_audit(entity_type="referral", entity_id=referral_id)), 4)

    def test_access_exception_is_coded_human_review_and_audited(self):
        created = self.client.post("/api/access-exceptions", headers=self.worker, json={
            "beneficiary_id": "C0001", "exception_type": "pending_mobile_verification",
            "on": "2026-10-15",
        })
        self.assertEqual(created.status_code, 200, created.text)
        record = created.json()["exception"]
        self.assertFalse(record.get("automatic_denial", False))
        self.assertIn("human review only", record["access_decision"])
        self.assertNotIn("aadhaar_number", record)

        bad = self.client.post("/api/access-exceptions", headers=self.worker, json={
            "beneficiary_id": "C0001", "exception_type": "identity_mismatch",
            "aadhaar_number": "not-stored",
        })
        self.assertEqual(bad.status_code, 422)

        resolved = self.client.post(f"/api/access-exceptions/{record['exception_id']}/resolve", headers=self.sup, json={
            "resolution_code": "manual_review_completed", "on": "2026-10-16",
        })
        self.assertEqual(resolved.status_code, 200, resolved.text)
        self.assertEqual(resolved.json()["exception"]["status"], "resolved")
        self.assertEqual(len(self.store.list_audit(entity_type="access_exception", entity_id=record["exception_id"])), 2)

    def test_maternal_scope_is_restricted_adult_only_and_not_clinical(self):
        self.store.add_beneficiary({
            "beneficiary_id": "M-DEMO-01", "centre_id": "AWC-001",
            "assigned_worker_id": "", "source_row": {"beneficiary_id": "M-DEMO-01"},
        })
        under_18 = self.client.post("/api/maternal-followups", headers=self.sup, json={
            "beneficiary_id": "C0001", "age_years": 17,
            "followup_type": "routine_check_in", "due_on": "2026-10-20",
        })
        self.assertEqual(under_18.status_code, 202)
        self.assertTrue(under_18.json()["deferred"])
        self.assertEqual(self.store.list_maternal_followups(beneficiary_id="C0001"), [])

        adult = self.client.post("/api/maternal-followups", headers=self.sup, json={
            "beneficiary_id": "M-DEMO-01", "age_years": 25,
            "followup_type": "routine_check_in", "due_on": "2026-10-20",
        })
        self.assertEqual(adult.status_code, 200, adult.text)
        profile = adult.json()["followup"]
        self.assertNotIn("age_years", profile)
        self.assertFalse(profile["clinical_advice"])

        forbidden = self.client.get("/api/maternal-followups", params={"centre_id": "AWC-001"}, headers=self.worker)
        self.assertEqual(forbidden.status_code, 403)
        updated = self.client.post(f"/api/maternal-followups/{profile['followup_id']}/actions", headers=self.sup, json={
            "status": "completed", "outcome_code": "contact_recorded", "on": "2026-10-21",
        })
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["followup"]["status"], "completed")

    def test_maternal_route_defaults_disabled(self):
        store = PrototypeStore(":memory:")
        app = create_app(store=store, seed_demo=True, maternal_enabled=False)
        client = TestClient(app)
        try:
            response = client.post("/api/maternal-followups", headers=self.sup, json={
                "beneficiary_id": "C0001", "age_years": 25,
                "followup_type": "routine_check_in", "due_on": "2026-10-20",
            })
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.json()["error"]["code"], "maternal_scope_disabled")
        finally:
            client.close()
            store.close()

    def test_audit_endpoint_is_centre_scoped_and_available_for_review(self):
        exception = self.client.post("/api/access-exceptions", headers=self.worker, json={
            "beneficiary_id": "C0001", "exception_type": "document_unavailable", "on": "2026-10-15",
        })
        self.assertEqual(exception.status_code, 200, exception.text)
        response = self.client.get("/api/audit", params={"centre_id": "AWC-001", "entity_type": "access_exception"}, headers=self.sup)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["events"][0]["entity_id"], exception.json()["exception"]["exception_id"])
        out_of_scope = self.client.get("/api/audit", params={"centre_id": "AWC-999"}, headers=self.sup)
        self.assertEqual(out_of_scope.status_code, 403)

    def test_backend_counts_are_snapshotted_and_retrievable(self):
        response = self.client.post("/api/briefing/snapshots", headers=self.sup, json={
            "centre_id": "AWC-001", "as_of": "2026-10-15",
        })
        self.assertEqual(response.status_code, 200, response.text)
        snapshot = response.json()["snapshot"]
        self.assertEqual(snapshot["counts"]["flags"]["total"], len(self.store.list_flags(centre_id="AWC-001")))
        self.assertEqual(snapshot["source"], "backend SQLite records; counts computed by deterministic code, never supplied by AI")
        retrieved = self.client.get(f"/api/briefing/snapshots/{snapshot['snapshot_id']}", headers=self.sup)
        self.assertEqual(retrieved.status_code, 200, retrieved.text)
        self.assertEqual(retrieved.json()["snapshot"], snapshot)

    def test_next_action_accept_dispatches_through_normal_task_service(self):
        shown = self.client.get("/api/next-actions/FLAG-C0001-BASELINE", headers=self.sup)
        self.assertEqual(shown.status_code, 200, shown.text)
        response = self.client.post("/api/next-actions/FLAG-C0001-BASELINE/decision", headers=self.sup, json={
            "suggestion_id": shown.json()["suggestion_id"], "decision": "accept", "on": "2026-10-15",
        })
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["decision"]["decision"], "accept")
        self.assertEqual(body["dispatched_result"]["task"]["status"], "open")
        self.assertEqual(len(self.store.list_tasks(beneficiary_id="C0001")), 1)
        audit_actions = [e["action"] for e in self.store.list_audit(centre_id="AWC-001")]
        self.assertIn("task_created", audit_actions)
        self.assertIn("decision_recorded", audit_actions)

        fresh = self.client.get("/api/next-actions/FLAG-C0001-BASELINE", headers=self.sup)
        self.assertEqual(fresh.status_code, 200, fresh.text)
        edited = self.client.post("/api/next-actions/FLAG-C0001-BASELINE/decision", headers=self.sup, json={
            "suggestion_id": fresh.json()["suggestion_id"],
            "decision": "edit", "edited_action": "Assign to the synthetic worker now.",
            "action_data": {"action_code": "assign", "owner_id": "W07"},
            "on": "2026-10-15",
        })
        self.assertEqual(edited.status_code, 200, edited.text)
        self.assertTrue(edited.json()["decision"]["dispatch_required"])
        self.assertEqual(edited.json()["dispatched_result"]["task"]["status"], "assigned")
        self.assertEqual(self.store.list_tasks(beneficiary_id="C0001")[0]["status"], "assigned")

    def test_stale_next_action_suggestion_is_rejected_after_workflow_changes(self):
        shown = self.client.get("/api/next-actions/FLAG-C0001-BASELINE", headers=self.sup).json()
        created = self.client.post("/api/tasks", headers=self.sup, json={"flag_id": "FLAG-C0001-BASELINE"})
        self.assertEqual(created.status_code, 200, created.text)
        stale = self.client.post("/api/next-actions/FLAG-C0001-BASELINE/decision", headers=self.sup, json={
            "suggestion_id": shown["suggestion_id"], "decision": "accept", "on": "2026-10-15",
        })
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.json()["error"]["code"], "stale_suggestion")
        self.assertEqual(self.store.list_decisions("C0001"), [])

    def test_offline_queue_failure_retry_conflict_resolution_and_sync_simulation(self):
        task_id = self._create_in_progress_task()
        queued = self.client.post("/api/offline/queue", headers=self.sup, json={
            "entity_type": "task", "entity_id": task_id,
            "payload": {"demo_sync_note": "synthetic update"},
            "base_version": 0, "created_at": "2026-10-15", "operation_id": "OP-DEMO-1",
        })
        self.assertEqual(queued.status_code, 200, queued.text)
        duplicate = self.client.post("/api/offline/queue", headers=self.sup, json={
            "entity_type": "task", "entity_id": task_id,
            "payload": {"demo_sync_note": "synthetic update"},
            "base_version": 0, "created_at": "2026-10-15", "operation_id": "OP-DEMO-1",
        })
        self.assertEqual(duplicate.status_code, 200, duplicate.text)
        self.assertEqual(len(self.client.get("/api/offline/queue", headers=self.sup).json()["operations"]), 1)
        failed = self.client.post("/api/offline/sync/attempt", headers=self.sup, json={"simulate_failure": True})
        self.assertEqual(failed.status_code, 200, failed.text)
        self.assertEqual(failed.json()["results"][0]["status"], "failed")

        retried = self.client.post("/api/offline/queue/OP-DEMO-1/retry", headers=self.sup)
        self.assertEqual(retried.status_code, 200, retried.text)
        conflict = self.client.post("/api/offline/sync/attempt", headers=self.sup, json={
            "server_state": {f"task:{task_id}": {"version": 2, "status": "in_progress"}},
        })
        self.assertEqual(conflict.json()["results"][0]["status"], "conflict")

        resolved = self.client.post("/api/offline/queue/OP-DEMO-1/resolve-conflict", headers=self.sup, json={
            "resolution": "retry_with_current_version", "latest_version": 2,
        })
        self.assertEqual(resolved.status_code, 200, resolved.text)
        synced = self.client.post("/api/offline/sync/attempt", headers=self.sup, json={
            "server_state": {f"task:{task_id}": {"version": 2, "status": "in_progress"}},
        })
        self.assertEqual(synced.json()["results"][0]["status"], "synced")
        self.assertFalse(synced.json()["remote_sync_enabled"])
        self.assertEqual(sync.load_operations(self.app.state.offline_queue_dir / "SUP-001.json")[0]["sync_status"], "synced")
        events = [e["action"] for e in self.store.list_audit(entity_type="offline_operation", entity_id="OP-DEMO-1")]
        self.assertIn("offline_operation_queued", events)
        self.assertIn("offline_sync_result", events)
        self.assertIn("offline_conflict_resolved", events)

    def test_offline_rejects_sensitive_keys_and_values(self):
        task_id = self._create_in_progress_task()
        response = self.client.post("/api/offline/queue", headers=self.sup, json={
            "entity_type": "task", "entity_id": task_id,
            "payload": {"aadhaar_number": "123"}, "base_version": 0,
            "created_at": "2026-10-15",
        })
        self.assertEqual(response.status_code, 400)
        numeric = self.client.post("/api/offline/queue", headers=self.sup, json={
            "entity_type": "task", "entity_id": task_id,
            "payload": {"value": 123456789012}, "base_version": 0,
            "created_at": "2026-10-15",
        })
        self.assertEqual(numeric.status_code, 400)

    def test_pure_workflow_guards(self):
        self.assertIsNone(closure.policy_for({}, "default"))
        record = access_exceptions.create_exception("C1", "AWC-001", "pending_mobile_verification", "W07", "2026-10-15")
        resolved = access_exceptions.resolve_exception(record, "SUP-001", "manual_review_completed", "2026-10-16")
        self.assertEqual(resolved["status"], "resolved")
        deferred = maternal.create_followup("C1", "AWC-001", 17, "routine_check_in", "2026-10-20", "SUP-001", True, ("supervisor",), "supervisor")
        self.assertTrue(deferred["deferred"])
        referral = referrals.create_followup_referral("C1", "AWC-001", "deic", "DEIC-DEMO", "disability_service_follow_up", "SUP-001", "2026-10-15", "2026-10-14")
        self.assertTrue(referrals.followup_is_overdue(referral, "2026-10-15"))
        self.assertFalse(referrals.followup_is_overdue({**referral, "due_on": None}, "2026-10-15"))


if __name__ == "__main__":
    unittest.main()
