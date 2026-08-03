import { randomUUID } from 'node:crypto';

import { AcessoNegadoError, NaoEncontradoError } from '../erros/erro-aplicacao.js';
import type { TenantCentralRepository } from '../repositories/tenant-central.repository.js';
import type { TokenTenantService } from './token-tenant.service.js';

interface ContextoImpersonacao {
  operadorPublicId: string;
  ip?: string;
}

export class ImpersonacaoTenantService {
  public constructor(
    private readonly tenants: TenantCentralRepository,
    private readonly tokens: TokenTenantService,
  ) {}

  public async conectar(tenantPublicId: string, contexto: ContextoImpersonacao) {
    const tenant = await this.tenants.buscarAtivoComAdministrador(tenantPublicId);
    if (!tenant) throw new NaoEncontradoError('Tenant ativo não encontrado');
    const administrador = tenant.usuarios[0];
    if (!administrador) {
      throw new NaoEncontradoError('Tenant não possui administrador ativo');
    }

    const sessaoPublicId = randomUUID();
    const auditoriaRegistrada = await this.tenants.registrarImpersonacao({
      tenantPublicId: tenant.public_id,
      usuarioAssumidoPublicId: administrador.public_id,
      sessaoPublicId,
      autorPublicId: contexto.operadorPublicId,
      ...(contexto.ip ? { ip: contexto.ip } : {}),
    });
    if (!auditoriaRegistrada) throw new AcessoNegadoError('Operador interno inativo');

    const token = this.tokens.emitirImpersonacao({
      publicId: administrador.public_id,
      tenantPublicId: tenant.public_id,
      email: administrador.email,
      papel: 'ADMIN_TENANT',
      impersonacao: { operadorPublicId: contexto.operadorPublicId, sessaoPublicId },
    });

    return {
      accessToken: token.accessToken,
      usuario: {
        id: administrador.public_id,
        nome: administrador.nome,
        email: administrador.email,
        tenantId: tenant.public_id,
        papel: 'ADMIN_TENANT' as const,
      },
      impersonacao: {
        ativa: true as const,
        operadorId: contexto.operadorPublicId,
        sessaoId: sessaoPublicId,
        expiraEmSegundos: token.expiraEmSegundos,
      },
    };
  }
}
