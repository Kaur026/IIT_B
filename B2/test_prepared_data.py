import csv
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from B2 import prepared_data, prepared_dataset


def _write_rows(directory: Path, filename: str, columns: tuple[str, ...], rows: list[dict[str, str]]) -> None:
    with (directory / filename).open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def _minimal_files(directory: Path) -> None:
    beneficiaries = [
        {"beneficiary_id": f"BEN-{i}", "centre_id": "AWC-1", "category": category,
         "name": "Synthetic", "sex": "F", "date_of_birth": "2020-01-01",
         "enrolment_date": "2025-01-01", "guardian_name": "Synthetic",
         "mobile_verification_status": "not_available", "possible_duplicate_of": "",
         "synthetic_flag": "SYNTHETIC"}
        for i, category in enumerate(("child", "pregnant_woman", "lactating_mother"), 1)
    ]
    centres = [{"centre_id": "AWC-1", "name": "Synthetic Centre", "block": "Block-1",
                "district": "District-1", "state": "Synthetic State", "worker_id": "WRK-1",
                "synthetic_flag": "SYNTHETIC"}]
    measurements = [{"measurement_id": "M-1", "beneficiary_id": "BEN-1", "centre_id": "AWC-1",
                     "measured_on": "2025-01-01", "recorded_by": "WRK-1", "weight_value": "10",
                     "weight_unit": "kg", "height_value": "80", "height_unit": "cm", "muac_cm": "12",
                     "is_baseline": "1", "supersedes_id": "", "entry_source": "paper_entry",
                     "synthetic_flag": "SYNTHETIC"}]
    tasks = [{"task_id": "T-1", "flag_id": "F-1", "beneficiary_id": "BEN-1", "centre_id": "AWC-1",
              "owner_role": "anganwadi_worker", "status": "assigned", "created_on": "2025-01-01",
              "due_on": "2025-01-02", "closed_on": "", "outcome": "", "audit_entries": "1",
              "synthetic_flag": "SYNTHETIC"},
             {"task_id": "T-2", "flag_id": "F-2", "beneficiary_id": "BEN-2", "centre_id": "AWC-1",
              "owner_role": "anganwadi_worker", "status": "closed", "created_on": "2025-01-01",
              "due_on": "2025-01-02", "closed_on": "2025-01-02", "outcome": "reading_verified",
              "audit_entries": "4", "synthetic_flag": "SYNTHETIC"}]
    referrals = [{"referral_id": "R-1", "beneficiary_id": "BEN-1", "centre_id": "AWC-1",
                  "referral_type": "health_facility", "state": "sent", "sent_on": "2025-01-01",
                  "acknowledged_on": "", "attended_on": "", "outcome_on": "", "outcome_note": "",
                  "due_on": "2025-01-02", "synthetic_flag": "SYNTHETIC"}]
    age_bands = [{"band_id": "AGE-1", "label": "Synthetic band", "min_months": "0",
                  "max_months": "6", "service_name": "growth_monitoring", "verified": "false",
                  "status": "draft", "synthetic_flag": "SYNTHETIC"}]
    workers = [{"worker_id": "WRK-1", "name": "Synthetic Worker", "centre_id": "AWC-1",
                "role": "anganwadi_worker", "synthetic_flag": "SYNTHETIC"}]
    home_visits = [{"visit_id": "VIS-1", "beneficiary_id": "BEN-1", "centre_id": "AWC-1",
                    "visit_date": "2025-01-01", "visited_by": "WRK-1", "outcome": "advice_given",
                    "synthetic_flag": "SYNTHETIC"}]
    maternal_profiles = [
        {"maternal_id": "MAT-1", "beneficiary_id": "BEN-2", "centre_id": "AWC-1",
         "stage": "trimester_1", "registered_on": "2025-01-01", "last_visit_on": "2025-01-01",
         "next_visit_due_on": "2025-02-01", "access_level": "restricted", "synthetic_flag": "SYNTHETIC"},
        {"maternal_id": "MAT-2", "beneficiary_id": "BEN-3", "centre_id": "AWC-1",
         "stage": "postnatal_0_6m", "registered_on": "2025-01-01", "last_visit_on": "2025-01-01",
         "next_visit_due_on": "2025-02-01", "access_level": "deferred_under_18", "synthetic_flag": "SYNTHETIC"},
    ]
    review_history = [{"review_id": "REV-1", "flag_id": "F-1", "measurement_id": "M-1",
                       "centre_id": "AWC-1", "reviewed_by": "WRK-1", "flagged_on": "2025-01-01",
                       "reviewed_on": "2025-01-02", "decision": "valid_reading",
                       "synthetic_flag": "SYNTHETIC"}]
    service_records = [{"service_id": "SRV-1", "beneficiary_id": "BEN-1", "centre_id": "AWC-1",
                        "service_type": "supplement", "service_date": "2025-01-01", "quantity": "1",
                        "synthetic_flag": "SYNTHETIC"}]
    verification_records = [{"verification_id": "VER-1", "beneficiary_id": "BEN-1", "centre_id": "AWC-1",
                             "barrier_type": "other", "status": "open", "opened_on": "2025-01-01",
                             "resolved_on": "", "resolution_note": "", "synthetic_flag": "SYNTHETIC"}]
    file_rows = {
        "age_bands_reference.csv": age_bands,
        "beneficiaries.csv": beneficiaries,
        "centres.csv": centres,
        "home_visits.csv": home_visits,
        "maternal_profiles.csv": maternal_profiles,
        "measurements.csv": measurements,
        "referrals.csv": referrals,
        "review_history.csv": review_history,
        "service_records.csv": service_records,
        "tasks_seed.csv": tasks,
        "verification_records.csv": verification_records,
        "workers.csv": workers,
    }
    for filename, rows in file_rows.items():
        _write_rows(directory, filename, prepared_data.SCHEMAS[filename], rows)


class PreparedDataSummaryTests(unittest.TestCase):
    def test_all_prepared_tables_load_as_typed_read_only_records(self):
        with tempfile.TemporaryDirectory() as directory:
            _minimal_files(Path(directory))
            dataset = prepared_dataset.read_prepared_dataset(Path(directory))
        self.assertEqual(len(dataset.beneficiaries), 3)
        self.assertEqual(len(dataset.centres), 1)
        self.assertEqual(len(dataset.workers), 1)
        self.assertEqual(len(dataset.measurements), 1)
        self.assertEqual(len(dataset.tasks), 2)
        self.assertEqual(len(dataset.referrals), 1)
        with self.assertRaises(TypeError):
            dataset.beneficiaries[0]["category"] = "changed"

    def test_all_csv_tables_are_required_by_the_read_model(self):
        with tempfile.TemporaryDirectory() as directory:
            _minimal_files(Path(directory))
            (Path(directory) / "workers.csv").unlink()
            with self.assertRaises(prepared_dataset.PreparedDataUnavailable):
                prepared_dataset.read_prepared_dataset(Path(directory))

    def test_repository_dataset_returns_aggregate_counts_without_source_rows(self):
        result = prepared_data.read_prepared_summary()
        self.assertEqual(result["source"], "B!-PREPARED-SYNTHETIC-DATA")
        self.assertEqual(result["label"], "SYNTHETIC DATA / PROPOSED INTEGRATION")
        self.assertEqual(result["counts"]["beneficiaries_total"], 3025)
        self.assertEqual(result["counts"]["beneficiaries_by_category"], {
            "child": 2425, "pregnant_woman": 350, "lactating_mother": 250,
        })
        self.assertEqual(result["counts"]["centres_total"], 122)
        self.assertEqual(result["counts"]["measurements_total"], 9715)
        self.assertEqual(result["counts"]["tasks_total"], 152)
        self.assertEqual(result["counts"]["tasks_by_status"], {
            "assigned": 24, "acknowledged": 17, "in_progress": 41, "closed": 70,
        })
        self.assertEqual(result["counts"]["referrals_total"], 85)
        self.assertEqual(result["counts"]["referrals_by_state"], {
            "sent": 21, "acknowledged": 28, "attended": 12, "outcome_recorded": 24,
        })
        self.assertNotIn("beneficiaries", result)
        self.assertNotIn("items", result)

    def test_summary_counts_only_synthetic_rows_and_statuses(self):
        with tempfile.TemporaryDirectory() as directory:
            _minimal_files(Path(directory))
            with patch.object(prepared_data, "DATA_DIR", Path(directory)):
                result = prepared_data.read_prepared_summary()
        self.assertEqual(result["counts"]["beneficiaries_by_category"], {
            "child": 1, "pregnant_woman": 1, "lactating_mother": 1,
        })
        self.assertEqual(result["counts"]["tasks_by_status"]["closed"], 1)

    def test_bad_headers_non_synthetic_rows_and_unknown_statuses_fail_closed(self):
        for defect in ("header", "non_synthetic", "status"):
            with self.subTest(defect=defect), tempfile.TemporaryDirectory() as directory:
                _minimal_files(Path(directory))
                path = Path(directory) / "tasks_seed.csv"
                if defect == "header":
                    path.write_text("task_id,wrong_header\nT-1,x\n", encoding="utf-8")
                else:
                    with path.open("r", encoding="utf-8", newline="") as source:
                        rows = list(csv.DictReader(source))
                    if defect == "non_synthetic":
                        rows[0]["synthetic_flag"] = "REAL"
                    else:
                        rows[0]["status"] = "unknown"
                    _write_rows(Path(directory), "tasks_seed.csv", prepared_data.SCHEMAS["tasks_seed.csv"], rows)
                with patch.object(prepared_data, "DATA_DIR", Path(directory)):
                    with self.assertRaises(prepared_data.PreparedDataUnavailable):
                        prepared_data.read_prepared_summary()

    def test_duplicate_primary_ids_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            _minimal_files(Path(directory))
            path = Path(directory) / "centres.csv"
            with path.open("r", encoding="utf-8", newline="") as source:
                rows = list(csv.DictReader(source))
            rows.append(rows[0].copy())
            _write_rows(Path(directory), "centres.csv", prepared_data.SCHEMAS["centres.csv"], rows)
            with patch.object(prepared_data, "DATA_DIR", Path(directory)):
                with self.assertRaises(prepared_data.PreparedDataUnavailable):
                    prepared_data.read_prepared_summary()

    def test_missing_file_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            _minimal_files(Path(directory))
            (Path(directory) / "referrals.csv").unlink()
            with patch.object(prepared_data, "DATA_DIR", Path(directory)):
                with self.assertRaises(prepared_data.PreparedDataUnavailable):
                    prepared_data.read_prepared_summary()

    def test_mismatched_beneficiary_centre_linkage_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            _minimal_files(Path(directory))
            path = Path(directory) / "measurements.csv"
            with path.open("r", encoding="utf-8", newline="") as source:
                rows = list(csv.DictReader(source))
            rows[0]["centre_id"] = "AWC-OTHER"
            _write_rows(Path(directory), "measurements.csv", prepared_data.SCHEMAS["measurements.csv"], rows)
            with patch.object(prepared_data, "DATA_DIR", Path(directory)):
                with self.assertRaises(prepared_data.PreparedDataUnavailable):
                    prepared_data.read_prepared_summary()

    def test_invalid_date_number_and_nonfinite_measurement_fail_without_echoing_values(self):
        for field, value in (("measured_on", "not-a-date"), ("weight_value", "NaN")):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                _minimal_files(Path(directory))
                path = Path(directory) / "measurements.csv"
                with path.open("r", encoding="utf-8", newline="") as source:
                    rows = list(csv.DictReader(source))
                rows[0][field] = value
                _write_rows(Path(directory), "measurements.csv", prepared_data.SCHEMAS["measurements.csv"], rows)
                with self.assertRaises(prepared_dataset.PreparedDataUnavailable) as caught:
                    prepared_dataset.read_prepared_dataset(Path(directory))
                self.assertNotIn(value, str(caught.exception))

    def test_unknown_status_and_invalid_referral_state_dates_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            _minimal_files(Path(directory))
            path = Path(directory) / "verification_records.csv"
            with path.open("r", encoding="utf-8", newline="") as source:
                rows = list(csv.DictReader(source))
            rows[0]["status"] = "unknown"
            _write_rows(Path(directory), "verification_records.csv", prepared_data.SCHEMAS["verification_records.csv"], rows)
            with self.assertRaises(prepared_dataset.PreparedDataUnavailable):
                prepared_dataset.read_prepared_dataset(Path(directory))

        with tempfile.TemporaryDirectory() as directory:
            _minimal_files(Path(directory))
            path = Path(directory) / "referrals.csv"
            with path.open("r", encoding="utf-8", newline="") as source:
                rows = list(csv.DictReader(source))
            rows[0]["sent_on"] = ""
            _write_rows(Path(directory), "referrals.csv", prepared_data.SCHEMAS["referrals.csv"], rows)
            with self.assertRaises(prepared_dataset.PreparedDataUnavailable):
                prepared_dataset.read_prepared_dataset(Path(directory))

    def test_cross_file_worker_supersession_and_review_links_are_validated(self):
        mutations = (
            ("workers.csv", "centre_id", "AWC-OTHER"),
            ("measurements.csv", "supersedes_id", "MISSING-MEASUREMENT"),
            ("review_history.csv", "measurement_id", "MISSING-MEASUREMENT"),
        )
        for filename, field, value in mutations:
            with self.subTest(filename=filename, field=field), tempfile.TemporaryDirectory() as directory:
                _minimal_files(Path(directory))
                path = Path(directory) / filename
                with path.open("r", encoding="utf-8", newline="") as source:
                    rows = list(csv.DictReader(source))
                rows[0][field] = value
                _write_rows(Path(directory), filename, prepared_data.SCHEMAS[filename], rows)
                with self.assertRaises(prepared_dataset.PreparedDataUnavailable):
                    prepared_dataset.read_prepared_dataset(Path(directory))

    def test_unmatched_task_flags_are_not_invented_as_review_history_links(self):
        # The source has no complete flags table; review_history is a partial log.
        with tempfile.TemporaryDirectory() as directory:
            _minimal_files(Path(directory))
            dataset = prepared_dataset.read_prepared_dataset(Path(directory))
        self.assertEqual(dataset.tasks[1]["flag_id"], "F-2")


if __name__ == "__main__":
    unittest.main()
