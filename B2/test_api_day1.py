"""FastAPI tests for the proposed synthetic BE2 Day 1 surface."""

import unittest
from datetime import datetime, timezone
from uuid import UUID
from unittest.mock import patch

from fastapi.testclient import TestClient

from B2.api import create_app
from B2.auth import VerifiedIdentity
from B2.roles import AccountAuthorizationRecord, RoleAssignmentRecord
from B2.store import PrototypeStore


class TestOperationalRepository:
    """Test-only repository adapter so Supabase-mode tests do not pass SQLite directly."""

    def __init__(self, backing):
        self._backing = backing

    def __getattr__(self, name):
        return getattr(self._backing, name)


class DayOneApiTests(unittest.TestCase):
    def setUp(self):
        self.store = PrototypeStore(":memory:")
        self.app = create_app(store=self.store, seed_demo=True, auth_mode="demo")
        self.client = TestClient(self.app)
        self.supervisor = {"X-Demo-Actor": "demo-supervisor"}
        self.worker = {"X-Demo-Actor": "demo-worker"}

    def tearDown(self):
        self.store.close()

    def test_health_and_grounded_case_explanation(self):
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertTrue(health.json()["seeded"])
        self.assertFalse(health.json()["production_auth"])

        response = self.client.get(
            "/api/cases/C0001/explain",
            params={"flag_id": "FLAG-C0001-BASELINE"}, headers=self.supervisor,
        )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["mode"], "mock_record_grounded")
        self.assertEqual(body["source_measurement_id"], "MEAS-C0001-BASELINE")
        self.assertTrue(body["needs_human_verification"])
        self.assertNotIn("diagnosis", body["explanation"].lower())

    def test_history_links_original_measurement_and_saved_flag(self):
        response = self.client.get("/api/beneficiaries/C0001/history", headers=self.supervisor)
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["counts"]["measurements"], 1)
        self.assertTrue(any(item["record_id"] == "MEAS-C0001-BASELINE" for item in body["timeline"]))
        flag_item = next(item for item in body["timeline"] if item["type"] == "flag")
        self.assertEqual(flag_item["source_record_id"], "MEAS-C0001-BASELINE")

    def test_worker_cannot_access_other_centre(self):
        self.store.add_beneficiary({
            "beneficiary_id": "C9001", "centre_id": "AWC-002",
            "assigned_worker_id": "W25", "source_row": {"child_id": "C9001"},
        })
        response = self.client.get("/api/beneficiaries/C9001/history", headers=self.worker)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "forbidden")
        self.store.add_beneficiary({
            "beneficiary_id": "C9002", "centre_id": "AWC-001",
            "assigned_worker_id": "", "source_row": {"child_id": "C9002"},
        })
        unassigned = self.client.get("/api/beneficiaries/C9002/history", headers=self.worker)
        self.assertEqual(unassigned.status_code, 403)

    def test_verification_appends_measurement_without_overwriting_source(self):
        original_before = self.store.get_measurement("MEAS-C0001-BASELINE")
        response = self.client.post("/api/verification", headers=self.supervisor, json={
            "beneficiary_id": "C0001",
            "measurement": {
                "measurement_date": "2026-10-15", "weight_kg": 6.72,
                "height_cm": 74.0, "muac_mm": 112, "oedema": "no", "danger_sign": "no",
            },
            "recorded_at": "2026-10-15", "today": "2026-10-15",
        })
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        new_record = body["measurement"]
        self.assertNotEqual(new_record["measurement_id"], original_before["measurement_id"])
        self.assertEqual(new_record["parent_measurement_id"], original_before["measurement_id"])
        self.assertEqual(new_record["source"], "remeasurement")
        self.assertEqual(self.store.get_measurement("MEAS-C0001-BASELINE"), original_before)
        self.assertEqual(len(self.store.list_measurements("C0001")), 2)
        audit = self.store.list_audit(entity_type="measurement", entity_id=new_record["measurement_id"])
        self.assertEqual(audit[0]["action"], "remeasurement_saved")

    def test_task_transitions_audit_and_day1_blocks_single_key_closure(self):
        created = self.client.post("/api/tasks", headers=self.supervisor, json={"flag_id": "FLAG-C0001-BASELINE"})
        self.assertEqual(created.status_code, 200, created.text)
        task_id = created.json()["task"]["task_id"]
        duplicate = self.client.post("/api/tasks", headers=self.supervisor, json={"flag_id": "FLAG-C0001-BASELINE"})
        self.assertEqual(duplicate.status_code, 409)

        forged_owner = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.supervisor, json={
            "action": "assign", "owner_id": "MADE-UP-WORKER", "on": "2026-10-15",
        })
        self.assertEqual(forged_owner.status_code, 403)

        assigned = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.supervisor, json={
            "action": "assign", "owner_id": "W07", "on": "2026-10-15",
        })
        self.assertEqual(assigned.status_code, 200, assigned.text)
        self.assertEqual(assigned.json()["task"]["status"], "assigned")

        for action, expected in (("acknowledge", "acknowledged"), ("start", "in_progress")):
            result = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.worker, json={
                "action": action, "on": "2026-10-15",
            })
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()["task"]["status"], expected)

        blocked = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.supervisor, json={
            "action": "close", "outcome": "reached", "on": "2026-10-15",
        })
        self.assertEqual(blocked.status_code, 409)
        self.assertEqual(blocked.json()["error"]["code"], "two_key_closure_not_implemented")
        audit = self.store.list_audit(entity_type="task", entity_id=task_id)
        self.assertEqual([event["action"] for event in audit], ["task_created", "assign", "acknowledge", "start"])

    def test_next_action_decision_and_briefing_use_saved_records(self):
        suggestion = self.client.get("/api/next-actions/FLAG-C0001-BASELINE", headers=self.supervisor)
        self.assertEqual(suggestion.status_code, 200, suggestion.text)
        self.assertIn(suggestion.json()["action_code"], {"create_task", "verify_measurement"})

        decision = self.client.post("/api/next-actions/FLAG-C0001-BASELINE/decision", headers=self.supervisor, json={
            "decision": "reject", "reason": "Demo rejection for audit test.", "on": "2026-10-15",
        })
        self.assertEqual(decision.status_code, 200, decision.text)
        self.assertEqual(decision.json()["decision"]["decision"], "reject")
        self.assertFalse(decision.json()["decision"]["dispatch_required"])
        self.assertIsNone(decision.json()["decision"]["follow_up"])
        self.assertEqual(len(self.store.list_decisions("C0001")), 1)

        briefing = self.client.get("/api/briefing", params={"centre_id": "AWC-001", "as_of": "2026-10-15"}, headers={"X-Demo-Actor": "demo-nodal"})
        self.assertEqual(briefing.status_code, 200, briefing.text)
        self.assertEqual(briefing.json()["counts"]["flags"], len(self.store.list_flags(centre_id="AWC-001")))
        self.assertEqual(briefing.json()["counts_source"], "saved backend records; calculated by code, not generated by AI")

    def test_unknown_actor_cannot_use_api(self):
        response = self.client.get("/api/beneficiaries/C0001/history", headers={"X-Demo-Actor": "invented-admin"})
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
"""FastAPI tests for the proposed synthetic BE2 Day 1 surface."""

import unittest

from fastapi.testclient import TestClient

from B2.api import create_app
from B2.store import PrototypeStore


class DayOneApiTests(unittest.TestCase):
    def setUp(self):
        self.store = PrototypeStore(":memory:")
        self.app = create_app(store=self.store, seed_demo=True, auth_mode="demo")
        self.client = TestClient(self.app)
        self.supervisor = {"X-Demo-Actor": "demo-supervisor"}
        self.worker = {"X-Demo-Actor": "demo-worker"}

    def tearDown(self):
        self.store.close()

    def test_health_and_grounded_case_explanation(self):
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertTrue(health.json()["seeded"])
        self.assertFalse(health.json()["production_auth"])

        response = self.client.get(
            "/api/cases/C0001/explain",
            params={"flag_id": "FLAG-C0001-BASELINE"}, headers=self.supervisor,
        )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["mode"], "mock_record_grounded")
        self.assertEqual(body["source_measurement_id"], "MEAS-C0001-BASELINE")
        self.assertTrue(body["needs_human_verification"])
        self.assertNotIn("diagnosis", body["explanation"].lower())

    def test_history_links_original_measurement_and_saved_flag(self):
        response = self.client.get("/api/beneficiaries/C0001/history", headers=self.supervisor)
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["counts"]["measurements"], 1)
        self.assertTrue(any(item["record_id"] == "MEAS-C0001-BASELINE" for item in body["timeline"]))
        flag_item = next(item for item in body["timeline"] if item["type"] == "flag")
        self.assertEqual(flag_item["source_record_id"], "MEAS-C0001-BASELINE")

    def test_worker_cannot_access_other_centre(self):
        self.store.add_beneficiary({
            "beneficiary_id": "C9001", "centre_id": "AWC-002",
            "assigned_worker_id": "W25", "source_row": {"child_id": "C9001"},
        })
        response = self.client.get("/api/beneficiaries/C9001/history", headers=self.worker)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "forbidden")
        self.store.add_beneficiary({
            "beneficiary_id": "C9002", "centre_id": "AWC-001",
            "assigned_worker_id": "", "source_row": {"child_id": "C9002"},
        })
        unassigned = self.client.get("/api/beneficiaries/C9002/history", headers=self.worker)
        self.assertEqual(unassigned.status_code, 403)

    def test_verification_appends_measurement_without_overwriting_source(self):
        original_before = self.store.get_measurement("MEAS-C0001-BASELINE")
        response = self.client.post("/api/verification", headers=self.supervisor, json={
            "beneficiary_id": "C0001",
            "measurement": {
                "measurement_date": "2026-10-15", "weight_kg": 6.72,
                "height_cm": 74.0, "muac_mm": 112, "oedema": "no", "danger_sign": "no",
            },
            "recorded_at": "2026-10-15", "today": "2026-10-15",
        })
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        new_record = body["measurement"]
        self.assertNotEqual(new_record["measurement_id"], original_before["measurement_id"])
        self.assertEqual(new_record["parent_measurement_id"], original_before["measurement_id"])
        self.assertEqual(new_record["source"], "remeasurement")
        self.assertEqual(self.store.get_measurement("MEAS-C0001-BASELINE"), original_before)
        self.assertEqual(len(self.store.list_measurements("C0001")), 2)
        audit = self.store.list_audit(entity_type="measurement", entity_id=new_record["measurement_id"])
        self.assertEqual(audit[0]["action"], "remeasurement_saved")
        rejected_sensitive = self.client.post("/api/verification", headers=self.supervisor, json={
            "beneficiary_id": "C0001",
            "measurement": {"measurement_date": "2026-10-16", "weight_kg": 6.8,
                             "height_cm": 74, "muac_mm": 112, "aadhaar_number": "123456789012"},
            "recorded_at": "2026-10-16", "today": "2026-10-16",
        })
        self.assertEqual(rejected_sensitive.status_code, 400)
        self.assertEqual(len(self.store.list_measurements("C0001")), 2)

    def test_task_transitions_audit_and_day1_blocks_single_key_closure(self):
        created = self.client.post("/api/tasks", headers=self.supervisor, json={"flag_id": "FLAG-C0001-BASELINE"})
        self.assertEqual(created.status_code, 200, created.text)
        task_id = created.json()["task"]["task_id"]
        duplicate = self.client.post("/api/tasks", headers=self.supervisor, json={"flag_id": "FLAG-C0001-BASELINE"})
        self.assertEqual(duplicate.status_code, 409)

        forged_owner = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.supervisor, json={
            "action": "assign", "owner_id": "MADE-UP-WORKER", "on": "2026-10-15",
        })
        self.assertEqual(forged_owner.status_code, 403)

        assigned = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.supervisor, json={
            "action": "assign", "owner_id": "W07", "on": "2026-10-15",
        })
        self.assertEqual(assigned.status_code, 200, assigned.text)
        self.assertEqual(assigned.json()["task"]["status"], "assigned")

        for action, expected in (("acknowledge", "acknowledged"), ("start", "in_progress")):
            result = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.worker, json={
                "action": action, "on": "2026-10-15",
            })
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()["task"]["status"], expected)

        blocked = self.client.post(f"/api/tasks/{task_id}/actions", headers=self.supervisor, json={
            "action": "close", "outcome": "reached", "on": "2026-10-15",
        })
        self.assertEqual(blocked.status_code, 409)
        self.assertEqual(blocked.json()["error"]["code"], "two_key_confirmation_required")
        audit = self.store.list_audit(entity_type="task", entity_id=task_id)
        self.assertEqual([event["action"] for event in audit], ["task_created", "assign", "acknowledge", "start"])

    def test_next_action_decision_and_briefing_use_saved_records(self):
        suggestion = self.client.get("/api/next-actions/FLAG-C0001-BASELINE", headers=self.supervisor)
        self.assertEqual(suggestion.status_code, 200, suggestion.text)
        self.assertIn(suggestion.json()["action_code"], {"create_task", "verify_measurement"})

        decision = self.client.post("/api/next-actions/FLAG-C0001-BASELINE/decision", headers=self.supervisor, json={
            "suggestion_id": suggestion.json()["suggestion_id"],
            "decision": "reject", "reason": "Demo rejection for audit test.", "on": "2026-10-15",
        })
        self.assertEqual(decision.status_code, 200, decision.text)
        self.assertEqual(decision.json()["decision"]["decision"], "reject")
        self.assertFalse(decision.json()["decision"]["dispatch_required"])
        self.assertIsNone(decision.json()["decision"]["follow_up"])
        self.assertEqual(len(self.store.list_decisions("C0001")), 1)

        briefing = self.client.get("/api/briefing", params={"centre_id": "AWC-001", "as_of": "2026-10-15"}, headers={"X-Demo-Actor": "demo-nodal"})
        self.assertEqual(briefing.status_code, 200, briefing.text)
        self.assertEqual(briefing.json()["counts"]["flags"], len(self.store.list_flags(centre_id="AWC-001")))
        self.assertEqual(briefing.json()["counts_source"], "saved backend records; calculated by code, not generated by AI")

    def test_unknown_actor_cannot_use_api(self):
        response = self.client.get("/api/beneficiaries/C0001/history", headers={"X-Demo-Actor": "invented-admin"})
        self.assertEqual(response.status_code, 401)

    def test_authentication_disabled_fails_closed_even_for_demo_header(self):
        app = create_app(store=self.store, seed_demo=False, auth_mode="disabled")
        client = TestClient(app)
        response = client.get("/api/beneficiaries/C0001/history", headers=self.supervisor)
        self.assertEqual(response.status_code, 401)

    def test_beneficiary_registration_listing_retrieval_and_duplicate_validation(self):
        body = {"beneficiary_id": "BEN-API-1001", "date_of_birth": "2026-06-15",
                "sex": "F", "caregiver_kinship": "Mother"}
        created = self.client.post("/api/beneficiaries", headers=self.worker, json=body)
        self.assertEqual(created.status_code, 200, created.text)
        beneficiary = created.json()["beneficiary"]
        self.assertEqual(beneficiary["centre_id"], "AWC-001")
        self.assertEqual(beneficiary["assigned_worker_id"], "W07")
        self.assertEqual(self.client.get("/api/beneficiaries", params={"centre_id": "AWC-001"}, headers=self.worker).status_code, 200)
        self.assertEqual(self.client.get("/api/beneficiaries/BEN-API-1001", headers=self.worker).status_code, 200)
        duplicate = self.client.post("/api/beneficiaries", headers=self.worker, json=body)
        self.assertEqual(duplicate.status_code, 422)
        forged_scope = self.client.post("/api/beneficiaries", headers=self.worker, json={**body, "centre_id": "AWC-002"})
        self.assertEqual(forged_scope.status_code, 422)
        invalid = self.client.post("/api/beneficiaries", headers=self.worker, json={
            "date_of_birth": "not-a-date", "sex": "F", "untrusted": "987654321012",
        })
        self.assertEqual(invalid.status_code, 422)
        self.assertNotIn("not-a-date", invalid.text)
        self.assertNotIn("987654321012", invalid.text)
        not_aww = self.client.post("/api/beneficiaries", headers=self.supervisor, json=body)
        self.assertEqual(not_aww.status_code, 403)

    def test_initial_measurement_to_flag_task_and_referral_is_saved(self):
        created = self.client.post("/api/beneficiaries", headers=self.worker, json={
            "beneficiary_id": "BEN-API-1002", "date_of_birth": "2026-06-15", "sex": "F",
        })
        self.assertEqual(created.status_code, 200, created.text)
        measurement = self.client.post("/api/measurements", headers=self.worker, json={
            "beneficiary_id": "BEN-API-1002", "measurement": {
                "measurement_date": "2026-10-15", "weight_kg": 7.0, "height_cm": 64.0,
                "danger_sign": "yes",
            }, "recorded_at": "2026-10-15",
        })
        self.assertEqual(measurement.status_code, 200, measurement.text)
        measurement_id = measurement.json()["measurement"]["measurement_id"]
        flag_id = measurement.json()["flag"]["flag_id"]
        self.assertEqual(measurement.json()["measurement"]["recorded_by"], "W07")
        history = self.client.get("/api/beneficiaries/BEN-API-1002/measurements", headers=self.worker)
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()["measurements"][0]["measurement_id"], measurement_id)

        task = self.client.post("/api/tasks", headers=self.supervisor, json={"flag_id": flag_id})
        self.assertEqual(task.status_code, 200, task.text)
        task_id = task.json()["task"]["task_id"]
        referral = self.client.post("/api/referrals", headers=self.supervisor, json={
            "beneficiary_id": "BEN-API-1002", "referral_kind": "general",
            "destination": "PHC-DEMO", "reason_code": "case_follow_up", "task_id": task_id,
        })
        self.assertEqual(referral.status_code, 200, referral.text)
        self.assertEqual(referral.json()["referral"]["task_id"], task_id)
        self.assertEqual(self.store.get_measurement(measurement_id)["recorded_by"], "W07")
        self.assertEqual(self.store.get_flag(flag_id)["measurement_id"], measurement_id)
        self.assertEqual(self.store.get_referral(referral.json()["referral"]["referral_id"])["task_id"], task_id)

    def test_measurement_role_scope_and_dpo_detail_denials(self):
        worker_cannot_verify = self.client.post("/api/verification", headers=self.worker, json={
            "beneficiary_id": "C0001", "measurement": {"measurement_date": "2026-10-15"},
            "recorded_at": "2026-10-15",
        })
        self.assertEqual(worker_cannot_verify.status_code, 403)
        worker_out_of_scope = self.client.get("/api/beneficiaries", params={"centre_id": "AWC-002"}, headers=self.worker)
        self.assertEqual(worker_out_of_scope.status_code, 403)
        self.store.add_beneficiary({
            "beneficiary_id": "BEN-OTHER-CENTRE", "centre_id": "AWC-002",
            "assigned_worker_id": "W08", "source_row": {},
        })
        out_of_scope_record = self.client.get("/api/beneficiaries/BEN-OTHER-CENTRE", headers=self.worker)
        self.assertEqual(out_of_scope_record.status_code, 403)
        dpo_detail = self.client.get("/api/beneficiaries/C0001", headers={"X-Demo-Actor": "demo-nodal"})
        self.assertEqual(dpo_detail.status_code, 403)

    def test_demo_mode_is_rejected_for_production_environment(self):
        with patch.dict("os.environ", {"B2_ENV": "production"}):
            with self.assertRaises(RuntimeError):
                create_app(store=self.store, seed_demo=False, auth_mode="demo")

    def test_production_mode_never_falls_back_to_demo_or_sqlite(self):
        with patch.dict("os.environ", {"B2_AUTH_MODE": "production", "B2_ENV": "production"}):
            with self.assertRaises(RuntimeError):
                create_app(store=self.store, seed_demo=False)

    def test_supabase_boundary_rejects_demo_header_and_uses_server_assignments(self):
        subject_id = UUID("87c6dd4f-4d83-4f06-8f53-80b7be6d6c51")

        class Verifier:
            def verify_request(self, request):
                if request.headers.get("authorization") != "Bearer valid-test-token":
                    raise ValueError("invalid token")
                return VerifiedIdentity("supabase-test", str(subject_id))

        class Assignments:
            def resolve_assignments(self, resolved_subject_id):
                return AccountAuthorizationRecord(
                    subject_id=resolved_subject_id,
                    is_active=True,
                    assignments=(RoleAssignmentRecord(
                        role="DPO", scope_type="district", scope_id="district-1",
                        valid_from=datetime(2020, 1, 1, tzinfo=timezone.utc),
                    ),),
                )

        class LsAssignments:
            def resolve_assignments(self, resolved_subject_id):
                return AccountAuthorizationRecord(
                    subject_id=resolved_subject_id,
                    is_active=True,
                    assignments=(RoleAssignmentRecord(
                        role="LS", scope_type="sector", scope_id="sector-1",
                        valid_from=datetime(2020, 1, 1, tzinfo=timezone.utc),
                    ),),
                )

        class Hierarchy:
            def validate_scope(self, scope):
                return (scope.kind, scope.organization_id) in {
                    ("district", "district-1"), ("sector", "sector-1"),
                }

            def contains_centre(self, scope_type, scope_id, centre_id):
                return (scope_type, scope_id, centre_id) in {
                    ("district", "district-1", "AWC-001"),
                    ("sector", "sector-1", "AWC-001"),
                }

            def centres_in_scope(self, scope_type, scope_id):
                return ("AWC-001",) if (scope_type, scope_id) == ("district", "district-1") else ()

        app = create_app(
            store=TestOperationalRepository(self.store), seed_demo=False, auth_mode="supabase",
            identity_verifier=Verifier(), assignment_resolver=Assignments(),
            organization_hierarchy=Hierarchy(),
        )
        client = TestClient(app)
        forged = client.get("/api/briefing", params={"centre_id": "AWC-001"}, headers={
            "Authorization": "Bearer valid-test-token", "X-Demo-Actor": "demo-supervisor",
        })
        self.assertEqual(forged.status_code, 401)
        invalid_token = client.get("/api/briefing", headers={"Authorization": "Bearer forged-token"})
        self.assertEqual(invalid_token.status_code, 401)
        detail = client.get("/api/beneficiaries/C0001/history", headers={
            "Authorization": "Bearer valid-test-token", "X-Role": "System Administrator",
            "X-Centre-Id": "AWC-001",
        })
        self.assertEqual(detail.status_code, 403)
        aggregate = client.get("/api/briefing", headers={"Authorization": "Bearer valid-test-token"})
        self.assertEqual(aggregate.status_code, 200, aggregate.text)
        self.assertNotIn("action_items", aggregate.json())
        self.assertNotIn("beneficiary_id", str(aggregate.json()))

        ls_app = create_app(
            store=TestOperationalRepository(self.store), seed_demo=False, auth_mode="supabase",
            identity_verifier=Verifier(), assignment_resolver=LsAssignments(),
            organization_hierarchy=Hierarchy(),
        )
        ls_client = TestClient(ls_app)
        created = ls_client.post("/api/tasks", headers={"Authorization": "Bearer valid-test-token"}, json={
            "flag_id": "FLAG-C0001-BASELINE",
        })
        self.assertEqual(created.status_code, 200, created.text)
        task_id = created.json()["task"]["task_id"]
        assignment = ls_client.post(f"/api/tasks/{task_id}/actions", headers={
            "Authorization": "Bearer valid-test-token",
        }, json={"action": "assign", "owner_id": "W07"})
        self.assertEqual(assignment.status_code, 409)
        self.assertEqual(assignment.json()["error"]["code"], "assignment_directory_unavailable")

    def test_supabase_mode_requires_verifier_assignments_and_hierarchy(self):
        with self.assertRaises(RuntimeError):
            create_app(store=self.store, seed_demo=False, auth_mode="supabase")
        with self.assertRaises(RuntimeError):
            create_app(
                store=self.store, seed_demo=False, auth_mode="supabase",
                identity_verifier=object(), assignment_resolver=object(), organization_hierarchy=object(),
            )


if __name__ == "__main__":
    unittest.main()
