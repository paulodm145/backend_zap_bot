# TypeScript e qualidade

- Mantenha `strict`, `noImplicitAny`, `strictNullChecks` e
  `noUncheckedIndexedAccess`.
- Não use `any`; use `unknown` com validação ou narrowing.
- Valide fronteiras com Zod e derive os tipos dos schemas.
- Use pt-BR no domínio e nomes descritivos.
- Prefira `const`, imutabilidade e funções pequenas.
- Controllers não contêm regra de negócio; repositories não tomam decisões de
  domínio.
- Use erros tipados e o middleware central de erros.
- Antes de concluir, rode lint, typecheck e testes disponíveis.
