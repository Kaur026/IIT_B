-- Trusted authorization persistence hardening for 001_roles_organization.sql.
-- DRAFT ONLY: do not apply until reviewed against the approved runtime role,
-- audit actor propagation, btree_gist availability, and account provisioning.
-- This migration does not seed records, create a login, or touch B2 SQLite.

BEGIN;

-- This follow-up is ordered after 001_roles_organization.sql. Fail with a
-- clear message before attempting role/constraint changes if that base schema
-- is not present.
DO $$
BEGIN
    IF to_regclass('public.user_role_assignments') IS NULL THEN
        RAISE EXCEPTION 'Apply 001_roles_organization.sql before 002_trusted_authorization.sql';
    END IF;
END
$$;

-- Give operators a deterministic preflight failure before the exclusion
-- constraint is created. The constraint below remains the concurrency-safe
-- enforcement; this check only reports existing conflicting data clearly.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.user_role_assignments a
        JOIN public.user_role_assignments b
          ON a.user_id = b.user_id
         AND a.assignment_id < b.assignment_id
        WHERE a.is_active AND a.revoked_at IS NULL
          AND b.is_active AND b.revoked_at IS NULL
          AND tstzrange(a.valid_from, a.valid_until, '[)')
              && tstzrange(b.valid_from, b.valid_until, '[)')
    ) THEN
        RAISE EXCEPTION 'Overlapping active role assignments exist; resolve them before migration 002';
    END IF;
END
$$;

-- A partial UNIQUE index cannot prevent overlapping validity windows. This
-- GiST exclusion constraint serializes conflicting concurrent writes and
-- permits adjacent half-open intervals (end == next start). It enforces at
-- most one active, non-revoked assignment at any instant. Runtime resolution
-- must still require exactly one effective row and deny zero rows.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.user_role_assignments
    ADD CONSTRAINT ex_user_role_assignments_no_effective_overlap
    EXCLUDE USING gist (
        user_id WITH =,
        tstzrange(valid_from, valid_until, '[)') WITH &&
    )
    WHERE (is_active AND revoked_at IS NULL);

-- This non-login reader role is the only role intended for the ordinary API
-- authorization lookup connection. Do not grant it to a browser-facing role.
-- It must be assumed only by a private backend connection after the request's
-- access token has been verified. The backend sets poshan.subject_id with
-- transaction-local set_config(..., true) on that same connection before any
-- account/assignment query. The custom setting is context, not proof of
-- identity: only trusted backend code may set it, and SQL must be parameterized.
--
-- The writer role is reserved but deliberately receives no table grants or
-- RLS policies in this draft. No authorized account/organization management
-- API or operational audit actor mechanism is configured yet. Do not grant it
-- to the ordinary reader login or any shared Supabase service role.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'poshan_auth_reader') THEN
        CREATE ROLE poshan_auth_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    ELSIF EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'poshan_auth_reader'
          AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole
               OR rolinherit OR rolbypassrls OR rolreplication)
    ) THEN
        RAISE EXCEPTION 'Existing poshan_auth_reader role has unsafe attributes';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'poshan_auth_admin') THEN
        CREATE ROLE poshan_auth_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    ELSIF EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'poshan_auth_admin'
          AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole
               OR rolinherit OR rolbypassrls OR rolreplication)
    ) THEN
        RAISE EXCEPTION 'Existing poshan_auth_admin role has unsafe attributes';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO poshan_auth_reader, poshan_auth_admin;

-- Remove default/public and browser/service-role table access for this
-- authorization schema. The dedicated roles below receive only reviewed
-- authorization-table privileges; neither role receives beneficiary access.
REVOKE ALL ON public.org_districts, public.org_projects, public.org_sectors,
    public.org_centres, public.app_users, public.user_role_assignments,
    public.dpo_detail_access_grants, public.rule_change_requests,
    public.authorization_audit_events
    FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.org_districts, public.org_projects, public.org_sectors,
    public.org_centres, public.app_users, public.user_role_assignments
    TO poshan_auth_reader;
REVOKE UPDATE, DELETE, TRUNCATE ON public.authorization_audit_events
    FROM poshan_auth_reader, poshan_auth_admin, PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.authorization_audit_events
    ADD COLUMN IF NOT EXISTS change_data jsonb;

-- Reader access is limited to authorization and organization tables. These
-- roles are NOLOGIN and must only be assumed by a private server connection.
DO $$
DECLARE
    table_name text;
    reader_predicate text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'org_districts', 'org_projects', 'org_sectors', 'org_centres',
        'app_users', 'user_role_assignments'
    ] LOOP
        -- Organization names/ancestry are directory data needed for hierarchy
        -- validation. Application accounts and assignments are limited to the
        -- verified subject installed in the transaction-local backend context.
        IF table_name IN ('app_users', 'user_role_assignments') THEN
            reader_predicate :=
                'user_id = NULLIF(current_setting(''poshan.subject_id'', true), '''')::uuid';
        ELSE
            reader_predicate := 'true';
        END IF;
        EXECUTE format('DROP POLICY IF EXISTS poshan_auth_reader_select ON public.%I', table_name);
        EXECUTE format(
            'CREATE POLICY poshan_auth_reader_select ON public.%I FOR SELECT TO poshan_auth_reader USING (%s)',
            table_name, reader_predicate
        );
    END LOOP;
END
$$;

-- Record administrative changes without storing credentials or provider
-- tokens. Server-side admin tooling may set these transaction-local values
-- after authenticating an administrator. Missing actor context is retained as
-- NULL for bootstrap/operator changes and must be reviewed operationally.
CREATE OR REPLACE FUNCTION public.audit_authorization_record_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    old_data jsonb;
    new_data jsonb;
    record_data jsonb;
    record_id text;
    actor_id uuid;
    actor_subject text;
    actor_role text;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        old_data := to_jsonb(OLD);
    END IF;
    IF TG_OP <> 'DELETE' THEN
        new_data := to_jsonb(NEW);
    END IF;
    record_data := COALESCE(new_data, old_data);
    record_id := COALESCE(
        record_data ->> 'district_id', record_data ->> 'project_id',
        record_data ->> 'sector_id', record_data ->> 'centre_id',
        record_data ->> 'user_id', record_data ->> 'assignment_id'
    );
    actor_id := NULLIF(current_setting('poshan.audit_actor_user_id', true), '')::uuid;
    actor_subject := NULLIF(current_setting('poshan.audit_actor_subject', true), '');
    actor_role := NULLIF(current_setting('poshan.audit_actor_role', true), '');

    INSERT INTO public.authorization_audit_events (
        event_id, actor_user_id, actor_subject, role, action, resource_type,
        resource_id, decision, reason_code, occurred_at, change_data
    ) VALUES (
        gen_random_uuid(), actor_id, actor_subject, actor_role,
        lower(TG_OP) || '_authorization_record', TG_TABLE_NAME,
        record_id, 'allowed', 'administrative_record_change', now(),
        jsonb_build_object('old', old_data, 'new', new_data)
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_authorization_record_change()
    FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'org_districts', 'org_projects', 'org_sectors', 'org_centres',
        'app_users', 'user_role_assignments'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS poshan_auth_audit_change ON public.%I', table_name);
        EXECUTE format(
            'CREATE TRIGGER poshan_auth_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_authorization_record_change()',
            table_name
        );
    END LOOP;
END
$$;

-- No worker table is created: the repository has no approved operational
-- roster source. The application WorkerMappingResolver contract must return
-- only a current, active mapping whose worker_id matches the operational
-- assigned_worker_id and whose centre equals the account's assigned centre.

COMMIT;
