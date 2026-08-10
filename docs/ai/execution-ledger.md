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

### 現在状態（2026-08-10 PR #28レビュー準備・最新）

- 現在の mode: `daily_development`（PR #28完了状態同期レビュー）
- active branch: `chore/sync-pr27-completion-state`
- 直近完了 PR: PR #27（Issue #26オーナー本人向け公開パスワード再設定）を2026-08-10に `main` へマージ済み。merge commit `ed4f15c49433fa9003901193d8c4496e0a6e98af`
- 現在タスク: PR #27のマージ結果を `NEXT.md`、`FINISHED.md`、`CHANGELOG.md`、本台帳へ同期し、Issue #26をコード実装完了として閉じた。同期PR #28をDraftで作成済み
- requirements/spec: GitHub Issue #26、`docs/specs/issue-26-owner-password-recovery.md`、`docs/operations-maintenance.md`
- review baseline: 独立reviewer Kepler `977bc91d-be8f-4447-8377-dd21f76ec459`が実装head `a42a3e4297cf9acb1aeedfb4a4c8ab6500d58853`を`full_repo_agentic`で確認し、Must / Should / Nice 0件。最終証跡は `docs/ai/reviews/2026-08-09-pr27-round3-codex-kepler-final.json`
- CI状況: PR #27のquality-gate、secret-scan、review-evidence-gate、Vercel、Vercel Preview Commentsがすべて成功し、merge state CLEANでマージ済み
- 検証状況: Vitest 201件、Python 39件、policy、lint、build、空PostgreSQL 17への全migration・権限、atomicity、owner/staff全並行回帰が成功
- 次タスク: PR #28をgreen tierの独立レビューとCI成功まで進め、マージ判断を依頼する。その後、本番Supabase設定・実メール確認はユーザーの明示承認を得て別工程で実施する
- 安全床: `.env.local`を読まない。秘密情報を表示しない。本番Supabase変更、実メール送信、本番デプロイ、日報側実接続、完了同期PRの自動マージは対象外
- 最終更新: 2026-08-10

### 現在状態（2026-08-06 Issue #5詳細APIの実装準備・履歴）

- 現在の mode: `daily_development`（Issue #5の要件・詳細設計の実装準備）
- active branch: `docs/issue-5-detail-api-readiness`
- 直近完了 PR: PR #24（PR #23完了状態同期）を独立CodexレビューMust / Should / Nice 0件、GitHub Actions全3ゲート成功後に2026-08-06 `main` へマージ済み
- 現在タスク: Issue #5の詳細APIについて、既定サマリー、任意イベント、非公開情報、実装開始条件、受入条件を仕様として固定する
- requirements/spec: GitHub Issue #5、`docs/specs/issue-5-attendance-detail-api.md`、`docs/integrations/attendance-api-spec.md`
- Issue同期: GitHub Issue #5へ、既定サマリー、任意イベント、受入条件、実装開始の前提、実装時cURL例を2026-08-06に同期済み
- 次タスク: 日報側 `A-005` がNextへ昇格し、一覧へのイベント同梱の必要性・応答量と契約同期を確認できた後に、Issue #5のコード実装へ進む
- 安全床: `.env.local`を読まない。秘密情報を表示しない。本番Supabase変更、実メール送信、本番デプロイ、日報側実接続は対象外
- 最終更新: 2026-08-06

### 現在状態（2026-08-06 PR #23完了同期・履歴）

- 現在の mode: `daily_development`（PR #23完了状態同期）
- active branch: `chore/sync-pr23-completion-state`
- 直近完了 PR: PR #23（APIキー監査ログ詳細とPR #22完了状態の同期）を独立CodexレビューMust / Should / Nice 0件、GitHub Actions全3ゲート成功後に2026-08-06 `main` へマージ済み
- 現在タスク: PR #23のマージ結果を `NEXT.md`、`FINISHED.md`、`CHANGELOG.md`、`docs/ai/execution-ledger.md` へ同期する
- requirements/spec: `NEXT.md` A-000、`docs/integrations/attendance-api-spec.md`、`docs/specs/issue-6-api-key-management.md`
- 次タスク: 日報側への契約本文同期と実接続再開は、日報側 `A-005` のNext昇格後に再開する。現時点の勤怠側未完了は #5 詳細APIの要件確定待ちと、外部API・スタッフAuth・LINEの本番運用作業のみ
- 安全床: `.env.local`を読まない。秘密情報を表示しない。本番Supabase変更、実メール送信、本番デプロイ、日報側実接続は対象外
- 最終更新: 2026-08-06

### 現在状態（2026-07-25 PR #22完了同期と監査ログ詳細整備・履歴）

- 現在の mode: `daily_development`（PR #22完了同期と監査ログ詳細整備）
- active branch: `chore/sync-pr22-plan-state`
- 直近完了 PR: PR #22（オーナー向けAPIキー管理画面）を独立レビュー3件、全CI成功後に2026-07-25 `main` へマージ済み
- 現在タスク: PR #22の完了状態を `NEXT.md`、`FINISHED.md`、`CHANGELOG.md`、`docs/ai/execution-ledger.md` へ同期し、owner監査ログ画面で `external_api_key.*` の安全なフラットメタデータ表示を追加する
- requirements/spec: GitHub Issue #6、`docs/specs/issue-6-api-key-management.md`、`docs/integrations/attendance-api-spec.md`
- 実装・回帰: owner限定の発行、一覧、無効化、一度だけの平文表示、`key_hash` 非取得、無効化済みキーの認証拒否、一覧取得失敗時の操作停止、`NEXT_REDIRECT` 再送出に加え、owner監査ログ画面でキー名、許可スコープ、有効期限、有効状態の安全な詳細表示を回帰テストで固定した。
- 次タスク: 日報側への契約本文同期と実接続再開は、日報側 `A-005` のNext昇格後に再開する。現時点の `A-000` 未完了は #5 詳細APIと本番運用作業のみ
- 安全床: `.env.local`を読まない。秘密情報を表示しない。本番Supabase変更、実メール送信、本番デプロイ、日報側実接続、PRマージは対象外
- 最終更新: 2026-07-25

### 現在状態（2026-07-23 Issue #6 APIキー管理画面・履歴）

- 現在の mode: `daily_development`（Issue #6実装）
- active branch: `agent/issue-6-api-key-management`
- 直近完了 PR: PR #21（PR #20完了同期）を独立レビュー、全CI、未解決review thread 0件で `main` へマージ済み
- 現在タスク: PR #22 Round 2のMust/Should修正とレビュー証跡をコミットし、pushする
- requirements/spec: GitHub Issue #6、`docs/specs/issue-6-api-key-management.md`、`docs/integrations/attendance-api-spec.md`
- 実装・回帰: owner認可、組織境界、監査ログの非露出、JST期限、一覧取得失敗の操作停止をActionテストで確認。SSRスモークでダミーownerのフォーム、必要6列、無効化導線、再表示不可表示、取得失敗表示を確認した。
- 次タスク: 修正push後にRound 3の独立repo-aware review、CI、release-manager判定へ進む
- 安全床: `.env.local`を読まない。秘密情報を表示しない。本番Supabase変更、実メール送信、本番デプロイ、日報側実接続、PRマージは対象外
- 最終更新: 2026-07-24（Round 2 Must/Should修正・再検証済み、push待ち）

### 現在状態（2026-07-23 PR #20完了同期・履歴）

- 現在の mode: `daily_development`（PR #20完了同期）
- active branch: `agent/sync-pr20-plan-state`
- 直近完了 PR: PR #20（スタッフAuth運用フォローアップ）を独立レビュー、全CI、未解決review thread 0件で `main` へマージし、Issue #16はclosed
- 現在タスク: PR #20の完了状態を `NEXT.md`、`FINISHED.md`、`CHANGELOG.md`、親Issue #1へ同期する
- 次タスク: Issue #6のオーナー向けAPIキー管理画面。日報側A-005の実装を待たず、勤怠側単独で要件・設計・実装・回帰テストを進める
- 安全床: `.env.local`を読まない。秘密情報を表示しない。本番Supabase変更、実メール送信、本番デプロイ、日報側実接続は対象外
- 最終更新: 2026-07-23

### 現在状態（2026-07-23 Issue #16スタッフAuth運用改善・履歴）

- 現在の mode: `daily_development`（Issue #16実装）
- active branch: `fix/issue-16-staff-auth-followups`
- 直近完了 PR: PR #19（外部APIレート制限・アクセスログ）を独立レビュー、全CI、release-manager承認後に `main` へマージし、Issue #7はcompletedでクローズ済み
- 現在タスク: PR #20 Round 3のMust 3件・Should 2件と、例外後独立確認で追加検出したMust 1件をオーナー承認の例外として全修正。migration transaction・書込みロック、グローバルpreflight、遅延Auth整合性制約、リンク済みprofileのactive保証、権限・SQLSTATE・敗者状態・rollback回帰を追加
- requirements/spec: `README.md`、Issue #16、`docs/specs/issue-16-staff-auth-followups.md`、`docs/implementation-decisions.md` A-001
- pre-PRレビュー: 独立security/reliability reviewerのMust 3件、Should 2件を確認。フォーム誤認1件は別formで非再現と確認してSSR回帰を追加し、招待競合、Auth実体照合、重複検査、完了証跡を修正。独立completion auditorの全ACはSATISFIEDで、検証証跡とruntime smoke範囲を文書化
- review baseline: PR #20初回head `cd1c728da0b4806cd52454578a1c9fa76b4e4b26`、fingerprint `sha256:ece59e2dec03b7c253785443cf46867090b08211d511d3c3fcaf4a265846f919` を独立reviewer Ramanが`full_repo_agentic`で確認。Must 1件・Should 2件を全て修正
- 検証: Python 38件、Vitest 102件、lint、build、空のPostgreSQL 16への全migration、失敗時完全rollback、migration中書込み待機、Auth/profile/claim整合性、権限、6系統の並行競合と敗者状態が成功
- Round 1修正push: commit `b27fdb89ca29026a7afd2e7bdd8ad563b3cfa6ab`、fingerprint `sha256:fe3a551df40080eecff2f66083d03d56605a717c8121a2fb34b422a6777025d6`。quality-gateとsecret-scanは成功し、review-evidence-gateはRound 2証跡待ち
- Round 2レビュー: 独立reviewer GalileoがMust 0件、Should 3件、Nice 1件を提示。既存データpreflight、両方向・staff同士の並行回帰、index検索式、ledger状態を修正し、空DB適用で検出したPL/pgSQL変数衝突とclaim解放時のCHECK違反も修正済み
- Round 3レビュー: 独立reviewer MaxwellがMust 3件・Should 2件を実DB再現。`DEC-20260723-001`の例外承認に基づき全件を修正し、専用PostgreSQL回帰を通過
- 例外後独立確認: 独立reviewer Huygensが元のRound 3指摘5件の修正を確認し、リンク済みstaff profileを非activeへ変更できるMust 1件を追加検出。migration preflightとprofile更新triggerで拒否し、専用PostgreSQL回帰を通過
- 例外後最終確認: head `acec23e3caa52012e95d873c0a08e296e5035272`、tree `f2d64e9e5866dfd2026e8723b2ffbbb48bb57bd6`、fingerprint `sha256:9e722b764ddf45424f1986cd67df467a33dbfde46a9d7cc8e0ece28a6c4f7b5c` を同一reviewer Huygensが再確認し、Must 0件・Should 0件・Nice 0件
- 次タスク: 最終文書同期後のheadへ証跡を固定し、CI、PR受入条件同期、release-manager判定へ進む
- レビュー条件: 認証・監査境界を含むred tierとして、独立peerとpush後`full_repo_agentic`レビュー、専用回帰テストを必須とする
- 安全床: `.env.local`を読まない。秘密情報を表示しない。本番Supabase変更、実メール送信、本番デプロイ、日報側実接続は対象外
- 最終更新: 2026-07-23

### 現在状態（2026-07-16 Issue #7レート制限・アクセスログ実装・履歴）

- 現在の mode: `daily_development`（Issue #7実装）
- active branch: `feat/issue-7-external-api-rate-limit`
- 直近完了 PR: PR #18（PR #15完了記録整合）を独立レビュー、全CI成功、未解決レビュー0件で `main` へマージし、Issue #13をcompletedでクローズ済み
- 現在タスク: PR #19の独立Round 1レビュー5件を全て反映し、Python 37件、Vitest 72件、policy、lint、build、空の一時PostgreSQLへの全migration・旧窓・権限・429集約・61並行回帰が成功。修正コミットとpushを行う
- review baseline: PR #19初回head `897a9491dfa76685e2f0bd8ab341a03e1144d9d7` を独立reviewer Noetherが `full_repo_agentic` で確認し、Must 2件・Should 3件を提示。全件を修正して別reviewer/sessionのRound 2へ進む
- 次タスク: Round 1修正の全品質ゲート、push、独立Round 2レビューと証跡JSON、CI成功・未解決0件を確認後にIssue #16へ進む
- レビュー条件: 外部API・migration・workflowを含むred tierとして `full_repo_agentic` 独立レビューと専用PostgreSQL/契約テストによる二重確認を必須とする
- 安全床: `.env.local`を読まない。秘密情報を表示しない。本番Supabase適用、日報側実接続、本番デプロイ、実店舗データ投入、LINE本番設定、Go-Liveは対象外
- 最終更新: 2026-07-16

### 現在状態（2026-07-16 PR #15完了・Issue #7着手準備・履歴）

- 現在の mode: `daily_development`（PR #15完了同期）
- active branch: `chore/finalize-pr15-records`
- 直近完了 PR: PR #15（A-001スタッフAuth招待・初回設定・再設定）を独立レビュー3件、全CI成功、未解決レビュー0件で `main` へマージ済み
- 現在タスク: `NEXT.md`、`CHANGELOG.md`、`FINISHED.md`、Issue #13をPR #15の完了状態へ同期する
- 次タスク: 同期PR完了後、Issue #7のAPIキー単位レート制限と外部APIアクセスログへ着手する。その後はIssue #16、Issue #6の順とする
- レビュー条件: 実装担当から独立したCodex / Claudeのrepo-aware reviewを必須とし、Copilotは任意の追加レビューとする
- 安全床: `.env.local`を読まない。秘密情報を表示しない。本番Supabase設定、実メール送信、日報側実接続、本番デプロイ、実店舗データ投入、Go-Liveは対象外
- 最終更新: 2026-07-16

### 現在状態（2026-07-16 PR #15最新化・レビュー再開・履歴）

- 現在の mode: `daily_development`（Issue #13レビュー再開）
- active branch: `feat/issue-13-staff-invitations`
- 直近完了 PR: PR #17（独立AIレビュー運用改定）を独立レビュー・CI成功後に `main` へマージ済み
- 現在タスク: PR #15へ最新`main`を取り込み、Round 1・2とRound 3のMust（一時AuthセッションCookie迂回、intent発行競合、実Postgres検証不足、303 PRG、旧intent残留）を修正。変更したRLS全7群の実DB組織分離も追加検証済み
- review baseline: レビュー修正のpush後に、別の独立reviewer/session、`head_sha`、diff fingerprint、context modeを新しい証跡JSONへ固定する
- 次タスク: Round 3 Must修正後の現headに限定したpost-cap独立確認を行い、証跡JSONとCIを完了する
- レビュー条件: Copilotは任意。実装担当から独立したCodex / Claudeの`full_repo_agentic`レビューと、専用認証回帰テストによる二重確認を必須とする
- 安全床: `.env.local`を読まない。秘密情報を表示しない。本番Supabase設定、実メール送信、日報側実接続、本番デプロイ、実店舗データ投入、Go-Live、PRマージは対象外
- 最終更新: 2026-07-16

### 現在状態（2026-07-14 A-001スタッフAuthレビュー対応・履歴）

- 現在の mode: `daily_development`（Issue #13実装）
- active branch: `feat/issue-13-staff-invitations`
- 直近完了 PR: PR #14（計画・Issue整合）をCopilotレビュー、CI成功後に `main` へマージ済み
- 現在タスク: PR #15 Copilot Round 2の5指摘（LIKE用変数名2件、リンク内ボタン3件）と同種の横断検出箇所を修正し、フル品質ゲートを再実行中
- review baseline: Round 2修正コミットをpushし、Copilot Round 3を依頼した時点のPR head SHAを基準とする
- 次タスク: Round 2修正をpush後に5スレッドへ返信・resolveし、最終Round 3レビューとCIを確認する
- レビュー条件: `.github/instructions/review-loop.instructions.md` の最大3ラウンドに従う
- 安全床: `.env.local` を読まない。秘密情報を表示しない。Supabase本番設定、実メール送信、日報側実接続、本番デプロイ、実店舗データ投入、Go-Liveは対象外
- 最終更新: 2026-07-14

### 現在状態（2026-07-14 独立AIレビュー運用改定・履歴）

- 現在の mode: `governance_change`
- active branch: `chore/independent-ai-review-policy`
- 直近完了 PR: PR #14（計画・Issue整合）をレビュー・CI成功後に `main` へマージ済み
- 現在タスク: Copilot 契約上限に依存しない独立AIレビュー運用への改定
- review baseline: PR作成後の `head_sha`、diff fingerprint、独立 reviewer/session を証跡JSONに記録する
- 次タスク: 独立 Codex / Claude repo-aware review、CI、release-manager判定の完了後にマージ判断へ進む
- レビュー条件: Copilotは任意。実装担当から独立した Codex / Claude repo-aware review と機械可読証跡を必須とする
- 安全床: `.env.local` を読まない。秘密情報を表示しない。アプリ機能、本番DB、外部サービスは変更しない
- 最終更新: 2026-07-14

### 現在状態（2026-07-14 計画・Issue整合・履歴）

- 現在の mode: `daily_development`（計画・Issue整合）
- active branch: `chore/align-plans-and-issues`
- 直近完了 PR: PR #12（A-006/A-007完了同期）をCopilotレビュー、CI成功後に `main` へマージ済み
- 現在タスク: GitHub Issue #1〜#7、外部API契約、`NEXT.md` の実装状態同期とA-001 Issue #13の起票
- review baseline: Round 1レビュー依頼時のhead SHA `789f16ec3fed3ebe47cc5b71a1e0a9c31026cd5b`
- 次タスク: PRレビュー完了後、Issue #13のPR 1「招待と安全な紐付け」へ着手する
- レビュー条件: PR作成後にCopilotレビューを依頼し、到着確認、対応ラウンド、Round 3後の扱いは `.github/instructions/review-loop.instructions.md` に従う
- 安全床: `.env.local` を読まない。秘密情報を表示しない。日報側への仕様本文同期、実接続、本番デプロイ、実店舗データ投入、LINE本番設定、Go-Liveは対象外
- 最終更新: 2026-07-14

### 現在状態（2026-07-13 A-006/A-007本番検証完了・履歴）

- 現在の mode: `daily_development`（ユーザー指定の複数PR実行計画）
- active branch: `chore/finalize-advisor-rollout`
- 直近完了 PR: PR #10（計画整合）とPR #11（Performance Advisor最適化・テストCI）をCopilotレビュー、CI成功後に `main` へマージ済み
- 現在タスク: A-006本番適用結果、A-007 CI完了、GitHub Issue #2〜#4の状態同期を完了し、完了同期PRを準備中
- review baseline: 完了同期PR作成時のhead SHAを設定する
- 次タスク: 完了同期PRのレビュー完了後、A-001スタッフAuth招待・紐付け・パスワード再設定へ着手する
- レビュー条件: PR作成後にCopilotレビューを依頼し、到着確認、対応ラウンド、Round 3後の扱いは `.github/instructions/review-loop.instructions.md` に従う
- 安全床: `.env.local` を読まない。秘密情報を表示しない。スタッフRLS fixtureはトランザクション内でロールバック済み。本番デプロイ、実店舗データ投入、Go-Liveは対象外
- 最終更新: 2026-07-13

### 現在状態（2026-07-13 日報連携保留後の計画整合・履歴）

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
