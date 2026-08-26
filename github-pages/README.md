# Entry Atelier — GitHub Pages版

このフォルダは、GitHub Pagesで公開する**公開フォーム専用の静的配布物**です。`index.html`、`styles.css`、`config.js`、`app.js`を配置して利用します。管理画面、管理者パスワード、回答履歴、Bot Token、共有シークレット、保存先情報は公開版に含めません。

## 公開方法

GitHub Pagesの公開ブランチ直下へ4ファイルを配置し、GitHubの **Settings → Pages** で対象ブランチのルートを公開します。公開URLは大会参加者へ共有できます。

## 本番運用

本番の正本はManus DB版です。管理者はManus OAuthで保護された `/manage` からフォームを作成・編集し、発行された公開フォームURL（`/f/スラッグ`）を参加者へ共有してください。回答はManus DBへ保存され、Bot通知もサーバー側の秘密設定を使って実行されます。

GitHub Pages版は、公開配布が必要な場合の表示用静的ページです。現在の`config.js`には通知API URLを設定していないため、公開ページからVPSへ直接POSTせず、Bot Tokenや共有シークレットもブラウザへ露出しません。公開版へ秘密情報やVPSの保存先を追加しないでください。

## VPS Botとの連携

Botの運用手順はリポジトリ内の`discord-bot/README.md`を参照してください。Discordでは、通知先チャンネルで`!set-TEAM-A`のように識別コードを登録します。Manus側のBot連携設定には同じコードを保存します。Quick Tunnelは一時URLのため、URLが変わった場合はサーバー側の設定を更新し、Manus側からの通知テストを実施してください。

> GitHub Pagesは静的ホスティングです。秘密鍵、Bot Token、管理パスワード、データベース接続情報をHTML・JavaScript・設定ファイルへ記載しないでください。
