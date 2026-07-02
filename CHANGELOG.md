# 変更ログ

変更を元に戻したい場合の参照用ログです。
各エントリには「何を・なぜ変更したか」と「影響ファイル」を記録します。

---

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
