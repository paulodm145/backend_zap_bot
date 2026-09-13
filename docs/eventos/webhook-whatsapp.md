# Webhook do WhatsApp

## Objetivo e segurança

Receber eventos da **Evolution API** (servidor próprio, self-hosted — decisão
registrada em `docs/ARQUITETURA-BACKEND.md`, seção 1.2), validar a origem e
mover o processamento pesado para BullMQ. A rota é pública porque quem a
chama é o próprio servidor Evolution, não um usuário autenticado — mas o
frontend nunca deve chamá-la.

A Evolution API não assina o payload com HMAC como a Meta fazia. Em vez
disso, cada evento carrega no corpo a `apikey` da instância que o originou.
A validação funciona assim:

1. Resolve o tenant pelo campo `instance` do evento em
   `central_db.roteamentos_whatsapp` (sem abrir nenhum banco de tenant).
2. Só então abre o banco físico do tenant resolvido e busca a conta WhatsApp
   correspondente à instância.
3. Compara a `apikey` recebida com a `apikey` armazenada (descriptografada)
   daquela conta. Divergência retorna `403 ACESSO_NEGADO` antes de qualquer
   processamento.

Nunca registre a `apikey` completa ou o corpo integral do evento em logs.

## Endpoints

| Método | Rota                       | Finalidade                            |
| ------ | -------------------------- | ------------------------------------- |
| `POST` | `/api/v1/webhook/whatsapp` | Recebe, valida, deduplica e enfileira |

Não existe rota `GET` de challenge — a Evolution API não usa esse mecanismo
de verificação da Meta.

## Envelope do evento

Todo evento chega no mesmo formato, variando `event` e `data`:

```json
{
  "event": "messages.upsert",
  "instance": "tenant-1-ad7bbf98-7353-490b-a7ca-78ee3b608c93",
  "apikey": "4B5579A1-0CFE-4AD7-AE36-7B0AD571CD21",
  "data": { "...": "..." },
  "destination": "http://api:3000/api/v1/webhook/whatsapp",
  "date_time": "2026-09-13T17:38:04.799Z",
  "server_url": "http://evolution-api:8080"
}
```

### `messages.upsert` — mensagem recebida

Processado apenas quando é uma mensagem de texto recebida (`fromMe: false`
com `message.conversation` ou `message.extendedTextMessage.text`
preenchido). Outros tipos de mensagem (mídia, figurinha, etc.) e ecos de
mensagens enviadas pela própria conta (`fromMe: true`) são reconhecidos e
ignorados sem erro, sem criar job:

```json
{
  "event": "messages.upsert",
  "instance": "tenant-1-ad7bbf98-7353-490b-a7ca-78ee3b608c93",
  "apikey": "4B5579A1-0CFE-4AD7-AE36-7B0AD571CD21",
  "data": {
    "key": {
      "id": "3EB0...",
      "remoteJid": "5511888888888@s.whatsapp.net",
      "fromMe": false
    },
    "pushName": "Cliente",
    "messageTimestamp": 1785360000,
    "message": { "conversation": "Olá" }
  }
}
```

Resposta:

```json
{ "processado": true, "recebidas": 1, "duplicadas": 0 }
```

### `connection.update` — mudança de estado da conexão

Atualiza o `status` da conta WhatsApp no banco do tenant (`CONECTANDO`,
`CONECTADO` ou `DESCONECTADO`, espelhando os estados `connecting`/`open`/
`close` do Baileys). Não cria job de mensagem:

```json
{
  "event": "connection.update",
  "instance": "tenant-1-ad7bbf98-7353-490b-a7ca-78ee3b608c93",
  "apikey": "4B5579A1-0CFE-4AD7-AE36-7B0AD571CD21",
  "data": { "state": "open", "statusReason": 200 }
}
```

Resposta: `{ "processado": true, "recebidas": 0, "duplicadas": 0 }`.

### Outros eventos

Qualquer `event` fora de `messages.upsert`/`connection.update` (por exemplo
`qrcode.updated`, que esta versão não persiste — o frontend obtém um QR
atualizado chamando `POST /api/v1/contas-whatsapp/{contaId}/reconectar`, ver
`docs/api/contas-whatsapp.md`) é reconhecido e ignorado:

```json
{ "processado": false, "recebidas": 0, "duplicadas": 0 }
```

## Resolução do tenant

O `instance` do evento é consultado em `central_db.roteamentos_whatsapp`. O
registro aponta para um tenant ativo e contém apenas o nome da instância —
nenhuma credencial. A `apikey` e os demais dados da conta continuam
exclusivamente no banco físico do tenant. Não há resolução por subdomínio.

O vínculo central é criado automaticamente quando a conta é provisionada
(`POST /api/v1/contas-whatsapp`). Uma instância não vinculada, um tenant
inativo ou uma `apikey` divergente retornam, respectivamente,
`404 NAO_ENCONTRADO` e `403 ACESSO_NEGADO`.

## Idempotência e filas

A mensagem é reservada no Redis com:

```text
tenant:{tenantPublicId}:webhook:mensagem:{mensagemId}
```

A operação usa `SET NX` com expiração configurada por
`WEBHOOK_IDEMPOTENCIA_SEGUNDOS`. A mesma mensagem do mesmo tenant não cria
outro job; IDs iguais em tenants diferentes permanecem isolados.

Todo job inclui explicitamente `tenantId`, `instanceName`, `mensagemId`,
remetente (`remoteJid`), timestamp, tipo e texto. O padrão das filas usa
cinco tentativas, backoff exponencial iniciado em um segundo e retenção
limitada para jobs concluídos e falhos.

O worker resolve a conexão física pelo `tenantId`, normaliza o telefone e
persiste contato, conversa e mensagem idempotentemente. Ele inicia junto com
`npm run dev`/`npm start` e encerra com a API.

> **Gap conhecido:** status de entrega de mensagens enviadas (sent/delivered/
> read) não é mapeado nesta versão — a Evolution API expõe isso via eventos
> `messages.update` com códigos de ACK do Baileys, formato diferente do
> `statuses[]` da Meta. A infraestrutura de fila (`ProcessadorStatusWhatsappService`)
> já existe e está pronta para receber esse mapeamento quando for priorizado
> (ver `docs/TAREFAS-INTEGRACAO-EVOLUTION-API.md`).

## Uso pelo frontend

O frontend não chama essa rota e não deve receber a `apikey` de nenhuma
instância. O estado de conexão de cada conta chega por polling do detalhe em
`docs/api/contas-whatsapp.md`.

## Teste local

No ambiente Docker (`docker-compose.dev.yml`), a Evolution API já está
configurada para chamar `http://api:3000/api/v1/webhook/whatsapp` — não é
necessário expor a API publicamente nem usar túnel para testar localmente,
desde que ambos os containers estejam na mesma rede do Compose.

## Erros

| Status | Código           | Ação                                                        |
| ------ | ---------------- | ----------------------------------------------------------- |
| `403`  | `ACESSO_NEGADO`  | `apikey` do evento não confere com a instância resolvida    |
| `404`  | `NAO_ENCONTRADO` | Instância não vinculada a um tenant ativo                   |
| `422`  | `VALIDACAO`      | Conferir o payload no Swagger                               |
| `500`  | `ERRO_INTERNO`   | Reenvio da Evolution API poderá ser aceito após recuperação |
