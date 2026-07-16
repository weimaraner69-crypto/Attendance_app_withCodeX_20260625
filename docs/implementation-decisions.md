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

## A-001 管理ユーザーのPIN再ログイン

- 対象は店長、オーナー、社労士とする。スタッフ個人スマホログインは従来のSupabase Authを維持する。
- 初回は必ずSupabase Authのメールアドレス/パスワードで本人確認し、その直後に4桁PINを設定する。
- PIN登録開始APIはSupabase Authの最終サインイン時刻が直近5分以内であることを確認し、古いセッションからのPIN登録を拒否する。
- PIN再ログインは同じブラウザかつ初回認証から6時間以内だけ許可する。
- 6時間の期限は延長しない。PINで再ログインしても期限は初回認証時刻から固定する。
- 「画面をロック」はSupabaseセッションを維持したままPIN解除状態だけを破棄する。
- 「完全ログアウト」はSupabaseセッション、6時間の端末認証、PIN解除状態をすべて破棄する。
- PINは平文保存せずscryptハッシュだけを専用の `user_login_pins` へ保存する。
- `user_login_pins` はRLSを有効化し、ブラウザ向けポリシーを作らず、service roleを使うサーバーからだけアクセスする。
- PINを5回連続で間違えた場合は10分間ロックし、成功時に失敗回数をリセットする。
- 6時間の端末認証とPIN解除状態は、サーバーだけが読める署名付きHttpOnly Cookieで管理する。

## A-001 スタッフAuth招待とパスワード設定

- オーナーは `/owner/staff` から有効な未紐付けスタッフをメール招待する。平文パスワードとAuth UUIDは入力しない。
- `staff.auth_user_id` にはSupabase Admin APIの招待応答が返したユーザーIDだけを使う。
- 招待前に同一組織、`staff` ロール、有効状態、メール重複、既存紐付けを検証する。
- Auth招待後の `user_profiles` 作成または `staff` 紐付けが失敗した場合、作成直後のAuthユーザーを削除して中途状態を残さない。
- invite/recoveryメールは `/auth/confirm` へ戻し、ユーザーの明示的なPOST後に `token_hash` と種別を `verifyOtp` する。許可する種別は `invite` と `recovery` だけとする。
- Authユーザー、`user_profiles(role = staff)`、有効な `staff.auth_user_id` の組織が一致した場合だけ、DBにトークンハッシュを保存する10分有効・単回利用のHttpOnlyパスワード設定権限を発行する。
- `verifyOtp` は `persistSession=false`、`detectSessionInUrl=false` のリクエスト内専用Supabaseクライアントで行い、callback用AuthセッションをCookieやstorageへ永続化しない。
- intent発行はadvisory lock付きsecurity definer関数と未消費 `user_id` の部分一意索引で直列化する。パスワード更新は設定権限を原子的に消費する同一OriginのサーバーAPIだけでAdmin API経由で行う。期限切れ・改ざん・同時再利用・通常staffセッションはfail-closeする。
- `staff.auth_user_id` と組織の対応はDBの複合外部キーで固定し、staff本人参照を行うRLSも `private.current_user_organization_id()` との一致を必須とする。
- 送信した招待・再設定操作は `audit_logs` へ記録するが、メール本文、トークン、Auth UUIDは記録しない。
- Auth紐付け後のスタッフメールは直接変更不可とし、将来Auth・`user_profiles`・`staff`を同期する確認付き変更フローを実装するまで現在値を維持する。UIの読み取り専用表示に加え、サーバー更新も`auth_user_id`と更新開始時メールの一致条件で競合をfail-closeする。
- 招待時のスタッフ紐付けは、招待開始時に読んだメールがDB上で変わっていない場合だけ許可する。競合時は作成したAuthユーザーを補償削除し、古いメールのAuth/profileをスタッフへ紐付けない。
- パスワード再設定は、`staff`と`user_profiles`だけでなくSupabase Auth Admin APIの実ユーザーID・メールも一致する場合だけ送信する。未紐付けメールの作成・更新は既存profileと同一組織staffの重複検査をfail-closeで行う。
- 招待・再設定の主処理成功後に監査ログ保存が失敗した場合、メール送信失敗として再試行させず、専用の部分成功状態で完了範囲と運用確認の必要性を表示する。
- スタッフ別の招待・再設定操作は対象スタッフ名をaccessible nameへ含め、結果は成功を`status`、失敗・部分成功を`alert`として通知する。

## A-000 日報アプリ向け外部連携API

- 勤怠管理アプリを出退勤データの正本とし、日報管理アプリは外部API経由で読み取り専用にする。
- 日報管理アプリ側の手入力は当面残し、初期連携は「取り込み後に微修正可」とする。
- 勤怠側は `attendance_records` を日別勤怠結果、`attendance_events` を監査用打刻ログとして返す。
- 勤怠側は自分のUUID体系で店舗ID・スタッフID・勤怠記録IDを返し、日報側とのIDマッピングは日報側の責務とする。
- 外部APIの認証は `X-External-Api-Key` ヘッダによるAPIキー方式とし、APIキーは平文保存しない。
- Phase 1 は `health`, `stores`, `staff`, `attendance` の読み取りAPIまでを最小リリースとする。
- `attendance/{id}`, `include_events`, APIキー管理画面、レート制限、APIアクセスログは Phase 2 として扱う。
- レート制限はAPIキー単位の固定1分窓60件とし、PostgreSQLの原子的upsertを正本にする。アプリプロセス内メモリは、複数インスタンス間で共有できないため使用しない。
- レートカウンターは61で飽和させ、遅延した旧窓の呼び出しで現在窓を巻き戻さない。429後は組織取得と `last_used_at` 更新を行わない。
- 認証後の外部API処理は共通ラッパーを通し、正常・エラー・429・例外のすべてへレートヘッダーとアクセスログを一貫して適用する。
- `GET` / `HEAD` 以外も共通ラッパー経由の405とし、未対応メソッドによる認証・レート制限の迂回を許さない。
- アクセスログはキーID、パス、HTTP状態、時刻だけを保存し、APIキー、クエリ文字列、本文を保存しない。429はキー・パス・窓ごとに集約し、ログ待機は250msで打ち切る。ログ保存失敗・遅延はAPI本体の応答を壊さない。
- 詳細仕様は `docs/integrations/attendance-api-spec.md` を正とする。
