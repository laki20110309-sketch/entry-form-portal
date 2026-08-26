# Configuration

VPS上の`discord-bot`ディレクトリに、次の環境変数を設定してください。秘密値はGitHubへコミットしないでください。

```bash
export DISCORD_BOT_TOKEN='Discord Developer Portalで発行したBot Token'
export FORM_API_SECRET='十分に長いランダム文字列'
export PORT='8787'
export DATA_FILE='./data/channel-codes.json'
```

`DISCORD_BOT_TOKEN`はDiscord Botの認証に使います。`FORM_API_SECRET`はGitHub PagesのフォームからVPS APIへ送るBearer認証に使います。フォームのJavaScriptにはこの秘密値を埋め込まず、公開フォームからの直接投稿を許す場合は、レート制限・入力検証・必要に応じた追加の署名方式を中継API側で設定してください。
