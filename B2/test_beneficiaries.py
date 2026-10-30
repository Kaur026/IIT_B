"""Persistence and screening tests for the prototype beneficiary workflow."""

import unittest

from B2 import beneficiaries, referrals, tasks, verification
from B2.store import PrototypeStore, StoreError


class BeneficiaryWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.store = PrototypeStore(":memory:")

    def tearDown(self):
        self.store.close()

    def _registered(self):
        return beneficiaries.register_beneficiary(
            self.store, beneficiary_id="BEN-TEST-1001", date_of_birth="2026-06-15",
            sex="F", centre_id="AWC-001", assigned_worker_id="W07",
            caregiver_kinship="Mother", registered_at="2026-10-15",
        )

    def test_registration_persists_server_supplied_scope_and_rejects_duplicates(self):
        record = self._registered()
        self.assertEqual(record["centre_id"], "AWC-001")
        self.assertEqual(record["assigned_worker_id"], "W07")
        self.assertEqual(self.store.get_beneficiary("BEN-TEST-1001"), record)
        with self.assertRaises(beneficiaries.BeneficiaryError):
            self._registered()

    def test_initial_measurement_saves_actor_evaluation_flag_then_task_and_referral(self):
        beneficiary = self._registered()
        result = beneficiaries.record_initial_measurement(
            self.store, beneficiary,
            {"measurement_date": "2026-10-15", "weight_kg": 7.0,
             "height_cm": 64.0, "danger_sign": "yes"},
            "W07", "2026-10-15", "2026-10-15",
        )
        measurement, flag = result["measurement"], result["flag"]
        self.assertEqual(measurement["recorded_by"], "W07")
        self.assertEqual(measurement["age_months"], 4)
        self.assertEqual(self.store.list_measurements("BEN-TEST-1001"), [measurement])
        self.assertEqual(self.store.get_flag(flag["flag_id"]), flag)
        self.assertEqual(flag["measurement_id"], measurement["measurement_id"])
        self.assertEqual(flag["colour"], "RED")

        verified = verification.remeasure(
            self.store, beneficiary["beneficiary_id"],
            {"measurement_date": "2026-10-16", "weight_kg": 7.1,
             "height_cm": 64.2, "danger_sign": "yes"},
            "SUP-001", "2026-10-16", "2026-10-16",
        )
        self.assertEqual(verified["measurement"]["parent_measurement_id"], measurement["measurement_id"])
        self.assertEqual(verified["measurement"]["age_months"], 4)
        self.assertEqual(self.store.get_flag(verified["flag"]["flag_id"])["measurement_id"], verified["measurement"]["measurement_id"])

        task = tasks.create_task(
            {"child_id": beneficiary["beneficiary_id"], "assigned_worker_id": "W07"},
            measurement["evaluation"], "2026-10-15",
        )
        self.assertIsNotNone(task)
        task.update({"beneficiary_id": beneficiary["beneficiary_id"], "centre_id": "AWC-001",
                     "flag_id": flag["flag_id"]})
        self.store.save_task(task)
        referral = referrals.create_followup_referral(
            beneficiary["beneficiary_id"], "AWC-001", "general", "PHC-DEMO",
            "case_follow_up", "SUP-001", "2026-10-15", task_id=task["task_id"],
        )
        self.store.save_referral(referral)
        self.assertEqual(self.store.get_task(task["task_id"])["flag_id"], flag["flag_id"])
        self.assertEqual(self.store.get_referral(referral["referral_id"])["task_id"], task["task_id"])

    def test_measurement_validation_and_duplicate_initial_record(self):
        beneficiary = self._registered()
        with self.assertRaises(beneficiaries.BeneficiaryError):
            beneficiaries.record_initial_measurement(
                self.store, beneficiary, {"measurement_date": "2026-10-15", "weight_kg": float("nan"),
                                          "height_cm": 64}, "W07", "2026-10-15",
            )
        values = {"measurement_date": "2026-10-15", "weight_kg": 7, "height_cm": 64}
        beneficiaries.record_initial_measurement(self.store, beneficiary, values, "W07", "2026-10-15")
        with self.assertRaises(beneficiaries.BeneficiaryError):
            beneficiaries.record_initial_measurement(self.store, beneficiary, values, "W07", "2026-10-15")

    def test_atomic_measurement_and_flag_write_rolls_back_on_duplicate_flag(self):
        beneficiary = self._registered()
        first_measurement = {"measurement_id": "m-1", "beneficiary_id": beneficiary["beneficiary_id"],
                             "centre_id": "AWC-001", "source": "initial", "recorded_at": "2026-10-15"}
        first_flag = {"flag_id": "f-1", "beneficiary_id": beneficiary["beneficiary_id"],
                      "centre_id": "AWC-001", "created_at": "2026-10-15", "measurement_id": "m-1"}
        self.store.save_measurement_and_flag(first_measurement, first_flag)
        second_measurement = {**first_measurement, "measurement_id": "m-2"}
        second_measurement["source"] = "remeasurement"
        with self.assertRaises(StoreError):
            self.store.save_measurement_and_flag(second_measurement, first_flag)
        self.assertIsNone(self.store.get_measurement("m-2"))

    def test_store_rejects_a_second_initial_measurement_even_with_distinct_ids(self):
        beneficiary = self._registered()
        measurement = {"measurement_id": "initial-1", "beneficiary_id": beneficiary["beneficiary_id"],
                       "centre_id": "AWC-001", "source": "initial", "recorded_at": "2026-10-15"}
        flag = {"flag_id": "flag-1", "beneficiary_id": beneficiary["beneficiary_id"],
                "centre_id": "AWC-001", "created_at": "2026-10-15", "measurement_id": "initial-1"}
        self.store.save_measurement_and_flag(measurement, flag)
        duplicate = {**measurement, "measurement_id": "initial-2"}
        duplicate_flag = {**flag, "flag_id": "flag-2", "measurement_id": "initial-2"}
        with self.assertRaises(StoreError):
            self.store.save_measurement_and_flag(duplicate, duplicate_flag)
        self.assertIsNone(self.store.get_measurement("initial-2"))


if __name__ == "__main__":
    unittest.main()
