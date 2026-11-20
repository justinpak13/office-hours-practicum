#!/bin/sh
set -eu
cd "$(dirname "$0")"
umask 077
mkdir -p secrets

if [ ! -s secrets/cookie_secret ]; then
  head -c 32 /dev/urandom > secrets/cookie_secret
fi

if [ ! -s secrets/tls.crt ]; then
  if command -v mkcert >/dev/null 2>&1; then
    mkcert -cert-file secrets/tls.crt -key-file secrets/tls.key localhost 127.0.0.1
  else
    openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj /CN=localhost \
      -addext subjectAltName=DNS:localhost,IP:127.0.0.1 \
      -keyout secrets/tls.key -out secrets/tls.crt
  fi
fi

ls -l secrets
