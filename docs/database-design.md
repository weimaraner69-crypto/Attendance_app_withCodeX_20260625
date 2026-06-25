# Database Design

このアプリのDBは Supabase PostgreSQL を前提にします。
初期スキーマは `supabase/migrations/202606250001_initial_attendance_schema.sql` です。

## 設計方針

- 店舗・スタッフ・勤怠・シフトを実運用できる粒度で分ける。
- 店舗iPad打刻、個人スマホ打刻、LINE打刻、管理者手入力を同じ勤怠イベントとして扱う。
- 日別の勤怠結果は `attendance_records`、監査用の生ログは `attendance_events` に残す。
- 店舗iPadでは、スタッフ一覧から氏名を選び、PIN入力で本人確認して打刻する。
- 個人スマホでは、スタッフがメールアドレス・パスワードでログインし、店舗選択後にGPSログ付きで打刻する。
- LINEアカウントとの紐づけは別テーブルにし、将来LINE打刻・シフト提出へ拡張できるようにする。
- オーナー、店長、社労士、個人スマホ利用スタッフは Supabase Auth のユーザーとして `user_profiles` に登録する。
- 店長は担当店舗のみ、社労士は閲覧・出力中心、オーナーは全体管理を想定する。

## 主要テーブル

| テーブル | 用途 |
|---|---|
| `organizations` | 会社・事業者単位。複数店舗をまとめる最上位。 |
| `user_profiles` | Supabase Auth ユーザーの業務プロフィール。オーナー、店長、社労士を管理。 |
| `stores` | 店舗。店舗コード、住所、GPS座標、打刻許容半径を持つ。 |
| `staff` | スタッフ台帳。氏名、ふりがな、雇用形態、時給、有効/無効、PINハッシュ、スマホログイン用Auth IDを持つ。 |
| `kiosk_devices` | 店舗設置iPadなどの共有打刻端末。店舗に紐づける。 |
| `store_staff_assignments` | スタッフがどの店舗に所属・勤務できるかの履歴。 |
| `manager_store_permissions` | 店長ユーザーが管理できる店舗。 |
| `sr_organization_permissions` | 社労士ユーザーが閲覧できる事業者。 |
| `line_accounts` | LINEユーザーIDとスタッフの紐づけ。将来のLINE打刻・シフト提出用。 |
| `attendance_records` | スタッフごとの日別勤怠結果。画面表示やCSV出力の主データ。 |
| `attendance_events` | 打刻イベントの履歴。Web、LINE、手入力の出所やGPS情報を保存。 |
| `attendance_requests` | 打刻修正、休暇、残業などの申請。 |
| `shifts` | 確定・公開されたシフト。 |
| `shift_submission_windows` | シフト希望提出の募集期間。 |
| `shift_submissions` | スタッフ単位のシフト希望提出。LINE提出にも対応。 |
| `shift_submission_items` | 希望日ごとの希望時間・不可日。 |
| `audit_logs` | 重要操作の監査ログ。 |

## 勤怠データの持ち方

### `attendance_events`

打刻が発生するたびに1行追加します。

- `event_type`: `clock_in`, `break_start`, `break_end`, `clock_out`
- `source`: `kiosk`, `mobile_web`, `line`, `admin_manual`, `system`
- `occurred_at`: 実際の打刻時刻
- `latitude`, `longitude`, `distance_from_store_meters`: GPS検証用
- `kiosk_device_id`, `pin_verified_at`: 店舗iPad打刻の本人確認用
- `auth_user_id`: 個人スマホ打刻時のログインユーザー
- `line_account_id`, `line_message_id`: LINE経由の識別用

このテーブルは「何が起きたか」の履歴なので、原則として削除せず、修正は別イベントや申請で扱います。

### `attendance_records`

1スタッフ1日につき1行です。

- `clock_in_at`
- `clock_out_at`
- `break_minutes`
- `total_work_minutes`
- `night_shift_minutes`
- `status`

画面表示、月次集計、CSV出力はこちらを主に使います。
打刻時には `attendance_events` を追加し、その結果として `attendance_records` を更新します。

## 打刻フロー

### 店舗iPad

店舗に設置しているiPadは `kiosk_devices` として管理します。

想定フロー:

1. 店舗iPadが対象店舗のスタッフ一覧を表示する。
2. スタッフが自分の氏名を選択する。
3. スタッフがPINを入力する。
4. サーバー側APIで `staff.pin_hash` と照合する。
5. 照合成功時のみ `attendance_events.source = kiosk` で打刻イベントを保存する。
6. `attendance_records` の日別勤怠を更新する。

PINは平文保存しません。
`staff.pin_hash` にハッシュ化した値を保存し、PIN失敗回数やロック状態は `pin_failed_attempts`, `pin_locked_until` で管理します。

### 個人スマホ

個人スマホから利用するスタッフは Supabase Auth ユーザーを持ちます。
`staff.auth_user_id` でスタッフ台帳とAuthユーザーを紐づけます。

想定フロー:

1. スタッフがメールアドレス・パスワードでログインする。
2. 自分が所属または勤務可能な店舗を選択する。
3. 出勤・退勤・休憩開始・休憩終了を選んで打刻する。
4. ブラウザでGPSを取得する。
5. サーバー側APIで店舗座標との距離を検証する。
6. `attendance_events.source = mobile_web` としてGPS情報付きで保存する。
7. `attendance_records` の日別勤怠を更新する。

個人スマホ打刻では、店舗に出勤していることの確認としてGPSログを必須にします。

## LINE連携の想定

LINE連携では、LINEの `userId` を `line_accounts.line_user_id` に保存します。

想定フロー:

1. スタッフがLINEで連携開始する。
2. `line_accounts` に `pending` 状態でLINEユーザーを作る。
3. 店長または本人確認フローで `staff_id` と紐づける。
4. 連携完了後、`status = linked` にする。
5. LINEから出勤・退勤・休憩のメッセージやボタン操作を受ける。
6. `attendance_events.source = line` として保存する。
7. 同時に `attendance_records` を更新する。

LINE打刻でGPSを必須にするかは未決定です。
候補は次の2つです。

- LINEの位置情報送信を必須にして、個人スマホ打刻と同じく店舗距離を検証する。
- LINEでは打刻リクエストだけ受け、GPS必須のWeb打刻URLへ誘導する。

不正防止を考えると、最初は「LINEからWeb打刻URLへ誘導」が堅いです。

シフト提出も同じ考え方です。
LINEから提出された希望は `shift_submissions.source = line` として保存し、希望日ごとの内容は `shift_submission_items` に保存します。

## 権限設計

RLSを有効化済みです。

- オーナー: 自組織内の店舗・スタッフ・勤怠・シフトを管理。
- 店長: `manager_store_permissions` で許可された店舗を管理。
- 社労士: `sr_organization_permissions` で許可された組織を閲覧。
- スタッフ: 自分の勤怠・シフトを閲覧。打刻書き込みはサーバー側APIで検証してから行う。

スタッフ向けの打刻APIやLINE Webhookは、Supabase service role を使うサーバー側処理からDBを書き込みます。
ブラウザに service role key は絶対に置きません。

## 次に実装するもの

1. Supabase プロジェクト作成。
2. このマイグレーションを Supabase に適用。
3. `.env.local` に Supabase URL と anon key を設定。
4. `@supabase/supabase-js` を導入。
5. モックAPIを Supabase API に置き換える。
6. 打刻APIを Route Handler として作り、`attendance_events` と `attendance_records` を同時更新する。
7. LINE Webhook 用の Route Handler を追加する。
