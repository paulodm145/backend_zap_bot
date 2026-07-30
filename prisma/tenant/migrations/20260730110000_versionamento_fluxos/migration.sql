CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "fluxos"
ADD COLUMN "possui_alteracoes_nao_publicadas" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "publicado_at" TIMESTAMPTZ(3),
ADD COLUMN "deletado_at" TIMESTAMPTZ(3);

ALTER TABLE "fluxos"
ALTER COLUMN "versao" SET DEFAULT 0;

UPDATE "fluxos"
SET "versao" = CASE WHEN "ativo" THEN GREATEST("versao", 1) ELSE 0 END,
    "possui_alteracoes_nao_publicadas" = NOT "ativo",
    "publicado_at" = CASE WHEN "ativo" THEN "updated_at" ELSE NULL END;

CREATE TABLE "fluxo_versoes" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "fluxo_id" INTEGER NOT NULL,
    "versao" INTEGER NOT NULL,
    "definicao" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fluxo_versoes_pkey" PRIMARY KEY ("id")
);

INSERT INTO "fluxo_versoes" (
    "public_id",
    "fluxo_id",
    "versao",
    "definicao",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "id",
    "versao",
    "definicao",
    COALESCE("publicado_at", "created_at"),
    COALESCE("publicado_at", "updated_at")
FROM "fluxos"
WHERE "ativo" = true;

DROP INDEX "fluxos_nome_idx";

CREATE INDEX "fluxos_nome_trgm_idx"
ON "fluxos" USING GIN ("nome" gin_trgm_ops);

CREATE INDEX "fluxos_deletado_at_updated_at_idx"
ON "fluxos"("deletado_at", "updated_at");

CREATE UNIQUE INDEX "fluxo_versoes_public_id_key"
ON "fluxo_versoes"("public_id");

CREATE UNIQUE INDEX "fluxo_versoes_fluxo_id_versao_key"
ON "fluxo_versoes"("fluxo_id", "versao");

CREATE INDEX "fluxo_versoes_fluxo_id_created_at_idx"
ON "fluxo_versoes"("fluxo_id", "created_at");

ALTER TABLE "fluxo_versoes"
ADD CONSTRAINT "fluxo_versoes_fluxo_id_fkey"
FOREIGN KEY ("fluxo_id") REFERENCES "fluxos"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
