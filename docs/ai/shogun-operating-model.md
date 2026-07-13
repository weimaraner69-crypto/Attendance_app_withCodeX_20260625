# Shogun 運用モデル

`ai/command-router.yml` の日常 3 コマンドと governance change に一致しない依頼を扱う、軽量な入口プロトコルです。手順の正本は `ai/coherence-workflow.yml` の `shogun_dispatch` とします。

## 原則

- Shogun は新しい司令塔ではなく、既存 Orchestrator の依頼分類と分解パターンである。
- 単純な質問や 1〜2 ステップの作業は分解せず、直接安全に処理する。
- 複数領域にまたがる作業は最大 8 個の work packet に分け、既存の implementer、test-engineer、auditor へ委譲する。
- 運用ルール、AI ハーネス、branch/release policy、hook 方針を変える依頼は governance change として再分類する。

## 実行

1. `NEXT.md`、git 状態、関連する正本を確認する。
2. 目的、制約、リスクを抽出する。
3. `ai/operation-policy.yml` の safety と release tier を確認する。
4. 必要な work packet へ分解し、既存ロールへ委譲して統合する。
5. 検証結果、未確認リスク、次アクションを短く報告する。

詳細な完了条件、レビュー、リリース判断は `ai/coherence-workflow.yml` と `ai/operation-policy.yml` に従う。
