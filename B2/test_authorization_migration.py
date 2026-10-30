"""Static contract checks for the unapplied authorization SQL drafts.

These checks catch accidental policy broadening in the draft text only. They
do not parse SQL or replace a disposable PostgreSQL migration/RLS test.
"""

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parent
BASE_SQL = (ROOT / "supabase" / "001_roles_organization.sql").read_text(encoding="utf-8")
FOLLOWUP_SQL = (ROOT / "supabase" / "002_trusted_authorization.sql").read_text(encoding="utf-8")


class AuthorizationMigrationDraftTests(unittest.TestCase):
    def test_followup_requires_base_schema_and_preflights_overlapping_assignments(self):
        self.assertLess(FOLLOWUP_SQL.index("to_regclass('public.user_role_assignments')"),
                        FOLLOWUP_SQL.index("ALTER TABLE public.user_role_assignments"))
        self.assertIn("Overlapping active role assignments exist", FOLLOWUP_SQL)
        self.assertIn("tstzrange(a.valid_from, a.valid_until, '[)')", FOLLOWUP_SQL)
        self.assertIn("CREATE EXTENSION IF NOT EXISTS btree_gist", FOLLOWUP_SQL)
        self.assertIn("EXCLUDE USING gist", FOLLOWUP_SQL)

    def test_sensitive_reader_rows_are_subject_scoped_and_fail_closed_without_context(self):
        self.assertIn("table_name IN ('app_users', 'user_role_assignments')", FOLLOWUP_SQL)
        self.assertIn("user_id = NULLIF(current_setting(''poshan.subject_id'', true), '''')::uuid", FOLLOWUP_SQL)
        self.assertIn("reader_predicate := 'true'", FOLLOWUP_SQL)
        self.assertIn("Organization names/ancestry are directory data", FOLLOWUP_SQL)

    def test_admin_role_has_no_runtime_table_grants_or_rls_write_policy(self):
        self.assertIn("CREATE ROLE poshan_auth_admin NOLOGIN", FOLLOWUP_SQL)
        self.assertNotRegex(FOLLOWUP_SQL, r"(?im)^\s*GRANT\s+(?!USAGE\b)[^;]*\bTO\s+poshan_auth_admin")
        self.assertNotIn("CREATE POLICY poshan_auth_admin", FOLLOWUP_SQL)
        self.assertIn("No authorized account/organization management", FOLLOWUP_SQL)
        self.assertIn("API or operational audit actor mechanism", FOLLOWUP_SQL)

    def test_browser_and_shared_service_roles_are_revoked_and_no_beneficiary_access_is_granted(self):
        self.assertIn("FROM PUBLIC, anon, authenticated, service_role", FOLLOWUP_SQL)
        self.assertNotRegex(FOLLOWUP_SQL, r"(?im)^\s*GRANT\b[^;]*\b(beneficiaries|measurements)\b")
        self.assertIn("No worker table is created", FOLLOWUP_SQL)

    def test_base_schema_keeps_dpo_detail_and_rule_approval_separate(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS public.dpo_detail_access_grants", BASE_SQL)
        self.assertIn("CREATE TABLE IF NOT EXISTS public.rule_change_requests", BASE_SQL)
        self.assertIn("request_status IN ('draft', 'submitted', 'withdrawn')", BASE_SQL)
        self.assertIn("No approval state or approval authority is provided here", BASE_SQL)


if __name__ == "__main__":
    unittest.main()
