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

Antes de iniciar a implementação: confirmar com o usuário a versão da
Evolution API alvo (v2.x) e o modo de integração da instância
(`WHATSAPP-BAILEYS`), e revisar o formato real do payload de webhook contra
uma instância rodando (`event`, `instance`, `data`), já que a documentação
pública da Evolution API muda entre versões.

## Infraestrutura

- [ ] Adicionar o serviço `evolution-api` ao `docker-compose.dev.yml`, com
      volume nomeado próprio para persistência de sessão.
- [ ] Definir se a Evolution API deste ambiente usa Redis compartilhado ou
      cache próprio; documentar a escolha.
- [ ] Adicionar `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` (chave global de
      administração de instâncias) a `src/config/ambiente.ts` e
      `.env.example`.
- [ ] Adicionar `EVOLUTION_WEBHOOK_SECRET` (segredo compartilhado para
      validar a origem do webhook) a `src/config/ambiente.ts` e
      `.env.example`.
- [ ] Remover de `src/config/ambiente.ts` e `.env.example` as variáveis
      exclusivas da Meta que deixarem de fazer sentido
      (`WHATSAPP_GRAPH_API_URL`, `WEBHOOK_WHATSAPP_APP_SECRET`,
      `WEBHOOK_WHATSAPP_VERIFY_TOKEN`) — confirmar antes se alguma continua
      necessária para outro propósito.
- [ ] Atualizar `README.md` (seção de containers) com o passo de subir e
      configurar a instância Evolution no ambiente local.

## Schema — banco central

- [ ] Revisar `RoteamentoWhatsapp` em `prisma/central/schema.prisma`: trocar
      `phone_number_id` pelo identificador de instância da Evolution API
      (nome de coluna a definir, ex. `instance_name`).
- [ ] Gerar migration central correspondente, validando índice único do novo
      identificador.
- [ ] Atualizar `src/repositories/roteamento-whatsapp.repository.ts` para o
      novo campo.

## Schema — banco de tenant

- [ ] Revisar `ContaWhatsapp` em `prisma/tenant/schema.prisma`: substituir
      `phone_number_id`, `waba_id`, `versao_graph_api`, `token_encrypted` por
      campos compatíveis com Evolution API (ex.: `instance_name`,
      `api_key_encrypted`, e o que for necessário para acompanhar o ciclo de
      vida de conexão do Baileys — `close`/`connecting`/`open`).
- [ ] Revisar o enum `StatusContaWhatsapp` contra os estados reais de conexão
      da Evolution API/Baileys.
- [ ] Gerar migration de tenant correspondente.
- [ ] Atualizar `src/repositories/conta-whatsapp.repository.ts` para os
      novos campos.

## Contrato do webhook

- [ ] Reescrever `src/dtos/webhook-whatsapp.dto.ts` para o formato de evento
      da Evolution API (`event`, `instance`, `data`), substituindo o schema
      atual baseado em `entry[].changes[].value` da Meta.
- [ ] Remover `challengeWhatsappSchema` e a rota
      `GET /api/v1/webhook/whatsapp` se a Evolution API não usar challenge de
      verificação (confirmar).
- [ ] Substituir `src/middlewares/assinatura-webhook.middleware.ts` (HMAC
      `X-Hub-Signature-256`) por uma validação de segredo compartilhado
      (`EVOLUTION_WEBHOOK_SECRET`) — decidir se via header customizado ou
      query, alinhado ao que a instância Evolution permitir configurar.
- [ ] Ajustar `src/helpers/assinatura-webhook.helper.ts` (ou substituí-lo por
      um helper de comparação de segredo em tempo constante).
- [ ] Reescrever `src/services/webhook-whatsapp.service.ts` para o novo
      formato de payload e para resolver o tenant pela instância em vez de
      `phone_number_id`.

## Envio de mensagens

- [ ] Criar `src/services/evolution-api.service.ts`, substituindo
      `src/services/whatsapp-graph-api.service.ts` — chamadas REST à
      Evolution API (`/message/sendText/{instance}` e equivalentes),
      autenticação via header `apikey` em vez de `Authorization: Bearer`.
- [ ] Atualizar `src/services/processador-mensagem-saida.service.ts` para o
      novo serviço de envio.
- [ ] Remover `WHATSAPP_GRAPH_API_URL` e qualquer referência residual à
      Graph API nesse fluxo.

## Conexão e onboarding da conta WhatsApp

- [ ] Reescrever `src/services/conta-whatsapp.service.ts` e
      `src/controllers/conta-whatsapp.controller.ts`: o fluxo deixa de ser
      "colar token da WABA" e passa a ser "criar instância → exibir QR code →
      confirmar conexão".
- [ ] Definir e documentar como o QR code é entregue ao frontend (base64
      inline vs endpoint de polling vs evento WebSocket).
- [ ] Atualizar `src/dtos/conta-whatsapp.dto.ts` para o novo contrato de
      entrada/saída.

## Documentação e OpenAPI

- [ ] Atualizar `src/config/openapi.ts` com os novos schemas/rotas.
- [ ] Reescrever `docs/api/contas-whatsapp.md` para o fluxo de QR code.
- [ ] Reescrever `docs/eventos/webhook-whatsapp.md` para o payload da
      Evolution API.
- [ ] Atualizar `docs/banco-central.md` e `docs/api/REFERENCIA-ENDPOINTS.md`
      onde citam `phone_number_id`/Graph API.
- [ ] Revisar itens já concluídos em `docs/TAREFAS-ESTRUTURA-BASE.md` e
      `docs/TAREFAS-RECURSOS-OPERACIONAIS.md` que mencionam
      `X-Hub-Signature-256`/Meta, registrando a divergência (não reabrir
      checkboxes de etapas já encerradas; anotar nota de contexto).

## Testes

- [ ] Atualizar/reescrever `tests/webhook-whatsapp.test.ts` para o novo
      payload e validação de segredo.
- [ ] Atualizar `tests/services/whatsapp-graph-api.service.test.ts` →
      renomear/reescrever para `evolution-api.service.test.ts`.
- [ ] Atualizar `tests/contas-whatsapp-api.test.ts` para o fluxo de QR code.
- [ ] Atualizar `tests/repositories/estado-fluxo-redis.*` e demais testes que
      dependam indiretamente do formato antigo, se houver.

## Checklist de saída

- [ ] Nenhuma referência funcional a `phone_number_id`/`waba_id`/Graph API
      permanece fora de comentários explicativos de migração.
- [ ] Ambiente local (`docker-compose.dev.yml`) conecta uma instância real
      via QR code e recebe/envia uma mensagem de teste ponta a ponta.
- [ ] Swagger e Markdown funcionais sincronizados com o novo contrato.
- [ ] Testes, lint, typecheck e build aprovados.
- [ ] Branch pronta para revisão e merge.
