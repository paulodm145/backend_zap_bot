import type { Request, Response } from 'express';

import type {
  AtualizarContaWhatsappEntrada,
  CriarContaWhatsappEntrada,
  ListarContasWhatsappEntrada,
} from '../dtos/conta-whatsapp.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import { ContaWhatsappRepository } from '../repositories/conta-whatsapp.repository.js';
import type { RoteamentoWhatsappRepository } from '../repositories/roteamento-whatsapp.repository.js';
import { ContaWhatsappService } from '../services/conta-whatsapp.service.js';
import type { CriptografiaService } from '../services/criptografia.service.js';
import type { WhatsappGraphApiService } from '../services/whatsapp-graph-api.service.js';

export class ContaWhatsappController {
  public constructor(
    private readonly roteamentos: RoteamentoWhatsappRepository,
    private readonly criptografia: CriptografiaService,
    private readonly graphApi: WhatsappGraphApiService,
  ) {}

  public listar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.repository(requisicao).listar(
          requisicao.query as unknown as ListarContasWhatsappEntrada,
        ),
      );
  };

  public detalhar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const conta = await this.repository(requisicao).buscar(this.contaId(requisicao));
    if (!conta) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    resposta.status(200).json(conta);
  };

  public criar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const conta = await this.service(requisicao).criar(
      requisicao.body as CriarContaWhatsappEntrada,
      this.contexto(requisicao),
    );
    resposta.status(201).json(conta);
  };

  public atualizar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const conta = await this.service(requisicao).atualizar(
      this.contaId(requisicao),
      requisicao.body as AtualizarContaWhatsappEntrada,
      this.contexto(requisicao),
    );
    resposta.status(200).json(conta);
  };

  public rotacionarToken = async (requisicao: Request, resposta: Response): Promise<void> => {
    const corpo = requisicao.body as { accessToken: string };
    const conta = await this.service(requisicao).rotacionarToken(
      this.contaId(requisicao),
      corpo.accessToken,
      this.usuarioId(requisicao),
    );
    resposta.status(200).json(conta);
  };

  public alterarStatus = async (requisicao: Request, resposta: Response): Promise<void> => {
    const corpo = requisicao.body as { ativo: boolean };
    const conta = await this.service(requisicao).alterarAtivo(
      this.contaId(requisicao),
      corpo.ativo,
      this.contexto(requisicao),
    );
    resposta.status(200).json(conta);
  };

  public testar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta.status(200).json(await this.service(requisicao).testar(this.contaId(requisicao)));
  };

  private repository(requisicao: Request) {
    return new ContaWhatsappRepository(this.prisma(requisicao));
  }

  private service(requisicao: Request) {
    return new ContaWhatsappService(
      this.repository(requisicao),
      this.roteamentos,
      this.criptografia,
      this.graphApi,
    );
  }

  private prisma(requisicao: Request): PrismaClient {
    if (!requisicao.contextoTenant) throw new NaoEncontradoError('Contexto do tenant ausente');
    return requisicao.contextoTenant.prisma;
  }

  private contexto(requisicao: Request) {
    if (!requisicao.contextoTenant) throw new NaoEncontradoError('Contexto do tenant ausente');
    return {
      tenantId: requisicao.contextoTenant.id,
      autorUsuarioId: this.usuarioId(requisicao),
    };
  }

  private usuarioId(requisicao: Request): string {
    if (!requisicao.usuarioTenant) throw new NaoEncontradoError('Usuário autenticado ausente');
    return requisicao.usuarioTenant.id;
  }

  private contaId(requisicao: Request): string {
    const id = requisicao.params.contaId;
    if (typeof id !== 'string') throw new ValidacaoError('Identificador da conta inválido');
    return id;
  }
}
