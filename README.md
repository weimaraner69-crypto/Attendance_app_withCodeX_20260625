# 勤怠管理アプリ

店舗スタッフの出退勤、休憩、シフト、打刻修正申請、管理者確認を扱う勤怠管理アプリです。

Next.jsの主要画面、Supabase PostgreSQLのDB、ロール別認証、打刻・申請・シフト・レポート、LINE連携コード、日報アプリ向け外部APIのPhase 1まで実装済みです。
現在は `NEXT.md` の優先順位に沿って、Performance Advisor最適化、自動テスト・CI強化、スタッフAuthアカウント運用、外部APIの運用強化を進めています。

## 目的

- 店舗設置iPadから、スタッフが氏名選択とPIN入力で打刻できるようにする。
- 個人スマホから、スタッフがログイン後にGPSログ付きで打刻できるようにする。
- 店長が担当店舗の勤怠状況、申請、シフトを管理できるようにする。
- オーナーが全店舗のスタッフ、店舗、勤怠、レポートを管理できるようにする。
- 社労士が必要な勤怠情報を閲覧・出力できるようにする。
- 店長、オーナー、社労士は初回のメール/パスワード認証後、同じ端末で6時間以内なら4桁PINで再ログインできるようにする。
- 日報管理アプリが出退勤データを取り込めるように、サーバー間の読み取りAPIを提供する。
- LINEからシフト確認、シフト提出、GPS打刻導線、通知を扱えるようにする。

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
- `.env.local` の値は読み取り・表示しません。内容へのアクセスが必要な場合は、目的と値を表示しない確認方法を説明し、必ず事前にユーザーの許可を得ます。
- 個人情報、APIキー、Secret keyなどの機密情報は [SECURITY.md](SECURITY.md) のルールに従って扱います。

## 現在の重要方針

- Supabaseを前提にDB設計を進めています。
- 店舗iPad打刻は、スタッフ一覧から氏名選択後、PIN入力で本人確認します。
- 個人スマホ打刻は、スタッフログイン後に店舗選択し、GPSログ付きで出勤・退勤を記録します。
- 店長、オーナー、社労士の管理画面は、初回認証から6時間以内の同一端末に限って4桁PINでロック解除できます。6時間経過後と完全ログアウト後はメールアドレス/パスワードが必要です。
- LINEでは直接打刻せず、GPS付きWeb打刻URLへ誘導する方式です。
- 日報アプリ連携では、勤怠アプリを出退勤データの正本とし、日報アプリは外部APIから読み取り専用で取り込みます。
- 日報アプリ側の連携実装は同アプリの本番運用準備が進むまで保留し、勤怠側は単独で進められる性能、認証、テスト、API運用品質を先行します。
- 外部連携APIの実装順は GitHub Issue #1 と子Issue #2〜#7、仕様は `docs/integrations/attendance-api-spec.md` を参照します。

## 関連ドキュメント

- `NEXT.md`: 今後の実装順
- `FINISHED.md`: 完了した作業ログ
- `CHANGELOG.md`: 変更履歴
- [SECURITY.md](SECURITY.md): 機密情報と `.env.local` の取り扱いルール
- `docs/database-design.md`: DB設計メモ
- `docs/supabase-setup.md`: Supabaseプロジェクト作成・接続手順
- `docs/line-setup.md`: LINE Messaging API・Webhook・実機確認手順
- `docs/operations-maintenance.md`: 本番環境変数、監視、バックアップ/復旧、権限・個人情報の運用手順
- `docs/integrations/attendance-api-spec.md`: 日報アプリ向け外部連携API仕様
