import type { PapelUsuario, PrismaClient } from '../generated/prisma/client.js';
import type {
  UsuarioInterno,
  UsuarioInternoRepository,
} from './contratos/usuario-interno.repository.js';

export interface CriarUsuarioCentral {
  tenantId?: number;
  nome: string;
  email: string;
  senhaHash: string;
  papel: PapelUsuario;
}

export class UsuarioCentralRepository implements UsuarioInternoRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async criar(entrada: CriarUsuarioCentral) {
    return this.prisma.usuario.create({
      data: {
        nome: entrada.nome,
        email: entrada.email,
        senha_hash: entrada.senhaHash,
        papel: entrada.papel,
        ...(entrada.tenantId === undefined ? {} : { tenant_id: entrada.tenantId }),
      },
    });
  }

  public async buscarPorEmail(email: string): Promise<UsuarioInterno | null> {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        email,
        deletado_at: null,
      },
    });

    if (!usuario) {
      return null;
    }

    return {
      id: usuario.id,
      publicId: usuario.public_id,
      email: usuario.email,
      senhaHash: usuario.senha_hash,
      papel: usuario.papel === 'SUPER_ADMIN' ? 'super_admin' : 'usuario',
      ativo: usuario.ativo,
      totpHabilitado: usuario.totp_habilitado,
    };
  }
}
