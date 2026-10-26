"""FastAPI tests for the proposed synthetic BE2 Day 1 surface."""

import unittest

from fastapi.testclient import TestClient

from B2.api import create_app
from B2.store import PrototypeStore


class DayOneApiTests(unittest.TestCase):
    def setUp(self):
        self.store = PrototypeStore(":memory:")
        self.app = create_app(store=self.store, seed_demo=True)
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
        response = self.client.post("/api/verification", headers=self.worker, json={
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
        rejected_sensitive = self.client.post("/api/verification", headers=self.worker, json={
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


if __name__ == "__main__":
    unittest.main()
