import type {
  AlterarPlanoTenantEntrada,
  AlterarStatusTenantEntrada,
} from '../dtos/tenant-interno.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { StatusTenant } from '../generated/prisma/client.js';
import type { TenantCentralRepository } from '../repositories/tenant-central.repository.js';

const transicoesPermitidas: Record<StatusTenant, StatusTenant[]> = {
  AGUARDANDO_PAGAMENTO: ['CANCELADO'],
  PROVISIONANDO: ['CANCELADO'],
  ATIVO: ['SUSPENSO', 'CANCELADO'],
  SUSPENSO: ['ATIVO', 'CANCELADO'],
  CANCELADO: [],
  FALHA_PROVISIONAMENTO: ['CANCELADO'],
};

interface ContextoAuditoria {
  autorPublicId: string;
  ip?: string;
}

export class AdministracaoTenantsService {
  public constructor(private readonly tenants: TenantCentralRepository) {}

  public async alterarStatus(
    tenantPublicId: string,
    entrada: AlterarStatusTenantEntrada,
    contexto: ContextoAuditoria,
  ) {
    const atual = await this.tenants.buscarPorPublicId(tenantPublicId);
    if (!atual) throw new NaoEncontradoError('Tenant não encontrado');
    if (!transicoesPermitidas[atual.status].includes(entrada.status)) {
      throw new ValidacaoError(`Transição de ${atual.status} para ${entrada.status} não permitida`);
    }
    return this.tenants.alterarStatusAuditado({
      tenantPublicId,
      status: entrada.status,
      motivo: entrada.motivo,
      ...contexto,
    });
  }

  public async alterarPlano(
    tenantPublicId: string,
    entrada: AlterarPlanoTenantEntrada,
    contexto: ContextoAuditoria,
  ) {
    const tenant = await this.tenants.buscarPorPublicId(tenantPublicId);
    if (!tenant) throw new NaoEncontradoError('Tenant não encontrado');
    if (tenant.status === 'CANCELADO') {
      throw new ValidacaoError('Não é permitido alterar o plano de tenant cancelado');
    }
    const assinatura = await this.tenants.alterarPlanoAuditado({
      tenantPublicId,
      planoPublicId: entrada.planoId,
      motivo: entrada.motivo,
      ...contexto,
    });
    if (!assinatura) throw new NaoEncontradoError('Plano ativo não encontrado');
    return assinatura;
  }
}
