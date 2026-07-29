# AGENTS.md

## Contexto

Este repositório é o backend de uma plataforma SaaS multi-tenant de automação
de atendimento no WhatsApp com editor visual de fluxos (estilo URA), IA via
LangChain, integrações com sistemas externos (ERP/CRM) e atendimento humano por
setores. O desenvolvimento já foi iniciado neste repositório.

Antes de analisar, planejar ou alterar qualquer coisa, leia integralmente:

1. `docs/PRD.md` — visão de produto, escopo e prioridades do MVP.
2. `docs/ARQUITETURA-BACKEND.md` — stack, modelo de dados, multi-tenancy,
   autenticação, contratos de API e padrões de código.

Em caso de conflito, siga nesta ordem:

1. pedido atual do usuário;
2. `docs/ARQUITETURA-BACKEND.md` para decisões técnicas;
3. `docs/PRD.md` para regras e escopo do produto;
4. este arquivo;
5. padrões já consolidados no código.

Não altere uma decisão registrada silenciosamente. Quando uma necessidade
exigir outra abordagem, explique o conflito e atualize a documentação junto
com o código após aprovação.

## Primeira tarefa obrigatória: diagnóstico

Na primeira atuação sobre o repositório, antes de implementar qualquer
funcionalidade:

1. percorra a estrutura atual, incluindo pastas, arquivos, dependências,
   configurações, testes e padrões já usados;
2. compare o estado real com `docs/PRD.md` e
   `docs/ARQUITETURA-BACKEND.md`;
3. apresente objetivamente:
   - o que está implementado e alinhado;
   - o que está implementado, mas diverge, apontando a diferença específica
     sem presumir qual lado está correto;
   - o que ainda não foi implementado e está pendente;
4. não altere código durante esse diagnóstico.

Depois do diagnóstico, aguarde a priorização do usuário. Se uma implementação
solicitada esbarrar em divergência já identificada, avise antes de prosseguir;
não escolha silenciosamente entre o código atual e a documentação.

## Estado atual e foco

O projeto está na fase inicial de especificação. As primeiras entregas
esperadas são:

- schema Prisma do banco central e do banco de cada tenant;
- provisionamento e migrations multi-tenant idempotentes;
- esqueleto do motor de execução de fluxos;
- fundações da API, autenticação, filas e observabilidade.

Implemente somente o necessário para a solicitação atual. Não antecipe itens
do roadmap pós-MVP nem crie abstrações sem um uso concreto.

## Planejamento, tarefas e branches

- `docs/TAREFAS-ESTRUTURA-BASE.md` é a fonte de verdade do progresso da
  estrutura base.
- Antes de iniciar uma atividade, localize sua etapa e confirme dependências,
  branch, arquivos afetados e critério de aceite.
- Cada etapa deve ser desenvolvida em uma branch própria, criada a partir da
  `main` atualizada. Não reutilize a branch de uma etapa encerrada.
- Use os prefixos `chore/`, `feat/`, `fix/`, `refactor/`, `docs/` ou `test/`
  conforme a natureza da etapa.
- Uma tarefa concluída deve ser alterada de `[ ]` para `[x]` no mesmo commit que
  entrega seu resultado.
- Nunca marque uma tarefa com base apenas na existência de arquivos. Execute o
  critério de aceite e registre a evidência quando aplicável.
- Se uma tarefa ficar bloqueada, mantenha `[ ]` e acrescente
  `Bloqueada: <motivo>` sem ocultar o impedimento.
- Se surgir trabalho novo, adicione uma tarefa atômica na etapa correta antes
  de implementar. Não use itens genéricos como “finalizar módulo”.
- Ao concluir uma etapa, confirme que todas as tarefas e o checklist de saída
  estão marcados, rode a validação completa e só então prepare o merge.
- Não inicie etapa dependente enquanto a anterior necessária não estiver
  integrada, salvo autorização explícita para branches empilhadas.

## Stack obrigatória

- Node.js, Express e TypeScript estrito;
- Prisma e PostgreSQL;
- Redis para estado, cache e idempotência;
- BullMQ para processamento assíncrono;
- Socket.io para comunicação em tempo real;
- Zod para validar entradas, ambiente e contratos;
- `@asteasolutions/zod-to-openapi` para derivar OpenAPI dos schemas Zod;
- `fetch` nativo para chamadas HTTP;
- logs estruturados com Pino;
- Docker Compose e PM2 no deploy.

Antes de adicionar uma dependência, verifique se a plataforma ou a stack atual
já resolve o problema. Não introduza framework de injeção de dependência.

## Idioma e convenções

- Use pt-BR em entidades, variáveis, métodos de domínio e mensagens de erro.
- Preserve em inglês termos técnicos consolidados, como `Controller`,
  `Repository`, `Request`, `Response`, `Worker` e nomes de bibliotecas.
- Use nomes descritivos e evite abreviações obscuras.
- Prefira `const`, objetos imutáveis e funções pequenas de responsabilidade
  única.
- Não use `any`. Para dados desconhecidos, use `unknown` e faça validação ou
  narrowing antes do acesso.
- Use commits semânticos no padrão Conventional Commits.
- Formato obrigatório:
  `<tipo>(<escopo-opcional>): <descrição curta no imperativo>`.
- Tipos aceitos como referência: `feat`, `fix`, `refactor`, `docs`, `test`,
  `build`, `ci`, `chore`, `perf`, `style` e `revert`.
- Use escopos de domínio quando ajudarem, por exemplo:
  `feat(auth): adiciona rotação do refresh token`.
- Mudança incompatível deve usar `!` e explicar o impacto no rodapé
  `BREAKING CHANGE:`.
- Cada commit deve representar uma unidade lógica; não misture alteração
  funcional, refatoração não relacionada e formatação ampla no mesmo commit.
- Não use mensagens genéricas como `ajustes`, `alterações` ou `wip`.
- Siga ESLint e Prettier quando suas configurações existirem.

## Organização do backend

Siga o fluxo:

```text
Controller -> Service (quando necessário) -> Repository -> Prisma
```

- Controller valida DTO, chama a camada adequada e formata a resposta.
- CRUD direto, sem regra adicional, pode chamar o Repository.
- Service existe apenas para regra de negócio, orquestração, transação
  complexa ou efeito colateral.
- Repository contém somente acesso a dados.
- Não coloque regra de negócio em Controller ou Repository.
- Use injeção de dependência simples por construtor.

Estrutura de referência:

```text
src/
  controllers/
  services/
  repositories/
  dtos/
  middlewares/
  errors/
  workers/
  utils/
  types/
```

### Imports entre camadas

- Organize o código em pastas horizontais. Não crie novamente uma árvore
  paralela `src/modulos/`.
- Use imports relativos com extensão `.js`, conforme `NodeNext`, enquanto não
  houver alias configurado e validado para build, testes e produção.
- Controllers podem importar DTOs, Services e tipos compartilhados.
- Services podem importar contratos de Repositories, erros, helpers e outros
  Services quando houver orquestração justificada.
- Repositories podem importar tipos de persistência, helpers técnicos e erros
  de acesso a dados, mas não Controllers.
- DTOs e helpers não importam Controllers, Services ou Repositories.
- Rotas compõem middlewares e Controllers; não contêm regra de negócio.
- Evite ciclos. Se duas camadas precisarem importar uma à outra, extraia o
  contrato compartilhado para `types/` ou para um contrato de Repository.

## Regras arquiteturais inegociáveis

### Multi-tenancy

- O isolamento principal é físico: um banco PostgreSQL por tenant.
- `central_db` guarda autenticação, tenants, planos, assinaturas e metadados de
  conexão.
- Tabelas do banco do tenant não recebem `tenant_id`.
- Resolva a conexão pelo usuário autenticado e nunca aceite do cliente o nome
  do banco ou uma string de conexão.
- A resolução começa pelo e-mail autenticado; subdomínio nunca determina
  tenant ou conexão.
- Mantenha migrations do banco central/admin e dos bancos de tenant em schemas
  e diretórios separados, com scripts independentes de atualização.
- Redis e filas são compartilhados; toda chave e todo job devem carregar
  namespace ou identidade explícita do tenant.
- Nunca permita que dados, credenciais, cache, eventos WebSocket ou jobs de um
  tenant sejam acessíveis por outro.

### Mensagens e filas

- Valide `X-Hub-Signature-256` antes de aceitar o webhook da Meta.
- Responda ao webhook em menos de um segundo e mova trabalho pesado para
  BullMQ.
- Garanta idempotência pelo identificador único da mensagem.
- Jobs devem ser seguros para retry e configurar backoff quando chamarem
  serviços externos.
- Persista histórico e consumo; Redis não é a fonte permanente do histórico.

### Segurança

- Nunca versione segredos, tokens ou strings de conexão.
- Criptografe em repouso tokens do WhatsApp, credenciais externas, strings de
  conexão e segredos TOTP.
- Não registre segredos, payloads sensíveis ou dados pessoais sem necessidade.
- Valide toda entrada externa com Zod.
- Use queries parametrizadas/Prisma e aplique timeout e limites nas integrações
  HTTP.
- Separe autenticação de tenant e autenticação interna de `super_admin`.
- Proteja Swagger, Bull Board e painel interno em produção.

### Fluxos

- O fluxo publicado é um grafo versionado em JSONB.
- Valide referências, alcançabilidade, nó inicial, credenciais e setores antes
  da publicação.
- Nunca execute expressão arbitrária vinda do JSON com `eval` ou equivalentes.
- Diferencie claramente rascunho de versão publicada.
- Mudanças no contrato do grafo precisam preservar ou migrar versões
  anteriores de forma explícita.

## API e persistência

- Prefixe rotas com `/api/v1`.
- Valide `body`, `params` e `query` usando schemas Zod.
- Derive os tipos TypeScript desses schemas; não duplique interfaces manuais.
- Responda erros no formato:

```json
{ "erro": { "codigo": "NAO_ENCONTRADO", "mensagem": "Fluxo não encontrado" } }
```

- Centralize erros em classes de domínio e middleware único; evite `try/catch`
  repetido em controllers.
- Listagens usam `skip`, `take` e `busca`, retornando `dados`, `total`, `skip`
  e `take`. Limite `take` a um máximo configurável.
- Entidades principais usam soft delete quando previsto na arquitetura.
- Claims de conversa devem ser atômicos e verificar o número de linhas
  alteradas.
- Migrations multi-tenant devem registrar resultado por banco; falha em um
  tenant não pode ocultar nem desfazer o resultado dos demais.

### Identificadores, auditoria e índices

- Toda tabela deve possuir `id` inteiro como chave primária, gerado por
  sequência/identity do banco. No Prisma, use como referência:
  `id Int @id @default(autoincrement())`.
- UUID não substitui a chave primária inteira. Quando uma entidade precisar ser
  exposta em rota pública ou não for seguro revelar IDs sequenciais, adicione
  um identificador público separado, por exemplo:
  `public_id UUID UNIQUE`.
- Gere o identificador público no servidor/banco e nunca aceite que o cliente
  escolha seu valor.
- Toda tabela deve possuir `created_at` e `updated_at`, inclusive tabelas
  associativas. No Prisma, use `@default(now())` e `@updatedAt` conforme
  apropriado.
- Defina claramente se timestamps são armazenados em UTC. A aplicação só deve
  converter fuso horário nas bordas de entrada e saída.
- Crie índices para colunas usadas em filtros, busca, ordenação, joins,
  resolução de unicidade e consultas recorrentes.
- Índices compostos devem respeitar a ordem real dos filtros e da ordenação das
  consultas. Não crie índices especulativos sem uma consulta que os justifique.
- Toda nova consulta relevante deve ser revisada junto com seus índices. Para
  consultas críticas, valide o plano com `EXPLAIN`/`EXPLAIN ANALYZE` quando
  houver banco e volume representativos.
- Considere que índices têm custo de escrita e armazenamento; evite índices
  redundantes ou cobertos por índices existentes.
- As regras desta seção substituem exemplos antigos da arquitetura que usam
  UUID diretamente como chave primária.

### Conversão e normalização de valores

- Conversões reutilizáveis pertencem a helpers compartilhados em `src/helpers/`
  ou módulo comum equivalente, nunca duplicadas em controllers, services ou
  repositories.
- Helpers devem ser funções puras, pequenas, tipadas e testadas.
- Exemplos: centavos para moeda, datas, telefone, booleanos vindos do ambiente,
  enums externos, normalização de texto e serialização de valores.
- Conversão não substitui validação: entradas externas continuam sendo
  validadas com Zod antes de chegar à regra de negócio.
- Não use helpers genéricos que silenciem valores inválidos. Quando uma
  conversão puder falhar, retorne resultado explícito ou lance um erro de
  domínio apropriado.
- Formatação específica da interface deve permanecer no frontend; o backend
  normaliza e serializa contratos, mas não produz texto meramente visual.

## Contrato obrigatório de autenticação do frontend

O frontend já depende deste contrato. Ele prevalece sobre exemplos genéricos e
não pode ser alterado sem coordenação explícita com o frontend.

### Login

`POST /api/v1/auth/login`

Request:

```json
{ "email": "usuario@empresa.com", "senha": "senha-do-usuario" }
```

Response `200`:

```json
{
  "accessToken": "jwt",
  "usuario": {
    "id": "uuid",
    "nome": "Nome",
    "email": "usuario@empresa.com",
    "tenantId": "uuid"
  }
}
```

- Envie o refresh token também em `Set-Cookie`.
- O cookie deve usar `HttpOnly`, `Secure`, `SameSite=None`,
  `Path=/api/v1/auth` e expiração longa entre 7 e 30 dias.
- O access token é um JWT de curta duração, com referência inicial de 15
  minutos.
- Credenciais inválidas retornam `401`:

```json
{
  "erro": {
    "codigo": "CREDENCIAIS_INVALIDAS",
    "mensagem": "E-mail ou senha inválidos"
  }
}
```

### Renovação

`POST /api/v1/auth/refresh`

- Não recebe corpo.
- Lê o refresh token do cookie `HttpOnly`.
- Retorna `200` com `{ "accessToken": "jwt" }`.
- Rotacione o refresh token e renove seu cookie.
- Token ausente, inválido, revogado ou expirado retorna `401` no formato
  padrão de erro.

### Logout

`POST /api/v1/auth/logout`

- Invalida o refresh token no servidor.
- Limpa o cookie usando o mesmo nome e atributos, com expiração no passado.

### CORS e endpoints protegidos

- Configure `credentials: true`.
- Restrinja `origin` ao domínio exato do frontend; nunca use `*`.
- Endpoints protegidos recebem
  `Authorization: Bearer <accessToken>`.
- Token ausente, inválido ou expirado retorna `401` no formato padrão.
- Não confunda este contrato de autenticação dos tenants com a autenticação
  separada do painel interno de `super_admin`.

## Testes e verificação

Para cada mudança:

1. execute formatação, lint, checagem de tipos e testes disponíveis;
2. adicione testes para a regra alterada e para caminhos de falha relevantes;
3. priorize motor de fluxo, roteamento/claim, autenticação, isolamento de
   tenant, idempotência e provisionamento;
4. não dependa de APIs reais em testes unitários;
5. informe comandos executados e qualquer verificação que não pôde ser feita.

Não reduza a cobertura útil removendo testes ou afrouxando tipos para fazer a
pipeline passar.

## Documentação

- Zod é a fonte de verdade dos contratos HTTP e alimenta o OpenAPI.
- Toda rota deve estar documentada no Swagger/OpenAPI e no arquivo Markdown da
  funcionalidade correspondente.
- Organize a documentação funcional em `docs/api/<funcionalidade>.md`, por
  exemplo `autenticacao.md`, `fluxos.md`, `conversas.md`, `setores.md`,
  `atendentes.md`, `tenants.md` e `integracoes.md`.
- Não crie um arquivo Markdown por endpoint quando eles pertencem ao mesmo
  fluxo funcional. Mantenha juntos os endpoints que o frontend consome para
  montar uma tela ou jornada.
- O Swagger descreve o contrato executável: método, rota, autenticação,
  parâmetros, schemas, exemplos, status HTTP e erros.
- O Markdown explica como consumir e combinar os contratos para construir a
  experiência do frontend.
- Todo script do projeto deve constar no README principal com finalidade,
  pré-requisitos e exemplos executáveis.
- Cada documento funcional deve incluir, quando aplicável:
  - objetivo da funcionalidade e perfis autorizados;
  - telas ou jornadas que os endpoints suportam;
  - sequência recomendada de chamadas;
  - campos necessários para listagem, detalhe e formulários;
  - regras de validação e mensagens/códigos de erro;
  - paginação, busca, filtros e ordenação;
  - estados de carregamento, vazio, sucesso, erro e acesso negado;
  - efeitos de ações e necessidade de confirmação;
  - exemplos completos de request e response;
  - cookies, headers e requisitos de CORS;
  - eventos WebSocket, polling ou atualização em tempo real;
  - observações de responsividade ou composição somente quando decorrerem do
    contrato, sem impor decisões puramente visuais.
- Atualize Swagger e Markdown no mesmo trabalho que alterar uma rota, webhook,
  evento WebSocket, código de erro ou schema JSON de fluxo.
- A documentação deve indicar claramente campos opcionais, nullable,
  enumerações, formatos de data/valor e diferenças de permissão.
- Registre novas decisões estruturais na documentação de arquitetura.
- Mantenha exemplos sem segredos e coerentes com o comportamento real.

## Critério de conclusão

Uma tarefa só está concluída quando o comportamento solicitado foi
implementado, os limites de tenant e segurança foram preservados, as
verificações proporcionais ao risco passaram e a documentação afetada está
sincronizada.
