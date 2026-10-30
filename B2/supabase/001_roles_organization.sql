-- Part 2 schema draft for Supabase PostgreSQL.
-- NOT APPLIED. Requires a provisioned Supabase project and review before use.
-- This schema is isolated from B2/.prototype.sqlite; it does not migrate data.

CREATE TABLE IF NOT EXISTS public.org_districts (
    district_id uuid PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.org_projects (
    project_id uuid PRIMARY KEY,
    district_id uuid NOT NULL REFERENCES public.org_districts(district_id) ON DELETE RESTRICT,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.org_sectors (
    sector_id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.org_projects(project_id) ON DELETE RESTRICT,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.org_centres (
    centre_id uuid PRIMARY KEY,
    sector_id uuid NOT NULL REFERENCES public.org_sectors(sector_id) ON DELETE RESTRICT,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);

-- A row is created only after an invited Auth user exists. No public signup is
-- implied by this mapping table.
CREATE TABLE IF NOT EXISTS public.app_users (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    status text NOT NULL CHECK (status IN ('active', 'disabled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
    assignment_id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.app_users(user_id) ON DELETE RESTRICT,
    role text NOT NULL CHECK (role IN (
        'User', 'AWW', 'LS', 'CDPO', 'DPO',
        'System Administrator', 'Rule Administrator'
    )),
    scope_type text NOT NULL CHECK (scope_type IN ('global', 'district', 'project', 'sector', 'centre')),
    district_id uuid REFERENCES public.org_districts(district_id) ON DELETE RESTRICT,
    project_id uuid REFERENCES public.org_projects(project_id) ON DELETE RESTRICT,
    sector_id uuid REFERENCES public.org_sectors(sector_id) ON DELETE RESTRICT,
    centre_id uuid REFERENCES public.org_centres(centre_id) ON DELETE RESTRICT,
    assigned_by_user_id uuid REFERENCES public.app_users(user_id) ON DELETE RESTRICT,
    is_active boolean NOT NULL DEFAULT true,
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_until timestamptz,
    revoked_at timestamptz,
    CHECK (valid_until IS NULL OR valid_until > valid_from),
    CHECK (
        (scope_type = 'global' AND district_id IS NULL AND project_id IS NULL AND sector_id IS NULL AND centre_id IS NULL)
        OR (scope_type = 'district' AND district_id IS NOT NULL AND project_id IS NULL AND sector_id IS NULL AND centre_id IS NULL)
        OR (scope_type = 'project' AND district_id IS NULL AND project_id IS NOT NULL AND sector_id IS NULL AND centre_id IS NULL)
        OR (scope_type = 'sector' AND district_id IS NULL AND project_id IS NULL AND sector_id IS NOT NULL AND centre_id IS NULL)
        OR (scope_type = 'centre' AND district_id IS NULL AND project_id IS NULL AND sector_id IS NULL AND centre_id IS NOT NULL)
    ),
    CHECK (
        (role IN ('User', 'System Administrator', 'Rule Administrator') AND scope_type = 'global')
        OR (role = 'AWW' AND scope_type = 'centre')
        OR (role = 'LS' AND scope_type IN ('sector', 'centre'))
        OR (role = 'CDPO' AND scope_type = 'project')
        OR (role = 'DPO' AND scope_type = 'district')
    )
);

CREATE INDEX IF NOT EXISTS ix_user_role_assignments_active
    ON public.user_role_assignments(user_id, role, valid_from, valid_until)
    WHERE is_active AND revoked_at IS NULL;

-- Beneficiary detail is not implied by DPO district access. Grants must be
-- specific, approved, and time-limited; grant creation stays unavailable until
-- the authorized approver and protected-record store are configured.
CREATE TABLE IF NOT EXISTS public.dpo_detail_access_grants (
    grant_id uuid PRIMARY KEY,
    dpo_user_id uuid NOT NULL REFERENCES public.app_users(user_id) ON DELETE RESTRICT,
    district_id uuid NOT NULL REFERENCES public.org_districts(district_id) ON DELETE RESTRICT,
    beneficiary_id text NOT NULL,
    purpose text NOT NULL,
    approved_by_user_id uuid NOT NULL REFERENCES public.app_users(user_id) ON DELETE RESTRICT,
    approved_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CHECK (dpo_user_id <> approved_by_user_id),
    CHECK (expires_at > approved_at)
);

-- No approval state or approval authority is provided here. Submitted changes
-- remain pending until a separately authorized approval policy is designated.
CREATE TABLE IF NOT EXISTS public.rule_change_requests (
    request_id uuid PRIMARY KEY,
    submitted_by_user_id uuid NOT NULL REFERENCES public.app_users(user_id) ON DELETE RESTRICT,
    request_status text NOT NULL CHECK (request_status IN ('draft', 'submitted', 'withdrawn')),
    proposed_rule jsonb NOT NULL,
    rationale text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    submitted_at timestamptz,
    CHECK ((request_status = 'draft' AND submitted_at IS NULL) OR (request_status <> 'draft' AND submitted_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.authorization_audit_events (
    event_id uuid PRIMARY KEY,
    actor_user_id uuid REFERENCES public.app_users(user_id) ON DELETE RESTRICT,
    actor_subject text,
    role text,
    action text NOT NULL,
    resource_type text,
    resource_id text,
    decision text NOT NULL CHECK (decision IN ('allowed', 'denied')),
    reason_code text,
    request_id text,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_authorization_audit_actor_time
    ON public.authorization_audit_events(actor_user_id, occurred_at);

-- Application/service roles may append audit rows, but normal row changes and
-- truncation are denied. This is defense in depth, not protection from a
-- superuser or an owner who can disable/drop the trigger or alter privileges.
CREATE OR REPLACE FUNCTION public.reject_authorization_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'authorization audit events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS authorization_audit_events_no_update_delete
    ON public.authorization_audit_events;
CREATE TRIGGER authorization_audit_events_no_update_delete
    BEFORE UPDATE OR DELETE ON public.authorization_audit_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_authorization_audit_mutation();

-- No browser role receives direct table access. FastAPI/service access grants
-- must be added only after the runtime database role and RLS policy are reviewed.
ALTER TABLE public.org_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpo_detail_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.org_districts, public.org_projects, public.org_sectors, public.org_centres,
    public.app_users, public.user_role_assignments, public.dpo_detail_access_grants,
    public.rule_change_requests, public.authorization_audit_events FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.authorization_audit_events
    FROM PUBLIC, anon, authenticated, service_role;

-- No runtime service grants are applied here. If a dedicated API database role
-- is approved later, give it only the audited insert/read permissions it needs.
