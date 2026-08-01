import type { GerenciadorConexoesTenant } from '../database/gerenciador-conexoes-tenant.js';
import { converterTimestampUnixWhatsapp } from '../helpers/timestamp-whatsapp.helper.js';
import { HistoricoRepository } from '../repositories/historico.repository.js';
import type { TenantCentralRepository } from '../repositories/tenant-central.repository.js';
import type { JobMensagemRecebida } from '../types/jobs.js';
import type { CriptografiaService } from './criptografia.service.js';

export class ProcessadorMensagemRecebidaService {
  public constructor(
    private readonly tenants: TenantCentralRepository,
    private readonly criptografia: CriptografiaService,
    private readonly conexoes: GerenciadorConexoesTenant,
  ) {}
  public async processar(job: JobMensagemRecebida): Promise<'CRIADA' | 'DUPLICADA'> {
    const tenant = await this.tenants.buscarPorPublicId(job.tenantId);
    if (!tenant?.string_conexao_encrypted || tenant.status !== 'ATIVO')
      throw new Error('Tenant indisponível para processar mensagem');
    const ocorreuAt = converterTimestampUnixWhatsapp(job.timestamp);
    if (!ocorreuAt) throw new Error('Timestamp da mensagem inválido');
    const prisma = await this.conexoes.obter(
      tenant.id,
      this.criptografia.descriptografar(tenant.string_conexao_encrypted),
    );
    return new HistoricoRepository(prisma).persistirRecebida(job, ocorreuAt);
  }
}
