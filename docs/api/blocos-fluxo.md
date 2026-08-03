# Catálogo de blocos do fluxo

## Objetivo

O endpoint `GET /api/v1/fluxos/blocos` é a fonte de verdade para a paleta e os
formulários do editor visual. Ele exige o access token do tenant e retorna
somente blocos aceitos pelo schema, pela publicação e pelo motor de execução da
versão atual.

O frontend não deve manter uma lista paralela de tipos disponíveis. Blocos que
não estiverem no catálogo devem permanecer ocultos.

## Montagem da paleta

Cada item de `blocos` contém:

- `tipo`: discriminador persistido em `definicao.nos[].tipo`;
- `nome`, `descricao`, `categoria` e `icone`: metadados da paleta. `icone` é
  uma chave semântica, não o nome de uma biblioteca específica;
- `comportamento`: informa se o motor pausa, produz uma saída ou permite que o
  fluxo termine naquele bloco;
- `campos`: definição do formulário lateral;
- `conexoes`: handles que o canvas deve disponibilizar;
- `configuracaoInicial`: dados de rascunho para criar o bloco no editor;
- `exemplo`: nó completo e válido para consulta e testes.

`configuracaoInicial` pode conter strings vazias ou listas vazias para permitir
a edição inicial. Esses valores não são necessariamente válidos para salvar. O
frontend deve aplicar `obrigatorio` e `validacao` antes de enviar o documento.

## Campos e fontes de opções

`caminho` usa a mesma localização que aparecerá nos erros de validação, por
exemplo `dados.texto` e `dados.setorId`. Os tipos iniciais de controle são:

| Tipo              | Controle sugerido                   |
| ----------------- | ----------------------------------- |
| `texto_curto`     | input de uma linha                  |
| `texto_longo`     | textarea com contador               |
| `variavel`        | input validado pelo padrão recebido |
| `lista_condicoes` | construtor ordenável de regras      |
| `referencia_no`   | seletor de bloco do canvas          |
| `seletor_setor`   | seletor remoto paginado             |

Uma `fonteOpcoes` com `tipo=endpoint` deve ser consultada com o mesmo bearer
token. Para setores, use os parâmetros fornecidos pelo catálogo e continue a
paginação caso existam mais de 100 registros. `campoValor=public_id` é o valor
persistido e `campoRotulo=nome` é o texto exibido.

As fontes `nos_fluxo` e `variaveis_fluxo` são locais:

- `nos_fluxo`: IDs dos demais blocos presentes no canvas;
- `variaveis_fluxo`: valores de `dados.variavel` dos blocos
  `captura_resposta` que podem alcançar a condição.

## Conexões e serialização

O ID interno do canvas pode ser diferente, mas o campo `id` enviado ao backend
deve respeitar `restricoesGrafo.padraoIdentificador`. Uma saída do tipo `unica`
aceita no máximo um destino. Uma saída `dinamica` cria um destino para cada
item da lista correspondente.

Mapeamento dos handles:

| Bloco              | Handle/atributo persistido | Regra                     |
| ------------------ | -------------------------- | ------------------------- |
| `mensagem`         | `proximo`                  | opcional, no máximo um    |
| `captura_resposta` | `proximo`                  | opcional, após a resposta |
| `condicao`         | `dados.regras[].entao`     | um por regra              |
| `condicao`         | `dados.padrao`             | obrigatório               |
| `direcionar_setor` | nenhum                     | encerra automação         |

No construtor de condição, apresente separadamente variável, operador, valor e
destino. Ao salvar, serialize cada regra no contrato atual:

```json
{
  "se": "cliente.opcao == \"1\"",
  "entao": "atendimento"
}
```

Os operadores disponíveis vêm de `linguagemCondicao.operadores`. Não permita
JavaScript livre. O backend aceita apenas `==` e `!=` entre uma variável e uma
string entre aspas.

## Comportamento mínimo por bloco

- `mensagem`: emite o texto e avança; sem `proximo`, conclui o fluxo;
- `captura_resposta`: pode emitir a pergunta, pausa e salva a próxima mensagem
  na variável; sem `proximo`, conclui depois da captura;
- `condicao`: avalia regras na ordem e usa `padrao` se nenhuma corresponder;
- `direcionar_setor`: emite o direcionamento, grava o setor e conclui a
  automação para que o atendimento humano assuma.

## Ciclo recomendado da tela

1. Consulte o catálogo ao abrir o editor e mantenha-o em cache pela sessão.
2. Monte paleta, formulários e handles a partir da resposta.
3. Crie IDs estáveis e únicos para os blocos.
4. Converta as arestas do canvas nos atributos definidos em `conexoes.saidas`.
5. Valide campos localmente e envie a definição completa no `POST` ou `PUT`.
6. Na publicação, associe `erro.detalhes.erros[].noId` ao bloco e `campo` ao
   controle correspondente.
7. Use `/api/v1/fluxos/{fluxoId}/simular` para validar o comportamento antes da
   publicação em produção.

Os contratos completos de persistência e simulação estão em
[Fluxos e editor](fluxos.md) e [Schema JSON](../schemas/fluxo-json.md).
