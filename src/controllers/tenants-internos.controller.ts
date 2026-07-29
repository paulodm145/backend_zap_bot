import type { Request, Response } from 'express';

import type {
  AlterarPlanoTenantEntrada,
  AlterarStatusTenantEntrada,
  ListarTenantsEntrada,
  ProvisionarTenantEntrada,
} from '../dtos/tenant-interno.dto.js';
import { NaoEncontradoError, NaoAutenticadoError } from '../erros/erro-aplicacao.js';
import type { TenantCentralRepository } from '../repositories/tenant-central.repository.js';
import type { AdministracaoTenantsService } from '../services/administracao-tenants.service.js';
import type { ProvisionamentoTenantService } from '../services/provisionamento-tenant.service.js';

export class TenantsInternosController {
  public constructor(
    private readonly tenants: TenantCentralRepository,
    private readonly administracao: AdministracaoTenantsService,
    private readonly provisionamento: ProvisionamentoTenantService,
  ) {}

  public listar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(await this.tenants.listar(requisicao.query as unknown as ListarTenantsEntrada));
  };

  public detalhar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const tenant = await this.tenants.detalhar(this.tenantId(requisicao));
    if (!tenant) throw new NaoEncontradoError('Tenant não encontrado');
    resposta.status(200).json(tenant);
  };

  public alterarStatus = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.administracao.alterarStatus(
          this.tenantId(requisicao),
          requisicao.body as AlterarStatusTenantEntrada,
          this.contexto(requisicao),
        ),
      );
  };

  public alterarPlano = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.administracao.alterarPlano(
          this.tenantId(requisicao),
          requisicao.body as AlterarPlanoTenantEntrada,
          this.contexto(requisicao),
        ),
      );
  };

  public provisionar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(202)
      .json(await this.provisionamento.provisionar(requisicao.body as ProvisionarTenantEntrada));
  };

  private contexto(requisicao: Request): { autorPublicId: string; ip?: string } {
    if (!requisicao.usuarioInterno) throw new NaoAutenticadoError();
    return {
      autorPublicId: requisicao.usuarioInterno.id,
      ...(requisicao.ip ? { ip: requisicao.ip } : {}),
    };
  }

  private tenantId(requisicao: Request): string {
    return (requisicao.params as unknown as { tenantId: string }).tenantId;
  }
}
