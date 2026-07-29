export interface UsuarioInterno {
  id: number;
  publicId: string;
  email: string;
  senhaHash: string;
  papel: 'super_admin' | 'usuario';
  ativo: boolean;
  totpHabilitado: boolean;
}

export interface UsuarioInternoRepository {
  buscarPorEmail(email: string): Promise<UsuarioInterno | null>;
}
