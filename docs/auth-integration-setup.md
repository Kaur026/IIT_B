# Authentication integration setup

The frontend now has a Supabase Auth browser boundary and email/password session
flow. It calls `GET /api/me` with the provider access token and displays only the
server-resolved profile. Local role simulation remains a separate development
workflow and never supplies API identity. The FastAPI service defaults to
`B2_AUTH_MODE=disabled`; no backend production adapters are configured.

## Frontend dependencies and settings

For a mock-only static demo, leave the Supabase settings and `VITE_B2_API_URL`
unset. Optionally set `VITE_ENABLE_DEMO_MODE=true` at build time to expose the
browser-local role simulation. This only enables UI demo personas and does not
change B2 auth or provide backend access. The dedicated B2 workspace remains
unavailable in production builds.

For a future provider sign-in test, configure `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` in the local frontend environment. For a
future B2 connection, configure `VITE_B2_API_URL` to an HTTPS API origin only
after trusted backend authorization is approved and implemented. These
`VITE_` values are embedded in the public browser build; never put service-role
keys, database URLs, or other secrets in them. The client rejects
service-role/secret keys. The SDK uses `signInWithPassword`, `getSession`,
`onAuthStateChange`, automatic token refresh, and local sign-out. The session's
access token is sent only to B2 over the configured HTTPS API URL (loopback HTTP
is accepted for local development); it is never copied to application
`localStorage`. A 401 triggers one SDK refresh and retry, then leaves the API
profile unavailable. The `/api/me` response is the only source of backend role
and scope, and it does not enable the frontend's synthetic casework routes.

## Mock demo and deployment configuration

`frontend/.env.example` is a template, not a file to deploy as credentials.
The production build needs no backend URL to render the mock demo. All Vite
variables beginning with `VITE_` are public. No provider hosting configuration
has been deployed. A static host must support the SPA fallback to `index.html`
for direct navigation to client routes; configure that fallback in the chosen
host before publishing a demo. Keep the B2 synthetic pages separate; failed or
unauthorized B2 calls show unavailable/error states and never use `mockStore`.

## Backend dependencies and settings

The API HTTP suites import FastAPI's `TestClient`; `B2/requirements.txt` already
declares FastAPI, Uvicorn, pandas, and httpx. In an approved Python environment,
install the existing declared dependencies from the repository root with:

```powershell
python -m pip install -r B2/requirements.txt
```

Run the API and HTTP tests from the repository root with:

```powershell
python -m unittest B2.test_me_api B2.test_api_day1 B2.test_complete_workflow -v
```

`B2/.env.example` lists the future backend settings: `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `B2_DATABASE_URL`, and
`B2_OPERATIONAL_STORE_KIND=postgresql`. Copy it to `B2/.env` only after a secure
secret-delivery method, database owner, least-privilege PostgreSQL role, schema,
connection policy, and approved operational repository implementation exist.
The current `SupabaseAuthVerifier` calls the configured project's Auth
`/auth/v1/user` endpoint to validate tokens. Supabase Auth verifies the token
signature, project issuer/audience, expiry/revocation and signing-key rotation;
the server trusts only its returned user UUID. The tests mock that provider
boundary and do not prove live provider integration. `B2.config` checks value
presence and basic URL shape only. It does not load `.env` files, establish a
database connection, implement account/assignment/hierarchy repositories, or
provide operational storage. No PostgreSQL driver or repository is selected.

## Owner decisions required

1. Configure the existing frontend Supabase URL and publishable key locally;
   select allowed redirects and the account enrollment/revocation process.
   Email/password sign-in requires the Supabase project to allow that method.
2. Provision an approved Supabase project and real test account; do not use a
   privileged key in the browser.
3. Select and approve the PostgreSQL connection mechanism/driver, least-privilege
   reader role, account/assignment and organization source, worker roster source,
   and operational record repository/schema.
4. Review and authorize any schema/migration work separately. No migration has
   been applied and no Supabase project has been contacted.
5. After adapters and `/api/me` plus authorization HTTP tests pass, explicitly
   approve enabling an auth mode. Keep `B2_AUTH_MODE=disabled` before then.
