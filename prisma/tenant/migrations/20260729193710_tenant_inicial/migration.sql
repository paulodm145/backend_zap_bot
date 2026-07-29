-- CreateEnum
CREATE TYPE "status_conversa" AS ENUM ('ABERTA', 'AGUARDANDO', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "tipo_mensagem" AS ENUM ('TEXTO', 'IMAGEM', 'AUDIO', 'DOCUMENTO', 'SISTEMA');

-- CreateTable
CREATE TABLE "contas_whatsapp" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "phone_number_id" VARCHAR(100) NOT NULL,
    "token_encrypted" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contas_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fluxos" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "definicao" JSONB NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fluxos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "nome" VARCHAR(150),
    "telefone" VARCHAR(20) NOT NULL,
    "atributos" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setores" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "setores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendentes" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "setor_id" INTEGER,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "atendentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "conta_whatsapp_id" INTEGER NOT NULL,
    "contato_id" INTEGER NOT NULL,
    "setor_id" INTEGER,
    "atendente_id" INTEGER,
    "status" "status_conversa" NOT NULL DEFAULT 'ABERTA',
    "ultima_mensagem_at" TIMESTAMPTZ(3),
    "finalizada_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "conversa_id" INTEGER NOT NULL,
    "whatsapp_message_id" VARCHAR(150),
    "tipo" "tipo_mensagem" NOT NULL,
    "conteudo" JSONB NOT NULL,
    "recebida" BOOLEAN NOT NULL,
    "enviada_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credenciais_integracao" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "tipo_auth" VARCHAR(30) NOT NULL,
    "configuracao_encrypted" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credenciais_integracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_uso" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "referencia" VARCHAR(150),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registros_uso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contas_whatsapp_public_id_key" ON "contas_whatsapp"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "contas_whatsapp_phone_number_id_key" ON "contas_whatsapp"("phone_number_id");

-- CreateIndex
CREATE INDEX "contas_whatsapp_ativo_nome_idx" ON "contas_whatsapp"("ativo", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "fluxos_public_id_key" ON "fluxos"("public_id");

-- CreateIndex
CREATE INDEX "fluxos_ativo_updated_at_idx" ON "fluxos"("ativo", "updated_at");

-- CreateIndex
CREATE INDEX "fluxos_nome_idx" ON "fluxos"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_public_id_key" ON "contatos"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_telefone_key" ON "contatos"("telefone");

-- CreateIndex
CREATE INDEX "contatos_nome_idx" ON "contatos"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "setores_public_id_key" ON "setores"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "setores_nome_key" ON "setores"("nome");

-- CreateIndex
CREATE INDEX "setores_ativo_nome_idx" ON "setores"("ativo", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "atendentes_public_id_key" ON "atendentes"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "atendentes_email_key" ON "atendentes"("email");

-- CreateIndex
CREATE INDEX "atendentes_setor_id_ativo_idx" ON "atendentes"("setor_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "conversas_public_id_key" ON "conversas"("public_id");

-- CreateIndex
CREATE INDEX "conversas_status_ultima_mensagem_at_idx" ON "conversas"("status", "ultima_mensagem_at");

-- CreateIndex
CREATE INDEX "conversas_contato_id_created_at_idx" ON "conversas"("contato_id", "created_at");

-- CreateIndex
CREATE INDEX "conversas_setor_id_status_idx" ON "conversas"("setor_id", "status");

-- CreateIndex
CREATE INDEX "conversas_atendente_id_status_idx" ON "conversas"("atendente_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mensagens_public_id_key" ON "mensagens"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "mensagens_whatsapp_message_id_key" ON "mensagens"("whatsapp_message_id");

-- CreateIndex
CREATE INDEX "mensagens_conversa_id_created_at_idx" ON "mensagens"("conversa_id", "created_at");

-- CreateIndex
CREATE INDEX "mensagens_created_at_idx" ON "mensagens"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "credenciais_integracao_public_id_key" ON "credenciais_integracao"("public_id");

-- CreateIndex
CREATE INDEX "credenciais_integracao_ativo_nome_idx" ON "credenciais_integracao"("ativo", "nome");

-- CreateIndex
CREATE INDEX "registros_uso_tipo_created_at_idx" ON "registros_uso"("tipo", "created_at");

-- CreateIndex
CREATE INDEX "registros_uso_created_at_idx" ON "registros_uso"("created_at");

-- AddForeignKey
ALTER TABLE "atendentes" ADD CONSTRAINT "atendentes_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_conta_whatsapp_id_fkey" FOREIGN KEY ("conta_whatsapp_id") REFERENCES "contas_whatsapp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "contatos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_atendente_id_fkey" FOREIGN KEY ("atendente_id") REFERENCES "atendentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
