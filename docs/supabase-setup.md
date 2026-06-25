# Supabase Setup

S-004 の Supabase プロジェクト作成・接続手順です。

## 1. Supabase プロジェクトを作成

Supabase Dashboard で新規プロジェクトを作成します。

- Region: `Northeast Asia (Tokyo)` が選べる場合は優先
- Database Password: パスワード管理ツールに保存
- Project URL: `NEXT_PUBLIC_SUPABASE_URL` に設定
- anon public key: `NEXT_PUBLIC_SUPABASE_ANON_KEY` に設定
- service_role key: `SUPABASE_SERVICE_ROLE_KEY` に設定

`service_role key` はサーバー専用です。ブラウザ、Git、README、Issue本文には貼り付けません。

## 2. 環境変数を設定

`.env.example` を参考に `.env.local` を作成します。

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`.env.local` は `.gitignore` 対象のため、実キーはコミットしません。

## 3. 初期スキーマを適用

Supabase Dashboard の SQL Editor で、次のファイルの内容を実行します。

```text
supabase/migrations/202606250001_initial_attendance_schema.sql
```

適用後、Table Editor に次の主要テーブルが作成されていることを確認します。

- `organizations`
- `user_profiles`
- `stores`
- `staff`
- `attendance_records`
- `attendance_events`
- `shifts`
- `audit_logs`

## 4. 接続確認

開発サーバーを起動します。

```bash
npm run dev
```

次の URL を開きます。

```text
http://localhost:3000/api/internal/supabase/health
```

正常時は `ok: true` と `organizations_accessible: true` が返ります。

## 5. Supabase CLI を使う場合

Supabase CLI がある環境では、プロジェクト連携後にマイグレーションを push できます。

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

この環境では 2026-06-25 時点で `supabase` コマンドは未インストールです。
