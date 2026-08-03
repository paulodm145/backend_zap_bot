import type { Request, Response } from 'express';

import type {
  AlterarPlanoTenantEntrada,
  AlterarStatusTenantEntrada,
  ExcluirTenantDefinitivamenteEntrada,
  ListarTenantsEntrada,
  ProvisionarTenantEntrada,
} from '../dtos/tenant-interno.dto.js';
import { NaoEncontradoError, NaoAutenticadoError } from '../erros/erro-aplicacao.js';
import { limparCookieRefresh } from '../helpers/cookie-autenticacao.helper.js';
import type { TenantCentralRepository } from '../repositories/tenant-central.repository.js';
import type { AdministracaoTenantsService } from '../services/administracao-tenants.service.js';
import type { ProvisionamentoTenantService } from '../services/provisionamento-tenant.service.js';
import type { ImpersonacaoTenantService } from '../services/impersonacao-tenant.service.js';
import type { ExclusaoTenantService } from '../services/exclusao-tenant.service.js';

export class TenantsInternosController {
  public constructor(
    private readonly tenants: TenantCentralRepository,
    private readonly administracao: AdministracaoTenantsService,
    private readonly provisionamento: ProvisionamentoTenantService,
    private readonly impersonacao: ImpersonacaoTenantService,
    private readonly exclusao: ExclusaoTenantService,
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

  public impersonar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const contexto = this.contexto(requisicao);
    const resultado = await this.impersonacao.conectar(this.tenantId(requisicao), {
      operadorPublicId: contexto.autorPublicId,
      ...(contexto.ip ? { ip: contexto.ip } : {}),
    });
    limparCookieRefresh(resposta);
    resposta.status(200).json(resultado);
  };

  public excluirDefinitivamente = async (
    requisicao: Request,
    resposta: Response,
  ): Promise<void> => {
    const contexto = this.contexto(requisicao);
    await this.exclusao.excluirDefinitivamente(
      this.tenantId(requisicao),
      requisicao.body as ExcluirTenantDefinitivamenteEntrada,
      {
        operadorPublicId: contexto.autorPublicId,
        ...(contexto.ip ? { ip: contexto.ip } : {}),
      },
    );
    resposta.status(204).send();
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
