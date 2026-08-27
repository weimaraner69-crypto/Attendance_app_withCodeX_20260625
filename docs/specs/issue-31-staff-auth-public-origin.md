# Issue #31: Staff Auth の公開Origin検証

## 目的

Vercel の Route Handler が受け取る `request.url` は内部デプロイOriginになり得る。
スタッフ招待・再設定の本人確認とパスワード更新では、公開ブラウザOriginを
`NEXT_PUBLIC_APP_URL` から決定し、内部Originを認可根拠にしない。

## 対象と非対象

- 対象: `/auth/confirm/complete` の `POST`、`/api/auth/staff-password` の `POST`
- 対象: スタッフ招待・再設定の既存OTP、本人照合、DB-backed Intentの導線
- 非対象: owner再設定フローの変更、Vercel環境変数の登録・変更、Supabase設定の変更

## セキュリティ設計

- `buildStaffPasswordUrl(NEXT_PUBLIC_APP_URL)` の検証済みURLから公開Originを導出する。
  HTTPS（localhost/127.0.0.1だけHTTP可）、Origin以外のpath/query/hash、資格情報を含む値は無効とする。
- 本人確認POSTは、設定欠落時に副作用を起こさず失敗画面へredirectする。
  `Origin` が存在する場合は公開Originとの一致を必須とし、
  `Sec-Fetch-Site: cross-site` は拒否する。メールリンクのフォームPOSTで欠落し得る
  `Origin` は、OTP・有効スタッフ本人照合・短命単回Intentでfail-closeに検証する。
- パスワード更新POSTは、`Origin` の公開Origin完全一致を必須とする。欠落・外部Origin・設定欠落では、
  body、cookie、DB、Admin APIへ到達する前に403を返す。
- 既存のパスワード設定Intentは、OTPとstaff本人照合が成功し、新Intentを発行する直前だけ破棄する。
  外部POST、不正トークン、無効な本人照合では既存Intentを破棄しない。

## 受入条件

- [x] 本人確認POSTとパスワード更新APIが `NEXT_PUBLIC_APP_URL` の公開Originを基準に検証する。
- [x] Vercel内部デプロイOriginを直接信頼しない。
- [x] ブラウザOriginが公開ドメイン、`request.url` が内部デプロイOriginの回帰テストを両経路へ追加する。
- [x] 設定欠落、外部Origin、不正トークンは副作用を起こさずfail-closeする。
- [x] スタッフ招待・再設定のOTP確認からパスワード設定までの正常系を維持する。
- [x] policy、全テスト、lint、build、独立repo-aware review、PR上のreview-evidence-gateが成功する。

## 検証計画

1. 対象Routeと `buildStaffPasswordUrl` の単体テストを実行する。
2. `python3 ci/policy_check.py`、全Vitest、lint、buildを実行する。
3. red riskの認証変更として、別コンテキストの独立AIレビューをRound 1〜3で実施し、
   `docs/ai/reviews/` にexact-head証跡を残す。
4. PR作成後、`review-evidence-gate` を含む必須CIを確認する。Vercel本番設定の変更は行わない。

## ロールバック

問題時はこのIssueの実装コミットをrevertする。`NEXT_PUBLIC_APP_URL` とSupabase/Vercelの設定は変更しないため、
ロールバック対象はアプリコード、回帰テスト、文書だけである。
