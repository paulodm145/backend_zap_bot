-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "papel_usuario" AS ENUM ('SUPER_ADMIN', 'ADMIN_TENANT', 'USUARIO');

-- CreateEnum
CREATE TYPE "status_tenant" AS ENUM ('AGUARDANDO_PAGAMENTO', 'PROVISIONANDO', 'ATIVO', 'SUSPENSO', 'CANCELADO', 'FALHA_PROVISIONAMENTO');

-- CreateEnum
CREATE TYPE "status_assinatura" AS ENUM ('AGUARDANDO_PAGAMENTO', 'ATIVA', 'INADIMPLENTE', 'CANCELADA', 'MANUAL');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" INTEGER,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "papel" "papel_usuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "totp_secret_encrypted" TEXT,
    "totp_habilitado" BOOLEAN NOT NULL DEFAULT false,
    "deletado_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "nome_do_banco" VARCHAR(63),
    "string_conexao_encrypted" TEXT,
    "status" "status_tenant" NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    "etapa_provisionamento" VARCHAR(80),
    "erro_provisionamento" TEXT,
    "deletado_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "limite_conversas_mes" INTEGER NOT NULL,
    "preco_centavos" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "plano_id" INTEGER NOT NULL,
    "status" "status_assinatura" NOT NULL,
    "gateway_assinatura_id" VARCHAR(150),
    "proxima_cobranca" TIMESTAMPTZ(3),
    "cancelada_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "revogado_por_id" INTEGER,
    "substituido_por_id" INTEGER,
    "token_hash" VARCHAR(128) NOT NULL,
    "familia" UUID NOT NULL,
    "expira_at" TIMESTAMPTZ(3) NOT NULL,
    "revogado_at" TIMESTAMPTZ(3),
    "motivo_revogacao" VARCHAR(120),
    "user_agent" VARCHAR(500),
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria_interna" (
    "id" SERIAL NOT NULL,
    "autor_usuario_id" INTEGER,
    "acao" VARCHAR(100) NOT NULL,
    "entidade" VARCHAR(100) NOT NULL,
    "entidade_public_id" UUID,
    "detalhes" JSONB,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auditoria_interna_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX "users_papel_ativo_idx" ON "users"("papel", "ativo");
CREATE INDEX "users_deletado_at_idx" ON "users"("deletado_at");
CREATE UNIQUE INDEX "tenants_public_id_key" ON "tenants"("public_id");
CREATE UNIQUE INDEX "tenants_nome_do_banco_key" ON "tenants"("nome_do_banco");
CREATE INDEX "tenants_status_updated_at_idx" ON "tenants"("status", "updated_at");
CREATE INDEX "tenants_deletado_at_idx" ON "tenants"("deletado_at");
CREATE UNIQUE INDEX "planos_public_id_key" ON "planos"("public_id");
CREATE UNIQUE INDEX "planos_nome_key" ON "planos"("nome");
CREATE INDEX "planos_ativo_nome_idx" ON "planos"("ativo", "nome");
CREATE UNIQUE INDEX "assinaturas_gateway_assinatura_id_key" ON "assinaturas"("gateway_assinatura_id");
CREATE INDEX "assinaturas_tenant_id_status_idx" ON "assinaturas"("tenant_id", "status");
CREATE INDEX "assinaturas_plano_id_status_idx" ON "assinaturas"("plano_id", "status");
CREATE INDEX "assinaturas_status_proxima_cobranca_idx" ON "assinaturas"("status", "proxima_cobranca");
CREATE UNIQUE INDEX "refresh_tokens_substituido_por_id_key" ON "refresh_tokens"("substituido_por_id");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_usuario_id_revogado_at_idx" ON "refresh_tokens"("usuario_id", "revogado_at");
CREATE INDEX "refresh_tokens_familia_idx" ON "refresh_tokens"("familia");
CREATE INDEX "refresh_tokens_expira_at_idx" ON "refresh_tokens"("expira_at");
CREATE INDEX "auditoria_interna_autor_usuario_id_created_at_idx" ON "auditoria_interna"("autor_usuario_id", "created_at");
CREATE INDEX "auditoria_interna_entidade_entidade_public_id_idx" ON "auditoria_interna"("entidade", "entidade_public_id");
CREATE INDEX "auditoria_interna_created_at_idx" ON "auditoria_interna"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_revogado_por_id_fkey" FOREIGN KEY ("revogado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_substituido_por_id_fkey" FOREIGN KEY ("substituido_por_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auditoria_interna" ADD CONSTRAINT "auditoria_interna_autor_usuario_id_fkey" FOREIGN KEY ("autor_usuario_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
