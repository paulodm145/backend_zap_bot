CREATE TYPE "status_conta_whatsapp" AS ENUM ('PENDENTE', 'VALIDADA', 'INVALIDA');

ALTER TABLE "contas_whatsapp"
ADD COLUMN "waba_id" VARCHAR(100),
ADD COLUMN "numero_exibicao" VARCHAR(40),
ADD COLUMN "versao_graph_api" VARCHAR(20) NOT NULL DEFAULT 'v23.0',
ADD COLUMN "status" "status_conta_whatsapp" NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN "ultima_validacao_at" TIMESTAMPTZ(3),
ADD COLUMN "ultimo_erro_codigo" VARCHAR(80),
ADD COLUMN "ultimo_erro_mensagem" VARCHAR(500),
ADD COLUMN "deletado_at" TIMESTAMPTZ(3);

UPDATE "contas_whatsapp" SET "waba_id" = 'NAO_INFORMADO' WHERE "waba_id" IS NULL;
ALTER TABLE "contas_whatsapp" ALTER COLUMN "waba_id" SET NOT NULL;

DROP INDEX "contas_whatsapp_ativo_nome_idx";
CREATE INDEX "contas_whatsapp_ativo_deletado_at_nome_idx"
ON "contas_whatsapp"("ativo", "deletado_at", "nome");
CREATE INDEX "contas_whatsapp_status_updated_at_idx"
ON "contas_whatsapp"("status", "updated_at");

CREATE TABLE "auditorias_whatsapp" (
  "id" SERIAL NOT NULL,
  "conta_whatsapp_id" INTEGER,
  "conta_public_id" UUID NOT NULL,
  "autor_usuario_id" UUID NOT NULL,
  "acao" VARCHAR(80) NOT NULL,
  "detalhes" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auditorias_whatsapp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditorias_whatsapp_conta_public_id_created_at_idx"
ON "auditorias_whatsapp"("conta_public_id", "created_at");
CREATE INDEX "auditorias_whatsapp_autor_usuario_id_created_at_idx"
ON "auditorias_whatsapp"("autor_usuario_id", "created_at");
ALTER TABLE "auditorias_whatsapp"
ADD CONSTRAINT "auditorias_whatsapp_conta_whatsapp_id_fkey"
FOREIGN KEY ("conta_whatsapp_id") REFERENCES "contas_whatsapp"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
