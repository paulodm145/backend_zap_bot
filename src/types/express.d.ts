import type { PrismaClient as PrismaTenantClient } from '../generated/prisma-tenant/client.js';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      rawBody?: Buffer;
      usuarioInterno?: {
        id: string;
        email: string;
        papel: 'super_admin';
      };
      usuarioTenant?: {
        id: string;
        email: string;
        tenantId: string;
        papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE';
      };
      contextoTenant?: {
        id: number;
        publicId: string;
        prisma: PrismaTenantClient;
      };
    }
  }
}

export {};
