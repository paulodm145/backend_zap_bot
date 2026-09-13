-- Migração para Evolution API (fase de estudo): o roteamento de webhooks
-- deixa de ser indexado pelo phone_number_id da Meta e passa a ser indexado
-- pelo nome da instância na Evolution API.
ALTER TABLE "roteamentos_whatsapp" RENAME COLUMN "phone_number_id" TO "instance_name";
ALTER INDEX "roteamentos_whatsapp_phone_number_id_key" RENAME TO "roteamentos_whatsapp_instance_name_key";
