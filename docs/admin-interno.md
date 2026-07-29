# Admin interno

## Objetivo

O admin interno é a API exclusiva da equipe operadora do SaaS. Ele usa o
prefixo `/api/v1/interno` e possui autenticação distinta das sessões dos
tenants.

## Estrutura inicial

```text
src/
  controllers/
    autenticacao-interna.controller.ts
  dtos/
    login-interno.dto.ts
  middlewares/
    autenticacao-interna.middleware.ts
  repositories/
    contratos/
      usuario-interno.repository.ts
    memoria/
      usuario-interno-memoria.repository.ts
  rotas/
    autenticacao-interna.rotas.ts
    interno.rotas.ts
  services/
    autenticacao-interna.service.ts
    token-interno.service.ts
```

Rotas disponíveis nesta primeira base:

| Método | Rota                         | Autenticação | Descrição                          |
| ------ | ---------------------------- | ------------ | ---------------------------------- |
| GET    | `/api/v1/saude`              | Não          | Saúde geral da API                 |
| POST   | `/api/v1/interno/auth/login` | Não          | Valida credenciais de super admin  |
| GET    | `/api/v1/interno/saude`      | JWT interno  | Valida a sessão e o escopo interno |

## Segurança

- O JWT interno usa `issuer = zapbot-api`, `audience = zapbot-admin`,
  `escopo = interno` e `papel = super_admin`.
- Tokens de tenant não devem ser aceitos nas rotas internas.
- A rota de login possui rate limiting.
- Senhas são comparadas com bcrypt.
- Quando TOTP estiver habilitado, o login não emite o token definitivo até a
  verificação do segundo fator.

## Estado da persistência

O scaffold utiliza temporariamente um repository em memória sem usuários. Isso
significa que nenhum login é aceito até a implementação do schema Prisma do
`central_db` e do respectivo repository. Não há credencial padrão ou bypass de
desenvolvimento.

Próximas implementações:

1. schema Prisma de `central_db.users`, `tenants`, `planos`, `assinaturas` e
   `auditoria_interna`;
2. repository Prisma de usuários internos;
3. configuração e verificação TOTP;
4. listagem e provisionamento idempotente de tenants;
5. métricas agregadas e trilha de auditoria.
