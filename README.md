# ZapBot — Backend

Backend da plataforma SaaS multi-tenant de automação de atendimento no
WhatsApp, com editor visual de fluxos, IA e integrações externas.

O projeto está na fase de construção da estrutura base. Consulte:

- [PRD](docs/PRD.md)
- [Arquitetura do backend](docs/ARQUITETURA-BACKEND.md)
- [Diagnóstico inicial](docs/DIAGNOSTICO-INICIAL.md)
- [Tarefas da estrutura base](docs/TAREFAS-ESTRUTURA-BASE.md)
- [Padrão de documentação](docs/README.md)
- [Banco central](docs/banco-central.md)
- [Operação multi-tenant](docs/multitenancy.md)

## Requisitos

- Node.js `20.19.0` ou superior;
- npm compatível com a versão instalada do Node.js.

A versão mínima também está declarada no campo `engines.node` do
`package.json`. Verifique o ambiente:

```bash
node --version
npm --version
```

## Instalação

Em uma cópia nova do repositório, instale exatamente as versões resolvidas no
lockfile:

```bash
npm ci
```

Durante a atualização intencional de dependências, use `npm install` e revise
as alterações em `package-lock.json`.

## Configuração

Crie o arquivo local de ambiente a partir do exemplo:

```bash
cp .env.example .env
```

Substitua todos os valores de exemplo antes de executar a aplicação. O arquivo
`.env` não deve ser versionado.

Variáveis disponíveis no scaffold atual:

| Variável                            | Finalidade                                      |
| ----------------------------------- | ----------------------------------------------- |
| `NODE_ENV`                          | Ambiente: `development`, `test` ou `production` |
| `PORTA`                             | Porta HTTP da API                               |
| `LOG_LEVEL`                         | Nível dos logs estruturados                     |
| `ORIGENS_PERMITIDAS`                | Origens CORS separadas por vírgula              |
| `JWT_INTERNO_SECRET`                | Segredo do JWT interno, mínimo de 32 caracteres |
| `JWT_INTERNO_EXPIRACAO_SEGUNDOS`    | Duração do JWT interno em segundos              |
| `TOTP_CRIPTOGRAFIA_CHAVE`           | Chave AES de 32 bytes representada em 64 hex    |
| `TOTP_INTERNO_OBRIGATORIO`          | Exigência de TOTP; `false` só fora de produção  |
| `CENTRAL_DATABASE_URL`              | Conexão do banco central/admin                  |
| `TENANT_DATABASE_URL`               | Conexão de um tenant para comandos de migration |
| `TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE` | Chave AES das conexões dos tenants              |
| `TENANT_CLIENTES_CACHE_MAXIMO`      | Limite de clients de tenant mantidos no LRU     |
| `HTTP_REQUEST_TIMEOUT_MS`           | Limite para concluir uma requisição             |
| `HTTP_HEADERS_TIMEOUT_MS`           | Limite para receber os headers HTTP             |
| `HTTP_KEEP_ALIVE_TIMEOUT_MS`        | Tempo de keep-alive de uma conexão              |
| `HTTP_SHUTDOWN_TIMEOUT_MS`          | Limite do encerramento gracioso                 |
| `SWAGGER_USUARIO`                   | Usuário do Swagger em produção                  |
| `SWAGGER_SENHA`                     | Senha do Swagger em produção                    |

A aplicação valida as variáveis com Zod durante a inicialização e falha
imediatamente quando uma configuração obrigatória é inválida.

## Execução

Desenvolvimento com recarga automática:

```bash
npm run dev
```

Build e execução da saída compilada:

```bash
npm run build
npm start
```

Com a configuração padrão, a rota pública de saúde fica disponível em:

```text
GET http://localhost:3000/api/v1/saude
```

A rota `GET /api/v1/prontidao` informa se as dependências necessárias estão
disponíveis. Os verificadores de PostgreSQL e Redis serão conectados quando
essas dependências forem adicionadas.

Em desenvolvimento, a documentação fica disponível em:

```text
GET http://localhost:3000/api/v1/docs
GET http://localhost:3000/api/v1/openapi.json
```

As duas rotas exigem autenticação Basic em produção.

## Validação

Execute antes de abrir um pull request:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

Para aplicar a formatação automaticamente:

```bash
npm run format
```

## Scripts

Todos os scripts são executados com `npm run <nome>`.

| Script                      | Finalidade                                                 |
| --------------------------- | ---------------------------------------------------------- |
| `dev`                       | Inicia a API em modo watch.                                |
| `build`                     | Gera os dois clients Prisma e compila o TypeScript.        |
| `start`                     | Executa a saída compilada em `dist/`.                      |
| `lint` / `lint:fix`         | Verifica ou corrige regras estáticas.                      |
| `format` / `format:check`   | Aplica ou verifica o Prettier.                             |
| `typecheck`                 | Valida tipos sem emitir arquivos.                          |
| `test` / `test:watch`       | Executa testes uma vez ou em observação.                   |
| `test:coverage`             | Executa testes com limites de cobertura.                   |
| `prisma:generate`           | Gera os clients central e tenant.                          |
| `prisma:central:generate`   | Gera somente o client do banco central/admin.              |
| `prisma:tenant:generate`    | Gera somente o client dos bancos de tenant.                |
| `db:central:migrate:dev`    | Cria/aplica migration central em desenvolvimento.          |
| `db:central:migrate:deploy` | Aplica migrations centrais pendentes.                      |
| `db:central:seed`           | Cadastra ou atualiza os planos iniciais.                   |
| `db:tenant:migrate:dev`     | Cria migration no schema separado de tenant.               |
| `db:tenant:migrate:deploy`  | Atualiza um banco de tenant específico.                    |
| `db:tenant:migrate:todos`   | Atualiza todos os tenants ativos, tolerando falha isolada. |
| `auth:limpar-refresh`       | Remove refresh tokens expirados do banco central.          |
| `admin:criar`               | Cadastra o primeiro `super_admin` sem senha padrão.        |

Exemplos de infraestrutura central:

```bash
CENTRAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zapbot_central \
npm run db:central:migrate:deploy

CENTRAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zapbot_central \
npm run db:central:seed
```

Exemplos de migrations de tenant:

```bash
TENANT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tenant_modelo \
npm run db:tenant:migrate:dev -- --name adicionar_fluxos

TENANT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tenant_cliente \
npm run db:tenant:migrate:deploy
```

Exemplos operacionais:

```bash
CENTRAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zapbot_central \
TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE=<64-hex> \
npm run db:tenant:migrate:todos

CENTRAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zapbot_central \
npm run auth:limpar-refresh

SUPER_ADMIN_NOME="Administrador" \
SUPER_ADMIN_EMAIL=admin@empresa.com \
SUPER_ADMIN_SENHA='uma-senha-forte-e-unica' \
npm run admin:criar
```

Para desabilitar o TOTP exclusivamente no desenvolvimento local:

```bash
NODE_ENV=development TOTP_INTERNO_OBRIGATORIO=false npm run dev
```

Em produção, a inicialização falha se o TOTP estiver desabilitado.

## Estrutura atual

```text
src/
  config/
  controllers/
  dtos/
  erros/
  middlewares/
  repositories/
  rotas/
  services/
  types/
```

O projeto usa pastas horizontais e segue o fluxo:

```text
Controller -> Service, quando necessário -> Repository
```

Controllers podem chamar Repositories diretamente em CRUD simples. Services
são reservados para regras de negócio, orquestrações, transações complexas e
efeitos colaterais.

## Estado atual

O banco central, as autenticações de tenant e admin com TOTP, os schemas
Prisma separados e a resolução física de conexões estão implementados.
Redis, BullMQ, motor de fluxo, WhatsApp e demais módulos continuam no backlog.

## Fluxo de contribuição

- Cada etapa do backlog usa uma branch própria.
- Cada tarefa concluída é marcada no mesmo commit que entrega a alteração.
- Commits seguem Conventional Commits.
- Mudanças em contratos HTTP devem atualizar Swagger e Markdown funcional.

As instruções completas para agentes estão em [AGENTS.md](AGENTS.md).
