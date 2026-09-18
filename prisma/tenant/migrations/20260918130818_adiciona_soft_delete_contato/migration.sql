-- AlterTable
ALTER TABLE "contatos" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deletado_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "contatos_ativo_deletado_at_idx" ON "contatos"("ativo", "deletado_at");
