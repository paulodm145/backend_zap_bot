declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      usuarioInterno?: {
        id: string;
        email: string;
        papel: 'super_admin';
      };
      usuarioTenant?: {
        id: string;
        email: string;
        tenantId: string;
      };
    }
  }
}

export {};
