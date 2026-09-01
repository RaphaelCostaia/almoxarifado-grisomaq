#!/bin/sh
set -e

# 1. Limpa duplicatas antes de aplicar as novas constraints (senão push falha)
echo "[grisomaq] Limpando duplicatas legadas (se houver)…"
if ! npx --no-install tsx db/cleanup-duplicates.ts; then
  echo "[grisomaq] cleanup falhou (talvez tabelas ainda não existam), continuando."
fi

# 2. Aplica schema atual (unique constraints, novas colunas)
echo "[grisomaq] Aplicando schema (drizzle push)…"
if ! npx --no-install drizzle-kit push --force; then
  echo "[grisomaq] drizzle-kit push falhou. Continuando mesmo assim."
fi

# 3. Seed idempotente. Roda sempre — não duplica nada.
echo "[grisomaq] Rodando seed idempotente…"
if ! npx --no-install tsx db/seed.ts; then
  echo "[grisomaq] seed falhou."
fi

echo "[grisomaq] Subindo Next.js…"
exec "$@"
