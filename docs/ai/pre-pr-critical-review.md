# PR 前批判レビュー

PR 作成前の spec、security、reliability 観点のレビュー結果を記録します。方針は `ai/pre-pr-review-policy.yml` を正本とします。

## 記録テンプレート

- 対象: PR または変更概要
- 実施日:
- 実施者 / provider:
- 確認した文書・差分:
- 実行した検証:
- Must:
- Should:
- Nice:
- 残リスク:
- 結論:

## 2026-07-14 A-001スタッフAuth招待・初回設定・再設定

- 対象: Issue #13のオーナー起点のAuth招待、安全なスタッフ紐付け、初回パスワード設定、再設定
- 実施日: 2026-07-14
- 実施者 / provider: Codex
- 確認した文書・差分: Issue #13、`NEXT.md`、認証セッション、スタッフ管理画面、Auth操作サービス、初回設定画面、回帰テスト、運用文書
- 実行した検証: Python 10件、Vitest 33件、policy check、lint、build、`git diff --check`、`/auth/staff-password` のデスクトップ/375px幅runtime smoke
- Must: 0件。発見した重複確認クエリエラー時のfail-openを修正し、データ取得失敗時は招待を中止するテストを追加済み
- Should: 0件。手動Auth UUIDを廃止し、他組織・他ロール・無効・重複・紐付け済みを拒否し、部分失敗の補償削除も検証済み
- Nice: ステージング/本番反映前にSupabase AuthのRedirect URLsを設定し、実メールで初回設定・再設定を確認する
- 残リスク: 本番運用作業は認可範囲外のため、Supabaseの許可URL設定と実メールのend-to-end確認は未実施。コードは無効・期限切れセッションをfail-closeする
- 結論: PR作成可。本番Supabase設定、実メール送信、本番デプロイは本PRで行わない

## 2026-07-13 A-006/A-007

- 対象: Performance Advisor最適化マイグレーション、自動テスト、CIゲート
- 実施日: 2026-07-13
- 実施者 / provider: Codex
- 確認した文書・差分: `NEXT.md`、Advisor全件判断、RLSマイグレーション、外部API・打刻・GPS・認証テスト、CI workflow
- 実行した検証: Python 10件、Vitest 20件、policy check、lint、build、`git diff --cached --check`
- Must: 0件
- Should: 0件
- Nice: 本番適用後のロール別スモークテストとAdvisor再実行を別工程で実施する
- 残リスク: SQLは本番未適用。未使用インデックス統計は運用量と統計リセット時刻で変動するため、30日以上観測して再評価する
- 結論: PR作成可。本番DB変更と未使用インデックス削除は本PRで行わない
- 完了追跡: PR #11のレビュー・CI完了後、2026-07-13に別工程で本番適用と4ロールのRLSスモークを実施。Performance AdvisorはErrors 0、Warnings 0、Info 42となり、未使用インデックスの観測リスクだけを継続する
