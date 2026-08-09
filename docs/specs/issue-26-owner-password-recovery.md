# Issue #26 オーナー本人向け公開パスワード再設定

## 背景と目的

- 対象の課題: GitHub Issue #26「オーナー本人向け公開パスワード再設定を追加する」。
- 利用者の意図: オーナーがログイン情報を失った場合でも、Supabase Dashboardの手作業に依存せず、登録済みメールで本人確認して新しいパスワードを設定できるようにする。
- 非目標: staff、manager、srの自己再設定、本番Supabaseへのマイグレーション適用、Supabase AuthのURL・メールテンプレート設定変更、実メール送信。既存staffの到達先と挙動は回帰テストで維持する。

## 要件

- 公開画面 `/owner/password-recovery` はメールアドレスだけを受け付ける。
- 公開要求APIは、入力の妥当性、アカウント有無、ロール、有効状態、メール不整合、送信失敗を問わず、同じ本文とHTTP `202` を返す。
- 公開要求は2KBを超える本文を処理せず、Vercelが確定した接続元IPと正規化メールをHMAC化した15分固定窓で、IPあたり20件、メールあたり5件に制限する。制限・DB障害時も同じ`202`を返し、IP・メールを保存しない。
- owner整合性確認とメール送信はVercelの管理対象バックグラウンドタスクへ分離し、公開応答を外部プロバイダーの所要時間から切り離す。
- 送信対象は、正規化したメールが一致し、`user_profiles.role = owner`、`user_profiles.is_active = true`、プロフィールIDとAuthユーザーID、プロフィールメールとAuthメールがすべて一致するユーザーだけに限定する。
- 回復OTPの確認後、owner専用の短命・単回利用のHttpOnly Cookieを発行する。スタッフ用Cookie・intent・更新APIは受け付けない。
- intentはtoken hashと要求ごとのclaim IDを使うDB関数で更新前に原子的にclaimする。claim中はownerプロフィールのrole・有効状態・メール変更と削除、新しいintent発行を同じadvisory lockで拒否する。並行claimの敗者は無効intentではなくbusyとして扱う。
- Auth更新の直前と直後にownerの有効状態とAuth/Profileメール一致を再検証する。明確なAuth拒否ではclaimをreleaseして再試行を許可し、成功時はfinalizeする。更新結果不明または更新後不整合ではintentをquarantineし、プロフィール無効化とAuth資格情報のランダム化・banを行う。
- callbackと更新APIは同一Originだけを許可し、失敗時はowner intent Cookieを消去する。
- トークン、平文パスワード、メールアドレス、送信成否を画面、URL、監査ログ、エラー応答へ出さない。

## 設計

- `owner_password_recovery_intents` と `issue_owner_password_recovery_intent` を追加する。RLSを有効化し、`service_role` 以外にはテーブルと関数の権限を付与しない。
- `owner_password_recovery_rate_limit_windows` と原子的なconsume関数を同じmigrationへ追加する。保存値はHMACだけとし、公開ロールの全DML・関数実行を拒否する。IP上限到達後はメール行を作らず、1日より古い行を1要求あたり最大100件削除する。
- 公開要求はレート制限通過後、`waitUntil()`で管理するレスポンス後タスク内でownerの整合性を確認し、anon権限のSupabase Authクライアントで `resetPasswordForEmail` を実行する。外部応答は常に成功相当に固定する。
- owner callbackはSupabase recovery OTPを検証し、owner整合性を確認してから、DB-backed intentを発行して `/auth/owner-password` へ303で遷移する。
- `/api/auth/owner-password` はCookie内token hashを要求固有IDでclaimし、claimが返したuser IDのowner整合性を更新直前・直後に確認してからfinalizeする。並行claimのbusyと明確な4xx拒否はCookieを保持し、4xx拒否ではclaimもreleaseする。結果不明または更新後不整合はプロフィールとAuth資格情報を補償的に無効化する。
- `staff_password_intents`、`/auth/confirm`、`/api/auth/staff-password` は既存のまま維持する。共通Recoveryテンプレートは `RedirectTo` を使い、staffは `/auth/confirm`、ownerは `/auth/owner-confirm` を明示指定する。

## 受入条件と検証

- [ ] valid owner、未登録、staff、manager、sr、無効owner、メール不整合のすべてで公開レスポンスが完全に一致し、valid ownerだけ送信処理へ到達する。
- [ ] 公開要求は本文上限とIP・メール別レート制限を通り、owner確認・メール送信の完了を待たず、制限時・障害時も同じ202を返す。DBへ平文IP・メールを保存しない。
- [ ] owner callbackは`recovery`だけを受け入れ、無効OTP・非owner・メール不整合・cross-originでintentを発行しない。
- [ ] owner更新APIは有効かつ未消費のowner intentだけを受け入れ、弱いパスワード・cross-origin・失効・二重送信・更新前後のrole剥奪・メール不整合・Auth結果不明をfail-closeする。claim busyと明確な更新拒否は同じCookieで再試行できる。
- [ ] 実PostgreSQLでowner intentとレート窓の公開ロール全DML・関数実行拒否、同一tokenの並行claimが1件だけ成功して敗者がbusyになること、claim中の新規intent発行とプロフィール変更拒否、release後の変更許可、quarantine時の無効化、IP上限後にメール行が増えないことを確認する。
- [ ] owner用とstaff用のCookie、intent、更新APIを相互に流用できない。
- [ ] `npm test`、`npm run lint`、`npm run build`、`python3 -m unittest ci.test_policy_check ci.test_supabase_advisor_migrations`、`python3 ci/policy_check.py`、`git diff --check`が成功する。
- [ ] Runtime smokeは、実メールを送らないfixtureまたはモックで公開画面、同一文言、更新画面の無効リンク表示を確認する。

## ロールバック方針

- 問題が判明した場合は、owner用Route・画面・intentテーブル・関数を同じリリース単位でrevertする。
- 本PRでは本番DBに適用しない。適用後にrevertする場合は、未消費intentを無効化してからテーブルと関数を削除する別マイグレーションを作成する。
