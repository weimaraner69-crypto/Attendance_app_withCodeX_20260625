# Issue #5 勤怠詳細APIとイベント返却の実装準備

## 背景と目的

- 対象の課題: GitHub Issue #5「`/attendance/{id}` と `include_events` を実装する」。
- 利用者の意図: 日報管理アプリが、一覧取得後に必要な1件だけを再確認し、勤怠修正の有無を安全に判断できるようにする。
- 現在状態: 日報側の勤怠連携 `A-005` はBacklogのままであり、本仕様は勤怠側の実装準備用ドラフトである。API実装、日報側への本文同期、APIキー設定、実接続は開始しない。
- 非目標: 位置座標・端末ID・認証ユーザーID・LINE識別子・イベントメモ・修正申請理由の外部公開、日報側データの書き換え、本番Supabase変更。

## 要件

### 変更しない前提

- APIキー認証、`attendance:read` スコープ、組織境界、レート制限、アクセスログ、共通エラー形式は既存の外部APIと同じ経路を使う。
- `GET /api/external/v1/attendance` の既存レスポンスと `note` の扱いは変更しない。
- 他組織のレコードIDと存在しないレコードIDは区別せず、どちらも `404 NOT_FOUND` にする。

### 提案する詳細API契約

`GET /api/external/v1/attendance/{record_id}` を追加する。

- `record_id` 以外に `store_id` は要求しない。認証済みAPIキーの組織IDとレコードの組織IDを必ず照合する。
- 既定レスポンスは次の固定形とし、一覧の勤怠サマリーから自由記述の `note` を除いた `record` を返す。`events` と `pending_requests` は既定で返さない。

```json
{
  "store": { "id": "uuid", "code": "store-code", "name": "店舗名" },
  "record": {
    "id": "uuid",
    "staff": { "id": "uuid", "employee_code": "string or null", "name": "スタッフ名" },
    "work_date": "YYYY-MM-DD",
    "status": "not_started | working | on_break | finished",
    "clock_in_at": "ISO8601 or null",
    "clock_out_at": "ISO8601 or null",
    "break_minutes": 60,
    "total_work_minutes": 480,
    "night_shift_minutes": 0,
    "is_manual": false,
    "updated_at": "ISO8601"
  }
}
```

- 既存一覧の `note` は過去のPhase 1契約として残るが、修正申請の自由記述を含み得るため詳細APIでは返さない。Issue #5の実装開始前に、一覧の `note` を将来の契約から除外する移行要否を日報側と確認する。
- `status` は既存の `not_started`、`working`、`on_break`、`finished` のいずれかとする。時刻および集計値の `null` 可否は既定レスポンスの固定形に従い、未完了の状態を `finished` とみなさない。
- `include_events` は未指定、空文字、`false` を `false` として扱う。`true` の場合だけ `events` を返し、それ以外の値は `400 INVALID_PARAMS` とする。
- `include_events=true` の場合も、既定の最上位 `store` と `record` は必ず同じ固定形で返し、第三の最上位キーとして `events` を追加する。`events` は次の形とする。`items` は最大100件で、`occurred_at` 昇順、同時刻は `id` 昇順とする。続きがなければ `next_cursor` は必ず `null` とする。

```json
{
  "events": {
    "items": [
      { "id": "uuid", "event_type": "clock_in", "occurred_at": "ISO8601", "source": "web" }
    ],
    "next_cursor": "opaque-string or null"
  }
}
```

- `event_cursor` は `include_events=true` のときだけ指定できる任意のクエリパラメータとする。未指定または空文字は先頭ページを意味し、前ページの `next_cursor` 以外、改ざん値、または `include_events` が `true` でないときの指定は `400 INVALID_PARAMS` とする。
- カーソル自体にTTLは設けず、発行後も同じ組織内の同じレコードに限り受け付ける。イベントはページ取得中にも追加され得るため、ページングは `occurred_at` と `id` の安定順だけを保証し、全ページのスナップショット一貫性は保証しない。
- 各イベントは `id`、`event_type`、`occurred_at`、`source` だけを返す。`gps_verified` は日報側が必要性を確認した場合だけ、別の明示的な契約追加として扱う。
- `latitude`、`longitude`、`gps_accuracy_meters`、`distance_from_store_meters`、`auth_user_id`、`kiosk_device_id`、`pin_verified_at`、`line_account_id`、`line_message_id`、`created_by_user_id`、`note` は返さない。
- `attendance_requests` は理由・レビューコメントなどの個人情報を持つため、`pending_requests` として外部APIへ返さない。修正済みの有無は既存の `is_manual` と `updated_at` を同期判定に用いる。

### 一覧APIの `include_events`

- 現在の一覧APIは `include_events=true` を `400 INVALID_PARAMS` で拒否する。この挙動は維持する。
- 全件イベント同梱は応答サイズ・レート制限・日報側の利用目的を別途確認する必要があるため、日報側 `A-005` の設計時に独立した拡張判断として扱う。
- Issue #5を完了扱いにする前に、日報側が一覧へのイベント同梱を必要とするかを明示的に判断する。必要なら、ページ上限、対象期間、固定レスポンス例、回帰テストを追加してから実装する。

## 設計

- 変更する責務境界: 新しいRoute Handlerは既存の `withExternalApiRequest` を必ず通し、認証、組織スコープ、レート制限、アクセスログ、`GET` / `HEAD` 以外の405を共通化する。
- データ取得: `attendance_records` を組織IDとIDで絞り、スタッフ情報を既存一覧と同じ形で結合する。イベントは `include_events=true` のときだけ、同じ組織IDかつ `attendance_record_id` で絞る。
- 失敗時の扱い: 不正UUID、不正な `include_events`、または不正な `event_cursor` は `400 INVALID_PARAMS`、対象外または不存在は `404 NOT_FOUND`、認証・スコープ・レート制限は既存の共通応答を維持する。
- 契約バージョン: 実装承認後に `attendance-external-v1` の次スナップショットへ更新する。このドラフト作成だけでは公開契約を更新しない。

## 受入条件と検証

### 実装開始条件

- [ ] 日報側 `A-005` がNextへ昇格し、詳細参照が必要な業務フローを確認する。
- [ ] 日報側が、一覧へのイベント同梱を不要と確認するか、必要な場合のページ上限・対象期間を承認する。
- [ ] 実接続前に本仕様を日報側リポジトリへ同期し、同じ契約スナップショットを参照できるようにする。
- [x] GitHub Issue #5の受入条件とcURL例を、本仕様の既定サマリー、任意イベント、修正申請非公開、一覧イベント同梱の別判断へ同期した（2026-08-06）。
- [ ] 日報側が `gps_verified` と既存一覧の `note` を取り込みに必要とするかを確認し、必要な場合だけ最小契約・移行方針を追加する。

### 実装受入条件

- [ ] 同一組織かつ `attendance:read` のキーで、`note` を除いた固定形の勤怠サマリーを1件返す。`status` は `not_started`、`working`、`on_break`、`finished` の全値を正しく返す。
- [ ] 存在しないIDと他組織IDのどちらも `404 NOT_FOUND` を返す。
- [ ] `include_events` 未指定、空文字、または `false` のとき、`events` と `pending_requests` を返さない。不正値は `400 INVALID_PARAMS` を返す。
- [ ] `include_events=true` のときも既定の `store` と `record` を保持し、`events.items` を最大100件、`occurred_at`・`id` の安定順で返す。続きがある場合は不透明な `next_cursor`、最終ページは `next_cursor: null` を返す。
- [ ] `event_cursor` は `include_events=true` で前ページの `next_cursor` だけを受け付け、続きページを安定順で返す。不正カーソルまたはイベント未指定時のカーソルは `400 INVALID_PARAMS` を返す。TTLは設けず、ページ間のスナップショット一貫性は保証しない。
- [ ] `include_events=true` のとき、最小イベント項目だけを返し、位置・端末・認証・LINE・自由記述の各情報を含めない。
- [ ] 詳細の `record` は固定レスポンス形に一致し、`note` を返さない。
- [ ] 修正承認後の `is_manual` と `updated_at` が一覧・詳細の両方へ反映される。
- [ ] 無効・期限切れ・スコープ不足キー、405、429、レート制限ヘッダーの既存挙動を維持する。
- [ ] 一覧APIの `include_events=true` は、日報側の明示承認と追加受入条件が揃うまで `400 INVALID_PARAMS` のままにする。

### 検証コマンド（実装時）

- `npm test -- src/lib/external-api/routes.test.ts`
- `npm test -- src/lib/external-api/auth.test.ts src/lib/external-api/request.test.ts`
- `python3 ci/policy_check.py`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Runtime smoke（実装時）

- テスト用の同一組織・他組織レコードを使い、詳細の既定レスポンス、イベント明示指定、404、認証拒否をRoute Handlerレベルで確認する。
- 実APIキー、実店舗データ、日報アプリへの接続は使用しない。

### リスクティア

- 今回の実装準備文書はgreen相当である。
- 詳細Route、外部APIのパラメータ、認証・組織スコープ、イベント公開を変更する実装PRはredとして扱い、`full_repo_agentic`の独立レビュー、専用回帰テスト、全CI、ロールバック手順を必須とする。

## ロールバック方針

- 実装後に日報側の利用要件が変わった場合は、詳細Routeと契約テストを同じPR単位でrevertする。
- 既存一覧APIおよびDBスキーマを変更しないため、この準備段階にDBロールバックはない。
