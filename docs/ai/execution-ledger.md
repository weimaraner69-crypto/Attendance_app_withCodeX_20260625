# Execution Ledger

次の AI セッションが会話履歴に依存せず再開できるように、実行状態を記録する。長時間セッションで compact（会話圧縮）が発生しても、この ledger と `.github/full-plan-execution.flag` を読み直せば作業状態を復旧できる。

## 記入フォーマット

各エントリは「## 現在状態（&lt;日付&gt; &lt;短い要約&gt;・最新）」の見出しで追加し、直近のものを一番上に置く。新しいエントリを追加したら、直前まで「最新」だった見出しは「・履歴」に書き換えて残す（削除しない）。

エントリに含める項目の目安:

- 現在の mode: 実行中のコマンド/モード（`daily_development` / `execute_current_queue` 等）
- active branch: 作業中のブランチ名
- 直近完了 PR: PR 番号・要約・レビュー対応状況
- 次タスク: 次に着手するタスク ID と概要
- 安全床: 変更していない安全制約（hard_block 等）の確認
- 最終更新: 日付

## 記録

### 現在状態（2026-07-13 日報連携保留後の計画整合・最新）

- 現在の mode: `daily_development`（ユーザー指定の複数PR実行計画）
- active branch: `perf/supabase-advisor-and-test-gates`
- 直近完了 PR: PR #10（計画整合、Copilot再レビューで新規指摘なし、CI成功、マージ待ち）
- 現在タスク: A-006 Performance Advisor最適化とA-007テスト・CI強化の積み上げPR実装
- review baseline: PR作成時のhead SHAを設定する
- 次タスク: A-006/A-007のローカル検証後、PR作成とCopilotレビュー
- レビュー条件: PR作成後にCopilotレビューを依頼し、到着確認、対応ラウンド、Round 3後の扱いは `.github/instructions/review-loop.instructions.md` に従う
- 安全床: `.env.local` を読まない。秘密情報を表示しない。破壊的DB操作、本番運用準備、自動マージは対象外
- 最終更新: 2026-07-13

以下は記入例（架空の一般例）である。運用開始後はこの例を残したまま、実際のセッション状態を追記する。

### 現在状態（2026-01-01 サンプルタスク実装・履歴）

- 現在の mode: `execute_current_queue`（`NEXT.md` の Next タスクを実行中）
- active branch: `feat/sample-task-001`
- 直近完了 PR: なし（本タスクが初回実装）
- 次タスク: 実装完了後、テスト作成 → ローカル CI 確認 → PR 作成
- 安全床: 秘密情報の取り扱い（P-002）・`main` 直接コミット禁止に変更なし
- 最終更新: 2026-01-01
