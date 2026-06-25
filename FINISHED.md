# FINISHED

実装が完了した項目のログです。

## 記録ルール

- `NEXT.md` の項目を完了したら追記します。
- 項目ID、項目名、実装日、実装内容、確認内容、影響ファイルを記録します。
- `CHANGELOG.md` にも意味のある変更として追記します。

---

## A-000-PHASE1 日報アプリ向け外部連携API Phase 1 実装

- 実装日: 2026-06-25
- 種別: API/DBマイグレーション

### 実装内容

- `external_api_keys` テーブル追加用マイグレーションを作成。
- `X-External-Api-Key` ヘッダのAPIキー認証を実装。
- APIキーはSHA-256ハッシュで照合し、平文保存しない方針で実装。
- 外部API共通エラー応答を実装。
- `GET /api/external/v1/health` を実装。
- `GET /api/external/v1/stores` を実装。
- `GET /api/external/v1/staff` を実装。
- `GET /api/external/v1/attendance` を実装。
- APIキー生成・ハッシュ化用の `npm run external-api:hash-key` を追加。

### 確認内容

- `npm run lint` が成功。
- `npm run build` が成功。
- `npm run external-api:hash-key -- test-key` が成功。

### 残タスク

- `supabase/migrations/202606250002_external_api_keys.sql` をSupabase SQL Editorで適用する。
- `organizations` と `external_api_keys` に実データを登録する。
- 日報管理アプリ側から実API呼び出しを検証する。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `docs/database-design.md`
- `docs/integrations/attendance-api-spec.md`
- `package.json`
- `scripts/hash-external-api-key.mjs`
- `src/app/api/external/v1/`
- `src/lib/external-api/`
- `src/lib/supabase/database.types.ts`
- `supabase/migrations/202606250002_external_api_keys.sql`

---

## S-004 Supabaseプロジェクト作成・接続

- 実装日: 2026-06-25
- 種別: 環境構築/DB接続

### 実装内容

- Supabaseプロジェクト `Attendance_app_withCodeX_20260625` を作成。
- SupabaseプロジェクトとGitHubリポジトリを連携。
- 勤怠アプリ側 `.env.local` に Supabase URL、publishable key、secret key を設定。
- `supabase/migrations/202606250001_initial_attendance_schema.sql` を Supabase SQL Editor で適用。
- `/api/internal/supabase/health` で Supabase DB 接続を確認。

### 確認内容

- `.env.local` に必要な3項目が設定済みで、Git管理対象外のままであることを確認。
- publishable key / secret key の形式で設定されていることを確認。
- 初期マイグレーション実行後、`/api/internal/supabase/health` が HTTP 200 を返すことを確認。

### 影響ファイル

- `NEXT.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `.env.local`（Git管理対象外）
- Supabaseプロジェクト `Attendance_app_withCodeX_20260625`

---

## DOC-001 作業管理ファイル整備

- 実装日: 2026-06-25
- 種別: ドキュメント/運用ルール

### 実装内容

- 今後の作業順を管理する `NEXT.md` を作成。
- 完了した作業を記録する `FINISHED.md` を作成。
- `README.md` を日本語のプロジェクト説明へ書き直し。
- 今後、実装完了時は `FINISHED.md` と `CHANGELOG.md` を更新する運用を明記。

### 確認内容

- `NEXT.md` に S/A/B/C の優先度と `S-001` 形式の項目IDを追加。
- `README.md` にプロジェクト目的、技術スタック、作業管理ルールを追加。

### 影響ファイル

- `NEXT.md`
- `FINISHED.md`
- `README.md`
- `CHANGELOG.md`

---

## S-001 DB方針の確定

- 実装日: 2026-06-25
- 種別: 仕様決定

### 実装内容

- DBは Supabase PostgreSQL で継続する方針に確定。
- Firebase移行は現時点では保留とした。
- 初期スキーマは `supabase/migrations/202606250001_initial_attendance_schema.sql` を正とする方針に整理。

### 確認内容

- `docs/implementation-decisions.md` に決定内容を記録。
- `NEXT.md` の `S-001` を完了扱いに更新。

### 影響ファイル

- `docs/implementation-decisions.md`
- `NEXT.md`

---

## S-002 打刻方式の仕様確定

- 実装日: 2026-06-25
- 種別: 仕様決定

### 実装内容

- 店舗iPad打刻は、スタッフ一覧から氏名選択後、PIN入力で本人確認する方式に確定。
- 個人スマホ打刻は、スタッフログイン後、店舗選択とGPS検証を行う方式に確定。
- LINE打刻は、初期実装ではGPS付きWeb打刻URLへ誘導する方式を優先する方針に確定。

### 確認内容

- `docs/implementation-decisions.md` に決定内容を記録。
- `NEXT.md` の `S-002` を完了扱いに更新。

### 影響ファイル

- `docs/implementation-decisions.md`
- `NEXT.md`

---

## S-003 権限設計の確定

- 実装日: 2026-06-25
- 種別: 仕様決定

### 実装内容

- オーナー、店長、社労士、スタッフの権限方針を確定。
- 店長は担当店舗のみ、社労士は許可組織のみ閲覧する方針に整理。
- スタッフの打刻書き込みはDB直接書き込みではなく、サーバー側APIで検証してから service role で行う方針に確定。

### 確認内容

- `docs/implementation-decisions.md` に決定内容を記録。
- `NEXT.md` の `S-003` を完了扱いに更新。

### 影響ファイル

- `docs/implementation-decisions.md`
- `NEXT.md`

---

## DOC-002 GitHub自動コミット/push運用の明記

- 実装日: 2026-06-25
- 種別: ドキュメント/運用ルール

### 実装内容

- 特別な指示がない限り、作業完了後にGitHubへコミットとpushまで行う運用を `README.md` に明記。

### 確認内容

- `README.md` の作業管理ルールに追記済み。

### 影響ファイル

- `README.md`
- `FINISHED.md`
- `CHANGELOG.md`

---

## S-004-PART Supabase接続確認基盤追加

- 実装日: 2026-06-25
- 種別: 実装/ドキュメント

### 実装内容

- Supabaseプロジェクト作成後に使うセットアップ手順を `docs/supabase-setup.md` に追加。
- `.env.local` に設定すべき Supabase URL、anon key、service role key の扱いを整理。
- 初期マイグレーション `supabase/migrations/202606250001_initial_attendance_schema.sql` の適用手順を追加。
- service role 経由で `organizations` テーブルへ接続できるか確認する `/api/internal/supabase/health` を追加。
- S-004の未完了項目として、実プロジェクト作成、マイグレーション適用、`.env.local` 設定が残ることを `NEXT.md` に明記。

### 確認内容

- `npm run lint` が成功。
- この環境では `supabase` コマンドが未インストールであることを確認。

### 影響ファイル

- `NEXT.md`
- `README.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `docs/database-design.md`
- `docs/supabase-setup.md`
- `src/app/api/internal/supabase/health/route.ts`

---

## DOC-003 日報アプリ向け外部連携APIの実装計画整理

- 実装日: 2026-06-25
- 種別: ドキュメント/実装計画

### 実装内容

- 日報管理アプリが勤怠データを取り込むための外部連携API仕様を `docs/integrations/attendance-api-spec.md` に追加。
- GitHub親Issue #1 と子Issue #2〜#7 の実装順を `NEXT.md` に追加。
- Phase 1を `#2 APIキー認証`, `#3 health/stores/staff`, `#4 attendance一覧` として整理。
- Phase 2を `#5 詳細/events`, `#6 APIキー管理画面`, `#7 レート制限/アクセスログ` として整理。
- 勤怠アプリを出退勤データの正本、日報アプリを読み取り側とする方針を関連ドキュメントへ反映。

### 確認内容

- `NEXT.md` に `A-000 日報アプリ向け外部連携API` を追加済み。
- `docs/implementation-decisions.md` に外部連携APIの決定事項を追加済み。
- `docs/database-design.md` に連携API用テーブル予定と連携方針を追加済み。
- `README.md` に日報アプリ連携の目的と仕様書リンクを追加済み。

### 影響ファイル

- `NEXT.md`
- `README.md`
- `CHANGELOG.md`
- `FINISHED.md`
- `docs/database-design.md`
- `docs/implementation-decisions.md`
- `docs/integrations/attendance-api-spec.md`
