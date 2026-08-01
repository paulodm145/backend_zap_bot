CREATE TYPE "papel_usuario_tenant" AS ENUM ('ADMIN_TENANT', 'GESTOR', 'ATENDENTE');

CREATE TABLE "usuarios_tenant" (
  "id" SERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "usuario_central_public_id" UUID NOT NULL,
  "nome" VARCHAR(150) NOT NULL,
  "nome_normalizado" VARCHAR(150) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "papel" "papel_usuario_tenant" NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "deletado_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usuarios_tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "usuarios_tenant_public_id_key" ON "usuarios_tenant"("public_id");
CREATE UNIQUE INDEX "usuarios_tenant_usuario_central_public_id_key" ON "usuarios_tenant"("usuario_central_public_id");
CREATE UNIQUE INDEX "usuarios_tenant_email_key" ON "usuarios_tenant"("email");
CREATE INDEX "usuarios_tenant_papel_ativo_idx" ON "usuarios_tenant"("papel", "ativo");
CREATE INDEX "usuarios_tenant_ativo_nome_normalizado_idx" ON "usuarios_tenant"("ativo", "nome_normalizado");
CREATE INDEX "usuarios_tenant_deletado_at_idx" ON "usuarios_tenant"("deletado_at");

CREATE TABLE "auditorias_usuarios_tenant" (
  "id" SERIAL NOT NULL,
  "usuario_public_id" UUID NOT NULL,
  "autor_usuario_public_id" UUID NOT NULL,
  "acao" VARCHAR(80) NOT NULL,
  "detalhes" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auditorias_usuarios_tenant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auditorias_usuarios_tenant_usuario_public_id_created_at_idx" ON "auditorias_usuarios_tenant"("usuario_public_id", "created_at");
CREATE INDEX "auditorias_usuarios_tenant_autor_usuario_public_id_created_at_idx" ON "auditorias_usuarios_tenant"("autor_usuario_public_id", "created_at");
