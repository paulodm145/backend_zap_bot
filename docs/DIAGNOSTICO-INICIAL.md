# Diagnóstico inicial do backend

**Data:** 29/07/2026

**Branch analisada:** `chore/estrutura-base`

**Escopo:** estado do repositório antes da continuidade da Etapa 01

## Resumo

O repositório possui uma fundação executável de API e um scaffold de
autenticação interna, mas ainda não implementa o núcleo do produto. Não há
persistência, banco por tenant, autenticação do frontend, filas, Redis, motor de
fluxo, WhatsApp, IA, integrações, WebSocket ou provisionamento.

O código atual demonstra os padrões principais de TypeScript, Zod, Services,
Repositories, erros centralizados, logs e testes. Algumas decisões do scaffold
divergem das orientações consolidadas posteriormente e devem ser resolvidas nas
etapas indicadas neste documento.

## Estrutura encontrada

### Aplicação

- Node.js 20+, Express 5 e TypeScript.
- Aplicação criada em `src/app.ts`.
- Servidor iniciado separadamente em `src/servidor.ts`.
- Configuração de ambiente em `src/config/`.
- Erros e middlewares compartilhados em `src/erros/` e `src/middlewares/`.
- Primeiro módulo funcional em `src/modulos/interno/auth/`.
- Repository temporário em memória em `src/repositories/memoria/`.

### Dependências instaladas

- Runtime: Express, Zod, Pino, Pino HTTP, Helmet, CORS, rate limit,
  jsonwebtoken, bcryptjs e dotenv.
- Desenvolvimento: TypeScript, TSX, ESLint, Prettier, Vitest, Supertest e
  tipos relacionados.

### Testes encontrados

- Testes HTTP da aplicação.
- Testes unitários do serviço de autenticação interna.
- Sete testes existentes, cobrindo saúde, proteção interna, validação, usuário
  inexistente, emissão inicial de token e comportamento inicial de TOTP.

## A. Implementado e alinhado

### Fundação técnica

- Node.js, Express e TypeScript correspondem à stack definida.
- TypeScript está em modo estrito e inclui `noImplicitAny`,
  `strictNullChecks`, `noUncheckedIndexedAccess` e
  `exactOptionalPropertyTypes`.
- Não foi encontrado uso explícito de `any` no código da aplicação.
- Build, lint, formatação, typecheck e testes possuem scripts próprios.
- Aplicação e servidor estão separados, facilitando testes e shutdown.
- A API usa o prefixo `/api/v1`.

### Segurança e configuração

- Variáveis de ambiente são validadas com Zod e falham no boot quando
  inválidas.
- `.env.example` não contém uma credencial funcional.
- Helmet está habilitado.
- CORS usa origens configuradas explicitamente e `credentials: true`.
- O login interno possui rate limit.
- O limite do payload JSON está definido em 1 MB.
- Headers de autorização, cookies, senhas e tokens são redigidos dos logs.
- O JWT interno possui emissor, audiência e escopo exclusivos.
- A rota interna exige Bearer token e não reutiliza o contrato de tenant.

### Padrões de código

- O DTO de login é inferido do schema Zod.
- A nomenclatura do domínio e as mensagens estão majoritariamente em pt-BR.
- A autenticação está em Service porque possui regras e orquestração.
- O acesso a usuário é abstraído por interface de Repository.
- Dependências são injetadas por construtor sem framework de DI.
- Há classes de erro de aplicação capturadas por middleware central.
- O envelope de erro segue `{ erro: { codigo, mensagem } }`.
- O logger é estruturado com Pino.

### Testabilidade

- A factory da aplicação permite teste sem iniciar o processo principal.
- O Service aceita Repository e serviço de token substituíveis.
- Existem testes HTTP e unitários.
- O repository de produção temporário não aceita login, evitando credencial ou
  bypass padrão enquanto não existe banco central.

## B. Implementado com divergência

As divergências abaixo não determinam automaticamente qual lado deve ser
alterado. Cada uma exige decisão na etapa indicada.

### B1. `try/catch` repetido no controller

- **Código atual:** `AutenticacaoInternaController.login` captura erros e chama
  `next`.
- **Arquitetura:** controllers não devem repetir `try/catch`; erros devem ser
  encaminhados ao middleware central.
- **Impacto:** cada novo método assíncrono tende a repetir o mesmo bloco.
- **Etapa relacionada:** 01, criação de wrapper assíncrono.

### B2. Identificador interno como UUID/string

- **Código atual:** `UsuarioInterno.id` é `string`; o JWT valida `sub` como UUID;
  os testes usam UUID.
- **Orientação atual de banco:** toda entidade usa `id` inteiro sequencial e
  UUID somente como `public_id` adicional.
- **Impacto:** o contrato interno e os testes precisarão distinguir `id`
  numérico e `public_id`.
- **Etapa relacionada:** 03 e 05.

### B3. Organização por funcionalidade

- **Código atual:** controller, DTO, middleware, Service e contratos de auth
  ficam agrupados em `src/modulos/interno/auth/`.
- **Estrutura sugerida na arquitetura:** pastas horizontais
  `src/controllers`, `src/services`, `src/repositories`, `src/dtos` e
  `src/middlewares`.
- **Impacto:** ambos suportam MVC + Services + Repositories, mas a localização
  e as regras de importação diferem.
- **Decisão necessária:** manter organização modular por funcionalidade ou
  migrar para a estrutura horizontal antes de criar novos módulos.
- **Etapa relacionada:** 01.
- **Decisão em 29/07/2026:** migrar para pastas horizontais conforme a
  arquitetura documentada.
- **Tratamento:** migração executada na Etapa 01; a árvore ativa agora usa
  `controllers/`, `dtos/`, `middlewares/`, `repositories/`, `rotas/` e
  `services/`.

### B4. Repository temporário na composição de produção

- **Código atual:** a aplicação instancia
  `UsuarioInternoMemoriaRepository`, que sempre retorna `null`.
- **Arquitetura:** autenticação interna consulta usuários reais no
  `central_db`.
- **Impacto:** a API compila e é segura, mas nenhum login interno funciona.
- **Etapa relacionada:** 03 e 05.

### B5. Fluxo TOTP incompleto

- **Código atual:** usuário com TOTP retorna apenas
  `{ exigeSegundoFator: true }`; não há estado temporário, QR code ou endpoint
  de verificação.
- **Arquitetura:** prevê configuração, verificação de seis dígitos e emissão do
  JWT somente após o segundo fator.
- **Impacto:** não existe forma de concluir o login quando TOTP está
  habilitado.
- **Etapa relacionada:** 05.

### B6. Documentação da rota existente

- **Código atual:** existe `POST /api/v1/interno/auth/login` e documentação
  inicial em `docs/admin-interno.md`.
- **Orientação atual:** toda rota deve estar no Swagger e em
  `docs/api/<funcionalidade>.md`, com instruções para o frontend.
- **Impacto:** o contrato ainda não possui fonte OpenAPI nem documento no
  local padronizado.
- **Etapa relacionada:** 02.

### B7. Estrutura de resposta do login interno

- **Código atual:** `accessToken` é opcional no mesmo resultado e o estado TOTP
  é representado apenas por booleano.
- **Arquitetura:** descreve estado intermediário, mas não define seu contrato
  HTTP completo.
- **Impacto:** o frontend interno ainda não tem contrato suficiente para
  diferenciar configuração inicial, desafio TOTP e sessão emitida.
- **Etapa relacionada:** 05; requer decisão de contrato antes da
  implementação.

### B8. Códigos de erro de credencial

- **Código atual interno:** credencial interna inválida usa
  `NAO_AUTENTICADO`.
- **Contrato obrigatório do frontend de tenant:** credencial inválida deve usar
  `CREDENCIAIS_INVALIDAS`.
- **Observação:** são autenticações distintas; não existe conflito obrigatório,
  mas a diferença precisa ser intencional e documentada para os dois
  frontends.
- **Etapa relacionada:** 02, 04 e 05.

## C. Pendente segundo os documentos

### Fundação ainda pendente

- Diagnóstico e decisões sobre as divergências acima.
- Regra de lint contra `console.log`.
- Convenção definitiva de imports e organização de módulos.
- README operacional.
- Identificador de correlação por requisição.
- Rota de prontidão com dependências.
- Timeouts HTTP e tratamento de erros fatais do processo.
- Wrapper assíncrono para controllers.
- Helpers compartilhados e seus testes.
- Cobertura adicional de rota inexistente, erro interno e CORS.
- Meta inicial de cobertura.

### Documentação e contratos

- OpenAPI derivado de Zod.
- Swagger UI em `/api/v1/docs`.
- Proteção do Swagger em produção.
- Documentação funcional em `docs/api/`.
- Catálogo de erros, eventos e schema do fluxo.
- Contrato completo da autenticação interna com TOTP.

### Persistência e multi-tenancy

- Prisma e PostgreSQL.
- Schema e migrations do `central_db`.
- Modelos de usuário, tenant, plano, assinatura, refresh token e auditoria.
- IDs inteiros sequenciais, `public_id` seletivo, timestamps e índices.
- Schema replicável do banco de tenant.
- Criptografia das strings de conexão.
- Gerenciador de conexões com LRU.
- Resolução segura do banco por usuário autenticado.
- Executor de migrations para múltiplos bancos.
- Testes de isolamento físico entre tenants.

### Autenticação

- Login de tenant em `/api/v1/auth/login`.
- Access token curto.
- Refresh token persistido, rotacionado e enviado em cookie seguro.
- `/api/v1/auth/refresh` sem body.
- `/api/v1/auth/logout` com revogação e limpeza do cookie.
- Middleware Bearer para tenants.
- Contrato exato já exigido pelo frontend.
- Repository Prisma de usuário interno.
- TOTP completo para `super_admin`.

### Administração e provisionamento

- Listagem, detalhe, criação, suspensão e alteração de plano de tenants.
- Paginação `skip`/`take` e busca.
- Auditoria de operações sensíveis.
- `TenantProvisioningService` idempotente.
- Criação física do banco do tenant.
- Migration e criação do primeiro administrador.
- Métricas internas da plataforma.

### Núcleo do produto

- Modelos de contas WhatsApp, fluxos, contatos, setores, atendentes,
  conversas, mensagens, credenciais e consumo.
- Redis compartilhado com namespace por tenant.
- BullMQ e workers separados.
- Validação e idempotência do webhook WhatsApp.
- Envio pela WhatsApp Cloud API.
- Motor de validação, publicação, simulação e execução de fluxos.
- Estado de conversa no Redis e snapshot no PostgreSQL.
- Nós de mensagem, captura, condição, IA, integração HTTP e direcionamento.
- LangChain e provedor de LLM.
- Cache e rastreamento de custo da IA.
- Integrações HTTP e credenciais criptografadas.
- Claim atômico de conversa.
- Socket.io, filas por setor e presença de atendentes.
- Uso, métricas e alertas por tenant.

### Infraestrutura e operação

- Dockerfiles e Docker Compose.
- PostgreSQL e Redis locais.
- PM2, NGINX e Bull Board.
- Backups externos e restauração testada.
- GitHub Actions.
- Pipeline de migrations.
- Deploy em VPS.
- Observabilidade e alertas de produção.

## Divergências internas da documentação

Estas diferenças existem entre os próprios documentos e devem ser decididas
antes das etapas afetadas:

### D1. Atendimento humano no MVP

- O PRD, seção 5.7, inclui painel, múltiplos setores e atendentes no MVP.
- O PRD, seção 6, lista “múltiplos agentes humanos com fila de atendimento”
  como fase 2.
- A arquitetura detalha o atendimento humano como parte do sistema.

### D2. Cobrança self-service

- O PRD define onboarding manual como MVP e cobrança self-service como fase 2.
- A arquitetura detalha rotas públicas, Pagar.me e assinatura recorrente sem
  separar claramente sua execução do MVP técnico.

### D3. Identificadores e timestamps nos schemas de exemplo

- As seções antigas de modelo de dados usam `UUID PK` e `criado_em`.
- A seção 13.8, adicionada posteriormente, exige `id` inteiro sequencial,
  `public_id` seletivo, `created_at` e `updated_at`.
- A seção 13.8 declara precedência, mas os exemplos antigos ainda podem induzir
  implementações incorretas.

### D4. Rotas públicas e identificadores

- Os contratos antigos usam parâmetros genéricos `:id`.
- A orientação atual recomenda UUID adicional em rotas públicas quando não for
  adequado expor IDs sequenciais.
- Falta definir, por recurso, quais rotas usam `id` interno e quais usam
  `public_id`.

## Decisões recomendadas antes das próximas etapas

1. Confirmar que tokens carregam `public_id` UUID enquanto relações usam `id`
   inteiro.
2. Definir contrato HTTP completo do fluxo TOTP interno.
3. Resolver o escopo do atendimento humano no MVP.
4. Manter cobrança self-service fora da estrutura base ou incorporá-la ao
   cronograma.
5. Definir a lista de recursos expostos por `public_id`.
6. Atualizar os exemplos antigos de banco após essas decisões.

## Próxima prioridade técnica sem decisão conflitante

Enquanto as decisões acima aguardam confirmação, ainda é seguro concluir itens
neutros da Etapa 01: lint contra `console.log`, README operacional,
correlation ID, prontidão, timeouts, tratamento do processo, helpers e testes
da fundação.
