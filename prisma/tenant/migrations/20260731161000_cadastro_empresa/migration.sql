CREATE TABLE "empresas" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chave" VARCHAR(20) NOT NULL DEFAULT 'PADRAO',
    "razao_social" VARCHAR(180),
    "nome_fantasia" VARCHAR(180),
    "cnpj" VARCHAR(14),
    "email" VARCHAR(254),
    "telefone" VARCHAR(16),
    "site" VARCHAR(255),
    "cep" VARCHAR(8),
    "logradouro" VARCHAR(180),
    "numero" VARCHAR(30),
    "complemento" VARCHAR(120),
    "bairro" VARCHAR(120),
    "municipio_codigo_ibge" VARCHAR(12),
    "municipio_nome" VARCHAR(150),
    "uf" VARCHAR(2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "empresas_public_id_key" ON "empresas"("public_id");
CREATE UNIQUE INDEX "empresas_chave_key" ON "empresas"("chave");
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");
CREATE INDEX "empresas_municipio_codigo_ibge_idx" ON "empresas"("municipio_codigo_ibge");
CREATE INDEX "empresas_uf_municipio_nome_idx" ON "empresas"("uf", "municipio_nome");
