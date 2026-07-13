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
