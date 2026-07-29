declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      usuarioInterno?: {
        id: string;
        email: string;
        papel: 'super_admin';
      };
    }
  }
}

export {};
