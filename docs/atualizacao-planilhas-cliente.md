# Atualização de Frotas e Códigos a partir de planilhas do cliente

Fluxo seguro pra receber planilhas atualizadas (XLSX) do cliente e aplicar as mudanças no banco em produção **sem perder dados**.

## Garantias desta operação

- Nunca deleta registros. Tudo que já existe fica.
- Nunca sobrescreve saldo de peças existentes. Saldo da planilha só vira saldo inicial em peças novas.
- Nunca toca em campos operacionais (saldo, mínimo, máximo, localização de peças).
- Nunca mexe em pedidos, compras, movimentações, OS de manutenção.
- Tudo em transação única — se der erro no meio, rollback total.
- Pós-checks dentro da mesma transação: integridade referencial, soma de saldos preservada, contagem total não cai.
- Audit log registra a operação com amostra de 20 diffs.

## Fluxo passo a passo

### 1. Receber os XLSX e colocar no servidor

Dois arquivos esperados do cliente:
- `frotas atualizadas.xlsx` — listagem de frotas (equipamentos). Pode trazer só uma parte do catálogo.
- `codigos atualizados.xlsx` — listagem de materiais (peças).

Copie-os pra uma pasta acessível no servidor (ex.: `/tmp/`).

### 2. Backup manual antes de qualquer coisa

Mesmo que o backup diário esteja ativo, dispare um backup imediato antes:

```bash
docker exec grisomaq_db pg_dump -U postgres grisomaq > /data/backups/pre-atualizacao-$(date +%F-%H%M).sql
```

### 3. Gerar o JSON novo a partir do XLSX

```bash
python scripts/gerar-seed-frotas.py /tmp/frotas-atualizadas.xlsx
python scripts/gerar-seed-pecas.py /tmp/codigos-atualizados.xlsx
```

Isso cria/atualiza `db/seed-frotas.json` e `db/seed-pecas.json` com os dados normalizados.

### 4. Rodar o DRY-RUN (não escreve nada)

```bash
npm run diff:frotas
npm run diff:pecas
```

Saída de exemplo (frotas):

```
 RELATÓRIO DE DIFERENÇAS — FROTAS
  Inserir (novas no JSON):           12
  Atualizar (campos mudaram):        48
  Inalteradas:                       81
  Apenas no banco (serão mantidas):  125    ← implementos e cadastros manuais
```

Revise os relatórios completos (`relatorio-diff-frotas.json`, `relatorio-diff-pecas.json`). Se algo parecer estranho, pare aqui — nenhum dado foi tocado.

### 5. Aplicar (transação atômica)

```bash
npm run atualizar:frotas -- --apply
npm run atualizar:pecas -- --apply
```

Sem `--apply` o script é no-op (mostra o que faria). Com `--apply`:
- Verifica backup recente (se `BACKUP_DIR` existe, exige mtime ≤ 24h — pode ser pulado em dev).
- Abre transação única.
- Insere novos (lote de 50 pra frotas, 200 pra peças).
- Atualiza existentes com whitelist estrita de campos.
- Roda pós-checks:
  - Contagem total não pode cair.
  - Soma de saldos das peças pré-existentes continua idêntica (para peças).
  - Zero referências órfãs em `pedidos.peca_id`, `compras.peca_id`, `manutencao_ordens.peca_id`.
- Grava audit_log na mesma transação.
- Qualquer falha → ROLLBACK.

### 6. Verificação pós-import

```bash
npm run verificar:atualizacao
```

Imprime:
- Contagens atuais (peças, frotas, soma de saldos).
- Últimas entradas do audit_log para `frotas_atualizar_lote` / `pecas_atualizar_lote`.
- Integridade referencial.
- Integridade da cadeia hash do audit_log.

Deve dizer `✓ TUDO OK` no fim. Se não, revisar imediatamente.

### 7. Spot check na UI

- `/admin/frotas` — frotas novas aparecem? Modelo/marca atualizados? Testar busca por 2-3 frotas específicas.
- `/admin/estoque` — peças novas aparecem? Saldos conhecidos continuam iguais? Família/descrição refletem a planilha?

### 8. Em caso de problema

Restaurar do backup:

```bash
docker exec -i grisomaq_db psql -U postgres grisomaq < /data/backups/pre-atualizacao-YYYY-MM-DD-HHMM.sql
```

## O que o fluxo NÃO faz (deliberadamente)

- **Não sincroniza saldos.** Se o cliente quiser conciliar saldos entre GMAIS e o sistema, isso é outra operação (dupla checagem com admin, movimentação registrada caso a caso).
- **Não arquiva peças/frotas que sumiram da planilha.** Elas ficam intactas. Se precisar inativar algo, admin faz manualmente pela UI.
- **Não cria ou altera schema.** Zero migração, zero mudança em tabelas.
- **Não roda no boot do container.** O entrypoint continua usando `seed-*.ts` (que só INSERE novos). Esta atualização é operação manual com admin acompanhando.
