---
description: "Use when: working on PRs, pushing code, handling AI review, Copilot/Codex/Claude レビュー対応, review loop, CI monitoring, git push, PR作成, レビューコメント対応, review feedback, pull request workflow. CRITICAL workflow rule for PR completion pipeline."
applyTo: "**"
---
# AI レビューループ — 絶対スキップ禁止ルール

> **プロジェクトオーナー決定。変更はオーナーの明示認可がある場合のみ（認可記録は `docs/ai/decision-ledger.md` を参照）。**

## 最重要ルール（5つ）

1. **PR に push したら、実装担当から独立した Codex または Claude の repo-aware AI レビューを必ず実行する**（Copilot は利用可能時の追加レビューであり、必須ゲートではない）
2. **AI レビューは provider をまたいだ合計で最大 3 ラウンドまで対応する**（Round 3 後も Must は fail-close、非ブロッキング Should のみ Backlog 化）
3. **必須の独立レビューを実行・完了せず次に進むことは絶対禁止**（待機が必要なのは任意の非同期レビューを依頼した場合だけ）
4. **push 直後に独立レビュワーと証跡ベースラインを必ず確定する**（provider、reviewer/session、`head_sha`、diff fingerprint、context mode を記録）
5. **レビュー検出は `commit_id` ではなく GraphQL `pullRequest.reviewThreads` を正本とする**（`isResolved=false && isOutdated=false` と返信authorで未対応スレッド数を確認）

## ラウンド外 push（オーナー認可がある場合のみ有効な例外）

次の push は**ラウンドを消費せず、レビュー再リクエスト・証跡再 pin も不要**とする:

- **レビュー証跡（`docs/ai/reviews/**`）のみの push**（diff fingerprint は証跡除外で計算され、`review_head_is_compatible` が証跡専用 commit を許容するため。実測: 証跡再 pin が再レビューを誘発する往復が発生した事例がある）
- **green tier（`ai/operation-policy.yml` の `release_to_main` 分類で green と判定された PR。red_if_touches 非接触であっても yellow 判定の変更は対象外）で、Round 1 のレビューが Must/Should 0 件かつ未解決スレッド 0 件のとき**は、以降のラウンド発火は不要（CI 全チェック green（`gh pr checks` 全 pass）はこの短絡と無関係に必須のまま）。**短絡後に `docs/ai/reviews/**` 以外の差分を push した場合は短絡は失効し、その push からラウンドを再開する（Round 2 扱い・通常の再リクエスト必須）**。yellow / red は本短絡の対象外。

## 長時間待機の実行制約（停止事故防止）

- VS Code / Copilot Chat / Orchestrator 環境では、`sleep` を含むシェルポーリングループを同期実行してはならない。
- CI と任意の非同期 AI レビューの到着待機は、1回ごとの状態確認コマンドを短いタイムアウトで実行し、次回確認はエージェント側の進行管理で行う。
- 端末コマンドが失敗した場合は、読み込み状態を継続せず即座に exit code・stderr・対象コマンドを報告し、原因修正へ戻る。
- 5分以上同じ待機状態が続く場合は、プロセス一覧と直近ログを確認し、滞留プロセスを止めてから再開する。
- Claude Code Remote 等の webhook 対応環境では、`subscribe_pr_activity` 等のイベント受信を優先し、シェル滞留を作らない。

## レビュワー選定ルーチン（push 後に毎回実行）

```text
push 後:
  1. 実装を行ったメイン会話とは別の reviewer/session を選ぶ
  2. 通常は Codex または Claude で repo-aware review を実行する
  3. Copilot は契約・quota・認証が利用可能な場合のみ追加レビューとして依頼できる
  4. Copilot が 422 / quota / timeout / 未到着の場合は再試行待ちでブロックせず、必須 repo-aware review を継続する
  5. `docs/ai/reviews/YYYY-MM-DD-prNNN-roundN-<provider>-<reviewer>.json` に必須レビュー証跡を記録する
```

> **独立性の定義**: 実装内容を生成・修正した主体と同じ推論コンテキストのセルフレビューは、必須の独立レビューに数えない。
> 別サブエージェント、別タスク、または独立した repo-aware reviewer を使用する。

Codex / Claude repo-aware review を実行する場合、通常実装では `repository_context_mode=related_context` 以上、
workflow / security / release / red risk では `full_repo_agentic` を満たすレビュー証跡を要求する。
`diff_only` は docs-only / data-only / typo 等の低リスク変更で理由を記録した場合だけ許可する。
同一 `head_sha` / diff fingerprint / context fingerprint で同一 provider / reviewer の repo-aware review を再実行しない。
context budget は related files 40 件、prompt context 180000 文字、file excerpt 12000 文字、
探索 command 12 件を既定上限とし、超過時は relevance score 順に切り詰めて証跡化する。

### リスク別必須条件

- **green**: 独立 repo-aware review 1 件。docs-only 等は理由付き `diff_only` を許可する。
- **yellow**: 独立 repo-aware review 1 件（`related_context` 以上）と targeted test を必須とする。
- **red / 高リスク**: 1 件の `full_repo_agentic` レビューに加え、別 reviewer による第2レビュー、または対象経路の専用セキュリティ／統合回帰テストを必須とする。
- 認証、権限、Supabase / RLS、SQL / migration、外部 API、秘密情報、workflow / release は常に red / 高リスクとして扱う。
- 第2レビューに Copilot を使用してよいが、利用不能な場合は Codex / Claude の別 reviewer/session または専用回帰テストで代替する。

## レビュー検出ルーチン（2段階検出）

```text
ポーリングループ各回:
  段階1: gh api --paginate（CLI）または pull_request_read（MCP, perPage=100）で AI レビュー総数（Copilot / Codex / Claude）が増加したか確認
    - CLI: gh api --paginate を使う / MCP: perPage=100 を指定する（デフォルト per_page=30 でページネーション漏れが発生する）
    - commit_id でフィルタリングしない（API 仕様で一致しないことがある）
    - ユーザー名: Copilot は copilot-pull-request-reviewer[bot]、Codex は chatgpt-codex-connector、fallback は本文 `## AI レビュー結果` を検出対象にする
  段階2: GraphQL pullRequest.reviewThreads（first:100 + pageInfo/endCursor）で未対応コメントを確認
    - 条件: isResolved=false, isOutdated=false, AI レビューコメントあり, 自分の返信なし
    - ユーザー名: Copilot / Codex / Claude repo-aware fallback の author または `## AI レビュー結果` marker を検索対象にする
  → いずれかで検出されれば「レビュー到着」と判定
```

> **なぜ必要か**: `get_reviews` + `commit_id` フィルタリングだけでは、ページネーションや
> API 仕様の問題でレビューを見落とすことがある。実際にレビューが届いていたのに
> デフォルト per_page=30 のページネーション漏れで検出できず、「未到着」と誤判定した。
> また、レビュー本体(`copilot-pull-request-reviewer[bot]`)とコメント(`Copilot`)で
> ユーザー名が異なるため、両方を検索対象にすること。

## レビューループの手順（Round 1〜3）

```text
push 後（Round N, N=1..3）:
  0. 【必須】独立 reviewer/session、`head_sha`、diff fingerprint、risk tier を確定する
  1. 【Round N レビュー実行】Codex または Claude で必須 repo-aware review を実行し、証跡 JSON を作成する
  1a. Copilot が利用可能な場合のみ追加レビューを依頼できる。不可時は待機・再試行せず次へ進む
  1b. 非同期レビューを使った場合だけ到着を確認（最大20回、2段階検出。同期 `sleep` ループは禁止）
  2. 証跡 JSON の `issues` と GitHub reviewThreads の両方を取得・分類（Must/Should/Nice）
  3. NEXT.md の AC と照合し、AC と矛盾する指摘は AC 優先で対応不要と判定
  4. Must/Should を修正（AC 準拠）
  5. 【必須】全指摘に disposition を記録する
     - 証跡 JSON の Must/Should は `fixed` / `backlog` / `rejected` のいずれかと理由を記録し、`open` を残さない
     - GitHub reviewThreads がある場合は、各スレッドに修正内容・見解を返信する
     - `task_complete` / セッション終了 / release-manager 呼び出しの前に、
       JSON の open Must/Should と0件、未返信のactive threadが0件であることを確認する
     - 「修正済み」「対応不要と判断（理由:〜）」等、簡潔でよいので必ず返信すること
  6. targeted test / lint / typecheck を実行（フル CI は Round 3 後または Must/Should 0 件の最終ゲートへ集約）
  7. 必ず証跡JSONをcommit・pushする。指摘修正がある場合はコードとdispositionもcommit・pushする
  8. Must/Should 0件かつactive thread 0件なら最終CIへ進む。指摘が残り N < 3 なら次ラウンド（N+1）へ、N = 3 なら Round 3 処理へ

Round 3 処理:
  - Must/Should が残る場合は即時ブロッカーか非ブロッキングかを分類
  - Must は全ラウンドで Backlog 化禁止。Round 1-2 の Should も Backlog 化禁止
  - 即時ブロッカー（P-001/P-002/P-003、秘密情報、重大な安全制約違反、CI failure、データ破壊等）は fail-close で停止
  - Round 3 の非ブロッキング Should のみ Backlog に記録し、PR コメントに Backlog ID と残リスクを返信
  - フル CI を実行し、release-manager 承認を経て継続可能
  - Round 4 以降の自動 push / review request は禁止
```

## ラウンド予算と停止条件

**最大 3 ラウンド**を PR 単位で適用する。以下の条件で自動対応を停止し人間にエスカレーションする：

- **Round 3 到達**: Round 3 のレビュー処理後に Must が残る場合は fail-close で停止。非ブロッキング Should のみ Backlog に記録して PR コメントに返信し、最終 CI + release-manager 承認を経て継続可能
- **Round 4 以降の自動継続禁止**: Round 3 を超える CI 発火・push・review request は自動実行しない
- **同一指摘の繰り返し**: 同じコメントへの修正試行が3回を超えた場合
- **連続再トリガー**: タイムアウト時の再トリガーが3回を超えた場合
- **ポリシー違反**: P-001〜P-003 違反を検出した場合
- **コンフリクト/認証不能**: マージコンフリクトまたは認証エラーで継続不能な場合
- **進捗ゼロ override 要求の繰り返し**: 「直近の状態取得結果 == 前回の状態取得結果」かつ「直近の応答 == ユーザへの override 要求」を **2 回連続**検出した場合、3 回目は override 要求を出さず、(a) 具体的な不足作業の自動実施、(b) escalation reason への従順、(c) `AskUserQuestion` での選択肢提示 のいずれかへ切替える

## よくある間違い（過去10回以上発生）

- ❌ 「レビューコメントに返信したので完了」→ JSON の disposition、active thread、最終CIも確認
- ❌ 「CI が通ったので完了」→ 独立 repo-aware review の実行・完了も必須
- ❌ 「push したので次のステップへ」→ push 後は必ず独立 repo-aware review を実行・完了
- ❌ 「時間がかかるので省略」→ 省略は絶対禁止
- ❌ 「commit_id でフィルタしたらレビュー0件」→ commit_id フィルタは禁止。スレッドベースで確認する
- ❌ 「Copilot の quota 回復まで待つ」→ Copilot は任意の追加レビュー。Codex / Claude の独立 repo-aware review を即実行
- ❌ 「Draft PR にレビューをリクエストした」→ Draft 状態ではレビューが発火しない。`gh pr ready <PR番号>` で Ready に変更してからリクエスト
- ❌ 「実装を行った同じ会話のセルフレビューで完了」→ 別 reviewer/session による独立レビューが必須
- ❌ 「修正だけして返信せずに push」→ 返信は必須。本手順は返信なしを完了扱いにしてよいという意味ではない
- ❌ 「Must/Should が残っているので自動修正を停止した」→ Round 3 到達時は非ブロッキング指摘を Backlog 化、即時ブロッカーは fail-close で停止。同一指摘3回繰り返し・再トリガー3回超過・ポリシー違反・認証不能でも停止。Round 4 以降の自動 push/review request は禁止
- ❌ 「状態が変わらないのに同じ override 文言を3回以上要求」→ 進捗ゼロでの override 要求は **2 回まで**。3 回目は不足作業の自動実施・escalation reason 従順・選択肢提示へ切替える

## 自動 Hooks

このリポジトリには自動 Hook を導入していない。レビューループの fail-close、安全停止、独立レビュー実行、任意の非同期レビュー待機、全プラン実行モードの完了条件は、本 instructions と `ai/operation-policy.yml` を正本として各ハーネスが手動で確認する。

- `.github/full-plan-execution.flag` が存在し `active=false` でない場合は、`ai/operation-policy.yml` の `full_plan_delivery_pipeline` と `compact_survival_contract` に従う。
- 全プラン実行モードでは、未解決・未返信スレッド0件・CI全pass・release-manager 承認だけでは完了ではない。自動マージ、main pull、`NEXT.md` 更新、次タスク遷移までを完了条件とする。

## メモリ参照

persistent memory はハーネスが自動提供するもの（Claude Code の auto-memory 等）を用いる。旧 `/memories/repo/` / `/memories/session/` パスは本リポジトリの標準環境に存在しない（`/memories/` マウントを持つ環境でのみ配下を確認する）。
