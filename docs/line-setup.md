# LINE Messaging API 設定手順

## 実装範囲

- Webhook: `POST /api/line/webhook`
- 署名検証: raw request body と `X-Line-Signature` を HMAC-SHA256 で照合
- 本人連携: LINEで「連携」と送信し、15分間有効なURLからスタッフログインして紐づけ
- LINEコマンド:
  - `シフト確認`: 今後14日分の公開シフトを返信
  - `シフト提出`: 既存の希望提出画面へ誘導
  - `打刻`: GPS必須の個人スマホ打刻画面へ誘導
  - `連携解除`: スタッフとの紐づけを解除
- LINE通知: 申請結果、シフト公開、打刻漏れのアプリ内通知作成時にPush送信

LINE内では直接打刻しません。既存の個人スマホ打刻画面でログインとGPS検証を行い、`mobile_web` の打刻として記録します。LINE経由で開いたシフト希望提出は、連携済みアカウントを確認したうえで `source = line` と `line_account_id` を保存します。

## 1. Supabaseマイグレーション

Supabase SQL Editorで次を適用します。

- `supabase/migrations/202606290004_line_integration.sql`

追加内容:

- 平文トークンを保存しない `line_link_tokens`
- `notifications` のLINE配信状態、配信日時、エラー概要

`line_link_tokens` はRLSを有効化し、ブラウザから直接読み書きできるポリシーを作りません。作成・消費はサーバー側のservice roleだけで行います。

## 2. LINE Developers設定

1. LINE DevelopersコンソールでProviderとMessaging APIチャネルを作成する。
2. Channel secretとChannel access tokenを発行する。
3. Messaging API設定のWebhook URLへ次を設定する。

```text
https://<公開ドメイン>/api/line/webhook
```

4. Webhookの利用を有効にする。
5. コンソールの「検証」を実行し、HTTP 200になることを確認する。

署名検証は、JSONを解析する前のraw bodyに対して行います。LINE公式仕様:

- [Webhook署名を検証する](https://developers.line.biz/ja/docs/messaging-api/verify-webhook-signature/)
- [Webhook URLを検証する](https://developers.line.biz/ja/docs/messaging-api/verify-webhook-url/)
- [メッセージを送信する](https://developers.line.biz/ja/docs/messaging-api/sending-messages/)

## 3. サーバー環境変数

`.env.example` を参考に、ローカルまたはホスティング環境へ次を設定します。値はログ、画面、Git管理ファイルへ出力しません。

```text
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
LINE_ORGANIZATION_ID
NEXT_PUBLIC_APP_URL
```

- `LINE_ORGANIZATION_ID`: このLINE公式アカウントを利用する組織のUUID
- `NEXT_PUBLIC_APP_URL`: LINEから開けるHTTPSの公開Origin。末尾スラッシュなし
- Channel secretとChannel access tokenはサーバー専用

## 4. 実機確認

1. スタッフ用Supabase Authアカウントと `staff.auth_user_id` の紐づけを用意する。
2. LINE公式アカウントを友だち追加する。
3. LINEで `連携` と送信する。
4. 返信URLを開き、スタッフとしてログインして連携を完了する。
5. 次を順番に確認する。
   - `シフト確認`
   - `シフト提出`
   - `打刻`
   - 打刻修正申請の承認/却下通知
   - シフト公開通知
   - 打刻漏れ通知
6. `notifications.line_delivery_status` が `delivered` または `failed` になることを確認する。
7. `連携解除` 後に、再度 `連携` できることを確認する。

## セキュリティ上の注意

- WebhookはIP制限ではなく、必ず `X-Line-Signature` を検証する。
- 署名検証前にrequest bodyをJSON解析・整形しない。
- 連携トークンは15分で失効し、再発行時は以前の未使用トークンを無効化する。
- DBには連携トークンのSHA-256ハッシュだけを保存する。
- LINEの `userId`、表示名、画像URLは個人情報として扱う。
- Messaging APIエラーへChannel access tokenやLINE user IDを含めない。
- 共通の機密情報ルールは [SECURITY.md](../SECURITY.md) に従う。
