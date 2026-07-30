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
em `variaveis["menu.opcao"]`.

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

## Regras semânticas

- `noInicial` deve existir;
- IDs não podem se repetir;
- toda referência deve apontar para um nó;
- todos os nós devem ser alcançáveis;
- ciclos não são permitidos nesta versão determinística;
- expressões de condição devem seguir a gramática segura;
- setores referenciados devem existir e estar ativos;
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
      "proximo": "capturar"
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
