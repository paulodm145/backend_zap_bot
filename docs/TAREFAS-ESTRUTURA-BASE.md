# Tarefas da estrutura base

## Como usar este documento

Este arquivo é a fonte de verdade do progresso da estrutura base. Deve ser
atualizado em todas as etapas do projeto.

Estados:

- `[ ]` pendente ou bloqueada;
- `[x]` concluída e validada;
- `Bloqueada: ...` descreve um impedimento sem marcar conclusão.

Regras:

1. Uma etapa corresponde a uma branch.
2. A branch nasce da `main` atualizada.
3. Cada tarefa deve produzir um resultado pequeno e verificável.
4. O checkbox é marcado no mesmo commit semântico da implementação.
5. Uma etapa só pode ser encerrada após cumprir seu checklist de saída.
6. Trabalho descoberto durante a implementação deve ser incluído aqui antes de
   ser executado.
7. Não marcar tarefas futuras por inferência ou implementação parcial.

## Visão das etapas

| Etapa                        | Branch                           | Dependência | Estado    |
| ---------------------------- | -------------------------------- | ----------- | --------- |
| 01. Fundação do repositório  | `chore/estrutura-base`           | Nenhuma     | Concluída |
| 02. OpenAPI e documentação   | `feat/openapi-documentacao-base` | 01          | Concluída |
| 03. Banco central            | `feat/banco-central-prisma`      | 01          | Pendente  |
| 04. Autenticação de tenant   | `feat/autenticacao-tenant`       | 03          | Pendente  |
| 05. Autenticação interna     | `feat/autenticacao-interna`      | 03          | Pendente  |
| 06. Resolução multi-tenant   | `feat/resolucao-multitenant`     | 03 e 04     | Pendente  |
| 07. Administração de tenants | `feat/admin-tenants`             | 05 e 06     | Pendente  |
| 08. Infraestrutura local     | `chore/infraestrutura-local`     | 03 e 06     | Pendente  |
| 09. Filas e idempotência     | `feat/filas-mensageria`          | 06 e 08     | Pendente  |
| 10. Motor de fluxo inicial   | `feat/motor-fluxo-base`          | 06 e 09     | Pendente  |
| 11. CI e qualidade           | `ci/pipeline-qualidade`          | 01 a 10     | Pendente  |

---

## Etapa 01 — Fundação do repositório

Branch: `chore/estrutura-base`

Objetivo: produzir uma API mínima, segura, testável e documentada sobre a qual
os módulos seguintes serão construídos.

### Governança

- [x] Criar `AGENTS.md`.
- [x] Criar `CLAUDE.md`.
- [x] Criar regras modulares em `.claude/rules/`.
- [x] Mover o PRD canônico para `docs/PRD.md`.
- [x] Mover a arquitetura canônica para `docs/ARQUITETURA-BACKEND.md`.
- [x] Criar `docs/README.md` com o padrão documental.
- [x] Criar este backlog atômico.
- [x] Criar a branch `chore/estrutura-base`.
- [x] Revisar o diagnóstico inicial do código contra PRD e arquitetura.
- [x] Registrar divergências encontradas no diagnóstico.

### Projeto Node.js

- [x] Criar `package.json`.
- [x] Definir Node.js 20 ou superior.
- [x] Gerar e versionar `package-lock.json`.
- [x] Configurar execução em desenvolvimento com `tsx`.
- [x] Configurar script de build.
- [x] Configurar script de produção.
- [x] Configurar script de lint.
- [x] Configurar script de formatação.
- [x] Configurar script de checagem de tipos.
- [x] Configurar script de testes.
- [x] Criar `.gitignore`.
- [x] Criar `.prettierignore`.

### TypeScript e estilo

- [x] Ativar `strict`.
- [x] Ativar `noImplicitAny`.
- [x] Ativar `strictNullChecks`.
- [x] Ativar `noUncheckedIndexedAccess`.
- [x] Ativar `exactOptionalPropertyTypes`.
- [x] Configurar build separado em `tsconfig.build.json`.
- [x] Configurar ESLint com regras type-aware.
- [x] Configurar Prettier.
- [x] Impedir `console.log` pelo lint.
- [x] Migrar controllers para `src/controllers/`.
- [x] Migrar services para `src/services/`.
- [x] Migrar contratos e implementações para `src/repositories/`.
- [x] Migrar DTOs para `src/dtos/`.
- [x] Migrar middlewares para `src/middlewares/`.
- [x] Migrar composição de rotas para `src/rotas/`.
- [x] Remover a árvore antiga `src/modulos/`.
- [x] Atualizar imports da aplicação após a migração horizontal.
- [x] Atualizar imports dos testes após a migração horizontal.
- [x] Definir convenção de imports entre camadas horizontais.
- [x] Documentar a versão mínima do Node no README operacional.

### Configuração e observabilidade

- [x] Criar `.env.example` sem segredos reais.
- [x] Validar variáveis de ambiente com Zod.
- [x] Falhar rapidamente quando uma variável obrigatória estiver ausente.
- [x] Criar logger estruturado com Pino.
- [x] Redigir headers e campos sensíveis dos logs.
- [x] Adicionar identificador de correlação por requisição.
- [x] Devolver o identificador de correlação em header de resposta.
- [x] Incluir o identificador de correlação em erros registrados.
- [x] Definir comportamento do logger para testes.

### Aplicação HTTP

- [x] Criar a factory `criarAplicacao`.
- [x] Separar criação da aplicação e inicialização do servidor.
- [x] Desabilitar `x-powered-by`.
- [x] Configurar Helmet.
- [x] Configurar CORS com origens explícitas.
- [x] Configurar `credentials: true`.
- [x] Limitar o tamanho do JSON recebido.
- [x] Criar rota pública de saúde.
- [x] Criar resposta padronizada para rota inexistente.
- [x] Criar encerramento gracioso para `SIGINT`.
- [x] Criar encerramento gracioso para `SIGTERM`.
- [x] Criar rota de prontidão separada da rota de saúde.
- [x] Preparar a prontidão para verificar banco e Redis.
- [x] Configurar timeout do servidor HTTP.
- [x] Configurar tratamento de rejeições não capturadas no processo.

### Validação e erros

- [x] Criar middleware reutilizável de validação Zod.
- [x] Permitir validação de `body`.
- [x] Permitir validação de `params`.
- [x] Permitir validação de `query`.
- [x] Criar `ErroAplicacao`.
- [x] Criar erro de autenticação.
- [x] Criar erro de autorização.
- [x] Criar erro de recurso não encontrado.
- [x] Criar erro de validação.
- [x] Criar middleware central de erros.
- [x] Padronizar envelope `{ erro: { codigo, mensagem } }`.
- [x] Criar wrapper assíncrono para controllers.
- [x] Remover `try/catch` repetido dos controllers existentes.
- [x] Ocultar detalhes internos de erros em produção.

### Helpers compartilhados

- [x] Criar diretório `src/helpers/`.
- [x] Criar helper de normalização de e-mail.
- [x] Criar helper de normalização de telefone em formato canônico.
- [x] Criar helper de conversão entre reais e centavos.
- [x] Criar helper de serialização de datas em UTC.
- [x] Criar testes unitários para cada helper.
- [x] Proibir conversões duplicadas fora dos helpers durante revisão.

### Testes da fundação

- [x] Configurar Vitest.
- [x] Configurar Supertest.
- [x] Testar rota pública de saúde.
- [x] Testar proteção de rota interna.
- [x] Testar validação do login interno.
- [x] Testar credencial interna inexistente.
- [x] Testar serviço inicial de autenticação interna.
- [x] Testar rota inexistente.
- [x] Testar erro interno sem exposição de stack.
- [x] Testar origem CORS permitida.
- [x] Testar origem CORS não permitida.
- [x] Definir meta inicial de cobertura.

### Checklist de saída

- [x] `npm run format:check` aprovado.
- [x] `npm run lint` aprovado.
- [x] `npm run typecheck` aprovado.
- [x] `npm test` aprovado.
- [x] `npm run build` aprovado.
- [x] Documentação da fundação revisada.
- [x] Commits da etapa seguem Conventional Commits.
- [x] Branch pronta para revisão e merge.

---

## Etapa 02 — OpenAPI e documentação funcional

Branch: `feat/openapi-documentacao-base`

Objetivo: estabelecer uma única fonte de verdade para contratos HTTP e um guia
de consumo para o frontend.

### OpenAPI

- [x] Instalar `@asteasolutions/zod-to-openapi`.
- [x] Instalar `swagger-ui-express`.
- [x] Criar extensão central do Zod para OpenAPI.
- [x] Criar registro central de schemas.
- [x] Criar registro central de rotas.
- [x] Definir informações e versão da API.
- [x] Definir servidor local no documento OpenAPI.
- [x] Definir security scheme Bearer JWT.
- [x] Registrar envelope padrão de erro.
- [x] Registrar schema padrão de paginação.
- [x] Documentar rota de saúde.
- [x] Documentar login interno existente.
- [x] Expor JSON OpenAPI.
- [x] Expor Swagger UI em `/api/v1/docs`.
- [x] Proteger Swagger UI em produção.
- [x] Testar geração do documento OpenAPI.
- [x] Testar ausência de schemas duplicados.

### Documentação Markdown

- [x] Criar diretório `docs/api/`.
- [x] Criar `docs/api/autenticacao.md`.
- [x] Documentar contrato de login do tenant.
- [x] Documentar contrato de refresh.
- [x] Documentar contrato de logout.
- [x] Documentar cookie cross-domain.
- [x] Documentar estados da tela de login.
- [x] Documentar comportamento de sessão expirada.
- [x] Criar `docs/api/admin-interno.md`.
- [x] Migrar conteúdo útil de `docs/admin-interno.md`.
- [x] Documentar perfis autorizados no admin interno.
- [x] Documentar estados de carregamento, vazio e erro.
- [x] Adicionar links dos documentos funcionais em `docs/README.md`.

### Checklist de saída

- [x] Swagger reflete os schemas Zod reais.
- [x] Toda rota existente aparece no Swagger.
- [x] Markdown orienta a composição das telas existentes.
- [x] Testes, lint, typecheck e build aprovados.
- [x] Branch pronta para revisão e merge.

---

## Etapa 03 — Banco central

Branch: `feat/banco-central-prisma`

Objetivo: implementar persistência central de usuários, tenants, planos,
assinaturas, refresh tokens e auditoria interna.

### Prisma

- [x] Instalar `prisma`.
- [x] Instalar `@prisma/client`.
- [x] Inicializar schema do `central_db`.
- [x] Configurar `CENTRAL_DATABASE_URL`.
- [x] Criar factory singleton do Prisma central.
- [x] Configurar encerramento do Prisma no shutdown.
- [x] Criar comando de geração do client.
- [x] Criar comando de migration local.
- [x] Criar comando de migration de produção.

### Modelos

- [x] Criar enum de papel do usuário.
- [x] Criar enum de status do tenant.
- [x] Criar enum de status da assinatura.
- [x] Criar modelo `Usuario`.
- [x] Usar `id` inteiro sequencial em `Usuario`.
- [x] Adicionar `public_id` UUID único em `Usuario`.
- [x] Criar modelo `Tenant`.
- [x] Usar `id` inteiro sequencial em `Tenant`.
- [x] Adicionar `public_id` UUID único em `Tenant`.
- [x] Criar modelo `Plano`.
- [x] Criar modelo `Assinatura`.
- [x] Criar modelo `RefreshToken`.
- [x] Criar modelo `AuditoriaInterna`.
- [x] Adicionar `created_at` e `updated_at` em todos os modelos.
- [x] Definir soft delete onde aplicável.
- [x] Criar índice único de e-mail normalizado.
- [x] Criar índices de status do tenant.
- [x] Criar índices de tenant e status da assinatura.
- [x] Criar índice de expiração do refresh token.
- [x] Criar índices de autor e data da auditoria.
- [x] Revisar todos os índices contra consultas planejadas.

### Migration e dados iniciais

- [x] Gerar migration inicial.
- [x] Revisar SQL gerado.
- [x] Confirmar sequences/identity das chaves primárias.
- [x] Confirmar defaults de timestamps.
- [x] Criar seed idempotente de planos.
- [x] Criar comando seguro para cadastrar primeiro `super_admin`.
- [x] Impedir senha ou segredo padrão no seed.
- [x] Documentar setup do banco central.

### Testes

- [x] Criar banco isolado para testes de repository.
- [x] Testar criação e busca de usuário.
- [x] Testar unicidade de e-mail.
- [x] Testar criação de tenant.
- [x] Testar índices essenciais na migration.
- [x] Testar limpeza do banco de teste.

### Checklist de saída

- [x] Migration sobe em banco vazio.
- [x] Migration é aplicável no ambiente de teste.
- [x] Seed é idempotente.
- [x] Schema e documentação estão sincronizados.
- [x] Testes, lint, typecheck e build aprovados.
- [x] Branch pronta para revisão e merge.

---

## Etapa 04 — Autenticação de tenant

Branch: `feat/autenticacao-tenant`

Objetivo: cumprir exatamente o contrato já implementado pelo frontend.

### Domínio e persistência

- [x] Criar repository de usuário central.
- [x] Criar repository de refresh token.
- [x] Criar serviço de hash de senha.
- [x] Criar serviço de access token.
- [x] Criar serviço de refresh token.
- [x] Armazenar apenas hash do refresh token.
- [x] Implementar rotação de refresh token.
- [x] Implementar revogação de família de tokens.
- [x] Registrar expiração e revogação.
- [x] Criar rotina de limpeza de tokens expirados.

### Login

- [x] Criar schema Zod do login.
- [x] Inferir o DTO do schema.
- [x] Normalizar e-mail por helper.
- [x] Implementar `AutenticacaoService.login`.
- [x] Buscar usuário e tenant no `central_db`.
- [x] Bloquear tenant suspenso ou cancelado.
- [x] Comparar senha sem revelar existência do e-mail.
- [x] Emitir access token de curta duração.
- [x] Emitir refresh token de longa duração.
- [x] Configurar cookie `HttpOnly`.
- [x] Configurar cookie `Secure`.
- [x] Configurar cookie `SameSite=None`.
- [x] Configurar cookie `Path=/api/v1/auth`.
- [x] Retornar `{ accessToken, usuario }`.
- [x] Incluir `id`, `nome`, `email` e `tenantId`.
- [x] Retornar `CREDENCIAIS_INVALIDAS` em credencial inválida.

### Refresh e logout

- [x] Implementar `POST /api/v1/auth/refresh` sem body.
- [x] Ler refresh token exclusivamente do cookie.
- [x] Validar expiração, hash e revogação.
- [x] Rotacionar refresh token.
- [x] Renovar cookie.
- [x] Retornar somente `{ accessToken }`.
- [x] Retornar `401` para refresh inválido.
- [x] Implementar `POST /api/v1/auth/logout`.
- [x] Revogar refresh token no servidor.
- [x] Limpar cookie com os mesmos atributos.

### Middleware

- [x] Criar middleware Bearer para tenants.
- [x] Validar assinatura, emissor e audiência.
- [x] Validar expiração do access token.
- [x] Anexar usuário e tenant resolvidos à request.
- [x] Retornar `401` padronizado para token ausente.
- [x] Retornar `401` padronizado para token inválido.
- [x] Não aceitar token interno nas rotas de tenant.

### Testes e documentação

- [x] Testar login válido.
- [x] Testar credencial inválida.
- [x] Testar tenant suspenso.
- [x] Testar atributos exatos do cookie.
- [x] Testar refresh válido.
- [x] Testar rotação de refresh.
- [x] Testar reutilização de token rotacionado.
- [x] Testar refresh expirado.
- [x] Testar logout e revogação.
- [x] Testar limpeza do cookie.
- [x] Testar CORS com credenciais.
- [x] Atualizar Swagger.
- [x] Atualizar `docs/api/autenticacao.md`.

### Checklist de saída

- [x] Contrato do frontend validado por teste de integração.
- [x] Tokens de tenant e internos permanecem isolados.
- [x] Swagger e Markdown sincronizados.
- [x] Testes, lint, typecheck e build aprovados.
- [x] Branch pronta para revisão e merge.

---

## Etapa 05 — Autenticação interna

Branch: `feat/autenticacao-interna`

Objetivo: substituir o repository temporário e concluir autenticação segura do
`super_admin`.

### Repository e login

- [x] Criar repository Prisma de usuário interno.
- [x] Remover repository em memória da composição de produção.
- [x] Manter repository em memória apenas como test double.
- [x] Consultar usuário por e-mail normalizado.
- [x] Validar papel `super_admin`.
- [x] Validar usuário ativo.
- [x] Emitir token com audiência exclusiva do admin.
- [x] Manter rate limit do login interno.

### TOTP

- [x] Selecionar biblioteca TOTP.
- [x] Criar serviço de geração do segredo.
- [x] Criptografar segredo TOTP em repouso.
- [x] Criar QR code de configuração.
- [x] Criar estado temporário do login antes do segundo fator.
- [x] Implementar verificação do código TOTP.
- [x] Impedir reutilização indevida do estado temporário.
- [x] Emitir JWT interno somente após segundo fator.
- [x] Registrar códigos de recuperação como fora do escopo até aprovação.

### Testes e documentação

- [x] Testar login interno com repository Prisma.
- [x] Testar usuário sem papel.
- [x] Testar usuário inativo.
- [x] Testar fluxo de configuração TOTP.
- [x] Testar código TOTP inválido.
- [x] Testar separação entre token interno e token de tenant.
- [x] Atualizar Swagger.
- [x] Atualizar `docs/api/admin-interno.md`.

### Checklist de saída

- [x] Nenhuma credencial interna padrão existe.
- [x] Segundo fator funciona de ponta a ponta.
- [x] Swagger e Markdown sincronizados.
- [x] Testes, lint, typecheck e build aprovados.
- [x] Branch pronta para revisão e merge.

---

## Etapa 06 — Resolução multi-tenant

Branch: `feat/resolucao-multitenant`

Objetivo: resolver e gerenciar com segurança a conexão física de cada tenant.

### Credenciais

- [x] Definir formato criptografado da conexão do tenant.
- [x] Validar chave de criptografia no ambiente.
- [x] Criar helper criptográfico com versionamento de payload.
- [x] Criar serviço de criptografia.
- [x] Testar criptografia e descriptografia.
- [x] Garantir que conexões não apareçam em logs.

### Gerenciador de conexões

- [x] Definir interface do gerenciador de conexões.
- [x] Criar client Prisma dinâmico por banco.
- [x] Criar cache limitado de clients.
- [x] Implementar política LRU.
- [x] Atualizar uso do client a cada acesso.
- [x] Fechar client removido do cache.
- [x] Evitar abertura duplicada concorrente.
- [x] Fechar todos os clients no shutdown.
- [x] Configurar limite máximo por ambiente.
- [x] Registrar métricas sem expor credenciais.

### Middleware e contexto

- [x] Criar contexto tipado do tenant.
- [x] Resolver tenant pelo token autenticado.
- [x] Buscar metadados no banco central.
- [x] Rejeitar tenant inativo.
- [x] Obter conexão exclusivamente dos metadados centrais.
- [x] Anexar repository/client do tenant à request.
- [x] Impedir escolha do banco por header, query ou body.

### Schema do banco do tenant

- [x] Criar schema Prisma separado do tenant.
- [x] Usar IDs inteiros sequenciais.
- [x] Adicionar `public_id` onde houver exposição pública.
- [x] Adicionar `created_at` e `updated_at` em todas as tabelas.
- [x] Criar modelos iniciais de conta WhatsApp.
- [x] Criar modelos iniciais de fluxo.
- [x] Criar modelos iniciais de contato.
- [x] Criar modelos iniciais de setor e atendente.
- [x] Criar modelos iniciais de conversa e mensagem.
- [x] Criar modelos iniciais de credencial e uso.
- [x] Definir índices a partir dos contratos de consulta.

### Migrations multi-tenant

- [x] Criar executor de migration para um banco.
- [x] Criar executor para todos os tenants ativos.
- [x] Registrar sucesso por tenant.
- [x] Registrar falha por tenant.
- [x] Continuar após falha isolada.
- [x] Retornar resumo do processo.
- [x] Impedir execução concorrente da mesma migration.
- [x] Testar dois bancos de tenant isolados.
- [x] Testar ausência de vazamento entre tenants.

### Decisões complementares

- [x] Separar schema e migrations do banco central/admin.
- [x] Separar schema e migrations dos bancos de tenant.
- [x] Criar scripts independentes de migration central.
- [x] Criar scripts independentes de migration de tenant.
- [x] Documentar todos os scripts do projeto no README com exemplos.
- [x] Permitir desabilitar TOTP somente em localhost.
- [x] Impedir TOTP desabilitado em produção.
- [x] Resolver tenant pelo e-mail autenticado, nunca por subdomínio.

### Checklist de saída

- [x] Isolamento entre dois tenants comprovado por testes.
- [x] Cache LRU validado.
- [x] Migration multi-tenant tolera falha isolada.
- [x] Documentação de operação atualizada.
- [x] Testes, lint, typecheck e build aprovados.
- [x] Branch pronta para revisão e merge.

---

## Etapa 07 — Administração de tenants

Branch: `feat/admin-tenants`

Objetivo: criar a primeira funcionalidade operacional do painel interno.

### Listagem

- [ ] Criar schema Zod de paginação.
- [ ] Criar helper/repository base de paginação.
- [ ] Limitar `take` ao máximo configurado.
- [ ] Criar repository de tenants.
- [ ] Criar busca por nome.
- [ ] Criar filtro por status.
- [ ] Criar filtro por plano.
- [ ] Criar ordenação permitida por allowlist.
- [ ] Criar índice para a consulta de listagem.
- [ ] Implementar `GET /api/v1/interno/tenants`.
- [ ] Retornar `dados`, `total`, `skip` e `take`.

### Detalhe e alterações

- [ ] Implementar busca por `public_id`.
- [ ] Implementar detalhe do tenant.
- [ ] Implementar alteração de status.
- [ ] Implementar alteração manual de plano.
- [ ] Criar confirmação de regras no Service.
- [ ] Registrar auditoria de alteração de status.
- [ ] Registrar auditoria de alteração de plano.
- [ ] Testar acesso exclusivo de `super_admin`.

### Provisionamento

- [ ] Definir estados do provisionamento.
- [ ] Criar `TenantProvisioningService`.
- [ ] Criar registro central idempotente.
- [ ] Gerar nome seguro e único do banco.
- [ ] Criar banco físico.
- [ ] Aplicar migration do tenant.
- [ ] Criar primeiro administrador do tenant.
- [ ] Registrar cada etapa.
- [ ] Permitir retomada após falha.
- [ ] Evitar duplicação em retry.
- [ ] Criar compensações aprovadas para falhas.

### Frontend e documentação

- [ ] Documentar colunas da tela de listagem.
- [ ] Documentar busca, filtros e paginação.
- [ ] Documentar estados vazio e carregando.
- [ ] Documentar ações e confirmações.
- [ ] Documentar progresso do provisionamento.
- [ ] Documentar erros recuperáveis e não recuperáveis.
- [ ] Atualizar Swagger.
- [ ] Atualizar `docs/api/tenants.md`.

### Checklist de saída

- [ ] Listagem paginada usa índices adequados.
- [ ] Alterações sensíveis geram auditoria.
- [ ] Provisionamento suporta retry.
- [ ] Swagger e Markdown sincronizados.
- [ ] Testes, lint, typecheck e build aprovados.
- [ ] Branch pronta para revisão e merge.

---

## Etapa 08 — Infraestrutura local

Branch: `chore/infraestrutura-local`

Objetivo: permitir execução reproduzível da base em ambiente local.

### Containers

- [ ] Criar Dockerfile de desenvolvimento.
- [ ] Criar Dockerfile de produção multi-stage.
- [ ] Criar `.dockerignore`.
- [ ] Criar `docker-compose.dev.yml`.
- [ ] Adicionar PostgreSQL.
- [ ] Adicionar Redis.
- [ ] Adicionar API.
- [ ] Configurar healthcheck do PostgreSQL.
- [ ] Configurar healthcheck do Redis.
- [ ] Configurar healthcheck da API.
- [ ] Criar volumes nomeados.
- [ ] Evitar segredos no Compose versionado.

### Operação

- [ ] Documentar subida do ambiente.
- [ ] Documentar execução de migrations.
- [ ] Documentar criação do primeiro super admin.
- [ ] Documentar execução de testes.
- [ ] Testar inicialização a partir de ambiente limpo.
- [ ] Testar encerramento gracioso em container.

### Checklist de saída

- [ ] Ambiente sobe com um comando documentado.
- [ ] API fica pronta somente após dependências.
- [ ] Dados persistem entre reinicializações.
- [ ] Testes, lint, typecheck e build aprovados.
- [ ] Branch pronta para revisão e merge.

---

## Etapa 09 — Filas e idempotência

Branch: `feat/filas-mensageria`

Objetivo: estabelecer Redis, BullMQ e o recebimento seguro de mensagens.

### Redis e filas

- [ ] Criar conexão Redis validada.
- [ ] Criar nomes de fila centralizados.
- [ ] Criar factory de filas.
- [ ] Criar factory de workers.
- [ ] Incluir identidade do tenant em todo job.
- [ ] Definir tentativas e backoff padrão.
- [ ] Definir retenção de jobs concluídos.
- [ ] Definir retenção de jobs com falha.
- [ ] Fechar filas e workers no shutdown.

### Webhook WhatsApp

- [ ] Criar rota de challenge.
- [ ] Criar validação de `X-Hub-Signature-256`.
- [ ] Preservar raw body para validar assinatura.
- [ ] Criar schema do payload suportado.
- [ ] Resolver tenant por `phone_number_id`.
- [ ] Criar chave de idempotência namespacada.
- [ ] Impedir processamento duplicado.
- [ ] Responder rapidamente ao webhook.
- [ ] Enfileirar mensagem recebida.
- [ ] Não executar lógica pesada no controller.

### Testes e documentação

- [ ] Testar assinatura válida.
- [ ] Testar assinatura inválida.
- [ ] Testar evento duplicado.
- [ ] Testar isolamento de chaves por tenant.
- [ ] Testar retry com backoff.
- [ ] Atualizar Swagger.
- [ ] Criar `docs/eventos/webhook-whatsapp.md`.

### Checklist de saída

- [ ] Webhook responde dentro da meta local definida.
- [ ] Duplicidade não gera dois jobs.
- [ ] Jobs identificam tenant explicitamente.
- [ ] Swagger e Markdown sincronizados.
- [ ] Testes, lint, typecheck e build aprovados.
- [ ] Branch pronta para revisão e merge.

---

## Etapa 10 — Motor de fluxo inicial

Branch: `feat/motor-fluxo-base`

Objetivo: validar, publicar e executar o núcleo determinístico do grafo antes de
adicionar IA e integrações externas.

### Contratos

- [ ] Criar enums dos tipos de nó.
- [ ] Criar schema Zod do nó de mensagem.
- [ ] Criar schema Zod do nó de captura.
- [ ] Criar schema Zod do nó de condição.
- [ ] Criar schema Zod do nó de direcionamento.
- [ ] Criar união discriminada dos nós.
- [ ] Criar schema da definição do fluxo.
- [ ] Versionar o schema do fluxo.
- [ ] Não usar `eval` em condições.

### Validação do grafo

- [ ] Validar existência do nó inicial.
- [ ] Validar unicidade dos IDs dos nós.
- [ ] Validar referências `proximo`.
- [ ] Validar referências de condição.
- [ ] Validar alcançabilidade.
- [ ] Detectar ciclos não permitidos.
- [ ] Validar setor referenciado.
- [ ] Retornar erros por nó e campo.
- [ ] Testar grafo mínimo válido.
- [ ] Testar cada classe de grafo inválido.

### Persistência e publicação

- [ ] Criar repository de fluxos.
- [ ] Criar fluxo como rascunho.
- [ ] Atualizar somente rascunho.
- [ ] Criar versão imutável publicada.
- [ ] Executar validação antes de publicar.
- [ ] Usar transação na publicação.
- [ ] Criar índices de listagem de fluxos.
- [ ] Implementar soft delete.

### Execução

- [ ] Definir contrato do estado da conversa.
- [ ] Namespacar estado Redis por tenant.
- [ ] Carregar versão publicada.
- [ ] Executar nó de mensagem.
- [ ] Executar nó de captura.
- [ ] Executar condição com parser seguro.
- [ ] Executar direcionamento para setor.
- [ ] Persistir snapshot do estado.
- [ ] Limitar quantidade de passos por execução.
- [ ] Tratar nó desconhecido como erro de domínio.

### API e documentação

- [ ] Implementar listagem paginada de fluxos.
- [ ] Implementar detalhe por `public_id`.
- [ ] Implementar criação.
- [ ] Implementar atualização.
- [ ] Implementar publicação.
- [ ] Implementar simulação sem WhatsApp real.
- [ ] Documentar composição da lista de fluxos.
- [ ] Documentar editor e erros por nó.
- [ ] Documentar estados de publicação.
- [ ] Atualizar Swagger.
- [ ] Criar `docs/api/fluxos.md`.
- [ ] Criar `docs/schemas/fluxo-json.md`.

### Checklist de saída

- [ ] Grafo inválido nunca é publicado.
- [ ] Execução possui limite contra loop infinito.
- [ ] Versão publicada é imutável.
- [ ] Swagger e Markdown sincronizados.
- [ ] Testes, lint, typecheck e build aprovados.
- [ ] Branch pronta para revisão e merge.

---

## Etapa 11 — CI e qualidade

Branch: `ci/pipeline-qualidade`

Objetivo: tornar automáticas as validações exigidas para merge.

### Pipeline

- [ ] Criar workflow do GitHub Actions.
- [ ] Fixar versão do Node.
- [ ] Usar `npm ci`.
- [ ] Executar `format:check`.
- [ ] Executar lint.
- [ ] Executar typecheck.
- [ ] Executar testes.
- [ ] Executar build.
- [ ] Subir PostgreSQL de serviço para testes.
- [ ] Subir Redis de serviço para testes.
- [ ] Aplicar migrations no banco de teste.
- [ ] Publicar relatório de cobertura.
- [ ] Configurar cache seguro do npm.

### Controles de qualidade

- [ ] Definir cobertura mínima inicial.
- [ ] Falhar CI quando Swagger não puder ser gerado.
- [ ] Validar que migrations estão versionadas.
- [ ] Validar ausência de arquivos `.env`.
- [ ] Validar dependências vulneráveis conforme política definida.
- [ ] Documentar checks obrigatórios de pull request.
- [ ] Criar template de pull request.
- [ ] Incluir checklist de Swagger.
- [ ] Incluir checklist de Markdown funcional.
- [ ] Incluir checklist de atualização deste backlog.

### Checklist de saída

- [ ] Pipeline passa em branch limpa.
- [ ] Pipeline detecta falha proposital de lint.
- [ ] Pipeline detecta falha proposital de teste.
- [ ] Processo de contribuição está documentado.
- [ ] Branch pronta para revisão e merge.

---

## Backlog posterior à estrutura base

Os itens abaixo pertencem ao produto, mas só devem ser decompostos em etapas
atômicas quando a estrutura base estiver estável:

- nó de IA com LangChain e controle de custo;
- nó de integração HTTP com credenciais criptografadas;
- envio de mensagens pela WhatsApp Cloud API;
- atendimento humano e claim atômico;
- Socket.io e presença de atendentes;
- métricas de uso por tenant;
- cobrança e webhook do gateway;
- Bull Board protegido;
- backup e estratégia de restauração;
- deploy de produção e observabilidade externa.
