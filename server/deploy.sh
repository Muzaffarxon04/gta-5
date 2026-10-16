#!/usr/bin/env bash
# Ko'cha Qiroli serverini Oracle serveriga o'rnatish yoki yangilash. Mac'dan ishga tushiriladi:
#   bash server/deploy.sh
# Server alohida xizmat (kocha-qiroli) bo'lib ishlaydi, faqat 127.0.0.1:3100 da. Tashqaridan — Caddy orqali:
#   wss://151-145-55-234.sslip.io/game
# Caddyfile'ga faqat /game yo'li qo'shiladi (bir marta), boshqa saytlar va botga tegilmaydi.
set -euo pipefail
KEY=${KEY:-$HOME/Downloads/ssh-key-2026-10-14.key}
HOST=${HOST:-ubuntu@151.145.55.234}
cd "$(dirname "$0")"

ssh -i "$KEY" "$HOST" 'mkdir -p ~/kocha-qiroli-server'
scp -i "$KEY" server.js package.json package-lock.json kocha-qiroli.service "$HOST:kocha-qiroli-server/"
ssh -i "$KEY" "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
cd ~/kocha-qiroli-server
echo "node $(node -v)"
npm ci --omit=dev --no-audit --no-fund
sudo cp kocha-qiroli.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kocha-qiroli
sudo systemctl restart kocha-qiroli
sleep 1
curl -fsS 127.0.0.1:3100 && echo

CF=/etc/caddy/Caddyfile
if sudo grep -q '127.0.0.1:3100' "$CF"; then
  echo "Caddy: /game yo'li allaqachon bor"
else
  sudo cp "$CF" "$CF.bak-kq"
  # sslip.io sayti blokining boshiga /game yo'lini qo'shamiz
  sudo awk '{ print } !done && /sslip\.io[^{]*\{[[:space:]]*$/ { print "\thandle /game {\n\t\treverse_proxy 127.0.0.1:3100\n\t}"; done = 1 }' "$CF.bak-kq" | sudo tee "$CF" > /dev/null
  if ! sudo grep -q '127.0.0.1:3100' "$CF"; then
    sudo cp "$CF.bak-kq" "$CF"; echo "Caddyfile'da sslip.io bloki topilmadi — o'zgartirilmadi"; exit 1
  fi
  if sudo caddy validate --config "$CF" --adapter caddyfile > /dev/null 2>&1; then
    sudo systemctl reload caddy; echo "Caddy: /game yo'li qo'shildi"
  else
    sudo cp "$CF.bak-kq" "$CF"; echo "Caddyfile tekshiruvdan o'tmadi — eski holatiga qaytarildi"; exit 1
  fi
fi
sleep 1
curl -fsS https://151-145-55-234.sslip.io/game && echo
systemctl is-active call-ai kocha-qiroli caddy
REMOTE
