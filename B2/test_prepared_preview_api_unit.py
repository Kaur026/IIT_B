"""Direct route tests for the loopback-only local prepared CSV preview.

These tests avoid Windows asyncio socket-pair setup and use only the existing
synthetic CSVs plus in-memory prototype storage. They do not enable normal
prepared-row or public-summary routes.
"""

import hashlib
import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response

from B2.prepared_data import PREVIEW_DATASETS
from B2.store import PrototypeStore

_import_env = patch.dict(os.environ, {
    "B2_DB_PATH": ":memory:",
    "B2_AUTH_MODE": "disabled",
    "B2_PREPARED_SUMMARY_PUBLIC": "false",
    "B2_PREPARED_ROWS_ENABLED": "false",
    "B2_PREPARED_PREVIEW_ENABLED": "false",
}, clear=True)
_import_env.start()
try:
    from B2 import api, prepared_dataset
finally:
    _import_env.stop()


def make_request(application, *, client_host="127.0.0.1", host_header="127.0.0.1:8000", server_host="127.0.0.1", forwarded=None):
    headers = [(b"host", host_header.encode("ascii"))]
    if forwarded:
        headers.append((b"x-forwarded-for", forwarded.encode("ascii")))
    return Request({
        "type": "http", "http_version": "1.1", "method": "GET", "scheme": "http",
        "path": "/api/preview/prepared-data/datasets", "raw_path": b"/api/preview/prepared-data/datasets",
        "query_string": b"", "headers": headers,
        "server": (server_host, 8000), "client": (client_host, 51000), "app": application,
    })


class PreparedPreviewRouteUnitTests(unittest.TestCase):
    def make_app(self, **overrides):
        environment = {
            "B2_DB_PATH": ":memory:", "B2_AUTH_MODE": "disabled",
            "B2_PREPARED_SUMMARY_PUBLIC": "false", "B2_PREPARED_ROWS_ENABLED": "false",
            "B2_PREPARED_PREVIEW_ENABLED": "true", "B2_ENV": "development",
            **overrides,
        }
        self._store = PrototypeStore(":memory:")
        with patch.dict(os.environ, environment, clear=True):
            return api.create_app(store=self._store, seed_demo=False, auth_mode="disabled")

    def tearDown(self):
        store = getattr(self, "_store", None)
        if store is not None:
            store.close()

    @staticmethod
    def endpoint(application, path):
        return next(route.endpoint for route in application.routes if getattr(route, "path", None) == path)

    def test_preview_disabled_by_default_and_existing_gates_remain_closed(self):
        application = self.make_app(B2_PREPARED_PREVIEW_ENABLED="false")
        self.assertFalse(application.state.prepared_preview_enabled)
        self.assertFalse(application.state.prepared_rows_enabled)
        self.assertFalse(application.state.prepared_summary_public)
        endpoint = self.endpoint(application, "/api/preview/prepared-data/datasets")
        with self.assertRaises(HTTPException) as denied:
            endpoint(make_request(application), Response())
        self.assertEqual(denied.exception.status_code, 404)
        self.assertEqual(denied.exception.detail["code"], "preview_disabled")

    def test_preview_requires_explicit_safe_local_configuration(self):
        self.assertEqual(api.prepared_preview_configuration({}, "disabled"), (False, False))
        self.assertEqual(api.prepared_preview_configuration({
            "B2_PREPARED_PREVIEW_ENABLED": "true", "B2_ENV": "development",
        }, "disabled"), (True, False))
        unsafe_environments = (
            {"B2_ENV": "production"}, {"B2_ENV": "staging"},
            {"B2_ENV": "development", "CI": "true"},
            {"B2_ENV": "development", "VERCEL": "1"},
            {"B2_ENV": "development", "B2_PREPARED_ROWS_ENABLED": "true"},
            {"B2_ENV": "development", "B2_PREPARED_SUMMARY_PUBLIC": "true"},
        )
        for extra in unsafe_environments:
            with self.subTest(extra=tuple(extra)):
                values = {"B2_PREPARED_PREVIEW_ENABLED": "true", **extra}
                enabled, unsafe = api.prepared_preview_configuration(values, "disabled")
                self.assertFalse(enabled)
                self.assertTrue(unsafe)
        self.assertEqual(api.prepared_preview_configuration({
            "B2_PREPARED_PREVIEW_ENABLED": "true", "B2_ENV": "development",
        }, "supabase"), (False, True))

    def test_non_loopback_client_host_server_and_forwarded_requests_are_denied(self):
        application = self.make_app()
        endpoint = self.endpoint(application, "/api/preview/prepared-data/datasets")
        denied_requests = (
            make_request(application, client_host="192.0.2.15"),
            make_request(application, host_header="example.test:8000"),
            make_request(application, server_host="0.0.0.0"),
            make_request(application, forwarded="127.0.0.1"),
        )
        for request in denied_requests:
            with self.subTest(client=request.client, server=request.scope.get("server")):
                with self.assertRaises(HTTPException) as denied:
                    endpoint(request, Response())
                self.assertEqual(denied.exception.status_code, 403)

    def test_every_dataset_returns_actual_paginated_allowlisted_source_rows(self):
        application = self.make_app()
        catalog_endpoint = self.endpoint(application, "/api/preview/prepared-data/datasets")
        catalog = catalog_endpoint(make_request(application), Response())
        dataset = prepared_dataset.read_prepared_dataset()
        self.assertEqual(catalog["mode"], "SYNTHETIC DATA — LOCAL DEVELOPMENT PREVIEW")
        self.assertEqual({item["key"] for item in catalog["datasets"]}, set(PREVIEW_DATASETS))
        for key, definition in PREVIEW_DATASETS.items():
            with self.subTest(dataset=key):
                endpoint = self.endpoint(application, "/api/preview/prepared-data/{dataset_key}")
                page = endpoint(
                    key, make_request(application), Response(), limit=3, offset=0,
                    filter_by=None, filter_value=None, sort_by=None, sort_order="asc",
                )
                expected_total = len(getattr(dataset, definition["attribute"]))
                self.assertEqual(page["dataset"], key)
                self.assertEqual(page["total"], expected_total)
                self.assertEqual(page["fields"], list(definition["fields"]))
                self.assertEqual(len(page["items"]), min(3, expected_total))
                self.assertTrue(all(set(row) == set(definition["fields"]) for row in page["items"]))
                self.assertTrue(all(row["synthetic_flag"] == "SYNTHETIC" for row in page["items"]))
                self.assertTrue(set(page["excluded_fields"]).isdisjoint(definition["fields"]))

    def test_filters_sorts_and_pagination_are_allowlisted_and_stable(self):
        application = self.make_app()
        endpoint = self.endpoint(application, "/api/preview/prepared-data/{dataset_key}")
        request = make_request(application)
        source = prepared_dataset.read_prepared_dataset()
        categories = sorted({row["category"] for row in source.beneficiaries})
        first = endpoint("beneficiaries", request, Response(), 5, 0, "category", categories[0], "category", "asc")
        repeated = endpoint("beneficiaries", request, Response(), 5, 0, "category", categories[0], "category", "asc")
        self.assertEqual(first, repeated)
        self.assertTrue(all(row["category"] == categories[0] for row in first["items"]))
        second = endpoint("beneficiaries", request, Response(), 5, 5, "category", categories[0], "category", "asc")
        self.assertNotEqual([r["beneficiary_id"] for r in first["items"]], [r["beneficiary_id"] for r in second["items"]])
        for args in (
            ("beneficiaries", request, Response(), 5, 0, "name", "x", None, "asc"),
            ("beneficiaries", request, Response(), 5, 0, None, None, "name", "asc"),
            ("beneficiaries", request, Response(), 101, 0, None, None, None, "asc"),
            ("beneficiaries", request, Response(), 5, 0, "category", None, None, "asc"),
        ):
            with self.subTest(args=args[5:]):
                with self.assertRaises((HTTPException, ValueError)):
                    endpoint(*args)

    def test_unknown_dataset_and_unexpected_parameters_are_rejected(self):
        application = self.make_app()
        endpoint = self.endpoint(application, "/api/preview/prepared-data/{dataset_key}")
        with self.assertRaises(HTTPException) as missing:
            endpoint("not-a-dataset", make_request(application), Response(), 25, 0, None, None, None, "asc")
        self.assertEqual(missing.exception.status_code, 404)
        catalog = self.endpoint(application, "/api/preview/prepared-data/datasets")
        request = Request({
            **make_request(application).scope,
            "query_string": b"beneficiary_id=BEN-0142",
        })
        with self.assertRaises(HTTPException) as unsupported:
            catalog(request, Response())
        self.assertEqual(unsupported.exception.status_code, 422)

    def test_missing_dataset_returns_generic_unavailable_and_csv_bytes_remain_unchanged(self):
        application = self.make_app()
        endpoint = self.endpoint(application, "/api/preview/prepared-data/{dataset_key}")
        data_dir = prepared_dataset.DATA_DIR
        before = {path.name: hashlib.sha256(path.read_bytes()).digest() for path in data_dir.glob("*.csv")}
        with patch.object(api.prepared_dataset, "read_prepared_dataset", side_effect=prepared_dataset.PreparedDataUnavailable("private source detail")):
            with self.assertRaises(HTTPException) as unavailable:
                endpoint("beneficiaries", make_request(application), Response(), 10, 0, None, None, None, "asc")
        self.assertEqual(unavailable.exception.status_code, 503)
        self.assertNotIn("private source detail", str(unavailable.exception.detail))
        after = {path.name: hashlib.sha256(path.read_bytes()).digest() for path in data_dir.glob("*.csv")}
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
