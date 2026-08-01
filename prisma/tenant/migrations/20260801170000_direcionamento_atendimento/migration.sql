CREATE TABLE "movimentacoes_atendimento" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "conversa_id" INTEGER NOT NULL,
    "autor_atendente_id" INTEGER,
    "origem_atendente_id" INTEGER,
    "destino_atendente_id" INTEGER,
    "origem_setor_id" INTEGER,
    "destino_setor_id" INTEGER,
    "acao" VARCHAR(40) NOT NULL,
    "motivo" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "movimentacoes_atendimento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "movimentacoes_atendimento_public_id_key" ON "movimentacoes_atendimento"("public_id");
CREATE INDEX "movimentacoes_atendimento_conversa_id_created_at_id_idx" ON "movimentacoes_atendimento"("conversa_id", "created_at", "id");
CREATE INDEX "movimentacoes_atendimento_autor_atendente_id_created_at_idx" ON "movimentacoes_atendimento"("autor_atendente_id", "created_at");
ALTER TABLE "movimentacoes_atendimento" ADD CONSTRAINT "movimentacoes_atendimento_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movimentacoes_atendimento" ADD CONSTRAINT "movimentacoes_atendimento_autor_atendente_id_fkey" FOREIGN KEY ("autor_atendente_id") REFERENCES "atendentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimentacoes_atendimento" ADD CONSTRAINT "movimentacoes_atendimento_origem_atendente_id_fkey" FOREIGN KEY ("origem_atendente_id") REFERENCES "atendentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimentacoes_atendimento" ADD CONSTRAINT "movimentacoes_atendimento_destino_atendente_id_fkey" FOREIGN KEY ("destino_atendente_id") REFERENCES "atendentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimentacoes_atendimento" ADD CONSTRAINT "movimentacoes_atendimento_origem_setor_id_fkey" FOREIGN KEY ("origem_setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimentacoes_atendimento" ADD CONSTRAINT "movimentacoes_atendimento_destino_setor_id_fkey" FOREIGN KEY ("destino_setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
