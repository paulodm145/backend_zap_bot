import type { Request, Response } from 'express';

import type {
  AtualizarUsuarioTenantEntrada,
  CriarUsuarioTenantEntrada,
  ListarUsuariosTenantEntrada,
} from '../dtos/usuario-tenant.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import type { UsuarioCentralRepository } from '../repositories/usuario-central.repository.js';
import { UsuarioTenantRepository } from '../repositories/usuario-tenant.repository.js';
import type { HashSenhaService } from '../services/hash-senha.service.js';
import { UsuarioTenantService } from '../services/usuario-tenant.service.js';

export class UsuarioTenantController {
  public constructor(
    private readonly centrais: UsuarioCentralRepository,
    private readonly senhas: HashSenhaService,
  ) {}

  public listar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.repository(requisicao).listar(
          requisicao.query as unknown as ListarUsuariosTenantEntrada,
        ),
      );
  };

  public detalhar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const usuario = await this.repository(requisicao).buscar(this.usuarioId(requisicao));
    if (!usuario) throw new NaoEncontradoError('Usuário não encontrado');
    resposta.status(200).json(usuario);
  };

  public criar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(201)
      .json(
        await this.service(requisicao).criar(
          requisicao.body as CriarUsuarioTenantEntrada,
          this.contexto(requisicao),
        ),
      );
  };

  public atualizar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).atualizar(
          this.usuarioId(requisicao),
          requisicao.body as AtualizarUsuarioTenantEntrada,
          this.contexto(requisicao),
        ),
      );
  };

  public alterarStatus = async (requisicao: Request, resposta: Response): Promise<void> => {
    const { ativo } = requisicao.body as { ativo: boolean };
    resposta
      .status(200)
      .json(
        await this.service(requisicao).alterarAtivo(
          this.usuarioId(requisicao),
          ativo,
          this.contexto(requisicao),
        ),
      );
  };

  public excluir = async (requisicao: Request, resposta: Response): Promise<void> => {
    await this.service(requisicao).excluir(this.usuarioId(requisicao), this.contexto(requisicao));
    resposta.status(204).send();
  };

  private repository(requisicao: Request) {
    return new UsuarioTenantRepository(this.prisma(requisicao));
  }

  private service(requisicao: Request) {
    return new UsuarioTenantService(this.centrais, this.repository(requisicao), this.senhas);
  }

  private prisma(requisicao: Request): PrismaClient {
    if (!requisicao.contextoTenant) throw new NaoEncontradoError('Contexto do tenant ausente');
    return requisicao.contextoTenant.prisma;
  }

  private contexto(requisicao: Request) {
    if (!requisicao.contextoTenant || !requisicao.usuarioTenant) {
      throw new NaoEncontradoError('Contexto autenticado ausente');
    }
    return {
      tenantId: requisicao.contextoTenant.id,
      autorPublicId: requisicao.usuarioTenant.id,
      autorPapel: requisicao.usuarioTenant.papel,
    };
  }

  private usuarioId(requisicao: Request): string {
    const id = requisicao.params.usuarioId;
    if (typeof id !== 'string') throw new ValidacaoError('Identificador do usuário inválido');
    return id;
  }
}
