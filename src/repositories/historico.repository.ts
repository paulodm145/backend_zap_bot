import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import { normalizarTelefone } from '../helpers/telefone.helper.js';
import type { JobMensagemRecebida } from '../types/jobs.js';

export class HistoricoRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async persistirRecebida(
    job: JobMensagemRecebida,
    ocorreuAt: Date,
  ): Promise<'CRIADA' | 'DUPLICADA'> {
    for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
      try {
        return await this.prisma.$transaction(
          async (transacao) => {
            if (
              await transacao.mensagem.findUnique({
                where: { whatsapp_message_id: job.mensagemId },
                select: { id: true },
              })
            )
              return 'DUPLICADA';
            const conta = await transacao.contaWhatsapp.findFirstOrThrow({
              where: { phone_number_id: job.phoneNumberId, ativo: true, deletado_at: null },
            });
            const telefone = normalizarTelefone(job.remetente);
            if (!telefone) throw new Error('Telefone de remetente inválido');
            const contato = await transacao.contato.upsert({
              where: { telefone },
              create: { telefone },
              update: {},
            });
            await transacao.conversa.updateMany({
              where: {
                conta_whatsapp_id: conta.id,
                contato_id: contato.id,
                status: { not: 'ENCERRADA' },
                janela_expira_at: { lte: ocorreuAt },
              },
              data: { status: 'ENCERRADA', finalizada_at: ocorreuAt },
            });
            let conversa = await transacao.conversa.findFirst({
              where: {
                conta_whatsapp_id: conta.id,
                contato_id: contato.id,
                status: { not: 'ENCERRADA' },
              },
              orderBy: { id: 'desc' },
            });
            conversa ??= await transacao.conversa.create({
              data: {
                conta_whatsapp_id: conta.id,
                contato_id: contato.id,
                status: 'BOT',
                janela_expira_at: new Date(ocorreuAt.getTime() + 86_400_000),
              },
            });
            await transacao.mensagem.create({
              data: {
                conversa_id: conversa.id,
                whatsapp_message_id: job.mensagemId,
                tipo: 'TEXTO',
                direcao: 'ENTRADA',
                autor: 'CONTATO',
                status_entrega: 'RECEBIDA',
                recebida: true,
                ocorreu_at: ocorreuAt,
                conteudo: { texto: job.texto },
              },
            });
            await transacao.conversa.update({
              where: { id: conversa.id },
              data: {
                ultima_mensagem_at: ocorreuAt,
                janela_expira_at: new Date(ocorreuAt.getTime() + 86_400_000),
              },
            });
            return 'CRIADA';
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (erro: unknown) {
        if (tentativa < 3 && this.erroConcorrencia(erro)) continue;
        if (this.erroDuplicidade(erro)) return 'DUPLICADA';
        throw erro;
      }
    }
    return 'DUPLICADA';
  }

  private erroConcorrencia(erro: unknown): boolean {
    return typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === 'P2034';
  }
  private erroDuplicidade(erro: unknown): boolean {
    return typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === 'P2002';
  }
}
