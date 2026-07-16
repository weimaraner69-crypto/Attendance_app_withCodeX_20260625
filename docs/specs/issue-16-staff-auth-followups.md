# Issue #16 スタッフAuth運用フォローアップ仕様

## 背景と目的

- 対象の課題: GitHub Issue #16
- 利用者の意図: PR #15で導入したスタッフ招待・再設定を、メール整合性、監査耐久性、アクセシビリティの面で運用可能な状態へ仕上げる。
- 非目標: Authメール変更フローの新設、本番Supabase設定、実メール送信、本番デプロイ。

## 要件

- FR-016-01: `auth_user_id` があるスタッフのメールは、画面操作でも直接POSTでも変更できない。
- FR-016-02: 招待または再設定の主処理成功後に監査ログ保存が失敗した場合、送信失敗と誤表示せず「主処理成功・監査失敗」の部分成功を返す。
- FR-016-03: 招待・再設定ボタンのaccessible nameに対象スタッフ名を含める。
- FR-016-04: 結果表示は成功を `role=status`、失敗と部分成功を `role=alert` で通知する。
- 制約: owner認可、組織境界、Auth/profile/staff一致検証、秘密情報非記録を維持する。
- セキュリティ・権限: メール不変条件はUIだけに依存せず、service roleで更新するサーバー処理でも現在値を強制する。
- 競合制御: 招待開始後にスタッフメールまたはAuth紐付けが変わった場合は、古いメールのAuthユーザーを紐付けず補償削除する。
- 再設定対象: 再設定メール送信直前に、`staff`、`user_profiles`、Supabase AuthユーザーのIDとメールがすべて一致することを確認する。

## 設計

- 変更する責務境界: メール更新値の決定を純粋関数へ分離し、スタッフ更新server actionが現在行を取得して適用する。
- データ / API: 旧・新メールをadvisory transaction lockで直列化するstaff triggerと、同じロック内で対象staffを再検査してprofileを作るservice role限定RPCを追加する。アプリ側の事前検査も早期エラー用に維持する。
- 失敗時の扱い: 監査insertのresolved errorと例外を同じ部分成功へ正規化する。profile作成またはstaff紐付けの失敗・例外は招待Authユーザーを補償削除し、補償削除の失敗・例外は運用確認が必要なcleanup failureとする。

## 受入条件と検証

- AC-016-01: 紐付け済みスタッフへ異なるメールを送信しても、更新値は既存メールになる。
- AC-016-02: 未紐付けスタッフは従来どおりメールを編集できる。
- AC-016-03: 招待・再設定の監査失敗と監査例外が、それぞれ専用の部分成功コードになる。
- AC-016-04: 成功結果は`status`、失敗・部分成功は`alert`でSSR描画される。
- AC-016-05: 招待・再設定操作名に対象スタッフ名が含まれる。
- AC-016-06: 招待中にスタッフメールが変更された場合、紐付けを中止して招待したAuthユーザーを補償削除する。
- AC-016-07: 再設定前のSupabase Authユーザーが欠落、ID不一致、メール不一致の場合は送信しない。
- 検証コマンド: `npm test`、`npm run lint`、`npm run build`、`python3 -m unittest ci.test_policy_check ci.test_supabase_advisor_migrations`、`python3 ci/policy_check.py`、`psql --set ON_ERROR_STOP=1 --file ci/test_staff_auth_postgres.sql`、`bash ci/test_staff_auth_postgres_concurrency.sh`、`git diff --check`。
- Runtime smoke: React SSRのHTML出力で成功/部分成功/失敗のrole、`aria-atomic`、対象者付き操作名、未紐付けフォーム内の単一メール入力を確認する。認証済みowner実データを必要とするroute操作は非目標とし、未認証時の`/owner/staff`から`/login`への遷移だけをブラウザ確認する。
- ロールバック方針: UIコンポーネント、部分成功コード、メール更新解決関数を直前実装へ戻す。DBはprofile作成RPCとstaff triggerを使うため、適用後の単独ロールバックは既存メール重複を確認してから別migrationで行う。
