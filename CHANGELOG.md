# 変更ログ

変更を元に戻したい場合の参照用ログです。
各エントリには「何を・なぜ変更したか」と「影響ファイル」を記録します。

---

## [2026-07-16] A-001スタッフAuth運用とアクセシビリティを改善

### 変更

- Auth紐付け済みスタッフのメールを読み取り専用表示にし、直接POSTでも現在メールと`auth_user_id`が一致する場合だけ他項目を更新する二重防御を追加。
- 招待開始後のメール変更を楽観ロックで検出し、古いメールで作成したAuthユーザーを紐付けず補償削除するように変更。
- パスワード再設定前にSupabase Authの実ユーザーID・メールまで照合し、未紐付けメールの作成・更新時には既存profileと同一組織staffの重複を拒否。
- push後独立レビューを受け、正規化メールのprivate claim表、DBトリガー、service role限定profile作成RPCへ重複検査を移し、旧・新メールの同時POSTをトランザクション内で直列化。
- Round 2レビューを受け、既存データ競合の値非表示preflightと両方向・staff同士の並行回帰を追加し、空DB適用で検出したPL/pgSQL変数衝突とclaim解放時のCHECK違反を修正。
- Round 3レビューのMust/Shouldをオーナー承認の例外として全対応し、migration全体のtransaction化・書込みロック、グローバル重複preflight、遅延Auth整合性制約、権限・SQLSTATE・敗者状態・失敗時rollback回帰を追加。
- 招待・再設定メールの送信後に監査ログinsertがerrorまたは例外になった場合、送信失敗と混同せず専用の部分成功状態を返すように変更。
- 招待・再設定ボタンのaccessible nameへ対象スタッフ名を追加し、成功結果を`role=status`、失敗・部分成功を`role=alert`で通知。
- 純粋関数とReact SSRで、メール不変条件、招待競合、Auth実体不一致、監査失敗、read-only表示、live regionを回帰テストへ固定。
- 実PostgreSQLで全migration、Auth削除時のprofile補償削除、スタッフメール更新とprofile作成の並行競合を検証。
- profile作成・staff紐付け・Auth補償削除の通信例外も中途状態を残さない結果コードへ正規化。

### 影響ファイル

- `src/app/(authenticated)/owner/staff/page.tsx`
- `src/lib/auth/staff-auth.ts`
- `src/lib/auth/staff-email-update.ts`
- `src/components/staff/StaffAuthStatus.tsx`
- `src/components/staff/StaffEmailInput.tsx`
- `docs/specs/issue-16-staff-auth-followups.md`
- `NEXT.md`
- `FINISHED.md`

## [2026-07-16] A-000 外部APIのレート制限とアクセスログを実装

### 追加

- APIキー単位で固定1分窓60件を原子的に数えるPostgreSQL関数とサーバー専用カウンターテーブルを追加。
- 正常・エラー・429・例外へ共通レート制限ヘッダーを付与し、61件目以降を `429 RATE_LIMITED` で拒否するリクエストラッパーを追加。
- APIキー解決後の応答について、キーID、エンドポイントのパス、HTTP状態、時刻だけを保存する `external_api_access_logs` を追加。
- ログ保存失敗でAPI本体を壊さない回帰テスト、実PostgreSQLの境界・権限・並行更新テストを追加。
- pre-PRレビュー指摘を受け、認証処理自体の例外も制御済み500とfail-closedヘッダーへ統一し、並行テストを61件の許可60・拒否1の直接確認へ強化。
- 独立Round 1レビュー指摘を受け、遅延した旧窓によるカウンター巻き戻りを防止し、カウンターを61で飽和。429時の組織取得・`last_used_at` 更新を省略し、429ログをキー・パス・窓ごとに集約した。
- `GET` / `HEAD` 以外も共通ガード経由の405へ統一し、アクセスログ待機を250msで打ち切るようにした。権限マトリクス、旧窓、ログ集約、未対応メソッドの回帰テストを追加。

### 影響ファイル

- `supabase/migrations/20260716055206_external_api_rate_limit_access_logs.sql`
- `src/lib/external-api/request.ts`
- `src/app/api/external/v1/**/route.ts`
- `ci/test_external_api_rate_limit_postgres.sql`
- `ci/test_external_api_rate_limit_concurrency.sh`
- `.github/workflows/ci.yml`
- `docs/integrations/attendance-api-spec.md`
- `NEXT.md`
- `FINISHED.md`

## [2026-07-16] PR #15の完了状態と次の実行順を同期

### 変更

- スタッフAuth招待・初回設定・再設定のPR #15が、独立Codexレビュー3件と全GitHub Actions成功後に `main` へマージされたことを記録。
- A-001を「コード実装完了・本番運用設定待ち」へ更新し、本番Supabaseマイグレーション、Auth URL・Email Templates設定、実メール確認を保留工程として維持。
- 次の実行順を、外部APIの #7 レート制限・アクセスログ、A-001フォローアップ #16、#6 APIキー管理の順に固定。
- 日報アプリとの実接続、#5 勤怠詳細API、LINE運用設定・実機確認は引き続き保留。

### 影響ファイル

- `NEXT.md`
- `FINISHED.md`
- `docs/ai/execution-ledger.md`

## [2026-07-16] A-001 招待・再設定リンクをSSR/PKCE対応へ修正

### 修正

- Supabase Authのinvite/recoveryメールを、`token_hash`をサーバー検証する `/auth/confirm` へ統一し、メールリンクスキャナがGETだけでトークンを消費しない確認POSTを追加。
- 検証成功時だけ、Authユーザーと同じ組織の有効なstaff紐付けを確認し、DBにハッシュだけを保存する10分有効・単回利用のHttpOnly設定権限を発行。
- `verifyOtp` をCookie/storageに永続化しないリクエスト内専用Supabaseクライアントで実行し、callback用Authセッションをブラウザへ発行しない構成へ変更。
- 確認POST後の正常・異常redirectを303 See Otherに固定し、遷移先のパスワード設定画面へGETで移動するPRGフローを保証。
- 確認POST開始時に古いpassword intent Cookieを必ず破棄し、cross-origin、OTP、identity、DB発行のいずれかが失敗しても別ユーザーの旧intentへフォールバックしないよう修正。
- intent発行はadvisory lock付きDB関数と未消費 `user_id` 部分一意索引で原子化し、パスワード更新はDB上の設定権限を原子的に消費した1リクエストだけがAdmin APIで実行できるよう変更。
- スタッフセッション解決へ `staff.organization_id = user_profiles.organization_id` の境界条件を追加。
- `staff.auth_user_id` と組織の整合性を複合外部キーで固定し、staff本人参照を行うRLSに組織照合を追加。
- Supabaseのinvite/recoveryメールテンプレートを `supabase/templates/` へ追加。
- token検証、セッション非永続化、同時発行/消費、リンクスキャナ、RLS/DB制約、Auth/組織削除を専用Vitestと実Postgres CIで固定。

### 影響ファイル

- `src/app/auth/confirm/page.tsx`
- `src/app/auth/confirm/complete/route.ts`
- `src/app/auth/staff-password/page.tsx`
- `src/app/api/auth/staff-password/route.ts`
- `src/lib/auth/staff-auth-confirmation.ts`
- `src/lib/auth/staff-password-intent.ts`
- `src/lib/auth/staff-password-update.ts`
- `src/lib/supabase/transient-auth.ts`
- `src/lib/auth/session.ts`
- `ci/test_staff_auth_postgres.sql`
- `.github/workflows/ci.yml`
- `next.config.mjs`
- `supabase/migrations/20260716034432_secure_staff_password_intents.sql`
- `supabase/templates/invite.html`
- `supabase/templates/recovery.html`
- `NEXT.md`
- `FINISHED.md`
- `docs/implementation-decisions.md`
- `docs/operations-maintenance.md`
- `docs/ai/execution-ledger.md`

## [2026-07-14] PRレビューをプロバイダー非依存に変更

### 変更

- push後の必須ゲートを、実装担当から独立した Codex / Claude repo-aware review へ変更。
- Copilotレビューは利用可能時の任意の追加レビューとし、quota、422、timeout、未到着をブロッカーから除外。
- 認証、権限、Supabase / RLS、SQL / migration、外部API、秘密情報、workflow / release 変更に二重確認を必須化。
- レビューラウンド上限3回をprovider横断の合計とし、独立性と機械可読証跡をPR完了条件に追加。
- 証跡schema v2、Git差分fingerprint・変更path・riskの再計算、Round別disposition、独立reviewer検査をpolicy checkと回帰テストで必須化。
- GitHub Actionsを通常の `quality-gate` と最終 `review-evidence-gate` に分離し、証跡作成前でも独立レビューへ進める順序に変更。

### 影響ファイル

- `.github/instructions/review-loop.instructions.md`
- `.github/agents/orchestrator.agent.md`
- `.github/agents/pre-pr-critical-reviewer.agent.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/ci.yml`
- `ai/operation-policy.yml`
- `ai/coherence-workflow.yml`
- `ai/pre-pr-review-policy.yml`
- `ci/policy_check.py`
- `ci/test_policy_check.py`
- `docs/orchestration.md`
- `docs/ai/review-result.schema.json`
- `docs/ai/reviews/README.md`
- `docs/ai/pre-pr-reviews/README.md`
- `docs/ai/decision-ledger.md`
- `docs/ai/execution-ledger.md`
- `NEXT.md`
- `CHANGELOG.md`

## [2026-07-14] A-001 Copilot Round 1・2レビュー指摘を修正

### 修正

- メールの大文字小文字を無視する `ilike` 照合で、`%`、`_`、`\`をLIKE特殊文字としてエスケープし、別メールの誤一致を防止。
- スタッフパスワード設定画面のセッションAPI確認で通信例外が発生しても、確認中のまま止まらず無効リンク表示へfail-closeするよう修正。
- スタッフパスワード設定画面のSupabaseクライアントをブラウザでのみ初期化し、CIの静的事前生成が公開環境変数なしでも完了するよう修正。
- リポジトリ内の `.ilike()` と同種のセッション確認fetchを横断確認し、追加対応箇所がないことを確認。
- LIKEエスケープ後の変数名を `emailLikePattern` へ変更し、メール形式検証用の正規表現と区別。
- `Link` または通常アンカーの子に `Button` を置いていた21箇所を横断修正し、アンカーへ `buttonVariants` を直接適用してHTMLとキーボード操作の意味を正常化。

## [2026-07-14] A-001 スタッフAuth招待・初回設定・再設定を実装

### 変更

- `/owner/staff` から有効な未紐付けスタッフへSupabase Auth招待メールを送信し、Admin APIの応答IDだけで `user_profiles` と `staff.auth_user_id` を紐付けるようにした。
- 手動のAuth UUID入力欄を削除し、他組織、他ロール、無効、重複、紐付け済みの招待をサーバー側で拒否するようにした。
- DB紐付けに失敗した場合は作成直後のAuthユーザーを補償削除し、中途状態を残さないようにした。
- `/auth/staff-password` を追加し、有効な招待・再設定セッションと本人スタッフ紐付けを確認してからパスワードを設定するようにした。
- スタッフのログイン後ホームを `/stamp/mobile` へ統一した。

### 確認

- 通常招待、無効、他組織、ロール不一致、メール重複、紐付け済み、不正メール、補償削除、再設定、無効セッションを回帰テストで固定。
- 本番SupabaseのRedirect URL変更と実メール確認は、本番運用作業として今回は実施していない。

### 影響ファイル

- `src/lib/auth/staff-auth.ts`
- `src/lib/auth/staff-auth.test.ts`
- `src/app/(authenticated)/owner/staff/page.tsx`
- `src/app/auth/staff-password/page.tsx`
- `src/lib/auth/session.ts`
- `NEXT.md`
- `docs/implementation-decisions.md`
- `docs/operations-maintenance.md`
- `docs/ai/decision-ledger.md`
- `docs/ai/execution-ledger.md`
- `docs/ai/pre-pr-critical-review.md`
- `FINISHED.md`

## [2026-07-14] 計画・GitHub Issue・外部API契約を同期

### 変更

- GitHub親Issue #1を連携先 `weimaraner69-crypto/kashio-nippou-app_20260611Start`、Phase 1完了状態、Phase 2の順序、実接続再開条件へ更新。
- 完了済みIssue #2〜#4の受け入れチェックを検証実績に合わせて完了へ更新し、Issue #5〜#7へ保留・着手順を追記。
- A-001スタッフAuth運用をIssue #13として起票し、招待・安全な紐付け、初回設定・再設定、回帰テストのPR順序を確定。
- 外部API契約スナップショットを `attendance-external-v1-2026-07-14` とし、日報側の初期仕様との差分と同期条件を明文化。
- `C-004` の本番LINE設定と実機確認は、明示的な再開指示まで保留する実行計画へ更新。

### 影響ファイル

- `NEXT.md`
- `docs/integrations/attendance-api-spec.md`
- `docs/ai/decision-ledger.md`
- `docs/ai/execution-ledger.md`
- `CHANGELOG.md`
- `FINISHED.md`

## [2026-07-13] Performance Advisor最適化を本番適用

### 変更
- PR #10とPR #11を `main` へマージし、計画整合、Performance Advisor最適化、自動テスト・CIゲートを反映。
- `202607130002_performance_advisor_optimization.sql` を本番Supabaseへ適用。
- A-006とA-007を完了へ更新し、次の着手対象をA-001のスタッフAuth運用へ移行。
- 外部API Phase 1の受入条件と品質ゲート成功を根拠に、GitHub Issue #2〜#4へ完了コメントを追加してクローズ。

### 確認
- 未最適化の直接 `auth.uid()` ポリシー0件、追加対象索引の不足0件、`public` ポリシー69件を確認。
- オーナー、店長、社労士、スタッフの `authenticated` RLS読み取りが成功。スタッフfixtureはトランザクション内だけで作成し、ロールバック後に残存0件を確認。
- Performance Advisor再実行後はErrors 0、Warnings 0、Info 42。Infoはすべて未使用の非制約インデックスで、30日以上の通常運用後に再評価する。
- `.env.local` の値は読み取り・表示していない。

### 影響ファイル
- `NEXT.md`
- `FINISHED.md`
- `docs/supabase-setup.md`
- `docs/supabase-performance-advisor.md`
- `docs/ai/execution-ledger.md`
- `docs/ai/decision-ledger.md`
- `docs/ai/pre-pr-critical-review.md`
- `CHANGELOG.md`

## [2026-07-13] Performance Advisor最適化と自動テスト・CIゲートを追加

### 変更
- 本番Performance Advisorの73 Warningsと44 Infoを読み取り専用カタログクエリで全件分類。
- RLSの許可条件を維持したまま、`auth.uid()` の初期化プラン化、重複SELECTポリシーの統合、管理用 `FOR ALL` のコマンド別分割を行うマイグレーションを追加。
- 未索引外部キー13件の補助索引を追加し、未使用インデックス31件は30日以上の運用観測まで削除しない判断を記録。
- Vitestと `npm test` を導入し、外部API、Phase 1レスポンス、打刻状態遷移、GPS、認証ロールの20テストを追加。
- 存在しないカレンダー日付を外部APIが受理しないよう日付検証を厳密化。
- GitHub ActionsへSupabaseマイグレーションテストとTypeScriptテストを追加。

### 確認
- 本番Supabaseではカタログの読み取りだけを行い、マイグレーションは未適用。
- Python回帰テスト10件とTypeScriptテスト20件がローカルで成功。
- `.env.local` の値は読み取り・表示していない。

### 影響ファイル
- `supabase/migrations/202607130002_performance_advisor_optimization.sql`
- `docs/supabase-performance-advisor.md`
- `ci/test_supabase_advisor_migrations.py`
- `.github/workflows/ci.yml`
- `src/lib/external-api/*`
- `src/lib/attendance/*`
- `src/lib/utils/gpsUtils.test.ts`
- `src/lib/auth/session.test.ts`
- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `README.md`
- `NEXT.md`
- `FINISHED.md`
- `docs/supabase-setup.md`
- `docs/ai/execution-ledger.md`

## [2026-07-13] 日報連携保留後の実行計画を再構成

### 変更
- 日報管理アプリ側が本番運用準備を優先しているため、APIキー設定、マッピング、勤怠取り込み、実接続確認を日報側 `A-005` のNext昇格まで保留。
- 勤怠側で単独実行できる作業を、計画整合、Performance Advisor・テスト、スタッフ認証、外部API運用強化、LINE運用の順に再構成。
- スタッフのメール/パスワードログインと `/stamp/mobile` の認証必須化は実装済みとしてA-001を更新し、残作業を招待、Auth紐付け、パスワード再設定へ限定。
- `A-007 自動テスト・CI強化` を追加し、既存のAdvisorマイグレーションテスト、TypeScriptテスト、外部API契約、打刻・認証の回帰確認を実行対象にした。
- 勤怠側の外部API仕様書を契約の正本とし、日報側の初期仕様との差分を接続再開前に同期する方針を明記。
- 今回の複数PR実行とレビュー反復の認可範囲をdecision/execution ledgerへ記録。

### 影響ファイル
- `NEXT.md`
- `README.md`
- `docs/integrations/attendance-api-spec.md`
- `docs/ai/decision-ledger.md`
- `docs/ai/execution-ledger.md`
- `CHANGELOG.md`
- `FINISHED.md`

## [2026-07-13] Supabase Advisor対応のCopilotレビュー指摘を修正

### 修正
- `set_updated_at()` の `search_path` から不要な `public` を外し、`pg_catalog` のみに固定。
- 初期スキーマの `idx_line_accounts_staff` と重複する `idx_line_accounts_staff_id` の作成を削除。
- 修正前のSQLを適用済みのDB向けに、関数設定の更新と重複索引の削除を行う追補マイグレーションを追加。
- 他の追加索引について全マイグレーションの既存索引と照合し、同一キーの追加重複がないことを確認。
- `search_path` と重複索引の安全条件を固定する回帰テストを追加。
- `private` 側のRLS補助関数が存在しない環境でも、設定・権限変更をスキップしてマイグレーションを完了できるようにした。
- 2026-07-09の履歴に残っていた `set_updated_at()` の旧 `search_path` 記述を現在の実装へ合わせた。

### 本番確認
- `202607130001_supabase_advisor_review_followup.sql` を本番Supabaseへ適用。
- `set_updated_at()` の `search_path` 最小化、既存索引の保持、重複索引の削除を示す3条件がすべて `true` であることを確認。
- `.env.local` の値は読み取り・表示していない。

### 影響ファイル
- `supabase/migrations/202607090001_supabase_advisor_warnings.sql`
- `supabase/migrations/202607130001_supabase_advisor_review_followup.sql`
- `ci/test_supabase_advisor_migrations.py`
- `docs/supabase-setup.md`
- `NEXT.md`
- `FINISHED.md`
- `CHANGELOG.md`

## [2026-07-13] Supabase Advisor対応を本番適用・再検証

### 実施
- `202607090001_supabase_advisor_warnings.sql` と `202607090002_security_advisor_function_execute.sql` を本番Supabaseへ適用。
- RLS補助関数3件の配置と実行権限を確認し、ロール別のRLS読み取りをトランザクション内で検証。
- Security AdvisorとPerformance Advisorを再実行し、残件を運用記録へ反映。

### 確認
- RLS補助関数はすべて `private` にあり、`anon` は実行不可、`authenticated` はRLS評価用に実行可能。
- オーナー、店長、社労士の各ロールで、ロール判定、組織解決、組織・勤怠レコードのRLS付き読み取りが成功。
- Security AdvisorはErrors 0、Warnings 1、Info 0。残件はFreeプランでは有効化できない `Leaked Password Protection Disabled` のみ。
- Performance AdvisorはErrors 0、Warnings 73、Info 45。別作業 `A-006` として精査・最適化する。
- `.env.local` の値は読み取り・表示していない。

### 影響ファイル
- `docs/supabase-setup.md`
- `NEXT.md`
- `FINISHED.md`
- `CHANGELOG.md`

## [2026-07-09] Security Advisor の関数実行権限Warning対応を追加

### 実施
- Security Advisor に残った `Public Can Execute SECURITY DEFINER Function` / `Signed-In Users Can Execute SECURITY DEFINER Function` 6件への対応として、追加マイグレーション `202607090002_security_advisor_function_execute.sql` を作成。
- RLS補助関数 `current_user_organization_id()`、`current_user_role()`、`can_access_store(uuid)` をData API非公開の `private` スキーマへ移すSQLを追加。
- `PUBLIC` / `anon` の実行権限を外し、RLS評価に必要な `authenticated` の `USAGE` / `EXECUTE` だけを付与する構成にした。
- SQL全体をトランザクション化し、途中失敗時に権限変更だけが残らないようにした。
- `Leaked Password Protection Disabled` はDashboardのAuthentication設定で対応する項目として手順書とNEXTへ記録。Proプラン以上の機能であるため、利用できない場合はアップグレードが必要な残リスクとして扱う。

### 確認
- スクリーンショットで残WarningがSecurity Advisor 7件であることを確認。
- `.env.local` の値は読み取り・表示していない。

### 影響ファイル
- `supabase/migrations/202607090002_security_advisor_function_execute.sql`
- `docs/supabase-setup.md`
- `NEXT.md`
- `FINISHED.md`
- `CHANGELOG.md`

## [2026-07-09] Supabase Advisor Warning 対応マイグレーションを追加

### 実施
- Supabase Dashboard 上の8件のWarning対応として、追加マイグレーション `202607090001_supabase_advisor_warnings.sql` を作成。
- `public.set_updated_at()` に `search_path = pg_catalog` を明示。
- `external_api_keys`、`line_link_tokens`、`user_login_pins` に、ブラウザクライアントへ権限を付与しない明示的なdenyポリシーを追加。対象テーブルやポリシーがすでに存在する場合はスキップする。
- server-onlyテーブルのdenyポリシーを `RESTRICTIVE` とし、将来permissiveポリシーが追加されてもクライアントアクセスを許可しない構成にした。
- 外部キー参照列の補助インデックスを追加し、削除・更新時の参照確認と関連JOINを軽くするよう整理。
- `pgcrypto` 拡張を `extensions` スキーマへ移動する処理を追加。
- SQL全体をトランザクション化し、途中失敗時に部分適用を残さないようにした。
- Supabase手順書へAdvisor対応マイグレーションの適用・再確認手順を追加。

### 確認
- SQLは既存データを更新せず、関数定義、ポリシー、インデックス、拡張スキーマだけを変更する内容として確認。
- `.env.local` の値は読み取り・表示していない。
- この環境には Supabase CLI がないため、実DBへの適用とAdvisor再実行は未実施。

### 影響ファイル
- `supabase/migrations/202607090001_supabase_advisor_warnings.sql`
- `docs/supabase-setup.md`
- `NEXT.md`
- `FINISHED.md`
- `CHANGELOG.md`

## [2026-07-02] ロール選択メニューの透過表示を修正

### 修正
- 共通Selectが未定義のテーマ色 `bg-popover` などを参照し、メニュー背景が透明になる問題を修正。
- トリガーと選択メニューへ白背景、灰色の境界、影、フォーカス時の背景色を明示。
- 管理者・社労士ログイン画面で、メニュー背景が白色、不透明度1、重なり順50として表示されることを確認。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `src/components/ui/select.tsx`
- `CHANGELOG.md`

## [2026-07-02] A-001 管理ユーザーの6時間PIN再ログインを実装

### 実施概要
店長、オーナー、社労士が共用iPad等で毎回メールアドレスとパスワードを入力せずに済むよう、初回認証から6時間以内に限った4桁PIN再ログインを追加した。

### 実施
- ブラウザからアクセスできない専用テーブル `user_login_pins` へ、PINハッシュ、更新日時、失敗回数、一時ロック期限を追加するマイグレーションを作成。
- 初回メール/パスワード認証後、PIN未設定ユーザーへ4桁PIN登録画面を表示。
- PIN登録開始時にSupabase Authの最終サインインが直近5分以内であることを検証し、古いセッションからの登録を拒否。
- 同じ端末かつ6時間以内の場合、店長、オーナー、社労士のログイン画面をPIN入力へ切り替えるAPIとUIを追加。
- 6時間の端末認証と画面ロック解除を、署名付きHttpOnly Cookieで分離して管理。
- PINを5回間違えた場合の10分ロックを追加。
- `user_login_pins` はRLSを有効化し、service roleを使うサーバーだけがアクセスできる構成にした。
- 管理画面に「画面をロック」と「完全ログアウト」を追加。
- スタッフ個人スマホログインは従来のSupabase Auth方式を維持。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。
- `.env.local` の値は読み取り・表示していない。

### Supabase反映・確認
- `supabase/migrations/202607020001_privileged_login_pin.sql` をSupabase SQL Editorで適用。
- 店長、オーナー、社労士のテストAuthユーザー、`user_profiles`、PIN、テスト店舗を作成。
- 店長の店舗権限と社労士の組織権限を設定。
- 3ロールすべてでメール/パスワード認証、ロール、PINハッシュ照合、権限設定を確認。
- テスト資格情報そのものはリポジトリへ記録していない。

### 残作業
- 画面ロック、PIN解除、6時間期限、5回失敗ロック、完全ログアウトをブラウザで通し確認。

### 影響ファイル
- `supabase/migrations/202607020001_privileged_login_pin.sql`
- `src/lib/auth/device-session.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/login-response.ts`
- `src/app/api/auth/password/complete/route.ts`
- `src/app/api/auth/pin/status/route.ts`
- `src/app/api/auth/pin/setup/route.ts`
- `src/app/api/auth/pin/unlock/route.ts`
- `src/app/auth/lock/route.ts`
- `src/app/auth/logout/route.ts`
- `src/components/auth/PrivilegedLogin.tsx`
- `src/components/auth/SessionActions.tsx`
- `src/app/(authenticated)/login/page.tsx`
- `src/app/(manager)/manager/login/page.tsx`
- `README.md`
- `NEXT.md`
- `SECURITY.md`
- `FINISHED.md`
- `docs/implementation-decisions.md`

## [2026-07-02] A-000 外部連携APIのSupabase運用設定を開始

### 実施概要
日報アプリ向け外部連携APIの運用開始に向け、Supabaseへ外部APIキー認証テーブルを適用し、利用組織を登録した。

### 実施
- `supabase/migrations/202606250002_external_api_keys.sql` をSupabaseへ適用。
- `external_api_keys` テーブル、RLS、組織/有効状態索引、有効期限索引を確認。
- `organizations` に `株式会社樫尾商店`、タイムゾーン `Asia/Tokyo` を登録。
- `日報アプリ本番` APIキーを生成し、平文を表示せずmacOSキーチェーンへ保存。
- SHA-256ハッシュだけをSupabaseへ登録し、有効な `attendance:read` キーが1件あることを確認。
- `scripts/hash-external-api-key.mjs` に `--store-keychain` を追加。
- `scripts/sync-external-api-keychain.mjs` を追加し、キーチェーンの現在値からハッシュを計算してSupabaseへ同期可能にした。
- `scripts/verify-external-api-keychain.mjs` を追加し、レスポンス本文やキーを表示せずローカル外部APIを検証可能にした。
- `docs/integrations/attendance-api-spec.md` にキーチェーン保存手順を追加。
- `.env.local` はNext.jsと同期スクリプトに内部読込させ、値そのものは表示していない。

### 確認
- キーチェーン値とSupabase登録値を同期後、`/health`、`/stores`、`/staff` がHTTP 200。
- 現在は店舗・スタッフが0件のため、店舗指定が必須の `/attendance` 実データ検証は未実施。
- 初回のキーチェーン保存値不一致は、新しいキーへのローテーションとハッシュ再同期で解消。

### 未完了
- 日報アプリ側への接続設定。
- 日報アプリ側からの実接続検証。
- 店舗登録後の `/attendance` 実データ検証。

### 計画更新
- `NEXT.md` に、店舗・スタッフ・完了済み勤怠の準備、日報アプリのサーバー環境設定、4エンドポイントの確認を順序付きの次作業として追加。
- APIキーを画面、ログ、Gitへ表示しないことを完了条件へ含めた。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `scripts/hash-external-api-key.mjs`
- `scripts/sync-external-api-keychain.mjs`
- `scripts/verify-external-api-keychain.mjs`
- `package.json`
- `docs/integrations/attendance-api-spec.md`

## [2026-06-30] C-005 運用・保守手順を整理

### 実施概要
本番運用に必要な環境変数、エラー監視、バックアップ/復旧、権限・個人情報の確認観点を、値を表示しない運用前提で整理した。

### 追加
- `docs/operations-maintenance.md`
  - 本番環境変数、公開/サーバー専用の区分、必須タイミングを一覧化。
  - `.env.local` や各種シークレットの値を表示しない確認方針を整理。
  - デプロイ前チェック、エラー監視レベル、初期アラート基準を追加。
  - Supabase PostgreSQLを正本とするバックアップ/復旧方針を追加。
  - ロール別権限確認、個人情報として扱うデータ、定期運用チェックを追加。

### 変更
- `README.md`
  - 関連ドキュメントに運用・保守手順を追加。
- `NEXT.md`
  - C-005を完了扱いに更新。
  - 実運用前に残るC-004/A-000の外部設定・検証項目を明記。
- `FINISHED.md`
  - `C-005 運用・保守` の完了ログを追加。

### 確認
- `.env.local` の値は読み取り・表示していない。
- C-005の4項目（環境変数、監視、バックアップ/復旧、権限・個人情報）を運用文書へ反映。

## [2026-06-29] C-004 LINE連携のコード実装

### 実施概要
LINE Messaging APIのWebhook、スタッフ本人連携、シフト確認・提出導線、GPS打刻導線、アプリ内通知連動のPush送信を実装した。LINE内で直接打刻せず、既存の認証・GPS検証付きWeb画面を利用する。

### 追加
- `supabase/migrations/202606290004_line_integration.sql`
  - ハッシュ化連携トークンとLINE通知配信状態を追加。
- `src/lib/line/messaging.ts`
  - Webhook署名検証、Messaging API、プロフィール、連携URL処理を追加。
- `src/app/api/line/webhook/route.ts`
  - LINEコマンドとWebhookイベント処理を追加。
- `src/app/(public)/line/link/page.tsx`
  - スタッフログインを使った本人連携画面を追加。
- `docs/line-setup.md`
  - Supabase、LINE Developers、環境変数、実機確認手順を追加。

### 変更
- `src/lib/notifications/index.ts`
  - アプリ内通知保存後にLINE Push送信し、配信結果を記録。
- `src/lib/audit/format.ts`
  - LINE連携・解除の監査ログ表示名を追加。
- `src/app/(public)/stamp/mobile/page.tsx`
  - LINE連携状態、LINEからのアンカー導線、シフト提出元を追加。
- `src/app/(authenticated)/login/page.tsx`
  - スタッフログイン後の安全な内部戻り先に対応。
- `.env.example`
  - LINE用サーバー環境変数名を追加。
- `README.md` / `NEXT.md` / `FINISHED.md` / 設計文書
  - 実装方針、完了範囲、運用設定待ちを反映。

### 確認
- `npm run build` が成功。
- `.env.local` の内容は読み取り・表示していない。

### 運用開始前の残作業
- 新規マイグレーションのSupabase適用。
- LINE環境変数とLINE Developers Webhookの設定。
- LINE実機での本人連携、コマンド、Push通知確認。

### 戻し方
- `202606290004_line_integration.sql` の変更を逆順で戻すマイグレーションを作成する。
- 追加したLINE関連ファイルを削除し、通知・ログイン・スマホ画面・型定義を以前の状態へ戻す。
- `.env.example` と関連文書の今回追記分を削除する。

---

## [2026-06-27] C-001 PDF出力・C-003 監査ログ画面を実装

### 実施概要
オーナー/社労士向け月次勤怠レポートを日本語PDFとして保存できるようにした。あわせて、オーナーが重要操作の実行者、日時、対象、変更前後を確認できる監査ログ画面を追加した。

### 追加
- `src/components/reports/AttendancePdfExportButton.tsx`
  - 表示中の条件・集計・勤怠一覧を画像化し、複数ページ対応のPDFとして保存。
- `src/app/(authenticated)/owner/audit-logs/page.tsx`
  - 監査ログを期間・操作で絞り込み、変更前後を一覧表示。
- `src/lib/audit/format.ts`
  - 監査操作名、項目名、値の共通表示処理を追加。

### 変更
- `src/components/reports/AttendanceReportView.tsx`
  - オーナー/社労士共通レポートへPDF出力ボタンを追加。
- `src/app/(authenticated)/owner/page.tsx`
  - 監査ログ画面への導線を追加。
- `src/app/(manager)/manager/[storeId]/requests/page.tsx`
  - 承認/却下ログへ変更前後を保存し、監査ログ保存失敗時はエラーとして扱う。
- `NEXT.md` / `FINISHED.md`
  - C-001〜C-003の完了内容と、LINE通知をC-004で扱う境界を記録。

### 確認
- `npm run build` が成功。
- `.env.local` の内容は読み取っていない。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/components/reports/AttendancePdfExportButton.tsx`
- `src/components/reports/AttendanceReportView.tsx`
- `src/lib/audit/format.ts`
- `src/app/(authenticated)/owner/audit-logs/page.tsx`
- `src/app/(authenticated)/owner/page.tsx`
- `src/app/(manager)/manager/[storeId]/requests/page.tsx`

### 戻し方
- 追加したPDF出力部品、監査ログ画面、監査表示処理を削除する。
- レポート、オーナーダッシュボード、打刻修正申請画面から今回の追加箇所を削除する。
- `NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-27] 機密情報取り扱いルールを明文化

### 実施概要
`.env.local` の値や各種機密情報を誤って表示しないため、内容を読み取らないことと、必要なアクセスの前にユーザーの明示的な許可を得ることを運用ルールとして追加した。

### 追加
- `SECURITY.md`
  - `.env.local`、APIキー、個人情報の取り扱いと漏えい時の対応を追加。

### 変更
- `README.md` / `NEXT.md`
  - `.env.local` を読み取り・表示しないルールと `SECURITY.md` への参照を追加。
- `docs/supabase-setup.md`
  - 値を表示しない確認手順と事前確認ルールを追加。
- `NEXT.md` / `FINISHED.md`
  - 通知マイグレーションの実DB適用とSupabase Secret key / Service role keyのローテーション完了を記録。

### 確認
- `.env.local` の内容を読み取らず、Git管理対象外であることを確認。
- Git追跡対象のMarkdownへ実キーやシークレット値を追加していないことを確認。

### 影響ファイル
- `SECURITY.md`
- `README.md`
- `NEXT.md`
- `docs/supabase-setup.md`
- `CHANGELOG.md`
- `FINISHED.md`

### 戻し方
- `SECURITY.md` を削除する。
- `README.md`、`NEXT.md`、`docs/supabase-setup.md`、`CHANGELOG.md`、`FINISHED.md` の今回追記分を削除する。

---

## [2026-06-26] C-002 アプリ内通知を実装

### 実施概要
スタッフ向けのアプリ内通知テーブルと通知一覧を追加し、打刻修正申請の承認/却下、シフト公開、打刻漏れ通知を作成できるようにした。

### 追加
- `supabase/migrations/202606260003_notifications.sql`
  - `notifications` テーブル、インデックス、RLSポリシーを追加。
- `src/lib/notifications/index.ts`
  - 通知作成ヘルパーを追加。

### 変更
- `src/app/(public)/stamp/mobile/page.tsx`
  - スタッフ向け通知一覧を追加。
- `src/app/(manager)/manager/[storeId]/requests/page.tsx`
  - 打刻修正申請の承認/却下時に通知を作成。
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx`
  - シフト公開時に通知を作成。
- `src/app/(manager)/manager/[storeId]/page.tsx`
  - 打刻漏れ通知作成ボタンを追加。
- `src/lib/supabase/database.types.ts`
  - `notifications` テーブル型を追加。
- `NEXT.md`
  - C-002をアプリ内通知完了扱いに更新。
- `FINISHED.md`
  - `C-002 通知機能（アプリ内通知）` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `supabase/migrations/202606260003_notifications.sql`
- `src/lib/supabase/database.types.ts`
- `src/lib/notifications/index.ts`
- `src/app/(manager)/manager/[storeId]/page.tsx`
- `src/app/(manager)/manager/[storeId]/requests/page.tsx`
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx`
- `src/app/(public)/stamp/mobile/page.tsx`

### 戻し方
- `supabase/migrations/202606260003_notifications.sql` と `src/lib/notifications/index.ts` を削除する。
- 各画面から通知作成/通知一覧の追加部分を削除する。
- `src/lib/supabase/database.types.ts` から `notifications` 型を削除する。
- `NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-26] C-001 月次勤怠CSV出力を実装

### 実施概要
オーナー/社労士向けレポート画面の絞り込み条件に合わせて、月次勤怠CSVをダウンロードできるようにした。

### 追加
- `src/app/api/reports/attendance.csv/route.ts`
  - `GET /api/reports/attendance.csv` を追加。
  - オーナー/社労士ロールの認証後、`attendance_records` をCSV化。

### 変更
- `src/components/reports/AttendanceReportView.tsx`
  - 現在の絞り込み条件を引き継ぐCSV出力ボタンを追加。
- `NEXT.md`
  - C-001のCSV出力を完了扱いに更新。
- `FINISHED.md`
  - `C-001 CSV/PDF出力（CSV）` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/api/reports/attendance.csv/route.ts`
- `src/components/reports/AttendanceReportView.tsx`

### 戻し方
- `src/app/api/reports/attendance.csv/route.ts` を削除する。
- `src/components/reports/AttendanceReportView.tsx` からCSV出力ボタンを削除する。
- `NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-26] B-006 オーナー/社労士向けレポートを実データ化

### 実施概要
オーナーと社労士向けのレポート画面を `attendance_records` の実データへ接続し、月次勤怠一覧、集計カード、期間/店舗/スタッフ絞り込みを追加した。

### 追加
- `src/lib/reports/attendance.ts`
  - レポート用の期間初期値、絞り込み、勤怠取得、集計、表示整形を追加。
- `src/components/reports/AttendanceReportView.tsx`
  - オーナー/社労士共通の勤怠レポート画面を追加。

### 変更
- `src/app/(authenticated)/owner/reports/page.tsx`
  - プレースホルダーを実データレポートに置き換え。
- `src/app/(authenticated)/sr/reports/page.tsx`
  - プレースホルダーを実データレポートに置き換え。
- `NEXT.md`
  - B-006を完了扱いに更新。
- `FINISHED.md`
  - `B-006 オーナー/社労士向けレポート` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(authenticated)/owner/reports/page.tsx`
- `src/app/(authenticated)/sr/reports/page.tsx`
- `src/components/reports/AttendanceReportView.tsx`
- `src/lib/reports/attendance.ts`

### 戻し方
- `src/components/reports/AttendanceReportView.tsx` と `src/lib/reports/attendance.ts` を削除する。
- `/owner/reports` と `/sr/reports` を直前のプレースホルダー表示へ戻す。
- `NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-26] B-005 シフト希望提出を実装

### 実施概要
店長がシフト希望の募集期間を作成し、スタッフが個人スマホ画面から希望日、希望時間、不可日を提出できるようにした。店長画面では募集ごとの提出状況と希望内容を確認できる。

### 変更
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx`
  - シフト希望募集期間の作成フォームを追加。
  - 募集期間の受付中/締切切り替えを追加。
  - 募集ごとの提出人数、提出スタッフ、希望日、希望時間、不可日、メモを表示。
- `src/app/(public)/stamp/mobile/page.tsx`
  - 受付中のシフト希望募集一覧を追加。
  - スタッフが最大3件の希望日/希望時間/不可日/メモを提出できるフォームを追加。
  - 再提出時は同じ募集の既存希望を置き換えるようにした。
- `NEXT.md`
  - B-005を完了扱いに更新。
- `FINISHED.md`
  - `B-005 シフト希望提出` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx`
- `src/app/(public)/stamp/mobile/page.tsx`

### 戻し方
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx` からシフト希望募集と提出状況の追加部分を削除する。
- `src/app/(public)/stamp/mobile/page.tsx` からシフト希望提出フォームを削除する。
- `NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-26] B-004 シフト管理を実装

### 実施概要
店長が担当店舗のシフトを作成、編集、公開、取消できるようにし、スタッフが個人スマホ打刻画面で自分の公開シフトを確認できるようにした。

### 変更
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx`
  - 空状態表示を `shifts` 実データ管理画面へ置き換え。
  - 店長の担当店舗権限を確認したうえで、所属スタッフと今後31日分のシフトを表示。
  - シフト作成、編集、公開、取消の Server Action を追加。
  - シフトステータス `draft`, `published`, `confirmed`, `completed`, `cancelled` を表示/編集できるようにした。
- `src/app/(public)/stamp/mobile/page.tsx`
  - ログイン済みスタッフ本人の今後14日分の公開/確認済みシフト一覧を追加。
- `NEXT.md`
  - B-004を完了扱いに更新。
- `FINISHED.md`
  - `B-004 シフト管理` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx`
- `src/app/(public)/stamp/mobile/page.tsx`

### 戻し方
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx` を直前の空状態表示へ戻す。
- `src/app/(public)/stamp/mobile/page.tsx` から今後のシフト一覧を削除する。
- `NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-26] B-003 打刻修正申請を実装

### 実施概要
スタッフが個人スマホ打刻画面から打刻修正を申請し、店長が担当店舗の申請を承認/却下できるようにした。承認時は勤怠レコードへ反映し、承認/却下操作を監査ログへ記録する。

### 追加
- `src/app/api/attendance/requests/route.ts`
  - `POST /api/attendance/requests` を追加。
  - ログイン済みスタッフの所属店舗またはデフォルト店舗に限って、打刻修正申請を作成。

### 変更
- `src/components/stamp/CorrectionRequestForm.tsx`
  - モックの `console.log` 処理を削除し、申請APIへ接続。
  - 対象店舗、対象日、出勤時刻、退勤時刻、理由を入力できるフォームへ更新。
- `src/app/(public)/stamp/mobile/page.tsx`
  - 個人スマホ打刻画面に打刻修正申請フォームを追加。
- `src/app/(manager)/manager/[storeId]/requests/page.tsx`
  - 空状態表示を実データ一覧へ置き換え。
  - 店長の担当店舗内の `attendance_requests` を表示。
  - 承認時に `attendance_records` を作成/更新。
  - 承認/却下操作を `audit_logs` に記録。
- `NEXT.md`
  - B-003を完了扱いに更新。
- `FINISHED.md`
  - `B-003 打刻修正申請` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/api/attendance/requests/route.ts`
- `src/app/(public)/stamp/mobile/page.tsx`
- `src/components/stamp/CorrectionRequestForm.tsx`
- `src/app/(manager)/manager/[storeId]/requests/page.tsx`

### 戻し方
- `src/app/api/attendance/requests/route.ts` を削除する。
- `src/components/stamp/CorrectionRequestForm.tsx` と `/stamp/mobile` を直前状態へ戻す。
- `src/app/(manager)/manager/[storeId]/requests/page.tsx` を空状態表示へ戻す。
- `NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-25] B-002 店長ダッシュボードを実データ化

### 実施概要
デバッグ確認で残っていた固定サンプル氏名、固定時刻、固定月次サマリーを削除し、店長ダッシュボードを Supabase の実データ表示へ置き換えた。

### 変更
- `src/app/(manager)/manager/[storeId]/page.tsx`
  - Client Component のモック表示を Server Component の実データ取得へ変更。
  - `manager_store_permissions` と `stores` から担当店舗を取得。
  - `staff`, `store_staff_assignments`, `attendance_records` から当日の出勤状況を表示。
  - 出勤中、休憩中、退勤済み、未打刻の件数カードを追加。
  - 複数担当店舗がある場合の店舗切り替えボタンを追加。
  - 打刻漏れ確認用に、スタッフ別の状態、出勤、退勤、休憩、勤務、最終更新を一覧化。
- `src/app/(manager)/manager/[storeId]/requests/page.tsx`
  - 実名風の固定サンプル申請を削除し、B-003までの空状態表示に変更。
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx`
  - 実名風の固定サンプルシフトを削除し、B-004までの空状態表示に変更。
- `NEXT.md`
  - B-002を完了扱いに更新。
- `FINISHED.md`
  - `B-002 店長ダッシュボードの実データ化` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。
- Git管理対象に `.env.local` が含まれていないことを確認。
- 追跡対象ファイルに実APIキー、Secret key、Service role key の値が含まれていないことを確認。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(manager)/manager/[storeId]/page.tsx`
- `src/app/(manager)/manager/[storeId]/requests/page.tsx`
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx`

### 戻し方
- `src/app/(manager)/manager/[storeId]/page.tsx` を直前のモック表示へ戻し、`NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-25] B-001 打刻画面を店舗iPad用と個人スマホ用に分離

### 実施概要
打刻画面を実データ化し、店舗iPad打刻と個人スマホ打刻を分けた。どちらも A-005 で追加した `POST /api/attendance/stamp` へ接続した。

### 追加
- `src/components/stamp/KioskStampPanel.tsx`
  - 店舗iPad用のスタッフ選択、端末選択、PIN入力、出勤/休憩開始/休憩終了/退勤ボタンを追加。
- `src/components/stamp/MobileStampPanel.tsx`
  - 個人スマホ用の店舗選択、GPS取得、出勤/休憩開始/休憩終了/退勤ボタンを追加。
- `src/app/(public)/stamp/mobile/page.tsx`
  - ログイン済みスタッフ向けの個人スマホ打刻画面を追加。

### 変更
- `src/app/(public)/stamp/page.tsx`
  - モック店舗選択を Supabase の実店舗一覧へ置き換え。
  - 店舗iPad打刻と個人スマホ打刻の入口に整理。
- `src/app/(public)/stamp/[shopId]/page.tsx`
  - 店舗iPad用画面として実データ化。
  - 所属スタッフと有効な `kiosk_devices` を表示し、PIN付き打刻を実行。
- `src/app/(public)/stamp/[shopId]/[staffId]/page.tsx`
  - 旧スタッフ個別打刻URLを店舗iPad画面へリダイレクトするよう整理。
- `NEXT.md`
  - B-001を完了扱いに更新。
- `FINISHED.md`
  - `B-001 打刻画面の作り替え` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(public)/stamp/page.tsx`
- `src/app/(public)/stamp/[shopId]/page.tsx`
- `src/app/(public)/stamp/[shopId]/[staffId]/page.tsx`
- `src/app/(public)/stamp/mobile/page.tsx`
- `src/components/stamp/KioskStampPanel.tsx`
- `src/components/stamp/MobileStampPanel.tsx`

### 戻し方
- 追加した2つの打刻パネルと `/stamp/mobile` を削除し、`/stamp` 配下のページを直前状態に戻す。
- `NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-25] A-005 打刻APIを実装

### 実施概要
店舗iPad打刻と個人スマホ打刻に対応するサーバー側打刻APIを追加し、PIN/GPS検証、順序不正・二重打刻チェック、`attendance_events` 保存、`attendance_records` 更新を実装した。

### 追加
- `src/app/api/attendance/stamp/route.ts`
  - `POST /api/attendance/stamp` を追加。
  - `store_id`, `staff_id`, `event_type`, `source` を検証。
  - `kiosk` と `mobile_web` の打刻リクエストを受け付ける。
- `src/lib/attendance/stamp.ts`
  - 打刻対象店舗/スタッフの確認。
  - 店舗iPad端末とPINの検証。
  - 個人スマホログインユーザーとGPS距離の検証。
  - 出勤、休憩開始、休憩終了、退勤の順序制御。
  - `attendance_records` の作成/更新と `attendance_events` の保存。
- `src/lib/auth/pin.ts`
  - PINの `scrypt` ハッシュ生成と検証を共通化。

### 変更
- `src/app/(authenticated)/owner/staff/page.tsx`
  - PINハッシュ生成を共通ユーティリティへ切り出し。
- `NEXT.md`
  - A-005を完了扱いに更新。
- `docs/database-design.md`
  - 打刻APIのリクエスト項目と処理概要を追記。
- `FINISHED.md`
  - `A-005 打刻API実装` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `docs/database-design.md`
- `src/app/(authenticated)/owner/staff/page.tsx`
- `src/app/api/attendance/stamp/route.ts`
- `src/lib/attendance/stamp.ts`
- `src/lib/auth/pin.ts`

### 戻し方
- 追加した打刻API/打刻ユーティリティ/PINユーティリティを削除し、スタッフ管理画面のPINハッシュ生成を元に戻す。
- `NEXT.md` / `FINISHED.md` / `CHANGELOG.md` / `docs/database-design.md` の今回追記分を削除する。

---

## [2026-06-25] A-004 店長の担当店舗設定を実装

### 実施概要
オーナー向け `/owner/sr-accounts` を権限管理画面として実データ化し、店長ユーザーに担当店舗を割り当て・解除できるようにした。

### 変更
- `src/app/(authenticated)/owner/sr-accounts/page.tsx`
  - Server Component 化し、owner ロールの認証済みコンテキストから組織IDを取得。
  - `user_profiles.role = manager` の店長ユーザー一覧を表示。
  - `manager_store_permissions` の担当店舗一覧を表示。
  - 店長への担当店舗追加と解除をServer Actionで実装。
- `src/app/(authenticated)/owner/page.tsx`
  - オーナーダッシュボードに権限管理カードを追加。
- `NEXT.md`
  - A-004を完了扱いに更新。
- `FINISHED.md`
  - `A-004 店長の担当店舗設定` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(authenticated)/owner/page.tsx`
- `src/app/(authenticated)/owner/sr-accounts/page.tsx`

### 戻し方
- `src/app/(authenticated)/owner/sr-accounts/page.tsx` をプレースホルダー状態へ戻し、`owner/page.tsx` の権限管理カードと `NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-25] A-003 スタッフ管理画面を実データ化

### 実施概要
オーナー向け `/owner/staff` を Supabase 実データに接続し、スタッフの作成、編集、有効/無効切り替え、所属店舗設定、店舗iPad用PIN更新、個人スマホ用AuthユーザーID紐づけを実装した。

### 変更
- `src/app/(authenticated)/owner/staff/page.tsx`
  - Server Component 化し、owner ロールの認証済みコンテキストから組織IDを取得。
  - `staff` の一覧表示、作成、編集、有効/無効切り替えを追加。
  - 氏名、ふりがな、従業員コード、雇用形態、時給、電話、メール、入社日、退職日を管理できるようにした。
  - `default_store_id` と `store_staff_assignments` を使った所属店舗設定を追加。
  - 店舗iPad打刻用PINを `scrypt` 形式のハッシュとして保存する更新フォームを追加。
  - 個人スマホ利用者向けに `auth_user_id` の紐づけ入力を追加。
- `NEXT.md`
  - A-003を完了扱いに更新。
- `FINISHED.md`
  - `A-003 スタッフ管理の実装` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(authenticated)/owner/staff/page.tsx`

### 戻し方
- `src/app/(authenticated)/owner/staff/page.tsx` をプレースホルダー状態へ戻し、`NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-25] A-002 店舗管理画面を実データ化

### 実施概要
オーナー向け `/owner/stores` を Supabase 実データに接続し、店舗の作成、編集、有効/無効切り替え、店舗iPad端末の登録・有効/無効切り替えを実装した。

### 変更
- `src/app/(authenticated)/owner/stores/page.tsx`
  - Server Component 化し、owner ロールの認証済みコンテキストから組織IDを取得。
  - `stores` の一覧表示、作成、編集、有効/無効切り替えを追加。
  - 店舗コード、住所、緯度、経度、GPS許容半径を管理できるフォームを追加。
  - `kiosk_devices` の一覧表示、端末登録、有効/無効切り替えを追加。
- `NEXT.md`
  - A-002を完了扱いに更新。
- `FINISHED.md`
  - `A-002 店舗管理の実装` の完了ログを追加。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(authenticated)/owner/stores/page.tsx`

### 戻し方
- `src/app/(authenticated)/owner/stores/page.tsx` をプレースホルダー状態へ戻し、`NEXT.md` / `FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。

---

## [2026-06-25] A-001 Supabase Authログイン基盤を追加

### 実施概要
Supabase Auth と `user_profiles` を使ったログイン基盤を追加し、オーナー、社労士、店長向け画面のロール別リダイレクトとアクセス制御を実装した。

### 追加
- `src/lib/auth/session.ts`
  - 現在のAuthユーザー、業務プロフィール、店長担当店舗、スタッフ紐づけ情報を取得するサーバー側ユーティリティを追加。
  - ロール別ホームパス、ロール必須チェック、店長店舗アクセスチェックを追加。
- `src/app/api/auth/session/route.ts`
  - ログイン後にクライアントから権限情報とリダイレクト先を取得するAPIを追加。
- `src/app/auth/logout/route.ts`
  - Supabase Auth のサインアウトRouteを追加。
- `src/app/(manager)/manager/[storeId]/layout.tsx`
  - 店長の担当店舗アクセス制御を追加。

### 変更
- `src/app/(authenticated)/login/page.tsx`
  - Supabase Auth のメール/パスワードログインへ接続。
  - 選択ロールと `user_profiles.role` の一致確認、ロール別リダイレクトを追加。
- `src/app/(manager)/manager/login/page.tsx`
  - Supabase Auth の店長ログインへ接続。
  - 担当店舗へ自動リダイレクトするよう変更。
- `src/app/(authenticated)/owner/layout.tsx`
  - owner ロール必須のサーバー側アクセス制御とログアウトフォームを追加。
- `src/app/(authenticated)/sr/layout.tsx`
  - sr ロール必須のサーバー側アクセス制御とログアウトフォームを追加。
- `NEXT.md`
  - A-001を一部着手として更新。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。

### 未完了
- スタッフ個人スマホ画面のログイン必須化。
- Authユーザー作成/招待フロー。
- パスワードリセット。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(authenticated)/login/page.tsx`
- `src/app/(authenticated)/owner/layout.tsx`
- `src/app/(authenticated)/sr/layout.tsx`
- `src/app/(manager)/manager/login/page.tsx`
- `src/app/(manager)/manager/[storeId]/layout.tsx`
- `src/app/api/auth/session/route.ts`
- `src/app/auth/logout/route.ts`
- `src/lib/auth/session.ts`

### 戻し方
- 追加した認証Route/ユーティリティ/店長店舗layoutを削除し、ログイン画面とowner/sr layoutを直前状態に戻す。

---

## [2026-06-25] A-000 Phase 1 外部連携API基盤を実装

### 実施概要
日報管理アプリが勤怠データを読み取るための外部API Phase 1として、APIキー認証、疎通確認、店舗一覧、スタッフ一覧、勤怠一覧APIを追加した。

### 追加
- `supabase/migrations/202606250002_external_api_keys.sql`
  - `external_api_keys` テーブル、インデックス、updated_atトリガー、RLS有効化を追加。
- `src/lib/external-api/`
  - APIキー認証、共通エラー応答、パラメータ検証を追加。
- `src/app/api/external/v1/`
  - `health`, `stores`, `staff`, `attendance` の Route Handler を追加。
- `scripts/hash-external-api-key.mjs`
  - 外部APIキーの平文生成とSHA-256ハッシュ生成スクリプトを追加。

### 変更
- `package.json`
  - `npm run external-api:hash-key` を追加。
- `src/lib/supabase/database.types.ts`
  - `external_api_keys` の型を追加。
- `docs/integrations/attendance-api-spec.md`
  - APIキーのハッシュ生成・登録手順とPhase 1での `include_events` の扱いを追記。
- `docs/database-design.md`
  - `external_api_keys` をPhase 1追加予定から実装済み扱いへ更新。
- `NEXT.md`
  - A-000 Phase 1 の #2〜#4 を実装済みに更新し、Supabase適用と実接続検証を残タスクとして明記。

### 確認
- `npm run lint` が成功。
- `npm run build` が成功。
- `npm run external-api:hash-key -- test-key` が成功。

### 未完了
- `supabase/migrations/202606250002_external_api_keys.sql` のSupabase適用。
- `organizations` データと `external_api_keys` の実データ登録。
- 日報管理アプリ側からの実接続検証。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `docs/database-design.md`
- `docs/integrations/attendance-api-spec.md`
- `package.json`
- `scripts/hash-external-api-key.mjs`
- `src/app/api/external/v1/`
- `src/lib/external-api/`
- `src/lib/supabase/database.types.ts`
- `supabase/migrations/202606250002_external_api_keys.sql`

### 戻し方
- 追加した外部API関連ファイルとマイグレーションを削除し、`package.json`、`database.types.ts`、関連ドキュメントの追記を戻す。

---

## [2026-06-25] S-004 Supabaseプロジェクト作成・接続を完了

### 実施概要
Supabaseプロジェクト `Attendance_app_withCodeX_20260625` を作成し、GitHub連携、環境変数設定、初期スキーマ適用、接続確認まで完了した。

### 変更
- `NEXT.md`
  - `S-004 Supabaseプロジェクト作成・接続` を完了扱いに更新。
- `FINISHED.md`
  - `S-004 Supabaseプロジェクト作成・接続` の完了ログを追加。

### 確認
- `.env.local` に Supabase URL、publishable key、secret key が設定済み。
- `.env.local` は Git 管理対象外のまま。
- `supabase/migrations/202606250001_initial_attendance_schema.sql` を Supabase SQL Editor で適用済み。
- `/api/internal/supabase/health` が HTTP 200 を返すことを確認。

### 影響ファイル
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`

### 戻し方
- `NEXT.md` の S-004 を一部着手に戻し、`FINISHED.md` / `CHANGELOG.md` の今回追記分を削除する。
- Supabase 側の変更を戻す場合は、対象プロジェクトのDBテーブル・型を確認してから手動で削除する。

---

## [2026-06-25] S-004 Supabase接続確認手順とhealth APIを追加

### 実施概要
Supabaseプロジェクト作成後に迷わず接続確認できるように、セットアップ手順書とDB接続確認用の内部APIを追加した。

### 追加
- `docs/supabase-setup.md`
  - Supabaseプロジェクト作成、環境変数設定、初期スキーマ適用、接続確認手順を追加。
  - Supabase CLI 利用時のコマンド例と、この環境ではCLI未インストールであることを記録。
- `src/app/api/internal/supabase/health/route.ts`
  - service role 経由で `organizations` テーブルへ接続できるか確認する内部APIを追加。

### 変更
- `NEXT.md`
  - S-004の進捗として、手順書と接続確認APIの追加を記録。
- `docs/database-design.md`
  - 次に実装するものから導入済みのパッケージ導入を外し、health APIでの確認手順へ更新。
- `README.md`
  - 関連ドキュメントに Supabase セットアップ手順を追加。
- `FINISHED.md`
  - `S-004-PART Supabase接続確認基盤追加` を記録。

### 未完了
- Supabaseプロジェクト作成。
- 初期スキーマのクラウド適用。
- `.env.local` への実キー設定。

### 影響ファイル
- `NEXT.md`
- `README.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `docs/database-design.md`
- `docs/supabase-setup.md`
- `src/app/api/internal/supabase/health/route.ts`

### 戻し方
- `docs/supabase-setup.md` と `src/app/api/internal/supabase/health/route.ts` を削除し、各ドキュメントの今回追記分を削除する。

---

## [2026-06-25] 日報アプリ向け外部連携APIの実装計画を追加

### 実施概要
日報管理アプリへ出退勤データを取り込むための外部連携APIについて、仕様書、実装フェーズ、GitHub Issue対応、関連ドキュメントを整理した。

### 追加
- `docs/integrations/attendance-api-spec.md`
  - 日報アプリ向け外部連携APIの目的、フェーズ、認証、エンドポイント、エラー形式、cURLサンプルを追加。

### 変更
- `NEXT.md`
  - `A-000 日報アプリ向け外部連携API` を追加。
  - Phase 1はIssue #2〜#4、Phase 2はIssue #5〜#7として整理。
- `docs/implementation-decisions.md`
  - 外部連携APIの責務分担、認証方式、Phase分けを記録。
- `docs/database-design.md`
  - `external_api_keys`, `external_api_access_logs` の予定と日報連携方針を追記。
- `README.md`
  - 日報管理アプリ連携の目的と関連ドキュメントを追記。
- `FINISHED.md`
  - `DOC-003 日報アプリ向け外部連携APIの実装計画整理` を記録。

### 影響ファイル
- `NEXT.md`
- `README.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `docs/database-design.md`
- `docs/implementation-decisions.md`
- `docs/integrations/attendance-api-spec.md`

### 戻し方
- 追加した `docs/integrations/attendance-api-spec.md` を削除し、各ドキュメントの今回追記分を削除する。

---

## [2026-06-25] GitHub自動コミット/push運用を明記

### 実施概要
今後、特別な指示がない限り、作業完了後にGitHubへコミットとpushまで行う運用をREADMEへ追記した。

### 変更
- `README.md`
  - 作業管理ルールに「特別な指示がない限り、作業完了後はGitHubへコミットとpushまで行う」を追記。
- `FINISHED.md`
  - `DOC-002 GitHub自動コミット/push運用の明記` を記録。

### 影響ファイル
- `README.md`
- `FINISHED.md`
- `CHANGELOG.md`

### 戻し方
- `README.md` の該当ルールと、`FINISHED.md` / `CHANGELOG.md` の今回エントリを削除する。

---

## [2026-06-25] Sランク仕様確定とSupabase接続基盤追加

### 実施概要
`NEXT.md` の Sランク項目に沿って、DB方針、打刻方式、権限設計を確定。
あわせて、Supabase接続に必要なnpmパッケージ、環境変数テンプレート、client/server/admin用ヘルパーを追加した。

### 完了
- `S-001 DB方針の確定`
  - Supabase PostgreSQLで継続する方針に確定。
- `S-002 打刻方式の仕様確定`
  - 店舗iPadは氏名選択+PIN。
  - 個人スマホはログイン+GPS。
  - LINEは初期実装ではWeb打刻URL誘導を優先。
- `S-003 権限設計の確定`
  - オーナー、店長、社労士、スタッフの権限方針を確定。
  - スタッフ打刻はサーバー側APIで検証してからDB書き込みする方針に整理。

### 追加
- `docs/implementation-decisions.md`
  - S-001〜S-003の決定内容を記録。
- `.env.example`
  - Supabase接続用の環境変数テンプレートを追加。
- `src/lib/supabase/`
  - `client.ts`: ブラウザ用Supabase client。
  - `server.ts`: Next.jsサーバー用Supabase client。
  - `admin.ts`: service role用Supabase admin client。
  - `env.ts`: 環境変数取得ヘルパー。
  - `database.types.ts`: 初期スキーマに対応するDB型。
  - `index.ts`: Supabase関連export。

### 変更
- `NEXT.md`
  - S-001〜S-003を完了扱いに更新。
  - S-004を一部着手として更新。
- `FINISHED.md`
  - S-001〜S-003の完了ログを追記。
- `package.json` / `package-lock.json`
  - `@supabase/supabase-js` と `@supabase/ssr` を追加。

### 未完了
- Supabaseプロジェクト作成。
- マイグレーション適用。
- `.env.local` 設定。

### 影響ファイル
- `.env.example`
- `CHANGELOG.md`
- `FINISHED.md`
- `NEXT.md`
- `docs/implementation-decisions.md`
- `package.json`
- `package-lock.json`
- `src/lib/supabase/`

### 戻し方
- 追加したSupabase接続ファイルと `.env.example` を削除し、`package.json` / `package-lock.json` からSupabase関連パッケージを戻す。

---

## [2026-06-25] 作業管理ファイルとREADME整備

### 実施概要
今後の開発を `NEXT.md` の優先度付き項目に沿って進められるように、作業管理用ドキュメントを追加。
あわせて、完了ログ用の `FINISHED.md` を作成し、READMEを日本語のプロジェクト説明へ書き直した。

### 追加
- `NEXT.md`
  - S/A/B/C の優先度別バックログを作成。
  - `S-001` のような固定IDを各作業項目に付与。
  - 完了時に `FINISHED.md` と `CHANGELOG.md` を更新するルールを記載。
- `FINISHED.md`
  - 完了項目の記録フォーマットを作成。
  - 初回ログとして `DOC-001 作業管理ファイル整備` を記録。

### 変更
- `README.md`
  - Next.js 初期READMEから、日本語のプロジェクト説明へ全面更新。
  - 目的、技術スタック、ディレクトリ構成、開発コマンド、作業管理ルールを記載。
- `CHANGELOG.md`
  - 今回のドキュメント整備を先頭に追記。

### 影響ファイル
- `NEXT.md`
- `FINISHED.md`
- `README.md`
- `CHANGELOG.md`

### 戻し方
- `NEXT.md` と `FINISHED.md` を削除し、`README.md` と `CHANGELOG.md` を直前コミットの内容に戻す。

---

## [v1.0.0] 2026-04-16 — 技術スタック刷新完了

### 実施概要
v0.x の実装を進める中で判明した技術的問題（Next.js 16 ベータの不安定性、base-ui の API 相違、サーバー状態管理の非効率性）を理由に、プロジェクトを段階的に再構築。

### 実施内容

#### 段階1: 基盤構築
- **Next.js**: v16 → **v14（LTS相当）** にダウングレード
  - `params` が通常のオブジェクト型に（v16 では Promise 型）
  - API routes の安定性向上
  
- **shadcn/ui**: base-ui系 → **Radix UI系** に再セットアップ
  - Select等のコンポーネントがドキュメント通りに動作
  - 公式サポートの充実
  
- **状態管理**: TanStack Query を追加
  - サーバーデータ（店舗、スタッフ、勤怠記録）: **TanStack Query** で管理
  - UI状態（モーダル開閉、選択状態）: **Zustand** のみ
  - 役割分担が明確に
  
- **PDF出力**: @react-pdf/renderer → jsPDF + html2canvas に変更予定
  - バンドルサイズ削減（1MB → 200KB程度）
  - シフト表のような表形式に適切

#### 段階2: 型定義・ロジック移植
- 型定義（`src/types/`）をそのまま移植
- 計算ロジック（dateUtils.ts, gpsUtils.ts）をそのまま移植
- Zustand Store を UI状態のみに簡潔化（5ファイル）
- TanStack Query フック層を新規作成（`src/lib/api/hooks.ts`）
  - useShops, useStaff, useTodayAttendances, useStamp, useCorrectionRequests, useShifts など15個

#### 段階3: コンポーネント・ページ移植
- 全7個のコンポーネントを移植・修正
- 全16ルート・23個のページを実装
- base-ui Select API → Radix UI Select API に統一
- `use(params)` を削除（Next.js 14 形式に）
- Zustand サーバー状態 → TanStack Query フックに置き換え

### 影響ファイル一覧（新規作成）

#### 基盤（Next.js 14 + TanStack Query）
- `src/app/providers.tsx` — QueryClientProvider
- `src/app/layout.tsx` — Providers 統合
- `src/app/page.tsx` — トップページ

#### 型・ロジック
- `src/types/` — 全型定義（7ファイル）
- `src/lib/utils/dateUtils.ts` — 日時計算ロジック
- `src/lib/utils/gpsUtils.ts` — GPS距離計算
- `src/lib/validations/` — Zod スキーマ（4ファイル）

#### API・データ管理
- `src/lib/api/mockData.ts` — モックデータ（段階的にAPI置換予定）
- `src/lib/api/hooks.ts` — TanStack Query フック層（15個のカスタムフック）

#### 状態管理（Zustand）
- `src/stores/authStore.ts` — 認証状態
- `src/stores/stampStore.ts` — 打刻画面UI状態
- `src/stores/attendanceStore.ts` — 勤怠画面UI状態
- `src/stores/shiftStore.ts` — シフト管理UI状態
- `src/stores/uiStore.ts` — グローバルUI状態

#### UIコンポーネント
- `src/components/stamp/` — 打刻関連（3個）
- `src/components/dashboard/` — ダッシュボード関連（2個）
- `src/components/requests/` — 申請管理（1個）
- `src/components/shifts/` — シフト管理（1個）

#### ページ
- `src/app/(public)/stamp/` — 打刻フロー（3ページ）
- `src/app/(manager)/manager/` — 店長画面（4ページ）
- `src/app/(authenticated)/` — オーナー・社労士（8ページ）

### 技術的な注意点（元に戻す際の参考）

| 項目 | v0.x | v1.0.0 | 要注意ポイント |
|---|---|---|---|
| Next.js | 16（ベータ） | 14（LTS） | params が Promise ではなくオブジェクト |
| shadcn/ui | base-ui系 | Radix UI系 | Select API が大幅に異なる |
| Select型 | @base-ui/react | @radix-ui/react-select | import 文が全て異なる |
| サーバー状態 | Zustand | TanStack Query | useQuery/useMutation の使い方を習得必須 |
| PDF出力 | @react-pdf/renderer | jsPDF+html2canvas | 出力フローが大きく異なる（未実装） |

### 動作確認
- ✅ TypeScript エラー: 0件
- ✅ ESLint エラー: 0件
- ✅ ビルド成功
- ✅ 全16ルート・23ページが実装完了

### v0.x に戻す場合
Git で v0.3.0 タグ相当のコミットに戻すか、`src_backup/` ディレクトリの内容を復元してください。
ただし、Next.js 14 で v0.x のコード（`use(params)` 等）をそのまま動かすことはできません。

---

## [v0.3.0] 2026-04-16 — フロントエンド全画面実装（base-ui系）

（詳細は git log または src_backup/CHANGELOG_v0.md を参照）

### 実装内容
- 打刻画面（/stamp）
- 店長ダッシュボード（/manager）
- シフト管理（/manager/[storeId]/shifts）
- オーナー管理画面（/owner）
- 社労士画面（/sr）
- 全型定義・Zustand Store・計算ロジック

### 技術スタック（v0系）
- Next.js 16（ベータ）
- shadcn/ui (base-ui系)
- Zustand（全状態管理）
- @react-pdf/renderer
- React Hook Form + Zod
