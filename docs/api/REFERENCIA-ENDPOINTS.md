# Referência de endpoints para o frontend

## Convenções gerais

Base local: `http://localhost:3000`. Todas as rotas usam o prefixo `/api/v1`.
O contrato executável fica em `/api/v1/docs/` e `/api/v1/openapi.json`.

Requisições JSON devem enviar `Content-Type: application/json`. Rotas
protegidas recebem `Authorization: Bearer <accessToken>`. Nunca envie
`tenantId`, nome de banco ou conexão para selecionar tenant: o backend resolve
o banco físico pelo e-mail autenticado e valida o `tenantId` do JWT.

Erros seguem:

```json
{
  "erro": {
    "codigo": "CODIGO_ESTAVEL",
    "mensagem": "Mensagem em português",
    "detalhes": {}
  }
}
```

O frontend deve guardar o access token apenas no mecanismo de sessão aprovado,
tratar `401` do tenant com uma única tentativa de refresh e nunca tentar
refresh para tokens internos. Use `credentials: 'include'` nas chamadas que
dependem do cookie HttpOnly. Uma implementação sugerida do cliente HTTP está em
[Cliente HTTP do frontend](CLIENTE-FRONTEND.md).

## Índice completo

| Método | Endpoint                                    | Acesso                            | Uso no frontend                           |
| ------ | ------------------------------------------- | --------------------------------- | ----------------------------------------- |
| GET    | `/api/v1/saude`                             | Público                           | Verificar se o processo HTTP responde     |
| GET    | `/api/v1/prontidao`                         | Público                           | Diagnóstico de PostgreSQL e Redis         |
| GET    | `/api/v1/docs/`                             | Público em dev; Basic em produção | Interface Swagger                         |
| GET    | `/api/v1/openapi.json`                      | Público em dev; Basic em produção | Geração de cliente e consulta do contrato |
| POST   | `/api/v1/auth/login`                        | Público                           | Iniciar sessão de tenant                  |
| POST   | `/api/v1/auth/refresh`                      | Cookie HttpOnly                   | Renovar access token                      |
| POST   | `/api/v1/auth/logout`                       | Cookie HttpOnly                   | Encerrar sessão de tenant                 |
| POST   | `/api/v1/interno/auth/login`                | Público                           | Iniciar sessão do superadministrador      |
| POST   | `/api/v1/interno/auth/2fa/configurar`       | `estadoToken`                     | Obter QR code da primeira configuração    |
| POST   | `/api/v1/interno/auth/2fa/verificar`        | `estadoToken`                     | Confirmar TOTP e receber JWT interno      |
| GET    | `/api/v1/interno/saude`                     | JWT interno                       | Validar a sessão administrativa           |
| GET    | `/api/v1/interno/tenants`                   | JWT interno                       | Lista administrativa paginada             |
| POST   | `/api/v1/interno/tenants`                   | JWT interno                       | Provisionar tenant idempotentemente       |
| GET    | `/api/v1/interno/tenants/{tenantId}`        | JWT interno                       | Detalhar tenant                           |
| PATCH  | `/api/v1/interno/tenants/{tenantId}/status` | JWT interno                       | Suspender, reativar ou cancelar           |
| PATCH  | `/api/v1/interno/tenants/{tenantId}/plano`  | JWT interno                       | Alterar plano manualmente                 |
| GET    | `/api/v1/fluxos`                            | JWT tenant                        | Listar fluxos                             |
| POST   | `/api/v1/fluxos`                            | JWT tenant                        | Criar rascunho                            |
| GET    | `/api/v1/fluxos/{fluxoId}`                  | JWT tenant                        | Abrir editor                              |
| PUT    | `/api/v1/fluxos/{fluxoId}`                  | JWT tenant                        | Salvar rascunho                           |
| DELETE | `/api/v1/fluxos/{fluxoId}`                  | JWT tenant                        | Excluir logicamente                       |
| POST   | `/api/v1/fluxos/{fluxoId}/publicar`         | JWT tenant                        | Publicar versão imutável                  |
| POST   | `/api/v1/fluxos/{fluxoId}/simular`          | JWT tenant                        | Simular conversa sem WhatsApp             |
| GET    | `/api/v1/empresa`                           | JWT tenant                        | Consultar cadastro empresarial            |
| PUT    | `/api/v1/empresa`                           | Admin do tenant                   | Atualizar cadastro empresarial            |
| GET    | `/api/v1/empresa/consultar-cep/{cep}`       | JWT tenant                        | Sugerir endereço pelo CEP                 |
| GET    | `/api/v1/contas-whatsapp`                   | Admin do tenant                   | Listar contas WhatsApp                    |
| POST   | `/api/v1/contas-whatsapp`                   | Admin do tenant                   | Cadastrar conta WhatsApp                  |
| GET    | `/api/v1/contas-whatsapp/{contaId}`         | Admin do tenant                   | Detalhar conta WhatsApp                   |
| PUT    | `/api/v1/contas-whatsapp/{contaId}`         | Admin do tenant                   | Atualizar conta WhatsApp                  |
| PATCH  | `/api/v1/contas-whatsapp/{contaId}/token`   | Admin do tenant                   | Rotacionar token                          |
| PATCH  | `/api/v1/contas-whatsapp/{contaId}/status`  | Admin do tenant                   | Ativar ou desativar conta                 |
| POST   | `/api/v1/contas-whatsapp/{contaId}/testar`  | Admin do tenant                   | Testar credencial na Meta                 |
| GET    | `/api/v1/webhook/whatsapp`                  | Token de verificação Meta         | Confirmar cadastro do webhook             |
| POST   | `/api/v1/webhook/whatsapp`                  | Assinatura HMAC Meta              | Receber e enfileirar eventos              |

## Infraestrutura e documentação

### `GET /api/v1/saude`

Use como liveness probe. `200 { "status": "ok" }` confirma somente que o
processo HTTP está ativo; não habilite ações críticas com base nessa rota.

### `GET /api/v1/prontidao`

Use em diagnóstico operacional, não em polling de telas. Retorna `200` quando
PostgreSQL central e Redis estão disponíveis e `503` quando alguma dependência
falha:

```json
{
  "status": "pronto",
  "dependencias": [
    { "nome": "postgresql-central", "disponivel": true },
    { "nome": "redis", "disponivel": true }
  ]
}
```

### `GET /api/v1/docs/` e `GET /api/v1/openapi.json`

Não fazem parte das telas do produto. Use o JSON para geração de tipos ou
clientes. Em produção, envie autenticação HTTP Basic configurada por
`SWAGGER_USUARIO` e `SWAGGER_SENHA`; em desenvolvimento não há Basic.

## Sessão de tenant

### `POST /api/v1/auth/login`

Tela: login do cliente. Envie:

```json
{ "email": "admin@empresa.com", "senha": "senha-do-usuario" }
```

Em `200`, mantenha `accessToken` na sessão e use `usuario` para o cabeçalho da
aplicação. O refresh token chega somente em cookie HttpOnly. Em `401
CREDENCIAIS_INVALIDAS`, preserve o e-mail, limpe a senha e mostre o erro. O
backend encontra o tenant pelo e-mail; não mostre campo de subdomínio.

### `POST /api/v1/auth/refresh`

Não envie body nem token Bearer. Envie o cookie com `credentials: 'include'`.
Em `200`, substitua o access token e repita uma única vez a requisição original.
Em `401 REFRESH_TOKEN_INVALIDO`, limpe a sessão e abra o login.

### `POST /api/v1/auth/logout`

Envie o cookie com `credentials: 'include'`. A resposta é `204`, sem corpo.
Limpe o estado local mesmo se a chamada falhar. Detalhes completos:
[Autenticação](autenticacao.md).

## Sessão administrativa e TOTP

### `POST /api/v1/interno/auth/login`

Tela: login da operação do SaaS. Envie e-mail e senha. Com TOTP desabilitado em
desenvolvimento, a resposta contém `exigeSegundoFator: false` e `accessToken`.
Com TOTP habilitado, preserve temporariamente `estadoToken` e siga:

- `exigeConfiguracao=true`: abrir configuração e chamar `/2fa/configurar`;
- `exigeConfiguracao=false`: abrir formulário de código e chamar
  `/2fa/verificar`.

Trate `429` desabilitando novas tentativas durante o período indicado pela
interface. Token interno nunca deve chamar `/auth/refresh`.

### `POST /api/v1/interno/auth/2fa/configurar`

Envie `{ "estadoToken": "..." }`. Renderize o QR code retornado e também
ofereça a chave textual para acessibilidade. Não considere a configuração
concluída até `/2fa/verificar` retornar sucesso.

### `POST /api/v1/interno/auth/2fa/verificar`

Envie `{ "estadoToken": "...", "codigo": "123456" }`. Em `200`, descarte o
estado temporário, guarde o `accessToken` interno e abra o painel. Em `401`,
permita corrigir o código; se o estado expirou, volte ao login.

### `GET /api/v1/interno/saude`

Envie o JWT interno. Use após restaurar uma sessão do painel para confirmar
escopo e expiração. Não use como prontidão da API. Jornada detalhada:
[Admin interno](admin-interno.md).

## Administração de tenants

### `GET /api/v1/interno/tenants`

Use na tabela administrativa. Aceita `skip`, `take`, `busca`, `status`,
`planoId`, `ordenarPor` e `ordem`. Preserve filtros na URL da tela e derive a
paginação de `{ dados, total, skip, take }`.

### `POST /api/v1/interno/tenants`

Use no formulário “Criar tenant”. Envie nome, plano e administrador, além de
uma UUID `chaveIdempotencia`. Gere a chave uma vez por tentativa lógica e
reutilize-a em retries. A resposta `202` representa provisionamento concluído
ou retomado; refaça a listagem e abra o detalhe retornado.

### `GET /api/v1/interno/tenants/{tenantId}`

Use na tela de detalhe. `tenantId` é o UUID público. Renderize identificação,
status, etapa de provisionamento, usuários e assinaturas. `404` deve voltar à
lista com aviso de item inexistente.

### `PATCH /api/v1/interno/tenants/{tenantId}/status`

Exija modal de confirmação e motivo. Envie `confirmar: true`. Depois de `200`,
invalide lista e detalhe. Não ofereça reativação para tenant cancelado.

### `PATCH /api/v1/interno/tenants/{tenantId}/plano`

Exija confirmação, motivo e `planoId`. Depois de `200`, refaça o detalhe para
obter a nova assinatura. Regras e exemplos completos:
[Administração de tenants](tenants.md).

## Fluxos

### `GET /api/v1/fluxos`

Use na lista do tenant. Aceita `skip`, `take`, `busca` e `estado` (`RASCUNHO`
ou `PUBLICADO`). Preserve filtros e invalide a consulta após qualquer mutação.

### `POST /api/v1/fluxos`

Crie um rascunho com `nome` e `definicao`. Em `201`, navegue para o editor
usando o `public_id`. A definição começa com `schemaVersao`, `noInicial` e
`nos`.

### `GET /api/v1/fluxos/{fluxoId}`

Carregue o rascunho e os metadados da última publicação. Em `404`, remova o
item do cache e retorne à lista.

### `PUT /api/v1/fluxos/{fluxoId}`

Salve o documento completo do editor. A operação altera apenas o rascunho e
marca mudanças pendentes; versões publicadas permanecem imutáveis. Bloqueie
salvamentos concorrentes na interface.

### `DELETE /api/v1/fluxos/{fluxoId}`

Peça confirmação explícita. Em `204`, remova o item da lista. A exclusão é
lógica e não devolve corpo.

### `POST /api/v1/fluxos/{fluxoId}/publicar`

Não possui body. Em `201`, atualize versão e data de publicação. Em `422`, use
`erro.detalhes.erros[].noId` e `campo` para destacar nós inválidos. Em `409`,
refaça o detalhe porque não há alterações pendentes.

### `POST /api/v1/fluxos/{fluxoId}/simular`

Na primeira chamada envie `{ "maxPassos": 50 }`. Renderize `saidas`; se houver
captura, devolva o `estado` integral com a próxima `mensagem`. Não envie nada à
Cloud API. Contratos completos: [Fluxos e editor](fluxos.md) e
[Schema JSON](../schemas/fluxo-json.md).

## Webhook do WhatsApp

### `GET /api/v1/webhook/whatsapp`

É consumido pela Meta, não pelo frontend. Recebe `hub.mode`,
`hub.verify_token` e `hub.challenge`; devolve o challenge em texto quando o
token confere.

### `POST /api/v1/webhook/whatsapp`

É consumido pela Meta e exige `X-Hub-Signature-256`. Valida o corpo bruto,
resolve o tenant por `phone_number_id`, deduplica mensagens no Redis e cria
jobs. O frontend não deve chamar essa rota. Consulte
[Webhook do WhatsApp](../eventos/webhook-whatsapp.md).

## Regras de cache e sessão

- `401` em rota tenant: tentar refresh uma vez; se falhar, abrir login.
- `401` em rota interna: abrir login interno sem chamar refresh tenant.
- `403`: mostrar acesso negado sem repetir automaticamente.
- `404`: remover entidade obsoleta do cache.
- `409`: refazer detalhe antes de nova mutação.
- `422`: manter formulário e associar detalhes aos campos.
- `429`: aplicar bloqueio temporário de envio.
- mutação bem-sucedida: invalidar lista e detalhe relacionados.
- todas as requisições devem preservar e registrar `X-Correlation-Id` retornado
  pelo backend ao reportar falhas para suporte.
