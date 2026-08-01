# Perfil do usuário autenticado

Use `GET /api/v1/me` ao iniciar a área autenticada. A resposta contém dados pessoais, tenant, papel, `permissoes` efetivas e setores. Use as permissões para compor menus; o backend continua validando as ações.

## Dados gerais

`PUT /api/v1/me` aceita somente `{ "nome": "Novo nome" }`. Campos como `papel`, `ativo` e `permissoes` retornam `422` e permanecem exclusivos das rotas administrativas.

## Segurança

- `PUT /api/v1/me/senha` recebe `{ "senhaAtual": "...", "novaSenha": "..." }`.
- `PUT /api/v1/me/email` recebe `{ "senhaAtual": "...", "novoEmail": "novo@empresa.com" }`.
- Ambos exigem reautenticação. A senha deve ter 12 a 128 caracteres, maiúscula, minúscula e número.
- Depois da alteração, os refresh tokens são revogados. Limpe o estado local e direcione ao login; o e-mail novo aparece em um novo access token.
- Senha atual inválida retorna `401`; e-mail ocupado ou senha reutilizada retorna `409`.

## Avatar

O upload permanece indisponível até existir storage de objetos. Não envie binários nem base64 ao PostgreSQL.
