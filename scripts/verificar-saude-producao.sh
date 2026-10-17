#!/bin/bash
# Verificação rápida de saúde do sistema em produção.
# Útil pra rodar APÓS um deploy ou quando desconfia que algo caiu.
#
# USO (no SSH do VPS):
#   bash scripts/verificar-saude-producao.sh
#
# Sai com código 0 se tudo OK, 1 se algo falhou (útil pra cron/alerta).

set +e  # continua mesmo se um check falhar
status=0
ok() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; status=1; }
warn() { echo "  ⚠ $1"; }

echo "============================================================"
echo " Verificação de saúde — GRISOMAQ ($(date -u +"%Y-%m-%d %H:%M UTC"))"
echo "============================================================"

echo ""
echo "[1/6] Containers rodando"
for svc in grisomaq_almoxarifado-grisomaq grisomaq_db easypanel-traefik easypanel; do
  if docker ps --format '{{.Names}}' | grep -q "^$svc"; then
    ok "$svc"
  else
    fail "$svc NÃO está rodando"
  fi
done

echo ""
echo "[2/6] App responde health check interno"
if docker exec $(docker ps -q -f name=grisomaq_almoxarifado-grisomaq | head -1) \
     wget -qO- --timeout=5 http://127.0.0.1:80/api/health 2>/dev/null | grep -q '"ok":true'; then
  ok "health check: OK + banco conectado"
elif docker exec $(docker ps -q -f name=grisomaq_almoxarifado-grisomaq | head -1) \
       wget -qO- --timeout=5 http://127.0.0.1:80/api/health 2>/dev/null | grep -q '"ok":false'; then
  fail "app respondendo mas BANCO INDISPONÍVEL"
else
  fail "app não responde na porta 80"
fi

echo ""
echo "[3/6] Traefik alcança o app"
if docker exec $(docker ps -q -f name=easypanel-traefik | head -1) \
     wget -qO- --timeout=5 http://grisomaq_almoxarifado-grisomaq:80/api/health 2>/dev/null | grep -q '"ok"'; then
  ok "Traefik → app: rota funcionando"
else
  fail "Traefik NÃO alcança o app (overlay network pode estar corrompida)"
  warn "Fix: docker service update --force grisomaq_almoxarifado-grisomaq"
fi

echo ""
echo "[4/6] Postgres aceita conexão"
if docker exec $(docker ps -q -f name=grisomaq_db | head -1) \
     pg_isready -U postgres 2>/dev/null | grep -q "accepting connections"; then
  ok "postgres: aceitando conexões"
else
  fail "postgres não responde"
fi

echo ""
echo "[5/6] Portas do host sem processos fantasma"
for porta in 3000 5432; do
  usuarios=$(ss -tlnp "sport = :$porta" 2>/dev/null | tail -n +2)
  if [ -z "$usuarios" ]; then
    warn "porta $porta sem listener (pode ser normal se o service não existe)"
  elif echo "$usuarios" | grep -qiE "docker|containerd"; then
    ok "porta $porta: Docker (OK)"
  else
    fail "porta $porta ocupada por processo NÃO-Docker:"
    echo "$usuarios" | sed 's/^/      /'
    warn "Fix: ver runbook-incidentes.md § Cenário 1A"
  fi
done

echo ""
echo "[6/6] Backup diário recente"
# O volume do app monta /data dentro do container — backups ficam em
# /data/backups/db (dumps do postgres) e /data/backups/uploads (tar dos
# arquivos enviados). Verifica DENTRO do container, não no host.
cid=$(docker ps -q -f name=grisomaq_almoxarifado-grisomaq | head -1)
if [ -n "$cid" ]; then
  recentes=$(docker exec "$cid" sh -c "find /data/backups/db -name '*.dump' -o -name '*.sql*' 2>/dev/null | wc -l")
  if [ "$recentes" -gt 0 ]; then
    ultimo=$(docker exec "$cid" sh -c "ls -t /data/backups/db/ 2>/dev/null | head -1")
    ok "$recentes backup(s) em /data/backups/db (último: $ultimo)"
  else
    warn "nenhum backup em /data/backups/db ainda (daemon pode não ter rodado — disparo é às 03:00)"
  fi
else
  warn "container do app não encontrado — não dá pra verificar backups"
fi

echo ""
echo "============================================================"
if [ "$status" -eq 0 ]; then
  echo " ✓ TUDO OK"
else
  echo " ✗ ATENÇÃO: problemas encontrados — ver runbook-incidentes.md"
fi
echo "============================================================"

exit $status
