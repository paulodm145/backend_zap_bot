-- Prepara `credenciais_integracao` para uso real pelo bloco `integracao_http`.
--
-- `base_url` passa a delimitar o domínio que a credencial autoriza: a URL
-- montada pelo nó do fluxo precisa começar por ela, então o cadastro de
-- credenciais funciona como allowlist por tenant e evita que um fluxo aponte
-- para host interno ou para o metadata da nuvem.
--
-- `nome_normalizado` sustenta a busca e a checagem de nome duplicado sem
-- depender de collation, seguindo o mesmo padrão de `setores`.
--
-- A tabela foi criada junto do schema inicial do tenant, mas até aqui não
-- possuía nenhum código que escrevesse nela, por isso as colunas entram como
-- NOT NULL sem valor de preenchimento: se algum banco contiver linhas, a
-- migration falha de forma explícita em vez de inventar dado.
ALTER TABLE "credenciais_integracao" ADD COLUMN "base_url" VARCHAR(300) NOT NULL;

ALTER TABLE "credenciais_integracao" ADD COLUMN "nome_normalizado" VARCHAR(120) NOT NULL;

DROP INDEX IF EXISTS "credenciais_integracao_ativo_nome_idx";

CREATE INDEX "credenciais_integracao_ativo_nome_normalizado_idx"
ON "credenciais_integracao" ("ativo", "nome_normalizado");
