# 変更ログ

変更を元に戻したい場合の参照用ログです。
各エントリには「何を・なぜ変更したか」と「影響ファイル」を記録します。

---

## [2026-06-25] Sランク仕様確定とSupabase接続基盤追加

### 実施概要
`NEXT.md` の Sランク項目に沿って、DB方針、打刻方式、権限設計を確定。
あわせて、Supabase接続に必要なnpmパッケージ、環境変数テンプレート、client/server/admin用ヘルパーを追加した。

### 完了
- `S-001 DB方針の確定`
  - Supabase PostgreSQLで継続する方針に確定。
- `S-002 打刻方式の仕様確定`
  - 店舗iPadは氏名選択+PIN。
  - 個人スマホはログイン+GPS。
  - LINEは初期実装ではWeb打刻URL誘導を優先。
- `S-003 権限設計の確定`
  - オーナー、店長、社労士、スタッフの権限方針を確定。
  - スタッフ打刻はサーバー側APIで検証してからDB書き込みする方針に整理。

### 追加
- `docs/implementation-decisions.md`
  - S-001〜S-003の決定内容を記録。
- `.env.example`
  - Supabase接続用の環境変数テンプレートを追加。
- `src/lib/supabase/`
  - `client.ts`: ブラウザ用Supabase client。
  - `server.ts`: Next.jsサーバー用Supabase client。
  - `admin.ts`: service role用Supabase admin client。
  - `env.ts`: 環境変数取得ヘルパー。
  - `database.types.ts`: 初期スキーマに対応するDB型。
  - `index.ts`: Supabase関連export。

### 変更
- `NEXT.md`
  - S-001〜S-003を完了扱いに更新。
  - S-004を一部着手として更新。
- `FINISHED.md`
  - S-001〜S-003の完了ログを追記。
- `package.json` / `package-lock.json`
  - `@supabase/supabase-js` と `@supabase/ssr` を追加。

### 未完了
- Supabaseプロジェクト作成。
- マイグレーション適用。
- `.env.local` 設定。

### 影響ファイル
- `.env.example`
- `CHANGELOG.md`
- `FINISHED.md`
- `NEXT.md`
- `docs/implementation-decisions.md`
- `package.json`
- `package-lock.json`
- `src/lib/supabase/`

### 戻し方
- 追加したSupabase接続ファイルと `.env.example` を削除し、`package.json` / `package-lock.json` からSupabase関連パッケージを戻す。

---

## [2026-06-25] 作業管理ファイルとREADME整備

### 実施概要
今後の開発を `NEXT.md` の優先度付き項目に沿って進められるように、作業管理用ドキュメントを追加。
あわせて、完了ログ用の `FINISHED.md` を作成し、READMEを日本語のプロジェクト説明へ書き直した。

### 追加
- `NEXT.md`
  - S/A/B/C の優先度別バックログを作成。
  - `S-001` のような固定IDを各作業項目に付与。
  - 完了時に `FINISHED.md` と `CHANGELOG.md` を更新するルールを記載。
- `FINISHED.md`
  - 完了項目の記録フォーマットを作成。
  - 初回ログとして `DOC-001 作業管理ファイル整備` を記録。

### 変更
- `README.md`
  - Next.js 初期READMEから、日本語のプロジェクト説明へ全面更新。
  - 目的、技術スタック、ディレクトリ構成、開発コマンド、作業管理ルールを記載。
- `CHANGELOG.md`
  - 今回のドキュメント整備を先頭に追記。

### 影響ファイル
- `NEXT.md`
- `FINISHED.md`
- `README.md`
- `CHANGELOG.md`

### 戻し方
- `NEXT.md` と `FINISHED.md` を削除し、`README.md` と `CHANGELOG.md` を直前コミットの内容に戻す。

---

## [v1.0.0] 2026-04-16 — 技術スタック刷新完了

### 実施概要
v0.x の実装を進める中で判明した技術的問題（Next.js 16 ベータの不安定性、base-ui の API 相違、サーバー状態管理の非効率性）を理由に、プロジェクトを段階的に再構築。

### 実施内容

#### 段階1: 基盤構築
- **Next.js**: v16 → **v14（LTS相当）** にダウングレード
  - `params` が通常のオブジェクト型に（v16 では Promise 型）
  - API routes の安定性向上
  
- **shadcn/ui**: base-ui系 → **Radix UI系** に再セットアップ
  - Select等のコンポーネントがドキュメント通りに動作
  - 公式サポートの充実
  
- **状態管理**: TanStack Query を追加
  - サーバーデータ（店舗、スタッフ、勤怠記録）: **TanStack Query** で管理
  - UI状態（モーダル開閉、選択状態）: **Zustand** のみ
  - 役割分担が明確に
  
- **PDF出力**: @react-pdf/renderer → jsPDF + html2canvas に変更予定
  - バンドルサイズ削減（1MB → 200KB程度）
  - シフト表のような表形式に適切

#### 段階2: 型定義・ロジック移植
- 型定義（`src/types/`）をそのまま移植
- 計算ロジック（dateUtils.ts, gpsUtils.ts）をそのまま移植
- Zustand Store を UI状態のみに簡潔化（5ファイル）
- TanStack Query フック層を新規作成（`src/lib/api/hooks.ts`）
  - useShops, useStaff, useTodayAttendances, useStamp, useCorrectionRequests, useShifts など15個

#### 段階3: コンポーネント・ページ移植
- 全7個のコンポーネントを移植・修正
- 全16ルート・23個のページを実装
- base-ui Select API → Radix UI Select API に統一
- `use(params)` を削除（Next.js 14 形式に）
- Zustand サーバー状態 → TanStack Query フックに置き換え

### 影響ファイル一覧（新規作成）

#### 基盤（Next.js 14 + TanStack Query）
- `src/app/providers.tsx` — QueryClientProvider
- `src/app/layout.tsx` — Providers 統合
- `src/app/page.tsx` — トップページ

#### 型・ロジック
- `src/types/` — 全型定義（7ファイル）
- `src/lib/utils/dateUtils.ts` — 日時計算ロジック
- `src/lib/utils/gpsUtils.ts` — GPS距離計算
- `src/lib/validations/` — Zod スキーマ（4ファイル）

#### API・データ管理
- `src/lib/api/mockData.ts` — モックデータ（段階的にAPI置換予定）
- `src/lib/api/hooks.ts` — TanStack Query フック層（15個のカスタムフック）

#### 状態管理（Zustand）
- `src/stores/authStore.ts` — 認証状態
- `src/stores/stampStore.ts` — 打刻画面UI状態
- `src/stores/attendanceStore.ts` — 勤怠画面UI状態
- `src/stores/shiftStore.ts` — シフト管理UI状態
- `src/stores/uiStore.ts` — グローバルUI状態

#### UIコンポーネント
- `src/components/stamp/` — 打刻関連（3個）
- `src/components/dashboard/` — ダッシュボード関連（2個）
- `src/components/requests/` — 申請管理（1個）
- `src/components/shifts/` — シフト管理（1個）

#### ページ
- `src/app/(public)/stamp/` — 打刻フロー（3ページ）
- `src/app/(manager)/manager/` — 店長画面（4ページ）
- `src/app/(authenticated)/` — オーナー・社労士（8ページ）

### 技術的な注意点（元に戻す際の参考）

| 項目 | v0.x | v1.0.0 | 要注意ポイント |
|---|---|---|---|
| Next.js | 16（ベータ） | 14（LTS） | params が Promise ではなくオブジェクト |
| shadcn/ui | base-ui系 | Radix UI系 | Select API が大幅に異なる |
| Select型 | @base-ui/react | @radix-ui/react-select | import 文が全て異なる |
| サーバー状態 | Zustand | TanStack Query | useQuery/useMutation の使い方を習得必須 |
| PDF出力 | @react-pdf/renderer | jsPDF+html2canvas | 出力フローが大きく異なる（未実装） |

### 動作確認
- ✅ TypeScript エラー: 0件
- ✅ ESLint エラー: 0件
- ✅ ビルド成功
- ✅ 全16ルート・23ページが実装完了

### v0.x に戻す場合
Git で v0.3.0 タグ相当のコミットに戻すか、`src_backup/` ディレクトリの内容を復元してください。
ただし、Next.js 14 で v0.x のコード（`use(params)` 等）をそのまま動かすことはできません。

---

## [v0.3.0] 2026-04-16 — フロントエンド全画面実装（base-ui系）

（詳細は git log または src_backup/CHANGELOG_v0.md を参照）

### 実装内容
- 打刻画面（/stamp）
- 店長ダッシュボード（/manager）
- シフト管理（/manager/[storeId]/shifts）
- オーナー管理画面（/owner）
- 社労士画面（/sr）
- 全型定義・Zustand Store・計算ロジック

### 技術スタック（v0系）
- Next.js 16（ベータ）
- shadcn/ui (base-ui系)
- Zustand（全状態管理）
- @react-pdf/renderer
- React Hook Form + Zod
