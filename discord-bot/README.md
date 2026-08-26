# Entry Atelier Discord応募通知Bot

応募フォーム送信を、識別コードに紐づいたDiscordチャンネルへ通知する最小構成です。Botは`!set-識別コード`を実行したチャンネルを保存し、VPS APIの`POST /notify`が同じ識別コードを受け取ると、そのチャンネルへ応募内容を送信します。解除は`!unset-識別コード`です。

## Discord Developer Portal

新しいApplicationを作成し、Botを追加してください。Botには、対象サーバーで「チャンネルを見る」「メッセージを送信」「メッセージ履歴を読む」を付与します。`!set-XXXX`を使う管理者には「チャンネルの管理」権限が必要です。Message Content Intentを有効化し、Bot TokenはVPSの環境変数だけに保存してください。

Bot招待URLは、OAuth2 URL GeneratorでScopesに`bot`を選択し、上記の最小権限だけを選びます。管理権限（Administrator）は付与しないでください。

## Ubuntu 24.04への配置

```bash
sudo apt update
sudo apt install -y nodejs npm
sudo useradd --system --home /opt/entry-atelier --shell /usr/sbin/nologin entryatelier || true
sudo mkdir -p /opt/entry-atelier /etc/entry-atelier
sudo chown -R entryatelier:entryatelier /opt/entry-atelier
# このdiscord-botフォルダを /opt/entry-atelier/discord-bot に配置
cd /opt/entry-atelier/discord-bot
sudo -u entryatelier npm install --omit=dev
sudo install -o root -g root -m 0644 systemd/entry-atelier-bot.service /etc/systemd/system/entry-atelier-bot.service
sudo nano /etc/entry-atelier/bot.env
```

`/etc/entry-atelier/bot.env`には次を設定します。ファイル権限は`sudo chmod 600 /etc/entry-atelier/bot.env`にしてください。

```text
DISCORD_BOT_TOKEN=ここにBot Token
FORM_API_SECRET=十分に長いランダム文字列
PORT=8787
DATA_FILE=/opt/entry-atelier/discord-bot/data/channel-codes.json
```

起動は次の通りです。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now entry-atelier-bot
sudo systemctl status entry-atelier-bot
curl http://127.0.0.1:8787/health
```

本番ではAPIポートを直接公開せず、NginxまたはCaddyでHTTPSのドメインを割り当て、`/notify`だけを外部公開してください。フォーム側からは`https://あなたのドメイン/notify`へPOSTします。Bot Tokenと`FORM_API_SECRET`をGitHubへコミットしてはいけません。

## 識別コードの例

通知したいチャンネルで`!set-TEAM-A`を実行し、サイト管理画面のフォーム設定に`TEAM-A`を入力します。以降、そのフォームの応募は設定されたチャンネルへ届きます。同じコードを別チャンネルで再設定すると、送信先がそのチャンネルに更新されます。
