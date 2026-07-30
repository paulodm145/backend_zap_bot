# Webhook do WhatsApp

## Objetivo e segurança

Receber mensagens de texto da WhatsApp Cloud API, validar a origem e mover o
processamento para BullMQ. As rotas são públicas porque são chamadas pela
Meta, mas não aceitam autenticação do frontend.

O `POST` só interpreta o JSON depois de validar `X-Hub-Signature-256` contra o
corpo bruto com HMAC SHA-256 e `WEBHOOK_WHATSAPP_APP_SECRET`. Nunca registre o
App Secret, o token de verificação ou o corpo completo do evento em logs.

## Endpoints

| Método | Rota                       | Finalidade                              |
| ------ | -------------------------- | --------------------------------------- |
| `GET`  | `/api/v1/webhook/whatsapp` | Challenge de configuração da Meta       |
| `POST` | `/api/v1/webhook/whatsapp` | Recebe, deduplica e enfileira mensagens |

### Challenge

A Meta envia:

```http
GET /api/v1/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=123
```

Se o token corresponder a `WEBHOOK_WHATSAPP_VERIFY_TOKEN`, a API devolve `123`
como `text/plain`. Token diferente retorna `403 ACESSO_NEGADO`.

### Evento suportado

Nesta etapa, o contrato processa mensagens de texto:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WABA_ID",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "5511999999999",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "messages": [
              {
                "id": "wamid.ID_UNICO",
                "from": "5511888888888",
                "timestamp": "1785360000",
                "type": "text",
                "text": { "body": "Olá" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

Eventos válidos sem `messages`, como atualizações de status, são reconhecidos
e respondidos sem criar jobs. Tipos de mensagem além de `text` serão incluídos
quando seu processamento for implementado.

Resposta:

```json
{ "recebidas": 1, "duplicadas": 0 }
```

## Resolução do tenant

O `phone_number_id` é consultado em `central_db.roteamentos_whatsapp`. O
registro aponta para um tenant ativo e contém apenas metadados de roteamento.
Tokens e configuração completa da conta continuam no banco físico do tenant.
Não há resolução por subdomínio.

O vínculo central precisa ser criado durante o onboarding manual da conta.
Um número não vinculado ou pertencente a tenant inativo retorna
`404 NAO_ENCONTRADO`.

## Idempotência e filas

A mensagem é reservada no Redis com:

```text
tenant:{tenantPublicId}:webhook:mensagem:{mensagemId}
```

A operação usa `SET NX` com expiração configurada por
`WEBHOOK_IDEMPOTENCIA_SEGUNDOS`. A mesma mensagem do mesmo tenant não cria
outro job; IDs iguais em tenants diferentes permanecem isolados.

Todo job inclui explicitamente `tenantId`, `phoneNumberId`, `mensagemId`,
remetente, timestamp, tipo e conteúdo. O padrão das filas usa cinco tentativas,
backoff exponencial iniciado em um segundo e retenção limitada para jobs
concluídos e falhos.

## Uso pelo frontend

O frontend não chama essas rotas e não deve receber o App Secret nem o token
de challenge. Uma futura tela de configuração da conta poderá exibir apenas:

- estado do vínculo do número;
- `phone_number_id` mascarado quando necessário;
- data da última sincronização;
- instruções para copiar a URL pública do webhook.

Estados de entrega e processamento devem vir de endpoints autenticados ou
eventos WebSocket futuros, nunca por consulta direta ao webhook.

## Teste local

Exponha a API por HTTPS com uma ferramenta de túnel e cadastre:

```text
https://URL_PUBLICA/api/v1/webhook/whatsapp
```

Para gerar uma assinatura de teste, calcule HMAC SHA-256 sobre os bytes exatos
do JSON enviado e prefixe o hexadecimal com `sha256=`. Alterar espaços ou a
ordem do JSON depois do cálculo invalida a assinatura.

## Erros

| Status | Código           | Ação                                               |
| ------ | ---------------- | -------------------------------------------------- |
| `403`  | `ACESSO_NEGADO`  | Verificar assinatura ou token de challenge         |
| `404`  | `NAO_ENCONTRADO` | Vincular o número a um tenant ativo                |
| `422`  | `VALIDACAO`      | Conferir o payload no Swagger                      |
| `500`  | `ERRO_INTERNO`   | Reenvio da Meta poderá ser aceito após recuperação |
