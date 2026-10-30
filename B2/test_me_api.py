"""HTTP tests for the server-resolved /api/me profile (synthetic adapters only)."""

from datetime import datetime, timezone
import unittest
from uuid import UUID

from fastapi.testclient import TestClient

from B2.api import create_app
from B2.auth import InvalidCredentials, VerifiedIdentity
from B2.roles import AccountAuthorizationRecord, RoleAssignmentRecord


SUBJECT = UUID("d4f2a64c-9cf9-4e2f-87c3-916a9c07af22")
TOKEN = "unit-test-access-token"


class FakeVerifier:
    def __init__(self, invalid=False):
        self.invalid = invalid
        self.calls = 0

    def verify_request(self, request):
        self.calls += 1
        if self.invalid or request.headers.get("authorization") != f"Bearer {TOKEN}":
            raise InvalidCredentials("synthetic invalid token")
        return VerifiedIdentity("https://issuer.example.test/auth/v1", str(SUBJECT))


class FakeResolver:
    def __init__(self, account=None, error=None):
        self.account = account or AccountAuthorizationRecord(
            SUBJECT,
            True,
            (RoleAssignmentRecord(
                "AWW", "centre", "CTR-1",
                datetime(2020, 1, 1, tzinfo=timezone.utc),
            ),),
        )
        self.error = error

    def resolve_assignments(self, subject_id):
        if self.error:
            raise self.error
        if subject_id != SUBJECT:
            return None
        return self.account


class FakeHierarchy:
    def __init__(self, active=True):
        self.active = active

    def validate_scope(self, _scope):
        return self.active

    def contains_centre(self, scope_type, scope_id, centre_id):
        return self.active and scope_type == "centre" and scope_id == centre_id

    def centres_in_scope(self, _scope_type, _scope_id):
        return ("CTR-1",) if self.active else ()


class MeApiTests(unittest.TestCase):
    def make_client(self, *, verifier=None, resolver=None, hierarchy=None, auth_mode="supabase"):
        app = create_app(
            store=object(),
            seed_demo=False,
            auth_mode=auth_mode,
            identity_verifier=verifier or FakeVerifier(),
            assignment_resolver=resolver or FakeResolver(),
            organization_hierarchy=hierarchy or FakeHierarchy(),
        )
        return TestClient(app)

    def test_valid_request_returns_only_server_resolved_role_and_scope(self):
        with self.make_client() as client:
            response = client.get("/api/me", headers={"Authorization": f"Bearer {TOKEN}"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {
            "subject_id": str(SUBJECT),
            "role": "AWW",
            "scopes": [{"type": "centre", "id": "CTR-1"}],
            "is_active": True,
            "identity_mode": "supabase",
            "demo": False,
        })
        self.assertNotIn("worker_id", response.json())
        self.assertNotIn("email", response.json())

    def test_missing_malformed_and_invalid_credentials_are_denied_safely(self):
        verifier = FakeVerifier()
        with self.make_client(verifier=verifier) as client:
            missing = client.get("/api/me")
            malformed = client.get("/api/me", headers={"Authorization": "Bearer"})
            invalid = client.get("/api/me", headers={"Authorization": "Bearer rejected-token"})
        self.assertEqual(missing.status_code, 401)
        self.assertEqual(malformed.status_code, 401)
        self.assertEqual(invalid.status_code, 401)
        self.assertNotIn("rejected-token", invalid.text)
        self.assertEqual(verifier.calls, 1)

    def test_invalid_verified_token_and_forged_demo_actor_are_denied(self):
        with self.make_client(verifier=FakeVerifier(invalid=True)) as client:
            invalid = client.get("/api/me", headers={"Authorization": f"Bearer {TOKEN}"})
        with self.make_client() as client:
            forged = client.get("/api/me", headers={
                "Authorization": f"Bearer {TOKEN}", "X-Demo-Actor": "demo-cdpo",
            })
        self.assertEqual(invalid.status_code, 401)
        self.assertEqual(forged.status_code, 401)
        self.assertNotIn(TOKEN, invalid.text)

    def test_unavailable_assignment_repository_returns_generic_retryable_503(self):
        with self.make_client(resolver=FakeResolver(error=RuntimeError("private database detail"))) as client:
            response = client.get("/api/me", headers={"Authorization": f"Bearer {TOKEN}"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"]["code"], "authorization_service_unavailable")
        self.assertTrue(response.json()["error"]["retryable"])
        self.assertNotIn("private database detail", response.text)

    def test_unassigned_or_out_of_scope_identity_does_not_receive_profile(self):
        unassigned = FakeResolver(account=AccountAuthorizationRecord(SUBJECT, True, ()))
        with self.make_client(resolver=unassigned) as client:
            unassigned_response = client.get("/api/me", headers={"Authorization": f"Bearer {TOKEN}"})
        with self.make_client(hierarchy=FakeHierarchy(active=False)) as client:
            inactive_scope = client.get("/api/me", headers={"Authorization": f"Bearer {TOKEN}"})
        self.assertEqual(unassigned_response.status_code, 401)
        self.assertEqual(inactive_scope.status_code, 401)
        self.assertNotIn("scopes", unassigned_response.json())
        self.assertNotIn("scopes", inactive_scope.json())

    def test_disabled_authentication_does_not_return_a_profile(self):
        with self.make_client(auth_mode="disabled") as client:
            response = client.get("/api/me", headers={"Authorization": f"Bearer {TOKEN}"})
        self.assertEqual(response.status_code, 401)

    def test_demo_profile_is_explicitly_labelled_and_has_no_provider_subject(self):
        with self.make_client(auth_mode="demo") as client:
            response = client.get("/api/me", headers={"X-Demo-Actor": "demo-worker"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["demo"])
        self.assertIsNone(response.json()["subject_id"])
        self.assertEqual(response.json()["identity_mode"], "demo")
        self.assertIn("NOT AUTHENTICATED", response.json()["label"])


if __name__ == "__main__":
    unittest.main()
