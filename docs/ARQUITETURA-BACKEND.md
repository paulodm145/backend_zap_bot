# Documento de Arquitetura — Plataforma de Automação de WhatsApp com IA

> Documento canônico da arquitetura do backend.

**Autor:** Paulo Roberto
**Versão:** 1.0
**Data:** Julho/2026
**Referência:** PRD v1.0 (aprovado)

---

## 1. Visão geral

Sistema multi-tenant onde cada tenant (cliente do SaaS) desenha fluxos de atendimento de WhatsApp através de um editor visual, que são executados por um motor de interpretação de fluxo. O motor combina lógica condicional, chamadas a LLM (IA) e integrações HTTP externas (ERP/CRM), com possibilidade de transferência para atendimento humano segmentado por setor.

### 1.1 Diagrama de componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL (Frontend)                       │
│  ┌───────────────────┐  ┌───────────────────┐  ┌──────────────┐ │
│  │  Editor de Fluxo   │  │  Painel Atendente │  │  Dashboard/   │ │
│  │  (React Flow)      │  │  (chat + fila)    │  │  Admin Tenant │ │
│  └───────────────────┘  └───────────────────┘  └──────────────┘ │
└───────────────────────────────┬───────────────────────────────────┘
                                 │ HTTPS (REST) + WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        VPS (Backend)                             │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  NGINX (reverse proxy + SSL/certbot)                        │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                                ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  API Node.js + Express + TypeScript (PM2)                   │  │
│  │  - Auth / gestão de tenants, fluxos, contatos, setores       │  │
│  │  - Webhook receiver (WhatsApp Cloud API)                     │  │
│  │  - WebSocket server (painel de atendente em tempo real)      │  │
│  └───────┬────────────────────────────────────────┬────────────┘  │
│          │ enfileira job                          │ lê/escreve    │
│          ▼                                        ▼               │
│  ┌───────────────────┐                    ┌──────────────────┐   │
│  │  Redis             │                    │  PostgreSQL      │   │
│  │  - Filas (BullMQ)  │                    │  - Dados         │   │
│  │  - Sessão/estado   │                    │    relacionais   │   │
│  │  - Cache de IA     │                    │  - JSONB fluxos  │   │
│  └─────────┬──────────┘                    └──────────────────┘   │
│            │                                                       │
│            ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Workers (BullMQ consumers, processos separados via PM2)     │  │
│  │  - Motor de execução de fluxo                                │  │
│  │  - Chamada a LangChain / LLM (Bedrock ou API direta)          │  │
│  │  - Chamada a integrações HTTP externas (ERP/CRM)              │  │
│  │  - Envio de resposta via WhatsApp Cloud API                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Bull Board (monitoramento de filas) — rota protegida         │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  WhatsApp Cloud API     │
                    │  (Meta)                 │
                    └────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  APIs externas          │
                    │  (ERP, CRM, etc.)       │
                    │  — por tenant           │
                    └────────────────────────┘
```

## 2. Stack tecnológica consolidada

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | React + Next.js, deploy Vercel | SSR para dashboard/landing, DX rápida |
| Editor de fluxo | React Flow | Padrão de mercado para canvas node-based |
| Backend API | Node.js + Express + TypeScript | Stack já dominada, tipagem forte |
| ORM | Prisma | Migrations e tipagem integrada ao TS |
| Banco de dados | PostgreSQL (um banco por tenant + banco central de usuários) | JSONB indexável para fluxos, isolamento físico entre clientes |
| Pool de conexões | PgBouncer (quando o nº de tenants crescer) | Multiplexa conexões de múltiplos bancos sem sobrecarregar o Postgres |
| Cache / estado de sessão | Redis | Estado de conversa em tempo real, cache de IA |
| Filas | BullMQ (sobre Redis) | Sem serviço adicional, leve para VPS único |
| Monitoramento de filas | Bull Board | Visual, gratuito, leve |
| IA | LangChain.js + AWS Bedrock (ou API direta Anthropic/OpenAI) | Flexibilidade de modelo, custo controlado |
| WhatsApp | Cloud API oficial (Meta) | Onboarding manual por tenant (sem Tech Provider no MVP) |
| Tempo real (painel atendente) | WebSocket (Socket.io) | Necessário para fila e chat ao vivo |
| Processo/deploy backend | Docker Compose + PM2 | Isolamento de serviços, fácil migração de VPS |
| Proxy/SSL | NGINX + certbot | Padrão já usado em outros projetos |
| Chamadas HTTP externas | `fetch` nativo | Preferência já estabelecida, sem dependência extra |

## 3. Arquitetura de infraestrutura

- **Frontend**: hospedado na Vercel, consumindo a API via subdomínio dedicado (`api.dominio.com`), evitando problemas de CORS/cookie cross-domain.
- **Backend**: único VPS (Contabo/Hetzner), rodando via Docker Compose:
  - Container/processo API (Express)
  - Container/processo Worker (BullMQ consumers)
  - PostgreSQL (container ou instalação nativa)
  - Redis (container ou instalação nativa)
  - NGINX (proxy reverso, roteando `/` para API, `/admin/queues` para Bull Board)
- **Backups**: `pg_dump` agendado (cron) enviado para armazenamento externo (Backblaze B2 ou S3 barato), retenção mínima de 7-14 dias.
- **Variáveis sensíveis**: `.env` fora do controle de versão; chave de criptografia de credenciais de tenant gerada e armazenada separadamente (não no mesmo backup do banco, se possível).

## 4. Arquitetura de aplicação (camadas)

```
Camada de API (Express)
  ├─ Controllers (rotas REST: tenants, flows, contacts, teams, agents)
  ├─ Webhook Controller (recebe mensagens do WhatsApp, valida assinatura, enfileira job)
  └─ WebSocket Gateway (eventos de conversa em tempo real para o painel)

Camada de domínio/serviço
  ├─ FlowEngineService (interpreta JSON do fluxo, decide próximo nó)
  ├─ AIService (integração LangChain, prompt building, memória)
  ├─ IntegrationService (chamadas HTTP externas, autenticação por tenant)
  ├─ RoutingService (direcionamento para setor, claim de atendente)
  └─ UsageTrackingService (registra consumo de IA/mensageria por tenant)

Camada de acesso a dados
  ├─ Prisma (PostgreSQL)
  └─ Redis client (estado de sessão, filas, cache)

Workers (processos separados, mesma base de código)
  ├─ Consumer: processar-mensagem-recebida
  ├─ Consumer: enviar-mensagem-whatsapp
  └─ Consumer: executar-integracao-externa (com retry/backoff)
```

## 5. Fluxo de mensagens (sequência detalhada)

1. WhatsApp Cloud API envia webhook (POST) para a API com a mensagem recebida.
2. API valida a assinatura do webhook (segurança), identifica o tenant pelo `phone_number_id`, e **responde 200 imediatamente**.
3. API enfileira job `processar-mensagem-recebida` no BullMQ com payload (tenant, contato, conteúdo).
4. Worker consome o job:
   a. Recupera estado atual da conversa no Redis (nó atual do fluxo, variáveis).
   b. `FlowEngineService` decide o próximo passo com base no nó atual e na mensagem recebida.
   c. Se o nó for de IA → `AIService` monta prompt + contexto + memória, chama o LLM (com cache de resposta no Redis quando aplicável).
   d. Se o nó for de integração → `IntegrationService` chama a API externa do tenant, trata sucesso/falha.
   e. Se o nó for de direcionamento para setor → `RoutingService` muda status da conversa para `aguardando_atendente`, define `team_id`, notifica painel via WebSocket.
5. Worker enfileira job `enviar-mensagem-whatsapp` com a resposta a ser enviada.
6. Consumer de envio chama a Cloud API do WhatsApp e persiste a mensagem em `conversation_messages`.
7. `UsageTrackingService` registra custo estimado (tokens de IA, tipo de mensagem) em `usage_logs`.

## 6. Modelo de dados detalhado (schema replicado em cada banco de tenant)

> Nota: com a decisão de banco físico separado por tenant (seção 7), as tabelas abaixo não carregam mais `tenant_id` — cada tenant tem sua própria instância completa deste schema. O banco central (`central_db`), com `users` e `tenants`, está detalhado na seção 7.1.

```sql
whatsapp_accounts (
  id UUID PK,
  phone_number_id VARCHAR,
  waba_id VARCHAR,
  access_token_criptografado TEXT,
  criado_em TIMESTAMP
)

flows (
  id UUID PK,
  nome VARCHAR,
  definicao JSONB,        -- nós e conexões
  status ENUM('rascunho','publicado'),
  versao INT,
  atualizado_em TIMESTAMP
)

contacts (
  id UUID PK,
  telefone VARCHAR,
  nome VARCHAR,
  criado_em TIMESTAMP
)

teams (
  id UUID PK,
  nome VARCHAR,
  criado_em TIMESTAMP
)

agents (
  id UUID PK,
  nome VARCHAR,
  email VARCHAR,
  senha_hash VARCHAR,
  status_online BOOLEAN,
  criado_em TIMESTAMP
)

agent_teams (
  agent_id UUID FK -> agents,
  team_id UUID FK -> teams,
  PRIMARY KEY (agent_id, team_id)
)

conversations (
  id UUID PK,
  contact_id UUID FK -> contacts,
  status ENUM('bot','aguardando_atendente','com_atendente','encerrada'),
  team_id UUID FK -> teams NULL,
  assigned_agent_id UUID FK -> agents NULL,
  flow_id UUID FK -> flows,
  atualizado_em TIMESTAMP
)

conversation_messages (
  id UUID PK,
  conversation_id UUID FK -> conversations,
  remetente ENUM('contato','bot','agente'),
  agent_id UUID FK -> agents NULL,
  conteudo TEXT,
  criado_em TIMESTAMP
)

tenant_credentials (
  id UUID PK,
  nome_integracao VARCHAR,
  tipo_auth ENUM('api_key','bearer','basic','oauth2'),
  valor_criptografado TEXT,
  criado_em TIMESTAMP
)

usage_logs (
  id UUID PK,
  tipo ENUM('ia_tokens','mensagem_whatsapp'),
  quantidade INT,
  custo_estimado_centavos INT,
  criado_em TIMESTAMP
)
```

**Estado de conversa em tempo real** (nó atual do fluxo, variáveis capturadas) vive no **Redis** como estrutura chave-valor (`conversation:{id}:state`), com snapshot periódico ou no encerramento gravado em `conversations`/`conversation_messages` para histórico permanente.

## 7. Isolamento multi-tenant — banco de dados separado por tenant

**Decisão de arquitetura**: cada tenant tem seu próprio banco PostgreSQL, isolado fisicamente (não é isolamento lógico via `tenant_id` em tabelas compartilhadas). Identificação do tenant é feita por **e-mail** no login (não por subdomínio).

### 7.1 Banco central (`central_db`)

Único banco compartilhado entre todos os tenants, responsável apenas por autenticação e metadados de conexão:

```sql
central_db.users (
  id UUID PK,
  email VARCHAR UNIQUE,
  senha_hash VARCHAR,
  tenant_id UUID FK -> tenants,
  criado_em TIMESTAMP
)

central_db.tenants (
  id UUID PK,
  nome VARCHAR,
  nome_do_banco VARCHAR,        -- identificador do banco físico do tenant
  string_conexao_criptografada TEXT,
  plano VARCHAR,
  status ENUM('ativo','suspenso','cancelado'),
  criado_em TIMESTAMP
)

central_db.roteamentos_whatsapp (
  id INTEGER PK SEQUENCIAL,
  tenant_id INTEGER FK -> tenants,
  phone_number_id VARCHAR UNIQUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

`roteamentos_whatsapp` é um índice técnico mínimo para resolver webhooks antes
de abrir qualquer banco de tenant. Ele não armazena access token, WABA,
credenciais ou dados de conversa. Esses dados permanecem exclusivamente em
`contas_whatsapp`, no banco físico do tenant. O vínculo central deve ser
criado ou atualizado junto ao onboarding manual da conta WhatsApp.

### 7.2 Banco por tenant (`tenant_<id>`)

Réplica do schema completo descrito na seção 6 (`whatsapp_accounts`, `flows`, `contacts`, `teams`, `agents`, `conversations`, etc.) — cada tenant tem sua própria instância dessas tabelas, sem `tenant_id` nas colunas (não é mais necessário, já que o isolamento é físico).

### 7.3 Fluxo de resolução de conexão

```
1. Usuário faz login com e-mail/senha
2. API consulta central_db.users → obtém tenant_id
3. API consulta central_db.tenants → obtém string de conexão do banco daquele tenant
4. API abre/reaproveita conexão com o banco do tenant (via pool gerenciado)
5. Todas as queries da sessão usam essa conexão específica
```

Webhooks não possuem e-mail autenticado. Nesse caso específico, a API consulta
`central_db.roteamentos_whatsapp` pelo `phone_number_id`, obtém o tenant e só
então acessa seu banco físico. Subdomínio e valores de conexão enviados pelo
cliente nunca participam dessa resolução.

### 7.4 Gerenciamento de conexões (ponto crítico)

Com N tenants, não é viável manter um pool de conexão aberto permanentemente para cada banco — o Postgres tem limite prático de conexões simultâneas por instância (~100 por padrão). Estratégia:

- **Pool com política LRU**: gerenciador de conexões na aplicação mantém um cache de pools ativos (ex: últimos 20-30 tenants usados recentemente), fechando o menos usado quando o limite é atingido e abrindo sob demanda para o tenant que fizer a próxima requisição.
- **PgBouncer** na frente do Postgres, em modo transaction pooling, para multiplexar conexões de múltiplos bancos sem sobrecarregar o Postgres diretamente — recomendado assim que o número de tenants ativos crescer além de dezenas.

### 7.5 Migrations em múltiplos bancos

Prisma Migrate não aplica automaticamente uma migration em N bancos dinâmicos. Solução: script de deploy próprio que:
1. Lê a lista de tenants ativos em `central_db.tenants`.
2. Para cada tenant, roda `prisma migrate deploy` apontando para a string de conexão daquele banco.
3. Loga sucesso/falha por tenant (falha em um tenant não deve travar os demais — registrar e alertar).

Esse script roda como parte do pipeline de deploy do backend (seção 11), depois do deploy do código, antes de considerar o release concluído.

### 7.6 Credenciais e segurança

- Credenciais de integrações externas (`tenant_credentials`) e tokens de WhatsApp (`whatsapp_accounts`) continuam criptografados em repouso, agora dentro do próprio banco do tenant.
- A string de conexão de cada tenant (`central_db.tenants.string_conexao_criptografada`) também é criptografada, com chave de aplicação separada e nunca versionada no código.
- Redis: chaves de sessão/fila namespacadas por tenant (`tenant:{id}:...`) para evitar colisão entre clientes — o isolamento físico do Postgres não se estende ao Redis, que continua compartilhado.

### 7.7 MongoDB — decisão

Avaliado e **descartado** para este projeto. O ganho do Mongo (schema flexível por tenant, sem migration) já é resolvido pelo script de migration por tenant (7.5) e pelo uso de `JSONB` nos campos que variam (ex: `flows.definicao`). Manter apenas Postgres evita duplicar responsabilidade de banco de dados e reduz a carga operacional no VPS único.

## 8. Roteamento e distribuição de conversas (detalhe técnico)

Claim atômico de conversa por um atendente, evitando concorrência:

```sql
UPDATE conversations
SET assigned_agent_id = :agent_id, status = 'com_atendente'
WHERE id = :conversation_id
  AND team_id = :agent_team_id
  AND assigned_agent_id IS NULL;
```

Se a instrução afetar 0 linhas, outro atendente já assumiu — o painel recebe erro e atualiza a lista automaticamente (via WebSocket).

## 9. Segurança

- Autenticação do painel: JWT (access + refresh token), por tenant e por agente.
- Validação de assinatura do webhook do WhatsApp (`X-Hub-Signature-256`) antes de processar qualquer payload.
- Rate limiting na API pública (por IP e por tenant) para mitigar abuso.
- Criptografia de credenciais sensíveis (tenant_credentials, tokens de WhatsApp) com biblioteca nativa (`crypto`/libsodium), chave fora do repositório de código.
- Bull Board protegido por autenticação básica (não exposto publicamente sem senha).

## 10. Observabilidade e custo

- `usage_logs` alimenta um painel de consumo por tenant (tokens de IA, mensagens fora da janela de 24h).
- Alertas simples (e-mail ou notificação no painel) quando um tenant ultrapassa X% do limite do plano.
- Logs de aplicação centralizados (mínimo: arquivos rotacionados via PM2/logrotate no MVP; evoluir para serviço externo tipo Better Stack/Axiom se necessário).

## 11. Estratégia de deploy

- Repositório único (monorepo) com `apps/api`, `apps/worker` (ou pastas dentro do mesmo backend), `apps/frontend` (Next.js na Vercel).
- CI simples via GitHub Actions: lint + testes + build; deploy do backend via SSH/rsync ou Docker Compose pull no VPS; deploy do frontend automático pela integração Vercel-GitHub.
- Ambientes: local (docker-compose.dev.yml) e produção (docker-compose.prod.yml).
- Após o deploy do código no VPS, roda o **script de migration multi-tenant** (seção 7.5): itera sobre `central_db.tenants` ativos e aplica `prisma migrate deploy` em cada banco individualmente, registrando falhas por tenant sem interromper os demais.

## 12. Considerações de escalabilidade futura

- Se o VPS único se tornar gargalo: separar Postgres/Redis para instâncias dedicadas antes de escalar a API horizontalmente.
- BullMQ permite múltiplos workers consumindo a mesma fila — escalar workers primeiro é mais simples que escalar a API.
- Migração para cloud gerenciada (RDS/Elasticache) só quando o custo operacional justificar frente ao ganho de disponibilidade/autoscaling.

## 13. Padrões de backend (MVC + Services + Repositories)

### 13.1 Camadas e responsabilidades

```
Controller  → recebe request, valida entrada (DTO), chama Service OU Repository, formata resposta
Service     → usado SOMENTE quando há lógica de negócio não trivial (regras, orquestração entre
              múltiplos repositories, chamadas externas, transações complexas)
Repository  → acesso a dados (Prisma), um repository por entidade/agregado, sem lógica de negócio
```

**Regra prática de quando pular o Service**: se o controller só precisa fazer um CRUD direto (criar, buscar por id, listar paginado, atualizar, remover) sem regra de negócio adicional, ele chama o `Repository` diretamente. O `Service` só entra quando há decisão, orquestração ou efeito colateral (ex: `RoutingService` decidindo setor, `AIService` montando prompt, `IntegrationService` chamando ERP externo).

### 13.2 Estrutura de pastas sugerida

```
src/
  controllers/
    flow.controller.ts
    conversation.controller.ts
    ...
  services/
    routing.service.ts
    ai.service.ts
    integration.service.ts
    usage-tracking.service.ts
  repositories/
    flow.repository.ts
    contact.repository.ts
    conversation.repository.ts
    ...
  dtos/
    flow/
      criar-fluxo.dto.ts
      listar-fluxos-query.dto.ts
  middlewares/
    auth.middleware.ts
    error-handler.middleware.ts
    tenant-resolver.middleware.ts
  errors/
    dominio.error.ts
    nao-encontrado.error.ts
    validacao.error.ts
  utils/
  types/
```

### 13.3 Convenções de código

- **Idioma padrão do projeto: pt-br** — nomes de entidades, variáveis, métodos de domínio e mensagens de erro em português (`buscarFluxoPorId`, `criarConversa`, `SetorNaoEncontradoError`). Palavras-chave da linguagem e termos técnicos amplamente consolidados em inglês permanecem em inglês (`Controller`, `Repository`, `Request`, `Response`) — mistura natural que já é padrão na comunidade JS/TS brasileira.
- **TypeScript estrito**: `strict: true` no `tsconfig.json`, incluindo `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`. Proibido uso de `any` — quando o tipo é genuinamente desconhecido, usar `unknown` e validar/narrow antes de usar.
- **Nomes descritivos**: variáveis e funções com nome que explica intenção, sem abreviação obscura (`quantidadeMensagens` em vez de `qtdMsg`, `atendenteResponsavel` em vez de `resp`).
- **Funções pequenas e de responsabilidade única** — se um método de service passa de ~30-40 linhas ou mistura mais de uma responsabilidade, é sinal de que deve ser quebrado.
- **Imutabilidade por padrão**: preferir `const`, evitar mutação de parâmetros recebidos; usar spread/novos objetos ao transformar dados.
- **Sem lógica de negócio em controller nem em repository** — controller orquestra chamada, repository só fala com o banco.

### 13.4 Validação de entrada (DTOs)

Usar **Zod** para validar payloads de entrada (body, query params) e derivar o tipo TypeScript automaticamente do schema — evita duplicar validação e tipagem manualmente, e elimina a tentação de usar `any` em dados vindos de fora:

```typescript
import { z } from 'zod';

export const criarFluxoSchema = z.object({
  nome: z.string().min(1),
  definicao: z.record(z.unknown()),
});

export type CriarFluxoDTO = z.infer<typeof criarFluxoSchema>;
```

### 13.5 Paginação server-side (skip/take + busca)

Padrão único reaproveitado em todos os endpoints de listagem, no formato já usado nos projetos Laravel do autor:

```typescript
interface PaginacaoQuery {
  skip?: number;   // default 0
  take?: number;   // default 20, máximo configurável (ex: 100)
  busca?: string;  // opcional, aplicado via ILIKE/contains no(s) campo(s) relevante(s)
}

interface PaginacaoResultado<T> {
  dados: T[];
  total: number;
  skip: number;
  take: number;
}
```

Implementado uma vez como método genérico no repositório base (`RepositoryBase.paginar()`), reaproveitado por todos os repositories concretos, garantindo que todo endpoint de listagem tenha o mesmo contrato.

### 13.6 Tratamento de erros

- Classes de erro de domínio (`DominioError`, `NaoEncontradoError`, `ValidacaoError`), cada uma com `statusCode` associado.
- Middleware único de tratamento de erro no Express, que captura essas classes e formata a resposta HTTP de forma consistente — controllers não fazem `try/catch` repetitivo, apenas lançam o erro (`throw new NaoEncontradoError('Fluxo não encontrado')`).

### 13.7 Outras boas práticas sugeridas

- **ESLint + Prettier** com config compartilhada no monorepo, rodando no CI (falha o build se houver violação) — evita revisão manual de estilo.
- **Logs estruturados** (ex: `pino`) em vez de `console.log`, com nível (info/warn/error) e contexto (tenant, conversationId) — facilita depurar produção.
- **Validação de variáveis de ambiente na inicialização** (schema Zod para `.env`) — a aplicação falha rápido e com mensagem clara se faltar uma variável, em vez de quebrar em produção no meio de uma requisição.
- **Idempotência no processamento de webhook**: o WhatsApp pode reenviar o mesmo evento; usar um identificador único da mensagem para evitar processar/duplicar a mesma mensagem duas vezes.
- **Soft delete** (`deletado_em` nullable) em vez de `DELETE` físico nas entidades principais (fluxos, contatos, conversas) — facilita auditoria e recuperação de erro operacional.
- **Testes automatizados focados nas camadas de Service e Repository** (Vitest ou Jest) — não é necessário cobrir 100%, mas a lógica de roteamento, claim de conversa e motor de fluxo merecem teste, por serem o núcleo de risco do produto.
- **Conventional Commits** (`feat:`, `fix:`, `refactor:`) — ajuda a manter changelog legível e facilita automação futura de versionamento.
- **Injeção de dependência simples via construtor** (sem framework de DI pesado tipo InversifyJS) — mantém a simplicidade pedida, mas já permite trocar implementação em teste (mock de repository no service, por exemplo).

### 13.8 Padrões de banco de dados

As regras abaixo são obrigatórias e substituem os exemplos anteriores deste
documento que representam a chave primária como UUID:

- Toda tabela possui `id` inteiro, sequencial, como chave primária. Em
  PostgreSQL, usar coluna identity/sequence; no Prisma, usar
  `id Int @id @default(autoincrement())`.
- Quando uma entidade for identificada em rota pública e não for apropriado
  expor o valor sequencial, adicionar `public_id UUID UNIQUE` como identificador
  externo. O UUID é adicional e não substitui a chave primária inteira.
- Toda tabela, incluindo tabelas associativas, possui `created_at` e
  `updated_at`. Os valores são armazenados em UTC.
- Colunas utilizadas recorrentemente em `WHERE`, `JOIN`, `ORDER BY`, busca e
  resolução de unicidade devem possuir índices coerentes com a consulta.
- Índices compostos devem seguir a ordem efetiva dos filtros e ordenação.
  Consultas críticas devem ser avaliadas com `EXPLAIN` ou `EXPLAIN ANALYZE`
  quando houver dados representativos.
- Não criar índices especulativos ou redundantes: cada índice precisa
  corresponder a uma consulta ou restrição conhecida e seu custo de escrita
  deve ser considerado.

Exemplo de referência no Prisma:

```prisma
model Fluxo {
  id         Int      @id @default(autoincrement())
  public_id  String   @unique @default(uuid()) @db.Uuid
  nome       String
  status     String
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([status, updated_at])
  @@map("flows")
}
```

### 13.9 Helpers de conversão

- Conversões e normalizações reutilizáveis devem ficar em `src/helpers/` ou em
  um módulo comum equivalente.
- Helpers devem ser funções puras, estritamente tipadas, pequenas e cobertas
  por testes unitários.
- Controllers, services e repositories não devem duplicar conversões de datas,
  moeda/centavos, telefones, booleanos, enums externos ou serialização.
- Dados externos continuam sendo validados com Zod. Um helper de conversão não
  deve aceitar silenciosamente um valor inválido.
- Conversões com possibilidade de falha devem retornar resultado explícito ou
  lançar uma classe de erro adequada ao domínio.

## 14. Contratos de API (REST)

Convenção geral: prefixo `/api/v1`, autenticação via JWT (header `Authorization: Bearer`), respostas de listagem sempre no formato `PaginacaoResultado<T>` (seção 13.5), erros sempre no formato:

```json
{ "erro": { "codigo": "NAO_ENCONTRADO", "mensagem": "Fluxo não encontrado" } }
```

### 14.1 Autenticação

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/auth/login` | Recebe e-mail/senha, resolve tenant no `central_db`, retorna JWT |
| POST | `/api/v1/auth/refresh` | Renova access token a partir do refresh token |
| POST | `/api/v1/auth/logout` | Invalida refresh token |

### 14.2 Fluxos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/fluxos?skip=&take=&busca=` | Lista fluxos do tenant (paginado) |
| GET | `/api/v1/fluxos/:id` | Detalha um fluxo (inclui `definicao` completa) |
| POST | `/api/v1/fluxos` | Cria fluxo (rascunho) |
| PUT | `/api/v1/fluxos/:id` | Atualiza `definicao` (mantém como rascunho) |
| POST | `/api/v1/fluxos/:id/publicar` | Publica a versão atual (valida integridade do grafo antes) |
| POST | `/api/v1/fluxos/:id/simular` | Executa o fluxo em modo teste, sem enviar mensagem real ao WhatsApp |
| DELETE | `/api/v1/fluxos/:id` | Soft delete |

### 14.3 Contatos e conversas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/contatos?skip=&take=&busca=` | Lista contatos do tenant |
| GET | `/api/v1/conversas?status=&setor_id=&skip=&take=` | Lista conversas (fila do setor, minhas conversas, encerradas) |
| GET | `/api/v1/conversas/:id/mensagens?skip=&take=` | Histórico de mensagens de uma conversa |
| POST | `/api/v1/conversas/:id/assumir` | Claim atômico (seção 8) — atendente assume a conversa |
| POST | `/api/v1/conversas/:id/encerrar` | Encerra atendimento humano, devolve ao bot ou finaliza |
| POST | `/api/v1/conversas/:id/mensagens` | Atendente envia mensagem manual dentro da conversa |

### 14.4 Setores e atendentes

| Método | Rota | Descrição |
|---|---|---|
| GET / POST | `/api/v1/setores` | Lista / cria setores (times) |
| GET / POST | `/api/v1/atendentes` | Lista / cria atendentes |
| POST | `/api/v1/atendentes/:id/setores` | Vincula atendente a um ou mais setores |
| PATCH | `/api/v1/atendentes/:id/status` | Atualiza status online/ausente |

### 14.5 Integrações externas

| Método | Rota | Descrição |
|---|---|---|
| GET / POST | `/api/v1/integracoes` | Lista / cadastra credenciais de integração (`tenant_credentials`) |
| DELETE | `/api/v1/integracoes/:id` | Remove credencial |

### 14.6 Webhook (WhatsApp)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/webhook/whatsapp` | Verificação do webhook (challenge da Meta) |
| POST | `/api/v1/webhook/whatsapp` | Recebe eventos de mensagem; valida assinatura, resolve tenant pelo `phone_number_id`, garante idempotência (seção 13.7) e enfileira job |

### 14.7 Eventos WebSocket (painel de atendente)

| Evento | Direção | Payload | Descrição |
|---|---|---|---|
| `conversa:nova_na_fila` | servidor → cliente | `{ conversaId, setorId }` | Nova conversa aguardando atendimento no setor |
| `conversa:assumida` | servidor → cliente | `{ conversaId, atendenteId }` | Notifica demais atendentes que a conversa já tem dono (remove da fila visível) |
| `conversa:mensagem_recebida` | servidor → cliente | `{ conversaId, mensagem }` | Nova mensagem em conversa que o atendente tem aberta |
| `atendente:status` | servidor → cliente | `{ atendenteId, statusOnline }` | Atualiza indicador de presença |

## 15. Schema do JSON de definição de fluxo (`flows.definicao`)

Estrutura de grafo (nós + conexões), interpretada pelo `FlowEngineService`:

```json
{
  "schemaVersao": 1,
  "noInicial": "no_1",
  "nos": [
    {
      "id": "no_1",
      "tipo": "mensagem",
      "dados": { "texto": "Olá! Como posso ajudar?" },
      "proximo": "no_2"
    },
    {
      "id": "no_2",
      "tipo": "captura_resposta",
      "dados": { "variavel": "escolha_menu" },
      "proximo": "no_3"
    },
    {
      "id": "no_3",
      "tipo": "condicao",
      "dados": {
        "regras": [
          { "se": "escolha_menu == '1'", "entao": "no_setor_fiscal" },
          { "se": "escolha_menu == '2'", "entao": "no_setor_financeiro" }
        ],
        "padrao": "no_ia_fallback"
      }
    },
    {
      "id": "no_ia_fallback",
      "tipo": "ia",
      "dados": {
        "promptSistema": "Você é um assistente do escritório X...",
        "modelo": "haiku",
        "usarMemoria": true
      },
      "proximo": "no_integracao_erp"
    },
    {
      "id": "no_integracao_erp",
      "tipo": "integracao_http",
      "dados": {
        "credencialId": "cred_erp_123",
        "metodo": "GET",
        "url": "https://api.erp.com/pedidos/{{numero_pedido}}",
        "mapeamentoResposta": { "status_pedido": "$.data.status" }
      },
      "sucesso": "no_responde_status",
      "falha": "no_transfere_humano"
    },
    {
      "id": "no_setor_fiscal",
      "tipo": "direcionar_setor",
      "dados": { "setorId": "setor_fiscal_uuid" }
    }
  ]
}
```

**Regras de validação antes de publicar** (executadas em `POST /fluxos/:id/publicar`):
- Todo nó referenciado em `proximo`/`sucesso`/`falha`/`entao`/`padrao` deve existir em `nos`.
- Não pode haver nó órfão (inalcançável a partir de `noInicial`).
- Nós do tipo `integracao_http` devem referenciar uma `credencialId` existente no tenant.
- Nós do tipo `direcionar_setor` devem referenciar um `setorId` existente no tenant.

O registro `fluxos.definicao` é o rascunho editável. Cada publicação cria,
transacionalmente, uma linha imutável em `fluxo_versoes`, com número sequencial
por fluxo. O motor carrega a versão publicada, nunca o rascunho. Condições da
versão 1 aceitam apenas comparações `==` e `!=` entre variável e texto,
interpretadas por parser próprio; não há uso de `eval`.

## 16. Documentação da API

**Decisão**: gerar o **Swagger/OpenAPI automaticamente a partir dos mesmos schemas Zod** já usados para validação de entrada (seção 13.4), complementado por **arquivos Markdown** para o que o Swagger não cobre bem (fluxos, WebSocket, regras de negócio). Evita manter contrato duplicado (validação de um lado, documentação manual do outro, sempre dessincronizando).

### 16.1 Swagger via Zod (fonte única de verdade)

Biblioteca: `@asteasolutions/zod-to-openapi` + `swagger-ui-express`. Cada schema Zod ganha metadados de documentação direto na definição:

```typescript
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
extendZodWithOpenApi(z);

export const criarFluxoSchema = z.object({
  nome: z.string().min(1).openapi({ example: 'Atendimento Fiscal' }),
  definicao: z.record(z.unknown()).openapi({ description: 'JSON do grafo de nós (ver seção 15)' }),
}).openapi('CriarFluxoDTO');
```

Um registro central (`openapi-registry.ts`) coleta todos os schemas + rotas (método, path, request, response, exemplos de erro) e gera o documento OpenAPI no boot da aplicação. Exposto em `/api/v1/docs` (Swagger UI) — protegido por autenticação básica em produção, já que revela a estrutura interna da API.

**Vantagem prática**: quando um DTO muda (ex: adiciona campo obrigatório em `criarFluxoSchema`), a documentação atualiza automaticamente no próximo deploy, sem trabalho manual e sem risco de ficar desatualizada.

### 16.2 Regras de autenticação documentadas

No Swagger, cada rota protegida declara o `securityScheme` (Bearer JWT). Além disso, documentar em Markdown (`docs/api/autenticacao.md`) o que o OpenAPI não expressa bem:
- Fluxo completo de resolução de tenant por e-mail (seção 7.3)
- Duração de access token vs refresh token e política de renovação
- Formato padrão de erro de autenticação (401 vs 403, quando cada um ocorre)

### 16.3 O que fica em Markdown (fora do Swagger)

OpenAPI não representa bem fluxos assíncronos e eventos em tempo real. Ficam documentados em `docs/`:
- `docs/eventos/webhook-whatsapp.md` — formato do payload recebido da Meta, regra de idempotência (seção 13.7), como testar localmente (ex: via ngrok)
- `docs/eventos/websocket.md` — tabela da seção 14.7 detalhada, com payload de exemplo de cada evento e ordem esperada (ex: `conversa:nova_na_fila` sempre antes de `conversa:assumida`)
- `docs/schemas/fluxo-json.md` — versão detalhada da seção 15, com todos os tipos de nó e exemplos completos
- `docs/erros/codigos.md` — tabela de todos os códigos de erro (`NAO_ENCONTRADO`, `VALIDACAO`, `SETOR_INVALIDO`, etc.) com significado e status HTTP correspondente

### 16.4 Ciclo de vida da documentação

- Swagger é gerado em tempo de execução (sempre reflete o código atual) — sem passo manual de build.
- Arquivos Markdown em `docs/` versionados junto ao código, revisados como parte do PR que introduz a mudança (regra de time: PR que adiciona/altera webhook, evento WebSocket ou tipo de nó de fluxo precisa atualizar o `.md` correspondente).

### 16.5 Documentação orientada ao frontend

Toda rota deve ser documentada tanto no Swagger/OpenAPI quanto em Markdown
organizado por funcionalidade em `docs/api/`.

- O Swagger é o contrato executável e deriva dos schemas Zod: método, rota,
  autenticação, parâmetros, schemas, exemplos, respostas e erros.
- O Markdown agrupa os endpoints consumidos pela mesma tela ou jornada e
  explica como o frontend deve combiná-los.
- Cada documento funcional descreve permissões, sequência de chamadas, campos
  para listas/detalhes/formulários, validações, paginação, busca, filtros,
  ordenação, estados vazio/carregando/erro/sucesso, confirmações e atualizações
  via WebSocket ou polling.
- Campos opcionais, nullable, enums, datas, valores monetários e diferenças por
  perfil devem ser explícitos.
- Decisões puramente visuais continuam sob responsabilidade do frontend; a
  documentação do backend fornece os dados, estados e comportamentos
  necessários para compor as telas.
- Consulte `docs/README.md` para a estrutura e o modelo dos documentos.

Swagger e Markdown devem ser atualizados no mesmo trabalho que modificar o
contrato. A tarefa não está concluída se apenas uma das duas fontes tiver sido
atualizada.

### 16.6 Commits semânticos

O histórico segue Conventional Commits:

```text
<tipo>(<escopo-opcional>): <descrição curta no imperativo>
```

Tipos usuais: `feat`, `fix`, `refactor`, `docs`, `test`, `build`, `ci`,
`chore`, `perf`, `style` e `revert`. Mudanças incompatíveis usam `!` e o rodapé
`BREAKING CHANGE:`. Cada commit deve representar uma unidade lógica e evitar
mensagens genéricas.

## 17. Provisionamento de tenants e faturamento

### 17.1 Modelo de dados adicional no `central_db`

```sql
central_db.planos (
  id UUID PK,
  nome VARCHAR,               -- Free, Starter, Pro, Enterprise
  limite_conversas_mes INT,
  preco_centavos INT,
  ativo BOOLEAN
)

central_db.assinaturas (
  id UUID PK,
  tenant_id UUID FK -> tenants,
  plano_id UUID FK -> planos,
  status ENUM('aguardando_pagamento','ativa','inadimplente','cancelada','manual'),
  gateway_assinatura_id VARCHAR NULL,   -- id da assinatura/transação no gateway de pagamento
  proxima_cobranca TIMESTAMP NULL,
  criado_em TIMESTAMP
)
```

`status = 'manual'` cobre onboarding feito diretamente pelo painel administrativo interno (sem cobrança automatizada); `'aguardando_pagamento'` é o estado transitório do cadastro self-service antes da confirmação do checkout.

### 17.2 Rotas públicas de cadastro (sem autenticação)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/publico/planos` | Lista os planos disponíveis para contratação (nome, preço, limites) |
| POST | `/api/v1/publico/cadastro` | Recebe dados da empresa/admin + `plano_id` escolhido. Cria tenant e usuário em status `aguardando_pagamento` (ainda sem banco físico) e retorna a **URL do checkout hospedado** gerada na API do Pagar.me (com `tenant_id` no metadata da transação) |
| GET | `/api/v1/publico/cadastro/:tenantId/status` | Consulta o status do provisionamento (`aguardando_pagamento`, `provisionando`, `ativa`) — usado pelo frontend para polling na tela de confirmação pós-checkout |

### 17.3 Webhook de pagamento

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/webhook/pagamento` | Recebido do Pagar.me. Identifica o tenant pelo metadata da transação e, em caso de confirmação, aciona o `TenantProvisioningService` para concluir o provisionamento (etapas 2-4 da seção 17.4). Em caso de falha/cancelamento, mantém o tenant em `aguardando_pagamento` ou marca como `cancelada` após expiração |

Regra de expiração: cadastros em `aguardando_pagamento` sem confirmação após X dias (ex: 3 dias) são marcados como `cancelada` por um job agendado, liberando o e-mail para novo cadastro.

### 17.4 `TenantProvisioningService`

Serviço único responsável por orquestrar a criação de um tenant, reaproveitado tanto pelo cadastro self-service (fase 1 do processo em `/publico/cadastro`, fase 2 acionada pelo webhook de pagamento) quanto pelo painel administrativo interno (criação manual, seção 18):

```
1. [self-service] Criar registro em central_db.tenants (status 'aguardando_pagamento') e central_db.users
   [manual] Criar registro em central_db.tenants (status 'manual') e central_db.users diretamente
2. Criar o banco de dados físico do tenant (nome_do_banco único)
   — no caminho self-service, só executado após confirmação do webhook de pagamento
3. Rodar `prisma migrate deploy` nesse banco (reaproveita o script da seção 7.5)
4. Ativar a assinatura (status 'ativa') e disparar e-mail de confirmação/boas-vindas com acesso
```

Cada etapa deve ser idempotente e logada individualmente — falha no meio do processo (ex: erro ao criar banco físico após pagamento já confirmado) não deve deixar o tenant em estado inconsistente; o serviço registra em qual etapa parou para permitir retomada automática (retry do job) ou intervenção manual via painel interno.

### 17.5 Integração de pagamento — detalhes

- Gateway: Pagar.me, usando o recurso de **link/checkout hospedado** (não um formulário de cartão embutido na própria aplicação) — reduz escopo de segurança e tempo de implementação no MVP.
- Assinatura recorrente (cobrança automática dos meses seguintes) usa o recurso de assinaturas do próprio Pagar.me; o webhook (`17.3`) também trata eventos de renovação (sucesso/falha) para manter `assinaturas.status` atualizado ao longo do tempo, não só na contratação inicial.
- Regra de negócio: tenant com assinatura `inadimplente` além de X dias tem o acesso suspenso automaticamente (`tenants.status = 'suspenso'`), sem apagar dados — reversível ao regularizar.

## 18. Painel administrativo interno (dono do SaaS)

Ambiente separado do painel de cada tenant — acesso restrito à equipe operadora da plataforma, autenticado contra `central_db.users` com um flag de papel (`super_admin`), não vinculado a nenhum tenant específico.

### 18.1 Endpoints (prefixo `/api/v1/interno`, protegido por papel `super_admin`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/interno/tenants?skip=&take=&busca=` | Lista todos os tenants, plano e status |
| POST | `/interno/tenants` | Aciona o `TenantProvisioningService` (criação manual — fase 1) |
| PATCH | `/interno/tenants/:id/status` | Suspende/reativa um tenant |
| PATCH | `/interno/tenants/:id/plano` | Altera plano manualmente |
| GET | `/interno/tenants/:id/uso` | Consumo agregado (IA, mensageria) do tenant, lido de `usage_logs` no banco daquele tenant |
| GET | `/interno/metricas` | Visão geral: nº de tenants ativos, consumo agregado de infraestrutura |

### 18.2 Consideração de segurança

- Este painel nunca deve ficar acessível no mesmo domínio/rota pública usada pelos tenants — subpath dedicado (`/interno`) com política de autenticação distinta (papel `super_admin`, idealmente com 2FA já no MVP, dado o nível de acesso).
- Ações sensíveis (suspender tenant, alterar plano) devem ser logadas com autor e timestamp (`auditoria_interna`), para rastreabilidade.

### 18.3 Autenticação de dois fatores (2FA) para acesso interno

Implementação via TOTP (`speakeasy` ou `otpauth`), compatível com Google Authenticator/Authy:

| Método | Rota | Descrição |
|---|---|---|
| POST | `/interno/auth/login` | E-mail/senha do `super_admin`; se 2FA já configurado, retorna estado intermediário exigindo código |
| POST | `/interno/auth/2fa/configurar` | Gera segredo TOTP + QR code (primeira configuração) |
| POST | `/interno/auth/2fa/verificar` | Valida o código de 6 dígitos e emite o JWT de sessão interna |

- `central_db.users` ganha os campos `totp_secret_criptografado` e `totp_habilitado` (apenas relevantes para usuários com papel `super_admin`).
- JWT do painel interno é emitido com escopo próprio (claim `papel: 'super_admin'`), verificado por um middleware dedicado (`autenticacaoInterna.middleware.ts`), nunca aceito nas rotas do tenant e vice-versa.

---

**Próximo passo sugerido:** iniciar o schema Prisma (baseado nas seções 6, 7 e 17) e o esqueleto do `FlowEngineService`, já validando o schema de fluxo apresentado na seção 15.
