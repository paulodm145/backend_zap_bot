# Contribuição e checks de qualidade

## Fluxo de trabalho

Cada etapa deve ser desenvolvida em uma branch própria, com commits no padrão
Conventional Commits. Antes de abrir o pull request, atualize a lista em
`docs/TAREFAS-ESTRUTURA-BASE.md` e execute:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit --omit=dev --audit-level=high
```

Testes de integração exigem PostgreSQL, dois bancos tenant já migrados e Redis.
O workflow cria esse ambiente automaticamente. O procedimento local completo
está no `README.md`.

## Check obrigatório do pull request

O check **Qualidade / Validar backend** deve concluir antes do merge. A proteção
da branch `main` deve exigir esse check, branch atualizada e aprovação de revisão.
O workflow verifica:

- instalação reproduzível com `npm ci` e cache baseado no `package-lock.json`;
- Prettier, ESLint, TypeScript estrito, testes, cobertura e build;
- geração do documento OpenAPI;
- PostgreSQL 17 e Redis 7 reais para integrações;
- migrations centrais e tenant aplicadas separadamente;
- migration versionada quando um schema Prisma muda;
- ausência de `.env` e variantes no Git, exceto `.env.example`;
- vulnerabilidades altas ou críticas nas dependências de produção.

Os limites iniciais de cobertura ficam em `vitest.config.ts`: 80% para linhas,
statements e funções, e 70% para branches. A redução desses limites exige decisão
explícita e documentada.

## Contratos e documentação

Uma alteração de endpoint deve atualizar no mesmo pull request:

1. schemas Zod que geram o Swagger;
2. testes de geração OpenAPI;
3. documento Markdown da função em `docs/api/`;
4. instruções de tela, estados, ações e erros relevantes para o frontend;
5. schema funcional em `docs/schemas/`, quando houver payload de domínio.

## Banco de dados

Mudanças no banco central/admin pertencem a `prisma/central/migrations/`.
Mudanças dos bancos físicos de tenant pertencem a
`prisma/tenant/migrations/`. Nunca misture os dois conjuntos. Os comandos e
exemplos para criar e aplicar migrations estão documentados no `README.md`.

## Teste dos controles

Para comprovar que o pipeline bloqueia regressões, uma branch de validação pode
introduzir temporariamente:

- uma violação de lint, confirmando falha na etapa `Executar lint`;
- uma asserção de teste incorreta, confirmando falha em
  `Executar testes e cobertura mínima`.

Essas alterações temporárias nunca devem ser integradas. A execução normal em
branch limpa deve permanecer verde.
