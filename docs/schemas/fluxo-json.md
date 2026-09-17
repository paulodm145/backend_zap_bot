# Schema JSON de fluxo — versão 1

## Estrutura raiz

```json
{
  "schemaVersao": 1,
  "noInicial": "inicio",
  "nos": []
}
```

`schemaVersao` versiona o contrato do JSON, não a publicação. A versão
publicada é controlada separadamente pelo backend.

IDs de nós começam com letra e aceitam letras, números, `_` e `-`, com até 64
caracteres. Devem ser únicos dentro do fluxo.

Todo nó aceita opcionalmente `"posicao": { "x": number, "y": number }` —
coordenada do bloco no canvas do editor. É puramente visual: o motor de
execução nunca lê esse campo, só o backend guarda e devolve para que o editor
restaure cada bloco exatamente onde o usuário o deixou. Fluxos salvos antes
deste campo existir simplesmente não o têm; o editor usa um layout inicial só
nesse caso.

## Nó de mensagem

```json
{
  "id": "inicio",
  "tipo": "mensagem",
  "dados": { "texto": "Olá! Como posso ajudar?" },
  "proximo": "capturar_opcao"
}
```

`proximo` é opcional. Sem ele, a execução termina após emitir a mensagem.

`dados.texto` aceita `{{variavel}}`, substituído por qualquer variável já
capturada ou extraída no fluxo (mesmo parser de `integracao_http`, sem
`eval`). Variável ausente no momento do envio **não** quebra a mensagem nem a
esvazia: o texto sai como está, com `{{variavel}}` literal — sinal visível de
que o fluxo referencia algo que ainda não existe naquele ponto, para o autor
corrigir. Esta versão não valida essas referências na publicação.

## Nó de captura

```json
{
  "id": "capturar_opcao",
  "tipo": "captura_resposta",
  "dados": {
    "variavel": "menu.opcao",
    "mensagem": "Digite uma opção"
  },
  "proximo": "decidir"
}
```

O motor pausa nesse nó. A mensagem recebida na execução seguinte é armazenada
em `variaveis["menu.opcao"]`. `dados.mensagem` também aceita `{{variavel}}`,
com a mesma regra de fallback do nó de mensagem.

## Nó de condição

```json
{
  "id": "decidir",
  "tipo": "condicao",
  "dados": {
    "regras": [
      { "se": "menu.opcao == \"1\"", "entao": "setor_fiscal" },
      { "se": "menu.opcao != \"1\"", "entao": "fim" }
    ],
    "padrao": "fim"
  }
}
```

A linguagem segura aceita exclusivamente:

```text
variavel == "valor"
variavel != "valor"
```

Aspas simples também são aceitas. Não há JavaScript, chamadas de função,
interpolação ou `eval`. A primeira regra verdadeira vence; `padrao` é usado
quando nenhuma corresponde.

## Nó de direcionamento

```json
{
  "id": "setor_fiscal",
  "tipo": "direcionar_setor",
  "dados": {
    "setorId": "11111111-1111-4111-8111-111111111111"
  }
}
```

`setorId` é o `public_id` UUID de um setor ativo do tenant. O nó encerra o
trecho automatizado e produz uma saída de direcionamento.

## Nó de integração HTTP

```json
{
  "id": "consultar_pedido",
  "tipo": "integracao_http",
  "dados": {
    "credencialId": "22222222-2222-4222-8222-222222222222",
    "metodo": "GET",
    "url": "https://api.erp-exemplo.com/v1/pedidos/{{cliente.pedido}}",
    "mapeamentoResposta": { "pedido.status": "$.dados.status" }
  },
  "sucesso": "responder_status",
  "falha": "transferir_humano"
}
```

| Campo                | Regra                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `credencialId`       | `public_id` de uma credencial ativa em `/api/v1/integracoes`                               |
| `metodo`             | `GET`, `POST`, `PUT`, `PATCH` ou `DELETE`                                                  |
| `url`                | Precisa começar pelo `base_url` da credencial; aceita `{{variavel}}` no caminho e na query |
| `corpo`              | Opcional, até 4096 caracteres, também aceita `{{variavel}}`                                |
| `mapeamentoResposta` | Até 20 pares `variavel` → caminho (`$.a.b[0].c`)                                           |
| `sucesso` / `falha`  | Referências opcionais; ausentes, o fluxo conclui ali                                       |

O motor **pausa** neste nó: a chamada é feita fora dele e o resultado é
reaplicado, o que mantém o motor puro e sem I/O. Uma execução faz no máximo 5
chamadas externas.

A chamada segue por `falha` quando a credencial some ou é desativada, quando
falta variável usada na URL ou no corpo, quando a URL sai da base autorizada,
quando o host resolve para rede privada, em timeout, redirecionamento, status
de erro, resposta não-JSON ou resposta acima de 256 KB. Campo mapeado que não
existe na resposta apenas não vira variável — isso continua sendo sucesso.

## Regras semânticas

- `noInicial` deve existir;
- IDs não podem se repetir;
- toda referência deve apontar para um nó;
- todos os nós devem ser alcançáveis;
- ciclos não são permitidos nesta versão determinística;
- expressões de condição devem seguir a gramática segura;
- setores referenciados devem existir e estar ativos;
- credenciais de integração devem existir e estar ativas;
- a URL do nó de integração deve caber no `base_url` da credencial;
- cada execução é limitada a no máximo 100 passos.

## Exemplo completo

```json
{
  "schemaVersao": 1,
  "noInicial": "inicio",
  "nos": [
    {
      "id": "inicio",
      "tipo": "mensagem",
      "dados": { "texto": "Escolha 1 para Fiscal" },
      "proximo": "capturar",
      "posicao": { "x": 120, "y": 60 }
    },
    {
      "id": "capturar",
      "tipo": "captura_resposta",
      "dados": { "variavel": "opcao" },
      "proximo": "condicao"
    },
    {
      "id": "condicao",
      "tipo": "condicao",
      "dados": {
        "regras": [{ "se": "opcao == \"1\"", "entao": "fiscal" }],
        "padrao": "fim"
      }
    },
    {
      "id": "fiscal",
      "tipo": "direcionar_setor",
      "dados": {
        "setorId": "11111111-1111-4111-8111-111111111111"
      }
    },
    {
      "id": "fim",
      "tipo": "mensagem",
      "dados": { "texto": "Opção inválida" }
    }
  ]
}
```
