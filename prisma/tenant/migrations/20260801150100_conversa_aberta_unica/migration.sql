CREATE UNIQUE INDEX "conversas_conta_contato_aberta_key"
ON "conversas"("conta_whatsapp_id", "contato_id")
WHERE "status" <> 'ENCERRADA';
