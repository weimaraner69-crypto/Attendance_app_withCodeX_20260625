# FINISHED

実装が完了した項目のログです。

## 記録ルール

- `NEXT.md` の項目を完了したら追記します。
- 項目ID、項目名、実装日、実装内容、確認内容、影響ファイルを記録します。
- `CHANGELOG.md` にも意味のある変更として追記します。

---

## S-004-Advisor Security Advisor 関数実行権限Warning対応

- 実装日: 2026-07-09
- 種別: DB運用/Supabase Security Advisor対応

### 実装内容

- Security Advisor に残ったRLS補助関数の直接実行権限Warning 6件へ対応する追加マイグレーションを作成。
- `current_user_organization_id()`、`current_user_role()`、`can_access_store(uuid)` をData API非公開の `private` スキーマへ移すSQLを追加。
- RLS評価を壊さないよう、`PUBLIC` / `anon` の実行権限を外し、`authenticated` に必要最小限の `USAGE` / `EXECUTE` を付与する。
- SQL全体をトランザクション化し、途中失敗時は権限変更をロールバックする。
- `Leaked Password Protection Disabled` はSQLではなくDashboardのAuthentication設定で対応する項目として、手順書とNEXTへ残作業を記録。

### 確認内容

- スクリーンショットで残WarningがSecurity Advisor 7件であることを確認。
- `.env.local` の値は読み取り・表示していない。

### 残作業

- Supabase SQL Editor で `supabase/migrations/202607090002_security_advisor_function_execute.sql` を適用する。
- RLS補助関数3件が `private` にあり、`anon` は実行不可、`authenticated` はRLS評価用に実行可能であることを確認する。
- オーナー、店長、社労士の認証済み画面でRLS付き読み取りが成功することを確認する。
- Security Advisor を再実行し、関数のData API公開Warningが解消されたことを確認する。RLS評価に必要な `authenticated` 権限が警告される場合は、安全性・機能確認の証跡と判断理由を記録する。
- Supabase Dashboard の Authentication 設定で、Proプラン以上なら漏洩パスワード保護を有効化する。利用できない場合はアップグレードが必要な残リスクとして記録する。

### 影響ファイル

- `supabase/migrations/202607090002_security_advisor_function_execute.sql`
- `docs/supabase-setup.md`
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`

## S-004-Advisor Supabase Advisor Warning 対応マイグレーション作成

- 実装日: 2026-07-09
- 種別: DB運用/Supabase Advisor対応

### 実装内容

- Supabase Dashboard で出ている8件のWarning対応として、追加マイグレーションを作成。
- `public.set_updated_at()` の `search_path` を固定。
- service role専用の `external_api_keys`、`line_link_tokens`、`user_login_pins` に、ブラウザクライアントへ権限を付与しない明示denyポリシーを追加。対象テーブルやポリシーがすでに存在する場合はスキップする。
- denyポリシーを `RESTRICTIVE` とし、将来のpermissiveポリシー追加でもクライアントアクセスを許可しないようにした。
- 外部キー参照列の補助インデックスを追加。
- `pgcrypto` 拡張を `extensions` スキーマへ移動する処理を追加。
- SQL全体をトランザクション化し、途中失敗時は全変更をロールバックする。
- `docs/supabase-setup.md` に適用後のAdvisor再実行手順を追記。

### 確認内容

- SQLは既存データを更新せず、関数定義、ポリシー、インデックス、拡張スキーマだけを変更する内容として確認。
- `.env.local` の値は読み取り・表示していない。
- この環境には Supabase CLI がないため、実DBへの適用とAdvisor再実行は未実施。

### 残作業

- Supabase SQL Editor で `supabase/migrations/202607090001_supabase_advisor_warnings.sql` を適用する。
- Database Advisor / Security Advisor を再実行し、8件のWarningが解消されたことを確認する。
- Dashboard側にAuth設定系Warningが残る場合は、利用可能な設定を調整する。プラン制約がある場合は残リスクとして記録する。

### 影響ファイル

- `supabase/migrations/202607090001_supabase_advisor_warnings.sql`
- `docs/supabase-setup.md`
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`

## A-001-PIN 管理ユーザーの6時間PIN再ログイン（コード実装）

- 実装日: 2026-07-02
- 種別: 認証/端末ロック

### 実装内容

- 店長、オーナー、社労士の初回メール/パスワード認証後に、4桁PINを登録するフローを追加。
- PIN登録開始は直近5分以内のメール/パスワード認証後だけに制限。
- 同じブラウザでは初回認証から6時間以内だけPIN再ログインを許可。
- 6時間の期限をPIN再ログインでは延長せず、期限後はメール/パスワードを再要求。
- PINをscryptでハッシュ化し、5回失敗時に10分間ロック。
- PIN資格情報をRLS有効・クライアントポリシーなしの専用テーブルへ分離し、service role経由だけで操作。
- 署名付きHttpOnly Cookieで6時間の端末認証と現在の画面ロック解除を分離。
- 「画面をロック」と「完全ログアウト」を管理画面へ追加。
- スタッフログインはPIN対象外として既存フローを維持。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。
- `.env.local` の値は読み取り・表示していない。

### Supabase反映・確認

- `supabase/migrations/202607020001_privileged_login_pin.sql` をSupabase SQL Editorで適用。
- 店長、オーナー、社労士のテストAuthユーザー、`user_profiles`、PIN、テスト店舗を作成。
- 店長店舗権限と社労士組織権限を設定。
- 3ロールすべてでメール/パスワード認証、ロール、PINハッシュ照合、権限設定を確認。
- テスト資格情報そのものはリポジトリへ記録していない。

### 残作業

- ブラウザで画面ロック、PIN解除、6時間期限、5回失敗ロック、完全ログアウトを通し確認。

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
- `CHANGELOG.md`
- `docs/implementation-decisions.md`

## C-005 運用・保守

- 実装日: 2026-06-30
- 種別: 運用設計/保守手順

### 実装内容

- `docs/operations-maintenance.md` を追加。
- 本番・ステージング・ローカルで管理する環境変数を整理。
- Supabase、LINE、公開Originに関する変数の用途、公開範囲、必須タイミングを明記。
- `.env.local` やシークレット値を表示しない確認方法を整理。
- デプロイ前チェックとして、lint/build、マイグレーション、health API、LINE Webhook、外部APIキーの確認観点を整理。
- エラー監視方針を、プラットフォーム標準ログ、アプリ内運用ログ、将来の外部監視導入候補に分けて整理。
- 初期アラート基準として、health API失敗、LINE Webhook失敗、LINE配信失敗、打刻API異常、外部API認証失敗を定義。
- Supabase PostgreSQLを正本とするバックアップ/復旧方針を整理。
- オーナー、店長、社労士、スタッフ、外部API、LINE Webhookのロール別確認観点を整理。
- 個人情報として扱うデータと、毎日・毎月・四半期の定期運用チェックを整理。
- `README.md` の関連ドキュメントへ運用・保守手順を追加。
- `NEXT.md` の `C-005` を完了扱いに更新。

### 確認内容

- `.env.local` の値は読まず、`.env.example` と既存ドキュメントのみを参照。
- C-005の4項目（環境変数、監視、バックアップ/復旧、権限・個人情報）を `docs/operations-maintenance.md` に反映済み。
- 実運用前に残る外部設定・検証は、C-004とA-000の未完了項目として `NEXT.md` に残した。

### 影響ファイル

- `docs/operations-maintenance.md`
- `README.md`
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`

## C-004 LINE連携（コード実装）

- 実装日: 2026-06-29
- 種別: LINE Messaging API/Webhook/通知

### 実装内容

- raw bodyと `X-Line-Signature` をHMAC-SHA256で照合するWebhookを追加。
- LINEプロフィールを `line_accounts` へ登録し、15分間有効なワンタイムURLでスタッフ本人と連携。
- 連携トークンはSHA-256ハッシュだけをDBへ保存し、再発行時に旧トークンを無効化。
- LINEから今後14日分の公開シフトを確認可能にした。
- シフト希望提出とGPS打刻は既存Web画面へ誘導。
- LINE経由のシフト希望提出へ `source = line` と `line_account_id` を保存。
- 申請結果、シフト公開、打刻漏れ通知を連携済みLINEアカウントへPush送信。
- LINE配信結果を `notifications` へ記録。
- LINE連携・解除を監査ログへ記録。

### 確認内容

- `npm run build` が成功。
- `.env.local` の内容は読み取り・表示していない。

### 運用開始前の残作業

- `supabase/migrations/202606290004_line_integration.sql` をSupabaseへ適用。
- LINE用環境変数をサーバーへ設定。
- LINE DevelopersでWebhook URLを設定して検証。
- LINE実機で本人連携、各コマンド、Push通知を確認。

### 影響ファイル

- `.env.example`
- `README.md`
- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `docs/database-design.md`
- `docs/implementation-decisions.md`
- `docs/line-setup.md`
- `supabase/migrations/202606290004_line_integration.sql`
- `src/app/api/line/webhook/route.ts`
- `src/app/(public)/line/link/page.tsx`
- `src/app/(public)/stamp/mobile/page.tsx`
- `src/app/(authenticated)/login/page.tsx`
- `src/lib/line/messaging.ts`
- `src/lib/notifications/index.ts`
- `src/lib/audit/format.ts`
- `src/lib/supabase/database.types.ts`

---

## C-003 監査ログ強化

- 実装日: 2026-06-27
- 種別: 監査/管理画面

### 実装内容

- オーナー向け `/owner/audit-logs` を追加。
- 監査ログを期間・操作で絞り込み、実行者、日時、対象テーブル、対象IDを表示。
- 打刻修正申請の承認時は勤怠レコード、却下時は申請の変更前後を監査ログへ保存。
- 変更前後を項目単位で比較表示。
- 監査ログ保存失敗を黙って通さず、サーバーエラーとして扱うようにした。

### 確認内容

- `npm run build` が成功。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(authenticated)/owner/audit-logs/page.tsx`
- `src/app/(authenticated)/owner/page.tsx`
- `src/app/(manager)/manager/[storeId]/requests/page.tsx`
- `src/lib/audit/format.ts`

---

## C-001 CSV/PDF出力（PDF追加）

- 実装日: 2026-06-27
- 種別: PDF出力/レポート

### 実装内容

- `/owner/reports` と `/sr/reports` にPDF出力ボタンを追加。
- 表示中の期間、店舗、スタッフ絞り込み結果と集計、勤怠一覧をPDFへ反映。
- 日本語を文字化けさせないため、ブラウザ描画結果を画像化してPDFへ保存。
- 長い一覧はA4横向きの複数ページへ分割。

### 確認内容

- `npm run build` が成功。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/components/reports/AttendancePdfExportButton.tsx`
- `src/components/reports/AttendanceReportView.tsx`

---

## C-002 通知機能（初期スコープ完了確認）

- 実装日: 2026-06-27
- 種別: 計画整理

### 実装内容

- 承認/却下、シフト公開、打刻漏れのアプリ内通知が実装・DB適用済みであることを確認。
- LINE通知は `line_accounts` の紐づけとMessaging API設定が必要なため、LINE連携全体を扱う `C-004` のスコープとして明記。

### 確認内容

- `supabase/migrations/202606260003_notifications.sql` の適用済み記録を確認。
- `npm run build` が成功。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`

---

## DOC-004 機密情報取り扱いルールの明文化

- 実装日: 2026-06-27
- 種別: セキュリティ/運用文書

### 実装内容

- `SECURITY.md` を追加し、`.env.local` の値を読み取り・表示しないルールを明文化。
- `.env.local` の内容へのアクセスが必要な場合は、目的と安全な確認方法を示し、事前にユーザーの明示的な許可を得るルールを追加。
- `README.md`、`NEXT.md`、`docs/supabase-setup.md` から共通ルールを参照。
- 通知マイグレーションの実DB適用とSupabase Secret key / Service role keyのローテーション完了を記録。

### 確認内容

- `.env.local` の内容を読み取らず、Git管理対象外であることを確認。
- Git追跡対象のMarkdownに実キーやシークレット値を追加していないことを確認。

### 影響ファイル

- `SECURITY.md`
- `README.md`
- `NEXT.md`
- `docs/supabase-setup.md`
- `CHANGELOG.md`
- `FINISHED.md`

---

## C-002 通知機能（アプリ内通知）

- 実装日: 2026-06-26
- 種別: 通知/マイグレーション

### 実装内容

- `notifications` テーブル追加用マイグレーションを作成。
- スタッフ向け `/stamp/mobile` に通知一覧を追加。
- 打刻修正申請の承認/却下時にスタッフへアプリ内通知を作成。
- シフト公開時に対象スタッフへアプリ内通知を作成。
- 店長ダッシュボードに打刻漏れ通知作成ボタンを追加。
- 未打刻または退勤漏れのスタッフへアプリ内通知を作成。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。

### 補足

- `supabase/migrations/202606260003_notifications.sql` は 2026-06-27 に Supabase SQL Editor で適用済み。
- LINE通知は未実装。アプリ内通知として土台を作成した。

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

---

## C-001 CSV/PDF出力（CSV）

- 実装日: 2026-06-26
- 種別: CSV出力/API

### 実装内容

- `GET /api/reports/attendance.csv` を追加。
- オーナー/社労士ロールでのみ月次勤怠CSVを出力できるようにした。
- レポート画面の `from`, `to`, `store_id`, `staff_id` 絞り込み条件をCSV出力へ反映。
- CSV列として日付、店舗、スタッフ、従業員コード、状態、出勤、退勤、休憩分、勤務分、深夜分、手修正、メモを出力。
- `/owner/reports` と `/sr/reports` にCSV出力ボタンを追加。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/api/reports/attendance.csv/route.ts`
- `src/components/reports/AttendanceReportView.tsx`

---

## B-006 オーナー/社労士向けレポート

- 実装日: 2026-06-26
- 種別: 業務画面/レポート

### 実装内容

- `/owner/reports` を `attendance_records` 実データへ接続。
- `/sr/reports` を `attendance_records` 実データへ接続。
- 期間、店舗、スタッフによる絞り込みを追加。
- 勤務日数、総勤務時間、総休憩時間、深夜時間、要確認件数の集計カードを追加。
- 月次勤怠一覧に日付、店舗、スタッフ、状態、出勤、退勤、休憩、勤務、深夜、補足を表示。
- レポート取得ロジックを `src/lib/reports/attendance.ts` に集約。
- オーナー/社労士共通の表示部品 `AttendanceReportView` を追加。

### 確認内容

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

---

## B-005 シフト希望提出

- 実装日: 2026-06-26
- 種別: 業務画面/シフト希望

### 実装内容

- `/manager/[storeId]/shifts` にシフト希望募集期間の作成フォームを追加。
- 店長が募集期間の受付中/締切を切り替えられるようにした。
- 募集ごとの提出人数とスタッフ別の希望内容を確認できる提出状況一覧を追加。
- `/stamp/mobile` に受付中のシフト希望募集一覧を追加。
- スタッフが希望日、希望時間、不可日、メモを最大3件提出できるようにした。
- 同じ募集へ再提出した場合は、既存の希望内容を置き換えるようにした。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx`
- `src/app/(public)/stamp/mobile/page.tsx`

---

## B-004 シフト管理

- 実装日: 2026-06-26
- 種別: 業務画面/シフト管理

### 実装内容

- `/manager/[storeId]/shifts` を Supabase の `shifts` 実データへ接続。
- 店長が担当店舗の所属スタッフを選び、日付、開始時刻、終了時刻、休憩分、状態を指定してシフトを作成できるようにした。
- 既存シフトのスタッフ、日付、開始時刻、終了時刻、休憩分、状態を編集できるようにした。
- 下書きシフトを公開済みに変更できる公開ボタンを追加。
- シフトを取消状態に変更できる取消ボタンを追加。
- `/stamp/mobile` にログイン済みスタッフ本人の今後14日分の公開/確認済みシフト一覧を追加。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(manager)/manager/[storeId]/shifts/page.tsx`
- `src/app/(public)/stamp/mobile/page.tsx`

---

## B-003 打刻修正申請

- 実装日: 2026-06-26
- 種別: 業務画面/API/監査ログ

### 実装内容

- `POST /api/attendance/requests` を追加し、ログイン済みスタッフが打刻修正申請を作成できるようにした。
- スタッフの所属店舗またはデフォルト店舗のみ申請できるように検証を追加。
- `/stamp/mobile` に打刻修正申請フォームを追加。
- `/manager/[storeId]/requests` を Supabase の `attendance_requests` 実データ一覧へ接続。
- 店長が申請を承認/却下できる Server Action を実装。
- 承認時に対象日の `attendance_records` を作成または更新し、手修正扱いの `is_manual` とメモを残すようにした。
- 承認/却下操作を `audit_logs` に記録するようにした。

### 確認内容

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

---

## B-002 店長ダッシュボードの実データ化

- 実装日: 2026-06-25
- 種別: 業務画面/デバッグ

### 実装内容

- `/manager/[storeId]` の固定サンプル氏名、固定時刻、固定月次サマリーを削除。
- 店長の担当店舗権限を確認し、対象店舗を Supabase の `stores` から取得。
- 当日の `attendance_records` と所属中スタッフを取得し、出勤中、休憩中、退勤済み、未打刻の件数を表示。
- 複数担当店舗がある場合の店舗切り替えボタンを追加。
- 打刻漏れを見つけやすいように、スタッフ別の状態、出勤時刻、退勤時刻、休憩、勤務時間、最終更新を一覧表示。
- 申請管理、シフト管理に残っていた実名風の固定サンプルデータを削除し、後続タスクまでの空状態表示に変更。

### 確認内容

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

---

## B-001 打刻画面の作り替え

- 実装日: 2026-06-25
- 種別: 業務画面/API接続

### 実装内容

- `/stamp` を打刻入口として実データ化。
- `/stamp/[storeId]` を店舗iPad打刻画面として実装。
- 店舗iPad打刻画面で、店舗固定、スタッフ選択、店舗iPad端末選択、PIN入力、出勤/休憩開始/休憩終了/退勤ボタンを実装。
- `/stamp/mobile` をログイン済みスタッフ向け個人スマホ打刻画面として追加。
- 個人スマホ打刻画面で、所属店舗選択、GPS取得、出勤/休憩開始/休憩終了/退勤ボタンを実装。
- 旧 `/stamp/[storeId]/[staffId]` は店舗iPad画面へリダイレクトするよう整理。
- 店舗iPad用と個人スマホ用の両方を `POST /api/attendance/stamp` へ接続。

### 確認内容

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

---

## A-005 打刻API実装

- 実装日: 2026-06-25
- 種別: API/勤怠処理

### 実装内容

- `POST /api/attendance/stamp` を追加。
- 店舗iPad打刻では `kiosk_device_id` とPINを検証。
- 個人スマホ打刻では Supabase Auth ログインユーザーと `staff.auth_user_id` の一致を検証。
- 個人スマホ打刻では店舗座標とGPS座標の距離を検証。
- 出勤、休憩開始、休憩終了、退勤の順序不正をエラーにする処理を実装。
- 二重出勤、二重休憩開始、二重退勤をエラーにする処理を実装。
- `attendance_events` に打刻生ログを保存。
- `attendance_records` の日別勤怠結果を作成/更新。
- PINの `scrypt` ハッシュ生成・検証を `src/lib/auth/pin.ts` に共通化。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。

### 補足

- 打刻画面の店舗iPad用/個人スマホ用UI分離とAPI接続は `B-001` で実施する。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `docs/database-design.md`
- `src/app/(authenticated)/owner/staff/page.tsx`
- `src/app/api/attendance/stamp/route.ts`
- `src/lib/attendance/stamp.ts`
- `src/lib/auth/pin.ts`

---

## A-004 店長の担当店舗設定

- 実装日: 2026-06-25
- 種別: 権限管理/DB操作

### 実装内容

- オーナー向け `/owner/sr-accounts` を権限管理画面として Supabase 実データに接続。
- `user_profiles.role = manager` の店長ユーザー一覧を表示。
- `manager_store_permissions` の担当店舗一覧を表示。
- 店長ユーザーへの担当店舗追加を実装。
- 店長ユーザーからの担当店舗解除を実装。
- オーナーダッシュボードに権限管理カードを追加。
- 更新はオーナーの `organization_id` にスコープして実行するようにした。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(authenticated)/owner/page.tsx`
- `src/app/(authenticated)/owner/sr-accounts/page.tsx`

---

## A-003 スタッフ管理の実装

- 実装日: 2026-06-25
- 種別: 業務画面/DB操作

### 実装内容

- オーナー向け `/owner/staff` を Supabase 実データに接続。
- スタッフ一覧を `staff` から取得して表示。
- スタッフの新規作成を実装。
- 氏名、ふりがな、従業員コード、雇用形態、時給、電話、メール、入社日、退職日の編集を実装。
- スタッフの有効/無効切り替えを実装。
- `default_store_id` と `store_staff_assignments` による所属店舗設定を実装。
- 店舗iPad打刻用PINを `scrypt` 形式のハッシュで保存する更新処理を実装。
- 個人スマホ利用者向けに `auth_user_id` の紐づけを実装。
- すべての更新をオーナーの `organization_id` にスコープして実行するようにした。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(authenticated)/owner/staff/page.tsx`

---

## A-002 店舗管理の実装

- 実装日: 2026-06-25
- 種別: 業務画面/DB操作

### 実装内容

- オーナー向け `/owner/stores` を Supabase 実データに接続。
- 店舗一覧を `stores` から取得して表示。
- 店舗の新規作成を実装。
- 店舗名、店舗コード、住所、緯度、経度、GPS許容半径の編集を実装。
- 店舗の有効/無効切り替えを実装。
- 店舗iPad打刻に使う `kiosk_devices` の一覧表示、端末登録、有効/無効切り替えを実装。
- すべての更新をオーナーの `organization_id` にスコープして実行するようにした。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `src/app/(authenticated)/owner/stores/page.tsx`

---

## A-001-PART Supabase Authログイン基盤追加

- 実装日: 2026-06-25
- 種別: 認証/アクセス制御

### 実装内容

- Supabase Auth のメール/パスワードログインをオーナー、社労士、店長ログイン画面へ接続。
- ログイン後に `/api/auth/session` で `user_profiles.role` を取得し、ロール別にリダイレクトする処理を追加。
- 店長は `manager_store_permissions` の先頭担当店舗へ自動リダイレクトする方針で実装。
- オーナー画面、社労士画面、店長店舗画面にサーバー側アクセス制御を追加。
- `/auth/logout` でSupabase Authからログアウトできるようにした。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。

### 残タスク

- スタッフ個人スマホ画面をログイン必須にする。
- Authユーザー作成/招待フローを実装する。
- パスワードリセットを実装する。

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

---

## A-000-PHASE1 日報アプリ向け外部連携API Phase 1 実装

- 実装日: 2026-06-25
- 種別: API/DBマイグレーション

### 実装内容

- `external_api_keys` テーブル追加用マイグレーションを作成。
- `X-External-Api-Key` ヘッダのAPIキー認証を実装。
- APIキーはSHA-256ハッシュで照合し、平文保存しない方針で実装。
- 外部API共通エラー応答を実装。
- `GET /api/external/v1/health` を実装。
- `GET /api/external/v1/stores` を実装。
- `GET /api/external/v1/staff` を実装。
- `GET /api/external/v1/attendance` を実装。
- APIキー生成・ハッシュ化用の `npm run external-api:hash-key` を追加。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。
- `npm run external-api:hash-key -- test-key` が成功。

### 残タスク

- `supabase/migrations/202606250002_external_api_keys.sql` をSupabase SQL Editorで適用する。
- `organizations` と `external_api_keys` に実データを登録する。
- 日報管理アプリ側から実API呼び出しを検証する。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `docs/database-design.md`
- `docs/integrations/attendance-api-spec.md`
- `package.json`
- `scripts/hash-external-api-key.mjs`
- `src/app/api/external/v1/`
- `src/lib/external-api/`
- `src/lib/supabase/database.types.ts`
- `supabase/migrations/202606250002_external_api_keys.sql`

---

## S-004 Supabaseプロジェクト作成・接続

- 実装日: 2026-06-25
- 種別: 環境構築/DB接続

### 実装内容

- Supabaseプロジェクト `Attendance_app_withCodeX_20260625` を作成。
- SupabaseプロジェクトとGitHubリポジトリを連携。
- 勤怠アプリ側 `.env.local` に Supabase URL、publishable key、secret key を設定。
- `supabase/migrations/202606250001_initial_attendance_schema.sql` を Supabase SQL Editor で適用。
- `/api/internal/supabase/health` で Supabase DB 接続を確認。

### 確認内容

- `.env.local` に必要な3項目が設定済みで、Git管理対象外のままであることを確認。
- publishable key / secret key の形式で設定されていることを確認。
- 初期マイグレーション実行後、`/api/internal/supabase/health` が HTTP 200 を返すことを確認。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `.env.local`（Git管理対象外）
- Supabaseプロジェクト `Attendance_app_withCodeX_20260625`

---

## DOC-001 作業管理ファイル整備

- 実装日: 2026-06-25
- 種別: ドキュメント/運用ルール

### 実装内容

- 今後の作業順を管理する `NEXT.md` を作成。
- 完了した作業を記録する `FINISHED.md` を作成。
- `README.md` を日本語のプロジェクト説明へ書き直し。
- 今後、実装完了時は `FINISHED.md` と `CHANGELOG.md` を更新する運用を明記。

### 確認内容

- `NEXT.md` に S/A/B/C の優先度と `S-001` 形式の項目IDを追加。
- `README.md` にプロジェクト目的、技術スタック、作業管理ルールを追加。

### 影響ファイル

- `NEXT.md`
- `FINISHED.md`
- `README.md`
- `CHANGELOG.md`

---

## S-001 DB方針の確定

- 実装日: 2026-06-25
- 種別: 仕様決定

### 実装内容

- DBは Supabase PostgreSQL で継続する方針に確定。
- Firebase移行は現時点では保留とした。
- 初期スキーマは `supabase/migrations/202606250001_initial_attendance_schema.sql` を正とする方針に整理。

### 確認内容

- `docs/implementation-decisions.md` に決定内容を記録。
- `NEXT.md` の `S-001` を完了扱いに更新。

### 影響ファイル

- `docs/implementation-decisions.md`
- `NEXT.md`

---

## S-002 打刻方式の仕様確定

- 実装日: 2026-06-25
- 種別: 仕様決定

### 実装内容

- 店舗iPad打刻は、スタッフ一覧から氏名選択後、PIN入力で本人確認する方式に確定。
- 個人スマホ打刻は、スタッフログイン後、店舗選択とGPS検証を行う方式に確定。
- LINE打刻は、初期実装ではGPS付きWeb打刻URLへ誘導する方式を優先する方針に確定。

### 確認内容

- `docs/implementation-decisions.md` に決定内容を記録。
- `NEXT.md` の `S-002` を完了扱いに更新。

### 影響ファイル

- `docs/implementation-decisions.md`
- `NEXT.md`

---

## S-003 権限設計の確定

- 実装日: 2026-06-25
- 種別: 仕様決定

### 実装内容

- オーナー、店長、社労士、スタッフの権限方針を確定。
- 店長は担当店舗のみ、社労士は許可組織のみ閲覧する方針に整理。
- スタッフの打刻書き込みはDB直接書き込みではなく、サーバー側APIで検証してから service role で行う方針に確定。

### 確認内容

- `docs/implementation-decisions.md` に決定内容を記録。
- `NEXT.md` の `S-003` を完了扱いに更新。

### 影響ファイル

- `docs/implementation-decisions.md`
- `NEXT.md`

---

## DOC-002 GitHub自動コミット/push運用の明記

- 実装日: 2026-06-25
- 種別: ドキュメント/運用ルール

### 実装内容

- 特別な指示がない限り、作業完了後にGitHubへコミットとpushまで行う運用を `README.md` に明記。

### 確認内容

- `README.md` の作業管理ルールに追記済み。

### 影響ファイル

- `README.md`
- `FINISHED.md`
- `CHANGELOG.md`

---

## S-004-PART Supabase接続確認基盤追加

- 実装日: 2026-06-25
- 種別: 実装/ドキュメント

### 実装内容

- Supabaseプロジェクト作成後に使うセットアップ手順を `docs/supabase-setup.md` に追加。
- `.env.local` に設定すべき Supabase URL、anon key、service role key の扱いを整理。
- 初期マイグレーション `supabase/migrations/202606250001_initial_attendance_schema.sql` の適用手順を追加。
- service role 経由で `organizations` テーブルへ接続できるか確認する `/api/internal/supabase/health` を追加。
- S-004の未完了項目として、実プロジェクト作成、マイグレーション適用、`.env.local` 設定が残ることを `NEXT.md` に明記。

### 確認内容

- `npm run lint` が成功。
- この環境では `supabase` コマンドが未インストールであることを確認。

### 影響ファイル

- `NEXT.md`
- `README.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `docs/database-design.md`
- `docs/supabase-setup.md`
- `src/app/api/internal/supabase/health/route.ts`

---

## DOC-003 日報アプリ向け外部連携APIの実装計画整理

- 実装日: 2026-06-25
- 種別: ドキュメント/実装計画

### 実装内容

- 日報管理アプリが勤怠データを取り込むための外部連携API仕様を `docs/integrations/attendance-api-spec.md` に追加。
- GitHub親Issue #1 と子Issue #2〜#7 の実装順を `NEXT.md` に追加。
- Phase 1を `#2 APIキー認証`, `#3 health/stores/staff`, `#4 attendance一覧` として整理。
- Phase 2を `#5 詳細/events`, `#6 APIキー管理画面`, `#7 レート制限/アクセスログ` として整理。
- 勤怠アプリを出退勤データの正本、日報アプリを読み取り側とする方針を関連ドキュメントへ反映。

### 確認内容

- `NEXT.md` に `A-000 日報アプリ向け外部連携API` を追加済み。
- `docs/implementation-decisions.md` に外部連携APIの決定事項を追加済み。
- `docs/database-design.md` に連携API用テーブル予定と連携方針を追加済み。
- `README.md` に日報アプリ連携の目的と仕様書リンクを追加済み。

### 影響ファイル

- `NEXT.md`
- `README.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `docs/database-design.md`
- `docs/implementation-decisions.md`
- `docs/integrations/attendance-api-spec.md`
