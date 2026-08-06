# Decision Ledger

日常開発で AI が曖昧さを内部解決した場合に使う。会話ログではなく、このファイルに判断を残す。

## テンプレート

### DEC-YYYYMMDD-001

- 論点:
- 判断:
- 仮定:
- 理由:
- 影響ファイル:
- リスク:
- ロールバック:

Capability Lease（ユーザーが明示的に一時的な自律実行範囲を認可した場合）を記録する際は、以下のフィールドも追加する。

### DEC-YYYYMMDD-NNN（capability lease）

- 論点:
- granted_by: ユーザー明示指示（引用または要約）
- scope: 認可された変更範囲・対象ファイル
- granted: 認可された操作（実装・PR 化・特定ゲート通過後の merge 等）
- excluded: `safety.hard_block` 全項目など、lease の対象外
- expiry_condition: 失効条件（完了時点・ユーザーの撤回時 等）
- 記録者注: 本 lease は AI の自己記録ではなくユーザー指示の引用に基づく

## 記録

### DEC-20260806-002

- 論点: ログイン情報を失ったownerが、Supabase Dashboardの手作業なしに安全に復旧する方法。
- 判断: staff用の確認・intentを流用せず、owner専用の公開要求、Auth/Profile整合性確認、DB-backed短命・単回利用intent、owner専用の更新APIを追加する。公開要求は常に同じ202応答と最低応答時間を通し、HMAC化したIP・メール別の固定窓レート制限と本文上限を設ける。更新時はintent claim後に本人整合性を再照合する。
- 理由: staff用intentをowner更新へ受け入れると、役割境界と既存のstaff紐付け前提を壊す。Authメールとprofileメールを照合しないと、古いプロフィールメールで別のAuthユーザーを回復させる危険がある。本文だけでなく応答時間差とメール送信濫用を閉じ、identity確認とclaimの競合窓もfail-closeする必要がある。
- 影響ファイル: `docs/specs/issue-26-owner-password-recovery.md`、owner recovery Route・画面・intent migration・テスト、GitHub Issue #26。
- リスク: Auth、権限、Supabase migrationを変更するredリスク。レート制限DB障害時は送信を拒否する。本番DB適用、Supabase設定、実メール送信は本PRの対象外とする。
- ロールバック: owner recovery機能を同一リリース単位でrevertし、DB適用後の削除は別の安全なrollback migrationで扱う。

### DEC-20260806-001

- 論点: 日報側A-005がBacklogのまま、Issue #5の詳細APIでどこまでのデータを外部契約として準備するか。
- 判断: 実装は開始せず、詳細APIは自由記述の `note` を除く固定勤怠サマリーを既定とし、イベントを明示指定時だけページング付き最小4項目で返す契約案を作成する。修正申請と位置・端末・認証・LINE・GPS検証結果・自由記述は外部公開しない。一覧へのイベント同梱は日報側の必要性と応答量を確認する別判断にする。
- 仮定: 日報側は日次人件費の取り込みを主目的とし、イベント監査の全情報や修正申請本文を必要としない。日報側A-005の実装開始時に、一覧へのイベント同梱とGPS検証結果が必要かを確認できる。
- 理由: 現行Issue #5の「events常時返却」「pending_requests返却」は、日報集計に不要な個人情報と応答量を増やす。既存一覧の `note` も修正申請の自由記述を含み得るため詳細APIへ拡張しない。`is_manual` と `updated_at` は修正済みレコードを再同期するための最小シグナルとしてすでに公開されている。
- 影響ファイル: `docs/specs/issue-5-attendance-detail-api.md`、`docs/integrations/attendance-api-spec.md`、`docs/implementation-decisions.md`、`NEXT.md`、GitHub Issue #5。
- リスク: 日報側が一覧へのイベント同梱を必要とする場合、後続でページ上限・対象期間・レスポンス量・回帰テストを追加しなければならない。実APIキー、実接続、本番データには触れない。
- ロールバック: この契約案と関連文書をrevertし、Issue #5を既存の保留記述へ戻す。実装・DB変更はない。

### DEC-20260723-003

- 論点: Issue #6で発行するAPIキーを、既存の外部API基盤へどう安全に追加するか。
- 判断: 新規migrationを作らず、既存の `external_api_keys`、server-only RLS、SHA-256照合を再利用する。発行・無効化はowner認可済みServer Actionで行い、組織ID条件を必須にする。平文は発行成功時の画面状態だけで一度表示し、許可済みスコープは `attendance:read` に固定する。
- 仮定: Issue #6の受入条件は、現行の読み取り専用APIに必要な最小スコープと、日報側未接続の運用準備を対象としている。
- 理由: 既存スキーマは名前、ハッシュ、スコープ、有効状態、利用日時、失効日時を持ち、外部API認証も無効化・失効・スコープ不足を既に拒否するため。任意スコープやURL経由の結果表示は過剰権限・漏えい経路を増やす。
- 影響ファイル: `docs/specs/issue-6-api-key-management.md`、`src/app/(authenticated)/owner/integrations/api-keys/**`、`src/lib/external-api/**`、関連テスト、`README.md`、`NEXT.md`、外部API仕様。
- リスク: service roleはRLSを迂回するため、Server Actionのowner認可と組織ID条件を欠くと組織越境につながる。監査ログ失敗後に平文を再発行できないよう、主処理の結果を失わない扱いを明示する。
- ロールバック: UI、Server Action、キー管理補助関数をrevertし、発行済みキーはオーナー画面から無効化する。既存テーブルへの追加migrationはない。

### DEC-20260723-002

- 論点: PR #20マージ後、日報アプリの実接続を保留したまま次に進める勤怠側単独作業をどう選ぶか
- 判断: まずIssue #16と親Issue #1の計画・完了状態を同期し、その後はIssue #6のオーナー向けAPIキー管理画面を進める。Issue #5の詳細APIと日報アプリ実接続、本番運用設定は保留を維持する。
- 仮定: 日報側 `A-005` はBacklogであり、詳細レスポンス契約と取り込み要件は未確定である。
- 理由: APIキー管理は勤怠側だけで完結し、既存の外部API運用基盤を安全に運用できるようにする一方、#5は未確定の利用要件へ不要な契約を固定するため。
- 影響ファイル: `NEXT.md`、`FINISHED.md`、`CHANGELOG.md`、`docs/ai/execution-ledger.md`、GitHub Issue #1、今後のIssue #6実装
- リスク: 平文APIキーの一度だけの表示と失効後の即時拒否を、Issue #6の受入条件と回帰テストで必須化する。
- ロールバック: 同期文書とIssue本文をPR #20マージ前の計画表記へ戻す。Issue #6実装は別PRのため本同期PRには含めない。

### DEC-20260723-001（capability lease）

- 論点: PR #20のRound 3でMust 3件・Should 2件が検出された後、上限を超えて修正を継続するか
- granted_by: ユーザー明示指示「承認します。作業を継続してください。」
- scope: Round 3のMust/Should修正、migration・回帰テスト・文書・レビュー証跡更新、実DB検証、コミット、push、例外後の独立確認、CI、PR受入条件の同期
- granted: migration修正、テスト追加、ローカル一時PostgreSQL検証、文書・証跡更新、コミット、push、独立repo-aware確認、CI確認、PR本文更新
- excluded: `.env.local`の読み取り・値表示、秘密情報の転記、本番Supabase変更、実メール送信、日報アプリとの実接続、本番デプロイ、PRのマージ
- expiry_condition: PR #20のRound 3指摘対応、例外後独立確認、CI、PR受入条件同期が完了した時点
- 記録者注: Round 4の自動継続ではなく、2026-07-23のオーナー明示承認に基づく例外対応として記録する。

### DEC-20260716-002

- 論点: 複数のNext.js実行インスタンスで、外部APIの60 req/min/key制限とアクセスログをどう一貫させるか
- 判断: PostgreSQLのAPIキー別固定1分窓を原子的upsertで更新し、全エンドポイントを共通リクエストラッパーへ通す。アクセスログはキーID、パス、HTTP状態、時刻だけをservice roleで保存する。
- 仮定: 外部APIはSupabaseへ到達できるサーバーRoute Handlerから実行され、APIキーの認証後にキーIDを取得できる。
- 理由: プロセス内カウンターはサーバーレス/複数インスタンスで共有できず、各Routeの個別処理ではエラー応答のヘッダー・ログが欠落しやすいため。
- 影響ファイル: `supabase/migrations/20260716055206_external_api_rate_limit_access_logs.sql`、`src/lib/external-api/request.ts`、外部API Route、CI回帰テスト、API仕様
- リスク: DB障害時はレート判定不能になるため、成功扱いにせず500と `Remaining: 0` でfail-closeする。アクセスログ障害はAPI本体を壊さない。
- ロールバック: 共通ラッパーを従来の認証呼び出しへ戻し、追加マイグレーションの関数・テーブルを後続の明示的なrollback migrationで削除する。

### DEC-20260716-001（capability lease）

- 論点: Round 3 fail-closeで停止したPR #15を、独立AIレビュー運用の導入後にどこまで再開するか
- granted_by: ユーザー明示指示「PR #15の最新化、再検証、レビューまで進めてください」
- scope: PR #15への最新`main`取り込み、Round 3 Must修正、回帰テスト、文書同期、コミット、push、独立repo-aware reviewと証跡作成
- granted: 競合解消、実装修正、検証、コミット、push、独立レビュー実行、レビュー指摘対応
- excluded: `.env.local`の読み取り・値表示、秘密情報の転記、本番Supabase変更、実メール送信、日報アプリとの実接続、本番デプロイ、PRのマージ
- expiry_condition: PR #15の最新化、再検証、独立レビューと必要な指摘対応が完了した時点
- 記録者注: 旧Round 3の自動継続ではなく、2026-07-16のオーナー明示指示に基づく再開として記録する。

### DEC-20260714-003

- 論点: Issue #13の招待、受諾、回帰テストを予定通り別PRに分けるか
- 判断: 招待・安全な紐付け、初回パスワード設定・再設定、回帰テスト・運用記録を1つの機能PRに統合する。
- 仮定: 招待メール送信だけが先にマージされると、受け入れ画面のない行き止まりのリンクが配信され得る。
- 理由: ユーザーに到達するメールと受け入れ先は同時に有効化し、機能単位でロールバック可能にする必要があるため。
- 影響ファイル: `NEXT.md`、`src/lib/auth/staff-auth.ts`、`src/app/auth/staff-password/page.tsx`、`src/app/(authenticated)/owner/staff/page.tsx`
- リスク: PRが大きくなるが、責務分離したサービスと回帰テストで差分を確認可能にする。
- ロールバック: 機能PR全体をrevertし、手動Auth UUID入力の旧画面へ戻す。

### DEC-20260714-002

- 論点: GitHub Copilot レビューの契約上限に依存せず、PR 品質ゲートをどう維持するか
- 判断: 実装担当から独立した Codex または Claude の repo-aware review を必須ゲートとし、Copilot は利用可能時の任意の追加レビューとする。provider をまたいだラウンド上限3回は維持し、高リスク変更は第2レビューまたは専用回帰テストで二重確認する。
- 仮定: Codex または Claude で、実装時と別の reviewer/session と repo-aware context を確保できる。
- 理由: 品質を単一プロバイダーの契約・quota・到着待ちに依存させず、CI、独立レビュー、リスク別回帰検証で再現可能なゲートにするため。
- 影響ファイル: `.github/instructions/review-loop.instructions.md`、`ai/operation-policy.yml`、`.github/agents/orchestrator.agent.md`、`.github/PULL_REQUEST_TEMPLATE.md`、`.github/workflows/ci.yml`、`ci/policy_check.py`、`ci/test_policy_check.py`、`docs/ai/review-result.schema.json`、`docs/ai/reviews/`、`docs/ai/pre-pr-reviews/`、`docs/orchestration.md`、`NEXT.md`
- リスク: レビューの独立性や context mode を証跡化しないと、同一会話のセルフレビューが必須ゲートとして誤算入される。
- ロールバック: 該当変更を revert し、Copilot 必須＋Codex / Claude fallback の旧手順に戻す。

### DEC-20260714-001

- 論点: 勤怠側と日報側で異なる外部API仕様、GitHub Issue、次タスクをどの状態へ揃えるか
- 判断: 勤怠側 `docs/integrations/attendance-api-spec.md` の `attendance-external-v1-2026-07-14` を契約の正本とし、Issue #2〜#4を完了、#7→#6を勤怠側の先行順、#5と日報側実接続を利用要件確定まで保留とする。次の実装はIssue #13のA-001とする。
- 仮定: 日報側 `docs/plan.md` の `A-005` はBacklogであり、現時点では日報側ファイルへ仕様本文を同期しても実装へ直結しない。
- 理由: 実装済み範囲を未完了に見せるずれを解消しつつ、未実施の日報側作業や本番運用を完了扱いにしないため。
- 影響ファイル: `NEXT.md`、`docs/integrations/attendance-api-spec.md`、GitHub Issue #1〜#7、#13
- リスク: 日報側の初期仕様は同期まで古い契約を示し続ける。
- ロールバック: Issueと文書の状態記述を以前の版へ戻し、契約スナップショットを廃止する。

### DEC-20260713-001（capability lease）

- 論点: 日報アプリとの実接続を保留した後、勤怠アプリ単独で進める作業とPRレビューループの認可範囲
- granted_by: ユーザー明示指示「5の本番運用準備以外を進めてください」「レビューが無くなるまで」
- scope: 計画整合、A-006 Performance Advisor、A-007テスト・CI、A-001スタッフ認証、A-000外部API運用強化、C-004 LINE運用
- granted: 作業計画の更新、ブランチ作成、実装、検証、コミット、push、PR作成、Copilotレビュー依頼、ユーザー指定間隔での到着確認、actionable指摘への修正と再レビュー
- excluded: `.env.local` の読み取り・値表示、秘密情報の転記、破壊的DB操作、本番デプロイ・実店舗データ投入などの本番運用準備、PRの自動マージ
- expiry_condition: 対象作業のPRがすべてactionableなレビュー指摘なしとなるか、ユーザーが撤回・変更した時点
- 記録者注: 本 lease は2026-07-13のユーザー指示に基づく。到着確認間隔は今回の実行条件として扱うが、対応はリポジトリ正本の最大3レビューラウンドに従い、Round 3後の非ブロッキング指摘はBacklog化する。

### DEC-20260713-002（capability lease）

- 論点: レビュー完了後のPR #10/#11マージと、A-006本番検証をどこまで実行するか
- granted_by: ユーザー明示指示「マージしてください」「必要な作業を行なって」「実施してください」「では、その流れで進めてください」
- scope: PR #10/#11のマージ、A-006 Performance Advisorマイグレーション適用、ロール別RLSスモーク、Advisor再実行、完了記録とIssue状態の同期
- granted: Copilotのactionable指摘なし・全CI成功を確認したPRのマージ、レビュー済みの非破壊的マイグレーション適用、トランザクション内fixtureを使う本番RLS検証、完了同期PRの作成とレビューループ
- excluded: `.env.local` の読み取り・値表示、秘密情報の転記、破壊的DB操作、永続的なテストデータ投入、本番デプロイ、実店舗データ投入、Go-Live、日報アプリとの実接続
- expiry_condition: A-006/A-007の本番検証と完了同期PRが完了した時点
- 記録者注: DEC-20260713-001で除外していたPRマージとA-006本番適用について、その後のユーザー指示で今回対象に限り追加認可された。未使用インデックス削除は含めず、30日以上の観測後に再判断する。

以下は記入例（架空の一般例）である。運用開始後はこの例を残したまま、実際の判断エントリを追記する。

### DEC-20260101-001

- 論点: 日常開発の依頼と運用ルール変更の依頼をどう区別して質問方針を分けるか
- 判断: `daily_development` は原則聞き返さず、`governance_change` は将来運用に影響する確認・対話を許可する
- 仮定: 日常タスクではユーザーが不在になり得るが、運用ルール変更は将来の使い勝手へ直接影響する
- 理由: `ai/operation-policy.yml` の `ask_user_policy` とユーザー指示に整合するため
- 影響ファイル: `ai/operation-policy.yml`、`AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md`
- リスク: governance change を広く解釈しすぎると日常開発で聞き返しが増える
- ロールバック: `ai/command-router.yml` の分類と入口文書の該当記述を revert する
