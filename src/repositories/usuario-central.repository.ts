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
      ...(usuario.totp_secret_encrypted
        ? { totpSecretEncrypted: usuario.totp_secret_encrypted }
        : {}),
    };
  }

  public async buscarPorPublicId(publicId: string): Promise<UsuarioInterno | null> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { public_id: publicId, deletado_at: null },
    });
    return usuario ? this.mapearInterno(usuario) : null;
  }

  public async salvarTotp(
    publicId: string,
    segredoCriptografado: string,
    habilitado: boolean,
  ): Promise<void> {
    await this.prisma.usuario.update({
      where: { public_id: publicId },
      data: {
        totp_secret_encrypted: segredoCriptografado,
        totp_habilitado: habilitado,
      },
    });
  }

  public buscarTenantPorEmail(email: string) {
    return this.prisma.usuario.findFirst({
      where: {
        email,
        ativo: true,
        deletado_at: null,
        tenant_id: { not: null },
      },
      include: { tenant: true },
    });
  }

  public buscarPorIdComTenant(id: number) {
    return this.prisma.usuario.findFirst({
      where: { id, deletado_at: null },
      include: { tenant: true },
    });
  }

  private mapearInterno(usuario: {
    id: number;
    public_id: string;
    email: string;
    senha_hash: string;
    papel: PapelUsuario;
    ativo: boolean;
    totp_habilitado: boolean;
    totp_secret_encrypted: string | null;
  }): UsuarioInterno {
    return {
      id: usuario.id,
      publicId: usuario.public_id,
      email: usuario.email,
      senhaHash: usuario.senha_hash,
      papel: usuario.papel === 'SUPER_ADMIN' ? 'super_admin' : 'usuario',
      ativo: usuario.ativo,
      totpHabilitado: usuario.totp_habilitado,
      ...(usuario.totp_secret_encrypted
        ? { totpSecretEncrypted: usuario.totp_secret_encrypted }
        : {}),
    };
  }
}
