CREATE TABLE "estados" (
    "id" SERIAL NOT NULL,
    "codigo_ibge" INTEGER NOT NULL,
    "sigla" VARCHAR(2) NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "nome_normalizado" VARCHAR(80) NOT NULL,
    "regiao" VARCHAR(30),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estados_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "municipios" (
    "id" SERIAL NOT NULL,
    "codigo_ibge" VARCHAR(12) NOT NULL,
    "estado_id" INTEGER NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "nome_normalizado" VARCHAR(150) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "municipios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "estados_codigo_ibge_key" ON "estados"("codigo_ibge");
CREATE UNIQUE INDEX "estados_sigla_key" ON "estados"("sigla");
CREATE INDEX "estados_ativo_nome_idx" ON "estados"("ativo", "nome");
CREATE INDEX "estados_nome_normalizado_idx" ON "estados"("nome_normalizado");
CREATE UNIQUE INDEX "municipios_codigo_ibge_key" ON "municipios"("codigo_ibge");
CREATE INDEX "municipios_estado_id_ativo_nome_idx" ON "municipios"("estado_id", "ativo", "nome");
CREATE INDEX "municipios_nome_normalizado_idx" ON "municipios"("nome_normalizado");

ALTER TABLE "municipios"
ADD CONSTRAINT "municipios_estado_id_fkey"
FOREIGN KEY ("estado_id") REFERENCES "estados"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
