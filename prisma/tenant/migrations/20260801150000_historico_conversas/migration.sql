ALTER TYPE "status_conversa" RENAME VALUE 'ABERTA' TO 'BOT';
ALTER TYPE "status_conversa" RENAME VALUE 'AGUARDANDO' TO 'AGUARDANDO_ATENDENTE';
ALTER TYPE "status_conversa" RENAME VALUE 'FINALIZADA' TO 'ENCERRADA';
ALTER TYPE "status_conversa" ADD VALUE 'COM_ATENDENTE' AFTER 'AGUARDANDO_ATENDENTE';

CREATE TYPE "direcao_mensagem" AS ENUM ('ENTRADA', 'SAIDA', 'INTERNA');
CREATE TYPE "autor_mensagem" AS ENUM ('CONTATO', 'BOT', 'ATENDENTE', 'SISTEMA');
CREATE TYPE "status_entrega_mensagem" AS ENUM ('RECEBIDA', 'PENDENTE', 'ENVIADA', 'ENTREGUE', 'LIDA', 'FALHA');

ALTER TABLE "contatos" ADD COLUMN "nome_normalizado" VARCHAR(150);
UPDATE "contatos" SET "nome_normalizado" = LOWER(TRIM("nome")) WHERE "nome" IS NOT NULL;

ALTER TABLE "conversas" ADD COLUMN "estado_fluxo" JSONB, ADD COLUMN "janela_expira_at" TIMESTAMPTZ(3);

ALTER TABLE "mensagens"
  ADD COLUMN "resposta_mensagem_id" INTEGER,
  ADD COLUMN "autor_atendente_id" INTEGER,
  ADD COLUMN "direcao" "direcao_mensagem",
  ADD COLUMN "autor" "autor_mensagem",
  ADD COLUMN "status_entrega" "status_entrega_mensagem",
  ADD COLUMN "midia_url" VARCHAR(1000),
  ADD COLUMN "midia_mime_type" VARCHAR(150),
  ADD COLUMN "midia_nome" VARCHAR(255),
  ADD COLUMN "erro_codigo" VARCHAR(100),
  ADD COLUMN "erro_mensagem" VARCHAR(500),
  ADD COLUMN "ocorreu_at" TIMESTAMPTZ(3);

UPDATE "mensagens" SET
  "direcao" = CASE WHEN "recebida" THEN 'ENTRADA'::"direcao_mensagem" ELSE 'SAIDA'::"direcao_mensagem" END,
  "autor" = CASE WHEN "recebida" THEN 'CONTATO'::"autor_mensagem" ELSE 'BOT'::"autor_mensagem" END,
  "status_entrega" = CASE WHEN "recebida" THEN 'RECEBIDA'::"status_entrega_mensagem" ELSE 'ENVIADA'::"status_entrega_mensagem" END,
  "ocorreu_at" = COALESCE("enviada_at", "created_at");

ALTER TABLE "mensagens" ALTER COLUMN "direcao" SET NOT NULL, ALTER COLUMN "autor" SET NOT NULL, ALTER COLUMN "status_entrega" SET NOT NULL, ALTER COLUMN "ocorreu_at" SET NOT NULL;

DROP INDEX "contatos_nome_idx";
DROP INDEX "conversas_status_ultima_mensagem_at_idx";
DROP INDEX "conversas_setor_id_status_idx";
DROP INDEX "conversas_atendente_id_status_idx";
DROP INDEX "mensagens_conversa_id_created_at_idx";
DROP INDEX "mensagens_created_at_idx";

CREATE INDEX "contatos_nome_normalizado_idx" ON "contatos"("nome_normalizado");
CREATE INDEX "conversas_status_ultima_mensagem_at_id_idx" ON "conversas"("status", "ultima_mensagem_at", "id");
CREATE INDEX "conversas_setor_id_status_ultima_mensagem_at_idx" ON "conversas"("setor_id", "status", "ultima_mensagem_at");
CREATE INDEX "conversas_atendente_id_status_ultima_mensagem_at_idx" ON "conversas"("atendente_id", "status", "ultima_mensagem_at");
CREATE INDEX "conversas_conta_whatsapp_id_status_ultima_mensagem_at_idx" ON "conversas"("conta_whatsapp_id", "status", "ultima_mensagem_at");
CREATE INDEX "mensagens_conversa_id_ocorreu_at_id_idx" ON "mensagens"("conversa_id", "ocorreu_at", "id");
CREATE INDEX "mensagens_autor_atendente_id_ocorreu_at_idx" ON "mensagens"("autor_atendente_id", "ocorreu_at");
CREATE INDEX "mensagens_status_entrega_updated_at_idx" ON "mensagens"("status_entrega", "updated_at");
CREATE INDEX "mensagens_ocorreu_at_id_idx" ON "mensagens"("ocorreu_at", "id");

ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_resposta_mensagem_id_fkey" FOREIGN KEY ("resposta_mensagem_id") REFERENCES "mensagens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_autor_atendente_id_fkey" FOREIGN KEY ("autor_atendente_id") REFERENCES "atendentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
