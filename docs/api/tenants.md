# Administração de tenants

## Acesso

Todas as rotas usam `/api/v1/interno/tenants` e exigem JWT interno de
`super_admin`. Tokens de usuários de tenant não são aceitos.

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
