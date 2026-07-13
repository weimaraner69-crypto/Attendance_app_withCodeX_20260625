# Documentation Instructions

## 適用範囲

`docs/` 配下の正本ドキュメント、ルートの `NEXT.md` / `CHANGELOG.md` / `FINISHED.md` / `SECURITY.md`、および PR/Issue の記述に適用する。

## 正本運用ルール（P-030）

- 仕様変更は該当する既存 docs に反映する。
- 計画変更は `NEXT.md` を更新する。
- 完了した作業は `FINISHED.md`、意味のある変更履歴は `CHANGELOG.md` に反映する。
- 機密情報の扱いは `SECURITY.md` を正本とする。
- 会話ログを仕様の根拠にしない。決定事項は必ず正本に反映する。

## ドキュメント一覧と役割

| ファイル | 役割 | 更新タイミング |
|---|---|---|
| `NEXT.md` | 現在の計画・実行キュー | Next/Backlog 変更時 |
| `FINISHED.md` | 完了ログ | 作業完了時 |
| `CHANGELOG.md` | 変更履歴 | 意味のある変更時 |
| `SECURITY.md` | 機密情報ルール | 秘密情報・権限・認証方針変更時 |
| `docs/database-design.md` | DB設計 | テーブル・RLS・権限変更時 |
| `docs/supabase-setup.md` | Supabase手順 | migration・設定・接続手順変更時 |
| `docs/line-setup.md` | LINE手順 | LINE連携変更時 |
| `docs/operations-maintenance.md` | 運用・復旧手順 | 運用手順変更時 |
| `docs/integrations/attendance-api-spec.md` | 日報アプリ向け外部API仕様 | 外部API変更時 |

## ADR の書き方

- `docs/adr/ADR-TEMPLATE.md` に従う。
- 番号は連番（ADR-0001, ADR-0002, ...）。
- 状態は Proposed → Accepted → Deprecated の遷移。
- 見直し条件と期限を必ず明記する。

## PR 本文

- `.github/PULL_REQUEST_TEMPLATE.md` の構成に合わせる。
- すべて日本語で記述する（P-032）。
- 受入条件（AC）のチェックボックスをすべて確認する。
- 検証手順（実行コマンド）と結果を記載する。

## docs 更新の判断基準

コード変更時に以下に該当する場合は docs 更新が必要（AC-030）：

- 新しいモジュールやパッケージを追加した → 関連 docs または `README.md`
- DB構造、RLS、migrationを変更した → `docs/database-design.md` / `docs/supabase-setup.md`
- LINE連携を変更した → `docs/line-setup.md`
- 外部APIを変更した → `docs/integrations/attendance-api-spec.md`
- 実行・復旧手順が変わった → `docs/operations-maintenance.md`
- 機密情報ルールを変更した → `SECURITY.md`
- 計画の Next/Backlog を変更した → `NEXT.md`
