# Tarefas — migração da integração WhatsApp para Evolution API

Branch: `feat/integracao-evolution-api`
Dependência: nenhuma etapa nova de infraestrutura além do que já existe (banco central, multi-tenant, filas e o motor de fluxo mínimo já implementados em `main`).

## Contexto

Decisão registrada em `docs/PRD.md` (seção 5.3) e `docs/ARQUITETURA-BACKEND.md`
(seção 1.2): nesta fase de estudo, a comunicação com o WhatsApp passa de
**WhatsApp Cloud API oficial (Meta)** para **Evolution API** (servidor
próprio, self-hosted, protocolo não oficial via Baileys). Este documento
levanta, arquivo por arquivo, o que já existe implementado assumindo Cloud
API e precisa mudar.

Versão adotada: `evoapicloud/evolution-api:v2.3.7` (última tag estável no
Docker Hub no momento da implementação; `v2.4.0-rc*` e `homolog` são
pré-lançamentos, não usados). Contrato de API confirmado manualmente contra
uma instância real rodando localmente antes de escrever o código (endpoints,
autenticação por header `apikey`, formato do payload de webhook, inclusive
que o próprio evento carrega a `apikey` da instância).

## Infraestrutura

- [x] Adicionar o serviço `evolution-api` ao `docker-compose.dev.yml`, com
      volume nomeado próprio para persistência de sessão (`evolution_dados`,
      montado em `/evolution/instances`).
- [x] Definir se a Evolution API deste ambiente usa Redis compartilhado ou
      cache próprio — decisão: `CACHE_LOCAL_ENABLED=true` (cache em memória
      no próprio container), sem tocar no Redis compartilhado da aplicação,
      mais simples para o ambiente de estudo.
- [x] Adicionar `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` (chave global de
      administração de instâncias) a `src/config/ambiente.ts` e
      `.env.example`.
- [x] Banco dedicado da Evolution API: em vez de um segredo de webhook
      adicional, criado `zapbot_evolution` no mesmo Postgres do Compose via
      script em `docker/postgres-initdb/` (executado só na primeira
      inicialização do volume; em volume já existente, criar manualmente
      com `CREATE DATABASE zapbot_evolution;`).
- [x] Adicionar `EVOLUTION_WEBHOOK_URL_BASE` (em vez de um segredo de webhook
      separado) — a autenticação do webhook usa a própria `apikey` da
      instância, presente no corpo de cada evento (ver seção "Contrato do
      webhook" abaixo); não foi necessário um `EVOLUTION_WEBHOOK_SECRET`.
- [x] Remover de `src/config/ambiente.ts` e `.env.example` as variáveis
      exclusivas da Meta (`WHATSAPP_GRAPH_API_URL`,
      `WEBHOOK_WHATSAPP_APP_SECRET`, `WEBHOOK_WHATSAPP_VERIFY_TOKEN`).
- [x] Atualizar `README.md` (seção de containers) com o passo de subir e
      usar a instância Evolution no ambiente local.

## Schema — banco central

- [x] Revisar `RoteamentoWhatsapp` em `prisma/central/schema.prisma`: trocar
      `phone_number_id` por `instance_name`.
- [x] Gerar migration central correspondente
      (`20260801140000_evolution_api`), validando índice único do novo
      identificador.
- [x] Atualizar `src/repositories/roteamento-whatsapp.repository.ts` para o
      novo campo.

## Schema — banco de tenant

- [x] Revisar `ContaWhatsapp` em `prisma/tenant/schema.prisma`: substituir
      `phone_number_id`, `waba_id`, `versao_graph_api`, `token_encrypted` por
      `instance_name`, `instance_id`, `api_key_encrypted`; `ultima_validacao_at`
      renomeado para `ultima_sincronizacao_at`.
- [x] Revisar o enum `StatusContaWhatsapp`: `PENDENTE/VALIDADA/INVALIDA` →
      `CONECTANDO/CONECTADO/DESCONECTADO`, espelhando os estados de conexão
      do Baileys (`connecting`/`open`/`close`).
- [x] Gerar migration de tenant correspondente
      (`20260801190000_evolution_api`).
- [x] Atualizar `src/repositories/conta-whatsapp.repository.ts` para os
      novos campos.

## Contrato do webhook

- [x] Reescrever `src/dtos/webhook-whatsapp.dto.ts` para o formato de evento
      da Evolution API (`event`, `instance`, `apikey`, `data`).
- [x] Remover `challengeWhatsappSchema` e a rota
      `GET /api/v1/webhook/whatsapp` — confirmado contra uma instância real
      que a Evolution API não usa challenge de verificação.
- [x] Substituir `src/middlewares/assinatura-webhook.middleware.ts` (HMAC
      `X-Hub-Signature-256`, removido) — a validação passou para dentro do
      `WebhookWhatsappService`, comparando a `apikey` do evento com a `apikey`
      armazenada (criptografada) da conta resolvida pela instância. Não
      precisa mais de corpo bruto (`raw body`); o webhook usa o
      `express.json()` global como qualquer outra rota.
- [x] Removidos `src/helpers/assinatura-webhook.helper.ts` e
      `src/middlewares/corpo-bruto.middleware.ts` (sem mais uso).
- [x] Reescrever `src/services/webhook-whatsapp.service.ts` para o novo
      formato de payload, resolvendo o tenant pela instância e tratando
      `messages.upsert` (mensagem recebida) e `connection.update`
      (atualiza `status` da conta).

## Envio de mensagens

- [x] Criar `src/services/evolution-api.service.ts`, substituindo
      `src/services/whatsapp-graph-api.service.ts` — chamadas REST à
      Evolution API (`/message/sendText/{instance}`,
      `/message/sendMedia/{instance}`), autenticação via header `apikey`.
- [x] Atualizar `src/services/processador-mensagem-saida.service.ts` para o
      novo serviço de envio.
- [x] Removida qualquer referência residual à Graph API/Meta nesse fluxo.

## Conexão e onboarding da conta WhatsApp

- [x] Reescrever `src/services/conta-whatsapp.service.ts` e
      `src/controllers/conta-whatsapp.controller.ts`: o fluxo passou a ser
      "criar instância → devolver QR code inline na criação → escanear".
      Endpoints `PATCH .../token` e `POST .../testar` (sem equivalente na
      Evolution API) foram removidos; adicionados `POST .../reconectar`
      (novo QR) e `POST .../desconectar` (logout mantendo a conta).
- [x] Entrega do QR code ao frontend: decidido **inline na resposta da
      criação** (`qrCodeBase64` no `201`) mais **polling do detalhe** para
      detectar a conexão — sem WebSocket dedicado nesta primeira versão (não
      há uso concreto que justifique a abstração agora; documentado como
      pendência natural caso o produto precise de feedback em tempo real).
- [x] Atualizar `src/dtos/conta-whatsapp.dto.ts` para o novo contrato de
      entrada/saída.

## Documentação e OpenAPI

- [x] Atualizar `src/config/openapi.ts` com os novos schemas/rotas.
- [x] Reescrever `docs/api/contas-whatsapp.md` para o fluxo de QR code.
- [x] Reescrever `docs/eventos/webhook-whatsapp.md` para o payload da
      Evolution API.
- [x] Atualizar `docs/banco-central.md` e `docs/api/REFERENCIA-ENDPOINTS.md`
      onde citavam `phone_number_id`/Graph API.
- [ ] Revisar itens já concluídos em `docs/TAREFAS-ESTRUTURA-BASE.md` e
      `docs/TAREFAS-RECURSOS-OPERACIONAIS.md` que mencionam
      `X-Hub-Signature-256`/Meta — mantidos como estão intencionalmente
      (registro histórico de etapas já encerradas); nenhuma nota adicional
      foi inserida neles.

## Testes

- [x] Atualizado `tests/webhook-whatsapp.test.ts` para o novo payload e
      validação por `apikey`.
- [x] Criado `tests/services/evolution-api.service.test.ts` (substitui
      `whatsapp-graph-api.service.test.ts`, removido).
- [x] Atualizado `tests/contas-whatsapp-api.test.ts` para o fluxo de QR code.
- [x] Atualizados os demais testes que criavam `ContaWhatsapp`/
      `RoteamentoWhatsapp` de fixture (`historico-api`, `websocket/chat.gateway`,
      `direcionamento-atendimento`, `setores-api`, `database/isolamento-tenants`,
      `workers/worker-retry.integration`, `repositories/banco-central.repository`,
      `mensagens-atendimento`) para os novos campos.

## Pendências descobertas durante a implementação

- [ ] **Status de entrega de mensagens enviadas** (sent/delivered/read) não
      foi mapeado — a Evolution API expõe isso via `messages.update` com
      códigos de ACK do Baileys, formato diferente do `statuses[]` da Meta
      que o `WebhookWhatsappService` antigo consumia. A fila e o processador
      (`ProcessadorStatusWhatsappService`) permanecem no código, prontos para
      receber esse mapeamento quando for priorizado; nenhum evento os
      alimenta hoje.
- [ ] Envio de mídia (`enviarMidia`) foi implementado seguindo o contrato
      documentado da Evolution API v2, mas **não foi validado contra uma
      instância pareada de verdade** (exigiria escanear o QR com um número
      real, não disponível no ambiente de implementação). Validar antes de
      depender dele em produção.

## Checklist de saída

- [x] Nenhuma referência funcional a `phone_number_id`/`waba_id`/Graph API
      permanece fora de comentários explicativos de migração.
- [x] Ambiente local (`docker-compose.dev.yml`) conecta a uma instância real
      da Evolution API via QR code — validado ponta a ponta: criação de
      instância, QR code, webhook `connection.update`/`messages.upsert`,
      reconectar e desconectar, todos contra um container real.
- [x] Swagger e Markdown funcionais sincronizados com o novo contrato.
- [x] Testes, lint, typecheck e build aprovados (`npm run test:coverage`
      completo, incluindo os testes de integração que exigem
      `TEST_DATABASE_URL`/`TEST_TENANT_DATABASE_URL_A`/`_B`/`TEST_REDIS_URL`).
- [ ] Branch pronta para revisão e merge — aguardando commit/PR.
