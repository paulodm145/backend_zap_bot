import type { Request, Response } from 'express';
import type {
  AtualizarContatoEntrada,
  CriarContatoEntrada,
  IniciarConversaContatoEntrada,
  ListarContatosEntrada,
} from '../dtos/contato.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import { ContaWhatsappRepository } from '../repositories/conta-whatsapp.repository.js';
import { ContatoRepository } from '../repositories/contato.repository.js';
import { DirecionamentoAtendimentoRepository } from '../repositories/direcionamento-atendimento.repository.js';
import { ContatoService } from '../services/contato.service.js';
import { IniciarConversaContatoService } from '../services/iniciar-conversa-contato.service.js';

export class ContatoController {
  public listar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(await this.service(requisicao).listar(requisicao.query as unknown as ListarContatosEntrada));
  };
  public buscar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta.status(200).json(await this.service(requisicao).buscar(this.contatoId(requisicao)));
  };
  public criar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(201)
      .json(await this.service(requisicao).criar(requisicao.body as CriarContatoEntrada));
  };
  public atualizar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).atualizar(
          this.contatoId(requisicao),
          requisicao.body as AtualizarContatoEntrada,
        ),
      );
  };
  public excluir = async (requisicao: Request, resposta: Response): Promise<void> => {
    await this.service(requisicao).excluir(this.contatoId(requisicao));
    resposta.status(204).send();
  };
  public iniciarConversa = async (requisicao: Request, resposta: Response): Promise<void> => {
    const prisma = this.prisma(requisicao);
    const servico = new IniciarConversaContatoService(
      new ContatoRepository(prisma),
      new ContaWhatsappRepository(prisma),
      new DirecionamentoAtendimentoRepository(prisma),
    );
    resposta
      .status(201)
      .json(
        await servico.iniciar(this.contatoId(requisicao), requisicao.body as IniciarConversaContatoEntrada, {
          usuarioCentralPublicId: this.usuarioCentralPublicId(requisicao),
          tenantId: this.tenantId(requisicao),
        }),
      );
  };

  private contatoId(requisicao: Request): string {
    const valor = requisicao.params.contatoId;
    if (typeof valor !== 'string') throw new ValidacaoError('Contato inválido');
    return valor;
  }
  private usuarioCentralPublicId(requisicao: Request): string {
    if (!requisicao.usuarioTenant) throw new NaoEncontradoError('Usuário autenticado ausente');
    return requisicao.usuarioTenant.id;
  }
  private tenantId(requisicao: Request): string {
    if (!requisicao.usuarioTenant) throw new NaoEncontradoError('Usuário autenticado ausente');
    return requisicao.usuarioTenant.tenantId;
  }
  private service(requisicao: Request): ContatoService {
    return new ContatoService(new ContatoRepository(this.prisma(requisicao)));
  }
  private prisma(requisicao: Request): PrismaClient {
    if (!requisicao.contextoTenant) throw new NaoEncontradoError('Contexto do tenant ausente');
    return requisicao.contextoTenant.prisma;
  }
}
