# Atualização de frotas, agregados e códigos a partir das planilhas do GMAIS

Fluxo para receber planilhas atualizadas do cliente e aplicar no banco de produção **sem perder dados**.

## Regras de segurança (implementadas em `db/atualizar-cadastros-lib.ts`)

- Nada é apagado: o que está no sistema e não veio na planilha fica intacto.
- Campo em branco na planilha nunca apaga valor já preenchido no sistema.
- Saldo, mínimo, máximo e localização de peças existentes nunca são alterados. Peça nova entra com o saldo do GMAIS.
- Unidade de peça só muda se o saldo for zero (senão o saldo mudaria de sentido); caso contrário aparece em "ignorados".
- Registro excluído no sistema não é reativado nem alterado.
- Frota cujo número já existe com outra categoria é ignorada.
- Tudo numa única transação: qualquer erro desfaz tudo. Backup (`pg_dump`) antes de gravar. Registro na Auditoria.

## Planilhas aceitas (exportadas do GMAIS, aba `Plan1`, cabeçalho na linha 4)

| Planilha | Vira |
|---|---|
| Listagem Cadastro de Frotas | frotas (equipamentos) |
| Listagem Cadastro de Materiais | peças (catálogo) |
| Listagem de Agregados | frotas com categoria `agregado`, número `AG<código>` (ex.: `AG12`) |

## Passo a passo

### 1. Gerar o pacote (no computador de desenvolvimento)

```bash
python scripts/gerar-atualizacao-cadastros.py db/atualizacoes/AAAA-MM-DD \
  --frotas "frotas.xlsx" --pecas "codigos.xlsx" --agregados "agregados.xlsx"
```

Cada planilha é opcional. Commitar a pasta `db/atualizacoes/AAAA-MM-DD/` e fazer o deploy (a pasta `db/` vai para a imagem).

### 2. Prévia em produção (não grava nada)

EasyPanel → projeto grisomaq → serviço **almoxarifado-grisomaq** → Console → Sh:

```bash
npx --no-install tsx db/atualizar-cadastros.ts db/atualizacoes/AAAA-MM-DD
```

Mostra, por cadastro: novos, atualizados (com exemplos do que muda), iguais, ignorados (com o motivo) e frotas que ficariam inativas.

### 3. Aplicar

Se a prévia estiver correta, no mesmo console:

```bash
npx --no-install tsx db/atualizar-cadastros.ts db/atualizacoes/AAAA-MM-DD --aplicar
```

Faz o backup em `/data/backups/db/pre-atualizacao-<data>.dump`, grava tudo e registra na Auditoria. Rodar de novo não muda nada (idempotente).

### 4. Se precisar desfazer

No mesmo console, com o arquivo do backup do passo 3:

```bash
pg_restore --clean --if-exists -d "$POSTGRES_URL_ADMIN" /data/backups/db/pre-atualizacao-<data>.dump
```

Atenção: desfaz também qualquer pedido registrado depois do backup. A pasta `/data` do app pode ser recriada num novo deploy; o backup diário do banco continua valendo.
