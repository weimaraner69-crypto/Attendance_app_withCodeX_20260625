# Implementation Decisions

実装方針として確定した内容を記録します。

## S-001 DB方針

- DBは Supabase PostgreSQL を前提に継続する。
- Firebase移行は現時点では保留する。
- 初期スキーマは `supabase/migrations/202606250001_initial_attendance_schema.sql` を正とする。
- DBアクセスは、ブラウザ用client、サーバー用client、service role用admin clientを分ける。

## S-002 打刻方式

### 店舗iPad打刻

- 店舗設置iPadから打刻する。
- スタッフ一覧から氏名を選択する。
- PINを入力して本人確認する。
- PIN検証後に、出勤、退勤、休憩開始、休憩終了を記録する。
- PINは平文保存せず、サーバー側でハッシュ化して保存する。

### 個人スマホ打刻

- スタッフはメールアドレス・パスワードでログインする。
- ログイン後、自分が勤務可能な店舗を選択する。
- GPSを取得して店舗距離を検証する。
- 出勤、退勤、休憩開始、休憩終了を記録する。
- GPSログは `attendance_events` に保存する。

### LINE打刻

- 初期実装では、LINEから直接DBへ打刻する方式は採用しない。
- LINEからGPS付きWeb打刻URLへ誘導する方式で実装する。
- LINE経由のシフト希望提出は、連携済みアカウントを確認して `source = line` を記録する。
- Webhookはraw bodyに対するHMAC-SHA256署名検証を必須とする。
- 将来的にLINE位置情報送信を使った直接打刻も検討可能とする。

## S-003 権限設計

- オーナーは自組織の全店舗、スタッフ、勤怠、シフトを管理できる。
- 店長は `manager_store_permissions` で許可された店舗のみ管理できる。
- 社労士は `sr_organization_permissions` で許可された組織を閲覧できる。
- スタッフは自分の勤怠とシフトを閲覧できる。
- スタッフの打刻書き込みは、RLSで直接許可せず、サーバー側APIで検証してから service role 経由で行う。
- service role key はサーバー専用とし、ブラウザへ公開しない。

## A-000 日報アプリ向け外部連携API

- 勤怠管理アプリを出退勤データの正本とし、日報管理アプリは外部API経由で読み取り専用にする。
- 日報管理アプリ側の手入力は当面残し、初期連携は「取り込み後に微修正可」とする。
- 勤怠側は `attendance_records` を日別勤怠結果、`attendance_events` を監査用打刻ログとして返す。
- 勤怠側は自分のUUID体系で店舗ID・スタッフID・勤怠記録IDを返し、日報側とのIDマッピングは日報側の責務とする。
- 外部APIの認証は `X-External-Api-Key` ヘッダによるAPIキー方式とし、APIキーは平文保存しない。
- Phase 1 は `health`, `stores`, `staff`, `attendance` の読み取りAPIまでを最小リリースとする。
- `attendance/{id}`, `include_events`, APIキー管理画面、レート制限、APIアクセスログは Phase 2 として扱う。
- 詳細仕様は `docs/integrations/attendance-api-spec.md` を正とする。
