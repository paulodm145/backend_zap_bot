# Admin interno

## Objetivo e permissões

O admin interno é exclusivo da equipe operadora do SaaS. O prefixo é
`/api/v1/interno` e o acesso exige token com:

- `papel = super_admin`;
- `escopo = interno`;
- audiência exclusiva do painel administrativo.

Tokens de tenant não são aceitos.

## Estado atual

O scaffold contém somente:

| Método | Rota                         | Autenticação | Finalidade             |
| ------ | ---------------------------- | ------------ | ---------------------- |
| POST   | `/api/v1/interno/auth/login` | Não          | Iniciar autenticação   |
| GET    | `/api/v1/interno/saude`      | JWT interno  | Validar sessão interna |

O repository temporário não possui usuários. Portanto, a tela de login deve
ser considerada indisponível para uso real até a integração com o
`central_db`.

## Telas planejadas

### Login interno

- Campos: e-mail e senha.
- Estado futuro adicional: configuração ou verificação TOTP.
- Após sucesso definitivo, redirecionar para a visão geral.
- Aplicar tratamento de `401`, `403`, `422` e `429` conforme
  [autenticacao.md](autenticacao.md).

### Visão geral

Dados planejados:

- quantidade de tenants ativos;
- consumo agregado;
- saúde das dependências;
- falhas de provisionamento que precisam de intervenção.

### Lista de tenants

Controles planejados:

- busca;
- filtro por status;
- filtro por plano;
- paginação `skip`/`take`;
- acesso ao detalhe por identificador público.

Estados necessários:

- carregando;
- lista vazia sem filtros;
- nenhum resultado para os filtros;
- erro recuperável;
- acesso negado.

### Detalhe do tenant

Dados planejados:

- identificação e status;
- plano;
- etapa do provisionamento;
- consumo;
- trilha de auditoria;
- ações de suspensão, reativação e alteração de plano.

Ações sensíveis devem solicitar confirmação e atualizar os dados após sucesso.

## Estrutura técnica atual

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

## Atualização em tempo real

As telas administrativas da estrutura base não dependem de WebSocket. O
progresso de provisionamento poderá usar polling até existir infraestrutura de
eventos apropriada; o contrato será documentado com a funcionalidade.
