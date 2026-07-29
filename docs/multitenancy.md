# Operação multi-tenant

## Separação dos bancos

O banco central/admin usa `prisma/central/schema.prisma` e armazena usuários,
tenants e a conexão criptografada. Cada cliente possui um banco físico com o
schema replicável `prisma/tenant/schema.prisma`.

As migrations são independentes:

```text
prisma/
  central/migrations/
  tenant/migrations/
```

Uma migration central nunca deve ser apontada para um banco de tenant e
vice-versa.

## Resolução da conexão

O login localiza o usuário pelo e-mail normalizado no banco central. O access
token carrega o identificador público do tenant e o e-mail autenticado. O
middleware confirma novamente esse vínculo no banco central e só então
descriptografa a conexão cadastrada.

Subdomínio, `Host`, headers personalizados, query string e body não participam
da escolha do banco.

## Atualização

Para desenvolver uma migration de tenant:

```bash
TENANT_DATABASE_URL=postgresql://usuario:senha@localhost:5432/tenant_modelo \
  npm run db:tenant:migrate:dev -- --name adicionar_campo
```

Para atualizar um banco específico:

```bash
TENANT_DATABASE_URL=postgresql://usuario:senha@localhost:5432/tenant_cliente \
  npm run db:tenant:migrate:deploy
```

Para atualizar todos os tenants ativos cadastrados no banco central:

```bash
CENTRAL_DATABASE_URL=postgresql://usuario:senha@localhost:5432/zapbot_central \
TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE=<64-hex> \
npm run db:tenant:migrate:todos
```

O executor usa lock consultivo no PostgreSQL para impedir duas execuções
simultâneas, continua após falha isolada e retorna um resumo sem registrar
strings de conexão.

## Cache de conexões

O gerenciador mantém no máximo `TENANT_CLIENTES_CACHE_MAXIMO` clients e usa
LRU. Um acesso renova a posição do client; ao atingir o limite, o menos
recentemente usado é desconectado. Aberturas concorrentes do mesmo tenant
compartilham a mesma Promise.
