# Tarefas — motor de fluxo conectado à mensagem real

Branch: `feat/motor-fluxo-mensagem-real`

Contexto: até aqui o motor de execução de fluxo (`MotorFluxoService` +
`ExecucaoFluxoService`) só era acionado pelo endpoint de simulação do editor
(`POST /api/v1/fluxos/{fluxoId}/simular`). Uma mensagem real recebida via
webhook apenas era persistida no histórico; nenhum fluxo publicado respondia
automaticamente e a conversa só chegava a um setor por ação manual. Esta etapa
conecta o pipeline real de mensagens recebidas ao motor já existente.

## Modelagem

- [x] Adicionar `fluxo_id` opcional em `ContaWhatsapp` (schema Prisma do
      tenant) definindo qual fluxo publicado responde às mensagens recebidas
      naquele número.
- [x] Criar e aplicar a migration correspondente em todos os bancos de tenant
      (demo, `zapbot_tenant_test_a`, `zapbot_tenant_test_b`,
      `zapbot_tenant_modelo`).

## Contrato de API

- [x] Estender `criarContaWhatsappSchema` com `fluxoPublicoId` opcional
      (`public_id` de um fluxo publicado do tenant).
- [x] Validar no service que o `fluxoPublicoId` informado corresponde a um
      fluxo publicado (`ativo: true`) do próprio tenant; rejeitar com
      `422 VALIDACAO` caso contrário.
- [x] Incluir o objeto `fluxo` (`public_id`, `nome`) na resposta de conta
      WhatsApp.
- [x] Atualizar `src/config/openapi.ts` com o novo campo de entrada e de
      resposta.
- [x] Não alterar `atualizarContaWhatsappSchema` nesta etapa — troca de fluxo
      em conta já existente fica fora de escopo.

## Motor de fluxo

- [x] Reescrever `ProcessadorMensagemRecebidaService` para, após persistir a
      mensagem recebida: se a conversa estiver em `status: BOT` e a conta
      tiver um fluxo ativo associado, executar `ExecucaoFluxoService` com o
      texto recebido.
- [x] Persistir cada saída de texto do fluxo (`mensagem`/`captura_resposta`)
      como `Mensagem` com `autor: BOT` e enfileirar para envio pelo mesmo
      pipeline usado por mensagens de atendente
      (`EnfileiradorMensagemSaida` → `ProcessadorMensagemSaidaService` →
      Evolution API).
- [x] Reaproveitar `DirecionamentoAtendimentoRepository.direcionarPeloFluxo`
      (já existente) para o caso de o fluxo direcionar a um setor
      (`direcionar_setor`) — a conversa muda para `AGUARDANDO_ATENDENTE` e
      passa a valer o fluxo de fila/claim já implementado.
- [x] Garantir que, uma vez fora de `status: BOT`, novas mensagens do mesmo
      contato não reacionem o fluxo (guarda por `status`).
- [x] Publicar os eventos de WebSocket (`conversa:mensagem_recebida`,
      `conversa:mensagem_atualizada`) também para as mensagens geradas pelo
      bot.

## Testes

- [x] Testes unitários de `ContaWhatsappService` para associação de fluxo
      válido e rejeição de fluxo inexistente/não publicado.
- [x] Teste de integração de `ProcessadorMensagemRecebidaService` (gated por
      `TEST_TENANT_DATABASE_URL_B`/`TEST_REDIS_URL`) cobrindo: conta sem
      fluxo (apenas registra), conta com fluxo de nó `mensagem` (executa e
      enfileira resposta) e conta com fluxo que direciona a um setor (conversa
      sai de `BOT` e mensagens seguintes não reacionam o motor).

## Documentação

- [x] Atualizar `docs/api/contas-whatsapp.md` com o campo `fluxoPublicoId`/
      `fluxo` e o comportamento de resposta automática.
- [x] Atualizar `docs/api/historico-conversas.md` com a seção de execução
      automática do fluxo (bot) e sua relação com fila/claim.

## Checklist de saída

- [x] `npm run format:check`, `npm run lint` e `npm run typecheck` sem erros.
- [x] `npm run test:coverage` completo (incluindo testes de integração com
      `TEST_DATABASE_URL`/`TEST_TENANT_DATABASE_URL_A`/`_B`/`TEST_REDIS_URL`)
      aprovado, cobertura de branches acima do limiar de 70%.
- [x] `npm run build` aprovado.
- [ ] Validação manual ponta a ponta com webhook sintético contra a Evolution
      API do ambiente Docker (sem número físico pareado disponível neste
      ambiente — pendente de execução com o usuário).
- [ ] Branch pronta para revisão e merge — aguardando commit/PR.
