# Manual do Usuário — Fluxo de Peças GRISOMAQ

Versão pra funcionário. Este documento cobre TUDO que você precisa fazer no dia a dia: abrir pedido de peça, acompanhar o andamento e consultar o estoque.

## 1. Pra que serve o sistema

O **Fluxo de Peças GRISOMAQ** substitui o antigo caderno/planilha de pedidos de peça. Você abre a solicitação, o administrador do almoxarifado vê imediatamente no painel dele, providencia (do estoque ou comprando) e você é avisado quando a peça está pronta pra retirada.

Ganhos:
- Nunca mais perde pedido em papel.
- Você sabe exatamente onde ele está no fluxo.
- Fica registrado quem pediu o quê e quando — sem discussão depois.

## 2. Primeiro acesso

1. Abra o navegador (Chrome ou Edge) no endereço que o administrador te passou. Ex.: `https://almoxarifado.grisomaq.com.br`.
2. Digite seu **nome de usuário** e a **senha inicial** que o administrador criou pra você.
3. Se quiser trocar a senha, peça pro administrador resetar — só ele tem essa opção.

Dica: salva a página nos favoritos e no atalho do celular. Funciona igual no computador e no smartphone.

## 3. Como abrir um pedido de peça

Clique em **+ Novo pedido** no topo da tela.

**Frota** — digite o número (ex.: `95`). O sistema mostra sugestões (`95 — Toyota Hilux CD 4x4`). Selecione a certa; o modelo e ano preenchem sozinhos.

**Peça (descrição)** — comece a digitar o nome da peça. Se ela já existe no almoxarifado, aparece uma sugestão com o saldo atual. Selecione e siga. Se não achar nada parecido, escreva à mão — o administrador identifica depois.

**Quantidade** e **unidade** — número inteiro e a unidade que faz sentido (`un`, `pc`, `lt`, `kg`, `mt`…). O padrão é `un`.

**Prioridade** — `Normal` ou `🔴 Urgente`. Só marque urgente quando o equipamento está parado ou a operação depende.

**Motivo** — escolha:
- Quebra / manutenção corretiva
- Manutenção preventiva
- Reposição de estoque
- Melhoria / retrofit
- Outro (aí escreve o texto — até 150 caracteres)

**Foto (opcional)** — se ajuda a identificar a peça, tire uma foto e anexe. Aceita foto do celular direto.

**Código da peça / fabricante (opcional)** — se você tem o código no catálogo do fornecedor, coloca. Ajuda o comprador.

Aperta **Registrar pedido**. Pronto. Seu pedido apareceu na coluna **Solicitada** do painel.

## 4. Acompanhar seu pedido

A tela **Pedidos** mostra um Kanban — cada coluna é um estágio:

1. **Solicitada** — você acabou de abrir; o administrador ainda não olhou.
2. **Providenciando** — ele viu, tá resolvendo (procurando no estoque ou solicitando compra).
3. **Aguardando buscar** — o fornecedor confirmou; a peça está a caminho.
4. **Aguardando retirada** — a peça CHEGOU no almoxarifado. Vai lá buscar!
5. **Entregue** — retirou. Fim.
6. **Cancelado** — administrador cancelou (com justificativa nos comentários).

Filtros no topo:
- Buscar por descrição, frota, seu nome ou local.
- Filtrar por frota específica.
- Só urgentes.
- Esconder finalizados (só o que está andando).

## 5. Notificações (sino no topo da tela)

O sininho vermelho pisca quando tem novidade:

- Sua solicitação de compra foi **aprovada**.
- A compra foi **efetivada** com o fornecedor.
- Sua peça **chegou** — vai retirar.
- Seu pedido foi **cancelado** ou **marcado como urgente**.
- Alguém **comentou** no seu pedido.

Clica no sino pra ver a lista. Cada notificação leva direto pro pedido.

## 6. Comentar em um pedido

Clica no card do pedido → abre a tela de detalhes → no fim, tem um campo pra comentar. Use pra dar informações extras (ex.: "peça encontrada na oficina", "urgência aumentou, máquina parada"). O administrador é avisado.

## 7. Consultar o estoque

Aba **Estoque** — você vê a lista de peças cadastradas, com saldo, unidade e localização física.

Pode:
- Buscar por nome, código ou código do fabricante.
- Filtrar por família (ex.: HIDRAULICA, FILTROS, ELETRICA AUTO).
- Ver quais estão zeradas (badge "Crítica") ou abaixo do mínimo ("Repor").

Não pode:
- Cadastrar peça nova (só o administrador cadastra).
- Ajustar saldo.
- Excluir.

Se você precisa de uma peça, abre um **pedido** — não tenta cadastrar aqui.

## 8. O que NÃO aparece pra você

Por regra do sistema, funcionário nunca vê:

- Preços, valores unitários, valores totais das compras.
- Condições de pagamento.
- Aba Dashboard (relatórios financeiros).
- Aba Frotas (gestão do cadastro).
- Aba Usuários (gestão de senha e perfil).
- Aba Auditoria (log administrativo).

Isso é intencional — separação de responsabilidades e proteção de dado sensível.

## 9. Perguntas frequentes

**Digitei a peça errada, como corrijo?**  
Abra o pedido, adicione um comentário explicando o certo, e peça pro administrador cancelar o pedido errado e abrir de novo. Você não pode editar o pedido depois de aberto (regra de auditoria).

**Esqueci minha senha.**  
Chama o administrador — ele reseta pra uma senha nova em segundos.

**Meu pedido sumiu do painel.**  
Provavelmente foi movido pra "Entregue" ou "Cancelado" e o filtro "Esconder finalizados" está ativo. Desmarca o filtro pra ver todos.

**Posso abrir pedido pelo celular?**  
Sim. Todo o sistema funciona no celular. Só evite tirar fotos MUITO grandes (mais de 8 MB) — pode dar erro no upload.

**Como sei que meu pedido tá sendo tratado?**  
Ele sai da coluna "Solicitada" e vai pra "Providenciando" — é o sinal que o administrador olhou. Se ficar 2 dias em "Solicitada", chama ele pessoalmente.

**Posso ver os pedidos de outras pessoas?**  
Sim, todos veem tudo. Isso é proposital pra ninguém pedir a mesma peça duas vezes.

## 10. Contato

Problema com o sistema? Fale com o administrador do almoxarifado. Ele tem contato do suporte técnico.
