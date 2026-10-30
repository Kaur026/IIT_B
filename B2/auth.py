"""Verified identity boundary and Supabase Auth HTTPX token verifier.

This module verifies only provider identity. Application roles and organization
assignments must be loaded separately from trusted server-side storage.
"""

from dataclasses import dataclass
import re
from typing import Any, Protocol
from urllib.parse import urlsplit
from uuid import UUID

import httpx

from B2.roles import AccountAuthorizationRecord, AssignmentResolver


@dataclass(frozen=True)
class VerifiedIdentity:
    issuer: str
    subject: str

    def __post_init__(self):
        if not self.issuer.strip() or not self.subject.strip():
            raise ValueError("A verified issuer and subject are required.")


class IdentityVerifier(Protocol):
    def verify_request(self, request: Any) -> VerifiedIdentity:
        """Validate request credentials and return a trusted provider identity."""
        ...


class IdentityVerificationError(Exception):
    """Base class for safe identity verification failures."""


class InvalidCredentials(IdentityVerificationError):
    """Credentials were absent, malformed, expired, revoked, or rejected."""


class IdentityProviderUnavailable(IdentityVerificationError):
    """Provider verification could not be completed safely."""


_BEARER_TOKEN = re.compile(r"^[A-Za-z0-9\-._~+/]+=*$")


class SupabaseAuthVerifier:
    """Verify bearer access tokens against the configured Supabase Auth project.

    The project Auth `/auth/v1/user` endpoint validates the provider-issued
    access token before returning its user record. This delegates signature,
    issuer/project, audience, expiry/revocation and signing-key rotation checks
    to Supabase Auth instead of implementing a partial local JWT verifier.
    Only the returned top-level user UUID becomes a verified subject; role,
    scope, metadata, and browser claims are ignored.

    `publishable_key` is the public Supabase project key used as the `apikey`
    header. It is not an authorization source. Inject an ``httpx.Client`` in
    tests to avoid all network access. No provider claims except the top-level
    user UUID are consumed.
    """

    TIMEOUT = httpx.Timeout(connect=3.0, read=5.0, write=3.0, pool=3.0)

    def __init__(
        self,
        project_url: str,
        publishable_key: str,
        *,
        client: httpx.Client | None = None,
    ):
        project_url = project_url.rstrip("/")
        parsed_url = urlsplit(project_url)
        if (
            parsed_url.scheme != "https"
            or not parsed_url.hostname
            or parsed_url.path
            or parsed_url.query
            or parsed_url.fragment
        ):
            raise ValueError("A valid HTTPS Supabase project URL is required.")
        if not publishable_key or not publishable_key.strip():
            raise ValueError("A Supabase publishable key is required.")
        self._project_url = project_url
        self._publishable_key = publishable_key
        self._client = client or httpx.Client(follow_redirects=False)

    def verify_request(self, request: Any) -> VerifiedIdentity:
        """Validate the bearer token remotely; errors never include its value."""
        authorization = request.headers.get("authorization")
        if not isinstance(authorization, str):
            raise InvalidCredentials("Bearer credentials are required.")
        parts = authorization.split(" ")
        if len(parts) != 2 or parts[0].lower() != "bearer" or not _BEARER_TOKEN.fullmatch(parts[1]):
            raise InvalidCredentials("Bearer credentials are malformed.")
        token = parts[1]

        try:
            response = self._client.get(
                f"{self._project_url}/auth/v1/user",
                headers={
                    "apikey": self._publishable_key,
                    "Authorization": f"Bearer {token}",
                },
                timeout=self.TIMEOUT,
                follow_redirects=False,
            )
        except httpx.TimeoutException:
            raise IdentityProviderUnavailable("Identity provider timed out.") from None
        except httpx.RequestError:
            raise IdentityProviderUnavailable("Identity provider could not be reached.") from None

        if response.status_code in (401, 403):
            raise InvalidCredentials("Bearer credentials were rejected.")
        if not 200 <= response.status_code < 300:
            raise IdentityProviderUnavailable("Identity provider verification failed.")
        try:
            user = response.json()
        except (ValueError, UnicodeDecodeError):
            raise IdentityProviderUnavailable("Identity provider returned an invalid response.") from None
        if not isinstance(user, dict) or "id" not in user:
            raise IdentityProviderUnavailable("Identity provider response has no valid user identity.")
        try:
            subject = str(UUID(user["id"]))
        except (ValueError, TypeError, AttributeError):
            raise IdentityProviderUnavailable("Identity provider response has no valid user identity.") from None
        return VerifiedIdentity(issuer=f"{self._project_url}/auth/v1", subject=subject)
