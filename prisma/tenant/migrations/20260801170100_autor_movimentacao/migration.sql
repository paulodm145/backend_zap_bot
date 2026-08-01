ALTER TABLE "movimentacoes_atendimento" ADD COLUMN "autor_usuario_public_id" UUID;
CREATE INDEX "movimentacoes_atendimento_autor_usuario_public_id_created_at_idx" ON "movimentacoes_atendimento"("autor_usuario_public_id", "created_at");
