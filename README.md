# ZapBot — Backend

Backend da plataforma SaaS multi-tenant de automação de atendimento no
WhatsApp, com editor visual de fluxos, IA e integrações externas.

O projeto está na fase de construção da estrutura base. Consulte:

- [PRD](docs/PRD.md)
- [Arquitetura do backend](docs/ARQUITETURA-BACKEND.md)
- [Diagnóstico inicial](docs/DIAGNOSTICO-INICIAL.md)
- [Tarefas da estrutura base](docs/TAREFAS-ESTRUTURA-BASE.md)
- [Padrão de documentação](docs/README.md)

## Requisitos

- Node.js `20.0.0` ou superior;
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

| Variável                         | Finalidade                                      |
| -------------------------------- | ----------------------------------------------- |
| `NODE_ENV`                       | Ambiente: `development`, `test` ou `production` |
| `PORTA`                          | Porta HTTP da API                               |
| `LOG_LEVEL`                      | Nível dos logs estruturados                     |
| `ORIGENS_PERMITIDAS`             | Origens CORS separadas por vírgula              |
| `JWT_INTERNO_SECRET`             | Segredo do JWT interno, mínimo de 32 caracteres |
| `JWT_INTERNO_EXPIRACAO_SEGUNDOS` | Duração do JWT interno em segundos              |
| `HTTP_REQUEST_TIMEOUT_MS`        | Limite para concluir uma requisição             |
| `HTTP_HEADERS_TIMEOUT_MS`        | Limite para receber os headers HTTP             |
| `HTTP_KEEP_ALIVE_TIMEOUT_MS`     | Tempo de keep-alive de uma conexão              |
| `HTTP_SHUTDOWN_TIMEOUT_MS`       | Limite do encerramento gracioso                 |
| `SWAGGER_USUARIO`                | Usuário do Swagger em produção                  |
| `SWAGGER_SENHA`                  | Senha do Swagger em produção                    |

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

O scaffold possui saúde da API e uma base isolada de autenticação interna. O
repository temporário de usuários não contém credenciais, portanto nenhum
login administrativo funciona até a implementação do `central_db`.

PostgreSQL, Prisma, Redis, BullMQ, autenticação de tenants, motor de fluxo,
WhatsApp e demais módulos do produto ainda serão implementados conforme o
backlog.

## Fluxo de contribuição

- Cada etapa do backlog usa uma branch própria.
- Cada tarefa concluída é marcada no mesmo commit que entrega a alteração.
- Commits seguem Conventional Commits.
- Mudanças em contratos HTTP devem atualizar Swagger e Markdown funcional.

As instruções completas para agentes estão em [AGENTS.md](AGENTS.md).
