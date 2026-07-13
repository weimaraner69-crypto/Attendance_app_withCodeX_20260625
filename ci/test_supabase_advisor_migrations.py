"""Regression tests for the Supabase Advisor migrations."""

from pathlib import Path
from unittest import TestCase, main


REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"


class SupabaseAdvisorMigrationTest(TestCase):
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


if __name__ == "__main__":
    main()
