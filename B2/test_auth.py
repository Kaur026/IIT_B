"""Isolated Supabase identity-verifier tests; all HTTP is mocked in-process."""

import unittest
from types import SimpleNamespace
from uuid import UUID

import httpx

from B2.auth import (
    IdentityProviderUnavailable,
    InvalidCredentials,
    SupabaseAuthVerifier,
)


PROJECT_URL = "https://example.supabase.co"
PUBLISHABLE_KEY = "test-public-key"
ACCESS_TOKEN = "synthetic-access-token"
USER_ID = "87c6dd4f-4d83-4f06-8f53-80b7be6d6c51"


def request_with(value=f"Bearer {ACCESS_TOKEN}"):
    headers = {} if value is None else {"authorization": value}
    return SimpleNamespace(headers=headers)


class SupabaseAuthVerifierTests(unittest.TestCase):
    def verifier_for(self, handler):
        transport = httpx.MockTransport(handler)
        client = httpx.Client(transport=transport)
        self.addCleanup(client.close)
        return SupabaseAuthVerifier(PROJECT_URL, PUBLISHABLE_KEY, client=client)

    def test_valid_identity_uses_auth_user_endpoint_and_ignores_provider_metadata(self):
        observed = {}

        def handler(request):
            observed["method"] = request.method
            observed["url"] = str(request.url)
            observed["has_expected_apikey"] = request.headers.get("apikey") == PUBLISHABLE_KEY
            observed["has_expected_bearer"] = request.headers.get("authorization") == f"Bearer {ACCESS_TOKEN}"
            observed["has_bounded_timeout"] = all(
                0 < seconds <= 5
                for seconds in request.extensions["timeout"].values()
            )
            return httpx.Response(200, json={
                "id": USER_ID,
                "role": "System Administrator",
                "centre_id": "forged-centre",
                "worker_id": "forged-worker",
                "user_metadata": {"role": "DPO", "centre_id": "forged"},
                "app_metadata": {"role": "AWW"},
            })

        identity = self.verifier_for(handler).verify_request(request_with())
        self.assertEqual(identity.issuer, f"{PROJECT_URL}/auth/v1")
        self.assertEqual(identity.subject, str(UUID(USER_ID)))
        self.assertEqual(
            observed,
            {
                "method": "GET",
                "url": f"{PROJECT_URL}/auth/v1/user",
                "has_expected_apikey": True,
                "has_expected_bearer": True,
                "has_bounded_timeout": True,
            },
        )

    def test_missing_and_malformed_bearer_credentials_are_rejected_without_request(self):
        verifier = self.verifier_for(lambda _request: self.fail("unexpected provider request"))
        malformed = (None, "", "Basic token", "Bearer", "Bearer two words", "Bearer bad\ntoken")
        for header in malformed:
            with self.subTest(header_present=header is not None), self.assertRaises(InvalidCredentials):
                verifier.verify_request(request_with(header))

    def test_provider_401_and_403_are_invalid_credentials(self):
        for status in (401, 403):
            verifier = self.verifier_for(lambda _request, code=status: httpx.Response(code))
            with self.subTest(status=status), self.assertRaises(InvalidCredentials):
                verifier.verify_request(request_with())

    def test_expired_or_revoked_access_tokens_are_rejected_by_supabase_auth(self):
        verifier = self.verifier_for(lambda _request: httpx.Response(401, json={"message": "invalid JWT"}))
        with self.assertRaises(InvalidCredentials):
            verifier.verify_request(request_with("Bearer expired-or-revoked-token"))

    def test_provider_server_errors_are_unavailable(self):
        for status in (302, 500, 503):
            verifier = self.verifier_for(lambda _request, code=status: httpx.Response(code))
            with self.subTest(status=status), self.assertRaises(IdentityProviderUnavailable):
                verifier.verify_request(request_with())

    def test_timeout_and_connection_failure_are_unavailable(self):
        verifier = self.verifier_for(
            lambda request: (_ for _ in ()).throw(httpx.ReadTimeout("synthetic timeout", request=request))
        )
        with self.assertRaises(IdentityProviderUnavailable):
            verifier.verify_request(request_with())

        verifier = self.verifier_for(
            lambda request: (_ for _ in ()).throw(httpx.ConnectError("synthetic connection failure", request=request))
        )
        with self.assertRaises(IdentityProviderUnavailable):
            verifier.verify_request(request_with())

    def test_malformed_json_and_missing_null_or_invalid_user_ids_are_unavailable(self):
        cases = (
            httpx.Response(200, content=b"not-json"),
            httpx.Response(200, json={}),
            httpx.Response(200, json={"id": None}),
            httpx.Response(200, json={"id": "not-a-uuid"}),
        )
        for response in cases:
            verifier = self.verifier_for(lambda _request, result=response: result)
            with self.subTest(response_has_body=bool(response.content)), self.assertRaises(IdentityProviderUnavailable):
                verifier.verify_request(request_with())

    def test_errors_do_not_include_or_return_access_token_or_provider_body(self):
        sensitive_body = {"message": "provider detail that must remain private"}
        verifier = self.verifier_for(lambda _request: httpx.Response(401, json=sensitive_body))
        try:
            verifier.verify_request(request_with())
        except InvalidCredentials as exc:
            error_text = str(exc)
        else:
            self.fail("expected invalid credentials")
        self.assertNotIn(ACCESS_TOKEN, error_text)
        self.assertNotIn(sensitive_body["message"], error_text)


if __name__ == "__main__":
    unittest.main()
