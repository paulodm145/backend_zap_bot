-- Índices orientados à listagem administrativa de tenants.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE INDEX "tenants_status_created_at_idx"
ON "tenants"("status", "created_at");

CREATE INDEX "tenants_nome_status_idx"
ON "tenants"("nome", "status");

CREATE INDEX "tenants_nome_trgm_idx"
ON "tenants" USING GIN ("nome" gin_trgm_ops)
WHERE "deletado_at" IS NULL;
