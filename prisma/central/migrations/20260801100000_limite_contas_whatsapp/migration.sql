ALTER TABLE "planos"
ADD COLUMN "limite_contas_whatsapp" INTEGER NOT NULL DEFAULT 1;

UPDATE "planos" SET "limite_contas_whatsapp" = 3 WHERE "nome" = 'Pro';
