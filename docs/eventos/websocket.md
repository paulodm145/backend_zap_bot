# Chat em tempo real com Socket.IO

## Conexão e autenticação

Conecte no mesmo domínio da API, path `/socket.io`, enviando o access token curto em `auth.token`:

```ts
const socket = io(API_URL, {
  path: '/socket.io',
  auth: { token: accessToken },
  withCredentials: true,
});
```

O backend valida o JWT, resolve o tenant pelo e-mail e `tenantId` autenticados e abre o banco físico correspondente. Não envie subdomínio, nome de banco ou tenant em query string. `connect_error` com `NAO_AUTENTICADO` deve disparar o mesmo refresh usado pelo cliente REST e uma única reconexão.

## Rooms e autorização

O servidor inclui o socket nas rooms internas do tenant e dos setores permitidos. Para abrir o chat, solicite a room da conversa:

```ts
socket.emit('conversa:entrar', conversaId, ({ ok }) => {
  if (!ok) fecharChatERecarregarPermissoes();
});
```

Atendentes só entram em conversas de setores vinculados; admin e gestor podem entrar nas conversas do tenant. Os nomes internos das rooms não fazem parte do contrato do frontend.

## Eventos recebidos

| Evento                         | Uso na interface                                       |
| ------------------------------ | ------------------------------------------------------ |
| `conversa:nova_na_fila`        | Inserir/refazer item na fila do setor                  |
| `conversa:assumida`            | Remover da fila e atualizar responsável                |
| `conversa:atualizada`          | Atualizar status, setor ou responsável                 |
| `conversa:mensagem_recebida`   | Buscar/inserir mensagem recebida já persistida         |
| `conversa:mensagem_atualizada` | Atualizar bolha e estado de entrega                    |
| `atendente:presenca`           | Mostrar presença; payload possui `usuarioId`, `online` |

Eventos de conversa usam `tenantId`, `conversaId`, e opcionalmente `setorId`, `mensagemId` e `dados`. Use IDs apenas como chaves e nunca aceite um evento de outro tenant. A persistência ocorre antes da publicação.

## Reconexão e ordenação

Socket.IO é aceleração, não fonte permanente. Após conexão ou reconexão:

1. refaça `GET /api/v1/conversas?visao=FILA` e `?visao=MINHAS`;
2. reabra a conversa com `conversa:entrar`;
3. recarregue a primeira página de mensagens via REST;
4. use `public_id` para deduplicar e `ocorreu_at` + cursor do backend para ordenar.

Carregue inicialmente 50 mensagens e use `proximoCursor` para páginas anteriores. Eventos que chegaram durante a desconexão serão recuperados dessas rotas.

## Presença e múltiplas abas

A presença usa uma chave Redis com TTL por socket, renovada periodicamente. Fechar uma aba não torna o atendente offline se outra conexão dele continuar ativa. Queda abrupta expira automaticamente pelo TTL; a presença é indicativa e não deve bloquear ações críticas.

## Composição da tela

- coluna de fila: REST `visao=FILA`, atualizada por nova fila/claim;
- coluna pessoal: REST `visao=MINHAS`, atualizada por claim/transferência;
- cabeçalho: detalhe da conversa e presença do responsável;
- timeline: REST paginado, com eventos apenas para atualização incremental;
- compositor: endpoint de mensagens, desabilitado fora da janela ou sem responsabilidade.
