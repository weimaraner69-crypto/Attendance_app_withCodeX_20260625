# CI policy tools

Fresh checkout で policy check を実行する前に、固定済みの Python 依存を導入します。

```bash
python3 -m pip install --requirement ci/requirements.txt
python3 ci/policy_check.py
```

レビュー証跡ゲートは PR 番号を指定して実行します。

```bash
python3 ci/policy_check.py --require-review-evidence --pr-number <PR_NUMBER>
```
