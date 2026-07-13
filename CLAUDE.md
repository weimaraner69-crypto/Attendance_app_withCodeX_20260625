# CLAUDE.md - Claude Code プロジェクト指示

このファイルは Claude Code 向けの薄い入口である。共通ルールは `AGENTS.md`、AI 運用モデルは `ai/*.yml`、機密情報の扱いは `SECURITY.md` を正本とする。

## 作業開始時

- `AGENTS.md` を読み、`ai/command-router.yml` と `ai/context-index.yml` に従って必要な文書だけを読む。
- 計画・実行キューは `NEXT.md`、完了ログは `FINISHED.md`、変更履歴は `CHANGELOG.md` を正本とする。
- 成果物、PR本文、Issue本文、レビューコメント、docs更新要約は日本語で書く。

## 安全と完了

- `.env.local` の値を読まない、表示しない、ログやPRやIssueへ転記しない。必要な場合は、値を表示しない確認方法を先に示し、ユーザーの明示許可を得る。
- 既存の未コミット変更を無断で revert、上書き、stage しない。
- コード変更後は原則 `npm run lint` と `npm run build` を実行する。
- `git push` やPR作成を行った場合、CIとレビュー状態を確認する。

## ハーネス固有の扱い

この導入段階では Claude Code の自動 hooks や専用 agent roster は使わない。終了前の確認、長時間作業の状態記録、レビュー追跡は `AGENTS.md` と `docs/orchestration.md` の手順に従って手動で行う。
