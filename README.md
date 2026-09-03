# Fluxo de Peças — GRISOMAQ

Sistema web de **solicitação de peças, controle de estoque e solicitação de compras** para a GRISOMAQ. Substitui o painel atual em Claude Artifact, agora com banco de dados próprio, autenticação por papel e módulos completos:

- **Pedidos** — Kanban com 5 etapas (Solicitada → Providenciando → Aguardando buscar → Aguardando retirada → Entregue) + Cancelado. Cartão urgente com borda vermelha, selo "🔴 URGENTE" e animação de pulso quando entra um novo.
- **Estoque** — Cadastro de peças, saldos, mínimo/máximo, localização, movimentações e baixa automática quando um pedido é entregue.
- **Compras** — Solicitação de compra polida (rascunho → aprovada → comprada → recebida). Ao receber com NF, dá entrada no estoque e move o pedido vinculado para "aguardando retirada".
- **Usuários** — Login com nome + senha, dois papéis:
  - **admin**: faz tudo (Kanban, estoque, compras, cadastro de usuários)
  - **funcionário**: cria pedidos, vê tudo, comenta os próprios pedidos. Não avança status, não mexe em estoque, não cria compra.
- **Tema claro/escuro** — botão sol/lua no topo, respeita a preferência do sistema na primeira visita.

Estado sincronizado ao vivo entre navegadores via polling curto (4s).

## Tecnologia

- Next.js 14 (App Router, TypeScript) — build **standalone** para Docker
- PostgreSQL 16 (rodando no mesmo VPS)
- Drizzle ORM + drizzle-kit
- Tailwind CSS + SWR
- Auth com bcryptjs + jose (JWT em cookie httpOnly)
- Uploads em disco (`/data/uploads`) servidos por rota autenticada

## Rodar localmente (dev)

Pré-requisitos: Node 20+ e um Postgres acessível.

```bash
npm install
cp .env.example .env.local
# edite .env.local com POSTGRES_URL válido
npm run db:push        # cria as tabelas
npm run db:seed        # cria admin/grisomaq123 e matheus/matheus123 + peças exemplo
npm run dev
```

Abra http://localhost:3000, entre com `admin` / `grisomaq123`.

## Deploy em VPS Hostinger + EasyPanel (produção recomendada)

### 1. Contratar o VPS

- Hostinger → **VPS** → o menor plano (KVM 1 ou KVM 2) já roda tranquilo pra dezenas de usuários.
- No painel, escolha uma imagem **Ubuntu 22.04**.
- Anote o **IP** do servidor.

### 2. Instalar o EasyPanel

Conecte por SSH (Hostinger dá botão "Terminal do browser" também):

```bash
curl -sSL https://get.easypanel.io | sh
```

Ao terminar, abre `http://IP_DO_SERVIDOR:3000` — crie sua conta admin do EasyPanel.

### 3. Apontar o domínio (opcional mas recomendado)

- No seu DNS (Registro.br / Cloudflare / etc.) crie um registro **A**:
  `almoxarifado.suaempresa.com.br → IP_DO_SERVIDOR`
- No EasyPanel isso vai ser plugado no serviço abaixo, com SSL automático (Let's Encrypt).

### 4. Criar o app pelo EasyPanel

Duas opções — escolha uma:

#### Opção A — Repositório Git (mais fácil de atualizar)

1. Suba este código pro GitHub (repo privado tudo bem).
2. No EasyPanel: **Create Service → App → From Source → GitHub**.
3. Selecione o repositório, branch `main`.
4. **Build**: `Dockerfile` (já detecta).
5. **Port**: `3000`.
6. **Domains**: adicione `almoxarifado.suaempresa.com.br`, marque "Enable HTTPS".
7. **Volumes**: monte `/data` num volume nomeado `uploads` (persiste fotos e NF).
8. **Environment Variables** (aba Env):
   ```
   POSTGRES_URL=postgres://grisomaq:SUA_SENHA_FORTE@grisomaq_db:5432/grisomaq
   AUTH_SECRET=cole-aqui-uma-string-aleatoria-longa
   ADMIN_SENHA=troque-esta-senha-do-admin
   SEED_ADMIN=1
   UPLOAD_DIR=/data/uploads
   NEXT_PUBLIC_UPLOAD_BASE_URL=/api/uploads
   ```
   Gere `AUTH_SECRET` com: `openssl rand -base64 32`

9. Antes de deploy, adicione o Postgres:

#### Adicionar o Postgres (obrigatório antes do primeiro deploy)

1. No EasyPanel: **Create Service → Database → Postgres 16**.
2. Nome: `grisomaq_db`. Usuário: `grisomaq`. Senha: a mesma que colocou em `POSTGRES_URL`.
3. Deploy.
4. Volte no serviço do app → **Deploy**.

O `docker-entrypoint.sh` roda `drizzle-kit push` (cria tabelas) e o seed na primeira subida — no fim do log você verá:
```
→ Acesse /login com:
   admin    / grisomaq123
   matheus  / matheus123
```

**Depois do primeiro login**, troque `SEED_ADMIN=0` no env pra evitar tentar recriar o admin em cada deploy.

#### Opção B — Docker Compose direto

Se preferir tudo num compose só:

```bash
# na sua máquina
git clone <seu-repo>
cd almoxarifado-grisomaq
cp .env.example .env
# edite .env — no mínimo troque POSTGRES_PASSWORD, AUTH_SECRET, ADMIN_SENHA
docker compose up -d --build
```

O `docker-compose.yml` já sobe Postgres 16 + o app, cria volumes persistentes (`pgdata` e `uploads`) e roda o seed no primeiro start.

Depois amarre um proxy reverso (Traefik/Caddy/Nginx) apontando pro `:3000`.

### 5. Primeiro acesso

- Entre em `https://almoxarifado.suaempresa.com.br/login` com `admin` / `ADMIN_SENHA`.
- Vá em **Usuários** → **+ Novo usuário** e cadastre cada mecânico/almoxarife com senha inicial.
- Passe a senha pra pessoa. Ela troca depois pelo botão de reset (via admin).

### 6. Manutenção

- **Backup do Postgres**: EasyPanel → serviço `grisomaq_db` → **Backups** → configure diário.
- **Backup dos uploads**: EasyPanel → serviço do app → **Volumes** → clique no volume `uploads` → backup.
- **Atualizar código**: se usou Git, `git push` na branch `main` → EasyPanel rebuilda sozinho (ou aperte **Deploy** manualmente).
- **Ver logs**: EasyPanel → serviço → **Logs**.

## Estrutura

```
app/                 rotas Next
  pedidos/           Kanban
  estoque/           inventário
  compras/           solicitações de compra
  admin/usuarios/    gestão de usuários (só admin)
  login/             tela de login
  api/               handlers (JSON) — todos com auth server-side
components/          UI (dialogs, cards, tabelas)
db/                  schema + client Drizzle + seed
lib/                 utils (auth, api-auth, date, csv, user)
middleware.ts        gate de autenticação
Dockerfile           build multi-stage produção
docker-compose.yml   app + Postgres 16 + volumes
```

## Como usar

- **Funcionário**: entra, clica em `+ Novo pedido`, preenche frota + descrição da peça, marca Normal ou 🔴 Urgente e envia. Acompanha o cartão andando entre as colunas.
- **Admin**: recebe o pedido em "Solicitada", arrasta pra "Providenciando"; se a peça tem no estoque, arrasta até "Entregue" (baixa automática); se não tem, abre o pedido → "Solicitar compra →" que já pré-preenche o form.
- **Recebimento de compra**: no detalhe da compra → "📦 Marcar como recebida" → informa NF (opcional) → estoque entra automaticamente e o pedido vinculado pula pra "Aguardando retirada".
- **Exportar CSV**: botão "⬇ Exportar" no topo de Pedidos (abre no Excel com acento correto).

## Segurança

- Senhas armazenadas com bcrypt (10 rounds).
- Sessão em cookie httpOnly, `Secure` em produção, assinada com `AUTH_SECRET` (JWT HS256, 30 dias).
- Todas as mutações checam a sessão no servidor — o autor de cada evento vem da sessão, nunca do cliente.
- Ações restritas (mover Kanban, mexer em estoque, mexer em compras, cadastrar usuário) exigem `role=admin`.
- Uploads acessíveis só por usuário logado (rota `/api/uploads/...` verifica sessão).
- `AUTH_SECRET` **deve** ser trocado em produção. Se vazar, todos os cookies existentes viram inválidos ao trocar.

## Trilha de auditoria imutável

Toda ação humana no sistema vai pra tabela `audit_log` com **hash-chain SHA-256**: cada linha guarda o hash da anterior, então adulterar qualquer linha antiga quebra a cadeia daí pra frente. A tabela é protegida por trigger Postgres (`audit_log_readonly`) que bloqueia `UPDATE`, `DELETE` e `TRUNCATE` no nível do banco — mesmo o `owner` recebe erro. Deletar dados de negócio (pedidos, compras, peças, frotas, usuários) virou **soft delete** (`deletado_em, deletado_por`): a linha some da UI mas o rastro fica.

Acesso: **Admin → aba Auditoria** (`/admin/auditoria`). Filtros por ator, ação, entidade, período. Botão "🔒 Verificar integridade" percorre toda a cadeia e confirma se algum hash divergiu. Export CSV disponível.

**Segunda camada opcional — role Postgres limitada.** Se quiser proteção extra contra bugs de app, defina `APP_DB_PASSWORD` no `.env`. No próximo boot o entrypoint cria a role `grisomaq_app` sem `DELETE` em audit_log nem nas tabelas de negócio. Você então aponta `POSTGRES_URL` pra ela:

```
POSTGRES_URL_ADMIN=postgres://grisomaq:$POSTGRES_PASSWORD@db:5432/grisomaq
POSTGRES_URL=postgres://grisomaq_app:$APP_DB_PASSWORD@db:5432/grisomaq
APP_DB_PASSWORD=<pelo menos 8 chars, gire periodicamente>
```

O trigger sozinho já garante imutabilidade; a role adiciona defesa em profundidade.
