# Administração de tenants

## Acesso

Todas as rotas usam `/api/v1/interno/tenants` e exigem JWT interno de
`super_admin`. Tokens de usuários de tenant não são aceitos.

## Conectar como tenant (impersonação)

Na lista ou no detalhe, o botão **Conectar** chama:

```http
POST /api/v1/interno/tenants/{tenantId}/impersonar
Authorization: Bearer <token-interno>
```

Não envie body. Em sucesso, a resposta contém o `accessToken`, o administrador
tenant assumido e os metadados `impersonacao` (`operadorId`, `sessaoId` e
`expiraEmSegundos`).

O frontend deve manter o token interno original separado, guardar o token
impersonado apenas em memória e abrir o painel do tenant com este último. Exiba
um banner persistente “Acessando como Empresa X” e uma ação **Sair da conta do
cliente**, que descarta o token impersonado e retorna ao painel interno.

Não chame `/auth/refresh` durante a impersonação: ela dura no máximo 15 minutos
e não possui refresh token. Ao receber `401`, descarte a sessão impersonada e
retorne ao painel interno. O endpoint limpa eventual cookie de refresh tenant
anterior. Tenant suspenso/inexistente ou sem administrador ativo retorna `404`.
Cada conexão gera uma auditoria `IMPERSONAR_TENANT`.

## Tela de listagem

Use `GET /api/v1/interno/tenants`:

| Parâmetro    | Padrão       | Regra                                          |
| ------------ | ------------ | ---------------------------------------------- |
| `skip`       | `0`          | Inteiro a partir de zero                       |
| `take`       | `20`         | Entre 1 e 100                                  |
| `busca`      | —            | Trecho do nome, sem diferenciar maiúsculas     |
| `status`     | —            | Status exato                                   |
| `planoId`    | —            | UUID público do plano                          |
| `ordenarPor` | `updated_at` | `nome`, `status`, `created_at` ou `updated_at` |
| `ordem`      | `desc`       | `asc` ou `desc`                                |

Colunas recomendadas: nome, status, plano atual, etapa de provisionamento,
criação e última atualização. A resposta contém `dados`, `total`, `skip` e
`take`.

Estados da tela:

- carregando: manter filtros visíveis e desabilitar paginação;
- vazio sem filtros: oferecer “Criar tenant”;
- vazio com filtros: informar que nenhum resultado corresponde à busca;
- erro recuperável: manter filtros e permitir nova tentativa;
- `401`/`403`: encerrar a sessão ou mostrar acesso negado.

## Detalhe

`GET /api/v1/interno/tenants/{tenantId}` retorna tenant, usuários vinculados e
histórico de assinaturas. `tenantId` é o UUID público, nunca o ID sequencial.

## Alteração de status

`PATCH /api/v1/interno/tenants/{tenantId}/status`:

```json
{
  "status": "SUSPENSO",
  "confirmar": true,
  "motivo": "Solicitação operacional registrada no chamado 123"
}
```

A tela deve exigir confirmação e motivo. Transições:

- `ATIVO` → `SUSPENSO` ou `CANCELADO`;
- `SUSPENSO` → `ATIVO` ou `CANCELADO`;
- pagamento, provisionamento ou falha → `CANCELADO`.

Tenant cancelado não pode ser reativado. Toda alteração gera auditoria.

Para bloquear temporariamente sem apagar dados, use `SUSPENSO`. A resolução de
conexão recusa imediatamente novos acessos do tenant, e a reativação continua
disponível pelo mesmo endpoint com status `ATIVO`.

## Exclusão definitiva

`DELETE /api/v1/interno/tenants/{tenantId}` elimina banco físico, usuários,
sessões, assinaturas, configurações, conversas e mensagens. Nesta etapa ainda
não existe backup automático em S3; portanto não há recuperação.

O botão **Excluir definitivamente** deve ficar disponível somente quando o
tenant estiver `SUSPENSO` ou `CANCELADO`. Use um modal separado da alteração de
status, sem confirmação genérica. Solicite senha atual do operador, motivo e
digitação do nome exato exibido no detalhe:

```json
{
  "senha": "senha-atual-do-super-admin",
  "confirmar": true,
  "nomeTenant": "Empresa Exemplo",
  "motivo": "Encerramento definitivo solicitado pelo responsável"
}
```

Em `204`, remova o tenant do cache e retorne à lista. Não tente ler JSON. Em
`401`, mantenha o modal aberto, limpe somente a senha e informe falha de
reautenticação. Em `409`, refaça o detalhe porque o tenant não está bloqueado
ou não possui banco provisionado. Em `422`, destaque a confirmação/nome.

Durante a requisição, bloqueie fechamento do modal e repetição do botão. Se o
drop do banco falhar, o backend mantém os registros centrais, deixa o tenant
`CANCELADO` e registra a falha para retry. A auditoria final é preservada fora
do registro removido.

## Alteração manual de plano

`PATCH /api/v1/interno/tenants/{tenantId}/plano`:

```json
{
  "planoId": "f50e7241-c38b-4d15-bbee-bf3121ad9b11",
  "confirmar": true,
  "motivo": "Condição comercial aprovada"
}
```

A assinatura ativa/manual anterior é cancelada e uma assinatura `MANUAL` é
criada. Tenant cancelado e plano inativo são recusados.

## Provisionamento manual

`POST /api/v1/interno/tenants`:

```json
{
  "chaveIdempotencia": "128fa69c-41ea-49da-bf49-c5562198b115",
  "nome": "Empresa Exemplo",
  "planoId": "f50e7241-c38b-4d15-bbee-bf3121ad9b11",
  "administrador": {
    "nome": "Maria Administradora",
    "email": "maria@empresa.com",
    "senha": "senha-inicial-forte"
  }
}
```

O frontend gera uma UUID por tentativa lógica e a reutiliza nos retries.
Etapas apresentáveis:

1. `REGISTRO_CENTRAL_CRIADO`;
2. `BANCO_CRIADO`;
3. `MIGRATIONS_APLICADAS`;
4. `CONCLUIDO`.

Em falha, ficam preservados status, etapa e mensagem. Reenviar a mesma chave
retoma sem duplicar tenant, administrador ou assinatura. A compensação é
conservadora: banco e registros já criados não são apagados automaticamente,
permitindo diagnóstico e retry seguro.
