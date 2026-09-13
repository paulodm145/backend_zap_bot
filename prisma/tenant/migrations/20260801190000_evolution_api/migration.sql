-- Migração para Evolution API (fase de estudo): a conta WhatsApp do tenant
-- deixa de guardar phone_number_id/waba_id/versão da Graph API/token da Meta
-- e passa a guardar o nome e o id da instância na Evolution API, além da
-- própria apikey da instância (gerada pela Evolution no momento da criação).

ALTER TABLE "contas_whatsapp" RENAME COLUMN "phone_number_id" TO "instance_name";
ALTER INDEX "contas_whatsapp_phone_number_id_key" RENAME TO "contas_whatsapp_instance_name_key";

ALTER TABLE "contas_whatsapp" RENAME COLUMN "token_encrypted" TO "api_key_encrypted";
ALTER TABLE "contas_whatsapp" RENAME COLUMN "ultima_validacao_at" TO "ultima_sincronizacao_at";

ALTER TABLE "contas_whatsapp" ADD COLUMN "instance_id" VARCHAR(100);

ALTER TABLE "contas_whatsapp" DROP COLUMN "waba_id";
ALTER TABLE "contas_whatsapp" DROP COLUMN "versao_graph_api";

-- Recria o enum de status com os estados de conexão da Evolution API/Baileys
-- no lugar dos estados de validação de credencial da Meta.
ALTER TYPE "status_conta_whatsapp" RENAME TO "status_conta_whatsapp_old";
CREATE TYPE "status_conta_whatsapp" AS ENUM ('CONECTANDO', 'CONECTADO', 'DESCONECTADO');
ALTER TABLE "contas_whatsapp"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "status_conta_whatsapp" USING (
    CASE "status"::text
      WHEN 'PENDENTE' THEN 'CONECTANDO'
      WHEN 'VALIDADA' THEN 'CONECTADO'
      WHEN 'INVALIDA' THEN 'DESCONECTADO'
    END
  )::"status_conta_whatsapp",
  ALTER COLUMN "status" SET DEFAULT 'CONECTANDO';
DROP TYPE "status_conta_whatsapp_old";
