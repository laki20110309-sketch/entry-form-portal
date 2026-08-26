# Configuration

VPS上の`discord-bot`ディレクトリに、次の環境変数を設定してください。秘密値はGitHubへコミットしないでください。

```bash
export DISCORD_BOT_TOKEN='Discord Developer Portalで発行したBot Token'
export FORM_API_SECRET='十分に長いランダム文字列'
export PORT='8787'
export DATA_DIR='./data'
export PUBLIC_FORM_ORIGIN='https://laki20110309-sketch.github.io'
```

`DISCORD_BOT_TOKEN`はDiscord Botの認証に使います。`FORM_API_SECRET`はサーバー間のBearer認証に使います。GitHub Pagesから直接送る場合は、フォームのJavaScriptに秘密値を埋め込まず、`/public-notify`を使います。この公開エンドポイントは`PUBLIC_FORM_ORIGIN`によるOrigin制限、レート制限、入力検証を行います。
