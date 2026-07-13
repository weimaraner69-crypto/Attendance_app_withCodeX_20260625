# Copilot Repository Instructions

このファイルは GitHub Copilot 向けの入口である。詳細な AI 運用ルールは `ai/*.yml` を正本とし、勤怠管理アプリ固有のルールは `AGENTS.md` と既存ドキュメントを優先する。

## 第一目的

店舗スタッフの出退勤、休憩、シフト、打刻修正申請、管理者確認、LINE連携、日報管理アプリ向け外部APIを、安全に実運用できる勤怠管理アプリとして育てる。

## 最優先ルール

- PRタイトル、PR本文、Issue本文、レビューコメント、docs更新要約は日本語で書く。
- `.env.local` の値を読まない、表示しない、ログやPRやIssueへ転記しない。
- 秘密情報へのアクセスが必要な場合は、値を表示しない確認方法を提示し、ユーザーの明示許可を得る。
- 機密情報の正本は `SECURITY.md`。
- 既存の未コミット変更を無断で revert、上書き、stage しない。

## AI Operating Model

- コマンド分類は `ai/command-router.yml` を使う。
- 文書読込範囲は `ai/context-index.yml` に従う。
- 当面の計画・実行キュー正本は `NEXT.md` とする。
- 完了した作業は必要に応じて `FINISHED.md`、意味のある変更は `CHANGELOG.md` に反映する。

## 開発ルール

- コード変更後は原則 `npm run lint` と `npm run build` を実行する。
- SQL migration、認証、権限、環境変数、秘密情報、外部連携API、LINE webhook、GPS打刻に触れる変更は高リスクとして扱う。
- LINEでは直接打刻せず、GPS付きWeb打刻URLへ誘導する。
- 日報アプリ連携では、勤怠アプリを出退勤データの正本とし、日報アプリは読み取り専用APIから取り込む。

## PRフロー

- PR本文は `.github/PULL_REQUEST_TEMPLATE.md` に合わせる。
- 変更範囲、検証結果、残リスク、ロールバック方針を明記する。
- 秘密情報や実データが混入していないことを確認する。

