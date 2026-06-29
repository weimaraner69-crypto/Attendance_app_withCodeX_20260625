# Operations and Maintenance

勤怠管理アプリを本番運用するための環境変数、監視、バックアップ/復旧、権限・個人情報確認の手順です。

この文書は `C-005 運用・保守` の正本として扱います。機密値そのものは記載せず、環境変数名、確認観点、運用手順だけを管理します。

## 1. 本番環境変数

本番・ステージング・ローカルで共通して、実値は `.env.local`、ホスティング環境変数、パスワード管理ツールで管理します。
Git、Issue、Pull Request、チャット、ログへ値を貼り付けません。

| 変数名 | 用途 | 公開範囲 | 必須タイミング |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | ブラウザ公開可。ただし不要な表示は避ける | Supabase接続時 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ブラウザ公開可。ただし不要な表示は避ける | Supabase接続時 |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー側DB操作 | サーバー専用 | Route Handler、Webhook、通知、外部API |
| `LINE_CHANNEL_SECRET` | LINE Webhook署名検証 | サーバー専用 | LINE Webhook |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Reply/Push送信 | サーバー専用 | LINE通知、LINE返信 |
| `LINE_ORGANIZATION_ID` | LINE公式アカウントを紐づける組織ID | サーバー専用 | LINE連携 |
| `NEXT_PUBLIC_APP_URL` | LINE返信URLなどの公開Origin | ブラウザ公開可 | LINE連携、本番URL生成 |

### 環境別チェック

- ローカル: `.env.example` を雛形に `.env.local` を作成する。内容は表示しない。
- ステージング: 本番と同じ変数を設定し、LINEはステージング用チャネルを分ける。
- 本番: Supabase project、LINE Messaging APIチャネル、公開HTTPSドメインを本番用に固定する。
- `NEXT_PUBLIC_APP_URL` は末尾スラッシュなしにする。
- service role key、LINE secret、LINE access token はローテーション手順をパスワード管理ツールに残す。

### 値を表示しない確認方法

通常確認では `.env.example` とホスティング環境の変数名一覧だけを見ます。
実値が必要になった場合は、[SECURITY.md](../SECURITY.md) に従って、目的と値を表示しない確認方法を先に説明し、明示的な許可を得ます。

## 2. デプロイ前チェック

本番反映前に、次を確認します。

- `npm run lint` が成功する。
- `npm run build` が成功する。
- 必要なSupabaseマイグレーションがSQL EditorまたはSupabase CLIで適用済み。
- `docs/supabase-setup.md`、`docs/line-setup.md` の未完了手順が残っていない。
- `/api/internal/supabase/health` が `ok: true` を返す。
- 外部連携APIを使う場合、APIキーはハッシュ保存し、平文キーは発行直後だけ安全に渡す。
- LINEを使う場合、LINE DevelopersのWebhook検証がHTTP 200になる。

## 3. エラー監視方針

初期運用では、次の3段階で監視します。

### レベル1: プラットフォーム標準ログ

- Next.jsホスティング環境のサーバーログを確認する。
- Supabase DashboardでAPIエラー、DBエラー、Auth関連エラーを確認する。
- LINE DevelopersコンソールでWebhookエラー、応答失敗、Messaging APIエラーを確認する。

### レベル2: アプリ内に残すべき運用ログ

- `audit_logs`: 打刻修正、承認/却下、LINE連携/解除など重要操作。
- `notifications.line_delivery_status`: LINE Push送信の `pending` / `delivered` / `failed`。
- 将来実装予定の `external_api_access_logs`: 日報アプリ向け外部APIのアクセス記録。

### レベル3: 導入候補

本番利用者が増えたら、次の外部監視を追加検討します。

- フロントエンド/サーバー例外監視: Sentryなど。
- 死活監視: `/api/internal/supabase/health` への定期HTTP監視。
- 通知: 5xx増加、LINE配信失敗増加、外部API認証失敗増加を管理者へ通知。

### 初期アラート基準

- `/api/internal/supabase/health` が連続して失敗する。
- LINE Webhookが5xxを返す、または署名検証失敗が急増する。
- `notifications.line_delivery_status = failed` が短時間に複数発生する。
- 打刻APIでGPS範囲外、PIN失敗、順序不正が急増する。
- 外部連携APIで401/403が急増する。

## 4. バックアップと復旧

Supabase PostgreSQLを正本として扱います。

### バックアップ方針

- Supabaseの自動バックアップ/PITRの利用可否を本番プランで確認する。
- 最低限、日次バックアップが取れる状態にする。
- 大きなマイグレーション前は手動バックアップまたは復旧ポイントを作成する。
- CSV/PDF出力は業務提出用であり、DBバックアップの代替にしない。

### 復旧手順

1. 障害範囲を切り分ける。
   - アプリだけの障害か。
   - Supabase接続障害か。
   - 誤操作・誤マイグレーションによるデータ障害か。
2. 影響テーブルを特定する。
   - 勤怠正本: `attendance_records`
   - 打刻履歴: `attendance_events`
   - 申請: `attendance_requests`
   - シフト: `shifts`, `shift_submission_windows`, `shift_submissions`, `shift_submission_items`
   - 監査: `audit_logs`
3. 直近のバックアップまたは復旧ポイントを選ぶ。
4. 必要に応じて別環境へ復元し、差分確認してから本番へ反映する。
5. 復旧後、`/api/internal/supabase/health`、打刻、レポート、LINE通知を確認する。
6. 原因、影響、復旧内容、再発防止を運用記録へ残す。

### 復旧時に守ること

- `attendance_events` は監査用の生ログなので、原則削除しない。
- 手修正が必要な場合は、理由と変更前後を `audit_logs` に残す運用にする。
- 実キーや個人情報を障害報告へ貼り付けない。

## 5. 権限・個人情報チェック

### ロール別確認

| ロール | 確認観点 |
|---|---|
| オーナー | 全店舗、スタッフ、レポート、監査ログを管理できる。不要なユーザーを無効化できる。 |
| 店長 | `manager_store_permissions` の担当店舗だけを操作できる。 |
| 社労士 | 許可された組織の勤怠閲覧・出力に限定する。 |
| スタッフ | 自分の勤怠、シフト、通知だけを確認できる。 |
| 外部API | `X-External-Api-Key` がない、無効、失効済みの場合は拒否する。 |
| LINE Webhook | 署名検証に成功したイベントだけ処理する。 |

### 個人情報として扱うもの

- スタッフ氏名、ふりがな、メールアドレス。
- 勤怠時刻、休憩、勤務時間、時給。
- GPS座標、店舗からの距離、端末由来の打刻情報。
- LINE user ID、表示名、プロフィール画像URL。
- 申請メモ、シフト希望メモ。

### 運用チェックリスト

- 退職者・異動者の `staff.is_active` と所属店舗を更新する。
- 不要になった店長・社労士アカウントの権限を解除する。
- 共有iPad端末を紛失・入替した場合は `kiosk_devices` を無効化する。
- APIキーは利用先ごとに分け、不要になったら失効する。
- LINE連携解除の問い合わせ時は、本人確認後に `line_accounts` の状態を確認する。
- レポートCSV/PDFは、送付先と保管場所を確認してから扱う。

## 6. 定期運用

### 毎日

- 打刻エラー、通知失敗、LINE Webhookエラーがないか確認する。
- 店長からの打刻漏れ・修正依頼の問い合わせを確認する。

### 毎月

- 月次レポートCSV/PDFの出力確認を行う。
- 店舗、スタッフ、権限の棚卸しを行う。
- Supabaseバックアップ状態を確認する。

### 四半期

- service role key、LINE access token、外部APIキーの利用状況を棚卸しする。
- 不要なAPIキーや権限を削除する。
- 復旧手順をステージングまたは検証環境でリハーサルする。

## 7. 関連ドキュメント

- [SECURITY.md](../SECURITY.md): 機密情報と `.env.local` の取り扱い
- [Supabase Setup](./supabase-setup.md): Supabase接続、マイグレーション、接続確認
- [LINE Messaging API 設定手順](./line-setup.md): LINE Webhook、環境変数、実機確認
- [Database Design](./database-design.md): テーブル設計、権限、データ正本
- [日報アプリ向け外部連携API仕様](./integrations/attendance-api-spec.md): 外部API契約
