# NEXT

今後の作業順を管理するためのファイルです。

## 運用ルール

- 優先度は `S`, `A`, `B`, `C` の4段階で管理します。
- 各項目は `S-001` のようにIDを固定します。
- 作業開始時は、このファイルの該当IDを参照します。
- 実装完了後は `FINISHED.md` に、項目ID、項目名、実装内容、確認内容を追記します。
- 仕様や実装に意味のある変更が入った場合は `CHANGELOG.md` も更新します。
- 完了済み項目は、必要に応じてこのファイル上で `完了` と明記します。ただし履歴の正本は `FINISHED.md` とします。
- `.env.local` の値は読み取り・表示しません。内容へのアクセスが必要な場合は、目的と値を表示しない確認方法を先に示し、ユーザーの明示的な許可を得ます。
- 個人情報、APIキー、Secret keyなどの機密情報は [SECURITY.md](SECURITY.md) に従って扱います。

## 現在の実行計画（2026-07-13）

- 日報管理アプリ側は本番運用準備を優先しており、勤怠連携は同リポジトリの `A-005` Backlogで保留中。日報側へのAPIキー設定、マッピング、勤怠取り込み、実接続確認は、日報側が連携実装へ着手できる段階まで保留する。
- 勤怠管理アプリの本番デプロイ、実店舗データ投入、Go-Live作業は今回の自動実行対象外とする。
- 今回は次の順序で、1PRで理解できる粒度に分けて進める。
  1. 計画、連携仕様、GitHub Issueの状態を実装実態へ同期する。
  2. `A-006` Supabase Performance Advisor最適化と `A-007` 自動テスト・CI強化を進める。
  3. `A-001` のスタッフAuthユーザー招待、紐付け、パスワード再設定を実装する。
  4. `A-000` のうち日報側の画面実装を必要としないレート制限、アクセスログ、APIキー管理を進める。
  5. `C-004` LINE連携の運用設定と実機確認を進める。
- 各PRはfeature/choreブランチから作成し、Copilotレビューを明示的に依頼する。到着確認、対応ラウンド、Round 3後の扱いは `.github/instructions/review-loop.instructions.md` の正本手順に従う。
- `.env.local` の読み取り、秘密情報の表示、破壊的DB操作、本番運用準備、PRの自動マージは認可範囲に含めない。

## S: 最重要

### S-001 DB方針の確定（完了）

- Supabaseで継続するか、Firebaseへ移行するかを最終決定する。
- 現在は Supabase PostgreSQL 前提のスキーマを作成済み。
- 決定後、DB接続、認証、API、LINE連携の方針を固定する。
- 決定内容は `docs/implementation-decisions.md` に記録済み。

### S-002 打刻方式の仕様確定（完了）

- 店舗iPad打刻: スタッフ一覧、氏名選択、PIN入力、出勤/退勤/休憩打刻。
- 個人スマホ打刻: メールアドレス/パスワードログイン、店舗選択、GPS取得、出勤/退勤打刻。
- LINE打刻: 直接打刻にするか、GPS付きWeb打刻URLへ誘導するかを決める。
- 不正防止の観点では、初期実装はLINEからWeb打刻URLへ誘導する方式を有力候補とする。
- 決定内容は `docs/implementation-decisions.md` に記録済み。

### S-003 権限設計の確定（完了）

- オーナー: 全店舗管理。
- 店長: 担当店舗のみ管理。
- 社労士: 閲覧/CSV出力中心。
- スタッフ: 自分の勤怠/シフト確認、打刻。
- Supabase RLS とサーバー側APIの責務分担を確定する。
- 決定内容は `docs/implementation-decisions.md` に記録済み。

### S-004 Supabaseプロジェクト作成・接続（完了）

- Supabaseプロジェクトを用意する。
- `supabase/migrations` の初期スキーマを適用する。
- `.env.local` に Supabase URL と anon key を設定する。
- `@supabase/supabase-js` を導入する。
- client/server/admin 用の接続ファイルを作成する。
- `@supabase/supabase-js` と `@supabase/ssr` は導入済み。
- `.env.example` と `src/lib/supabase` の接続ヘルパーは作成済み。
- `docs/supabase-setup.md` にプロジェクト作成、環境変数、マイグレーション適用、接続確認手順を追加済み。
- `/api/internal/supabase/health` で service role を使ったDB接続確認ができる。
- Supabaseプロジェクト `Attendance_app_withCodeX_20260625` を作成・GitHub連携済み。
- `.env.local` に publishable key と secret key を設定済み。
- 初期マイグレーションを Supabase SQL Editor で適用済み。
- 通知マイグレーション `202606260003_notifications.sql` を Supabase SQL Editor で適用済み。
- `/api/internal/supabase/health` が HTTP 200 を返すことを確認済み。
- Supabase Secret key / Service role key は 2026-06-27 にローテーション済み。
- `.env.local` の値は表示せず、必要なアクセスは事前にユーザー確認を行う。詳細は [SECURITY.md](SECURITY.md) を参照する。
- 補足: 2026-06-25時点で、この環境には Supabase CLI は未インストール。
- 2026-07-09: Supabase Advisor Warning 対応用に `supabase/migrations/202607090001_supabase_advisor_warnings.sql` を作成済み。
- 2026-07-09: Security Advisor に残ったRLS補助関数の公開Warning対応用に、関数をData API非公開の `private` スキーマへ移す `supabase/migrations/202607090002_security_advisor_function_execute.sql` を作成済み。
- 2026-07-13: 上記2マイグレーションを本番プロジェクトのSQL Editorで適用済み。
- 2026-07-13: RLS補助関数3件が `private` にあり、`anon_execute=false`、`authenticated_execute=true` であることを確認済み。
- 2026-07-13: 実在するオーナー、店長、社労士の各プロフィールを使ったロール別SQLスモークテストで、ロール判定、組織解決、組織・勤怠レコードのRLS付き読み取りがすべて成功することを確認済み。テストはトランザクション内で実施し、結果確認後にロールバックした。
- 2026-07-13: Security Advisor再実行後はErrors 0、Warnings 1、Info 0。解消可能なDB Warningは0件で、残件はFreeプランでは有効化できない `Leaked Password Protection Disabled` のみ。
- 2026-07-13: Copilotレビューを受け、`set_updated_at()` の `search_path` を `pg_catalog` のみに固定し、初期スキーマと重複する `line_accounts(staff_id)` 索引の追加を元マイグレーションから削除。適用済みDB向けに `202607130001_supabase_advisor_review_followup.sql` を作成済み。
- 2026-07-13: 本番SQL Editorで `202607130001_supabase_advisor_review_followup.sql` を適用済み。`set_updated_at()` の `search_path` が `pg_catalog` のみ、既存の `idx_line_accounts_staff` が存在、重複していた `idx_line_accounts_staff_id` が削除済みであることを、値を表示しない真偽値クエリですべて `true` と確認済み。
- 残リスク: 漏洩パスワード保護を有効化するにはSupabase Pro以上へのアップグレードが必要。アップグレード時に有効化してSecurity Advisorを再実行する。
- 完了条件: Security Advisorの解消可能なWarningが0件で、RLS機能確認とプラン制約の記録があること。2026-07-13達成済み。

## A: 実装基盤

### A-000 日報アプリ向け外部連携API

- GitHub親Issue: https://github.com/weimaraner69-crypto/Attendance_app_withCodeX_20260625/issues/1
- 連携先リポジトリ: https://github.com/weimaraner69-crypto/kashio-nippou-app_20260611Start
- 仕様書: `docs/integrations/attendance-api-spec.md`
- 目的: 日報管理アプリが勤怠アプリの `attendance_records` を読み取り、日報のスタッフ出退勤入力へ取り込めるようにする。
- 方針: 勤怠アプリを出退勤データの正本、日報アプリを日次経営データの正本として分ける。
- 日報側とのID差異は、日報側の店舗・スタッフ外部マッピングで吸収する。勤怠側は自分のUUIDを返す。

#### Phase 1 最小リリース

- [x] #2 外部APIキー認証基盤を実装する。
- [x] #3 `GET /api/external/v1/health`, `/stores`, `/staff` を実装する。
- [x] #4 `GET /api/external/v1/attendance` 一覧取得を実装する。
- GitHubの#2〜#4は、`A-007` で受入条件を自動契約テストへ固定してからクローズするため、コード実装済み・Issue検証待ちとして開いたままにする。
- Phase 1 完了後、日報アプリ側で店舗・スタッフのマッピングと勤怠取り込み検証を開始できる。
- 2026-07-02: `supabase/migrations/202606250002_external_api_keys.sql` をSupabaseへ適用し、テーブル、RLS、索引を確認済み。
- 2026-07-02: 組織データとして `株式会社樫尾商店`（`Asia/Tokyo`）を登録済み。
- 2026-07-02: `日報アプリ本番` APIキーを生成し、平文はmacOSキーチェーン、SHA-256ハッシュはSupabaseへ保存済み。
- 2026-07-02: キーを表示せずローカルAPIへ接続し、`/health`、`/stores`、`/staff` のHTTP 200を確認済み。店舗・スタッフは現在0件。
- 2026-07-13: 連携先の `docs/plan.md` では勤怠連携 `A-005` がBacklogであり、日報側は本番運用準備を優先していることを確認。
- 保留: 日報アプリ側へのAPIキー設定、店舗・スタッフのマッピング、勤怠取り込み、実接続検証。日報側が `A-005` をNextへ昇格した時点で再開する。

#### Phase 1 再開条件と保留作業

- [ ] 日報アプリ側で `A-005` がNextへ昇格し、マッピングと取り込みの実装方針が確定する。
- [ ] 勤怠アプリに本番運用する店舗を1件以上登録する。今回の本番運用準備スコープには含めない。
- [ ] 対象店舗へスタッフを1名以上登録・所属設定する。今回の本番運用準備スコープには含めない。
- [ ] 通常の打刻フローで、外部連携確認に使える完了済み勤怠データを用意する。今回の本番運用準備スコープには含めない。
- [ ] 日報アプリのサーバー環境へ勤怠APIのベースURLとAPIキーを設定する。APIキーはキーチェーンから安全に移し、画面、ログ、Gitへ表示しない。
- [ ] 日報アプリから `/health`、`/stores`、`/staff` を呼び、組織、店舗、スタッフのマッピング候補を取得できることを確認する。
- [ ] 日報アプリから `/attendance` を店舗・期間指定で呼び、完了済み勤怠を日報の出退勤入力へ取り込めることを確認する。
- 完了条件: APIキーがサーバー専用で管理され、日報アプリから4エンドポイントへ接続でき、店舗・スタッフの対応付けと勤怠取り込み結果を確認できる。

#### Phase 2 運用強化

- [ ] #7 レート制限とAPIアクセスログを実装する。外部APIを公開運用する前の安全対策として先行する。
- [ ] #6 オーナー向けAPIキー管理画面 `/owner/integrations/api-keys` を実装する。
- [ ] #5 `GET /api/external/v1/attendance/{id}` と `include_events` を実装する。日報側の利用要件が固まるまで保留する。
- [ ] 勤怠側仕様書と日報側に残る初期仕様の差分を解消し、再開時に同一契約を参照できる状態にする。

### A-001 認証実装（一部着手）

- オーナー、店長、社労士、スタッフのログインを実装する。
- Supabase Auth と `user_profiles` / `staff.auth_user_id` を連携する。
- ロール別のログイン後リダイレクトを実装する。
- 未ログイン時のアクセス制御を実装する。
- Supabase Auth のメール/パスワードログインをオーナー、社労士、店長向け画面へ接続済み。
- `/api/auth/session` で Auth ユーザー、`user_profiles`、店長担当店舗、スタッフ紐づけ情報を取得できる。
- オーナー、社労士、店長店舗画面の未ログイン/ロール不一致アクセス制御を実装済み。
- ログアウトRoute `/auth/logout` を追加済み。
- 店長、オーナー、社労士向けに、初回メール/パスワード認証後の4桁PIN再ログインをコード実装済み。
- PIN再ログインは同じ端末かつ初回認証から6時間以内だけ許可し、期限後はメール/パスワードを再要求する。
- PINはscryptでハッシュ化し、5回失敗した場合は10分間ロックする。
- 「画面をロック」はSupabaseセッションを維持してPIN画面へ戻し、「完全ログアウト」はセッションと端末認証Cookieを破棄する。
- `supabase/migrations/202607020001_privileged_login_pin.sql` はSupabaseへ適用済み。
- 店長、オーナー、社労士のテストアカウント、テスト店舗、ロール、店長店舗権限、社労士権限、共通テストPINを設定し、認証成功を確認済み。資格情報はリポジトリへ記録しない。
- スタッフ用メール/パスワードログイン、ロール照合、`/stamp/mobile` の `staff` ロール必須化、本人のシフト・通知・打刻画面への遷移は実装済み。
- 未完了: Authユーザー作成/招待フロー、`staff.auth_user_id` の安全な紐付け、招待受諾、パスワードリセット。
- [ ] オーナーがスタッフ管理画面からAuthユーザーを招待できるようにする。
- [ ] 招待したAuthユーザーを同じ組織のスタッフへ安全に紐付け、他組織・他ロールへの誤紐付けを拒否する。
- [ ] 招待受諾後の初回パスワード設定と、パスワード再設定フローを実装する。
- [ ] 無効スタッフ、未紐付けスタッフ、ロール不一致、期限切れリンクの回帰テストを追加する。
- 完了条件: オーナーが平文パスワードを扱わずスタッフを招待でき、スタッフ本人が初回設定・再設定後に `/stamp/mobile` へ安全にログインできる。

### A-002 店舗管理の実装（完了）

- 店舗の作成、編集、無効化、一覧表示を実装する。
- 店舗コード、住所、GPS座標、GPS許容半径を管理する。
- 店舗iPad打刻に使う `kiosk_devices` の管理画面を用意する。
- オーナー画面 `/owner/stores` で実データの店舗作成、編集、有効/無効切り替え、店舗iPad端末登録、有効/無効切り替えを実装済み。

### A-003 スタッフ管理の実装（完了）

- スタッフの作成、編集、無効化、一覧表示を実装する。
- 氏名、ふりがな、雇用形態、時給、有効/無効を管理する。
- 所属店舗を設定する。
- 店舗iPad打刻用PINの設定/変更を実装する。
- 個人スマホ利用者は Supabase Auth ユーザーと紐づける。
- オーナー画面 `/owner/staff` で実データのスタッフ作成、編集、有効/無効切り替え、所属店舗設定、PIN更新、AuthユーザーID紐づけを実装済み。

### A-004 店長の担当店舗設定（完了）

- 店長ユーザーに担当店舗を割り当てる。
- `manager_store_permissions` を使って、店長が自店舗だけを操作できるようにする。
- オーナー画面 `/owner/sr-accounts` を権限管理画面として実データ化し、店長ユーザーへの担当店舗追加・解除を実装済み。

### A-005 打刻API実装（完了）

- サーバー側APIとして打刻処理を実装する。
- 店舗iPad打刻ではPINを検証する。
- 個人スマホ打刻ではログインユーザーとGPSを検証する。
- `attendance_events` に生ログを保存する。
- `attendance_records` の日別勤怠を更新する。
- 不正打刻、二重打刻、順序不正を扱う。
- `POST /api/attendance/stamp` と打刻処理ユーティリティを実装済み。
- 店舗iPadは `kiosk_device_id` とPINを検証し、個人スマホはログインユーザーとGPS距離を検証する。
- 画面接続と店舗iPad/個人スマホ別UIは `B-001` で実施する。

### A-006 Supabase Performance Advisor最適化

- 2026-07-13の最新確認結果はErrors 0、Warnings 73、Info 44。
- Warningsは `Auth RLS Initialization Plan` 8件と `Multiple Permissive Policies` 65件、Infoは未索引外部キー13件と未使用インデックス31件。
- 全件の対象と対応判断は `docs/supabase-performance-advisor.md` を正本とする。
- [x] PostgreSQLカタログクエリで全指摘を一覧化し、テーブル、ポリシー、操作単位で重複を整理する。
- [x] `Auth RLS Initialization Plan` を、権限境界を変えずに初期化プラン化するマイグレーションと回帰テストを作成する。
- [x] `Multiple Permissive Policies` を、既存の許可条件の和集合を維持して整理するマイグレーションと回帰テストを作成する。
- [x] 未索引外部キー13件の索引を追加するマイグレーションを作成し、既存索引との重複を検査する。
- [x] 未使用インデックス31件は削除せず、30日以上の本番トラフィック観測後に削除可否を再評価する方針を記録する。
- [ ] PRレビュー完了後、`202607130002_performance_advisor_optimization.sql` を本番へ適用し、ロール別RLSスモークテストとPerformance Advisor再実行で残件を記録する。
- 完了条件: 全73 Warningと44 Infoの対応判断が記録され、採用した変更に回帰確認があり、Performance Advisorを再実行して残件と保留理由を記録する。

### A-007 自動テスト・CI強化

- [x] 既存の `ci.test_supabase_advisor_migrations` をGitHub Actionsの品質ゲートへ追加する。
- [x] Vitestと `npm test` を導入し、GitHub Actionsの品質ゲートへ追加する。
- [x] 外部APIの認証、パラメータ、組織境界、エラー形式を固定する契約テストを追加する。
- [x] 打刻状態遷移、GPS判定、認証ロール判定の重要な境界値テストを追加する。
- [x] 日報側が未実装でも、Phase 1のhealth・勤怠一覧レスポンス互換性を検証できる固定契約テストを用意する。
- [ ] PRのGitHub Actionsでpolicy check、Python回帰テスト、TypeScriptテスト、lint、buildがすべて成功したことを確認する。
- 完了条件: policy check、Python回帰テスト、TypeScriptテスト、lint、buildがローカルとCIで実行され、重要な認証・打刻・外部API契約の回帰を検出できる。

## B: 業務機能

### B-001 打刻画面の作り替え（完了）

- 店舗iPad用画面と個人スマホ用画面を分ける。
- 店舗iPad用: 店舗固定、スタッフ一覧、PIN入力、打刻ボタン。
- 個人スマホ用: ログイン済みスタッフ、店舗選択、GPS取得、打刻ボタン。
- 出勤、退勤、休憩開始、休憩終了のUIを整理する。
- `/stamp` を打刻入口、`/stamp/[storeId]` を店舗iPad用、`/stamp/mobile` を個人スマホ用として分離済み。
- 店舗iPad用と個人スマホ用の打刻ボタンは `POST /api/attendance/stamp` に接続済み。

### B-002 店長ダッシュボードの実データ化（完了）

- 今日の出勤状況をDBから表示する。
- 出勤中、休憩中、退勤済み、未打刻を表示する。
- 店舗別フィルタを実装する。
- 打刻漏れを見つけやすい表示にする。
- `/manager/[storeId]` の固定サンプル氏名・時刻・月次集計を削除し、Supabase の実データから担当店舗、所属スタッフ、当日勤怠を表示するように更新済み。
- 複数担当店舗がある店長は、担当店舗ボタンで店舗別に切り替えられる。

### B-003 打刻修正申請（完了）

- スタッフが打刻修正を申請できるようにする。
- 店長が承認/却下できるようにする。
- 承認時に `attendance_records` を更新する。
- 承認/却下、手入力、修正内容を `audit_logs` に記録する。
- `/stamp/mobile` に打刻修正申請フォームを追加し、`POST /api/attendance/requests` で申請を作成できるようにした。
- `/manager/[storeId]/requests` を実データ化し、店長が申請を承認/却下できるようにした。
- 承認時は対象日の `attendance_records` を作成/更新し、承認/却下操作を `audit_logs` に記録する。

### B-004 シフト管理（完了）

- 店長がシフトを作成、編集、公開できるようにする。
- スタッフが自分のシフトを確認できるようにする。
- シフトステータスを管理する。
- `/manager/[storeId]/shifts` を実データ化し、店長が今後31日分のシフト作成、編集、公開、取消をできるようにした。
- `/stamp/mobile` にログイン済みスタッフ本人の今後14日分の公開シフト一覧を追加した。

### B-005 シフト希望提出（完了）

- シフト希望募集期間を作成する。
- スタッフが希望日、希望時間、不可日を提出できるようにする。
- 店長が提出状況を確認できるようにする。
- `/manager/[storeId]/shifts` で店長がシフト希望募集期間を作成し、受付中/締切を切り替えられるようにした。
- `/stamp/mobile` でスタッフが受付中の募集へ希望日、希望時間、不可日、メモを最大3件提出できるようにした。
- 店長が募集ごとの提出人数と希望内容を確認できるようにした。

### B-006 オーナー/社労士向けレポート（完了）

- 月次勤怠一覧を表示する。
- 店舗別、スタッフ別、期間別の絞り込みを実装する。
- 社労士向け閲覧画面を実データ化する。
- `/owner/reports` と `/sr/reports` を `attendance_records` 実データへ接続済み。
- 期間、店舗、スタッフで絞り込める月次勤怠一覧と集計カードを追加済み。

## C: 実運用品質・拡張

### C-001 CSV/PDF出力（完了）

- 月次勤怠CSVを出力する。
- 給与計算向けデータを出力する。
- 必要に応じてPDFレポートを作成する。
- `/api/reports/attendance.csv` を追加し、オーナー/社労士がレポート画面の絞り込み条件でCSVを出力できるようにした。
- `/owner/reports` と `/sr/reports` から、現在の絞り込み条件・集計・勤怠一覧を日本語PDFとして保存できる。

### C-002 通知機能（完了）

- 申請承認/却下通知を実装する。
- シフト公開通知を実装する。
- 打刻漏れ通知を実装する。
- 将来的にLINE通知へ接続する。
- `notifications` テーブルを追加するマイグレーションを作成済み。
- `supabase/migrations/202606260003_notifications.sql` は Supabase SQL Editor で適用済み。
- スタッフ向け `/stamp/mobile` にアプリ内通知一覧を追加済み。
- 打刻修正申請の承認/却下、シフト公開、店長操作による打刻漏れ通知をアプリ内通知として作成する。
- C-002の初期スコープはアプリ内通知で完了。LINE通知はアカウント紐づけやMessaging API設定と合わせて `C-004` で実装する。

### C-003 監査ログ強化（完了）

- 誰が、いつ、何を変更したかを一覧で確認できるようにする。
- 打刻修正、手入力、承認/却下は必ず記録する。
- 変更前/変更後の表示を整える。
- オーナー画面 `/owner/audit-logs` で期間・操作を絞り込み、実行者、日時、対象、変更前後を確認できる。
- 打刻修正申請の承認/却下ログへ勤怠または申請の変更前後を保存し、監査ログ保存失敗をエラーとして扱う。

### C-004 LINE連携（コード実装完了・運用設定待ち）

- LINEアカウント紐づけを実装する。
- LINEからシフト確認できるようにする。
- LINEからシフト提出できるようにする。
- LINEから打刻導線へ進めるようにする。
- LINE通知を送信できるようにする。
- `POST /api/line/webhook` でraw bodyの署名検証後にイベントを処理する。
- 15分間有効なワンタイムURLとスタッフログインでLINEアカウントを本人連携する。
- `シフト確認`、`シフト提出`、`打刻`、`連携解除` コマンドを実装済み。
- LINEから直接打刻せず、既存のGPS必須Web打刻へ誘導する。
- アプリ内通知を正本として保存し、連携済みスタッフへLINE Push送信して配信結果を記録する。
- 未完了: `202606290004_line_integration.sql` のSupabase適用、LINE環境変数設定、LINE DevelopersのWebhook設定、実機疎通確認。
- 設定・確認手順: `docs/line-setup.md`

### C-005 運用・保守（完了）

- 本番環境の環境変数を整理する。
- エラー監視の方針を決める。
- バックアップと復旧手順を整理する。
- 権限・個人情報の取り扱いを確認する。
- `docs/operations-maintenance.md` に、本番/ステージング/ローカルの環境変数一覧、値を表示しない確認方法、デプロイ前チェック、監視レベル、初期アラート基準、バックアップ/復旧、ロール別権限、個人情報チェック、定期運用を整理済み。
- 実運用前の残作業は、C-004に記載したLINEマイグレーション/環境変数/Webhook/実機確認と、A-000に記載した外部APIの実DB適用・実接続検証。
