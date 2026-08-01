import type { EnviarMensagemAtendimentoEntrada } from '../dtos/mensagem-atendimento.dto.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';

export class MensagemAtendimentoRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public buscarContexto(conversaPublicId: string, usuarioCentralPublicId: string) {
    return this.prisma.conversa
      .findUnique({
        where: { public_id: conversaPublicId },
        select: {
          id: true,
          public_id: true,
          status: true,
          atendente_id: true,
          janela_expira_at: true,
          contato: { select: { telefone: true } },
          atendente: {
            select: {
              id: true,
              usuario: { select: { usuario_central_public_id: true } },
            },
          },
          conta_whatsapp: {
            select: {
              id: true,
              ativo: true,
              status: true,
              phone_number_id: true,
              versao_graph_api: true,
              token_encrypted: true,
            },
          },
        },
      })
      .then((conversa) => ({ conversa, usuarioCentralPublicId }));
  }

  public async criarPendente(
    conversaId: number,
    atendenteId: number,
    entrada: EnviarMensagemAtendimentoEntrada,
    correlationId: string,
  ) {
    const existente = await this.prisma.mensagem.findUnique({
      where: { chave_idempotencia: entrada.chaveIdempotencia },
      select: { public_id: true, status_entrega: true },
    });
    if (existente) return { ...existente, duplicada: true };
    const resposta = entrada.respostaMensagemId
      ? await this.prisma.mensagem.findFirst({
          where: { public_id: entrada.respostaMensagemId, conversa_id: conversaId },
          select: { id: true },
        })
      : null;
    const mensagem = await this.prisma.mensagem.create({
      data: {
        conversa_id: conversaId,
        autor_atendente_id: atendenteId,
        resposta_mensagem_id: resposta?.id ?? null,
        chave_idempotencia: entrada.chaveIdempotencia,
        correlation_id: correlationId,
        tipo: entrada.tipo,
        direcao: 'SAIDA',
        autor: 'ATENDENTE',
        status_entrega: 'PENDENTE',
        recebida: false,
        ocorreu_at: new Date(),
        conteudo: { texto: entrada.texto ?? null },
        midia_url: entrada.midiaUrl ?? null,
        midia_mime_type: entrada.midiaMimeType ?? null,
        midia_nome: entrada.midiaNome ?? null,
      },
      select: { public_id: true, status_entrega: true },
    });
    return { ...mensagem, duplicada: false };
  }

  public buscarParaEnvio(publicId: string) {
    return this.prisma.mensagem.findUnique({
      where: { public_id: publicId },
      include: { conversa: { include: { contato: true, conta_whatsapp: true } } },
    });
  }

  public marcarTentativa(publicId: string) {
    return this.prisma.mensagem.updateMany({
      where: { public_id: publicId, status_entrega: 'PENDENTE', enviada_at: null },
      data: { enviada_at: new Date() },
    });
  }

  public liberarTentativa(publicId: string) {
    return this.prisma.mensagem.updateMany({
      where: { public_id: publicId, status_entrega: 'PENDENTE' },
      data: { enviada_at: null },
    });
  }

  public marcarEnviada(publicId: string, whatsappMessageId: string) {
    return this.prisma.mensagem.update({
      where: { public_id: publicId },
      data: {
        whatsapp_message_id: whatsappMessageId,
        status_entrega: 'ENVIADA',
        enviada_at: new Date(),
        erro_codigo: null,
        erro_mensagem: null,
      },
    });
  }

  public marcarFalha(publicId: string, codigo: string) {
    return this.prisma.mensagem.update({
      where: { public_id: publicId },
      data: {
        status_entrega: 'FALHA',
        erro_codigo: codigo,
        erro_mensagem: 'Falha ao enviar mensagem',
      },
    });
  }
}
