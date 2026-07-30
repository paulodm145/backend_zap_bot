# Fluxos e editor visual

## Objetivo e permissões

As rotas permitem ao usuário autenticado do tenant listar, editar, publicar,
simular e excluir fluxos do próprio banco físico. O access token deve ser
enviado como `Authorization: Bearer <token>`.

O backend nunca recebe `tenant_id`, nome de banco ou conexão nas rotas. O
tenant é resolvido pelo e-mail e pelo `tenantId` do JWT.

## Telas suportadas

- lista de fluxos;
- editor visual de rascunho;
- modal de erros de publicação;
- simulador de conversa;
- confirmação de exclusão.

## Endpoints

| Método   | Rota                               | Finalidade               |
| -------- | ---------------------------------- | ------------------------ |
| `GET`    | `/api/v1/fluxos`                   | Lista paginada           |
| `POST`   | `/api/v1/fluxos`                   | Cria rascunho            |
| `GET`    | `/api/v1/fluxos/:fluxoId`          | Abre editor/detalhe      |
| `PUT`    | `/api/v1/fluxos/:fluxoId`          | Salva o rascunho         |
| `DELETE` | `/api/v1/fluxos/:fluxoId`          | Soft delete              |
| `POST`   | `/api/v1/fluxos/:fluxoId/publicar` | Publica versão imutável  |
| `POST`   | `/api/v1/fluxos/:fluxoId/simular`  | Simula sem WhatsApp real |

`fluxoId` é sempre o UUID `public_id`. IDs inteiros não são expostos.

## Composição da lista

Consulta:

```http
GET /api/v1/fluxos?skip=0&take=20&busca=fiscal&estado=RASCUNHO
```

`estado` aceita:

- `RASCUNHO`: possui alterações ainda não publicadas;
- `PUBLICADO`: a definição editável coincide com a última publicação.

Cada item fornece `nome`, `public_id`, `versao`, `ativo`,
`possui_alteracoes_nao_publicadas`, `publicado_at`, `created_at` e
`updated_at`. Use:

- `ativo=false`: nunca houve publicação disponível para execução;
- `ativo=true` e alterações pendentes: existe versão em produção, mas o editor
  contém um novo rascunho;
- `ativo=true` sem alterações pendentes: última edição já publicada.

Paginação segue `{ dados, total, skip, take }`. A tela deve preservar `busca` e
`estado` ao trocar de página.

## Editor e salvamento

Criação e atualização usam:

```json
{
  "nome": "Atendimento Fiscal",
  "definicao": {
    "schemaVersao": 1,
    "noInicial": "inicio",
    "nos": [
      {
        "id": "inicio",
        "tipo": "mensagem",
        "dados": { "texto": "Olá!" }
      }
    ]
  }
}
```

O `PUT` altera somente `fluxos.definicao`, que é o rascunho. Registros de
`fluxo_versoes` nunca são alterados. Depois de salvar, invalide o cache da lista
e do detalhe.

Validações estruturais do Zod retornam `422 VALIDACAO`. A especificação
completa dos nós está em [Schema JSON dos fluxos](../schemas/fluxo-json.md).

## Publicação e erros por nó

Antes de publicar, o backend valida referências, alcançabilidade, ciclos,
condições e setores. Em sucesso, cria a próxima versão (`1`, `2`, ...) dentro
de uma transação e responde `201`.

Um grafo inválido retorna:

```json
{
  "erro": {
    "codigo": "VALIDACAO",
    "mensagem": "O grafo do fluxo é inválido",
    "detalhes": {
      "erros": [
        {
          "codigo": "REFERENCIA_INEXISTENTE",
          "noId": "menu",
          "campo": "dados.regras.0.entao",
          "mensagem": "O nó referenciado \"fiscal\" não existe"
        }
      ]
    }
  }
}
```

O editor deve localizar o nó por `noId`, destacar `campo` e exibir `mensagem`.
Erros sem `noId`, como `noInicial` inexistente, devem aparecer no painel geral
do fluxo. Códigos possíveis:

- `NO_DUPLICADO`;
- `NO_INICIAL_INEXISTENTE`;
- `REFERENCIA_INEXISTENTE`;
- `NO_INALCANCAVEL`;
- `CICLO_NAO_PERMITIDO`;
- `CONDICAO_INVALIDA`;
- `SETOR_INVALIDO`.

Publicar novamente sem alterações retorna `409 CONFLITO`.

## Simulador

A simulação sempre usa uma versão publicada e não chama a Cloud API. Na
primeira chamada envie:

```json
{ "maxPassos": 50 }
```

A resposta contém `saidas` e `estado`. Quando houver saída `captura`, mostre o
campo de mensagem. Na próxima chamada, devolva integralmente o `estado` e a
resposta digitada:

```json
{
  "mensagem": "1",
  "estado": {
    "fluxoVersaoId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "noAtualId": "capturar_opcao",
    "variaveis": {},
    "aguardandoCaptura": {
      "noId": "capturar_opcao",
      "variavel": "opcao",
      "proximo": "decidir"
    },
    "concluido": false,
    "passosExecutados": 2
  },
  "maxPassos": 50
}
```

Saídas possíveis:

- `mensagem`: renderizar o texto do bot;
- `captura`: aguardar uma entrada do usuário;
- `direcionamento`: informar que a conversa foi encaminhada ao setor.

O limite máximo é 100 passos por chamada. `LIMITE_EXECUCAO_FLUXO` indica uma
definição anormal e deve interromper a simulação.

## Estados de interface

- carregando: skeleton da lista ou do editor;
- vazio: oferecer ação “Criar fluxo”;
- salvando: desabilitar novo salvamento concorrente;
- alterações pendentes: habilitar “Publicar”;
- publicado: exibir número e data da versão;
- erro 401: executar o refresh já padronizado;
- erro 404: remover item do cache e voltar à lista;
- erro 409: refazer o detalhe;
- erro 422: mapear erros aos nós/campos.

Não há polling obrigatório. Após criar, atualizar, publicar ou excluir, faça
refetch do detalhe e invalide a listagem.
