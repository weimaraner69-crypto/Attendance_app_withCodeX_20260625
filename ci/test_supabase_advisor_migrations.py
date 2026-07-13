"""Regression tests for the Supabase Advisor migrations."""

from pathlib import Path
from unittest import TestCase, main


REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"


class SupabaseAdvisorMigrationTest(TestCase):
    PERFORMANCE_MIGRATION = (
        MIGRATIONS / "202607130002_performance_advisor_optimization.sql"
    )

    def test_updated_at_function_uses_minimal_search_path(self) -> None:
        migration = (
            MIGRATIONS / "202607090001_supabase_advisor_warnings.sql"
        ).read_text(encoding="utf-8")

        self.assertIn("set search_path = pg_catalog", migration)
        self.assertNotIn("set search_path = public, pg_catalog", migration)

    def test_line_account_staff_index_is_not_duplicated(self) -> None:
        initial = (
            MIGRATIONS / "202606250001_initial_attendance_schema.sql"
        ).read_text(encoding="utf-8")
        advisor = (
            MIGRATIONS / "202607090001_supabase_advisor_warnings.sql"
        ).read_text(encoding="utf-8")
        followup = (
            MIGRATIONS / "202607130001_supabase_advisor_review_followup.sql"
        ).read_text(encoding="utf-8")

        self.assertIn(
            "create index idx_line_accounts_staff on public.line_accounts (staff_id);",
            initial,
        )
        self.assertNotIn("create index if not exists idx_line_accounts_staff_id", advisor)
        self.assertIn(
            "drop index if exists public.idx_line_accounts_staff_id;",
            followup,
        )

    def test_private_function_changes_are_guarded(self) -> None:
        migration = (
            MIGRATIONS / "202607090002_security_advisor_function_execute.sql"
        ).read_text(encoding="utf-8")

        signatures = [
            "private.current_user_organization_id()",
            "private.current_user_role()",
            "private.can_access_store(uuid)",
        ]

        for signature in signatures:
            self.assertIn(
                f"if to_regprocedure('{signature}') is not null then",
                migration,
            )
            self.assertIn(
                f"execute 'alter function {signature} set search_path = ''''';",
                migration,
            )
            self.assertIn(
                f"execute 'revoke execute on function {signature} from public, anon';",
                migration,
            )
            self.assertIn(
                f"execute 'grant execute on function {signature} to authenticated';",
                migration,
            )

    def test_performance_policies_cache_auth_uid(self) -> None:
        migration = self.PERFORMANCE_MIGRATION.read_text(encoding="utf-8")

        self.assertEqual(migration.count("(select auth.uid())"), 9)
        self.assertNotIn("= auth.uid()", migration)

    def test_management_policies_are_split_by_command(self) -> None:
        migration = self.PERFORMANCE_MIGRATION.read_text(encoding="utf-8")
        sql_without_comments = "\n".join(
            line
            for line in migration.splitlines()
            if not line.lstrip().startswith("--")
        )
        managed_tables = {
            "attendance_events",
            "attendance_records",
            "attendance_requests",
            "kiosk_devices",
            "line_accounts",
            "manager_store_permissions",
            "notifications",
            "shift_submission_items",
            "shift_submission_windows",
            "shift_submissions",
            "shifts",
            "sr_organization_permissions",
            "staff",
            "store_staff_assignments",
            "stores",
            "user_profiles",
        }

        for table in managed_tables:
            self.assertIn(f"('{table}',", migration)

        self.assertNotIn(" for all", sql_without_comments.lower())
        self.assertIn("for insert with check", migration)
        self.assertIn("for update using", migration)
        self.assertIn("for delete using", migration)

    def test_all_unindexed_foreign_keys_get_leading_indexes(self) -> None:
        migration = self.PERFORMANCE_MIGRATION.read_text(encoding="utf-8")
        expected_indexes = {
            "idx_attendance_events_organization_id",
            "idx_attendance_records_organization_id",
            "idx_attendance_requests_organization_id",
            "idx_attendance_requests_staff_id",
            "idx_manager_store_permissions_organization_id",
            "idx_notifications_organization_id",
            "idx_shift_submission_items_organization_id",
            "idx_shift_submission_items_submission_id",
            "idx_shift_submission_windows_organization_id",
            "idx_shift_submissions_organization_id",
            "idx_shift_submissions_staff_id",
            "idx_shifts_organization_id",
            "idx_store_staff_assignments_organization_id",
        }

        self.assertEqual(migration.count("create index if not exists"), 13)
        for index_name in expected_indexes:
            self.assertIn(f"create index if not exists {index_name}", migration)


if __name__ == "__main__":
    main()
