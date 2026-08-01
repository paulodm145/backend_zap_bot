import type { EnviarMensagemAtendimentoEntrada } from '../dtos/mensagem-atendimento.dto.js';
import { AcessoNegadoError, NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { MensagemAtendimentoRepository } from '../repositories/mensagem-atendimento.repository.js';

export interface EnfileiradorMensagemSaida {
  adicionar(tenantId: string, mensagemPublicId: string): Promise<void>;
}

export class MensagemAtendimentoService {
  public constructor(
    private readonly repositorio: MensagemAtendimentoRepository,
    private readonly enfileirador: EnfileiradorMensagemSaida,
  ) {}

  public async enviar(dados: {
    conversaPublicId: string;
    entrada: EnviarMensagemAtendimentoEntrada;
    usuarioCentralPublicId: string;
    tenantId: string;
    correlationId: string;
  }) {
    const { conversa } = await this.repositorio.buscarContexto(
      dados.conversaPublicId,
      dados.usuarioCentralPublicId,
    );
    if (!conversa) throw new NaoEncontradoError('Conversa não encontrada');
    if (conversa.status !== 'COM_ATENDENTE' || !conversa.atendente_id)
      throw new ValidacaoError('Conversa não possui atendente responsável');
    if (conversa.atendente?.usuario?.usuario_central_public_id !== dados.usuarioCentralPublicId)
      throw new AcessoNegadoError('Somente o atendente responsável pode enviar mensagens');
    if (!conversa.janela_expira_at || conversa.janela_expira_at <= new Date())
      throw new ValidacaoError('Janela de atendimento do WhatsApp expirada');
    if (!conversa.conta_whatsapp.ativo || conversa.conta_whatsapp.status !== 'VALIDADA')
      throw new ValidacaoError('Conta WhatsApp não está disponível para envio');
    const mensagem = await this.repositorio.criarPendente(
      conversa.id,
      conversa.atendente_id,
      dados.entrada,
      dados.correlationId,
    );
    if (!mensagem.duplicada) await this.enfileirador.adicionar(dados.tenantId, mensagem.public_id);
    return mensagem;
  }
}
