import type { Prisma } from '../generated/prisma-tenant/client.js';

export function converterParaJsonPrisma(valor: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}
