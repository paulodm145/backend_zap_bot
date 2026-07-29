# Banco de dados e conversões

- Toda tabela usa `id` inteiro, sequencial, como chave primária:
  `Int @id @default(autoincrement())`.
- Quando necessário em rotas públicas, adicione `public_id` UUID único. O UUID
  é adicional e não substitui a chave primária.
- Toda tabela possui `created_at` e `updated_at`, inclusive tabelas
  associativas.
- Armazene timestamps em UTC.
- Crie índices com base nos filtros, joins, buscas e ordenações reais.
- Revise índices ao criar ou alterar consultas relevantes; evite índices
  especulativos e redundantes.
- Avalie consultas críticas com `EXPLAIN`/`EXPLAIN ANALYZE` quando possível.
- Centralize conversões reutilizáveis em helpers compartilhados de
  `src/helpers/`.
- Helpers devem ser puros, tipados, testados e não podem aceitar valores
  inválidos silenciosamente.
- Validação de entrada continua sendo responsabilidade dos schemas Zod.
- Migrations do banco central/admin e dos bancos de tenant permanecem em
  schemas e diretórios separados.
- Cada contexto de banco possui scripts próprios para gerar, validar e aplicar
  migrations; nunca aplicar migrations de tenant no banco central.
- A conexão do tenant é resolvida pelo e-mail autenticado e pelos metadados do
  banco central. Subdomínio, header, query string e body nunca escolhem banco.
