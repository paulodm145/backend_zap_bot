import type { Request, Response } from 'express';
import type {
  ListarContatosEntrada,
  ListarConversasEntrada,
  ListarMensagensEntrada,
} from '../dtos/historico.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import { ConsultaHistoricoRepository } from '../repositories/consulta-historico.repository.js';
import { ConsultaHistoricoService } from '../services/consulta-historico.service.js';

export class HistoricoController {
  public listarContatos = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).listarContatos(
          requisicao.query as unknown as ListarContatosEntrada,
          this.contexto(requisicao),
        ),
      );
  };
  public listarConversas = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).listarConversas(
          requisicao.query as unknown as ListarConversasEntrada,
          this.contexto(requisicao),
        ),
      );
  };
  public buscarConversa = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).buscarConversa(
          this.conversaId(requisicao),
          this.contexto(requisicao),
        ),
      );
  };
  public listarMensagens = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).listarMensagens(
          this.conversaId(requisicao),
          requisicao.query as unknown as ListarMensagensEntrada,
          this.contexto(requisicao),
        ),
      );
  };
  private contexto(requisicao: Request) {
    if (!requisicao.usuarioTenant) throw new NaoEncontradoError('Usuário autenticado ausente');
    return {
      usuarioCentralPublicId: requisicao.usuarioTenant.id,
      papel: requisicao.usuarioTenant.papel,
    };
  }
  private conversaId(requisicao: Request): string {
    const valor = requisicao.params.conversaId;
    if (typeof valor !== 'string') throw new ValidacaoError('Conversa inválida');
    return valor;
  }
  private service(requisicao: Request) {
    return new ConsultaHistoricoService(new ConsultaHistoricoRepository(this.prisma(requisicao)));
  }
  private prisma(requisicao: Request): PrismaClient {
    if (!requisicao.contextoTenant) throw new NaoEncontradoError('Contexto do tenant ausente');
    return requisicao.contextoTenant.prisma;
  }
}
