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

## 2026-07-16 Issue #7 外部APIレート制限・アクセスログ

- 対象: APIキー単位60 req/min、共通レートヘッダー、429、service role限定アクセスログ、PostgreSQL/CI回帰テスト
- 実施日: 2026-07-16
- 実施者 / provider: Codex pre-PR reviewer Faraday（push後の独立レビューには算入しない）
- 確認した文書・差分: Issue #7、外部API契約、共通リクエストラッパー、全4 Route、Supabase migration、database types、Vitest、PostgreSQL/並行テスト、CI workflow、計画・運用文書
- 実行した検証: Python 37件、Vitest 67件、policy check、lint、build、`git diff --check`、一時PostgreSQLへの全migration適用と60/61境界・次窓・権限・ログ保存・61並行更新
- 初回Must: 認証処理自体の例外が共通tryの外にあり、制御されない500ではレートヘッダーが欠落する問題。認証例外を `500 INTERNAL_ERROR`、`Limit: 60`、`Remaining: 0` へfail-closeし、拒否テストを追加して解消
- 初回Should: 並行テストが8件のカウントだけを確認していた問題。61並行呼び出しでrequest count 61、許可60、拒否1を直接確認するよう強化して解消
- 初回Nice: ログinsertがrejectする場合だけでなく、Supabase標準のresolved `{ error }` を返す場合もAPI本体を維持するテストを追加して解消
- 残リスク: hosted Supabaseへのマイグレーション適用と実APIキーによるヘッダー・429・ログ確認は、本番運用工程として未実施
- 結論: Must/Should/Niceを全件解消し、pre-PR reviewerは`APPROVE`。push後は別reviewer/sessionの`full_repo_agentic`独立レビューと専用PostgreSQLテストを必須とする

## 2026-07-16 Issue #16 スタッフAuth運用フォローアップ

- 対象: 紐付け済みメール不変、招待・再設定の監査部分成功、スタッフ別accessible name、結果live region
- 実施日: 2026-07-16
- 実施者 / provider: Codex pre-PR security/reliability reviewer Lorentz、独立completion auditor Lagrange（push後レビューには算入しない）
- 確認した文書・差分: Issue #16仕様、スタッフ管理server action、Auth操作、メール入力・結果表示コンポーネント、関連Vitest、計画・運用・完了文書
- 実行した検証: Python 37件、Vitest 97件、認証・UI対象テスト38件（SSRを含む）、policy check、lint、build、`git diff --check`、未認証`/owner/staff`の`/login`遷移とconsole error 0件
- Must: 招待とメール更新の競合で古いAuth/profileを紐付け得る問題を、招待開始時メールのDB更新条件と補償削除テストで解消。再設定がAuth実ユーザーを確認しない問題を、Admin APIのID・メール照合と欠落/不一致テストで解消
- Must確認: hiddenメールが未紐付け入力を上書きするとの指摘は、hidden入力と編集入力が別々のformであり非再現。連絡先フォームの入力コンポーネントが`name=email`を1つだけ出力するSSRテストを追加
- Should: 未紐付けメールの作成・更新前に既存profileと同一組織staffの重複を検査し、取得失敗時は更新しない。完了記録へ最終検証件数とレビュー対応を反映
- Runtime smoke判断: 認証済みowner実データ操作は本番・実データ非目標に抵触するため行わず、成功/部分成功/失敗とメール入力はReact SSR、route保護は未認証ブラウザ遷移で確認
- Nice: 本番運用工程で実メールE2Eを行う際、Auth/profile/staffのメール一致と監査ログを合わせて確認する
- 残リスク: hosted SupabaseのAdmin API・実メール・実データによるE2Eは本番運用工程として未実施。アプリ側は不一致と照会失敗をfail-closeする
- 結論: pre-PRのMust/Shouldを解消し、PR作成可。push後は別reviewer/sessionの`full_repo_agentic`独立レビューと専用認証回帰テストを必須とする

## 2026-07-16 PR #15 Round 3 Must再開対応

- 対象: 最新`main`取り込み後のスタッフAuth invite/recovery callback、設定権限、組織境界
- 実施日: 2026-07-16
- 実施者 / provider: Codex実装セッション（独立レビューには算入しない）
- 確認した文書・差分: Supabase Auth email template/SSR資料、旧Round 3レビュー、Issue #13、認証Route Handler、セッション解決、専用回帰テスト
- 実行した検証: 認証専用回帰を含む全Vitest 59件、Python回帰35件、実Postgres全migration/RLS/同時発行検証、policy check、lint、build、`git diff --check`
- Must: 旧指摘の対応後もフローガードCookie削除でcallback Authセッションを通常利用できるとの再指摘に対し、`verifyOtp` をCookie/storage非永続のリクエスト内専用クライアントへ分離し、通常利用可能なセッションの発行自体を廃止
- Should: intentのcleanup/insert競合をadvisory lock付きDB関数と未消費ユーザー部分一意索引で原子化。CIで実Postgresへ全マイグレーションを適用し、FK・削除・権限・RLS・intent境界を検証
- Nice: `/auth/confirm` と配下に `Cache-Control: private, no-store` と `Referrer-Policy: no-referrer` を追加
- 最終レビューMust: POST後の既定307 redirectがメソッドを保持する問題を修正。正常・異常とも303 See OtherとLocationをテストし、遷移先のGET表示を保証
- Round 3 Must: 失敗した新リンクが共有ブラウザの旧intent Cookieを利用する経路を修正。POST開始時に旧intentを消去し、cross-origin、OTP失敗、identity失敗、RPC失敗を専用テストで固定
- Nice: Issue #16のメール同期、audit log失敗検出、アクセシビリティ改善は別PRで継続
- 残リスク: hosted SupabaseへのEmail Templates反映と実メールE2Eは本番運用工程のため未実施
- 結論: 全品質ゲート完了後、別reviewer/sessionによる`full_repo_agentic`独立レビューへ進む

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
