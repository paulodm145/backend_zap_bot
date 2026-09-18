# Contatos

Todos os endpoints usam Bearer token e o banco físico resolvido pelo e-mail/JWT. Qualquer papel do tenant (`ADMIN_TENANT`, `GESTOR`, `ATENDENTE`) pode listar e detalhar contatos; criar, editar e excluir exige `ADMIN_TENANT` ou `GESTOR`. Iniciar uma conversa direta com um contato está liberado para qualquer papel — é o fluxo que o atendente usa no dia a dia.

## Tela de contatos

- Liste com `GET /api/v1/contatos?skip=0&take=20&busca=&ativo=true`. `busca` casa por nome normalizado (sem acento, minúsculo) e por dígitos do telefone; `ativo` filtra excluídos logicamente. Use `dados`, `total`, `skip` e `take` na paginação server-side.
- Detalhe: `GET /api/v1/contatos/{contatoId}`. `_count.conversas` informa quantas conversas (de qualquer status) o contato já teve — útil para não deixar excluir contato "novo" pareça vazio na listagem.
- Crie com `POST /api/v1/contatos`, corpo `{ "nome": "Maria Cliente", "telefone": "5511988887777", "atributos": { "origem": "site" } }`. `nome` e `atributos` são opcionais; `telefone` é obrigatório e aceita qualquer formatação (parênteses, espaço, hífen, com ou sem `+`) — o backend normaliza antes de salvar e devolve o valor já normalizado (`+5511988887777`) na resposta.
- Edite com `PUT /api/v1/contatos/{contatoId}`, mesmos campos, todos opcionais (ao menos um deve vir preenchido).
- Exclua com `DELETE /api/v1/contatos/{contatoId}` (soft delete: `ativo=false`, `deletado_at` preenchido). Em `409`, o contato tem conversa em andamento (qualquer status diferente de `ENCERRADA`); não ofereça exclusão forçada.
- Em `409` na criação/edição, já existe outro contato com esse telefone — a mensagem de erro já traz o nome do contato existente quando ele tiver um, útil para sugerir editar em vez de duplicar.
- Em `422` na criação/edição, o telefone informado não é um número válido (menos de 8 ou mais de 15 dígitos).
- Em `403`, esconda os botões de criar/editar/excluir para `ATENDENTE`, mantendo o backend como autoridade final.

### Evitar duplicidade ao digitar o telefone

Antes de o usuário confirmar a criação, chame `GET /api/v1/contatos?busca={telefone digitado}` (com debounce) e, se vier algum resultado cujo `telefone` bate com o normalizado, mostre "Já existe um contato com esse número: {nome}" com um atalho para abrir a edição dele em vez de criar um novo. Isso não substitui a validação de `409` no submit — é só feedback antecipado, porque duas pessoas podem estar cadastrando ao mesmo tempo.

## Iniciar conversa direta com um contato

`POST /api/v1/contatos/{contatoId}/conversas` — não recebe body na maioria dos casos; envie `{ "contaWhatsappId": "uuid" }` apenas quando o tenant tiver mais de uma conta WhatsApp conectada (nesse caso é obrigatório, veja abaixo). Resposta `201`:

```json
{ "conversaId": "uuid", "status": "COM_ATENDENTE", "janelaAberta": true }
```

Depois do `201`, navegue para a tela de atendimento já com `conversaId` selecionado (ex.: `/atendimento?conversa={conversaId}`) e reaproveite toda a UI de conversa existente — esta chamada não envia mensagem nenhuma, só garante que a conversa existe e que quem chamou é o responsável por ela.

Comportamento:

- Se o contato já tiver uma conversa em andamento (qualquer status diferente de `ENCERRADA`) sem atendente, o backend a atribui a quem chamou.
- Se o contato já tiver uma conversa em andamento **com o mesmo usuário** já responsável, a chamada é idempotente: devolve a mesma conversa, sem erro.
- Se já tiver uma conversa em andamento com **outro** atendente responsável, retorna `409` — mostre que outra pessoa já está atendendo esse contato.
- Se não houver nenhuma conversa em andamento, cria uma nova, já atribuída a quem chamou.
- `janelaAberta: false` significa que a janela de atendimento de 24h do WhatsApp está fechada ou nunca foi aberta (contato nunca respondeu, ou respondeu há mais de 24h) — o envio de mensagem em `POST /conversas/{id}/mensagens` vai recusar com `422` até o contato mandar uma mensagem nova. Avise o usuário disso na tela em vez de deixar o composer falhar sem explicação.
- Em `403`, quem chamou não tem perfil de atendente ativo — normalmente afeta só contas recém-criadas sem vínculo de setor; oriente a configurar o perfil de atendente.
- Em `422`, não há conta WhatsApp conectada (nenhuma para usar) ou há mais de uma e `contaWhatsappId` não foi informado — nesse segundo caso, ofereça um seletor com as contas conectadas antes de repetir a chamada.

Esta rota não substitui a fila (`docs/api/historico-conversas.md`, seção "Fila, claim e transferência"): ela é um atalho fora da fila para quando o atendente já sabe com quem quer falar, por isso não exige vínculo entre o atendente e o setor da conversa.
