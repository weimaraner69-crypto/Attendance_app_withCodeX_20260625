# FINISHED

実装が完了した項目のログです。

## 記録ルール

- `NEXT.md` の項目を完了したら追記します。
- 項目ID、項目名、実装日、実装内容、確認内容、影響ファイルを記録します。
- `CHANGELOG.md` にも意味のある変更として追記します。

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
