# 日報アプリ向け外部連携API仕様

## 文書の正本と現在状態

- 本文書を勤怠管理アプリが提供する外部API契約の正本とする。
- 連携先は `weimaraner69-crypto/kashio-nippou-app_20260611Start`。
- 日報側リポジトリにある初期仕様は設計時点の写しであり、SHA-256によるキー照合、Phase 1では `include_events=true` を未対応エラーにする挙動、カーソル形式など、実装確定後の差分は本文書を優先する。
- 2026-07-13時点で、日報側の勤怠連携 `A-005` はBacklog。日報側へのキー設定、マッピング、取り込み、実接続は同タスクがNextへ昇格するまで保留する。
- 接続作業を再開する前に、本文書の契約を日報側へ同期し、双方で同じバージョンを参照していることを確認する。

## 目的

日報管理アプリが、勤怠管理アプリで打刻・集計した勤務データをサーバー間通信で取得できるようにする。
勤怠管理アプリは出退勤データの正本、日報管理アプリは日次売上・仕入・小口現金・人件費集計の正本として分ける。

## 関連GitHub Issue

- 親Issue: https://github.com/weimaraner69-crypto/Attendance_app_withCodeX_20260625/issues/1
- #2 外部APIキー認証基盤を実装する
- #3 `/health` `/stores` `/staff` を実装する
- #4 `/attendance` 一覧取得を実装する
- #5 `/attendance/{id}` と `include_events` を実装する
- #6 オーナー向けAPIキー管理画面を実装する
- #7 レート制限とAPIアクセスログを実装する

## 全体方針

- 勤怠管理アプリの `attendance_records` を日別勤怠結果の正本とする。
- 勤怠管理アプリの `attendance_events` を打刻監査ログの正本とする。
- 日報管理アプリは外部APIを読み取り専用で呼び出す。
- 勤怠側は自分のUUID体系で `store_id` / `staff_id` / `attendance_record_id` を返す。
- 日報側の店舗・スタッフIDとの突き合わせは、日報側のマッピングテーブルで行う。
- 初回リリースは手動取り込みを前提にし、完全自動同期やwebhookは後続フェーズとする。

## 実装フェーズ

### Phase 1 最小リリース

Issue #2, #3, #4 を対象にする。

- `external_api_keys` テーブル
- `X-External-Api-Key` 認証
- 共通エラー応答
- `GET /api/external/v1/health`
- `GET /api/external/v1/stores`
- `GET /api/external/v1/staff`
- `GET /api/external/v1/attendance`

Phase 1 が完了すれば、日報アプリ側で店舗・スタッフのマッピングと勤怠取り込み検証を開始できる。

APIキーのハッシュ生成は次のコマンドで行う。

```bash
npm run external-api:hash-key
```

macOSでは、平文キーをターミナルへ表示せずキーチェーンへ保存できる。

```bash
npm run external-api:hash-key -- --store-keychain
```

この方法では、サービス名 `attendance-app.external-api`、アカウント名 `daily-report-production` で保存し、Supabase登録用のSHA-256ハッシュだけを表示する。

キーチェーンの現在値からハッシュを計算し、`.env.local` のサーバー設定を内部利用してSupabaseへ同期する場合:

```bash
npm run external-api:sync-keychain
```

このコマンドは平文キー、Supabase URL、Service role keyを表示しない。

ローカル起動中のAPIへ、キーを表示せず疎通確認する場合:

```bash
npm run external-api:verify-keychain
```

`health`、`stores`、`staff` のHTTP状態と件数だけを表示する。店舗が未登録の場合、店舗指定が必須の `attendance` 検証はスキップする。

既存の平文キーからハッシュを作る場合:

```bash
npm run external-api:hash-key -- your-plain-api-key
```

表示された `SHA-256 hash` を `external_api_keys.key_hash` に保存し、平文キーは安全な場所に保管する。

Supabase SQL Editor での登録例:

```sql
insert into public.external_api_keys (
  organization_id,
  name,
  key_hash,
  scopes
) values (
  'your-organization-uuid',
  '日報アプリ開発',
  'generated-sha-256-hash',
  array['attendance:read']
);
```

`organization_id` は `organizations.id` を指定する。

### Phase 2 運用強化

Issue #5, #6, #7 を対象にする。

- `GET /api/external/v1/attendance/{record_id}`
- `include_events=true`
- APIキー管理画面
- レート制限
- APIアクセスログ
- 修正申請承認後の再同期検知

日報側の準備待ち期間は、公開運用の安全性に直接関係する #7、運用性を改善する #6 の順で先行する。レスポンス契約へ影響する #5 は、日報側の利用要件が固まるまで保留する。

## 認証

すべての外部APIは `X-External-Api-Key` ヘッダを必須とする。
APIキーは平文保存せず、`external_api_keys.key_hash` にハッシュ化して保存する。

想定テーブル:

```sql
create table public.external_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_hash text not null,
  scopes text[] not null default '{attendance:read}',
  is_active boolean not null default true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 共通エラー応答

```json
{
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "from と to の差が31日を超えています",
    "details": {
      "from": "2026-06-01",
      "to": "2026-07-15"
    }
  }
}
```

主なエラーコード:

| HTTP | code | 意味 |
|---|---|---|
| 400 | `INVALID_PARAMS` | 必須パラメータ欠落、型不正 |
| 400 | `INVALID_DATE_RANGE` | 期間不正、31日超過 |
| 401 | `UNAUTHENTICATED` | APIキーなし、無効、期限切れ |
| 403 | `FORBIDDEN` | スコープ不足、無効化済み |
| 404 | `NOT_FOUND` | 指定リソースなし |
| 429 | `RATE_LIMITED` | レート制限超過 |
| 500 | `INTERNAL_ERROR` | サーバー内部エラー |

## エンドポイント

### `GET /api/external/v1/health`

認証済みAPIキーの疎通確認用。

```json
{
  "ok": true,
  "organization": {
    "id": "organization-uuid",
    "name": "組織名"
  },
  "api_key": {
    "name": "日報アプリ本番",
    "scopes": ["attendance:read"]
  },
  "server_time": "2026-06-25T09:00:00+09:00"
}
```

### `GET /api/external/v1/stores`

日報側の店舗マッピング候補として、APIキーに紐づく組織内の店舗を返す。

Query:

- `is_active`: boolean、任意。省略時は `true`。

返却項目:

- `id`
- `code`
- `name`
- `is_active`

### `GET /api/external/v1/staff`

日報側のスタッフマッピング候補として、APIキーに紐づく組織内のスタッフを返す。

Query:

- `store_id`: uuid、任意。指定時は対象店舗に所属中のスタッフに絞る。
- `is_active`: boolean、任意。省略時は `true`。
- `updated_since`: ISO8601、任意。

返却項目:

- `id`
- `employee_code`
- `name`
- `name_kana`
- `default_store_id`
- `employment_type`
- `is_active`
- `joined_on`
- `retired_on`
- `updated_at`

`email`, `phone`, `pin_hash` は返さない。

### `GET /api/external/v1/attendance`

指定店舗・期間の `attendance_records` を返すメインAPI。

Query:

- `store_id`: uuid、必須
- `from`: `YYYY-MM-DD`、必須
- `to`: `YYYY-MM-DD`、必須
- `status`: 任意。省略時は `finished`。
- `include_events`: boolean、任意。`true` は Phase 2対象のため、Phase 1では `400 INVALID_PARAMS` を返す。
- `cursor`: 任意。ページング用。Phase 1では数値オフセット文字列として扱う。

バリデーション:

- `to < from` は `400 INVALID_DATE_RANGE`
- `from` と `to` の差が31日を超える場合は `400 INVALID_DATE_RANGE`
- 1ページ最大500件

返却項目:

- `store`
- `range`
- `records`
- `count`
- `next_cursor`

`records` には以下を含める。

- `id`
- `staff.id`
- `staff.employee_code`
- `staff.name`
- `work_date`
- `status`
- `clock_in_at`
- `clock_out_at`
- `break_minutes`
- `total_work_minutes`
- `night_shift_minutes`
- `is_manual`
- `note`
- `updated_at`

### `GET /api/external/v1/attendance/{record_id}`

Phase 2対象。
単一勤怠記録の詳細を返し、常に `events` と `pending_requests` を含める。

## 日付・時刻

- `work_date` は `organizations.timezone` 基準の日付とする。
- 日跨ぎ勤務の `work_date` は勤務開始日で固定する。
- `clock_in_at`, `clock_out_at`, `occurred_at`, `updated_at` はタイムゾーン付きISO8601で返す。

## データ整合性

勤怠側で保証すること:

- `attendance_records.staff_id` と `work_date` は一意。
- `status = 'finished'` のレコードは `clock_in_at` と `clock_out_at` を持つ。
- `total_work_minutes` は `clock_out_at - clock_in_at - break_minutes` の結果と一致する。
- 事後修正時は `attendance_records.updated_at` を必ず更新する。

## cURL サンプル

```bash
curl -i \
  -H "Accept: application/json" \
  -H "X-External-Api-Key: $ATTENDANCE_API_KEY" \
  "https://attendance.example.com/api/external/v1/health"
```

```bash
curl -i \
  -H "Accept: application/json" \
  -H "X-External-Api-Key: $ATTENDANCE_API_KEY" \
  "https://attendance.example.com/api/external/v1/stores"
```

```bash
curl -i \
  -H "Accept: application/json" \
  -H "X-External-Api-Key: $ATTENDANCE_API_KEY" \
  "https://attendance.example.com/api/external/v1/staff?store_id=$ATTENDANCE_STORE_ID"
```

```bash
curl -i \
  -H "Accept: application/json" \
  -H "X-External-Api-Key: $ATTENDANCE_API_KEY" \
  "https://attendance.example.com/api/external/v1/attendance?store_id=$ATTENDANCE_STORE_ID&from=2026-06-01&to=2026-06-25"
```
