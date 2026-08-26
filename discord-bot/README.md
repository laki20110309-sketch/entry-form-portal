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
sudo mkdir -p /opt/entry-atelier/discord-bot/data /etc/entry-atelier
sudo chown -R entryatelier:entryatelier /opt/entry-atelier
sudo chmod 700 /opt/entry-atelier/discord-bot/data
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
DATA_DIR=/opt/entry-atelier/discord-bot/data
```

起動は次の通りです。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now entry-atelier-bot
sudo systemctl status entry-atelier-bot
sudo stat -c '%A %U:%G %n' /opt/entry-atelier/discord-bot/data
curl http://127.0.0.1:8787/health
```

本番ではAPIポート`8787`を直接公開せず、同梱の`nginx/entry-atelier.conf`をNginxへ配置し、ドメインを設定してHTTPS化してください。`certbot`等で証明書を発行した後、VPS APIを直接利用する構成でのみクライアント側の接続先を更新します。本番のManus DB版ではManusサーバー側の環境変数からVPSへ接続し、公開ブラウザへURLや秘密情報を配布しません。ファイアウォールはSSH・HTTP・HTTPSだけを許可し、APIポートは閉じます。

```bash
sudo apt install -y nginx certbot python3-certbot-nginx ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
# DNSでドメインを161.34.35.218へ向けた後
sudo certbot --nginx -d entry-api.example.com
```

Bot Tokenと`FORM_API_SECRET`をGitHubへコミットしてはいけません。

## ドメインなしの大会用HTTPSトンネル

独自ドメインを用意しない大会期間中は、Cloudflare Quick Tunnelを使えます。これは一時URLなので、VPSを再起動するとURLが変わる可能性があります。起動後に表示される`https://xxxxx.trycloudflare.com`へ`/public-notify`を付けたURLを、GitHub Pagesの`config.js`へ設定してください。

```bash
sudo mkdir -p /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update
sudo apt install -y cloudflared
sudo install -o root -g root -m 0644 /opt/entry-atelier/discord-bot/systemd/entry-atelier-tunnel.service /etc/systemd/system/entry-atelier-tunnel.service
sudo systemctl daemon-reload
sudo systemctl enable --now entry-atelier-tunnel
sudo journalctl -u entry-atelier-tunnel -f
```

表示されたURLは一時的で再起動後に変わる可能性があります。Manus DB版を本番の正本として使う場合、公開フォームからの通知はManusサーバー側で行い、GitHub Pagesの`config.js`へVPS URLや秘密情報を設定しません。大会後もVPS APIを直接使う場合は、固定ドメインまたはCloudflare Tunnelの名前付きトンネルへ切り替えてください。

## 識別コードの例

通知したいチャンネルで`!set-TEAM-A`を実行し、サイト管理画面のフォーム設定に`TEAM-A`を入力します。以降、そのフォームの応募は設定されたチャンネルへ届きます。同じコードを別チャンネルで再設定すると、送信先がそのチャンネルに更新されます。
