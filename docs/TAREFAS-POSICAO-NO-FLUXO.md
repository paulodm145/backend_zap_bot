# Tarefas — posição dos blocos no fluxo

Branch: `feat/posicao-no-fluxo`

Contexto: relatado pelo usuário que, ao salvar um fluxo no editor e reabri-lo,
os blocos apareciam reorganizados numa grade, misturando o layout montado na
tela. Causa raiz: `definicaoFluxoSchema` (`.strict()`) nunca teve campo de
posição por nó — o frontend (`definitionToGraph`) sempre recalculava um
layout em grade a partir do índice do nó no array, porque não havia onde ler
uma posição salva.

## Contrato

- [x] Adicionar `posicao: { x: number, y: number }` opcional em cada um dos 4
      schemas de nó (`noMensagemSchema`, `noCapturaSchema`, `noCondicaoSchema`,
      `noDirecionamentoSchema`) em `src/dtos/fluxo.dto.ts`. Campo puramente
      visual — o motor de execução nunca o lê, apenas armazena e devolve.
- [x] Confirmar que `MotorFluxoService`, `ExecucaoFluxoService` e
      `ValidacaoGrafoFluxoService` acessam apenas campos específicos
      (`id`, `tipo`, `dados.*`, `proximo`) e nunca fazem checagem exaustiva de
      chaves — a adição do campo não quebra a execução nem a validação.
- [x] `noFluxoSchema`/`definicaoFluxoSchema` já são reaproveitados por
      OpenAPI (`src/config/openapi.ts`), publicação (`publicacao-fluxo.service.ts`)
      e execução (`execucao-fluxo.service.ts`) — nenhuma mudança adicional
      necessária para o campo aparecer no Swagger e ser aceito/validado.

## Documentação

- [x] Documentar o campo em `docs/schemas/fluxo-json.md` (seção de nós +
      exemplo completo).

## Testes

- [x] `tests/fluxos-api.test.ts`: adicionado `posicao` ao nó de exemplo e uma
      asserção de que o `GET /fluxos/:id` devolve a mesma posição enviada no
      `POST` — round-trip via API real.
- [x] Suíte completa (`npm test`) permanece com 207 testes aprovados; nenhuma
      regressão.

## Checklist de saída

- [x] `npm run format:check`, `npm run lint`, `npm run typecheck` sem erros.
- [x] `npm test` (com bancos e Redis de teste) aprovado.
- [x] `npm run build` aprovado.
- [ ] Branch pronta para revisão e merge — aguardando commit/PR.
