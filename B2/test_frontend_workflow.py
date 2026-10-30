"""Phase 1 synthetic workflow API tests using a test-only dependency override.

Each test app uses an in-memory PrototypeStore and keeps auth_mode disabled.
The override applies only to the freshly created app instance in this module;
the module-level application and production auth resolver are not replaced.
"""

import json
import os
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from B2 import exceptions as exception_service, referrals as referral_service, tasks as task_service

# B2.api creates its module-level app on import. Ensure that import owns only
# an in-memory SQLite store; never let this test module touch the developer's
# default prototype database.
os.environ["B2_DB_PATH"] = ":memory:"

from B2.api import app as default_app, create_app, phase_one_principal_dependency
from B2.roles import Principal, ROLE_PERMISSIONS
from B2.store import PrototypeStore


CONTRACT_PATH = Path(__file__).resolve().parents[1] / "contracts" / "synthetic-workflow-v1.json"
CONTRACT = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
TEST_ACTOR = CONTRACT["principal"]
TEST_BENEFICIARY = CONTRACT["beneficiary"]


def contract_principal() -> Principal:
    return Principal(
        TEST_ACTOR["actor_id"],
        TEST_ACTOR["role"],
        tuple(TEST_ACTOR["centre_ids"]),
        TEST_ACTOR["assigned_worker_id"],
    )


class SyntheticWorkflowApiTests(unittest.TestCase):
    def setUp(self):
        self.store = PrototypeStore(":memory:")
        self.store.add_beneficiary(dict(TEST_BENEFICIARY))
        self.app = create_app(
            store=self.store,
            seed_demo=False,
            auth_mode="disabled",
        )
        self.app.dependency_overrides[phase_one_principal_dependency] = contract_principal
        self.client = TestClient(self.app)
        self.centre_id = TEST_BENEFICIARY["centre_id"]
        self.beneficiary_id = TEST_BENEFICIARY["beneficiary_id"]

    def tearDown(self):
        self.client.close()
        self.store.close()

    def test_list_and_recorded_measurement_are_persisted_with_matching_flag(self):
        listing = self.client.get("/api/beneficiaries", params={"centre_id": self.centre_id})
        self.assertEqual(listing.status_code, 200, listing.text)
        self.assertEqual(listing.json()["label"], "SYNTHETIC DATA / PROPOSED INTEGRATION")
        self.assertEqual(
            [item["beneficiary_id"] for item in listing.json()["beneficiaries"]],
            [self.beneficiary_id],
        )

        write = self.client.post("/api/measurements", json=CONTRACT["first_measurement"])
        self.assertEqual(write.status_code, 200, write.text)
        body = write.json()
        measurement, flag = body["measurement"], body["flag"]
        self.assertEqual(measurement["beneficiary_id"], self.beneficiary_id)
        self.assertEqual(measurement["centre_id"], self.centre_id)
        self.assertEqual(flag["beneficiary_id"], measurement["beneficiary_id"])
        self.assertEqual(flag["centre_id"], measurement["centre_id"])
        self.assertEqual(flag["measurement_id"], measurement["measurement_id"])
        self.assertEqual(flag["colour"], measurement["evaluation"]["colour"])
        self.assertTrue(flag["needs_human_verification"])

        # A new GET models a page refresh and reads only persisted API state.
        refreshed = self.client.get(f"/api/beneficiaries/{self.beneficiary_id}/measurements")
        self.assertEqual(refreshed.status_code, 200, refreshed.text)
        self.assertEqual(refreshed.json()["measurements"], [measurement])
        self.assertEqual(refreshed.json()["flags"], [flag])
        events = self.store.list_audit(centre_id=self.centre_id)
        self.assertTrue(any(
            event["action"] == "measurement_recorded"
            and event["entity_id"] == measurement["measurement_id"]
            for event in events
        ))

    def test_invalid_measurement_writes_nothing(self):
        request = dict(CONTRACT["first_measurement"])
        request["measurement"] = dict(request["measurement"], weight_kg="not-a-number")
        response = self.client.post("/api/measurements", json=request)
        self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(self.store.list_measurements(self.beneficiary_id), [])
        self.assertEqual(self.store.list_flags(beneficiary_id=self.beneficiary_id), [])
        self.assertEqual(self.store.list_audit(centre_id=self.centre_id), [])

    def test_duplicate_first_measurement_is_rejected_without_extra_records(self):
        request = CONTRACT["first_measurement"]
        first = self.client.post("/api/measurements", json=request)
        self.assertEqual(first.status_code, 200, first.text)
        duplicate = self.client.post("/api/measurements", json=request)
        self.assertEqual(duplicate.status_code, 422, duplicate.text)
        self.assertEqual(len(self.store.list_measurements(self.beneficiary_id)), 1)
        self.assertEqual(len(self.store.list_flags(beneficiary_id=self.beneficiary_id)), 1)

    def test_unknown_beneficiary_is_not_created_by_measurement_request(self):
        request = dict(CONTRACT["first_measurement"], beneficiary_id="PAL-IT-BEN-MISSING")
        response = self.client.post("/api/measurements", json=request)
        self.assertEqual(response.status_code, 404, response.text)
        self.assertIsNone(self.store.get_beneficiary("PAL-IT-BEN-MISSING"))
        self.assertEqual(self.store.list_measurements(self.beneficiary_id), [])

    def test_mismatched_centre_scope_is_denied_without_reads_or_writes(self):
        other_actor = Principal(
            TEST_ACTOR["actor_id"], TEST_ACTOR["role"],
            ("PAL-IT-CENTRE-OTHER",), TEST_ACTOR["assigned_worker_id"],
        )
        self.app.dependency_overrides[phase_one_principal_dependency] = lambda: other_actor
        listing = self.client.get("/api/beneficiaries", params={"centre_id": self.centre_id})
        write = self.client.post("/api/measurements", json=CONTRACT["first_measurement"])
        self.assertEqual(listing.status_code, 403, listing.text)
        self.assertEqual(write.status_code, 403, write.text)
        self.assertEqual(self.store.list_measurements(self.beneficiary_id), [])
        self.assertEqual(self.store.list_flags(beneficiary_id=self.beneficiary_id), [])
        self.assertEqual(self.store.list_audit(centre_id=self.centre_id), [])

    def test_unauthorized_role_is_denied_without_audit(self):
        unauthorized = Principal("PAL-IT-PUBLIC-001", "User")
        self.app.dependency_overrides[phase_one_principal_dependency] = lambda: unauthorized
        listing = self.client.get("/api/beneficiaries", params={"centre_id": self.centre_id})
        write = self.client.post("/api/measurements", json=CONTRACT["first_measurement"])
        self.assertEqual(listing.status_code, 403, listing.text)
        self.assertEqual(write.status_code, 403, write.text)
        self.assertEqual(self.store.list_measurements(self.beneficiary_id), [])
        self.assertEqual(self.store.list_audit(centre_id=self.centre_id), [])

    def test_default_disabled_auth_denies_even_a_demo_header(self):
        self.assertEqual(default_app.state.auth_mode, "disabled")
        with TestClient(default_app) as client:
            response = client.get(
                "/api/beneficiaries",
                params={"centre_id": self.centre_id},
                headers={"X-Demo-Actor": "demo-worker"},
            )
        self.assertEqual(response.status_code, 401, response.text)

    def test_task_referral_listing_and_briefing_use_scoped_backend_records(self):
        task = task_service.create_task(
            dict(TEST_BENEFICIARY["source_row"]), {"colour": "RED"},
            created_on="2026-10-15", task_id="PAL-IT-TASK-001",
        )
        task.update({
            "beneficiary_id": self.beneficiary_id,
            "centre_id": self.centre_id,
            "flag_id": "PAL-IT-FLAG-001",
        })
        self.store.save_task(task)
        referral = referral_service.create_followup_referral(
            self.beneficiary_id, self.centre_id, "general", "PAL-IT-SERVICE",
            "case_follow_up", TEST_ACTOR["actor_id"], "2026-10-15",
            task_id=task["task_id"],
        )
        self.store.save_referral(referral)
        exception = exception_service.create_exception(
            self.beneficiary_id, self.centre_id, "document_unavailable",
            TEST_ACTOR["actor_id"], "2026-10-15", task["task_id"],
        )
        self.store.save_exception(exception)

        listed_tasks = self.client.get("/api/tasks", params={"centre_id": self.centre_id})
        listed_referrals = self.client.get("/api/referrals", params={"centre_id": self.centre_id})
        briefing = self.client.get("/api/briefing", params={"centre_id": self.centre_id})

        self.assertEqual(listed_tasks.status_code, 200, listed_tasks.text)
        self.assertEqual([item["task_id"] for item in listed_tasks.json()["tasks"]], [task["task_id"]])
        self.assertEqual(listed_referrals.status_code, 200, listed_referrals.text)
        self.assertEqual([item["referral_id"] for item in listed_referrals.json()["referrals"]], [referral["referral_id"]])
        self.assertEqual(briefing.status_code, 200, briefing.text)
        self.assertEqual(briefing.json()["counts"]["tasks"], 1)
        supervisor = Principal("PAL-IT-SUPERVISOR-001", "LS", (self.centre_id,))
        self.app.dependency_overrides[phase_one_principal_dependency] = lambda: supervisor
        listed_exceptions = self.client.get("/api/access-exceptions", params={"centre_id": self.centre_id})
        self.assertEqual(listed_exceptions.status_code, 200, listed_exceptions.text)
        self.assertEqual([item["exception_id"] for item in listed_exceptions.json()["exceptions"]], [exception["exception_id"]])

    def test_task_listing_and_briefing_deny_wrong_centre_and_unauthorized_role(self):
        task = task_service.create_task(
            dict(TEST_BENEFICIARY["source_row"]), {"colour": "RED"},
            created_on="2026-10-15", task_id="PAL-IT-TASK-SCOPE-001",
        )
        task.update({"beneficiary_id": self.beneficiary_id, "centre_id": self.centre_id, "flag_id": "PAL-IT-FLAG-SCOPE"})
        self.store.save_task(task)
        out_of_scope = Principal("PAL-IT-SUPERVISOR-001", "LS", ("PAL-IT-CENTRE-OTHER",))
        self.app.dependency_overrides[phase_one_principal_dependency] = lambda: out_of_scope
        for path in ("/api/tasks", "/api/referrals", "/api/access-exceptions", "/api/briefing"):
            response = self.client.get(path, params={"centre_id": self.centre_id})
            self.assertEqual(response.status_code, 403, response.text)

    def test_worker_task_and_referral_lists_filter_other_workers(self):
        other_beneficiary = dict(TEST_BENEFICIARY)
        other_beneficiary.update({
            "beneficiary_id": "PAL-IT-BEN-OTHER-WORKER",
            "child_id": "PAL-IT-BEN-OTHER-WORKER",
            "assigned_worker_id": "PAL-IT-WORKER-OTHER",
            "source_row": dict(TEST_BENEFICIARY["source_row"], child_id="PAL-IT-BEN-OTHER-WORKER", assigned_worker_id="PAL-IT-WORKER-OTHER"),
        })
        self.store.add_beneficiary(other_beneficiary)
        other_task = task_service.create_task(
            other_beneficiary["source_row"], {"colour": "RED"},
            created_on="2026-10-15", task_id="PAL-IT-TASK-OTHER-WORKER",
        )
        other_task.update({"beneficiary_id": other_beneficiary["beneficiary_id"], "centre_id": self.centre_id, "flag_id": "PAL-IT-FLAG-OTHER"})
        self.store.save_task(other_task)
        other_referral = referral_service.create_followup_referral(
            other_beneficiary["beneficiary_id"], self.centre_id, "general", "PAL-IT-SERVICE",
            "case_follow_up", "PAL-IT-WORKER-OTHER", "2026-10-15",
        )
        self.store.save_referral(other_referral)

        own_task = task_service.create_task(
            dict(TEST_BENEFICIARY["source_row"]), {"colour": "RED"},
            created_on="2026-10-15", task_id="PAL-IT-TASK-OWN-WORKER",
        )
        own_task.update({"beneficiary_id": self.beneficiary_id, "centre_id": self.centre_id, "flag_id": "PAL-IT-FLAG-OWN"})
        self.store.save_task(own_task)
        own_referral = referral_service.create_followup_referral(
            self.beneficiary_id, self.centre_id, "general", "PAL-IT-SERVICE",
            "case_follow_up", TEST_ACTOR["actor_id"], "2026-10-15",
        )
        self.store.save_referral(own_referral)

        tasks_response = self.client.get("/api/tasks", params={"centre_id": self.centre_id})
        referrals_response = self.client.get("/api/referrals", params={"centre_id": self.centre_id})
        self.assertEqual(tasks_response.status_code, 200, tasks_response.text)
        self.assertEqual([item["task_id"] for item in tasks_response.json()["tasks"]], [own_task["task_id"]])
        self.assertEqual(referrals_response.status_code, 200, referrals_response.text)
        self.assertEqual([item["referral_id"] for item in referrals_response.json()["referrals"]], [own_referral["referral_id"]])

    def test_exception_view_is_ls_only_and_task_mutation_checks_role_and_scope(self):
        exception = exception_service.create_exception(
            self.beneficiary_id, self.centre_id, "document_unavailable",
            TEST_ACTOR["actor_id"], "2026-10-15",
        )
        self.store.save_exception(exception)
        self.app.dependency_overrides[phase_one_principal_dependency] = contract_principal
        worker_list = self.client.get("/api/access-exceptions", params={"centre_id": self.centre_id})
        worker_create = self.client.post("/api/access-exceptions", json={
            "beneficiary_id": self.beneficiary_id, "exception_type": "other_review_needed",
        })
        self.assertEqual(worker_list.status_code, 403, worker_list.text)
        self.assertEqual(worker_create.status_code, 200, worker_create.text)
        self.assertNotIn("view_exceptions", ROLE_PERMISSIONS["AWW"])
        self.assertIn("create_exception", ROLE_PERMISSIONS["AWW"])

        cdpo = Principal("PAL-IT-CDPO-001", "CDPO", (self.centre_id,))
        self.app.dependency_overrides[phase_one_principal_dependency] = lambda: cdpo
        denied_exceptions = self.client.get("/api/access-exceptions", params={"centre_id": self.centre_id})
        self.assertEqual(denied_exceptions.status_code, 403, denied_exceptions.text)
        self.assertNotIn("view_exceptions", ROLE_PERMISSIONS["CDPO"])

        task = task_service.create_task(
            dict(TEST_BENEFICIARY["source_row"]), {"colour": "RED"},
            created_on="2026-10-15", task_id="PAL-IT-TASK-AUTH-001",
        )
        task.update({"beneficiary_id": self.beneficiary_id, "centre_id": self.centre_id, "flag_id": "PAL-IT-FLAG-AUTH", "status": "assigned"})
        self.store.save_task(task)
        own_worker = Principal(TEST_ACTOR["actor_id"], "worker", (self.centre_id,), TEST_ACTOR["assigned_worker_id"])
        self.app.dependency_overrides[phase_one_principal_dependency] = lambda: own_worker
        allowed = self.client.post(f"/api/tasks/{task['task_id']}/actions", json={"action": "acknowledge"})
        self.assertEqual(allowed.status_code, 200, allowed.text)
        self.assertEqual(self.store.get_task(task["task_id"])["status"], "acknowledged")

        out_of_scope = Principal("PAL-IT-SUPERVISOR-001", "LS", ("PAL-IT-CENTRE-OTHER",))
        self.app.dependency_overrides[phase_one_principal_dependency] = lambda: out_of_scope
        denied_scope = self.client.post(f"/api/tasks/{task['task_id']}/actions", json={"action": "start"})
        self.assertEqual(denied_scope.status_code, 403, denied_scope.text)
        self.assertEqual(self.store.get_task(task["task_id"])["status"], "acknowledged")

        unauthorized = Principal("PAL-IT-PUBLIC-001", "User", (self.centre_id,))
        self.app.dependency_overrides[phase_one_principal_dependency] = lambda: unauthorized
        denied_role = self.client.post(f"/api/tasks/{task['task_id']}/actions", json={"action": "start"})
        self.assertEqual(denied_role.status_code, 403, denied_role.text)
        self.assertEqual(self.store.get_task(task["task_id"])["status"], "acknowledged")

        unauthorized = Principal("PAL-IT-PUBLIC-001", "User")
        self.app.dependency_overrides[phase_one_principal_dependency] = lambda: unauthorized
        for path in ("/api/tasks", "/api/referrals", "/api/access-exceptions", "/api/briefing"):
            response = self.client.get(path, params={"centre_id": self.centre_id})
            self.assertEqual(response.status_code, 403, response.text)


if __name__ == "__main__":
    unittest.main()
