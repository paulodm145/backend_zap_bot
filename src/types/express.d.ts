declare global {
  namespace Express {
    interface Request {
      usuarioInterno?: {
        id: string;
        email: string;
        papel: 'super_admin';
      };
    }
  }
}

export {};
