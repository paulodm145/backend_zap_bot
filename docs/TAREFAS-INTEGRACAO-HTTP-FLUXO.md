# Tarefas — integração HTTP no fluxo

Entrega o bloco `integracao_http` previsto na seção 15 de
`docs/ARQUITETURA-BACKEND.md`, que permite ao fluxo consultar uma API externa
(ERP/CRM) e seguir por caminhos distintos conforme sucesso ou falha.

A arquitetura exige que o nó referencie uma `credencialId` existente no tenant.
A tabela `credenciais_integracao` já existe no schema, mas não possui nenhum
código associado — sem repository, service ou as rotas `/api/v1/integracoes`
previstas na seção 14.5. Por isso o trabalho foi dividido em duas etapas, com
a etapa 2 dependendo da etapa 1 integrada.

## Etapa 1 — credenciais de integração

Branch: `feat/credenciais-integracao`

Objetivo: permitir que o tenant cadastre, liste e remova credenciais de APIs
externas, com o segredo criptografado em repouso e nunca devolvido pela API.

- [x] Adicionar `base_url` a `CredencialIntegracao` com migration de tenant.
- [x] Adicionar chave dedicada de criptografia ao schema de ambiente.
- [x] Definir schemas Zod de credencial, incluindo união discriminada por tipo
      de autenticação.
- [x] Validar `base_url` exigindo HTTPS e recusando host de loopback ou rede
      privada.
- [x] Implementar repository de credenciais restrito a acesso a dados.
- [x] Implementar service com criptografia, unicidade de nome e mapeamento da
      resposta pública sem segredo.
- [x] Implementar controller e rotas `/api/v1/integracoes` restritas à gestão
      do tenant.
- [x] Registrar as rotas no `app.ts` com autenticação e resolução de tenant.
- [x] Derivar o OpenAPI dos schemas Zod da funcionalidade.
- [x] Documentar a jornada em `docs/api/integracoes.md`.
- [x] Registrar `base_url` e a chave de criptografia na documentação de
      arquitetura.
- [x] Testar criação, listagem, atualização, remoção e ausência de segredo na
      resposta.
- [x] Testar recusa de `base_url` inválida e de host privado.
- [x] Executar formatação, lint, TypeScript, testes e build.
- [x] Criar commits semânticos, abrir PR e aguardar a CI.

Checklist de saída:

- [x] Nenhuma resposta da API expõe `configuracao_encrypted` ou segredo em
      texto puro.
- [x] Nenhum log registra segredo de credencial.
- [x] Migration de tenant versionada junto da alteração de schema.

## Etapa 2 — bloco `integracao_http`

Branch: `feat/bloco-integracao-http` (depende da etapa 1 integrada)

Objetivo: executar a chamada HTTP durante o fluxo, gravar o resultado em
variáveis e seguir por `sucesso` ou `falha`.

- [x] Adicionar `integracao_http` aos tipos de nó e ao schema de definição.
- [x] Modelar `sucesso` e `falha` como referências validadas do grafo.
- [x] Fazer o motor pausar no nó, preservando sua pureza síncrona.
- [x] Implementar interpolação `{{variavel}}` na URL sem `eval`.
- [x] Implementar extração da resposta por caminho sem `eval`.
- [x] Implementar cliente HTTP com timeout, limite de tamanho e bloqueio de
      redirecionamento para host privado.
- [x] Executar a chamada no `ExecucaoFluxoService` e retomar o motor.
- [x] Validar na publicação que a `credencialId` existe e está ativa.
- [x] Impedir desativação de credencial usada em fluxo publicado.
- [x] Expor o bloco no catálogo consumido pelo editor.
- [x] Documentar o bloco em `docs/api/blocos-fluxo.md` e `docs/api/fluxos.md`.
- [x] Testar sucesso, falha, timeout, resposta inválida e host bloqueado.
- [x] Executar formatação, lint, TypeScript, testes e build.
- [ ] Criar commits semânticos, abrir PR e aguardar a CI.
- [ ] Interpolar `{{variavel}}` no bloco `mensagem`.
      Bloqueada: sem isso o fluxo consulta a API mas não consegue exibir o
      resultado ao contato. Muda o comportamento de fluxos já publicados
      cujo texto contenha `{{`, então depende de decisão do usuário.

Checklist de saída:

- [x] O motor continua puro e sem I/O.
- [x] Nenhuma execução de fluxo usa `eval` ou equivalente.
- [x] Segredo da credencial não aparece em log nem no histórico da conversa.
