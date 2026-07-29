# Documentação

- O PRD define escopo; o documento de arquitetura define implementação.
- OpenAPI deve ser derivado dos schemas Zod.
- Toda rota deve ser documentada no Swagger e em
  `docs/api/<funcionalidade>.md`.
- Agrupe no mesmo Markdown os endpoints usados pela mesma tela ou jornada.
- A documentação funcional deve orientar o frontend sobre sequência de
  chamadas, permissões, campos de listas/formulários, validações, paginação,
  filtros, estados de tela, erros e atualizações em tempo real.
- Inclua exemplos completos e identifique campos opcionais, nullable, enums e
  formatos.
- Ao alterar webhook, eventos Socket.io, autenticação, erros ou tipos de nó,
  atualize Swagger e o Markdown correspondente no mesmo trabalho.
- Não altere decisões registradas sem explicar a motivação e manter a
  documentação sincronizada.
- Exemplos devem refletir o código atual e nunca conter credenciais reais.
- Todo script adicionado ao `package.json` deve ser documentado no README
  principal, com finalidade, pré-requisitos e ao menos um exemplo executável.
