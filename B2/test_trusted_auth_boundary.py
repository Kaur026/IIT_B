"""Fast, isolated checks for the disabled and not-yet-configured auth boundary."""

import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from B2.store import PrototypeStore


# Importing B2.api creates its module-level app. Keep even that app on memory.
_import_environment = patch.dict(os.environ, {
    "B2_DB_PATH": ":memory:",
    "B2_AUTH_MODE": "disabled",
    "B2_PREPARED_SUMMARY_PUBLIC": "false",
})
_import_environment.start()
try:
    from B2 import api
finally:
    _import_environment.stop()


class TrustedAuthBoundaryTests(unittest.TestCase):
    def make_app(self, **kwargs):
        store = PrototypeStore(":memory:")
        self.addCleanup(store.close)
        environment = {
            "B2_DB_PATH": ":memory:",
            "B2_AUTH_MODE": kwargs.pop("auth_mode", "disabled"),
            "B2_PREPARED_SUMMARY_PUBLIC": "false",
        }
        with patch.dict(os.environ, environment, clear=True):
            return api.create_app(store=store, seed_demo=False, **kwargs)

    def test_default_auth_and_prepared_summary_gate_remain_disabled(self):
        application = self.make_app()
        self.assertEqual(application.state.auth_mode, "disabled")
        self.assertIs(application.state.prepared_summary_public, False)

    def test_disabled_principal_dependency_denies_without_provider_or_test_identity(self):
        application = self.make_app()
        request = SimpleNamespace(app=application, headers={})
        with self.assertRaises(HTTPException) as caught:
            api.phase_one_principal_dependency(request)
        self.assertEqual(caught.exception.status_code, 401)
        self.assertEqual(caught.exception.detail["code"], "unauthorized")

    def test_supabase_mode_fails_startup_when_trusted_adapters_are_missing(self):
        with self.assertRaisesRegex(RuntimeError, "verified-token adapter"):
            self.make_app(auth_mode="supabase")

    def test_supabase_mode_rejects_prototype_sqlite_even_with_adapter_objects(self):
        with self.assertRaisesRegex(RuntimeError, "SQLite PrototypeStore"):
            self.make_app(
                auth_mode="supabase",
                identity_verifier=object(),
                assignment_resolver=object(),
                organization_hierarchy=object(),
            )


if __name__ == "__main__":
    unittest.main()
