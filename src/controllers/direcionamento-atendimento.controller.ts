import type { Request, Response } from 'express';
import type {
  EncerrarConversaEntrada,
  ReatribuirConversaEntrada,
} from '../dtos/direcionamento-atendimento.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import { DirecionamentoAtendimentoRepository } from '../repositories/direcionamento-atendimento.repository.js';
import { HistoricoRepository } from '../repositories/historico.repository.js';
import { DirecionamentoAtendimentoService } from '../services/direcionamento-atendimento.service.js';
import type { EnfileiradorMensagemSaida } from '../services/mensagem-atendimento.service.js';

export class DirecionamentoAtendimentoController {
  public constructor(private readonly enfileiradorMensagemSaida?: EnfileiradorMensagemSaida) {}

  public assumir = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).assumir(
          this.conversaId(requisicao),
          this.contexto(requisicao),
        ),
      );
  };

  public reatribuir = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).reatribuir(
          this.conversaId(requisicao),
          requisicao.body as ReatribuirConversaEntrada,
          this.contexto(requisicao),
        ),
      );
  };

  public encerrar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).encerrar(
          this.conversaId(requisicao),
          requisicao.body as EncerrarConversaEntrada,
          this.contexto(requisicao),
        ),
      );
  };

  private contexto(requisicao: Request) {
    if (!requisicao.usuarioTenant) throw new NaoEncontradoError('Usuário autenticado ausente');
    return {
      usuarioCentralPublicId: requisicao.usuarioTenant.id,
      papel: requisicao.usuarioTenant.papel,
      tenantId: requisicao.usuarioTenant.tenantId,
    };
  }

  private conversaId(requisicao: Request): string {
    const valor = requisicao.params.conversaId;
    if (typeof valor !== 'string') throw new ValidacaoError('Conversa inválida');
    return valor;
  }

  private service(requisicao: Request) {
    const prisma = this.prisma(requisicao);
    return new DirecionamentoAtendimentoService(
      new DirecionamentoAtendimentoRepository(prisma),
      new HistoricoRepository(prisma),
      this.enfileiradorMensagemSaida,
    );
  }

  private prisma(requisicao: Request): PrismaClient {
    if (!requisicao.contextoTenant) throw new NaoEncontradoError('Contexto do tenant ausente');
    return requisicao.contextoTenant.prisma;
  }
}
