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

| Variável                                  | Finalidade                                       |
| ----------------------------------------- | ------------------------------------------------ |
| `NODE_ENV`                                | Ambiente: `development`, `test` ou `production`  |
| `PORTA`                                   | Porta HTTP da API                                |
| `API_PORT`                                | Porta da API publicada pelo Docker Compose       |
| `LOG_LEVEL`                               | Nível dos logs estruturados                      |
| `POSTGRES_USER`                           | Usuário do PostgreSQL no Docker Compose          |
| `POSTGRES_PASSWORD`                       | Senha local do PostgreSQL no Docker Compose      |
| `POSTGRES_DB`                             | Banco central criado pelo Docker Compose         |
| `POSTGRES_PORT`                           | Porta do PostgreSQL publicada no host            |
| `REDIS_URL`                               | Conexão Redis usada pela aplicação               |
| `REDIS_PORT`                              | Porta do Redis publicada no host                 |
| `WEBHOOK_WHATSAPP_APP_SECRET`             | App Secret usado para validar a assinatura Meta  |
| `WEBHOOK_WHATSAPP_VERIFY_TOKEN`           | Token privado usado no challenge da Meta         |
| `WEBHOOK_IDEMPOTENCIA_SEGUNDOS`           | Retenção da deduplicação de mensagens no Redis   |
| `ORIGENS_PERMITIDAS`                      | Origens CORS separadas por vírgula               |
| `JWT_INTERNO_SECRET`                      | Segredo do JWT interno, mínimo de 32 caracteres  |
| `JWT_INTERNO_EXPIRACAO_SEGUNDOS`          | Duração do JWT interno em segundos               |
| `TOTP_CRIPTOGRAFIA_CHAVE`                 | Chave AES de 32 bytes representada em 64 hex     |
| `TOTP_INTERNO_OBRIGATORIO`                | Exigência de TOTP; `false` só fora de produção   |
| `CENTRAL_DATABASE_URL`                    | Conexão do banco central/admin                   |
| `TENANT_DATABASE_URL`                     | Conexão de um tenant para comandos de migration  |
| `WHATSAPP_CREDENCIAIS_CRIPTOGRAFIA_CHAVE` | Chave hexadecimal exclusiva para tokens da Meta  |
| `WHATSAPP_GRAPH_API_URL`                  | URL base da Graph API                            |
| `TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE`       | Chave AES das conexões dos tenants               |
| `TENANT_CLIENTES_CACHE_MAXIMO`            | Limite de clients de tenant mantidos no LRU      |
| `POSTGRES_ADMIN_URL`                      | Conexão administrativa para criar bancos físicos |
| `HTTP_REQUEST_TIMEOUT_MS`                 | Limite para concluir uma requisição              |
| `HTTP_HEADERS_TIMEOUT_MS`                 | Limite para receber os headers HTTP              |
| `HTTP_KEEP_ALIVE_TIMEOUT_MS`              | Tempo de keep-alive de uma conexão               |
| `HTTP_SHUTDOWN_TIMEOUT_MS`                | Limite do encerramento gracioso                  |
| `SWAGGER_USUARIO`                         | Usuário do Swagger em produção                   |
| `SWAGGER_SENHA`                           | Senha do Swagger em produção                     |
| `EMAIL_PROVEDOR`                          | `local` para suprimir ou `resend` para enviar    |
| `EMAIL_REMETENTE`                         | Remetente dos e-mails transacionais              |
| `RESEND_API_KEY`                          | Chave obrigatória com provedor Resend            |
| `FRONTEND_URL`                            | Base dos links enviados ao frontend              |
| `RECUPERACAO_SENHA_EXPIRACAO_MINUTOS`     | Validade do token de recuperação                 |

A aplicação valida as variáveis com Zod durante a inicialização e falha
imediatamente quando uma configuração obrigatória é inválida.

## Início rápido com serviços locais

Use este fluxo quando PostgreSQL e Redis já estiverem instalados na máquina.
Todos os comandos devem ser executados na pasta que contém `package.json`:

```bash
cd ~/Projetos/ZapBot/backend_zap_bot
npm ci
cp .env.example .env
```

No `.env`, aponte `CENTRAL_DATABASE_URL` para o banco central,
`TENANT_DATABASE_URL` para o banco tenant modelo e `REDIS_URL` para uma
instância Redis 6.2 ou superior. Nunca versione esse arquivo. Para conferir as
dependências:

```bash
pg_isready -h 127.0.0.1 -p 5432 -U postgres
redis-cli -u redis://127.0.0.1:6379 ping
```

Crie os bancos somente quando eles ainda não existirem:

```bash
PGPASSWORD=postgres createdb -h 127.0.0.1 -p 5432 -U postgres zapbot_central_dev
PGPASSWORD=postgres createdb -h 127.0.0.1 -p 5432 -U postgres zapbot_tenant_modelo
```

Atualize separadamente os bancos central e tenant modelo e cadastre os planos:

```bash
npm run db:central:migrate:deploy
npm run db:central:seed
npm run db:tenant:migrate:deploy
```

Crie o administrador geral. O comando usa `CENTRAL_DATABASE_URL` do `.env`:

```bash
npm run admin:criar -- \
  --nome "Administrador Geral" \
  --email "admin@zapbot.local" \
  --senha 'EscolhaUmaSenhaForte123!'
```

Em localhost, mantenha `NODE_ENV=development` e defina
`TOTP_INTERNO_OBRIGATORIO=false` se quiser testar o painel sem segundo fator.
Inicie a API:

```bash
npm run dev
```

Valide em outro terminal:

```bash
curl http://localhost:3000/api/v1/saude
curl http://localhost:3000/api/v1/prontidao
```

Abra `http://localhost:3000/api/v1/docs/`. O roteiro completo de chamadas está
em [Referência de endpoints](docs/api/REFERENCIA-ENDPOINTS.md). Para encerrar o
servidor em modo watch, pressione `Ctrl+C`.

### Ordem recomendada do primeiro teste

1. Fazer login interno com o administrador geral.
2. Usar o token interno para provisionar um tenant.
3. Fazer login de tenant com o administrador criado no provisionamento.
4. Substituir o token no botão **Authorize** do Swagger.
5. Criar, publicar e simular um fluxo.
6. Testar refresh/logout com um cliente que preserve cookies.

O token interno e o token de tenant têm escopos diferentes. Como o Swagger usa
um único campo Bearer, substitua o valor ao trocar de área. Para autenticação
do frontend, envie `credentials: 'include'` em login, refresh e logout.

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

A rota `GET /api/v1/prontidao` informa se PostgreSQL central e Redis estão
disponíveis. O Compose também condiciona sua inicialização aos healthchecks
dessas dependências.

Em desenvolvimento, a documentação fica disponível em:

```text
GET http://localhost:3000/api/v1/docs
GET http://localhost:3000/api/v1/openapi.json
```

As duas rotas exigem autenticação Basic em produção.

## Ambiente local com containers

Pré-requisitos: Docker Engine com Compose v2 e portas 3000, 5432 e 6379
disponíveis. Prepare o ambiente:

```bash
cp .env.example .env
```

Troque todos os segredos, especialmente `POSTGRES_PASSWORD`, chaves JWT e
chaves hexadecimais de criptografia. Nenhum segredo é definido no Compose.

Suba PostgreSQL, Redis e API:

```bash
docker compose -f docker-compose.dev.yml up --build -d
```

PostgreSQL e Redis precisam ficar saudáveis antes da API iniciar. A API só fica
saudável quando sua rota de prontidão responde com sucesso. Verifique:

```bash
docker compose -f docker-compose.dev.yml ps
curl http://localhost:3000/api/v1/prontidao
```

Na primeira inicialização, aplique as migrations centrais e o seed:

```bash
docker compose -f docker-compose.dev.yml exec api npm run db:central:migrate:deploy
docker compose -f docker-compose.dev.yml exec api npm run db:central:seed
```

Crie o primeiro administrador sem credencial padrão:

```bash
docker compose -f docker-compose.dev.yml exec \
  -e SUPER_ADMIN_NOME="Administrador" \
  -e SUPER_ADMIN_EMAIL="admin@empresa.com" \
  -e SUPER_ADMIN_SENHA="uma-senha-forte-e-unica" \
  api npm run admin:criar
```

Execute verificações dentro do container:

```bash
docker compose -f docker-compose.dev.yml exec api npm run lint
docker compose -f docker-compose.dev.yml exec api npm run typecheck
docker compose -f docker-compose.dev.yml exec api npm test
```

Para observar logs e testar o encerramento gracioso:

```bash
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml stop -t 15 api
```

Suba novamente sem reconstruir para confirmar persistência:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Os volumes `postgres_dados`, `redis_dados` e `api_node_modules` sobrevivem a
`stop` e `down`. A remoção explícita com `down -v` apaga os dados locais e não
deve ser usada sem intenção.

## Validação

O processo de pull request, os checks obrigatórios e a política de cobertura e
vulnerabilidades estão em
[`docs/CONTRIBUICAO.md`](docs/CONTRIBUICAO.md).

Execute antes de abrir um pull request:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

Os testes de integração do worker são habilitados quando um Redis descartável
é informado:

```bash
TEST_REDIS_URL=redis://127.0.0.1:6379 \
npx vitest run tests/workers/worker-retry.integration.test.ts
```

Para aplicar a formatação automaticamente:

```bash
npm run format
```

## Scripts

Todos os scripts são executados com `npm run <nome>`.

| Script                        | Finalidade                                                  |
| ----------------------------- | ----------------------------------------------------------- |
| `dev`                         | Inicia a API em modo watch.                                 |
| `build`                       | Gera os dois clients Prisma e compila o TypeScript.         |
| `start`                       | Executa a saída compilada em `dist/`.                       |
| `lint` / `lint:fix`           | Verifica ou corrige regras estáticas.                       |
| `format` / `format:check`     | Aplica ou verifica o Prettier.                              |
| `typecheck`                   | Valida tipos sem emitir arquivos.                           |
| `test` / `test:watch`         | Executa testes uma vez ou em observação.                    |
| `test:coverage`               | Executa testes com limites de cobertura.                    |
| `prisma:generate`             | Gera os clients central e tenant.                           |
| `prisma:central:generate`     | Gera somente o client do banco central/admin.               |
| `prisma:tenant:generate`      | Gera somente o client dos bancos de tenant.                 |
| `db:central:migrate:dev`      | Cria/aplica migration central em desenvolvimento.           |
| `db:central:migrate:deploy`   | Aplica migrations centrais pendentes.                       |
| `db:central:seed`             | Cadastra ou atualiza os planos iniciais.                    |
| `db:tenant:migrate:dev`       | Cria migration no schema separado de tenant.                |
| `db:tenant:migrate:deploy`    | Atualiza um banco de tenant específico.                     |
| `db:tenant:migrate:todos`     | Atualiza todos os tenants ativos, tolerando falha isolada.  |
| `catalogo:geografia:importar` | Importa estados e municípios da BrasilAPI no banco central. |
| `auth:limpar-refresh`         | Remove refresh tokens expirados do banco central.           |
| `admin:criar`                 | Cadastra um `super_admin` sem senha padrão.                 |

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

Importação completa e idempotente do catálogo geográfico:

```bash
npm run catalogo:geografia:importar
```

Para atualizar somente uma UF (útil em desenvolvimento e diagnóstico):

```bash
npm run catalogo:geografia:importar -- --uf SP
```

O comando usa `CENTRAL_DATABASE_URL`, aceita `BRASIL_API_URL`,
`BRASIL_API_TIMEOUT_MS` e `BRASIL_API_TENTATIVAS`, mostra um resumo em JSON e
termina com código diferente de zero se alguma UF falhar. Execute primeiro
`npm run db:central:migrate:deploy`.

O mesmo administrador pode ser criado com argumentos, usando a conexão central
já configurada no `.env`:

```bash
npm run admin:criar -- \
  --nome "Administrador Geral" \
  --email "admin@zapbot.local" \
  --senha 'EscolhaUmaSenhaForte123!'
```

Use aspas simples ao redor da senha para impedir que o shell interprete
caracteres como `!` e `$`. O comando recusa e-mail duplicado e exige senha com
12 a 128 caracteres. Em ambientes compartilhados, prefira as variáveis de
ambiente para não registrar a senha no histórico do terminal.

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
  helpers/
  middlewares/
  queues/
  repositories/
  rotas/
  services/
  types/
  workers/
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
Prisma separados, a resolução física de conexões, as filas e a entrada segura
do webhook do WhatsApp estão implementados.
Redis, BullMQ, motor de fluxo, WhatsApp e demais módulos continuam no backlog.

## Fluxo de contribuição

- Cada etapa do backlog usa uma branch própria.
- Cada tarefa concluída é marcada no mesmo commit que entrega a alteração.
- Commits seguem Conventional Commits.
- Mudanças em contratos HTTP devem atualizar Swagger e Markdown funcional.

As instruções completas para agentes estão em [AGENTS.md](AGENTS.md).
