# Contrato de autenticação do frontend

O contrato completo está em `AGENTS.md` e é obrigatório.

- Login: `POST /api/v1/auth/login`, body `{ email, senha }`, resposta com
  `{ accessToken, usuario: { id, nome, email, tenantId } }`.
- Refresh token sempre em cookie `HttpOnly`, `Secure`, `SameSite=None`,
  `Path=/api/v1/auth`, com duração longa.
- Refresh: `POST /api/v1/auth/refresh`, sem body, lê o cookie, rotaciona o
  refresh token e retorna novo `{ accessToken }`.
- Logout: `POST /api/v1/auth/logout`, revoga o token no servidor e limpa o
  cookie com os mesmos atributos.
- Access token curto via `Authorization: Bearer <token>`.
- Credenciais inválidas usam código `CREDENCIAIS_INVALIDAS`; token ausente,
  inválido ou expirado sempre retorna `401` no envelope padrão.
- CORS usa `credentials: true` e origem exata, nunca `*`.
- Não misture autenticação de tenant com autenticação interna de
  `super_admin`.
- O TOTP interno só pode ser desabilitado explicitamente em ambiente local de
  desenvolvimento ou teste. Produção sempre exige segundo fator.
