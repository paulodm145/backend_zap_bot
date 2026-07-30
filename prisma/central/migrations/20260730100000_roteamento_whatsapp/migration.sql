CREATE TABLE "roteamentos_whatsapp" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "phone_number_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roteamentos_whatsapp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roteamentos_whatsapp_phone_number_id_key"
ON "roteamentos_whatsapp"("phone_number_id");

CREATE INDEX "roteamentos_whatsapp_tenant_id_idx"
ON "roteamentos_whatsapp"("tenant_id");

ALTER TABLE "roteamentos_whatsapp"
ADD CONSTRAINT "roteamentos_whatsapp_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
