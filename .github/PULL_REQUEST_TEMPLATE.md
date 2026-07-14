## 概要

- 何を、なぜ変更したかを1〜3文で書く。

## 変更内容

- 主な変更点を箇条書きで書く。

## 受入条件（AC）

- [ ] AC-001: 要件・ポリシー・制約に整合している
- [ ] AC-010: 必要なテストが追加または更新されている
- [ ] AC-020: CI final gate が成功している（GitHub CI 利用可能時は全check pass、利用不能時は同等のローカルCI全項目pass＋個別承認。AIレビュー単独での代替は禁止）
- [ ] AC-025: 実装担当から独立した Codex / Claude repo-aware review が完了し、機械可読証跡がある（Copilot は任意の追加レビュー）
- [ ] AC-030: 変更に応じて正本 docs（requirements/policies/constraints/architecture/runbook/ADR）を更新した
- [ ] AC-040: 検証手順と結果を本 PR に記載した
- [ ] AC-050: 禁止操作や秘密情報の混入がない（例外なし）
- [ ] AC-060: 作業種別ごとの成果証跡を正本またはレビュー証跡に記録した
- [ ] AC-070: DoD コマンドの対象ファイル / SQL 対象行 / 検証コマンドが実在する
- [ ] AC-080: 安全装置・運用日付関連の変更は JST 基準と fail-closed 境界値テストを伴う

## 検証

- 実行コマンド：
- 結果：
- 独立 AI レビュー証跡（provider / reviewer / context mode / 結果）：
- Copilot 追加レビュー（任意）：

## 影響範囲 / リスク

- 影響範囲：
- 残リスク：
- ロールバック方針（必要なら）：
- テスト不要理由（該当時のみ）：
- docs更新不要理由（該当時のみ）：

## 追加メモ

- 監査観点（spec/security/reliability）で注意すべき点があれば書く。
