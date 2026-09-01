#!/bin/sh
set -e

# 1. Limpa duplicatas antes de aplicar novas constraints
echo "[grisomaq] Limpando duplicatas legadas (se houver)…"
if ! npx --no-install tsx db/cleanup-duplicates.ts; then
  echo "[grisomaq] cleanup falhou (talvez tabelas não existam ainda), continuando."
fi

# 2. Aplica schema. Pipe 'yes ""' pra responder Enter automático nos prompts
#    do drizzle-kit push (a opção default é "adicionar sem truncar", que é a correta).
echo "[grisomaq] Aplicando schema (drizzle push)…"
if ! yes "" 2>/dev/null | npx --no-install drizzle-kit push --force; then
  echo "[grisomaq] drizzle-kit push falhou. Continuando mesmo assim."
fi

# 3. Seed idempotente
echo "[grisomaq] Rodando seed idempotente…"
if ! npx --no-install tsx db/seed.ts; then
  echo "[grisomaq] seed falhou."
fi

echo "[grisomaq] Subindo Next.js…"
exec "$@"
