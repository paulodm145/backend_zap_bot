ALTER TABLE "tenants"
ADD COLUMN "provisionamento_chave" UUID;

CREATE UNIQUE INDEX "tenants_provisionamento_chave_key"
ON "tenants"("provisionamento_chave");

CREATE INDEX "tenants_etapa_provisionamento_updated_at_idx"
ON "tenants"("etapa_provisionamento", "updated_at");
