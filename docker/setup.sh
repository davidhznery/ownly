#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo 'Instala y abre Docker primero.'; exit 1; }
docker info >/dev/null
if [ ! -f .env ]; then
  read -r -p 'Tu correo para acceder a Ownly: ' ownly_email
  [[ "$ownly_email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo 'Correo no valido'; exit 1; }
  ownly_password=$(openssl rand -hex 32)
  ownly_token=$(openssl rand -hex 32)
  (umask 077; printf 'ADMIN_EMAIL=%s\nADMIN_PASSWORD=%s\nMARKET_COLLECTOR_TOKEN=%s\nPUBLIC_ORIGIN=http://localhost:3001\n' "$ownly_email" "$ownly_password" "$ownly_token" > .env)
  printf 'Contrasena de Ownly: %s\nGuardala. No compartas .env.\n' "$ownly_password"
fi
docker compose up --build -d
printf '\nAbre http://localhost:3001/admin/airbnb\n'
