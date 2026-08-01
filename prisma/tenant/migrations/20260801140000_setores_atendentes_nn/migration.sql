ALTER TABLE "setores" ADD COLUMN "nome_normalizado" VARCHAR(100), ADD COLUMN "deletado_at" TIMESTAMPTZ(3);
UPDATE "setores" SET "nome_normalizado" = LOWER(TRIM("nome"));
ALTER TABLE "setores" ALTER COLUMN "nome_normalizado" SET NOT NULL;

ALTER TABLE "atendentes" ADD COLUMN "usuario_tenant_id" INTEGER;
UPDATE "atendentes" a SET "usuario_tenant_id" = u."id" FROM "usuarios_tenant" u WHERE LOWER(a."email") = LOWER(u."email");

CREATE TABLE "atendentes_setores" (
  "id" SERIAL NOT NULL,
  "atendente_id" INTEGER NOT NULL,
  "setor_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "atendentes_setores_pkey" PRIMARY KEY ("id")
);
INSERT INTO "atendentes_setores" ("atendente_id", "setor_id") SELECT "id", "setor_id" FROM "atendentes" WHERE "setor_id" IS NOT NULL;

DROP INDEX "atendentes_setor_id_ativo_idx";
ALTER TABLE "atendentes" DROP CONSTRAINT "atendentes_setor_id_fkey";
ALTER TABLE "atendentes" DROP COLUMN "setor_id";

CREATE UNIQUE INDEX "atendentes_usuario_tenant_id_key" ON "atendentes"("usuario_tenant_id");
CREATE INDEX "atendentes_ativo_nome_idx" ON "atendentes"("ativo", "nome");
CREATE UNIQUE INDEX "atendentes_setores_atendente_id_setor_id_key" ON "atendentes_setores"("atendente_id", "setor_id");
CREATE INDEX "atendentes_setores_setor_id_atendente_id_idx" ON "atendentes_setores"("setor_id", "atendente_id");
CREATE INDEX "atendentes_setores_atendente_id_setor_id_idx" ON "atendentes_setores"("atendente_id", "setor_id");
CREATE INDEX "setores_ativo_nome_normalizado_idx" ON "setores"("ativo", "nome_normalizado");
CREATE INDEX "setores_deletado_at_idx" ON "setores"("deletado_at");
ALTER TABLE "atendentes" ADD CONSTRAINT "atendentes_usuario_tenant_id_fkey" FOREIGN KEY ("usuario_tenant_id") REFERENCES "usuarios_tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "atendentes_setores" ADD CONSTRAINT "atendentes_setores_atendente_id_fkey" FOREIGN KEY ("atendente_id") REFERENCES "atendentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "atendentes_setores" ADD CONSTRAINT "atendentes_setores_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
