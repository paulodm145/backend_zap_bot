# Histórico de contatos e conversas

`GET /api/v1/contatos?skip=0&take=20&busca=maria` retorna contatos com paginação server-side. A busca considera nome normalizado e telefone. Atendentes recebem apenas contatos com conversas nos seus setores.

## Lista de conversas

Use `GET /api/v1/conversas` com `skip`, `take`, `busca` e filtros opcionais `status`, `setorId`, `atendenteId` e `contaId`. Estados: `BOT`, `AGUARDANDO_ATENDENTE`, `COM_ATENDENTE` e `ENCERRADA`.

- fila: `visao=FILA` e, se necessário, `setorId`;
- minhas conversas: `visao=MINHAS` (o backend usa a identidade autenticada);
- encerradas: `status=ENCERRADA`.

O backend restringe o atendente aos setores vinculados. Um `404` no detalhe também pode significar conversa fora desse escopo.

## Detalhe e timeline

`GET /api/v1/conversas/{conversaId}` retorna contato, conta, setor, atendente, estado e snapshot `estado_fluxo`.

Carregue mensagens recentes com `GET /api/v1/conversas/{conversaId}/mensagens?take=50`. `dados` vem em ordem cronológica. Para anteriores, repita com `cursor={proximoCursor}` e preceda os itens na timeline.

Nunca deduplique por horário: mensagens podem compartilhar timestamp. Use `public_id` como chave. O cursor combina data e ID sequencial. Quando `proximoCursor` for `null`, o histórico terminou.

Cada mensagem informa direção, autor, entrega, conteúdo, mídia/erro quando existentes e referência respondida. Atualize itens existentes pelo `public_id` em vez de acrescentar duplicatas.

`conteudo` é o JSON bruto persistido e o formato varia por `tipo`/`autor` — nunca renderize o objeto direto. Para `tipo: "TEXTO"` (`autor` `CONTATO`/`BOT`/`ATENDENTE`), é `{ "texto": "..." }`. Para `tipo: "SISTEMA"` (`autor: "SISTEMA"`, `direcao: "INTERNA"` — nota automática de handoff/fluxo), é `{ "acao": "ASSUMIU" | "REATRIBUIU" | "DEVOLVEU_AO_BOT" | "ENCERROU" | "DIRECIONOU_FLUXO", "motivo": "texto ou null" }`. O campo de status de entrega da mensagem é `status_entrega`, não `status`.

## Persistência de entrada

O webhook reserva no Redis e o worker persiste no PostgreSQL físico do tenant. Contato e conversa são reaproveitados dentro da janela de 24 horas; janela expirada é encerrada antes de outra conversa. A unicidade de `whatsapp_message_id` protege contra reentrega após a expiração do Redis.

## Execução automática do fluxo (bot)

Depois de persistir a mensagem recebida, se a conversa estiver em `status: BOT`
e a conta Whatsapp de origem tiver um fluxo de entrada associado (ver
`docs/api/contas-whatsapp.md`), o worker executa o fluxo publicado (mesmo motor
usado na simulação do editor) e envia as respostas do bot pelo canal normal de
saída — elas aparecem na timeline com `autor: BOT`. O estado da conversa no
fluxo (nó atual, respostas capturadas) fica salvo no Redis e é usado a cada
nova mensagem, até o fluxo direcionar a um setor (`direcionar_setor`), quando a
conversa muda para `AGUARDANDO_ATENDENTE` e passa a valer a seção seguinte
("Fila, claim e transferência") — novas mensagens do contato deixam de
reacionar o fluxo enquanto a conversa não voltar para `BOT`. Contas sem fluxo
associado apenas registram as mensagens recebidas, aguardando atribuição
manual via `reatribuir`.

## Fila, claim e transferência

Ao clicar em **Assumir**, envie `POST /api/v1/conversas/{conversaId}/assumir` sem corpo. O backend valida o vínculo com o setor e faz o claim atômico. Em `409 CONFLITO`, remova a conversa da fila e informe que outro atendente a assumiu; não repita automaticamente.

Admin e gestor podem usar `POST /api/v1/conversas/{conversaId}/reatribuir` com `{ "setorId": "uuid", "atendenteId": "uuid opcional", "motivo": "texto" }`. Sem `atendenteId`, a conversa volta à fila do setor. A tela deve confirmar a operação e exigir o motivo.

`POST /api/v1/conversas/{conversaId}/encerrar` recebe `{ "motivo": "opcional", "devolverAoBot": false }`. Com `devolverAoBot: true`, o snapshot persistido é mantido/restaurado e a conversa volta ao estado `BOT`; sem snapshot, a API responde `422`.

Atualize as listas após cada ação. As transferências guardam autor, atendentes/setores de origem e destino, motivo e data no banco do tenant.
