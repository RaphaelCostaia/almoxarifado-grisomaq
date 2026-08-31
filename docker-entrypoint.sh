#!/bin/sh
set -e

echo "[grisomaq] Aplicando schema (drizzle push)…"
./node_modules/.bin/drizzle-kit push || {
  echo "[grisomaq] drizzle-kit push falhou. Continuando mesmo assim."
}

# Cria admin inicial se ainda não existir
if [ -n "$SEED_ADMIN" ] && [ "$SEED_ADMIN" = "1" ]; then
  echo "[grisomaq] Rodando seed inicial…"
  ./node_modules/.bin/tsx db/seed.ts || echo "[grisomaq] seed falhou (talvez já rodou)."
fi

echo "[grisomaq] Subindo Next.js…"
exec "$@"
