# AGENTS.md - Codex / Cursor プロジェクト指示

このファイルは Codex / Cursor 向けの入口である。AI 運用の共通ルールは `ai/*.yml` を正本とし、勤怠管理アプリ固有の正本は既存ドキュメントを優先する。

## 第一目的

店舗スタッフの出退勤、休憩、シフト、打刻修正申請、管理者確認、LINE連携、日報管理アプリ向け外部APIを、安全に実運用できる勤怠管理アプリとして育てる。

## 最優先ルール

- すべての成果物、PR本文、Issue本文、レビューコメント、docs更新要約は日本語で書く。
- `.env.local` の値を読まない、表示しない、ログやPRやIssueへ転記しない。
- `.env.local` や秘密情報へのアクセスが必要な場合は、目的、確認対象、値を表示しない確認方法を先に説明し、ユーザーの明示許可を得る。
- 機密情報の正本は `SECURITY.md`。迷ったら `SECURITY.md` に従う。
- 既存の未コミット変更はユーザーの作業として扱い、明示指示なしに revert、上書き、stage しない。

## AI Operating Model

作業開始時は `ai/command-router.yml` で依頼を分類し、`ai/context-index.yml` に従って必要な文書だけを読む。

日常開発コマンドは次の3つである。

1. `◯◯のプランを見直して直近のプランに入れてほしい。詳細設計と要件定義もあわせて見直すこと。`
2. `プランのうちバックログの中身をすべて直近のプランに入れて。`
3. `プランの全実施。`

勤怠アプリでは当面、テンプレート標準の `docs/NEXT.md` ではなく、既存の `NEXT.md` を計画・実行キューの正本として扱う。意味のある作業が完了したら、必要に応じて `CHANGELOG.md` と `FINISHED.md` も更新する。

## Single Source of Truth

| 種別 | ファイル |
| --- | --- |
| AI コマンド解釈 | `ai/command-router.yml` |
| AI 運用方針 | `ai/operation-policy.yml` |
| 文書読込範囲 | `ai/context-index.yml` |
| 計画・実行キュー | `NEXT.md` |
| 完了ログ | `FINISHED.md` |
| 変更履歴 | `CHANGELOG.md` |
| 機密情報ルール | `SECURITY.md` |
| DB設計 | `docs/database-design.md` |
| Supabase手順 | `docs/supabase-setup.md` |
| LINE手順 | `docs/line-setup.md` |
| 運用・保守 | `docs/operations-maintenance.md` |
| 外部連携API仕様 | `docs/integrations/attendance-api-spec.md` |

## 開発ルール

- 変更は 1PR で理解できる粒度に分割する。
- コード変更後は原則 `npm run lint` と `npm run build` を実行する。
- SQL migration、認証、権限、環境変数、秘密情報、外部連携API、LINE webhook、GPS打刻に触れる変更は高リスクとして扱い、検証手順とロールバック方針を明記する。
- LINEでは直接打刻せず、GPS付きWeb打刻URLへ誘導する既存方針を維持する。
- 日報アプリ連携では、勤怠アプリを出退勤データの正本とし、日報アプリは読み取り専用APIから取り込む。

## 完了ゲート

- [ ] 秘密情報を読んでいない、表示していない。
- [ ] 変更に応じて `NEXT.md` / `CHANGELOG.md` / `FINISHED.md` / 関連 docs を更新した。
- [ ] 必要な検証コマンドを実行し、結果を報告した。
- [ ] `git push` やPR作成を行った場合、CIとレビュー状態を確認した。

