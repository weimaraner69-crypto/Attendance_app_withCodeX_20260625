# ポリシー

勤怠管理アプリの開発・運用で守る共通ポリシーです。機密情報の詳細な扱いは `SECURITY.md`、AI 開発の運用手順は `ai/*.yml` と `AGENTS.md` を正本とします。

## 安全

- `.env.local`、API キー、認証情報、実データを読まない、表示しない、コミットしない。
- 秘密情報へのアクセスが必要な場合は、値を表示しない確認方法を示してからユーザーの許可を得る。
- SQL migration、認証、権限、外部 API、LINE webhook、GPS 打刻の変更は高リスクとして扱い、検証とロールバック方針を残す。

## プロダクト

- LINE では直接打刻せず、GPS 付き Web 打刻 URL へ誘導する。
- 勤怠アプリを出退勤データの正本とし、日報アプリは読み取り専用 API で連携する。
- 変更は `NEXT.md`、`FINISHED.md`、`CHANGELOG.md` と関連文書へ必要に応じて反映する。

## 開発

- 既存の未コミット変更はユーザーの作業として扱い、明示指示なしに変更・stage・revert しない。
- コード変更後は原則 `npm run lint` と `npm run build` を実行する。
- 詳細は `SECURITY.md`、`AGENTS.md`、`ai/operation-policy.yml` を参照する。
