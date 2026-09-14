-- Associa opcionalmente um fluxo publicado a cada conta WhatsApp: é esse
-- fluxo que passa a responder automaticamente as mensagens recebidas nesse
-- número. Sem fluxo associado, a conversa permanece em BOT/sem setor,
-- visível apenas para ADMIN_TENANT/GESTOR via listagem geral (comportamento
-- já existente, preservado como padrão).
ALTER TABLE "contas_whatsapp" ADD COLUMN "fluxo_id" INTEGER;

ALTER TABLE "contas_whatsapp"
ADD CONSTRAINT "contas_whatsapp_fluxo_id_fkey"
FOREIGN KEY ("fluxo_id") REFERENCES "fluxos"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
