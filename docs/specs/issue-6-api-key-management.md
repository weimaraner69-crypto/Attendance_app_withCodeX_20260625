# Issue #6 オーナー向けAPIキー管理画面仕様

## 背景と目的

- 対象の課題: GitHub Issue #6
- 利用者の意図: オーナーが、日報アプリなどの外部連携先ごとにAPIキーを発行、確認、無効化できるようにする。
- 非目標: 日報アプリとの実接続、外部APIのレスポンス契約変更、外部キーのローテーション自動化、本番Supabaseへの変更。

## 要件

- FR-006-01: `/owner/integrations/api-keys` はオーナー権限だけが利用できる。
- FR-006-02: 発行時に名前、許可済みスコープ、有効期限を設定できる。現時点の許可済みスコープは `attendance:read` だけとする。
- FR-006-03: 有効期限はJSTの日付で入力し、指定日の23:59:59.999 JSTを `expires_at` に保存する。未指定は無期限とする。
- FR-006-04: 発行する平文キーは暗号学的乱数から生成し、DBにはSHA-256ハッシュだけを保存する。
- FR-006-05: 平文キーは発行成功直後の画面状態で一度だけ表示する。URL、Cookie、localStorage、一覧、監査ログ、例外メッセージには出さない。
- FR-006-06: 一覧は `name`、`scopes`、`is_active`、`last_used_at`、`created_at`、`expires_at` だけを表示し、`key_hash` を取得・表示しない。
- FR-006-07: 無効化は対象キーIDとログイン中オーナーの組織IDの両方で絞り、再有効化は提供しない。
- FR-006-08: 発行・無効化は監査ログへ記録する。ログには平文キーとハッシュを含めない。監査ログ保存失敗時も、キー発行・無効化の主処理が成功した事実を失わせない。
- 制約: Server Actionの冒頭でオーナー認可を行い、service roleクライアントのRLS迂回を組織ID条件で補完する。

## 設計

- 変更する責務境界: `src/lib/external-api` に入力検証・キー生成・ハッシュ化の純粋関数を置き、Server Actionは認可、組織境界、DB書き込み、再検証だけを担う。
- データ / API: 既存の `external_api_keys` と `audit_logs` を利用する。必要な列とserver-only RLSは既存migrationにあるため、新規migrationは作らない。
- UI: サーバーコンポーネントでキー一覧を読み取り、クライアントコンポーネントで発行フォーム、一度だけの結果表示、コピー、無効化操作を提供する。オーナーダッシュボードから遷移可能にする。
- 失敗時の扱い: 不正な名前、スコープ、有効期限は発行せず画面内で理由を表示する。DB書き込み失敗時は平文キーを返さない。既に無効、別組織、存在しないキーの無効化は成功扱いにせず、状態を再取得する。監査ログ失敗は平文を含まない警告として扱う。

## 受入条件と検証

- AC-006-01: owner以外の画面・Server Action操作は許可されない。
- AC-006-02: `name`、`attendance:read`、JST日付の有効期限を指定して発行できる。
- AC-006-03: 平文キーは発行直後だけ表示され、一覧、URL、永続クライアント領域、監査ログには含まれない。
- AC-006-04: 一覧に `name`、`scopes`、`is_active`、`last_used_at`、`created_at`、`expires_at` が表示される。
- AC-006-05: 無効化したキーは既存の外部API認証で `403 FORBIDDEN` となる。
- AC-006-06: 無効・失効・スコープ不足キーの既存認証回帰が成功する。
- AC-006-07: 発行と無効化の監査ログにキーの平文・ハッシュが含まれない。
- 検証コマンド: `npm test`、`npm run lint`、`npm run build`、`python3 -m unittest ci.test_policy_check ci.test_supabase_advisor_migrations`、`python3 ci/policy_check.py`、`git diff --check`。
- Runtime smoke: 未認証の `/owner/integrations/api-keys` がログインへ遷移すること、ダミーのowner認可・キー一覧を使うSSRスモークで発行フォーム、一覧列、無効化ボタン、「再表示不可」の表示を確認する。実キー、実データ、本番環境は使わない。
- ロールバック方針: UI、Server Action、キー管理補助関数をこのPRの直前状態へ戻す。既存テーブルへの追加migrationはないため、発行済みキーはオーナー画面から無効化して切り戻す。
