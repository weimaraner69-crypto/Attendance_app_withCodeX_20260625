"""ci.policy_check の回帰テスト。"""

import json
from pathlib import Path
from tempfile import TemporaryDirectory
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

    def review_evidence(self) -> dict[str, object]:
        return {
            "schema_version": 2,
            "phase": "post_push",
            "provider": "codex",
            "reviewer_id": "reviewer-a",
            "review_session_id": "review-session",
            "implementation_session_id": "implementation-session",
            "head_sha": "a" * 40,
            "diff_fingerprint": "sha256:" + "b" * 64,
            "risk_tier": "red",
            "round": 1,
            "review_status": "completed",
            "repository_context_mode": "full_repo_agentic",
            "secondary_verification": {
                "required": True,
                "method": "independent_review",
                "status": "passed",
                "evidence": "reviewer-b",
                "commands": [],
            },
            "summary": "No findings",
            "diff_only_reason": "",
            "changed_files": ["ai/operation-policy.yml"],
            "related_files": [
                {"path": "docs/orchestration.md", "reason": "policy consumer"}
            ],
            "scanned_paths": ["ai", ".github", "docs", "ci"],
            "commands_run": [
                {"command": "python3 ci/policy_check.py", "exit_code": 0, "summary": "OK"}
            ],
            "context_fingerprint": "sha256:" + "c" * 64,
            "context_budget": {
                "max_related_files": 40,
                "max_context_chars": 180000,
                "max_file_excerpt_chars": 12000,
                "max_context_commands": 12,
            },
            "context_truncated": False,
            "context_truncated_reason": "",
            "issues": [],
        }

    def review_finding(
        self,
        *,
        severity: str,
        disposition: str,
        disposition_reason: str,
    ) -> dict[str, object]:
        return {
            "severity": severity,
            "category": "correctness",
            "file": "ci/policy_check.py",
            "line": 1,
            "rationale": "The policy gate must reject this state.",
            "fix": "Record a permitted disposition.",
            "confidence": 1.0,
            "disposition": disposition,
            "disposition_reason": disposition_reason,
        }

    def test_accepts_independent_red_review_evidence(self) -> None:
        issues = policy_check.validate_review_evidence_data(
            self.review_evidence(),
            "docs/ai/reviews/2026-07-14-pr16-round1-codex-reviewer-a.json",
            head_compatible=True,
        )

        self.assertEqual([], issues)

    def test_rejects_same_implementation_and_review_session(self) -> None:
        evidence = self.review_evidence()
        evidence["review_session_id"] = evidence["implementation_session_id"]

        issues = policy_check.validate_review_evidence_data(
            evidence,
            "docs/ai/reviews/2026-07-14-pr16-round1-codex-reviewer-a.json",
            head_compatible=True,
        )

        self.assertTrue(any("未分離" in issue for issue in issues))

    def test_rejects_open_must_and_missing_red_secondary_check(self) -> None:
        evidence = self.review_evidence()
        evidence["secondary_verification"] = {
            "required": False,
            "method": "not_required",
            "status": "not_required",
            "evidence": "",
            "commands": [],
        }
        evidence["issues"] = [
            self.review_finding(
                severity="Must",
                disposition="open",
                disposition_reason="Pending fix",
            )
        ]

        issues = policy_check.validate_review_evidence_data(
            evidence,
            "docs/ai/reviews/2026-07-14-pr16-round1-codex-reviewer-a.json",
            head_compatible=True,
        )

        self.assertTrue(any("第2確認" in issue for issue in issues))
        self.assertTrue(any("未対応Must" in issue for issue in issues))

    def test_rejects_empty_head_and_invalid_context_mode(self) -> None:
        evidence = self.review_evidence()
        evidence["head_sha"] = ""
        evidence["repository_context_mode"] = "diff_guess"

        issues = policy_check.validate_review_evidence_data(
            evidence,
            "docs/ai/reviews/2026-07-14-pr16-round1-codex-reviewer-a.json",
            head_compatible=False,
        )

        self.assertTrue(any("head_sha" in issue for issue in issues))
        self.assertTrue(any("repository_context_mode" in issue for issue in issues))

    def test_rejects_round_one_backlog_dispositions(self) -> None:
        evidence = self.review_evidence()
        evidence["issues"] = [
            self.review_finding(
                severity="Must",
                disposition="backlog",
                disposition_reason="later",
            ),
            self.review_finding(
                severity="Should",
                disposition="backlog",
                disposition_reason="later",
            ),
        ]

        issues = policy_check.validate_review_evidence_data(
            evidence,
            "docs/ai/reviews/2026-07-14-pr16-round1-codex-reviewer-a.json",
            head_compatible=True,
        )

        self.assertTrue(any("Must issue" in issue for issue in issues))
        self.assertTrue(any("Round 1-2" in issue for issue in issues))

    def test_rejects_fingerprint_paths_and_risk_mismatch(self) -> None:
        evidence = self.review_evidence()
        evidence["risk_tier"] = "green"
        with (
            patch.object(policy_check, "review_head_is_compatible", return_value=True),
            patch.object(
                policy_check,
                "review_diff_facts",
                return_value=(
                    "sha256:" + "d" * 64,
                    [".github/workflows/ci.yml"],
                    "red",
                ),
            ),
        ):
            issues = policy_check.validate_current_review_target(
                evidence,
                "docs/ai/reviews/2026-07-14-pr16-round1-codex-reviewer-a.json",
            )

        self.assertTrue(any("fingerprint" in issue for issue in issues))
        self.assertTrue(any("changed_files" in issue for issue in issues))
        self.assertTrue(any("risk tier" in issue for issue in issues))

    def test_empty_head_is_never_compatible(self) -> None:
        self.assertFalse(policy_check.review_head_is_compatible(""))

    def test_rejects_dedicated_tests_without_successful_commands(self) -> None:
        evidence = self.review_evidence()
        evidence["secondary_verification"] = {
            "required": True,
            "method": "dedicated_tests",
            "status": "passed",
            "evidence": "claimed tests",
            "commands": [],
        }

        issues = policy_check.validate_review_evidence_data(
            evidence,
            "docs/ai/reviews/2026-07-14-pr16-round1-codex-reviewer-a.json",
            head_compatible=True,
        )

        self.assertTrue(any("専用回帰テスト証跡不正" in issue for issue in issues))

    def test_applies_json_schema_types(self) -> None:
        evidence = self.review_evidence()
        evidence["secondary_verification"] = {
            "required": "yes",
            "method": "dedicated_tests",
            "status": "passed",
            "evidence": "claimed tests",
            "commands": "not-an-array",
        }

        issues = policy_check.validate_review_evidence_data(
            evidence,
            "docs/ai/reviews/2026-07-14-pr16-round1-codex-reviewer-a.json",
            head_compatible=True,
        )

        self.assertTrue(any("secondary_verification.required" in issue for issue in issues))
        self.assertTrue(any("secondary_verification.commands" in issue for issue in issues))

    def test_risk_tier_uses_canonical_path_config(self) -> None:
        self.assertEqual("green", policy_check.risk_tier_for_paths(["README.md"]))
        self.assertEqual("yellow", policy_check.risk_tier_for_paths(["src/ui/page.tsx"]))
        for path in (
            ".github/actions/install-gitleaks/action.yml",
            "docs/ai/review-result.schema.json",
            "project-config.yml",
            "src/auth/session.ts",
            "src/migrations/001.sql",
            "src/modules/time/migrations/001.sql",
            "pyproject.toml",
            "uv.lock",
        ):
            with self.subTest(path=path):
                self.assertEqual("red", policy_check.risk_tier_for_paths([path]))

    def test_name_status_includes_both_rename_paths(self) -> None:
        paths = policy_check.parse_name_status_paths(
            "R100\t.github/workflows/ci.yml\tdocs/ci.yml\n"
            "M\tsrc/page.tsx\n"
        )

        self.assertEqual(
            [".github/workflows/ci.yml", "docs/ci.yml", "src/page.tsx"],
            paths,
        )

    def test_yellow_requires_successful_targeted_test_evidence(self) -> None:
        evidence = self.review_evidence()
        evidence["risk_tier"] = "yellow"
        evidence["repository_context_mode"] = "related_context"
        evidence["secondary_verification"] = {
            "required": False,
            "method": "not_required",
            "status": "not_required",
            "evidence": "",
            "commands": [],
        }

        issues = policy_check.validate_review_evidence_data(
            evidence,
            "docs/ai/reviews/2026-07-14-pr16-round1-codex-reviewer-a.json",
            head_compatible=True,
        )

        self.assertTrue(any("secondary_verification.required" in issue for issue in issues))

        evidence["secondary_verification"] = {
            "required": True,
            "method": "dedicated_tests",
            "status": "passed",
            "evidence": "targeted policy tests",
            "commands": [
                {
                    "command": "python3 -m unittest ci.test_policy_check",
                    "exit_code": 0,
                    "summary": "passed",
                }
            ],
        }
        issues = policy_check.validate_review_evidence_data(
            evidence,
            "docs/ai/reviews/2026-07-14-pr16-round1-codex-reviewer-a.json",
            head_compatible=True,
        )

        self.assertEqual([], issues)

    def test_required_evidence_fails_when_directory_is_missing(self) -> None:
        with TemporaryDirectory() as temp_dir:
            missing_dir = Path(temp_dir) / "missing"
            with patch.object(policy_check, "REVIEW_EVIDENCE_DIR", missing_dir):
                issues = policy_check.scan_review_evidence(required_pr_number="16")

        self.assertTrue(any("証跡ディレクトリがありません" in issue for issue in issues))

    def test_rejects_non_contiguous_review_rounds(self) -> None:
        evidence = self.review_evidence()
        evidence["round"] = 3
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            review_dir = temp_root / "docs" / "ai" / "reviews"
            review_dir.mkdir(parents=True)
            (review_dir / "2026-07-14-pr16-round3-codex-reviewer-a.json").write_text(
                json.dumps(evidence), encoding="utf-8"
            )
            with (
                patch.object(policy_check, "REPO_ROOT", temp_root),
                patch.object(policy_check, "REVIEW_EVIDENCE_DIR", review_dir),
                patch.object(policy_check, "validate_current_review_target", return_value=[]),
            ):
                issues = policy_check.scan_review_evidence(required_pr_number="16")

        self.assertTrue(any("1から連続" in issue for issue in issues))

    def test_stale_second_reviewer_does_not_satisfy_current_target(self) -> None:
        first = self.review_evidence()
        second = self.review_evidence()
        second["provider"] = "claude"
        second["reviewer_id"] = "reviewer-b"
        second["review_session_id"] = "review-session-2"
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            review_dir = temp_root / "docs" / "ai" / "reviews"
            review_dir.mkdir(parents=True)
            (review_dir / "2026-07-14-pr16-round1-codex-reviewer-a.json").write_text(
                json.dumps(first), encoding="utf-8"
            )
            (review_dir / "2026-07-14-pr16-round1-claude-reviewer-b.json").write_text(
                json.dumps(second), encoding="utf-8"
            )

            def validate_target(data: dict[str, object], _path: str) -> list[str]:
                if data.get("reviewer_id") == "reviewer-b":
                    return ["stale review target"]
                return []

            with (
                patch.object(policy_check, "REPO_ROOT", temp_root),
                patch.object(policy_check, "REVIEW_EVIDENCE_DIR", review_dir),
                patch.object(
                    policy_check,
                    "validate_current_review_target",
                    side_effect=validate_target,
                ),
            ):
                issues = policy_check.scan_review_evidence(required_pr_number="16")

        self.assertIn("stale review target", issues)
        self.assertTrue(any("現在差分に独立第2レビュー証跡がありません" in issue for issue in issues))

    def test_second_reviewer_cannot_reuse_implementation_session(self) -> None:
        first = self.review_evidence()
        second = self.review_evidence()
        second["provider"] = "claude"
        second["reviewer_id"] = "reviewer-b"
        second["review_session_id"] = first["implementation_session_id"]
        second["implementation_session_id"] = "claimed-other-implementation"
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            review_dir = temp_root / "docs" / "ai" / "reviews"
            review_dir.mkdir(parents=True)
            (review_dir / "2026-07-14-pr16-round1-codex-reviewer-a.json").write_text(
                json.dumps(first), encoding="utf-8"
            )
            (review_dir / "2026-07-14-pr16-round1-claude-reviewer-b.json").write_text(
                json.dumps(second), encoding="utf-8"
            )
            with (
                patch.object(policy_check, "REPO_ROOT", temp_root),
                patch.object(policy_check, "REVIEW_EVIDENCE_DIR", review_dir),
            ):
                issues = policy_check.scan_review_evidence()

        self.assertTrue(any("implementation sessionが不統一" in issue for issue in issues))
        self.assertTrue(any("implementation sessionを再利用" in issue for issue in issues))

    def test_rejects_same_reviewer_for_independent_secondary_review(self) -> None:
        first = self.review_evidence()
        second = self.review_evidence()
        second["provider"] = "claude"
        second["review_session_id"] = "review-session-2"
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            review_dir = temp_root / "docs" / "ai" / "reviews"
            review_dir.mkdir(parents=True)
            (review_dir / "2026-07-14-pr16-round1-codex-reviewer-a.json").write_text(
                json.dumps(first), encoding="utf-8"
            )
            (review_dir / "2026-07-14-pr16-round1-claude-reviewer-a.json").write_text(
                json.dumps(second), encoding="utf-8"
            )
            with (
                patch.object(policy_check, "REPO_ROOT", temp_root),
                patch.object(policy_check, "REVIEW_EVIDENCE_DIR", review_dir),
            ):
                issues = policy_check.scan_review_evidence()

        self.assertTrue(any("独立第2レビュー証跡が不足" in issue for issue in issues))

    def test_main_requires_pr_number_for_review_evidence_gate(self) -> None:
        with (
            patch.object(policy_check, "git_ls_files", return_value=[]),
            patch.object(policy_check, "SCAN_DIRS", []),
            patch.object(policy_check, "ROOT_SCAN_FILES", []),
            patch.object(policy_check, "scan_review_evidence", return_value=[]),
            patch("builtins.print") as print_mock,
        ):
            result = policy_check.main(require_review_evidence=True)

        self.assertEqual(1, result)
        self.assertTrue(
            any("PR番号" in str(call) for call in print_mock.call_args_list)
        )


if __name__ == "__main__":
    main()
