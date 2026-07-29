export interface TenantParaMigracao {
  id: number;
  publicId: string;
  stringConexaoCriptografada: string;
}

export interface ResultadoMigracaoTenant {
  tenantId: string;
  sucesso: boolean;
  erro?: string;
}

export interface ResumoMigracaoTenants {
  total: number;
  sucessos: number;
  falhas: number;
  resultados: ResultadoMigracaoTenant[];
}

export class MigradorTenantsService {
  public constructor(private readonly executar: (tenant: TenantParaMigracao) => Promise<void>) {}

  public async migrar(tenants: TenantParaMigracao[]): Promise<ResumoMigracaoTenants> {
    const resultados: ResultadoMigracaoTenant[] = [];
    for (const tenant of tenants) {
      try {
        await this.executar(tenant);
        resultados.push({ tenantId: tenant.publicId, sucesso: true });
      } catch (erro) {
        resultados.push({
          tenantId: tenant.publicId,
          sucesso: false,
          erro: erro instanceof Error ? erro.message : 'Falha desconhecida',
        });
      }
    }
    const sucessos = resultados.filter((resultado) => resultado.sucesso).length;
    return {
      total: resultados.length,
      sucessos,
      falhas: resultados.length - sucessos,
      resultados,
    };
  }
}
