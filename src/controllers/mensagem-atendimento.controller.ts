import type { Request, Response } from 'express';
import type { EnviarMensagemAtendimentoEntrada } from '../dtos/mensagem-atendimento.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import { MensagemAtendimentoRepository } from '../repositories/mensagem-atendimento.repository.js';
import type { EnfileiradorMensagemSaida } from '../services/mensagem-atendimento.service.js';
import { MensagemAtendimentoService } from '../services/mensagem-atendimento.service.js';

export class MensagemAtendimentoController {
  public constructor(private readonly enfileirador: EnfileiradorMensagemSaida) {}
  public enviar = async (requisicao: Request, resposta: Response): Promise<void> => {
    if (!requisicao.contextoTenant || !requisicao.usuarioTenant)
      throw new NaoEncontradoError('Contexto autenticado ausente');
    const conversaId = requisicao.params.conversaId;
    if (typeof conversaId !== 'string') throw new ValidacaoError('Conversa inválida');
    const resultado = await new MensagemAtendimentoService(
      new MensagemAtendimentoRepository(requisicao.contextoTenant.prisma),
      this.enfileirador,
    ).enviar({
      conversaPublicId: conversaId,
      entrada: requisicao.body as EnviarMensagemAtendimentoEntrada,
      usuarioCentralPublicId: requisicao.usuarioTenant.id,
      tenantId: requisicao.usuarioTenant.tenantId,
      correlationId: requisicao.correlationId,
    });
    resposta.status(resultado.duplicada ? 200 : 202).json(resultado);
  };
}
