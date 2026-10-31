#!/usr/bin/env bash
# Publishes the laylatul-code website to the Matrix Streamline server.
#
#   ./deploy/deploy.sh                 # to root@103.205.144.18 with ~/.ssh/matrix_server_ed25519
#   ./deploy/deploy.sh user@host       # somewhere else
#   SSH_KEY=~/.ssh/other_key ./deploy/deploy.sh
#
# It stamps the CSS/JS links with the current commit (so browsers fetch fresh files),
# uploads the site, swaps it in place in one step (the previous copy is kept as
# /var/www/laylatul-code.old), and installs/reloads the nginx settings in this folder.
set -euo pipefail

HOST="${1:-root@103.205.144.18}"
KEY="${SSH_KEY:-$HOME/.ssh/matrix_server_ed25519}"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes)
SCP=(scp -q -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes)

cd "$(dirname "$0")/.."
VER="$(git rev-parse --short=7 HEAD)"
[ -n "$(git status --porcelain laylatul-code)" ] && echo "note: laylatul-code has uncommitted changes; they are included"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -r laylatul-code "$TMP/site"
sed -i "s/?v=dev/?v=$VER/g" "$TMP"/site/*.html
tar -C "$TMP/site" -czf "$TMP/site.tgz" .

"${SCP[@]}" "$TMP/site.tgz" "$HOST:/tmp/laylatul-code.tgz"
"${SCP[@]}" deploy/nginx-laylatul-code.conf "$HOST:/tmp/laylatul-code.conf"
"${SSH[@]}" "$HOST" 'set -e
  rm -rf /var/www/laylatul-code.new && mkdir -p /var/www/laylatul-code.new
  tar -xzf /tmp/laylatul-code.tgz -C /var/www/laylatul-code.new
  chown -R www-data:www-data /var/www/laylatul-code.new
  rm -rf /var/www/laylatul-code.old
  if [ -d /var/www/laylatul-code ]; then mv /var/www/laylatul-code /var/www/laylatul-code.old; fi
  mv /var/www/laylatul-code.new /var/www/laylatul-code
  install -m 644 /tmp/laylatul-code.conf /etc/nginx/sites-available/laylatul-code
  ln -sf /etc/nginx/sites-available/laylatul-code /etc/nginx/sites-enabled/laylatul-code
  rm -f /etc/nginx/sites-enabled/default
  nginx -t -q && systemctl reload nginx
  rm -f /tmp/laylatul-code.tgz /tmp/laylatul-code.conf'

echo "Published $VER to $HOST"
