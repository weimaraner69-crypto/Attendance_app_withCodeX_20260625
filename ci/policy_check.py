"""汎用ポリシーチェッカー。

プロジェクト固有の禁止パターンと秘密情報パターンをチェックする。
検査対象と許可パターンは本ファイル内の定数で設定する。

使い方:
    python3 ci/policy_check.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shlex
import subprocess
from fnmatch import fnmatch
from pathlib import Path

from jsonschema import Draft202012Validator

# ---------------------------------------------------------------------------
# 設定
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent

# スキャン対象ディレクトリ（プロジェクトに合わせて変更）
SCAN_DIRS = [
    REPO_ROOT / "ai",
    REPO_ROOT / ".cursor",
    REPO_ROOT / "src",
    REPO_ROOT / "scripts",
    REPO_ROOT / "docs",
    REPO_ROOT / ".github",
    REPO_ROOT / "ci",
    REPO_ROOT / "supabase",
]

# ルート直下の入口・運用設定。`.env.local` のようなローカル設定は含めない。
ROOT_SCAN_FILES = [
    REPO_ROOT / "AGENTS.md",
    REPO_ROOT / "CLAUDE.md",
    REPO_ROOT / "README.md",
    REPO_ROOT / "SECURITY.md",
    REPO_ROOT / "project-config.yml",
]

REVIEW_EVIDENCE_DIR = REPO_ROOT / "docs" / "ai" / "reviews"
REVIEW_EVIDENCE_SCHEMA_PATH = REPO_ROOT / "docs" / "ai" / "review-result.schema.json"
REVIEW_RISK_PATHS_PATH = REPO_ROOT / "ai" / "review-risk-paths.json"
REVIEW_EVIDENCE_FILENAME = re.compile(
    r"^\d{4}-\d{2}-\d{2}-pr(?P<pr>\d+)-round(?P<round>[1-3])-"
    r"(?P<provider>codex|claude|copilot)-(?P<reviewer>[a-z0-9_-]+)\.json$"
)
REVIEW_EVIDENCE_REQUIRED_FIELDS = {
    "schema_version",
    "phase",
    "provider",
    "reviewer_id",
    "review_session_id",
    "implementation_session_id",
    "head_sha",
    "diff_fingerprint",
    "risk_tier",
    "round",
    "review_status",
    "repository_context_mode",
    "secondary_verification",
    "summary",
    "diff_only_reason",
    "changed_files",
    "related_files",
    "scanned_paths",
    "commands_run",
    "context_fingerprint",
    "context_budget",
    "context_truncated",
    "context_truncated_reason",
    "issues",
}
TEST_RUNNER_COMMAND = re.compile(
    r"^(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*"
    r"(?:python3?\s+-m\s+(?:unittest|pytest)\b|pytest\b|"
    r"npm(?:\s+run)?\s+test(?:\s|$)|npx\s+(?:vitest|jest|playwright)\b|"
    r"vitest\b|jest\b|playwright\b|cargo\s+test\b|go\s+test\b)"
)

# コードとして扱う拡張子
CODE_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".go",
    ".rs",
}

# スキャン対象の拡張子
SCAN_EXTENSIONS = CODE_EXTENSIONS | {
    ".sql",
    ".toml",
    ".txt",
    ".yml",
    ".yaml",
    ".md",
    ".json",
    ".sh",
    ".mdc",
}

# URL 直書きも検査する拡張子。AI 運用設定と Cursor ルールを含める。
URL_SCAN_EXTENSIONS = CODE_EXTENSIONS | {".yml", ".yaml", ".mdc"}

# C 系のブロックコメントを持つ拡張子
BLOCK_COMMENT_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".go", ".rs"}

# スキップするディレクトリ名
SKIP_DIR_NAMES = {
    "__pycache__",
    ".git",
    "node_modules",
    ".mypy_cache",
    ".ruff_cache",
    "target",
}

# ホワイトリスト（パスの相対表記）— 誤検知を除外するファイル
SKIP_FILES: set[str] = {
    "ci/policy_check.py",  # 自分自身のパターン定義は除外
}

# ---------------------------------------------------------------------------
# 禁止パターン（プロジェクトに合わせてカスタマイズ）
# ---------------------------------------------------------------------------

# 禁止 import パターン（正規表現、Python ファイルのみ適用）
# 例: 外部 HTTP ライブラリを禁止する場合
FORBIDDEN_IMPORT_PATTERNS: list[str] = [
    # r"^\s*import\s+requests",
    # r"^\s*from\s+requests\s+import",
    # r"^\s*import\s+httpx",
    # r"^\s*from\s+httpx\s+import",
]

# 秘密情報パターン（正規表現、全ファイル種別に適用）
SECRET_PATTERNS: list[str] = [
    r"AKIA[0-9A-Z]{16}",  # AWS Access Key ID
    r"-----BEGIN\s+(RSA|DSA|EC|OPENSSH)\s+PRIVATE\s+KEY-----",  # SSH 秘密鍵
    r"ghp_[A-Za-z0-9_]{36,}",  # GitHub Personal Access Token
    r"sk-[A-Za-z0-9]{32,}",  # 汎用 API キー
    r"sk-ant-api03-[A-Za-z0-9\-_]{20,}",  # Anthropic API キー新形式
    r"sk-proj-[A-Za-z0-9]{20,}",  # OpenAI API キー新形式
    r"Bearer\s+[A-Za-z0-9\-._~+/]{20,}=*",  # Bearer トークン（最小20文字で誤検知低減）
    r"password\s*=\s*[\"'][^\"\']+[\"']",  # パスワードハードコード
]

# URL パターン（コード中の外部 URL 直書きを検出）
URL_PATTERN = r"https?://[^\s\"')\]>]+"

# URL ホワイトリスト（マッチしたら許可）
URL_ALLOWLIST_PATTERNS: list[str] = [
    r"example\.com",
    r"github\.com",
    r"pypi\.org",
    r"npmjs\.com",
    r"docs\.python\.org",
    r"schemas\.openapi",
    r"json-schema\.org",
    r"astral\.sh",
    r"opentelemetry\.io",
    # AI provider の公式 API エンドポイント
    r"api\.openai\.com",
    r"api\.anthropic\.com",
    r"api\.line\.me",
    r"localhost|127\.0\.0\.1|\[::1\]",
]

# 禁止操作パターン（言語非依存、全ファイルに適用）
FORBIDDEN_PATTERNS: list[str] = [
    # プロジェクト固有の禁止パターンをここに追加
]


# ---------------------------------------------------------------------------
# ユーティリティ
# ---------------------------------------------------------------------------


def git_ls_files() -> list[Path]:
    """git 管理対象のファイル一覧を取得する。"""
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            check=True,
        )
        return [REPO_ROOT / line for line in result.stdout.splitlines() if line.strip()]
    except (subprocess.CalledProcessError, FileNotFoundError) as error:
        raise RuntimeError("git 管理対象ファイルの取得に失敗しました") from error


def should_skip(path: Path) -> bool:
    """スキップ対象のディレクトリに含まれるか判定する。"""
    parts = set(path.parts)
    return any(name in parts for name in SKIP_DIR_NAMES)


def is_skipped_file(path: Path) -> bool:
    """ホワイトリストに登録されたファイルか判定する。"""
    rel = path.relative_to(REPO_ROOT).as_posix()
    return rel in SKIP_FILES


def read_text_safely(path: Path) -> str | None:
    """ファイルを安全に読み込む。"""
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except (OSError, UnicodeDecodeError):
        return None


def is_url_allowlisted(line: str) -> bool:
    """URL がホワイトリストに該当するか判定する。"""
    return any(re.search(pat, line) for pat in URL_ALLOWLIST_PATTERNS)


def is_code_file(path: Path) -> bool:
    """コード系ファイルか判定する（コメント行の判定に使用）。"""
    return path.suffix.lower() in CODE_EXTENSIONS


def is_url_scanned_file(path: Path) -> bool:
    """URL 直書きの検査対象か判定する。"""
    return path.suffix.lower() in URL_SCAN_EXTENSIONS


def is_comment_line(line: str, suffix: str) -> bool:
    """コメント行か判定する。"""
    stripped = line.lstrip()
    return suffix in CODE_EXTENSIONS and (
        stripped.startswith("#") or stripped.startswith("//")
    )


def strip_block_comments(line: str, in_block_comment: bool) -> tuple[str, bool]:
    """文字列リテラルを保ちつつ C 系ブロックコメントを行から除去する。"""
    result: list[str] = []
    quote: str | None = None
    escaped = False
    index = 0

    while index < len(line):
        if in_block_comment:
            end = line.find("*/", index)
            if end == -1:
                return "".join(result), True
            in_block_comment = False
            index = end + 2
            continue

        char = line[index]
        if quote is not None:
            result.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            index += 1
            continue

        if line.startswith("/*", index):
            in_block_comment = True
            index += 2
            continue

        result.append(char)
        if char in {"'", '"', "`"}:
            quote = char
        index += 1

    return "".join(result), in_block_comment


def is_forbidden_env_file(relative_path: str) -> bool:
    """tracked file が禁止対象の .env* か判定する。"""
    name = Path(relative_path).name
    return name.startswith(".env") and name != ".env.example"


def run_git(*args: str) -> subprocess.CompletedProcess[str]:
    """Git コマンドを値の表示を伴わず実行する。"""
    return subprocess.run(
        ["git", *args],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=False,
    )


def review_head_is_compatible(head_sha: str) -> bool:
    """証跡が現在HEAD、または証跡専用commitの親を指すか確認する。"""
    if re.fullmatch(r"[0-9a-f]{7,40}", head_sha) is None:
        return False
    current = run_git("rev-parse", "HEAD")
    if current.returncode != 0:
        return False
    current_sha = current.stdout.strip()
    if head_sha == current_sha or current_sha.startswith(head_sha):
        return True

    ancestor = run_git("merge-base", "--is-ancestor", head_sha, current_sha)
    if ancestor.returncode != 0:
        return False
    changed = run_git("diff", "--name-only", f"{head_sha}..{current_sha}")
    if changed.returncode != 0:
        return False
    paths = [line for line in changed.stdout.splitlines() if line]
    return bool(paths) and all(path.startswith("docs/ai/reviews/") for path in paths)


def review_diff_facts(head_sha: str) -> tuple[str, list[str], str] | None:
    """review対象commitの差分fingerprint、変更path、risk tierを再計算する。"""
    if re.fullmatch(r"[0-9a-f]{7,40}", head_sha) is None:
        return None
    base = run_git("merge-base", "origin/main", head_sha)
    if base.returncode != 0:
        return None
    base_sha = base.stdout.strip()
    diff = run_git(
        "diff",
        "--binary",
        f"{base_sha}..{head_sha}",
        "--",
        ".",
        ":(exclude)docs/ai/reviews/**",
    )
    paths = changed_paths_between(base_sha, head_sha)
    if diff.returncode != 0 or paths is None:
        return None
    fingerprint = "sha256:" + hashlib.sha256(diff.stdout.encode("utf-8")).hexdigest()
    return fingerprint, paths, risk_tier_for_paths(paths)


def changed_paths_between(base_sha: str, head_sha: str) -> list[str] | None:
    """rename/copyの旧・新pathを含む変更pathをGitから取得する。"""
    changed = run_git(
        "diff",
        "--name-status",
        "-M",
        "-C",
        "--find-copies-harder",
        f"{base_sha}..{head_sha}",
        "--",
        ".",
        ":(exclude)docs/ai/reviews/**",
    )
    if changed.returncode != 0:
        return None
    return parse_name_status_paths(changed.stdout)


def parse_name_status_paths(output: str) -> list[str]:
    """name-status出力からrename/copyの旧・新pathを両方抽出する。"""
    paths: set[str] = set()
    for line in output.splitlines():
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        status = parts[0]
        if status.startswith(("R", "C")) and len(parts) >= 3:
            paths.update(parts[1:3])
        else:
            paths.add(parts[-1])
    return sorted(paths)


def path_matches_risk_pattern(path: str, pattern: str) -> bool:
    """`**/`が0階層にも一致するGit wildmatch相当の最小判定を行う。"""
    candidates = {pattern}
    pending = [pattern]
    while pending:
        candidate = pending.pop()
        marker = "/**/"
        index = candidate.find(marker)
        if index == -1:
            continue
        collapsed = candidate[: index + 1] + candidate[index + len(marker) :]
        if collapsed not in candidates:
            candidates.add(collapsed)
            pending.append(collapsed)
    return any(fnmatch(path, candidate) for candidate in candidates)


def risk_tier_for_paths(paths: list[str]) -> str:
    """リポジトリ固有のred pathから最低risk tierを決める。"""
    config = json.loads(REVIEW_RISK_PATHS_PATH.read_text(encoding="utf-8"))
    for tier in ("red", "yellow"):
        patterns = config[f"{tier}_if_touches"]
        if any(
            path_matches_risk_pattern(path, pattern)
            for path in paths
            for pattern in patterns
        ):
            return tier
    return str(config["default_tier"])


def valid_dedicated_test_commands(
    commands: object, changed_files: object
) -> bool:
    """成功したtest runnerと変更path coverageを検証する。"""
    if not isinstance(commands, list) or not commands:
        return False
    if not isinstance(changed_files, list) or not all(
        isinstance(path, str) and path for path in changed_files
    ):
        return False

    coverage_patterns: list[str] = []
    for command in commands:
        if not isinstance(command, dict):
            return False
        command_text = command.get("command")
        covered_paths = command.get("covered_paths")
        if (
            not isinstance(command_text, str)
            or not command_text
            or command.get("exit_code") != 0
            or not isinstance(command.get("summary"), str)
            or not command.get("summary")
            or not isinstance(covered_paths, list)
            or not covered_paths
            or not all(isinstance(pattern, str) and pattern for pattern in covered_paths)
        ):
            return False
        if contains_shell_control_operator(command_text):
            return False
        if TEST_RUNNER_COMMAND.match(command_text):
            coverage_patterns.extend(covered_paths)

    return bool(coverage_patterns) and all(
        any(path_matches_risk_pattern(path, pattern) for pattern in coverage_patterns)
        for path in changed_files
    )


def contains_shell_control_operator(command: str) -> bool:
    """終了codeを隠せる未quoteのshell制御演算子を検出する。"""
    if "\n" in command or "\r" in command:
        return True
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|")
    lexer.whitespace_split = True
    lexer.commenters = ""
    try:
        tokens = list(lexer)
    except ValueError:
        return True
    return any(token in {"&&", "||", ";", "|", "&"} for token in tokens)


def validate_current_review_target(
    data: dict[str, object], relative_path: str
) -> list[str]:
    """最新PR証跡のhead、fingerprint、paths、riskをGitから検証する。"""
    issues: list[str] = []
    head_sha = str(data.get("head_sha", ""))
    if not review_head_is_compatible(head_sha):
        issues.append(f"レビュー対象headが現在差分と非互換 in {relative_path}")
    facts = review_diff_facts(head_sha)
    if facts is None:
        issues.append(f"レビュー対象差分を再計算できません in {relative_path}")
        return issues
    fingerprint, paths, risk_tier = facts
    if data.get("diff_fingerprint") != fingerprint:
        issues.append(f"レビューdiff fingerprintが不一致 in {relative_path}")
    if sorted(data.get("changed_files", [])) != paths:
        issues.append(f"レビューchanged_filesがGit差分と不一致 in {relative_path}")
    risk_order = {"green": 0, "yellow": 1, "red": 2}
    declared_risk = str(data.get("risk_tier"))
    if risk_order.get(declared_risk, -1) < risk_order[risk_tier]:
        issues.append(f"レビューrisk tierが変更pathと不一致 in {relative_path}")
    return issues


def validate_review_evidence_data(
    data: object,
    relative_path: str,
    *,
    head_compatible: bool,
) -> list[str]:
    """push後AIレビュー証跡の必須意味条件を検査する。"""
    issues: list[str] = []
    if not isinstance(data, dict):
        return [f"レビュー証跡不正: objectではありません in {relative_path}"]

    schema = json.loads(REVIEW_EVIDENCE_SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    schema_errors = sorted(
        Draft202012Validator(schema).iter_errors(data),
        key=lambda error: list(error.absolute_path),
    )
    if schema_errors:
        for error in schema_errors:
            location = ".".join(str(part) for part in error.absolute_path) or "$"
            issues.append(
                f"レビュー証跡schema違反 {location}: {error.message} in {relative_path}"
            )
        return issues

    missing = sorted(REVIEW_EVIDENCE_REQUIRED_FIELDS - data.keys())
    if missing:
        issues.append(
            f"レビュー証跡不足: {', '.join(missing)} in {relative_path}"
        )
        return issues

    nonempty_strings = (
        "reviewer_id",
        "review_session_id",
        "implementation_session_id",
        "head_sha",
        "diff_fingerprint",
        "summary",
        "context_fingerprint",
    )
    for field in nonempty_strings:
        if not isinstance(data.get(field), str) or not str(data[field]).strip():
            issues.append(f"レビュー証跡{field}が空または型不正 in {relative_path}")

    if re.fullmatch(r"[0-9a-f]{7,40}", str(data.get("head_sha", ""))) is None:
        issues.append(f"レビューhead_sha形式不正 in {relative_path}")
    if re.fullmatch(r"sha256:[0-9a-f]{64}", str(data.get("diff_fingerprint", ""))) is None:
        issues.append(f"レビューdiff_fingerprint形式不正 in {relative_path}")
    if data.get("repository_context_mode") not in {
        "diff_only",
        "related_context",
        "full_repo_agentic",
    }:
        issues.append(f"レビューcontext mode不正 in {relative_path}")
    if data.get("risk_tier") not in {"green", "yellow", "red"}:
        issues.append(f"レビューrisk tier不正 in {relative_path}")
    if not isinstance(data.get("round"), int) or data["round"] not in {1, 2, 3}:
        issues.append(f"レビューround不正 in {relative_path}")

    for field in ("changed_files", "scanned_paths"):
        value = data.get(field)
        if not isinstance(value, list) or not all(
            isinstance(item, str) and item for item in value
        ):
            issues.append(f"レビュー証跡{field}不正 in {relative_path}")
    related_files = data.get("related_files")
    if not isinstance(related_files, list) or not all(
        isinstance(item, dict)
        and isinstance(item.get("path"), str)
        and bool(item.get("path"))
        and isinstance(item.get("reason"), str)
        and bool(item.get("reason"))
        for item in related_files
    ):
        issues.append(f"レビュー証跡related_files不正 in {relative_path}")
    commands_run = data.get("commands_run")
    if not isinstance(commands_run, list) or not all(
        isinstance(item, dict)
        and isinstance(item.get("command"), str)
        and bool(item.get("command"))
        and isinstance(item.get("exit_code"), int)
        and isinstance(item.get("summary"), str)
        and bool(item.get("summary"))
        for item in commands_run
    ):
        issues.append(f"レビュー証跡commands_run不正 in {relative_path}")
    context_budget = data.get("context_budget")
    budget_fields = {
        "max_related_files",
        "max_context_chars",
        "max_file_excerpt_chars",
        "max_context_commands",
    }
    if not isinstance(context_budget, dict) or not all(
        isinstance(context_budget.get(field), int) and context_budget[field] > 0
        for field in budget_fields
    ):
        issues.append(f"レビュー証跡context_budget不正 in {relative_path}")
    if not isinstance(data.get("context_truncated"), bool) or not isinstance(
        data.get("context_truncated_reason"), str
    ):
        issues.append(f"レビュー証跡context_truncated不正 in {relative_path}")
    if not isinstance(data.get("diff_only_reason"), str):
        issues.append(f"レビュー証跡diff_only_reason不正 in {relative_path}")

    filename_match = REVIEW_EVIDENCE_FILENAME.match(Path(relative_path).name)
    if filename_match is None:
        issues.append(f"レビュー証跡ファイル名不正 in {relative_path}")
    else:
        if int(filename_match.group("round")) != data.get("round"):
            issues.append(f"レビューroundとファイル名が不一致 in {relative_path}")
        if filename_match.group("provider") != data["provider"]:
            issues.append(f"レビューproviderとファイル名が不一致 in {relative_path}")

    if data.get("schema_version") != 2 or data.get("phase") != "post_push":
        issues.append(f"レビュー証跡はschema v2のpost_pushが必須 in {relative_path}")
    if data.get("provider") not in {"codex", "claude", "copilot"}:
        issues.append(f"レビューprovider不正 in {relative_path}")
    if data.get("review_session_id") == data.get("implementation_session_id"):
        issues.append(f"独立レビューsessionが未分離 in {relative_path}")
    if not head_compatible:
        issues.append(f"レビュー対象headが現在差分と非互換 in {relative_path}")
    if data.get("review_status") != "completed":
        issues.append(f"レビューが完了していません in {relative_path}")

    secondary = data["secondary_verification"]
    if not isinstance(secondary, dict):
        issues.append(f"第2確認証跡不正 in {relative_path}")
    else:
        secondary_required_fields = {
            "required",
            "method",
            "status",
            "evidence",
            "commands",
        }
        if not secondary_required_fields.issubset(secondary):
            issues.append(f"第2確認証跡の必須field不足 in {relative_path}")
        if secondary.get("method") not in {
            "not_required",
            "independent_review",
            "dedicated_tests",
        } or secondary.get("status") not in {
            "not_required",
            "passed",
            "failed",
            "pending",
        }:
            issues.append(f"第2確認証跡のenum不正 in {relative_path}")
    if isinstance(secondary, dict) and data["risk_tier"] == "red":
        if not secondary.get("required"):
            issues.append(f"red riskの第2確認が未必須化 in {relative_path}")
        if secondary.get("method") not in {
            "independent_review",
            "dedicated_tests",
        } or secondary.get("status") != "passed":
            issues.append(f"red riskの第2確認が未完了 in {relative_path}")
        if not str(secondary.get("evidence", "")).strip():
            issues.append(f"red riskの第2確認証跡が空 in {relative_path}")
        if secondary.get("method") == "dedicated_tests":
            if not valid_dedicated_test_commands(
                secondary.get("commands"), data.get("changed_files")
            ):
                issues.append(f"red riskの専用回帰テスト証跡不正 in {relative_path}")
        if data["repository_context_mode"] != "full_repo_agentic":
            issues.append(f"red riskはfull_repo_agenticが必須 in {relative_path}")
    if isinstance(secondary, dict) and data["risk_tier"] == "yellow":
        if (
            secondary.get("required") is not True
            or secondary.get("method") != "dedicated_tests"
            or secondary.get("status") != "passed"
            or not str(secondary.get("evidence", "")).strip()
            or not valid_dedicated_test_commands(
                secondary.get("commands"), data.get("changed_files")
            )
        ):
            issues.append(f"yellow riskのtargeted test証跡不正 in {relative_path}")

    evidence_issues = data["issues"]
    if not isinstance(evidence_issues, list):
        issues.append(f"レビューissues不正 in {relative_path}")
    else:
        for index, finding in enumerate(evidence_issues, start=1):
            if not isinstance(finding, dict):
                issues.append(f"レビューissue {index}がobjectではない in {relative_path}")
                continue
            finding_required_fields = {
                "severity",
                "category",
                "file",
                "line",
                "rationale",
                "fix",
                "confidence",
                "disposition",
                "disposition_reason",
            }
            if not finding_required_fields.issubset(finding):
                issues.append(f"レビューissue {index}の必須field不足 in {relative_path}")
            if finding.get("severity") not in {"Must", "Should", "Nice"}:
                issues.append(f"レビューissue {index}のseverity不正 in {relative_path}")
            for field in ("category", "file", "rationale", "fix"):
                if not isinstance(finding.get(field), str) or not finding.get(field):
                    issues.append(f"レビューissue {index}の{field}不正 in {relative_path}")
            if not isinstance(finding.get("line"), int) or finding.get("line", 0) < 1:
                issues.append(f"レビューissue {index}のline不正 in {relative_path}")
            confidence = finding.get("confidence")
            if not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
                issues.append(f"レビューissue {index}のconfidence不正 in {relative_path}")
            if finding.get("disposition") not in {
                "open",
                "fixed",
                "backlog",
                "rejected",
            }:
                issues.append(f"レビューissue {index}のdisposition不正 in {relative_path}")
            if finding.get("severity") in {"Must", "Should"} and finding.get(
                "disposition"
            ) == "open":
                issues.append(
                    f"未対応{finding['severity']} issue {index} in {relative_path}"
                )
            if finding.get("severity") == "Must" and finding.get(
                "disposition"
            ) == "backlog":
                issues.append(f"Must issue {index}はBacklog化禁止 in {relative_path}")
            if (
                finding.get("severity") == "Should"
                and finding.get("disposition") == "backlog"
                and data.get("round") != 3
            ):
                issues.append(
                    f"Round 1-2のShould issue {index}はBacklog化禁止 in {relative_path}"
                )
            if "disposition" not in finding or "disposition_reason" not in finding:
                issues.append(f"レビューissue {index}のdisposition不足 in {relative_path}")
            elif finding.get("severity") in {"Must", "Should"} and not str(
                finding.get("disposition_reason", "")
            ).strip():
                issues.append(
                    f"レビューissue {index}のdisposition理由が空 in {relative_path}"
                )
    return issues


def scan_review_evidence(required_pr_number: str | None = None) -> list[str]:
    """レビュー証跡全件とprovider ANY-OF条件を検査する。"""
    issues: list[str] = []
    providers_by_round: dict[tuple[str, str], set[str]] = {}
    evidence_by_round: dict[tuple[str, str], list[tuple[dict[str, object], str]]] = {}
    if not REVIEW_EVIDENCE_DIR.exists():
        if required_pr_number is not None:
            return [
                f"PR #{required_pr_number}のpush後AIレビュー証跡ディレクトリがありません"
            ]
        return issues

    for path in sorted(REVIEW_EVIDENCE_DIR.glob("*.json")):
        relative_path = path.relative_to(REPO_ROOT).as_posix()
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
            issues.append(f"レビュー証跡JSON読込失敗: {error} in {relative_path}")
            continue

        match = REVIEW_EVIDENCE_FILENAME.match(path.name)
        if match is None and isinstance(data, dict) and data.get("schema_version") != 2:
            # v2導入前の証跡は履歴として保存し、新規PRゲートに数えない。
            continue

        issues.extend(
            validate_review_evidence_data(
                data,
                relative_path,
                head_compatible=True,
            )
        )
        if match and isinstance(data, dict):
            key = (match.group("pr"), match.group("round"))
            providers_by_round.setdefault(key, set()).add(str(data.get("provider")))
            evidence_by_round.setdefault(key, []).append((data, relative_path))

    for (pr_number, round_number), providers in sorted(providers_by_round.items()):
        if not providers.intersection({"codex", "claude"}):
            issues.append(
                f"PR #{pr_number} round {round_number}に必須Codex/Claude証跡がありません"
            )
        entries = evidence_by_round[(pr_number, round_number)]
        independent_secondary_required = any(
            data.get("risk_tier") == "red"
            and isinstance(data.get("secondary_verification"), dict)
            and data["secondary_verification"].get("method")
            == "independent_review"
            for data, _ in entries
        )
        review_sessions = {
            str(data.get("review_session_id"))
            for data, _ in entries
            if data.get("review_session_id")
        }
        reviewer_ids = {
            str(data.get("reviewer_id"))
            for data, _ in entries
            if data.get("reviewer_id")
        }
        implementation_sessions = {
            str(data.get("implementation_session_id"))
            for data, _ in entries
            if data.get("implementation_session_id")
        }
        if len(implementation_sessions) != 1:
            issues.append(
                f"PR #{pr_number} round {round_number}のimplementation sessionが不統一です"
            )
        if review_sessions.intersection(implementation_sessions):
            issues.append(
                f"PR #{pr_number} round {round_number}のreview sessionがimplementation sessionを再利用しています"
            )
        if independent_secondary_required and (
            len(review_sessions) < 2 or len(reviewer_ids) < 2
        ):
            issues.append(
                f"PR #{pr_number} round {round_number}の独立第2レビュー証跡が不足です"
            )

    if required_pr_number is not None:
        matching_rounds = sorted(
            {
                int(round_number)
                for pr_number, round_number in evidence_by_round
                if pr_number == required_pr_number
            }
        )
        if not matching_rounds:
            issues.append(f"PR #{required_pr_number}のpush後AIレビュー証跡がありません")
        else:
            expected_rounds = list(range(1, max(matching_rounds) + 1))
            if matching_rounds != expected_rounds:
                issues.append(
                    f"PR #{required_pr_number}のレビューroundが1から連続していません"
                )
            latest_round = str(max(matching_rounds))
            latest_entries = evidence_by_round[(required_pr_number, latest_round)]
            validated_entries: list[tuple[dict[str, object], str]] = []
            for data, path in latest_entries:
                target_issues = validate_current_review_target(data, path)
                issues.extend(target_issues)
                if not target_issues:
                    validated_entries.append((data, path))

            candidates = [
                (data, path)
                for data, path in validated_entries
                if data.get("provider") in {"codex", "claude"}
            ]
            if not candidates:
                issues.append(
                    f"PR #{required_pr_number} round {latest_round}に現在差分と互換するCodex/Claude証跡がありません"
                )
            independent_secondary_required = any(
                isinstance(data.get("secondary_verification"), dict)
                and data["secondary_verification"].get("method")
                == "independent_review"
                for data, _ in candidates
            )
            if independent_secondary_required:
                current_reviewer_ids = {
                    str(data.get("reviewer_id")) for data, _ in validated_entries
                }
                current_review_sessions = {
                    str(data.get("review_session_id"))
                    for data, _ in validated_entries
                }
                if len(current_reviewer_ids) < 2 or len(current_review_sessions) < 2:
                    issues.append(
                        f"PR #{required_pr_number} round {latest_round}の現在差分に独立第2レビュー証跡がありません"
                    )
    return issues


# ---------------------------------------------------------------------------
# スキャン
# ---------------------------------------------------------------------------


def scan_file(path: Path) -> list[str]:
    """1 ファイルをスキャンし、問題を返す。"""
    issues: list[str] = []
    text = read_text_safely(path)
    if text is None:
        return issues

    rel = path.relative_to(REPO_ROOT)
    suffix = path.suffix.lower()

    # 禁止 import（コードファイルのみ）
    if is_code_file(path) and FORBIDDEN_IMPORT_PATTERNS:
        for pat in FORBIDDEN_IMPORT_PATTERNS:
            if re.search(pat, text, flags=re.MULTILINE):
                issues.append(f"禁止操作疑い: 禁止import検出 ({pat}) in {rel}")

    # URL 直書き（コードコメント行は除外）
    if is_url_scanned_file(path):
        in_block_comment = False
        for lineno, line in enumerate(text.splitlines(), start=1):
            candidate = line
            if suffix in BLOCK_COMMENT_EXTENSIONS:
                candidate, in_block_comment = strip_block_comments(
                    line, in_block_comment
                )
            if is_comment_line(candidate, suffix):
                continue
            if re.search(URL_PATTERN, candidate) and not is_url_allowlisted(candidate):
                issues.append(f"外部接続疑い: URL直書き検出 in {rel}:{lineno}")

    # 秘密情報（全ファイル種別）
    for pat in SECRET_PATTERNS:
        if re.search(pat, text):
            issues.append(f"秘密情報疑い: パターン検出 ({pat}) in {rel}")

    # プロジェクト固有の禁止パターン（全ファイル種別）
    for pat in FORBIDDEN_PATTERNS:
        if re.search(pat, text, flags=re.MULTILINE):
            issues.append(f"禁止パターン検出: ({pat}) in {rel}")

    return issues


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------


def main(
    *,
    require_review_evidence: bool = False,
    pr_number: str | None = None,
) -> int:
    """ポリシーチェックを実行し、違反があれば非ゼロで終了する。"""
    issues: list[str] = []

    # .env*（雛形を除く）が git 管理されていないことを確認
    try:
        tracked_files = {p.relative_to(REPO_ROOT).as_posix() for p in git_ls_files()}
    except RuntimeError as error:
        print(f"[policy_check] FAILED\n  1. {error}")
        return 1
    for relative_path in sorted(tracked_files):
        if not is_forbidden_env_file(relative_path):
            continue
        issues.append(
            f"禁止: {relative_path} がリポジトリにコミットされています。"
            "削除し、gitignore 対象にしてください。"
        )

    # 対象ファイルのスキャン
    for root in SCAN_DIRS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if should_skip(path):
                continue
            if is_skipped_file(path):
                continue
            if path.suffix.lower() not in SCAN_EXTENSIONS:
                continue
            issues.extend(scan_file(path))

    for path in ROOT_SCAN_FILES:
        if not path.is_file():
            continue
        if is_skipped_file(path):
            continue
        issues.extend(scan_file(path))

    if require_review_evidence and not pr_number:
        issues.append("レビュー証跡必須時はPR番号が必要です")
    issues.extend(scan_review_evidence(pr_number if require_review_evidence else None))

    if issues:
        print("[policy_check] FAILED")
        for i, msg in enumerate(issues, start=1):
            print(f"  {i}. {msg}")
        return 1

    print("[policy_check] OK")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-review-evidence", action="store_true")
    parser.add_argument("--pr-number")
    args = parser.parse_args()
    raise SystemExit(
        main(
            require_review_evidence=args.require_review_evidence,
            pr_number=args.pr_number,
        )
    )
