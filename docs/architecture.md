# アーキテクチャ

勤怠管理アプリの責務境界を示します。データモデルは `docs/database-design.md`、確定した設計判断は `docs/implementation-decisions.md` を正本とします。

## 層と責務

- `src/app`: Next.js App Router の画面、Route Handler、認証・表示フロー。
- `src/components`: 画面部品と UI コンポーネント。
- `src/lib`: Supabase、勤怠、LINE、通知、外部 API、レポートのサーバー側ロジック。
- `src/stores`: クライアント状態。
- `src/types`: アプリ全体で共有する型。
- `supabase/migrations`: PostgreSQL のスキーマと権限変更。

## 境界

- ブラウザは publishable な設定だけを扱い、service role key や外部 API キーはサーバーに閉じる。
- 勤怠記録の書き込みは入力検証、権限、GPS または PIN の確認を経てサーバーで行う。
- LINE webhook は raw body の署名検証後に処理し、打刻は Web 導線へ委ねる。
- 日報アプリは外部 API を通じて勤怠を読み取るだけで、勤怠データの正本を変更しない。
