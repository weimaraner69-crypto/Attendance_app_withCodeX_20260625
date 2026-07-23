# Expectation Ledger

ユーザーの意図を、requirements、design、spec、implementation へ変換する前に記録する。

## テンプレート

### EXP-YYYYMMDD-001

- 元のユーザー意図:
- AI の解釈:
- ユーザー可視の成果:
- 非目標:
- 制約:
- 影響する requirements:
- 影響する design:
- 作成・更新した spec:
- plan queue entry:
- 受入条件:
- Runtime smoke:
- 結果:

## 記録

### EXP-20260723-002

- 元のユーザー意図: PR #21のマージ後、次の作業へ進める。
- AI の解釈: 日報アプリの実接続を保留したまま、`NEXT.md` の次タスクであるIssue #6を要件、設計、実装、回帰テスト、PRまで進める。
- ユーザー可視の成果: オーナーが外部連携先のAPIキーを発行、一覧確認、無効化でき、平文キーは発行直後にだけ確認できる。
- 非目標: 日報アプリとの実接続、外部APIの詳細エンドポイント、本番Supabase変更、実キーの発行。
- 制約: owner認可と組織境界をServer Actionで強制し、平文キーとハッシュをURL、ログ、監査ログ、クライアント永続領域へ残さない。
- 影響する requirements: `README.md` の日報アプリ向け読み取りAPI、GitHub Issue #6。
- 影響する design: `docs/implementation-decisions.md` のA-000外部連携API、`docs/database-design.md` の `external_api_keys`。
- 作成・更新した spec: `docs/specs/issue-6-api-key-management.md`。
- plan queue entry: `NEXT.md` A-000 Issue #6。
- 受入条件: owner限定、名前・スコープ・失効日の設定、平文一度表示、一覧の非露出、無効化、既存外部APIでの無効キー拒否、監査ログの非露出。
- Runtime smoke: 未認証のログイン遷移とowner画面の発行フォーム、一覧列、無効化操作、再表示不可の表示を確認する。
- 結果: 実装中。

### EXP-20260716-001

- 元のユーザー意図: 「計画に沿って進めてください」
- AI の解釈: PR #19完了後の次タスクであるIssue #16を、既存のPR・独立レビュー・CI運用に従って実装する
- ユーザー可視の成果: Auth紐付け済みメールが誤変更されず、招待・再設定の監査失敗が部分成功として表示され、支援技術が対象操作と結果を識別できる
- 非目標: Auth・`user_profiles`・`staff`を横断するメール変更機能、本番Supabase変更、実メール送信、本番デプロイ
- 制約: owner認可と組織境界を維持し、秘密情報や実メールアドレスを証跡へ記録しない
- 影響する requirements: `README.md` のスタッフAuth運用品質、GitHub Issue #16
- 影響する design: `docs/implementation-decisions.md` のA-001スタッフAuth
- 作成・更新した spec: `docs/specs/issue-16-staff-auth-followups.md`
- plan queue entry: `NEXT.md` A-001 Issue #16
- 受入条件: 紐付け済みメールの二重防御、招待中のメール競合防止、再設定前のAuth実体照合、監査失敗の部分成功、対象者付きaccessible name、結果live region、回帰テストと品質ゲート成功
- Runtime smoke: 結果・メール入力コンポーネントのSSR出力でrole、accessible name、単一メール入力を確認し、未認証owner routeのlogin遷移をブラウザ確認する
- 結果: PR #20 Round 1の原子性・統合テスト・文書整合指摘を修正し、実PostgreSQL並行回帰まで成功。Round 2独立レビューとCI待ち

以下は記入例（架空の一般例）である。運用開始後はこの例を残したまま、実際の意図変換エントリを追記する。

### EXP-20260101-001

- 元のユーザー意図: AI Operating Model を導入し、入口文書を `ai/*.yml` を参照する薄い入口へ改定する
- AI の解釈: 日常 3 コマンド、仕様駆動開発、文書読込範囲、PR 前批判レビュー、`release_to_main` risk tier を安定制御ファイルへ集約する
- ユーザー可視の成果: 日常開発で 3 コマンドだけを使い、governance change は別文脈として扱える
- 非目標: 初回棚卸しでの文書削除、AI レビューループの廃止、実装機能の変更
- 制約: P-001 / P-002 / P-003 / P-010、既存 PR 完了ゲート、main 直接コミット禁止
- 影響する要件・仕様: 該当する既存 docs または `README.md` を参照
- 影響する design: `docs/architecture.md` の該当節
- 作成・更新した spec: なし（本例は導入初期のため spec 未作成）
- plan queue entry: `NEXT.md` の該当タスク
- 受入条件: 入口文書の薄化、文書棚卸し生成、PR 前批判レビュー生成、risk tier 反映、一回限りプロンプト非コミット
- Runtime smoke: `validate_context_index.py`、`validate_harness_ready.py`、`audit_document_inventory.py`、`run_pre_pr_critical_review.py`
- 結果: 実施済み
