# Manual — Módulo de Troca de Óleo & Manutenção

Guia prático pra usar o módulo **Manutenção** do sistema Fluxo de Peças. Este documento cobre exclusivamente o fluxo de trocas de óleo, filtros e manutenções preventivas por frota.

## 1. Para que serve

Este módulo tira a informação do PDF do GMAIS e a coloca dentro do sistema, transformando dado em ação. Em vez de imprimir o relatório e passar de mão em mão, você:

- Sobe o PDF do GMAIS no sistema (uma vez por semana, ou quando quiser).
- Visualiza o relatório na tela com filtros por frota, tipo de compartimento e vencidas.
- Escolhe quais compartimentos viram **Ordens de Serviço (OS)** pra oficina executar.
- Acompanha o andamento das trocas no Kanban da oficina.
- Ao concluir, o sistema **baixa a peça/óleo do estoque automaticamente**.

O sistema não substitui o GMAIS. Ele complementa: o GMAIS continua sendo a fonte da verdade do controle das frotas. O sistema é a ferramenta operacional pra passar a bola pra oficina.

## 2. Quem usa

- **Administrador do almoxarifado** — quem tem acesso ao módulo. Ele importa o PDF, cria as OS e acompanha.
- **Oficina/Mecânica** — executa as OS. Pode usar o mesmo login do admin ou um perfil próprio. Move o card no Kanban e informa o hodômetro ao concluir.

Funcionários comuns (que só solicitam peça) não veem a aba Manutenção.

## 3. Como acessar

No cabeçalho do sistema (topo da tela), clique na aba **Manutenção**. Ela fica entre "Frotas" e "Usuários", com o rótulo em branco e marcador "ADM" — indicando que só o administrador tem acesso.

Ao entrar, o módulo abre por padrão na aba **Kanban Oficina** (a rotina do dia a dia). Se ainda não tiver nenhuma OS, o Kanban fica vazio — isso é normal no primeiro uso.

## 4. Importar o PDF do GMAIS

Passo a passo pra alimentar o sistema com os dados do relatório:

1. Gere no GMAIS o relatório **Posição Lubrificação/Manutenção/Garantias da Frota**. Salve como PDF (nome típico: `Relatorios_GMAIS_XXX.PDF`).
2. No sistema, aba Manutenção, clique no botão à direita **Relatório GMAIS**.
3. Aparece um bloco "Importar PDF do GMAIS" com um campo de arquivo. Clique nele e selecione o PDF.
4. O sistema lê o arquivo. Enquanto processa, aparece o texto "Lendo PDF…".
5. Depois de alguns segundos, aparece um **preview**: quantas linhas foram lidas, quantas frotas e quantas o GMAIS marcou como vencidas.
6. Confirme com **✓ Confirmar e gravar**. O snapshot anterior é substituído pelo novo — sem duplicar.

Reimportar o mesmo arquivo mais tarde não gera duplicidade: o snapshot é sempre substituído. Se você refizer o import semanalmente, cada import é uma "foto atual" do GMAIS.

**Importante:** o import atualiza APENAS a tabela do relatório GMAIS. As Ordens de Serviço já criadas ficam intactas — não perdem histórico nem status.

## 5. Visualizar e filtrar o relatório

Depois de importar, você vê 3 cartões no topo com contadores:

- **Linhas no snapshot** — total de compartimentos importados.
- **Frotas** — quantas frotas distintas apareceram.
- **Vencidas no GMAIS** — quantas linhas estavam marcadas com asterisco.

Abaixo, filtros para pesquisar:

- Busca livre por frota, compartimento, peça ou código.
- Campo de nº da frota (ex.: "1", "26", "145").
- Botão **Só vencidas** — filtra rapidamente as que estão em atraso segundo o GMAIS.

A tabela mostra cada compartimento com: número + modelo da frota, código + tipo do compartimento, data e hodômetro da última troca, intervalo (km entre trocas), hodômetro atual, KM faltando, e peça recomendada com código.

Linhas em vermelho suave são as vencidas (marcador `*` do GMAIS).

## 6. Programar uma OS pra oficina

Cada linha da tabela tem um botão **+ Programar** à direita. Ao clicar:

1. Confirma o pedido ("Programar OS pra oficina? Frota X — Compartimento Y").
2. Ao confirmar, cria uma **Ordem de Serviço (OS)** na coluna "Programada" do Kanban.
3. O sistema pré-preenche automaticamente com os dados da linha do PDF: frota, compartimento, peça recomendada, quantidade sugerida.

Você programa quantas OS quiser — pode filtrar as vencidas e clicar Programar em várias, uma por vez.

Depois de programar, vá pra aba **Kanban Oficina** pra ver as OS aparecerem.

## 7. Kanban Oficina — dia a dia

O Kanban tem 3 colunas:

- **Programada** — OS criadas por você, aguardando a oficina começar.
- **Em execução** — oficina pegou pra fazer.
- **Concluída** — troca realizada.

Cada card mostra:

- Número da frota + modelo do veículo.
- Compartimento (Ex.: 1-CARTER, 18-CAIXA DE CAMBIO).
- Peça vinculada + código.
- Quantidade e unidade.
- Botões de ação conforme o status.

Botões disponíveis:

- **▶ Iniciar** (só em Programada) — move o card pra "Em execução".
- **✓ Concluir** (só em Em execução) — abre o modal pra registrar a troca.
- **← Voltar** (só em Em execução) — se pegou por engano, devolve pra Programada.
- **Cancelar** — marca a OS como cancelada.
- **Ver** — abre modal com todos os detalhes (quem criou, quem iniciou, observações).
- **🗑** (só em Concluída) — exclui a OS. É soft delete: some da tela mas fica no banco pra auditoria.

Filtro no topo do Kanban: busque por frota, compartimento ou peça.

## 8. Concluir uma troca (com baixa automática de estoque)

Ao clicar **✓ Concluir** num card em execução, abre um modal com 3 campos:

1. **Hodômetro atual** (obrigatório) — o valor lido do painel do veículo no momento da troca. Ex.: "429.899". O sistema recusa concluir sem esse campo.
2. **Quantidade consumida** — o quanto de óleo/filtros foi usado, na unidade da peça (litros, unidades, kg…). O sistema pré-preenche com a quantidade sugerida da OS.
3. **Observações** — livre. Pode registrar detalhes da troca, número de ordem físico, etc.

Se a peça está vinculada ao estoque, o modal mostra:

- Saldo atual no estoque.
- Aviso vermelho se a quantidade informada vai zerar/negativar o saldo. Nesse caso, considere abrir compra antes de concluir.

Ao clicar **✓ Concluir e dar baixa**, o sistema:

1. Marca a OS como concluída (data, hora, quem concluiu, hodômetro).
2. **Baixa a peça no estoque automaticamente** — subtrai a quantidade informada do saldo.
3. Registra uma movimentação de saída com motivo "Manutenção OS #N — Compartimento X".
4. Registra a ação no audit_log (rastreável em Auditoria).

**Nunca zera o estoque abaixo de zero.** Se por acaso a quantidade for maior que o saldo, o sistema baixa até 0 (não vai pra negativo).

Se a OS não tem peça vinculada (só código texto solto, sem match no catálogo), o sistema NÃO baixa nada — nesse caso, você registra a saída manualmente pela aba Estoque depois.

## 9. Regras importantes

- **Import não gera OS automaticamente.** Você importa o relatório e ele fica só como referência na tabela. Nada é criado sem sua ação.
- **Snapshot é substituído a cada import.** Reimportar o mesmo PDF ou um novo substitui a tabela "Relatório GMAIS". Os dados de trocas realizadas (OS Concluídas) NUNCA são apagados.
- **Você define o que virar OS.** O sistema não decide "isso está vencido, cria OS". Você é quem prioriza.
- **Concluir exige hodômetro.** Sem hodômetro, o sistema não deixa concluir. É pra garantir rastreabilidade da próxima troca.
- **Baixa é automática mas só com peça vinculada.** Se a peça do estoque não bateu com o código do GMAIS, a baixa não acontece (o sistema não sabe qual peça descontar).
- **Excluir OS é soft delete.** A linha some do Kanban mas fica no banco. Fica rastreável na Auditoria.
- **Só admin acessa.** Funcionário comum não vê a aba Manutenção.

## 10. Ciclo típico da semana

Um fluxo prático pra rotinizar o uso:

**Segunda-feira de manhã** — admin gera o PDF novo no GMAIS e sobe no sistema. Filtra "Só vencidas". Para cada uma que realmente precisa ser feita nessa semana, clica "+ Programar". Ao final, tem 8-15 OS na coluna "Programada" do Kanban.

**Durante a semana** — oficina abre o sistema, vê a fila. Pega uma OS ("Iniciar"), vai executar. Ao terminar, volta ao sistema, clica "Concluir", informa hodômetro e quantidade. Sistema baixa o estoque e a OS sai do Kanban.

**Sexta-feira** — admin revisa. Kanban idealmente vazio na coluna "Programada" ou com poucas OS que ficaram pra próxima semana. Vai em "Concluída" pra ver o que foi feito no período.

**No próximo relatório do GMAIS** — as trocas concluídas vão aparecer com data e hodômetro atualizados, e o número de vencidas cai.

## 11. Perguntas frequentes

**E se eu programar OS por engano?**  
No Kanban, clica na OS → botão **Cancelar** → confirma. A OS vira "Cancelada" e some da coluna Programada. Não afeta o estoque.

**E se o oficial marcar concluída sem ter feito?**  
O sistema baixa o estoque na hora. Pra reverter: vai na aba Estoque → linha da peça → botão **Ajustar** → escolhe "Entrada" → digita a quantidade que foi baixada errado → motivo "Estorno OS #N". O sistema deixa auditável.

**Reimportei o PDF e sumiram linhas — perdi as OS?**  
Não. O snapshot do relatório é substituído, mas as OS estão em outra tabela e ficam intactas. Elas continuam no Kanban com todos os dados originais.

**Quantas vezes posso importar o PDF?**  
Quantas quiser. Recomendação: uma vez por semana ou quando o GMAIS receber uma atualização importante. Cada import é uma "foto" do momento.

**O sistema muda o GMAIS?**  
Não. O sistema só lê o PDF que você exporta. Nada é enviado de volta pro GMAIS. Você continua atualizando o GMAIS lá mesmo, do jeito que sempre fez.

**Uma peça saiu do estoque mas o GMAIS ainda não sabe. Como sincronizar?**  
Ao concluir a OS aqui, você atualiza o hodômetro e a data da troca no próprio GMAIS depois (rotina manual). O sistema só cuida do estoque interno e do rastro operacional.

## 12. Solução de problemas

**"falha_parse_pdf" ao anexar o relatório**  
Confirme que o arquivo é o PDF original do GMAIS (não uma foto do PDF, nem um PDF escaneado). Se o arquivo tem mais de 12 MB, exporte novamente sem imagens embutidas.

**Preview mostra 0 linhas**  
O PDF foi gerado do relatório correto? O sistema aceita o layout "Posição Lubrificação/Manutenção/Garantias da Frota". Outros relatórios do GMAIS (Extrato de peças, Requisições) não são reconhecidos.

**Card do Kanban não avança**  
Verifique se você está logado como admin. Funcionário comum não vê Manutenção.

**Quantidade errada ao concluir**  
Você pode ajustar a quantidade no modal antes de confirmar. Se já concluiu com valor errado, ajuste manualmente pela aba Estoque (botão Ajustar).

**Não sei quem programou uma OS antiga**  
Clique em "Ver" no card. Aparece "Criado por" com o nome do usuário e data/hora. Ou vá em Auditoria e filtre por ação "OS de manutenção criada".

## 13. Contato

Para dúvidas de operação ou bugs, contate o desenvolvedor responsável pelo sistema.
