# Manual do Administrador — Fluxo de Peças GRISOMAQ

Documento pro administrador do almoxarifado. Cobre TODAS as abas do sistema, as regras de negócio críticas e os procedimentos de manutenção.

## 1. Quem é você aqui

Você é o admin do almoxarifado. Suas responsabilidades:

- Receber e providenciar pedidos dos funcionários.
- Manter o estoque atualizado (entradas, saídas, ajustes).
- Solicitar compras quando necessário e acompanhar até o recebimento.
- Gerenciar cadastro de frotas, peças e usuários.
- Vigiar o log de auditoria quando precisar investigar algo.

Você tem acesso a tudo. Cada ação sua fica registrada com data, hora, IP e navegador — inclusive as leituras de valor financeiro. Isso protege VOCÊ tanto quanto a empresa.

## 2. Aba Pedidos

O Kanban é o coração do sistema. 6 colunas na ordem do fluxo:

1. **Solicitada** — chegou agora. Sua ação: olhar e mover pra "Providenciando".
2. **Providenciando** — você está resolvendo. Se tem em estoque, arrasta direto pra "Entregue" (baixa automática do saldo). Se precisa comprar, abre uma compra vinculada (botão "Solicitar compra" no detalhe do pedido).
3. **Aguardando buscar** — compra em andamento, aguardando fornecedor entregar.
4. **Aguardando retirada** — peça chegou; funcionário deve vir retirar. O sistema notifica ele automaticamente.
5. **Entregue** — retirou. Estoque foi decrementado.
6. **Cancelado** — comentário explica o motivo.

**Como mover:** clique no card → abre detalhe → escolha o novo status. Se for pra "Entregue", o saldo da peça vinculada é decrementado na hora (se tiver `pecaId`).

**Comentar em um pedido:** abre o detalhe, campo de comentário no fim. Funcionário é notificado.

**Excluir pedido:** botão no detalhe. É soft delete — some da tela, mas o rastro fica no `audit_log`. Só apaga se for teste ou duplicidade.

**Expurgo em lote:** botão "Limpar cancelados" apaga TODOS os cancelados (também soft). Use pra tirar poluição da tela.

**Exportar CSV:** botão "⬇ Exportar" no topo. Opcional filtro de período (`de` / `até`). Abre no Excel com acento correto.

## 3. Aba Estoque

Lista das 14.146 peças cadastradas (catálogo GMAIS importado).

**Colunas visíveis:** nome, código, família, saldo, unidade, localização, min/max, status.

**Status automáticos:**
- **OK** — saldo acima do mínimo.
- **Repor** — saldo abaixo do mínimo mas > 0. Chip amarelo.
- **Crítico** — saldo = 0. Chip vermelho. **Só nesse estado o botão "Comprar" aparece habilitado** (regra da seção 9).

**Filtros:** busca livre (nome/código/código do fabricante) + dropdown por família (76 famílias, ex.: HIDRAULICA, FILTROS, MB/VW/VOLVO).

**Cadastrar peça manual:** botão "+ Cadastrar peça". Preencha nome (obrigatório), código, unidade (`un`, `pc`, `lt`…), saldo inicial, mínimo, máximo, localização, família, código fabricante, código paralelo. **O código é a chave de duplicidade** — se você tentar cadastrar dois códigos iguais, o sistema bloqueia.

**Ajustar saldo:** botão "Ajustar" em cada linha. 3 tipos:
- **Entrada** — soma ao saldo (ex.: recebeu 10, sobe 10). Use quando NÃO for pela aba Compras (achou peça esquecida, doação, transferência).
- **Saída** — desconta (ex.: emprestou, perdeu, uso interno). NÃO use pra baixar por pedido — isso é automático quando move pra "Entregue".
- **Ajuste direto** — sobrescreve pro número que você digitar. Use pra correção de inventário após contagem física.

Todo ajuste exige **motivo** (aparece no histórico da peça).

**Excluir peça:** botão 🗑 na linha. Bloqueia se houver pedido em andamento vinculado. Soft delete.

**Comprar:** botão só aparece quando `saldo = 0`. Redireciona pra tela de nova compra com a peça pré-selecionada.

## 4. Aba Compras

Fluxo completo de solicitação → aprovação → efetivação → recebimento.

**Regra CRÍTICA:** só é possível abrir compra pra uma peça se o saldo dela estiver **zerado**. O sistema bloqueia no backend e desabilita o botão no frontend. Compras "livres" (sem peça vinculada, descrição solta) continuam permitidas — é o caso de peça que ainda não está cadastrada.

**Ciclo de status:**
1. **Rascunho** — recém-criada. Você pode editar tudo e excluir se quiser.
2. **Aprovada** — antes de mover, obrigatório preencher fornecedor + valor unitário.
3. **Comprada** — fornecedor confirmou o pedido. Obrigatório: fornecedor + valor + condição de pagamento.
4. **Recebida** — a peça chegou. Nesse momento o sistema:
   - Dá entrada automática no estoque (adiciona à peça vinculada, se tiver).
   - Move o pedido vinculado (se tiver) pra "Aguardando retirada".
   - Notifica o funcionário que abriu o pedido.
   - Opcional: anexar número/URL da NF.
5. **Cancelada** — não vira estoque.

**Excluir compra:** só rascunho, sem forçar. Se for outro status, use "Cancelar" (mantém histórico) — bloqueado por padrão, tem `?force=true` na API só pra emergência.

**Valores:** você preenche à moda BR (`89,90` ou `89.90`, tudo entende). Total é calculado automaticamente. Funcionário NÃO vê esses valores em nenhuma tela.

**Filtros:** busca + status.

## 5. Aba Dashboard

Só admin acessa. 8 KPIs + gráficos:

- **Em aberto** — pedidos que não são "entregue" nem "cancelada".
- **Urgentes** — em aberto marcados urgentes.
- **Em atraso** — em aberto que não foram atualizados há mais de 2 dias.
- **Entregues 7d** — cumpridos na semana.
- **Aguardando chegar** — compras com status "comprada" (gastos que ainda não viraram estoque).
- **Gasto mês** — soma dos `valorTotal` das compras `recebidas` nos últimos 30 dias.
- **Pedidos por status** — gráfico de barras.
- **Compras por status** — idem.
- **Top peças / frotas / fornecedores** — os 8 mais frequentes.
- **Série diária** — pedidos criados nos últimos 14 dias.

Use pra sentir a "temperatura" da operação. Se "Em atraso" está alto, você tá com muito pedido esquecido.

## 6. Aba Frotas

CRUD das 266 frotas + implementos importados do XLSX GRISOMAQ.

**Filtros:** busca (nº/modelo/marca/placa), categoria (Todas / Equipamentos / Implementos), status (Em operação / Baixadas / Todos).

**Cadastrar frota:** "+ Nova frota". Campo Nº obrigatório e único.

**Editar:** clica na linha → modal com todos os campos. Nº pode mudar (checa unicidade).

**Baixar (desativar):** dentro do modal, aba "Status operacional" → "Baixada". Sai do autocomplete de novo pedido mas mantém no histórico de pedidos antigos. Faz sentido pra veículo vendido ou baixado.

**Excluir:** botão 🗑 no rodapé do modal. Bloqueia se houver pedido usando essa frota — força usar "Baixada" nesse caso.

## 7. Aba Usuários

Gestão de contas do sistema.

**Criar usuário:** "+ Novo usuário". Nome (min 2 chars, único case-insensitive), senha (min 6), role (admin ou funcionário).

**Editar:** ativar/desativar (desativado não consegue logar), promover pra admin ou rebaixar pra funcionário.

Você NÃO pode rebaixar a si mesmo (evita ficar sem admin no sistema). Se precisar sair, promova outra pessoa antes.

**Resetar senha:** botão na linha. Você digita a nova senha; entrega verbalmente pro usuário. Fica registrado no audit_log (mas nunca a senha em si).

**Desativar** é preferível a excluir — preserva histórico de pedidos abertos por essa pessoa.

## 8. Aba Auditoria

Rastro imutável de tudo que aconteceu. 33 tipos de ação categorizados.

**Filtros:** busca livre (resumo/ator/IP), ator específico, entidade (pedido/compra/peça/frota/usuário/sessão/arquivo/export), ação (dropdown com as 33), período (data de/até).

Após alterar filtros, **clique "⌕ Filtrar"** (ou Enter). A busca só dispara ao pedir — não sobrecarrega a cada tecla.

**Colunas:** id, quando, ator+role, ação, resumo, IP.

**Ver detalhes:** clica em qualquer linha → modal com todos os campos (ator uid, request-id, user-agent, hashes truncados, diff JSON formatado).

**Verificar integridade:** botão "🔒 Verificar integridade". Recalcula a hash-chain SHA-256 de todas as linhas em ordem e detecta a primeira divergência. Se retornar verde ("Cadeia íntegra"), ninguém mexeu. Se vermelho ("CADEIA CORROMPIDA — primeira divergência no id X"), alguém apagou/alterou uma linha via psql direto (é a única forma) — investigue quem tem acesso ao banco.

**Exportar CSV:** "⬇ CSV" herda os filtros atuais. Traz hash_prev, hash_curr e diff completo. Bom pra enviar pra auditoria externa.

**Não é possível apagar linhas do audit_log pelo sistema.** Bloqueio via trigger Postgres (`audit_log_readonly`). Nem o admin faz. Só o owner do banco no `psql` consegue — e isso quebra a hash-chain.

## 9. Regras de negócio críticas (checklist)

Guardar de memória:

- **Funcionário nunca cadastra peça** — só solicita via pedido. Backend e UI bloqueiam.
- **Funcionário nunca vê valores financeiros** — 3 camadas (backend filtra, eventos filtram, UI esconde).
- **Compra só é aberta se saldo = 0** (peça vinculada). Compras livres (sem `pecaId`) continuam permitidas.
- **Deletar é soft** — vira `deletado_em` + `deletado_por`. Rastro sobrevive.
- **audit_log é append-only** via trigger Postgres. Adulterar quebra a hash-chain e é detectável.
- **Sequências reiniciadas em produção** — o primeiro pedido depois do "reset de dados de teste" tem id=1.
- **Uploads em `/data/uploads`** — protegidos por sessão (rota `/api/uploads/[...file]` valida antes de servir).

## 10. Backup e manutenção

### Backups automáticos

O sistema roda um container dedicado (`backup`) que executa TODOS os dias às 03:00 (Brasília):

- pg_dump completo do banco -> `/backups/db/grisomaq-<data>.dump`
- tar.gz dos uploads (fotos, NFs) -> `/backups/uploads/uploads-<data>.tar.gz`
- Retenção: 14 dias. Backups mais antigos apagam sozinhos.
- Um snapshot é feito automaticamente quando o container sobe pela primeira vez.

**Verificar que está funcionando:**

Entre no EasyPanel -> serviço `backup` -> aba "Logs". Deve aparecer diariamente uma linha `[backup YYYY-MM-DD_HHMMSS] concluído. Estado atual: DB dumps: N, Uploads tars: N`.

Se aparecer `FALHA no pg_dump`, chame o suporte técnico imediatamente.

### Backup manual sob demanda

Antes de uma manutenção arriscada ou pra tirar cópia extra:

```
docker compose run --rm -e BACKUP_AGORA=1 backup
```

Aparece um novo arquivo em `/backups/db/` e `/backups/uploads/`.

### Restore do banco (procedimento sério)

**Só faça em janela de manutenção, com o app parado.** Isso DESTRÓI o estado atual.

```
docker compose stop app
docker cp meu-backup.dump <container-backup>:/tmp/restore.dump
docker exec <container-backup> pg_restore -h db -U grisomaq -d grisomaq --clean --if-exists /tmp/restore.dump
docker compose start app
```

Verifique contagens depois (frotas, peças, pedidos) pra confirmar que voltou como esperado.

### Cópia off-site (importante)

Os backups vivem no MESMO VPS. Se o disco físico do servidor morrer, você perde tudo — inclusive os backups. **Uma vez por semana**, baixe uma cópia externa:

```
docker cp <container-backup>:/backups ./backup-grisomaq-$(date +%F)
```

Guarde em pen drive, HD externo ou Google Drive pessoal. Isso protege contra falha catastrófica do host.

### Girar AUTH_SECRET

Se suspeita de vazamento:
1. Gera novo segredo (`openssl rand -hex 48`).
2. Atualiza no `.env` do EasyPanel.
3. Redeploy. Todos os cookies existentes viram inválidos — usuários precisam relogar.

### Verificar auditoria periodicamente

Uma vez por mês: entra em Auditoria → clica "🔒 Verificar integridade". Se retornar verde, tudo certo. Se vermelho, alguém mexeu no banco por fora.

## 11. Troubleshooting

**"Cliente diz que a alteração não aparece."**  
Cache do navegador. Peça pra ele fazer **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (Mac). Se persistir, abra em janela anônima.

**"Aba admin sumiu do meu header."**  
Você está logado como funcionário. Deslogue e entre com conta admin.

**"Não consigo excluir uma frota."**  
Tem pedido usando essa frota. Use "Baixada" no modal em vez de excluir — mantém o histórico e some do autocomplete.

**"Auditoria retornou CADEIA CORROMPIDA."**  
Alguém com acesso ao banco (owner) apagou ou alterou uma linha do `audit_log` via psql direto. O id da primeira divergência mostra onde começou. Verifique quem tem `POSTGRES_URL_ADMIN` e converse.

**"Botão Comprar está apagado numa peça sem estoque."**  
Confira se o saldo é EXATAMENTE 0. Se for `0.5` (fracionário, ex.: óleo), a peça ainda tem estoque e a regra bloqueia. Use "Ajustar saldo → Ajuste direto → 0" antes.

**"Funcionário logou mas não vê a aba Pedidos."**  
Verifica se o usuário está `ativo=1` na aba Usuários. Também verifica se ele está no `role=funcionario` e não em algum outro (não existe, mas checa).

**"Sistema fora do ar."**  
Entra no EasyPanel → veja se o container `app` está rodando. Se não, "Restart". Se seguir caído, olha os logs do container procurando erro. Se banco caiu, container `db` também precisa reiniciar.

## 12. Contato técnico

Bug persistente ou dúvida além do manual: contate o desenvolvedor responsável. Tenha em mãos:
- URL da tela onde ocorreu.
- Ação que fez.
- Mensagem de erro (se houver).
- Hora aproximada — o log de auditoria vai ajudar a rastrear.
