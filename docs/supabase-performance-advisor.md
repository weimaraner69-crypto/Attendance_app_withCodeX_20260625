# Supabase Performance Advisor 対応判断

最終調査日: 2026-07-13

## 現在値（適用後）

2026-07-13に `202607130002_performance_advisor_optimization.sql` を本番へ適用し、Performance Advisorを再実行して次を確認した。

- Errors: 0
- Warnings: 0
- Info: 42
- `pg_policies` の対象: `public` 69ポリシー
- 未最適化の直接 `auth.uid()` ポリシー: 0
- 追加対象13索引の不足: 0
- `idx_scan = 0` の非制約インデックス: 42

残るInfo 42件はすべて `Unused Index` である。適用直後の13索引も含まれ得るため、少なくとも30日間の通常運用と統計を確認するまで削除しない。

## 適用前ベースライン

- Errors: 0
- Warnings: 73
- Info: 44
- `pg_policies` の対象: `public` 35ポリシー

適用前調査ではSQL Editorから `pg_policies`、`pg_constraint`、`pg_index`、`pg_stat_user_indexes` のみを読み取り、全指摘を分類した。

## 適用前Warnings 73件

### Auth RLS Initialization Plan 8件

直接の `auth.uid()` 呼び出しを含む次の8テーブルのSELECTポリシーが対象。

| テーブル | ポリシー |
|---|---|
| `staff` | `staff can read own staff profile` |
| `attendance_records` | `store scoped users can read attendance records` |
| `attendance_events` | `store scoped users can read attendance events` |
| `attendance_requests` | `store scoped users can read attendance requests` |
| `shifts` | `store scoped users can read shifts` |
| `shift_submissions` | `organization members can read shift submissions` |
| `shift_submission_items` | `organization members can read shift submission items` |
| `notifications` | `organization members can read own notifications` |

対応は `auth.uid()` を `(select auth.uid())` に変更し、ステートメントごとの初期化プランとして評価できる形にする。許可条件そのものは変更しない。

### Multiple Permissive Policies 65件

次の13テーブルで、読み取りポリシーと管理用 `FOR ALL` ポリシーがSELECT操作上で重複している。Advisorは対象ロールごとに指摘を展開するため、基礎原因13件が65件として表示される。

`attendance_events`, `attendance_records`, `attendance_requests`, `line_accounts`, `notifications`, `shift_submission_items`, `shift_submission_windows`, `shift_submissions`, `shifts`, `staff`, `store_staff_assignments`, `stores`, `user_profiles`

対応は次のとおり。

- 管理用 `FOR ALL` を、同じ条件の `INSERT`、`UPDATE`、`DELETE` ポリシーへ分割する。
- `staff` の2つのSELECTポリシーは、既存条件の論理和を1ポリシーへ統合する。
- 従来 `FOR ALL` だけでSELECTを許可していた `kiosk_devices`、`manager_store_permissions`、`sr_organization_permissions` には、同じ条件のSELECTポリシーを追加する。
- 条件式は `owner`、`manager`、組織境界、店舗境界のいずれも変更しない。

実装は `supabase/migrations/202607130002_performance_advisor_optimization.sql` にまとめ、本番適用後のRLSスモークテストまで完了した。

## 適用前Info 44件

### 未索引外部キー 13件

2026-07-13のカタログクエリで、外部キー列を先頭に持つ有効な索引がないことを確認した。

| テーブル | 外部キー列 | 追加索引 |
|---|---|---|
| `attendance_events` | `organization_id` | `idx_attendance_events_organization_id` |
| `attendance_records` | `organization_id` | `idx_attendance_records_organization_id` |
| `attendance_requests` | `organization_id` | `idx_attendance_requests_organization_id` |
| `attendance_requests` | `staff_id` | `idx_attendance_requests_staff_id` |
| `manager_store_permissions` | `organization_id` | `idx_manager_store_permissions_organization_id` |
| `notifications` | `organization_id` | `idx_notifications_organization_id` |
| `shift_submission_items` | `organization_id` | `idx_shift_submission_items_organization_id` |
| `shift_submission_items` | `submission_id` | `idx_shift_submission_items_submission_id` |
| `shift_submission_windows` | `organization_id` | `idx_shift_submission_windows_organization_id` |
| `shift_submissions` | `organization_id` | `idx_shift_submissions_organization_id` |
| `shift_submissions` | `staff_id` | `idx_shift_submissions_staff_id` |
| `shifts` | `organization_id` | `idx_shifts_organization_id` |
| `store_staff_assignments` | `organization_id` | `idx_store_staff_assignments_organization_id` |

外部キーの更新・削除確認と組織境界クエリに利用できるため、13件すべて追加する。既存マイグレーションの索引と先頭列を照合し、同一索引がないことを確認済み。

### 未使用インデックス 31件

`idx_scan = 0` だった次の31件は削除しない。

```text
attendance_events.idx_attendance_events_auth_user_id
attendance_events.idx_attendance_events_created_by_user_id
attendance_events.idx_attendance_events_kiosk_device_id
attendance_events.idx_attendance_events_line_account_id
attendance_events.idx_attendance_events_record
attendance_events.idx_attendance_events_staff_time
attendance_events.idx_attendance_events_store_time
attendance_requests.idx_attendance_requests_attendance_record_id
attendance_requests.idx_attendance_requests_reviewed_by_user_id
audit_logs.idx_audit_logs_actor_line_account_id
audit_logs.idx_audit_logs_actor_user_id
external_api_keys.idx_external_api_keys_expires_at
kiosk_devices.idx_kiosk_devices_store_active
line_accounts.idx_line_accounts_staff
manager_store_permissions.idx_manager_store_permissions_store_id
notifications.idx_notifications_recipient_staff
notifications.idx_notifications_recipient_user
shift_submission_windows.idx_shift_submission_windows_created_by_user_id
shift_submission_windows.idx_shift_submission_windows_store_id
shift_submissions.idx_shift_submissions_line_account_id
shift_submissions.idx_shift_submissions_reviewed_by_user_id
shift_submissions.idx_shift_submissions_window_status
shifts.idx_shifts_created_by_user_id
shifts.idx_shifts_staff_date
sr_organization_permissions.idx_sr_organization_permissions_user_id
staff.idx_staff_auth_user
staff.idx_staff_default_store_id
staff.idx_staff_org_active
store_staff_assignments.idx_store_staff_assignments_staff_id
store_staff_assignments.idx_store_staff_store
user_login_pins.idx_user_login_pins_organization
```

現在は本番トラフィックの観測期間が短く、直前に追加した外部キー補助索引も含まれる。少なくとも30日間の通常運用後に `pg_stat_user_indexes` の統計リセット時刻、主要クエリ、外部キー、ユニーク制約を再確認してから削除可否を判断する。新規13索引も適用直後は未使用として表示される可能性があるため、Info総数だけで削除判断を行わない。

## 適用結果

1. PR #11のCopilotレビューと全GitHub Actions成功後に、本番SQL Editorでマイグレーションを実行し、`Success. No rows returned` を確認した。
2. 未最適化の直接 `auth.uid()` ポリシー0件、追加対象索引の不足0件をカタログクエリで確認した。
3. オーナー、店長、社労士は既存プロフィールを使い、ロール判定、組織解決、組織内読み取り、組織外非表示を確認した。
4. 本番にスタッフAuthプロフィールがまだないため、スタッフは既存ownerをトランザクション内だけstaffへ変更してスタッフ行を紐付け、同じRLS項目と本人スタッフ行の読み取りを確認後にロールバックした。
5. ロールバック後はactive ownerが存在し、staffプロフィール0件、ownerとstaffの一時紐付け0件であることを確認した。
6. Performance Advisorを再実行し、Errors 0、Warnings 0、Info 42を確認した。

RLS管理操作の許可条件は、マイグレーション回帰テストで旧 `FOR ALL` 条件と分割後の `INSERT`、`UPDATE`、`DELETE` 条件が一致することを固定している。本番スモークでは永続データを変更していない。
