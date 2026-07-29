# Arquitetura e isolamento

- Preserve a separação `Controller -> Service quando necessário -> Repository`.
- Use banco PostgreSQL físico separado por tenant e `central_db` apenas para
  autenticação e metadados globais.
- Nunca derive a conexão do tenant de valores livres enviados pelo cliente.
- Inclua a identidade do tenant em chaves Redis, jobs BullMQ, salas Socket.io e
  logs estruturados.
- Trate webhook rapidamente; processamento de IA, integrações e envio de
  mensagens ocorre em workers.
- Faça operações externas e provisionamento de forma idempotente e segura para
  retry.
- Use `id` inteiro sequencial nas tabelas; UUID é apenas identificador público
  adicional quando necessário.
- Inclua `created_at` e `updated_at` em todas as tabelas e projete índices a
  partir das consultas reais.
- Não use `eval` para interpretar condições do grafo de fluxo.
- Questione e documente qualquer mudança que contradiga
  `docs/ARQUITETURA-BACKEND.md`.
