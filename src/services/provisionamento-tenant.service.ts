import type { ProvisionarTenantEntrada } from '../dtos/tenant-interno.dto.js';
import { NaoEncontradoError } from '../erros/erro-aplicacao.js';
import { normalizarEmail } from '../helpers/email.helper.js';
import type { Tenant } from '../generated/prisma/client.js';
import type { TenantCentralRepository } from '../repositories/tenant-central.repository.js';
import type { CriptografiaService } from './criptografia.service.js';
import type { HashSenhaService } from './hash-senha.service.js';
import type { ProvisionadorBancoTenant } from './provisionador-banco-tenant.service.js';

export const etapasProvisionamento = [
  'REGISTRO_CENTRAL_CRIADO',
  'BANCO_CRIADO',
  'MIGRATIONS_APLICADAS',
  'CONCLUIDO',
] as const;

export class ProvisionamentoTenantService {
  public constructor(
    private readonly tenants: TenantCentralRepository,
    private readonly senhas: HashSenhaService,
    private readonly criptografia: CriptografiaService,
    private readonly banco: ProvisionadorBancoTenant,
  ) {}

  public async provisionar(entrada: ProvisionarTenantEntrada) {
    let tenant: Tenant | null = await this.tenants.buscarPorChaveProvisionamento(
      entrada.chaveIdempotencia,
    );
    tenant ??= await this.tenants.criarProvisionamento({
      chaveIdempotencia: entrada.chaveIdempotencia,
      nome: entrada.nome,
      planoPublicId: entrada.planoId,
      administrador: {
        nome: entrada.administrador.nome,
        email: normalizarEmail(entrada.administrador.email),
        senhaHash: await this.senhas.gerar(entrada.administrador.senha),
      },
    });
    if (!tenant) throw new NaoEncontradoError('Plano ativo não encontrado');
    if (tenant.etapa_provisionamento === 'CONCLUIDO') return tenant;

    const nomeBanco = tenant.nome_do_banco ?? this.gerarNomeBanco(tenant.public_id);
    try {
      const stringConexao = await this.banco.criarSeAusente(nomeBanco);
      tenant = await this.tenants.atualizarProvisionamento(tenant.id, {
        etapa: 'BANCO_CRIADO',
        nomeBanco,
        stringConexaoCriptografada: this.criptografia.criptografar(stringConexao),
        status: 'PROVISIONANDO',
        erro: null,
      });

      await this.banco.aplicarMigrations(stringConexao);
      const administrador = await this.tenants.buscarAdministrador(tenant.id);
      if (!administrador) throw new Error('Administrador central do tenant não encontrado');
      await this.banco.criarPerfilAdministrador(stringConexao, {
        publicId: administrador.public_id,
        nome: administrador.nome,
        email: administrador.email,
      });
      tenant = await this.tenants.atualizarProvisionamento(tenant.id, {
        etapa: 'MIGRATIONS_APLICADAS',
        erro: null,
      });
      return await this.tenants.atualizarProvisionamento(tenant.id, {
        etapa: 'CONCLUIDO',
        status: 'ATIVO',
        erro: null,
      });
    } catch (erro) {
      await this.tenants.atualizarProvisionamento(tenant.id, {
        etapa: tenant.etapa_provisionamento ?? 'REGISTRO_CENTRAL_CRIADO',
        status: 'FALHA_PROVISIONAMENTO',
        erro: erro instanceof Error ? erro.message.slice(0, 2_000) : 'Falha desconhecida',
      });
      throw erro;
    }
  }

  private gerarNomeBanco(publicId: string): string {
    return `zapbot_tenant_${publicId.replaceAll('-', '').slice(0, 12).toLowerCase()}`;
  }
}
