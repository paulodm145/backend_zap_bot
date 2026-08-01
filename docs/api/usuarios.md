# Usuários e permissões

## Matriz de acesso

| Papel          | Usuários                            | Configurações | Atendimento         |
| -------------- | ----------------------------------- | ------------- | ------------------- |
| `ADMIN_TENANT` | Total                               | Total         | Total               |
| `GESTOR`       | Gestores e atendentes; nunca admins | Operacional   | Total               |
| `ATENDENTE`    | Sem acesso ao cadastro              | Sem acesso    | Próprio atendimento |

O backend aplica a matriz mesmo que o frontend exiba uma ação indevida. Um
`403 ACESSO_NEGADO` deve abrir aviso de permissão, sem tentar novamente.

## Endpoints

| Método | Rota                                  | Uso                     |
| ------ | ------------------------------------- | ----------------------- |
| GET    | `/api/v1/usuarios`                    | Lista paginada          |
| POST   | `/api/v1/usuarios`                    | Cadastro                |
| GET    | `/api/v1/usuarios/{usuarioId}`        | Detalhe                 |
| PUT    | `/api/v1/usuarios/{usuarioId}`        | Edição                  |
| PATCH  | `/api/v1/usuarios/{usuarioId}/status` | Ativação ou desativação |
| DELETE | `/api/v1/usuarios/{usuarioId}`        | Exclusão lógica         |

## Composição das telas

A lista aceita `skip`, `take`, `busca`, `papel` e `ativo`. Mostre nome, e-mail,
papel, status e ações permitidas. Nunca haverá `senha` ou `senha_hash` nas
respostas. No cadastro, solicite nome, e-mail, senha inicial e papel. O e-mail
é globalmente único e o backend o normaliza.

```json
{
  "nome": "Maria Atendente",
  "email": "maria@empresa.com",
  "senha": "SenhaInicialSegura123!",
  "papel": "ATENDENTE"
}
```

Desativar ou excluir revoga imediatamente os refresh tokens. O access token já
emitido pode permanecer válido até sua curta expiração; ao receber `401`, o
refresh falhará e o frontend deve encerrar a sessão.

O último administrador ativo não pode ser rebaixado, desativado ou excluído.
Trate o `422 VALIDACAO` mantendo o formulário aberto e explicando que outro
administrador precisa ser cadastrado primeiro.

## Isolamento e consistência

A autenticação fica no banco central e o perfil operacional no banco físico do
tenant. O frontend nunca envia `tenantId`. Se uma escrita entre bancos falhar,
o backend executa compensação; repita a leitura antes de oferecer nova ação.
