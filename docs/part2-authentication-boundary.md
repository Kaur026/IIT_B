# Part 2 authentication boundary

## Current status

The frontend has a Supabase Auth email/password session flow and calls `/api/me`
with the provider access token when configured. The FastAPI prototype defaults
to `B2_AUTH_MODE=disabled`, so
protected API routes return 401. Synthetic `X-Demo-Actor` access is available
only when a developer or test explicitly selects `B2_AUTH_MODE=demo`; the API
refuses that mode when `B2_ENV=production`. Neither mode is production
authentication.

## Supabase integration boundary

`B2.auth.SupabaseAuthVerifier` sends the bearer token to the configured
project's Supabase Auth `/auth/v1/user` endpoint. Supabase Auth checks the
signature, issuer/project, audience, expiry/revocation and signing-key rotation;
the verifier consumes only the returned user UUID. `AssignmentResolver` must load the
current active account and role/scope assignments from trusted server-side
storage and return a `Principal` whose `subject_id` matches that verified
subject. The application rejects demo headers in Supabase mode, rejects flat
prototype centre assignments, and checks role-compatible organizational
scopes. `OrganizationHierarchy` must resolve centre ancestry using the
server-managed district → project → sector → centre records.

The verifier implementation is present, but no verifier configuration,
assignment resolver, hierarchy adapter, Supabase URL, or keys are configured
here. Selecting `B2_AUTH_MODE=supabase` without all three adapters
fails at application startup. There is no fallback to demo identities.

The frontend uses Supabase Auth email/password sign-in and session handling
when local project settings are provided. Invitation-only registration must
be configured by an authorized project operator. Frontend role simulation
remains separate; authenticated provider sessions cannot enter those synthetic
casework screens. FastAPI must resolve current assignments on every protected
request before a server profile is returned.

## Organizational schema draft

`B2/supabase/001_roles_organization.sql` is an unapplied PostgreSQL schema
draft. It creates organization nodes, invited-user mappings, scoped role
assignments, time-limited DPO detail grants, rule change requests, and
authorization audit events. It deliberately provides no rule-approval state
or approving authority and gives browser roles no table privileges. It is not
a production migration and does not touch the separate B2 SQLite prototype
store.

Before applying it, confirm the intended tenant/database owner, service-side
database role, identity provisioning and revocation process, durable audit
retention, and the authorization authority for DPO detail grants. Rule
approval remains disabled until the approving authority is formally named.

## Local modes

- `disabled` (default): protected API routes deny access.
- `demo`: synthetic actors for local synthetic-data tests only; prohibited
  when `B2_ENV=production`.
- `supabase`: requires explicit verified-identity, assignment, and hierarchy
  adapters; there is no configured implementation in this repository yet.

## Verified local environment (2026-10-28)

The default Python 3.14 interpreter has no FastAPI. The Anaconda Python 3.13.9
environment has FastAPI 0.143.0, Starlette 1.7.0, and httpx 0.28.1. The complete
backend suite ran there: 108 tests passed. The frontend suite has 42 tests and
passed; TypeScript lint and Vite build also passed. Starlette emits a
TestClient/httpx deprecation warning. In the managed Windows sandbox, a minimal
Starlette TestClient request hangs while Windows asyncio creates its socketpair;
API tests completed successfully outside the sandbox. No packages were
installed and no provider or database was contacted.

The frontend has provider-backed sign-in/session handling when local
configuration is supplied. The local persona login remains a clearly labelled
development simulation, separate from Supabase identity. There is no account
invitation/provisioning workflow, database-backed assignment resolver, live
organization hierarchy adapter, or trusted worker roster. The SQL files remain
unapplied drafts, and the SQLite prototype remains separate.

The next implementation step is to configure a server-only database connection
and implement the assignment, hierarchy, and worker-mapping repositories
against an approved schema. Keep `B2_AUTH_MODE=disabled` until those adapters,
their configuration, and route-level tests are in place. Do not expose service
credentials to the browser or treat browser role state as authorization.

## Phase 2 persistence boundary (draft, not deployed)

`B2.roles` now defines account and assignment records, account/assignment
repository protocols, a repository-composition resolver, a hierarchy-node
repository protocol, and a hierarchy validator. These are storage-independent
interfaces and test implementations only. No database-backed repository,
PostgreSQL connection, operational account data, or worker roster is configured.
The runtime resolver receives only the verified subject UUID, requires one
effective assignment, and validates the role's scope. Global scope is
represented only for `User`, `System Administrator`, and `Rule Administrator`.

`B2/supabase/002_trusted_authorization.sql` is an unapplied follow-up draft to
`001_roles_organization.sql`. It proposes a PostgreSQL GiST exclusion
constraint over user ID and half-open assignment validity ranges, preventing
overlapping active, non-revoked assignments, including concurrent conflicts.
It enforces at most one effective assignment; the application must still deny
accounts with no effective assignment. The draft also defines separate
non-login reader/admin roles, RLS policies and audit triggers. It does not add
or seed an AWW mapping because no approved roster source exists.

Before applying either SQL draft, an authorized database owner should:

1. Review the schema and role grants against the selected Supabase PostgreSQL
   version, confirm `btree_gist` is available, and verify the applying operator
   can create the extension and roles.
2. Check for existing assignment interval overlaps and validate all foreign
   keys, role/scope rows, organization ancestry, and the `auth.users` linkage.
3. Provision a separate server login outside these drafts, grant only the
   reviewed reader role to the authentication runtime, and keep administrative
   writes on a separately controlled path. Do not use browser credentials or a
   broad service-role key as the normal resolver connection.
4. Set transaction-local audit actor context only from a verified,
   server-authorized administrative request. Review bootstrap/operator events
   where actor context is absent.
5. Apply first to a disposable staging project with synthetic records, test
   overlap rejection, RLS and role grants, then obtain explicit review and a
   rollback/backup plan before any production application.

No migration, database connection, or Supabase project operation has been run.
`B2_AUTH_MODE` remains `disabled`; API startup and route behavior still require
verification in an environment with FastAPI and Uvicorn installed.
