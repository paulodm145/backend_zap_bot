import type { Request, Response } from 'express';
import type {
  AtualizarCredencialIntegracaoEntrada,
  CriarCredencialIntegracaoEntrada,
  ListarCredenciaisIntegracaoEntrada,
} from '../dtos/credencial-integracao.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import { CredencialIntegracaoRepository } from '../repositories/credencial-integracao.repository.js';
import { CredencialIntegracaoService } from '../services/credencial-integracao.service.js';
import type { CriptografiaService } from '../services/criptografia.service.js';

export class CredencialIntegracaoController {
  public constructor(private readonly criptografia: CriptografiaService) {}

  public listar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).listar(
          requisicao.query as unknown as ListarCredenciaisIntegracaoEntrada,
        ),
      );
  };

  public buscar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta.status(200).json(await this.service(requisicao).buscar(this.integracaoId(requisicao)));
  };

  public criar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(201)
      .json(
        await this.service(requisicao).criar(requisicao.body as CriarCredencialIntegracaoEntrada),
      );
  };

  public atualizar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).atualizar(
          this.integracaoId(requisicao),
          requisicao.body as AtualizarCredencialIntegracaoEntrada,
        ),
      );
  };

  public desativar = async (requisicao: Request, resposta: Response): Promise<void> => {
    await this.service(requisicao).desativar(this.integracaoId(requisicao));
    resposta.status(204).send();
  };

  private integracaoId(requisicao: Request): string {
    const valor = requisicao.params.integracaoId;
    if (typeof valor !== 'string') throw new ValidacaoError('Credencial inválida');
    return valor;
  }

  private service(requisicao: Request): CredencialIntegracaoService {
    return new CredencialIntegracaoService(
      new CredencialIntegracaoRepository(this.prisma(requisicao)),
      this.criptografia,
    );
  }

  private prisma(requisicao: Request): PrismaClient {
    if (!requisicao.contextoTenant) throw new NaoEncontradoError('Contexto do tenant ausente');
    return requisicao.contextoTenant.prisma;
  }
}
