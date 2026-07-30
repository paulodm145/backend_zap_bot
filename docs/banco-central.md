# Banco central

## Responsabilidade

O `central_db` contém somente dados globais necessários para autenticação,
provisionamento, planos, assinaturas, refresh tokens e auditoria interna. Dados
operacionais de conversas e fluxos permanecem nos bancos físicos dos tenants.
O índice `roteamentos_whatsapp` guarda somente a associação técnica entre
`phone_number_id` e tenant para resolver webhooks sem varrer todos os bancos.

## Requisitos

- PostgreSQL compatível com Prisma 7;
- variável `CENTRAL_DATABASE_URL`;
- Node.js conforme o `README.md`.

Exemplo local:

```text
postgresql://zapbot:senha@localhost:5432/zapbot_central
```

## Comandos

Gerar o Prisma Client:

```bash
npm run prisma:generate
```

Criar uma migration durante o desenvolvimento:

```bash
npm run db:central:migrate:dev -- --name nome_da_migration
```

Aplicar migrations versionadas em produção:

```bash
npm run db:central:migrate:deploy
```

Popular ou atualizar os planos iniciais:

```bash
npm run db:central:seed
```

O seed usa `upsert` pelo nome do plano e pode ser executado novamente sem
duplicar registros.

## Primeiro super administrador

Não existe credencial padrão. Defina as variáveis apenas no ambiente do
comando:

```text
SUPER_ADMIN_NOME
SUPER_ADMIN_EMAIL
SUPER_ADMIN_SENHA
```

Então execute:

```bash
npm run admin:criar
```

A senha deve possuir pelo menos 12 caracteres. O comando falha se o e-mail já
existir e nunca atualiza silenciosamente a senha de um usuário existente.

## Testes de repository

Os testes de integração são habilitados quando `TEST_DATABASE_URL` estiver
definida:

```bash
TEST_DATABASE_URL=postgresql://zapbot:senha@localhost:5432/zapbot_central_test npm test
```

Use exclusivamente um banco descartável de testes. A suíte remove dados das
tabelas centrais antes de cada cenário.

## Modelos e identificadores

Todos os modelos usam:

- `id` inteiro sequencial para relações internas;
- `public_id` UUID quando a entidade pode ser exposta;
- `created_at` e `updated_at` em UTC;
- índices guiados pelas consultas previstas.

Usuários e tenants utilizam soft delete por `deletado_at`. Refresh tokens são
armazenados por hash, organizados em famílias e possuem dados de rotação e
revogação.

## Roteamento de contas WhatsApp

Cada número recebido no webhook precisa de um registro único em
`roteamentos_whatsapp`. A associação referencia o `id` inteiro do tenant e é
removida em cascata se o tenant for excluído.

Access token, WABA e demais configurações da conta não são duplicados no banco
central. Eles continuam criptografados em `contas_whatsapp`, no banco físico
correspondente. O onboarding da conta deve atualizar os dois lados na mesma
jornada operacional e tratar uma falha parcial como pendência de
sincronização.
