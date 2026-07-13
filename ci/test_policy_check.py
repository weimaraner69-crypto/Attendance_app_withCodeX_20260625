"""ci.policy_check の回帰テスト。"""

from pathlib import Path
from unittest import TestCase, main
from unittest.mock import patch

from ci import policy_check


class PolicyCheckTest(TestCase):
    def scan_text(self, relative_path: str, text: str) -> list[str]:
        path = policy_check.REPO_ROOT / relative_path
        with patch.object(policy_check, "read_text_safely", return_value=text):
            return policy_check.scan_file(path)

    def test_ignores_urls_inside_multiline_block_comments(self) -> None:
        issues = self.scan_text(
            "src/example.ts",
            "/* docs:\nhttps" + "://service.invalid/path\n*/\nconst ok = true;\n",
        )

        self.assertEqual([], issues)

    def test_scans_code_after_block_comment_and_preserves_url_strings(self) -> None:
        issues = self.scan_text(
            "src/example.ts",
            "const docs = '/* not a comment */';\n"
            "/* ignored */ const endpoint = 'https"
            + "://service.invalid/path';\n",
        )

        self.assertEqual(1, len(issues))
        self.assertIn("src/example.ts:2", issues[0])

    def test_forbids_tracked_env_variants_except_exact_example(self) -> None:
        forbidden = [
            ".env",
            ".env.local",
            ".env.production",
            "apps/web/.env.test",
            ".env.example.local",
        ]

        self.assertTrue(all(policy_check.is_forbidden_env_file(path) for path in forbidden))
        self.assertFalse(policy_check.is_forbidden_env_file(".env.example"))
        self.assertFalse(policy_check.is_forbidden_env_file("apps/web/.env.example"))

    def test_main_rejects_tracked_env_variant(self) -> None:
        tracked = [policy_check.REPO_ROOT / "apps/web/.env.production"]

        with (
            patch.object(policy_check, "git_ls_files", return_value=tracked),
            patch.object(policy_check, "SCAN_DIRS", []),
            patch.object(policy_check, "ROOT_SCAN_FILES", []),
            patch("builtins.print") as print_mock,
        ):
            result = policy_check.main()

        self.assertEqual(1, result)
        self.assertTrue(
            any("apps/web/.env.production" in str(call) for call in print_mock.call_args_list)
        )


if __name__ == "__main__":
    main()
