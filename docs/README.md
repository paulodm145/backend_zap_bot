# Documentação do backend

## Organização

```text
docs/
  PRD.md
  ARQUITETURA-BACKEND.md
  DIAGNOSTICO-INICIAL.md
  TAREFAS-ESTRUTURA-BASE.md
  api/
    autenticacao.md
    fluxos.md
    conversas.md
    setores.md
    atendentes.md
    tenants.md
    integracoes.md
  eventos/
    websocket.md
    webhook-whatsapp.md
  schemas/
    fluxo-json.md
  erros/
    codigos.md
```

Crie somente os arquivos necessários às funcionalidades implementadas. A
estrutura acima é uma referência de organização, não uma exigência para gerar
documentos vazios antecipadamente.

Documentos funcionais disponíveis:

- [Autenticação](api/autenticacao.md)
- [Admin interno](api/admin-interno.md)
- [Banco central](banco-central.md)
- [Operação multi-tenant](multitenancy.md)

## Swagger e Markdown

Toda rota deve possuir duas formas complementares de documentação:

1. Swagger/OpenAPI gerado a partir dos schemas Zod, contendo o contrato
   executável.
2. Markdown organizado por funcionalidade, explicando como o frontend combina
   os endpoints para montar telas e jornadas.

O Markdown não deve duplicar mecanicamente o schema inteiro do Swagger. Ele
deve fornecer contexto de consumo, fluxo e comportamento de interface.

## Modelo de documento funcional

```markdown
# Nome da funcionalidade

## Objetivo e permissões

Qual problema resolve e quais perfis podem acessar.

## Telas e jornadas suportadas

Quais telas, modais ou etapas utilizam esta funcionalidade.

## Fluxo recomendado

Ordem das chamadas, pré-condições e efeitos das ações.

## Endpoints

Tabela resumida com método, rota, autenticação e finalidade.

## Composição das telas

Campos necessários para lista, detalhe e formulário; ações disponíveis;
confirmações; paginação, busca, filtros e ordenação.

## Estados da interface

Carregamento, lista vazia, sucesso, validação, erro, sessão expirada e acesso
negado.

## Requests e responses

Exemplos completos, incluindo campos opcionais, nullable, enums e formatos.

## Erros

Códigos, status HTTP e comportamento esperado do frontend.

## Atualização de dados

Eventos WebSocket, polling, invalidação de cache ou necessidade de refetch.
```

## Regra de atualização

Uma mudança em rota, DTO, autenticação, erro, webhook, evento WebSocket ou
schema de fluxo só está concluída quando Swagger e Markdown estiverem
sincronizados com o código.
