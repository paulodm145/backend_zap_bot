ALTER TABLE "mensagens" ADD COLUMN "chave_idempotencia" VARCHAR(100), ADD COLUMN "correlation_id" VARCHAR(100);
CREATE UNIQUE INDEX "mensagens_chave_idempotencia_key" ON "mensagens"("chave_idempotencia");
CREATE INDEX "mensagens_correlation_id_idx" ON "mensagens"("correlation_id");
