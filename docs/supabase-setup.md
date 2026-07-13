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
機密情報の共通ルールは [SECURITY.md](../SECURITY.md) を参照してください。

## 2. 環境変数を設定

`.env.example` を参考に `.env.local` を作成します。

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`.env.local` は `.gitignore` 対象のため、実キーはコミットしません。

`.env.local` の値は、チャットやターミナルへ表示しません。Codexやその他の自動化ツールが内容へアクセスする必要がある場合は、目的と値を表示しない確認方法を先に説明し、ユーザーの明示的な許可を得てください。通常の確認では `.env.example` と環境変数名だけを参照します。

設定ファイルがGit管理対象外であることは、内容を開かず確認できます。

```bash
git check-ignore .env.local
```

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

追加マイグレーションもファイルの内容だけを SQL Editor へ貼り付けて実行します。ローカルのファイルパス自体をSQLとして実行しないでください。

Supabase Advisor の Warning 対応は、次のマイグレーションを適用してから Dashboard の Database Advisor / Security Advisor を再実行します。

```text
supabase/migrations/202607090001_supabase_advisor_warnings.sql
supabase/migrations/202607090002_security_advisor_function_execute.sql
supabase/migrations/202607130001_supabase_advisor_review_followup.sql
```

このマイグレーションは、関数の `search_path` 固定、service role専用テーブルの明示的なクライアント拒否ポリシー、外部キー参照列の補助インデックス、`pgcrypto` 拡張の `extensions` スキーマ配置を扱います。機能別マイグレーションが未適用で対象テーブルが存在しない場合、そのテーブル向けのポリシーだけをスキップします。

`202607130001_supabase_advisor_review_followup.sql` は、レビュー修正前の `202607090001` を適用済みのDB向け追補です。`set_updated_at()` の `search_path` を `pg_catalog` のみに固定し、初期スキーマの `idx_line_accounts_staff` と重複していた `idx_line_accounts_staff_id` を削除します。新規環境でも安全に再実行できる内容です。

Performance Advisorの73 Warningsと44 Infoの分類、対応判断、適用後の確認手順は `docs/supabase-performance-advisor.md` を参照します。対応マイグレーション `supabase/migrations/202607130002_performance_advisor_optimization.sql` は、PRレビューとロール別スモークテスト計画の確認後に適用します。現時点では本番未適用です。

`Public Can Execute SECURITY DEFINER Function` と `Signed-In Users Can Execute SECURITY DEFINER Function` が残る場合は、`202607090002_security_advisor_function_execute.sql` を適用します。RLS補助関数をData API非公開の `private` スキーマへ移し、`PUBLIC` / `anon` の実行権限を外します。RLSポリシーの評価に必要なため、`authenticated` には `private` スキーマの `USAGE` と対象関数の `EXECUTE` だけを付与します。

適用後は、次の値を表示しない権限確認クエリで、3関数が `private` にあり、`anon_execute=false`、`authenticated_execute=true` であることを確認します。

```sql
select
  namespace.nspname as function_schema,
  procedure.proname as function_name,
  has_function_privilege('anon', procedure.oid, 'execute') as anon_execute,
  has_function_privilege('authenticated', procedure.oid, 'execute') as authenticated_execute
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'private'
  and procedure.proname in (
    'current_user_organization_id',
    'current_user_role',
    'can_access_store'
  )
order by procedure.proname;
```

続けてオーナー、店長、社労士の認証済み画面を開き、既存のRLS付き読み取りが権限エラーにならないことを確認してからAdvisorを再実行します。

`private` への移動後も `authenticated` の実行権限自体が警告される場合、その権限はRLS評価に必要なため削除しません。`private` がData APIのExposed schemasに含まれていないことを確認し、残警告と判断理由を `NEXT.md` / `FINISHED.md` / `CHANGELOG.md` に記録します。

`Leaked Password Protection Disabled` はSQLではなくDashboard設定です。漏洩パスワード保護はProプラン以上で利用できるため、利用可能な場合はSupabase Dashboard の Authentication 設定で有効化し、Security Advisor を再実行します。現在のプランで利用できない場合は、アップグレードが必要な残リスクとして記録します。

### 2026-07-13 本番適用記録

- 上記2マイグレーションを本番プロジェクトへ適用済み。
- RLS補助関数3件は `private` にあり、`anon_execute=false`、`authenticated_execute=true` を確認済み。
- 未所属ユーザーと、実在するオーナー、店長、社労士を模擬したトランザクション内SQLスモークテストで、期待するRLS付き読み取りを確認済み。テストで使用した識別子やデータ件数は記録していない。
- Security Advisor再実行後はErrors 0、Warnings 1、Info 0。残件はFreeプランでは有効化できない `Leaked Password Protection Disabled` のみ。
- Performance AdvisorはErrors 0、Warnings 73。初回確認時のInfo 45から、最新のカタログ確認ではInfo 44（未索引外部キー13件、未使用インデックス31件）となっている。
- 2026-07-13のCopilotレビューを受け、`set_updated_at()` の `search_path` 最小化と重複索引の解消を反映。`202607130001_supabase_advisor_review_followup.sql` を本番適用し、`search_path` が `pg_catalog` のみ、既存索引が存在、重複索引が削除済みの3条件すべてを `true` と確認済み。

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
