export interface UsuarioInterno {
  id: number;
  publicId: string;
  email: string;
  senhaHash: string;
  papel: 'super_admin' | 'usuario';
  ativo: boolean;
  totpHabilitado: boolean;
  totpSecretEncrypted?: string;
}

export interface UsuarioInternoRepository {
  buscarPorEmail(email: string): Promise<UsuarioInterno | null>;
  buscarPorPublicId(publicId: string): Promise<UsuarioInterno | null>;
  salvarTotp(publicId: string, segredoCriptografado: string, habilitado: boolean): Promise<void>;
}
