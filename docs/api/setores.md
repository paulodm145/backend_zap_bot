# Setores e vínculos de atendentes

Todos os endpoints usam Bearer token e o banco físico resolvido pelo e-mail/JWT. Administradores e gestores mantêm setores; atendentes apenas consultam os setores aos quais estão vinculados.

## Tela de setores

- Liste com `GET /api/v1/setores?skip=0&take=20&busca=&ativo=true`. Use `dados`, `total`, `skip` e `take` na paginação server-side.
- Crie com `POST /api/v1/setores`, corpo `{ "nome": "Financeiro", "descricao": "Cobranças e notas" }`.
- Carregue a edição com `GET /api/v1/setores/{setorId}` e salve por `PUT` no mesmo caminho.
- Exclua com `DELETE /api/v1/setores/{setorId}`. Em `409`, informe que o setor está em fluxo publicado ou possui conversa ativa; não ofereça exclusão forçada.
- Em `403`, esconda ações administrativas, mantendo o backend como autoridade final.

## Seletor de setores do usuário

Na edição de usuário, envie a seleção completa para `PUT /api/v1/usuarios/{usuarioId}/setores`:

```json
{ "setoresIds": ["uuid-fiscal", "uuid-financeiro"] }
```

A operação substitui todos os vínculos atomicamente. Uma lista vazia remove todos. Em `422`, recarregue as opções porque algum setor foi removido ou desativado.

## Atendentes elegíveis

`GET /api/v1/setores/{setorId}/atendentes-elegiveis` retorna somente perfis ativos vinculados. Use-o em seletores de atribuição manual. Lista vazia significa que ainda não há atendentes disponíveis.

Um atendente pode pertencer a nenhum, um ou vários setores. Setores excluídos logicamente deixam de aparecer em novas seleções, e fluxos publicados nunca ficam apontando para setor excluído.
