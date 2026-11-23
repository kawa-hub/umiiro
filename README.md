# Umiiro（Cloudflare Pages で公開する手順）

日本の海を紹介する英語サイトです。スポット・写真・Instagram/LINEリンクは、管理画面（`/admin/`）から変更できます。

- 公開サイト: `https://（プロジェクト名）.pages.dev/`
- 管理画面: `https://（プロジェクト名）.pages.dev/admin/`

## 構成

| 場所 | 役割 |
| --- | --- |
| `public/` | サイト本体（`index.html`）と管理画面（`admin/`） |
| `functions/` | 保存・ログイン・画像アップロードのAPI（Cloudflare Pages Functions） |
| KV（`UMIIRO`） | スポット情報、リンク、写真を保存する場所 |
| `ADMIN_PASSWORD` | 管理画面のパスワード（シークレットとして保存） |

画像の保存にKVを使うので、R2の設定は不要です。無料プランで動きます。

## 公開手順（初回のみ）

あらかじめ Cloudflare のアカウントと Node.js 18 以上を用意してください。このフォルダで次を順に実行します。

1. 準備
   ```
   npm install
   npx wrangler login
   ```
2. 保存場所（KV）を作る
   ```
   npx wrangler kv namespace create UMIIRO
   ```
   表示された `id` を `wrangler.toml` の `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` と置き換えます。
3. プロジェクトを作る
   ```
   npx wrangler pages project create umiiro --production-branch main
   ```
   「umiiro」が使用済みなら別の名前にし、`wrangler.toml` の `name` と、手順4の `--project-name` も同じ名前にしてください。
4. 管理画面のパスワードを設定する
   ```
   npx wrangler pages secret put ADMIN_PASSWORD --project-name umiiro
   ```
   入力欄にパスワードを入れます。長めで推測されにくいものにしてください。
5. 公開する
   ```
   npm run deploy
   ```

表示されたURLを開き、`/admin/` でログインします。

## 管理画面でできること

- Instagram と LINE のURL（`https://` から始まる完全なアドレス）。入力すると、サイトのヘッダー・トップ・フッターにボタンが出ます。空欄のままなら表示されません。
- スポットの追加・削除・並べ替え。名前、地域、説明、見どころの時期、位置（地図をクリックして指定）。
- スポットごとの写真の追加・削除・カバー写真の変更。1枚目がカバーです。
- 「Save changes」を押すと反映されます。反映まで最大1分ほどかかることがあります。

## 写真について

- JPEG / PNG / WebP に対応しています。長辺1800pxに自動で縮小されるので、そのまま選べます。
- Insta360 の写真は、360°の元データではなく、書き出した通常の画像（JPEG/PNG）を使ってください。
- 保存せずに画面を閉じると、アップロード済みの写真が未使用のまま残ることがあります（表示には出ません）。

## 管理画面のパスワードを変える

手順4をもう一度実行し、`npm run deploy` で再公開します。

## パソコンで試す（任意）

```
cp .dev.vars.example .dev.vars
npm run dev
```
`http://localhost:8788/` を開きます。管理画面のパスワードは `.dev.vars` の値です。ローカルの保存先は本番とは別です。

## 独自ドメイン

Cloudflare ダッシュボードの「Workers & Pages」→ プロジェクト → 「Custom domains」から追加できます。
