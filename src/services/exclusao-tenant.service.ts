import type { ExcluirTenantDefinitivamenteEntrada } from '../dtos/tenant-interno.dto.js';
import {
  ConflitoError,
  CredenciaisInvalidasError,
  NaoEncontradoError,
  ValidacaoError,
} from '../erros/erro-aplicacao.js';
import { validarNomeBancoTenant } from '../helpers/banco-tenant.helper.js';
import type { TenantCentralRepository } from '../repositories/tenant-central.repository.js';
import type { UsuarioCentralRepository } from '../repositories/usuario-central.repository.js';
import type { ExclusorBancoTenant } from './provisionador-banco-tenant.service.js';
import type { HashSenhaService } from './hash-senha.service.js';

export interface EncerradorConexaoTenant {
  fechar(tenantId: number): Promise<void>;
}

interface ContextoExclusaoTenant {
  operadorPublicId: string;
  ip?: string;
}

export class ExclusaoTenantService {
  public constructor(
    private readonly tenants: TenantCentralRepository,
    private readonly usuarios: UsuarioCentralRepository,
    private readonly senhas: HashSenhaService,
    private readonly conexoes: EncerradorConexaoTenant,
    private readonly bancos: ExclusorBancoTenant,
  ) {}

  public async excluirDefinitivamente(
    tenantPublicId: string,
    entrada: ExcluirTenantDefinitivamenteEntrada,
    contexto: ContextoExclusaoTenant,
  ): Promise<void> {
    await this.reautenticar(contexto.operadorPublicId, entrada.senha);
    const tenant = await this.tenants.buscarPorPublicId(tenantPublicId);
    if (!tenant) throw new NaoEncontradoError('Tenant não encontrado');
    if (!['SUSPENSO', 'CANCELADO'].includes(tenant.status)) {
      throw new ConflitoError('Suspenda ou cancele o tenant antes da exclusão definitiva');
    }
    if (tenant.nome !== entrada.nomeTenant) {
      throw new ValidacaoError('O nome de confirmação não corresponde ao tenant');
    }
    if (!tenant.nome_do_banco) {
      throw new ConflitoError('Tenant não possui banco físico registrado');
    }
    const nomeBanco = validarNomeBancoTenant(tenant.nome_do_banco);
    if (!(await this.tenants.prepararExclusaoDefinitiva(tenant.public_id))) {
      throw new ConflitoError('O tenant não está disponível para exclusão definitiva');
    }

    await this.conexoes.fechar(tenant.id);
    try {
      await this.bancos.excluirDefinitivamente(nomeBanco);
    } catch (erro: unknown) {
      await this.tenants.registrarFalhaExclusaoDefinitiva({
        tenantPublicId: tenant.public_id,
        motivo: entrada.motivo,
        autorPublicId: contexto.operadorPublicId,
        erro: erro instanceof Error ? erro.message : 'Falha desconhecida ao excluir banco',
        ...(contexto.ip ? { ip: contexto.ip } : {}),
      });
      throw erro;
    }

    await this.tenants.concluirExclusaoDefinitiva({
      tenantPublicId: tenant.public_id,
      tenantNome: tenant.nome,
      nomeBanco,
      motivo: entrada.motivo,
      autorPublicId: contexto.operadorPublicId,
      ...(contexto.ip ? { ip: contexto.ip } : {}),
    });
  }

  private async reautenticar(operadorPublicId: string, senha: string): Promise<void> {
    const operador = await this.usuarios.buscarRegistroPorPublicId(operadorPublicId);
    const hash = operador?.senha_hash ?? '$2b$12$000000000000000000000uGFr4A5Zs4P2RQmC8YlQXrZ8Pq9a';
    const senhaValida = await this.senhas.comparar(senha, hash);
    if (!operador?.ativo || operador.papel !== 'SUPER_ADMIN' || !senhaValida) {
      throw new CredenciaisInvalidasError('Senha do administrador inválida');
    }
  }
}
