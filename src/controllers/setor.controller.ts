import type { Request, Response } from 'express';
import type {
  AtualizarSetorEntrada,
  CriarSetorEntrada,
  ListarSetoresEntrada,
  SubstituirSetoresUsuarioEntrada,
} from '../dtos/setor.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import { SetorRepository } from '../repositories/setor.repository.js';
import { SetorService } from '../services/setor.service.js';

export class SetorController {
  public listar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).listar(
          requisicao.query as unknown as ListarSetoresEntrada,
          this.contexto(requisicao),
        ),
      );
  };
  public buscar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).buscar(
          this.parametro(requisicao, 'setorId'),
          this.contexto(requisicao),
        ),
      );
  };
  public criar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(201)
      .json(await this.service(requisicao).criar(requisicao.body as CriarSetorEntrada));
  };
  public atualizar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).atualizar(
          this.parametro(requisicao, 'setorId'),
          requisicao.body as AtualizarSetorEntrada,
        ),
      );
  };
  public excluir = async (requisicao: Request, resposta: Response): Promise<void> => {
    await this.service(requisicao).excluir(this.parametro(requisicao, 'setorId'));
    resposta.status(204).send();
  };
  public substituirSetoresUsuario = async (
    requisicao: Request,
    resposta: Response,
  ): Promise<void> => {
    const entrada = requisicao.body as SubstituirSetoresUsuarioEntrada;
    resposta
      .status(200)
      .json(
        await this.service(requisicao).substituirSetoresUsuario(
          this.parametro(requisicao, 'usuarioId'),
          entrada.setoresIds,
        ),
      );
  };
  public listarAtendentesElegiveis = async (
    requisicao: Request,
    resposta: Response,
  ): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).listarAtendentesElegiveis(
          this.parametro(requisicao, 'setorId'),
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
  private parametro(requisicao: Request, nome: string): string {
    const valor = requisicao.params[nome];
    if (typeof valor !== 'string') throw new ValidacaoError('Identificador inválido');
    return valor;
  }
  private service(requisicao: Request): SetorService {
    return new SetorService(new SetorRepository(this.prisma(requisicao)));
  }
  private prisma(requisicao: Request): PrismaClient {
    if (!requisicao.contextoTenant) throw new NaoEncontradoError('Contexto do tenant ausente');
    return requisicao.contextoTenant.prisma;
  }
}
