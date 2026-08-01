# Histórico de contatos e conversas

`GET /api/v1/contatos?skip=0&take=20&busca=maria` retorna contatos com paginação server-side. A busca considera nome normalizado e telefone. Atendentes recebem apenas contatos com conversas nos seus setores.

## Lista de conversas

Use `GET /api/v1/conversas` com `skip`, `take`, `busca` e filtros opcionais `status`, `setorId`, `atendenteId` e `contaId`. Estados: `BOT`, `AGUARDANDO_ATENDENTE`, `COM_ATENDENTE` e `ENCERRADA`.

- fila: `status=AGUARDANDO_ATENDENTE` e, se necessário, `setorId`;
- minhas conversas: `status=COM_ATENDENTE&atendenteId=...`;
- encerradas: `status=ENCERRADA`.

O backend restringe o atendente aos setores vinculados. Um `404` no detalhe também pode significar conversa fora desse escopo.

## Detalhe e timeline

`GET /api/v1/conversas/{conversaId}` retorna contato, conta, setor, atendente, estado e snapshot `estado_fluxo`.

Carregue mensagens recentes com `GET /api/v1/conversas/{conversaId}/mensagens?take=50`. `dados` vem em ordem cronológica. Para anteriores, repita com `cursor={proximoCursor}` e preceda os itens na timeline.

Nunca deduplique por horário: mensagens podem compartilhar timestamp. Use `public_id` como chave. O cursor combina data e ID sequencial. Quando `proximoCursor` for `null`, o histórico terminou.

Cada mensagem informa direção, autor, entrega, conteúdo, mídia/erro quando existentes e referência respondida. Atualize itens existentes pelo `public_id` em vez de acrescentar duplicatas.

## Persistência de entrada

O webhook reserva no Redis e o worker persiste no PostgreSQL físico do tenant. Contato e conversa são reaproveitados dentro da janela de 24 horas; janela expirada é encerrada antes de outra conversa. A unicidade de `whatsapp_message_id` protege contra reentrega após a expiração do Redis.
