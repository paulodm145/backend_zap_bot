import type { Queue } from 'bullmq';
import type { GerenciadorConexoesTenant } from '../database/gerenciador-conexoes-tenant.js';
import { criarJobId } from '../helpers/chave-redis.helper.js';
import type { TenantCentralRepository } from '../repositories/tenant-central.repository.js';
import type { JobStatusWhatsapp } from '../types/jobs.js';
import type { CriptografiaService } from './criptografia.service.js';
import type { EnfileiradorStatusWhatsapp } from './webhook-whatsapp.service.js';
import { barramentoChat } from '../eventos/barramento-chat.js';

export class EnfileiradorStatusWhatsappBullMqService implements EnfileiradorStatusWhatsapp {
  public constructor(private readonly fila: Queue<JobStatusWhatsapp>) {}
  public async adicionar(dados: JobStatusWhatsapp): Promise<void> {
    await this.fila.add('atualizar-status-whatsapp', dados, {
      jobId: criarJobId(`${dados.tenantId}:${dados.mensagemId}:${dados.status}`),
    });
  }
}

export class ProcessadorStatusWhatsappService {
  public constructor(
    private readonly tenants: TenantCentralRepository,
    private readonly criptografia: CriptografiaService,
    private readonly conexoes: GerenciadorConexoesTenant,
  ) {}
  public async processar(job: JobStatusWhatsapp): Promise<'ATUALIZADA' | 'IGNORADA'> {
    const tenant = await this.tenants.buscarPorPublicId(job.tenantId);
    if (!tenant?.string_conexao_encrypted || tenant.status !== 'ATIVO') return 'IGNORADA';
    const prisma = await this.conexoes.obter(
      tenant.id,
      this.criptografia.descriptografar(tenant.string_conexao_encrypted),
    );
    const atual = await prisma.mensagem.findUnique({
      where: { whatsapp_message_id: job.mensagemId },
      select: {
        id: true,
        public_id: true,
        status_entrega: true,
        conversa: { select: { public_id: true, setor: { select: { public_id: true } } } },
      },
    });
    if (!atual) return 'IGNORADA';
    const destino = {
      sent: 'ENVIADA',
      delivered: 'ENTREGUE',
      read: 'LIDA',
      failed: 'FALHA',
    } as const;
    const ordem = { PENDENTE: 0, ENVIADA: 1, ENTREGUE: 2, LIDA: 3, RECEBIDA: 3, FALHA: 4 } as const;
    const novo = destino[job.status];
    if (novo !== 'FALHA' && ordem[novo] <= ordem[atual.status_entrega]) return 'IGNORADA';
    await prisma.mensagem.update({
      where: { id: atual.id },
      data: {
        status_entrega: novo,
        ...(novo === 'FALHA'
          ? {
              erro_codigo: job.codigoErro ?? 'META_FALHA',
              erro_mensagem: 'Falha informada pela Meta',
            }
          : {}),
      },
    });
    barramentoChat.publicar('conversa:mensagem_atualizada', {
      tenantId: job.tenantId,
      conversaId: atual.conversa.public_id,
      mensagemId: atual.public_id,
      ...(atual.conversa.setor ? { setorId: atual.conversa.setor.public_id } : {}),
      dados: { status: novo },
    });
    return 'ATUALIZADA';
  }
}
