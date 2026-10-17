# Runbook de incidentes — Fluxo de Peças GRISOMAQ

Documento vivo com os passos exatos pra diagnosticar e resolver os incidentes mais comuns em produção. Testado durante incidente de 17/10/2026.

**Infra**: VPS Ubuntu 24.04 (Hostinger) + Docker Swarm + EasyPanel + Traefik.

**Nomes dos services**:
- `grisomaq_almoxarifado-grisomaq` — app Next.js 14 (porta 80 interno)
- `grisomaq_db` — Postgres 16 Alpine
- `easypanel` — painel web do EasyPanel
- `easypanel-traefik` — proxy reverso

**URL de produção**: `https://grisomaq-almoxarifado-grisomaq.2phtcd.easypanel.host/`

---

## Primeiros passos quando o sistema caiu

Antes de qualquer coisa, SSH no VPS:

```bash
ssh root@<ip-do-vps>
```

E rodar o **diagnóstico rápido** (3 comandos):

```bash
# 1. Health check direto (bypassa Traefik)
docker exec $(docker ps -q -f name=grisomaq_almoxarifado-grisomaq | head -1) \
  wget -qO- --timeout=3 http://127.0.0.1:80/api/health

# 2. Status dos services principais
docker service ls | grep -E "grisomaq|easypanel|traefik"

# 3. Portas ocupadas no host (pra ver processos fantasma)
ss -tlnp | grep -E ":(80|443|3000|5432)"
```

Esses 3 outputs identificam 90% dos problemas. Com eles, procura o cenário abaixo que bate.

---

## Cenário 1 — "Bad Gateway" no navegador

### Causa comum A: processo "fantasma" ocupando porta do host

**Sintoma**: `ss -tlnp` mostra algum processo não-Docker (ex: `next-server`, `node`) ocupando porta 3000 ou 80 no host → EasyPanel ou outro container não consegue bindar.

**Como aconteceu em 17/10/2026**: Alguém instalou `site-creator-vinext-starter` em `/opt/grisomaq` via PM2. Processo segurou porta 3000 do host → EasyPanel em crash loop constante → sistema fora do ar por 20 horas.

**Fix**:

```bash
# Ver o que está no PM2 (gerenciador de processos fora do Docker)
pm2 list

# Se tiver app indevido, parar e remover:
pm2 stop <nome>
pm2 delete <nome>
pm2 save --force   # importante: salva lista vazia pra não voltar no boot

# Se o processo não for do PM2, descobrir e matar:
ss -tlnp | grep :3000      # pega o PID
ps -p <PID> -o pid,cmd     # confirma o que é
kill <PID>                 # ou kill -9 <PID> se não morrer
```

### Causa comum B: overlay network do Swarm corrompida (pós-reboot)

**Sintoma**: DNS resolve (`docker exec <traefik> getent hosts grisomaq_almoxarifado-grisomaq` retorna IP) mas conexão dá `Host is unreachable`. Timeout ~6s nos logs do Traefik.

**Fix em ordem crescente de agressividade**:

```bash
# 1. Forçar update dos services (recria endpoints)
docker service update --force grisomaq_db
docker service update --force grisomaq_almoxarifado-grisomaq
docker service update --force easypanel-traefik

# 2. Se não resolver, matar o container (swarm recria)
docker rm -f $(docker ps -q -f name=grisomaq_almoxarifado-grisomaq | head -1)

# 3. Opção nuclear: restart do daemon Docker (derruba tudo ~30s, dados preservados)
systemctl restart docker
```

### Causa comum C: Env vars perdidas no service do EasyPanel

**Sintoma**: Logs do container mostram `EHOSTUNREACH 10.X.X.X:5432` ou código falhando por falta de secret.

**Fix**:

```bash
# Ver env vars configuradas no service
docker service inspect grisomaq_almoxarifado-grisomaq \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}'
```

Se faltar `POSTGRES_URL`, `POSTGRES_URL_ADMIN`, `AUTH_SECRET` ou `NODE_ENV`, no EasyPanel → projeto grisomaq → service almoxarifado-grisomaq → **Environment**, cola:

```
NODE_ENV=production
POSTGRES_URL=postgresql://postgres:<SENHA>@grisomaq_db:5432/grisomaq
POSTGRES_URL_ADMIN=postgresql://postgres:<SENHA>@grisomaq_db:5432/grisomaq
AUTH_SECRET=<string de 48 chars — gerar com openssl rand -base64 48>
```

Depois: Deploy.

---

## Cenário 2 — Site abre mas usuários não conseguem logar

**Diagnóstico**:

```bash
# Verifica se o banco responde
docker exec $(docker ps -q -f name=grisomaq_db | head -1) pg_isready -U postgres

# Verifica usuários cadastrados
docker exec $(docker ps -q -f name=grisomaq_db | head -1) \
  psql -U postgres -d grisomaq -c "SELECT id, nome, role, ativo FROM usuarios;"
```

**Causas prováveis**:
- `AUTH_SECRET` mudou → todos os tokens de sessão viraram inválidos (usuários precisam logar de novo — normal)
- Usuário desativado (`ativo = 0`) → reativar via `/admin/usuarios`
- Banco com dados sumidos → ver "Cenário 3"

---

## Cenário 3 — Dados sumiram do sistema

**NUNCA PÂNICO**. Soft-delete é padrão no sistema — nada é apagado fisicamente.

```bash
# Verifica se foi soft-delete
docker exec $(docker ps -q -f name=grisomaq_db | head -1) \
  psql -U postgres -d grisomaq -c "SELECT COUNT(*) FROM pedidos WHERE deletado_em IS NOT NULL;"

# Restaurar pedido específico
docker exec $(docker ps -q -f name=grisomaq_db | head -1) \
  psql -U postgres -d grisomaq -c "UPDATE pedidos SET deletado_em = NULL, deletado_por = NULL WHERE id = <ID>;"
```

**Se foi perda real** (impossível por bug nosso, só por intervenção manual destrutiva no banco), restaurar do backup:

```bash
# Backups diários ficam em /data/backups
ls -lh /data/backups/

# Restaurar (⚠ SOBRESCREVE o banco atual — faça backup antes)
docker exec -i $(docker ps -q -f name=grisomaq_db | head -1) \
  psql -U postgres -d grisomaq < /data/backups/<arquivo>.sql
```

---

## Cenário 4 — EasyPanel não abre

**Sintoma**: `http://<ip>:3000` dá timeout ou refuse.

```bash
# Status do service
docker service ps easypanel --no-trunc | head -5

# Ver erro específico
docker service ps easypanel --no-trunc | awk 'NR==3 {print}'
```

Comum: outro container ou processo fantasma segurando a porta 3000 do host — ver **Cenário 1A**.

---

## Comandos úteis de referência

```bash
# Ver todos os containers (rodando + mortos)
docker ps -a

# Logs do app (últimas 50 linhas)
docker logs $(docker ps -q -f name=grisomaq_almoxarifado-grisomaq | head -1) --tail 50

# Logs do Traefik (ver quais URLs chegam e pra onde vão)
docker logs $(docker ps -q -f name=easypanel-traefik | head -1) --tail 20

# Config do Traefik (quem roteia pra onde)
cat /etc/easypanel/traefik/config/main.yaml | less

# Testar conexão da network interna
docker exec $(docker ps -q -f name=easypanel-traefik | head -1) \
  wget -qO- --timeout=3 http://grisomaq_almoxarifado-grisomaq:80/api/health

# Força rebuild do app (via EasyPanel: botão "Implantar")
# Ou via SSH:
docker service update --force grisomaq_almoxarifado-grisomaq
```

---

## O que NUNCA fazer no VPS

- ❌ Rodar `npm start` / `node server.js` / PM2 fora de container (polui portas do host)
- ❌ Instalar nada em `/opt/` sem container
- ❌ `docker service rm <qualquer-coisa-grisomaq>` sem backup
- ❌ `rm -rf /var/lib/docker` (apaga tudo)
- ❌ Mexer em `/etc/easypanel/traefik/config/main.yaml` manualmente (EasyPanel sobrescreve)

## O que SEMPRE fazer antes de qualquer intervenção

1. Backup do postgres:
   ```bash
   docker exec $(docker ps -q -f name=grisomaq_db | head -1) \
     pg_dump -U postgres grisomaq > /data/backups/manual-$(date +%F-%H%M).sql
   ```
2. `docker ps` antes e depois — confirmar que os services não morreram
3. Testar `/api/health` depois de qualquer deploy
