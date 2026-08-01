import type { Request, Response } from 'express';
import type {
  AlterarEmailPerfilEntrada,
  AlterarSenhaPerfilEntrada,
  AtualizarPerfilEntrada,
} from '../dtos/perfil.dto.js';
import { NaoEncontradoError } from '../erros/erro-aplicacao.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import { UsuarioTenantRepository } from '../repositories/usuario-tenant.repository.js';
import type { UsuarioCentralRepository } from '../repositories/usuario-central.repository.js';
import type { HashSenhaService } from '../services/hash-senha.service.js';
import { PerfilService } from '../services/perfil.service.js';

export class PerfilController {
  public constructor(
    private readonly centrais: UsuarioCentralRepository,
    private readonly senhas: HashSenhaService,
  ) {}
  public buscar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta.status(200).json(await this.service(requisicao).buscar(this.usuarioId(requisicao)));
  };
  public atualizar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).atualizar(
          this.usuarioId(requisicao),
          requisicao.body as AtualizarPerfilEntrada,
        ),
      );
  };
  public alterarSenha = async (requisicao: Request, resposta: Response): Promise<void> => {
    await this.service(requisicao).alterarSenha(
      this.usuarioId(requisicao),
      requisicao.body as AlterarSenhaPerfilEntrada,
    );
    resposta.status(204).send();
  };
  public alterarEmail = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta
      .status(200)
      .json(
        await this.service(requisicao).alterarEmail(
          this.usuarioId(requisicao),
          requisicao.body as AlterarEmailPerfilEntrada,
        ),
      );
  };
  private usuarioId(requisicao: Request): string {
    if (!requisicao.usuarioTenant) throw new NaoEncontradoError('Usuário autenticado ausente');
    return requisicao.usuarioTenant.id;
  }
  private service(requisicao: Request): PerfilService {
    return new PerfilService(
      this.centrais,
      new UsuarioTenantRepository(this.prisma(requisicao)),
      this.senhas,
    );
  }
  private prisma(requisicao: Request): PrismaClient {
    if (!requisicao.contextoTenant) throw new NaoEncontradoError('Contexto do tenant ausente');
    return requisicao.contextoTenant.prisma;
  }
}
