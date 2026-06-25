# 勤怠管理アプリ

店舗スタッフの出退勤、休憩、シフト、打刻修正申請、管理者確認を扱う勤怠管理アプリです。

現在は Next.js の画面プロトタイプと、Supabase PostgreSQL 前提のDB設計を整備している段階です。
今後は `NEXT.md` の優先順位に沿って、実運用できる状態まで順番に実装していきます。

## 目的

- 店舗設置iPadから、スタッフが氏名選択とPIN入力で打刻できるようにする。
- 個人スマホから、スタッフがログイン後にGPSログ付きで打刻できるようにする。
- 店長が担当店舗の勤怠状況、申請、シフトを管理できるようにする。
- オーナーが全店舗のスタッフ、店舗、勤怠、レポートを管理できるようにする。
- 社労士が必要な勤怠情報を閲覧・出力できるようにする。
- 将来的にLINEからシフト確認、シフト提出、打刻導線、通知を扱えるようにする。

## 技術スタック

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui 系UIコンポーネント
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Supabase PostgreSQL

## 主なディレクトリ

| パス | 内容 |
|---|---|
| `src/app` | App Router のページ・レイアウト |
| `src/components` | 画面部品 |
| `src/components/ui` | UI基本部品 |
| `src/lib/api` | 現在はモックAPI・TanStack Query hooks |
| `src/lib/utils` | 日付計算、GPS計算など |
| `src/lib/validations` | Zod バリデーション |
| `src/stores` | Zustand ストア |
| `src/types` | アプリ全体の型定義 |
| `supabase/migrations` | Supabase 用DBマイグレーション |
| `docs` | 設計メモ |

## 開発コマンド

```bash
npm run dev
npm run lint
npm run build
```

開発サーバーは通常 `http://localhost:3000` で起動します。

## 作業管理ルール

今後の作業順は `NEXT.md` を参照します。

- 優先度は `S`, `A`, `B`, `C` の4段階で管理します。
- 各項目には `S-001` のようなIDを付けます。
- 実装が終わった項目は `FINISHED.md` に、項目ID、項目名、実装内容、確認内容を書きます。
- 仕様や実装に意味のある変更が入ったら `CHANGELOG.md` も更新します。
- 特別な指示がない限り、作業完了後はGitHubへコミットとpushまで行います。

## 現在の重要方針

- Supabaseを前提にDB設計を進めています。
- 店舗iPad打刻は、スタッフ一覧から氏名選択後、PIN入力で本人確認します。
- 個人スマホ打刻は、スタッフログイン後に店舗選択し、GPSログ付きで出勤・退勤を記録します。
- LINE打刻は未確定です。最初はLINEからGPS付きWeb打刻URLへ誘導する方式が有力です。

## 関連ドキュメント

- `NEXT.md`: 今後の実装順
- `FINISHED.md`: 完了した作業ログ
- `CHANGELOG.md`: 変更履歴
- `docs/database-design.md`: DB設計メモ
