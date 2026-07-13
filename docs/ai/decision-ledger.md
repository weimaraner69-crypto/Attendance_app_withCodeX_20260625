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

### DEC-20260714-002

- 論点: Issue #13の招待、受諾、回帰テストを予定通り別PRに分けるか
- 判断: 招待・安全な紐付け、初回パスワード設定・再設定、回帰テスト・運用記録を1つの機能PRに統合する。
- 仮定: 招待メール送信だけが先にマージされると、受け入れ画面のない行き止まりのリンクが配信され得る。
- 理由: ユーザーに到達するメールと受け入れ先は同時に有効化し、機能単位でロールバック可能にする必要があるため。
- 影響ファイル: `NEXT.md`、`src/lib/auth/staff-auth.ts`、`src/app/auth/staff-password/page.tsx`、`src/app/(authenticated)/owner/staff/page.tsx`
- リスク: PRが大きくなるが、責務分離したサービスと回帰テストで差分を確認可能にする。
- ロールバック: 機能PR全体をrevertし、手動Auth UUID入力の旧画面へ戻す。

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
