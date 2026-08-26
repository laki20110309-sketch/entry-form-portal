#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/entry-atelier/discord-bot
ENV_DIR=/etc/entry-atelier
sudo apt-get update
sudo apt-get install -y nodejs npm
sudo useradd --system --home /opt/entry-atelier --shell /usr/sbin/nologin entryatelier 2>/dev/null || true
sudo mkdir -p "$APP_DIR" "$ENV_DIR"
sudo cp -R ./* "$APP_DIR/"
sudo chown -R entryatelier:entryatelier /opt/entry-atelier
sudo -u entryatelier npm --prefix "$APP_DIR" install --omit=dev
sudo install -o root -g root -m 0644 "$APP_DIR/systemd/entry-atelier-bot.service" /etc/systemd/system/entry-atelier-bot.service
if [ ! -f "$ENV_DIR/bot.env" ]; then
  sudo tee "$ENV_DIR/bot.env" >/dev/null <<'EOF'
DISCORD_BOT_TOKEN=
FORM_API_SECRET=
PORT=8787
DATA_FILE=/opt/entry-atelier/discord-bot/data/channel-codes.json
EOF
  sudo chmod 600 "$ENV_DIR/bot.env"
  echo "Edit $ENV_DIR/bot.env, then run: sudo systemctl enable --now entry-atelier-bot"
else
  echo "$ENV_DIR/bot.env already exists; leaving it unchanged"
fi
sudo systemctl daemon-reload
