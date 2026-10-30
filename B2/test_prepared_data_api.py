import os
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import httpx

from B2.roles import OrganizationScope, Principal
from B2.prepared_data import PreparedCentreMappingRecord, PreparedWorkerMappingRecord
from B2.store import PrototypeStore

# Importing B2.api creates its module-level ASGI app. Protect this test module
# from touching the developer's default SQLite path during that import.
_api_import_environment = patch.dict(os.environ, {
    "B2_DB_PATH": ":memory:",
    "B2_AUTH_MODE": "disabled",
    "B2_PREPARED_SUMMARY_PUBLIC": "false",
    "B2_PREPARED_ROWS_ENABLED": "false",
})
_api_import_environment.start()
try:
    from B2 import api, prepared_data
finally:
    _api_import_environment.stop()


class PreparedDataSummaryApiTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.stores = []
        self.application = self.create_test_app()

    async def asyncTearDown(self):
        for store in self.stores:
            store.close()

    def create_test_app(self, public_setting=None, rows_setting=None):
        store = PrototypeStore(":memory:")
        self.stores.append(store)
        environment = {"B2_DB_PATH": ":memory:", "B2_AUTH_MODE": "disabled"}
        if public_setting is not None:
            environment["B2_PREPARED_SUMMARY_PUBLIC"] = public_setting
        if rows_setting is not None:
            environment["B2_PREPARED_ROWS_ENABLED"] = rows_setting
        with patch.dict(os.environ, environment, clear=True):
            return api.create_app(store=store, seed_demo=False, auth_mode="disabled")

    def create_authorized_rows_app(self, principal, hierarchy):
        environment = {
            "B2_DB_PATH": ":memory:",
            "B2_AUTH_MODE": "supabase",
            "B2_PREPARED_SUMMARY_PUBLIC": "false",
            "B2_PREPARED_ROWS_ENABLED": "true",
        }
        with patch.dict(os.environ, environment, clear=True):
            application = api.create_app(
                store=object(), seed_demo=False, auth_mode="supabase",
                identity_verifier=object(), assignment_resolver=object(),
                organization_hierarchy=hierarchy, worker_mapping_resolver=object(),
                prepared_dataset_mapping_resolver=self.prepared_mappings(),
            )
        # Test-only override on this isolated app. The normal module app and
        # configured principal dependency are not changed.
        application.dependency_overrides[api.prepared_rows_identity_dependency] = lambda: principal
        return application

    @staticmethod
    def prepared_fixture():
        return SimpleNamespace(
            beneficiaries=(
                {"beneficiary_id": "PREP-B001", "centre_id": "PREP-C01", "category": "child", "sex": "F", "enrolment_date": "2025-01-04", "mobile_verification_status": "pending", "synthetic_flag": "SYNTHETIC", "name": "Fixture Only", "guardian_name": "Not returned"},
                {"beneficiary_id": "PREP-B002", "centre_id": "PREP-C01", "category": "pregnant_woman", "sex": "F", "enrolment_date": "2025-02-05", "mobile_verification_status": "not_available", "synthetic_flag": "SYNTHETIC", "name": "Fixture Only", "guardian_name": "Not returned"},
                {"beneficiary_id": "PREP-B003", "centre_id": "PREP-C02", "category": "child", "sex": "M", "enrolment_date": "2025-03-06", "mobile_verification_status": "verified", "synthetic_flag": "SYNTHETIC", "name": "Fixture Only", "guardian_name": "Not returned"},
            ),
            centres=(
                {"centre_id": "PREP-C01", "worker_id": "PREP-W01"},
                {"centre_id": "PREP-C02", "worker_id": "PREP-W02"},
            ),
            workers=(
                {"worker_id": "PREP-W01", "centre_id": "PREP-C01"},
                {"worker_id": "PREP-W02", "centre_id": "PREP-C02"},
            ),
            measurements=(
                {"measurement_id": "PREP-M001", "beneficiary_id": "PREP-B001", "centre_id": "PREP-C01", "measured_on": "2025-02-03", "weight_value": "8.25", "weight_unit": "kg", "height_value": "71.5", "height_unit": "cm", "muac_cm": "13.4", "is_baseline": "1", "synthetic_flag": "SYNTHETIC", "recorded_by": "PREP-W01"},
                {"measurement_id": "PREP-M002", "beneficiary_id": "PREP-B003", "centre_id": "PREP-C02", "measured_on": "2025-03-07", "weight_value": "9.10", "weight_unit": "kg", "height_value": "75.0", "height_unit": "cm", "muac_cm": "14.1", "is_baseline": "0", "synthetic_flag": "SYNTHETIC", "recorded_by": "PREP-W02"},
            ),
        )

    @staticmethod
    def centre_hierarchy(allowed_centre="ORG-C01"):
        return SimpleNamespace(
            contains_centre=lambda scope_type, scope_id, centre_id: (
                scope_type == "centre" and scope_id == allowed_centre and centre_id == allowed_centre
            ),
            centres_in_scope=lambda scope_type, scope_id: (
                (scope_id,) if scope_type == "centre" and scope_id == allowed_centre else ()
            ),
        )

    @staticmethod
    def worker_principal(centre_id="ORG-C01", worker_id="ORG-W01"):
        return Principal(
            actor_id="test-subject", role="AWW", assigned_worker_id=worker_id,
            organization_scopes=(OrganizationScope("centre", centre_id),),
            subject_id="test-subject",
        )

    @staticmethod
    def prepared_mappings():
        now = datetime.now(timezone.utc)
        return SimpleNamespace(
            list_centre_mappings=lambda organization_centre_ids: tuple(
                row for row in (
                    PreparedCentreMappingRecord("PREP-C01", "ORG-C01", now),
                    PreparedCentreMappingRecord("PREP-C02", "ORG-C02", now),
                ) if row.organization_centre_id in organization_centre_ids
            ),
            list_worker_mappings=lambda organization_worker_id, organization_centre_ids: tuple(
                row for row in (
                    PreparedWorkerMappingRecord("ORG-W01", "ORG-C01", "PREP-W01", now),
                    PreparedWorkerMappingRecord("ORG-W02", "ORG-C02", "PREP-W02", now),
                ) if row.organization_worker_id == organization_worker_id
                and row.organization_centre_id in organization_centre_ids
            ),
        )

    async def get(self, path: str, application=None):
        transport = httpx.ASGITransport(app=application or self.application)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get(path)

    async def test_summary_is_disabled_by_default_and_protected_b2_auth_stays_closed(self):
        response = await self.get("/api/prepared-data/summary")
        self.assertEqual(response.status_code, 404)
        self.assertNotIn("counts", response.json())
        protected = await self.get("/api/me")
        self.assertEqual(protected.status_code, 401)

        rows = await self.get("/api/prepared-data/beneficiaries")
        self.assertEqual(rows.status_code, 404)
        self.assertNotIn("items", rows.json())
        measurements = await self.get("/api/prepared-data/measurements")
        self.assertEqual(measurements.status_code, 404)
        self.assertNotIn("items", measurements.json())

    async def test_enabled_rows_still_deny_when_configured_authentication_is_disabled(self):
        disabled_auth_app = self.create_test_app(rows_setting="true")
        response = await self.get("/api/prepared-data/beneficiaries", disabled_auth_app)
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("items", response.json())

    async def test_beneficiary_api_projects_source_fields_and_paginates_with_trusted_scope(self):
        fixture = self.prepared_fixture()
        application = self.create_authorized_rows_app(
            self.worker_principal(), self.centre_hierarchy(),
        )
        with patch.object(api.prepared_dataset, "read_prepared_dataset", return_value=fixture):
            first = await self.get("/api/prepared-data/beneficiaries?limit=1&offset=0", application)
            second = await self.get("/api/prepared-data/beneficiaries?limit=1&offset=1", application)
        self.assertEqual(first.status_code, 200)
        payload = first.json()
        self.assertEqual(payload["source"], "B!-PREPARED-SYNTHETIC-DATA")
        self.assertEqual(payload["total"], 2)
        self.assertEqual(payload["items"][0], {
            "beneficiary_id": "PREP-B001", "centre_id": "PREP-C01", "category": "child",
            "sex": "F", "synthetic_flag": "SYNTHETIC",
        })
        self.assertNotIn("name", first.text)
        self.assertNotIn("guardian_name", first.text)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["items"][0]["beneficiary_id"], "PREP-B002")
        self.assertEqual(first.headers.get("cache-control"), "no-store")

    async def test_invalid_filters_and_out_of_scope_centres_are_rejected(self):
        fixture = self.prepared_fixture()
        application = self.create_authorized_rows_app(
            self.worker_principal(), self.centre_hierarchy(),
        )
        with patch.object(api.prepared_dataset, "read_prepared_dataset", return_value=fixture):
            bad_category = await self.get("/api/prepared-data/beneficiaries?category=unknown", application)
            bad_limit = await self.get("/api/prepared-data/beneficiaries?limit=101", application)
            outside = await self.get("/api/prepared-data/beneficiaries?centre_id=PREP-C02", application)
        self.assertEqual(bad_category.status_code, 422)
        self.assertEqual(bad_limit.status_code, 422)
        self.assertEqual(outside.status_code, 403)
        self.assertNotIn("items", outside.json())

    async def test_measurement_api_preserves_source_values_and_hides_out_of_scope_ids(self):
        fixture = self.prepared_fixture()
        application = self.create_authorized_rows_app(
            self.worker_principal(), self.centre_hierarchy(),
        )
        with patch.object(api.prepared_dataset, "read_prepared_dataset", return_value=fixture):
            response = await self.get("/api/prepared-data/measurements?beneficiary_id=PREP-B001", application)
            outside = await self.get("/api/prepared-data/measurements?beneficiary_id=PREP-B003", application)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0], {
            "measurement_id": "PREP-M001", "beneficiary_id": "PREP-B001", "centre_id": "PREP-C01",
            "measured_on": "2025-02-03", "weight_value": "8.25", "weight_unit": "kg",
            "height_value": "71.5", "height_unit": "cm", "muac_cm": "13.4",
            "is_baseline": "1", "synthetic_flag": "SYNTHETIC",
        })
        self.assertNotIn("recorded_by", response.text)
        self.assertEqual(outside.status_code, 404)
        self.assertNotIn("items", outside.json())

    async def test_missing_source_fields_fail_without_returning_rows(self):
        application = self.create_authorized_rows_app(
            self.worker_principal(), self.centre_hierarchy(),
        )
        with patch.object(api.prepared_dataset, "read_prepared_dataset", side_effect=prepared_data.PreparedDataUnavailable("private schema detail")):
            response = await self.get("/api/prepared-data/beneficiaries", application)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private schema detail", response.text)
        self.assertNotIn("items", response.json())

    async def test_summary_is_available_only_when_explicitly_enabled(self):
        enabled_app = self.create_test_app("true")
        response = await self.get("/api/prepared-data/summary", enabled_app)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("cache-control"), "no-store")
        self.assertEqual(response.json()["source"], "B!-PREPARED-SYNTHETIC-DATA")
        self.assertEqual(set(response.json()), {"source", "label", "counts"})
        self.assertNotIn("items", response.json())
        self.assertEqual(response.json()["counts"]["beneficiaries_total"], 3025)

    async def test_query_parameters_cannot_create_a_scoped_view(self):
        enabled_app = self.create_test_app("true")
        response = await self.get("/api/prepared-data/summary?centre_id=AWC-001", enabled_app)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "unsupported_query")

    async def test_bad_or_unavailable_source_returns_generic_503(self):
        enabled_app = self.create_test_app("true")
        with patch.object(api, "read_prepared_summary", side_effect=prepared_data.PreparedDataUnavailable("private path")):
            response = await self.get("/api/prepared-data/summary", enabled_app)
        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "prepared_dataset_unavailable")
        self.assertNotIn("private path", response.text)


if __name__ == "__main__":
    unittest.main()
