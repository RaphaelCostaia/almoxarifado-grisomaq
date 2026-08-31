#!/bin/sh
set -e

echo "[grisomaq] Aplicando schema (drizzle push)…"
if ! npx --no-install drizzle-kit push --force; then
  echo "[grisomaq] drizzle-kit push falhou. Continuando mesmo assim."
fi

if [ -n "$SEED_ADMIN" ] && [ "$SEED_ADMIN" = "1" ]; then
  echo "[grisomaq] Rodando seed inicial…"
  if ! npx --no-install tsx db/seed.ts; then
    echo "[grisomaq] seed falhou (talvez já rodou)."
  fi
fi

echo "[grisomaq] Subindo Next.js…"
exec "$@"
