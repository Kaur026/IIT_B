"""Synchronous route-unit checks for protected prepared-record projections.

HTTP integration assertions live in test_prepared_data_api.py. These tests
avoid Windows TestClient/event-loop setup and never read the developer DB.
"""

import os
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response

from B2.prepared_data import PreparedCentreMappingRecord, PreparedWorkerMappingRecord
from B2.roles import AuthorizationServiceUnavailable, OrganizationScope, Principal, RolePermissionError

_import_environment = patch.dict(os.environ, {
    "B2_DB_PATH": ":memory:",
    "B2_AUTH_MODE": "disabled",
    "B2_PREPARED_SUMMARY_PUBLIC": "false",
    "B2_PREPARED_ROWS_ENABLED": "false",
})
_import_environment.start()
try:
    from B2 import api
finally:
    _import_environment.stop()


class ScopeHierarchy:
    def __init__(self, allowed_centre="ORG-C01"):
        self.allowed_centre = allowed_centre

    def contains_centre(self, scope_type, scope_id, centre_id):
        return scope_type == "centre" and scope_id == self.allowed_centre and centre_id == self.allowed_centre

    def centres_in_scope(self, scope_type, scope_id):
        return (scope_id,) if scope_type == "centre" and scope_id == self.allowed_centre else ()


class PreparedMappings:
    """Test-only explicit crosswalk; source and organization IDs differ."""

    def __init__(self):
        now = datetime.now(timezone.utc)
        self.centres = (
            PreparedCentreMappingRecord("PREP-C01", "ORG-C01", now),
            PreparedCentreMappingRecord("PREP-C02", "ORG-C02", now),
        )
        self.workers = (
            PreparedWorkerMappingRecord("ORG-W01", "ORG-C01", "PREP-W01", now),
            PreparedWorkerMappingRecord("ORG-W02", "ORG-C02", "PREP-W02", now),
        )

    def list_centre_mappings(self, organization_centre_ids):
        return tuple(row for row in self.centres if row.organization_centre_id in organization_centre_ids)

    def list_worker_mappings(self, organization_worker_id, organization_centre_ids):
        return tuple(row for row in self.workers if row.organization_worker_id == organization_worker_id and row.organization_centre_id in organization_centre_ids)


def request_for(application, path="/api/prepared-data/beneficiaries"):
    return Request({
        "type": "http", "http_version": "1.1", "method": "GET", "scheme": "https",
        "path": path, "raw_path": path.encode(), "query_string": b"", "headers": [],
        "server": ("test", 443), "client": ("test", 1), "app": application,
    })


def fixture_dataset():
    return SimpleNamespace(
        beneficiaries=(
            {"beneficiary_id": "PREP-B001", "centre_id": "PREP-C01", "category": "child", "sex": "F", "enrolment_date": "2025-01-04", "mobile_verification_status": "pending", "synthetic_flag": "SYNTHETIC", "name": "Excluded", "guardian_name": "Excluded"},
            {"beneficiary_id": "PREP-B002", "centre_id": "PREP-C01", "category": "pregnant_woman", "sex": "F", "enrolment_date": "2025-02-05", "mobile_verification_status": "not_available", "synthetic_flag": "SYNTHETIC", "name": "Excluded", "guardian_name": "Excluded"},
            {"beneficiary_id": "PREP-B003", "centre_id": "PREP-C02", "category": "child", "sex": "M", "enrolment_date": "2025-03-06", "mobile_verification_status": "verified", "synthetic_flag": "SYNTHETIC", "name": "Excluded", "guardian_name": "Excluded"},
        ),
        centres=({"centre_id": "PREP-C01"}, {"centre_id": "PREP-C02"}),
        workers=({"worker_id": "PREP-W01", "centre_id": "PREP-C01"}, {"worker_id": "PREP-W02", "centre_id": "PREP-C02"}),
        measurements=(
            {"measurement_id": "PREP-M001", "beneficiary_id": "PREP-B001", "centre_id": "PREP-C01", "measured_on": "2025-02-03", "weight_value": "8.25", "weight_unit": "kg", "height_value": "71.5", "height_unit": "cm", "muac_cm": "13.4", "is_baseline": "1", "synthetic_flag": "SYNTHETIC", "recorded_by": "PREP-W01"},
            {"measurement_id": "PREP-M002", "beneficiary_id": "PREP-B003", "centre_id": "PREP-C02", "measured_on": "2025-03-07", "weight_value": "9.10", "weight_unit": "kg", "height_value": "75.0", "height_unit": "cm", "muac_cm": "14.1", "is_baseline": "0", "synthetic_flag": "SYNTHETIC", "recorded_by": "PREP-W02"},
        ),
    )


class PreparedRecordsRouteUnitTests(unittest.TestCase):
    def make_app(self, *, auth_mode="supabase", hierarchy=None):
        environment = {
            "B2_DB_PATH": ":memory:",
            "B2_AUTH_MODE": auth_mode,
            "B2_PREPARED_SUMMARY_PUBLIC": "false",
            "B2_PREPARED_ROWS_ENABLED": "true",
        }
        with patch.dict(os.environ, environment, clear=True):
            return api.create_app(
                store=object(), seed_demo=False, auth_mode=auth_mode,
                identity_verifier=object(), assignment_resolver=object(),
                organization_hierarchy=hierarchy or ScopeHierarchy(),
                worker_mapping_resolver=object(),
                prepared_dataset_mapping_resolver=PreparedMappings(),
            )

    def route_endpoint(self, application, path):
        return next(route.endpoint for route in application.routes if getattr(route, "path", None) == path)

    def actor(self, *, role="AWW", centre="ORG-C01", worker="ORG-W01"):
        return Principal(
            actor_id="test-subject", role=role, assigned_worker_id=worker,
            organization_scopes=(OrganizationScope("centre", centre),), subject_id="test-subject",
        )

    def test_row_gate_is_off_by_default_and_disabled_auth_never_supplies_rows(self):
        with patch.dict(os.environ, {"B2_AUTH_MODE": "disabled", "B2_PREPARED_ROWS_ENABLED": "false", "B2_DB_PATH": ":memory:"}, clear=True):
            application = api.create_app(auth_mode="disabled", seed_demo=False)
        route = next(route for route in application.routes if getattr(route, "path", None) == "/api/prepared-data/beneficiaries")
        gate_dep = route.dependant.dependencies[0].dependencies[0]
        with self.assertRaises(HTTPException) as disabled:
            gate_dep.call(request_for(application))
        self.assertEqual(disabled.exception.status_code, 404)
        self.assertFalse(application.state.prepared_rows_enabled)

        enabled_but_unauthenticated = self.make_app(auth_mode="disabled")
        route2 = next(route for route in enabled_but_unauthenticated.routes if getattr(route, "path", None) == "/api/prepared-data/beneficiaries")
        gate2 = route2.dependant.dependencies[0].dependencies[0]
        request = request_for(enabled_but_unauthenticated)
        with self.assertRaises(HTTPException) as denied:
            gate2.call(request)
        self.assertEqual(denied.exception.status_code, 401)

    def test_beneficiary_projection_and_pagination_use_only_authorized_centre_rows(self):
        app = self.make_app(hierarchy=ScopeHierarchy())
        endpoint = self.route_endpoint(app, "/api/prepared-data/beneficiaries")
        actor = self.actor()
        dataset = fixture_dataset()
        with patch.object(api.prepared_dataset, "read_prepared_dataset", return_value=dataset):
            # The route closes over the authorization helper; invoking the route
            # with this test principal exercises filtering and field projection.
            response = endpoint(request_for(app), Response(), limit=1, offset=0, category=None, centre_id=None, actor=actor)
            second = endpoint(request_for(app), Response(), limit=1, offset=1, category=None, centre_id=None, actor=actor)
        self.assertEqual(response["total"], 2)
        self.assertEqual(response["items"][0], {
            "beneficiary_id": "PREP-B001", "centre_id": "PREP-C01", "category": "child",
            "sex": "F", "synthetic_flag": "SYNTHETIC",
        })
        self.assertEqual(second["items"][0]["beneficiary_id"], "PREP-B002")
        self.assertNotIn("name", str(response))
        self.assertNotIn("guardian_name", str(response))

    def test_measurement_projection_keeps_source_values_and_excludes_recorder_identity(self):
        app = self.make_app(hierarchy=ScopeHierarchy())
        endpoint = self.route_endpoint(app, "/api/prepared-data/measurements")
        with patch.object(api.prepared_dataset, "read_prepared_dataset", return_value=fixture_dataset()):
            response = endpoint(request_for(app, "/api/prepared-data/measurements"), Response(), limit=25, offset=0, beneficiary_id="PREP-B001", centre_id=None, actor=self.actor())
        self.assertEqual(response["total"], 1)
        self.assertEqual(response["items"][0], {
            "measurement_id": "PREP-M001", "beneficiary_id": "PREP-B001", "centre_id": "PREP-C01",
            "measured_on": "2025-02-03", "weight_value": "8.25", "weight_unit": "kg",
            "height_value": "71.5", "height_unit": "cm", "muac_cm": "13.4",
            "is_baseline": "1", "synthetic_flag": "SYNTHETIC",
        })
        self.assertNotIn("recorded_by", str(response))

    def test_missing_dataset_fields_fail_closed_and_query_contract_is_bounded(self):
        app = self.make_app(hierarchy=ScopeHierarchy())
        endpoint = self.route_endpoint(app, "/api/prepared-data/beneficiaries")
        with patch.object(api.prepared_dataset, "read_prepared_dataset", side_effect=api.PreparedDataUnavailable("private schema detail")):
            with self.assertRaises(HTTPException) as unavailable:
                endpoint(request_for(app), Response(), limit=25, offset=0, category=None, centre_id=None, actor=self.actor())
        self.assertEqual(unavailable.exception.status_code, 503)
        self.assertNotIn("private schema detail", str(unavailable.exception.detail))

        parameters = app.openapi()["paths"]["/api/prepared-data/beneficiaries"]["get"]["parameters"]
        by_name = {parameter["name"]: parameter["schema"] for parameter in parameters}
        self.assertEqual(by_name["limit"]["minimum"], 1)
        self.assertEqual(by_name["limit"]["maximum"], 100)
        self.assertEqual(by_name["offset"]["minimum"], 0)
        self.assertEqual(set(by_name["category"]["anyOf"][0]["enum"]), {"child", "pregnant_woman", "lactating_mother"})
        self.assertNotIn("X-Demo-Actor", by_name)

    def test_role_scope_and_trusted_worker_mapping_fail_closed(self):
        app = self.make_app(hierarchy=ScopeHierarchy())
        route = next(route for route in app.routes if getattr(route, "path", None) == "/api/prepared-data/beneficiaries")
        request = request_for(app)

        endpoint = route.endpoint
        with patch.object(api.prepared_dataset, "read_prepared_dataset", return_value=fixture_dataset()):
            with self.assertRaises(RolePermissionError):
                endpoint(request, Response(), limit=25, offset=0, category=None, centre_id=None, actor=self.actor(role="DPO", worker=""))
            with self.assertRaises(RolePermissionError):
                endpoint(request, Response(), limit=25, offset=0, category=None, centre_id="PREP-C02", actor=self.actor())
            with self.assertRaises(RolePermissionError):
                endpoint(request, Response(), limit=25, offset=0, category=None, centre_id=None, actor=self.actor(centre="ORG-C02", worker="ORG-W02"))
            with self.assertRaises(RolePermissionError):
                endpoint(request, Response(), limit=25, offset=0, category=None, centre_id=None, actor=self.actor(worker=""))

    def test_missing_centre_crosswalk_fails_closed_instead_of_matching_equal_ids(self):
        app = self.make_app(hierarchy=ScopeHierarchy())
        app.state.prepared_dataset_mapping_resolver = None
        endpoint = self.route_endpoint(app, "/api/prepared-data/beneficiaries")
        with patch.object(api.prepared_dataset, "read_prepared_dataset", return_value=fixture_dataset()):
            with self.assertRaises(AuthorizationServiceUnavailable):
                endpoint(request_for(app), Response(), limit=25, offset=0, category=None, centre_id=None, actor=self.actor())

    def test_expired_prepared_centre_mapping_does_not_authorize_rows(self):
        app = self.make_app(hierarchy=ScopeHierarchy())
        now = datetime.now(timezone.utc)
        app.state.prepared_dataset_mapping_resolver.centres = (
            PreparedCentreMappingRecord("PREP-C01", "ORG-C01", now.replace(year=now.year - 2), valid_until=now.replace(year=now.year - 1)),
        )
        endpoint = self.route_endpoint(app, "/api/prepared-data/beneficiaries")
        with patch.object(api.prepared_dataset, "read_prepared_dataset", return_value=fixture_dataset()):
            with self.assertRaises(RolePermissionError):
                endpoint(request_for(app), Response(), limit=25, offset=0, category=None, centre_id=None, actor=self.actor())

    def test_revoked_worker_crosswalk_does_not_authorize_rows(self):
        app = self.make_app(hierarchy=ScopeHierarchy())
        now = datetime.now(timezone.utc)
        app.state.prepared_dataset_mapping_resolver.workers = (
            PreparedWorkerMappingRecord(
                "ORG-W01", "ORG-C01", "PREP-W01", now - timedelta(days=30), revoked_at=now,
            ),
        )
        endpoint = self.route_endpoint(app, "/api/prepared-data/beneficiaries")
        with patch.object(api.prepared_dataset, "read_prepared_dataset", return_value=fixture_dataset()):
            with self.assertRaises(RolePermissionError):
                endpoint(request_for(app), Response(), limit=25, offset=0, category=None, centre_id=None, actor=self.actor())

    def test_ambiguous_centre_crosswalk_fails_closed(self):
        app = self.make_app(hierarchy=ScopeHierarchy())
        now = datetime.now(timezone.utc)
        app.state.prepared_dataset_mapping_resolver.centres = (
            PreparedCentreMappingRecord("PREP-C01", "ORG-C01", now),
            PreparedCentreMappingRecord("PREP-C02", "ORG-C01", now),
        )
        endpoint = self.route_endpoint(app, "/api/prepared-data/beneficiaries")
        with patch.object(api.prepared_dataset, "read_prepared_dataset", return_value=fixture_dataset()):
            with self.assertRaises(RolePermissionError):
                endpoint(request_for(app), Response(), limit=25, offset=0, category=None, centre_id=None, actor=self.actor())


if __name__ == "__main__":
    unittest.main()
