# AI レビュー証跡

PR ごとの機械可読な push 後の独立 AI レビュー証跡を置くディレクトリです。Codex / Claude repo-aware review を必須ゲートとして使う場合は証跡作成も必須です。ファイル名は `YYYY-MM-DD-prNNN-roundN-<provider>-<reviewer>.json` とし、`docs/ai/review-result.schema.json` に従います。

証跡には `phase=post_push`、provider、reviewer ID、review session ID、implementation session ID、対象 `head_sha`、diff fingerprint、risk tier、round、高リスクの第2確認結果を記録します。implementation session ID と review session ID は必ず異なる値にします。Must/Should の `disposition=open` が残る証跡は完了条件を満たしません。

`diff_fingerprint` は `origin/main` と `head_sha` の merge-base から `head_sha` までの binary diff（`docs/ai/reviews/**` を除外）の SHA-256 を `sha256:<hex>` 形式で記録します。`changed_files` と `risk_tier` も同じGit差分から `ci/policy_check.py` が再計算します。

Round 1-2 の Must/Should は `fixed` または技術的根拠付き `rejected` のみ許可します。Must は全ラウンドで Backlog 化できず、Should の `backlog` は Round 3 の非ブロッキング指摘だけに限定します。

PR 前 critical review の証跡は `docs/ai/pre-pr-reviews/` に置き、この push 後ゲートの証跡として流用しません。

schema v2 導入前の旧ファイル名・旧schemaの証跡は履歴として保存しますが、新しいPRの必須ゲートには数えません。

Copilot レビューは利用可能時の任意の追加レビューです。Copilot の quota、認証、タイムアウトは必須 repo-aware review の完了をブロックしません。

レビュー証跡には秘密情報、実データ、認証情報を含めません。
