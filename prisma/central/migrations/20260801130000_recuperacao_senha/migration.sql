CREATE TABLE "tokens_recuperacao_senha" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_at" TIMESTAMPTZ(3) NOT NULL,
    "consumido_at" TIMESTAMPTZ(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "tokens_recuperacao_senha_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tokens_recuperacao_senha_token_hash_key" ON "tokens_recuperacao_senha"("token_hash");
CREATE INDEX "tokens_recuperacao_senha_usuario_id_consumido_at_idx" ON "tokens_recuperacao_senha"("usuario_id", "consumido_at");
CREATE INDEX "tokens_recuperacao_senha_expira_at_idx" ON "tokens_recuperacao_senha"("expira_at");
ALTER TABLE "tokens_recuperacao_senha" ADD CONSTRAINT "tokens_recuperacao_senha_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
