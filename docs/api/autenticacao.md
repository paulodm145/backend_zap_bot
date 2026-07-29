# Autenticação

## Objetivo e escopo

Este documento orienta o frontend sobre autenticação, renovação de sessão,
logout e tratamento de sessão expirada.

Existem dois contextos isolados:

- autenticação de usuários vinculados a um tenant;
- autenticação interna de `super_admin`.

Tokens de um contexto nunca são aceitos no outro.

## Autenticação do tenant

> Estado atual: login, renovação com rotação, logout e middleware Bearer
> implementados.

### Tela de login

Campos:

| Campo   | Tipo     | Obrigatório | Regra                                  |
| ------- | -------- | ----------- | -------------------------------------- |
| `email` | e-mail   | Sim         | Normalizado para minúsculas            |
| `senha` | password | Sim         | Não deve ser mantida após a requisição |

Chamada:

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "usuario@empresa.com",
  "senha": "senha-do-usuario"
}
```

Resposta esperada:

```json
{
  "accessToken": "jwt",
  "usuario": {
    "id": "identificador-publico",
    "nome": "Nome do usuário",
    "email": "usuario@empresa.com",
    "tenantId": "identificador-publico-do-tenant"
  }
}
```

O refresh token não aparece no JSON. O backend o envia em cookie `HttpOnly`,
`Secure`, `SameSite=None` e `Path=/api/v1/auth`.

### Estados da tela

- **Inicial:** formulário habilitado.
- **Enviando:** bloquear novos envios e indicar progresso.
- **Credenciais inválidas:** manter o e-mail e limpar a senha.
- **Validação:** associar erros aos campos quando houver detalhes disponíveis.
- **Falha inesperada:** preservar o formulário e permitir nova tentativa.
- **Sucesso:** armazenar o access token somente no mecanismo de sessão
  aprovado e redirecionar para a área autenticada.

Credenciais inválidas retornam:

```json
{
  "erro": {
    "codigo": "CREDENCIAIS_INVALIDAS",
    "mensagem": "E-mail ou senha inválidos"
  }
}
```

### Renovação automática

```http
POST /api/v1/auth/refresh
```

- Não enviar body.
- Enviar cookies com `credentials: include`.
- Em sucesso, substituir o access token pelo valor retornado.
- Refazer uma única vez a requisição original que recebeu `401`.
- Não criar loop de renovação quando o próprio refresh retornar `401`.

Resposta:

```json
{
  "accessToken": "novo-jwt"
}
```

O cookie é rotacionado a cada renovação. Se um cookie antigo já rotacionado
for reutilizado, toda a família daquela sessão é revogada por segurança. Um
refresh inválido retorna `401` com código `REFRESH_TOKEN_INVALIDO`; nesse caso,
o frontend deve limpar a sessão e redirecionar ao login.

### Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
```

Após a resposta, o frontend deve remover seu access token e limpar o estado
local, mesmo quando a sessão já estiver expirada. O backend revoga o refresh
token e expira o cookie.

## Autenticação do admin interno

> Estado atual: scaffold disponível; persistência e TOTP completo pendentes na
> Etapa 05. O repository temporário recusa todos os logins.

### Login atual

```http
POST /api/v1/interno/auth/login
Content-Type: application/json
```

```json
{
  "email": "admin@zapbot.com.br",
  "senha": "senha-segura"
}
```

Possíveis respostas de sucesso:

```json
{
  "exigeSegundoFator": false,
  "accessToken": "jwt-interno"
}
```

```json
{
  "exigeSegundoFator": true
}
```

O segundo formato ainda não possui endpoint de conclusão e não deve ser
integrado pelo frontend até o contrato TOTP ser fechado.

### Validação da sessão interna

```http
GET /api/v1/interno/saude
Authorization: Bearer <token-interno>
```

Essa rota serve apenas como diagnóstico do scaffold. Não deve ser usada como
fonte de métricas ou prontidão geral.

## CORS

Como frontend e backend usam domínios diferentes:

- todas as chamadas de autenticação que dependem de cookie usam
  `credentials: include`;
- a origem deve corresponder exatamente a uma origem permitida pelo backend;
- não usar `Access-Control-Allow-Origin: *`;
- cookies seguros exigem HTTPS fora do ambiente local.

## Erros comuns

| Status | Código                   | Ação do frontend                   |
| ------ | ------------------------ | ---------------------------------- |
| `401`  | `CREDENCIAIS_INVALIDAS`  | Mostrar erro no login              |
| `401`  | `REFRESH_TOKEN_INVALIDO` | Limpar sessão e abrir o login      |
| `401`  | `NAO_AUTENTICADO`        | Tentar refresh quando aplicável    |
| `403`  | `ACESSO_NEGADO`          | Exibir acesso negado               |
| `422`  | `VALIDACAO`              | Exibir erros associados aos campos |
| `429`  | `LIMITE_TENTATIVAS`      | Bloquear reenvio temporariamente   |

## Referência executável

O contrato das três rotas de autenticação também está disponível no Swagger em
`/api/v1/docs`. O frontend deve usar este documento Markdown para as regras de
tela e o OpenAPI para formatos de requisição e resposta.
