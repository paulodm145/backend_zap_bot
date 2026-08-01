import type {
  AtualizarUsuarioTenantEntrada,
  CriarUsuarioTenantEntrada,
  PapelOperacional,
} from '../dtos/usuario-tenant.dto.js';
import { ConflitoError, NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { PapelUsuario } from '../generated/prisma/client.js';
import { normalizarEmail } from '../helpers/email.helper.js';
import type { UsuarioCentralRepository } from '../repositories/usuario-central.repository.js';
import type { UsuarioTenantRepository } from '../repositories/usuario-tenant.repository.js';
import type { HashSenhaService } from './hash-senha.service.js';

interface ContextoUsuarioTenant {
  tenantId: number;
  autorPublicId: string;
  autorPapel: PapelOperacional;
}

export class UsuarioTenantService {
  public constructor(
    private readonly centrais: UsuarioCentralRepository,
    private readonly perfis: UsuarioTenantRepository,
    private readonly senhas: HashSenhaService,
  ) {}

  public async criar(entrada: CriarUsuarioTenantEntrada, contexto: ContextoUsuarioTenant) {
    this.validarEscopoGestor(contexto.autorPapel, entrada.papel);
    const email = normalizarEmail(entrada.email);
    const existente = await this.centrais.buscarRegistroPorEmail(email);
    if (existente) {
      if (existente.tenant_id !== contexto.tenantId || existente.deletado_at) {
        throw new ConflitoError('E-mail já cadastrado');
      }
      return this.perfis.salvar({
        centralPublicId: existente.public_id,
        nome: existente.nome,
        email: existente.email,
        papel: this.papelOperacional(existente.papel),
        autorPublicId: contexto.autorPublicId,
      });
    }

    const central = await this.centrais.criar({
      tenantId: contexto.tenantId,
      nome: entrada.nome,
      email,
      senhaHash: await this.senhas.gerar(entrada.senha),
      papel: this.papelCentral(entrada.papel),
    });
    try {
      return await this.perfis.salvar({
        centralPublicId: central.public_id,
        nome: central.nome,
        email: central.email,
        papel: entrada.papel,
        autorPublicId: contexto.autorPublicId,
      });
    } catch (erro: unknown) {
      await this.centrais.excluirCompensacao(central.public_id);
      throw erro;
    }
  }

  public async atualizar(
    perfilPublicId: string,
    entrada: AtualizarUsuarioTenantEntrada,
    contexto: ContextoUsuarioTenant,
  ) {
    const perfil = await this.perfis.buscar(perfilPublicId);
    if (!perfil) throw new NaoEncontradoError('Usuário não encontrado');
    this.validarEscopoGestor(contexto.autorPapel, perfil.papel);
    if (entrada.papel) this.validarEscopoGestor(contexto.autorPapel, entrada.papel);
    if (entrada.email) {
      const outro = await this.centrais.buscarRegistroPorEmail(normalizarEmail(entrada.email));
      if (outro && outro.public_id !== perfil.usuario_central_public_id) {
        throw new ConflitoError('E-mail já cadastrado');
      }
    }
    if (perfil.papel === 'ADMIN_TENANT' && entrada.papel && entrada.papel !== 'ADMIN_TENANT') {
      await this.validarPreservacaoAdministrador();
    }
    const normalizada = {
      ...entrada,
      ...(entrada.email ? { email: normalizarEmail(entrada.email) } : {}),
    };
    const resultado = await this.perfis.atualizar(
      perfilPublicId,
      normalizada,
      contexto.autorPublicId,
    );
    if (!resultado) throw new NaoEncontradoError('Usuário não encontrado');
    try {
      await this.centrais.atualizarOperacional(perfil.usuario_central_public_id, {
        ...(normalizada.nome ? { nome: normalizada.nome } : {}),
        ...(normalizada.email ? { email: normalizada.email } : {}),
        ...(normalizada.papel ? { papel: this.papelCentral(normalizada.papel) } : {}),
      });
    } catch (erro: unknown) {
      await this.perfis.atualizar(
        perfilPublicId,
        {
          nome: resultado.anterior.nome,
          email: resultado.anterior.email,
          papel: resultado.anterior.papel,
        },
        contexto.autorPublicId,
      );
      throw erro;
    }
    return resultado.usuario;
  }

  public async alterarAtivo(
    perfilPublicId: string,
    ativo: boolean,
    contexto: ContextoUsuarioTenant,
  ) {
    const perfil = await this.perfis.buscar(perfilPublicId);
    if (!perfil) throw new NaoEncontradoError('Usuário não encontrado');
    this.validarEscopoGestor(contexto.autorPapel, perfil.papel);
    if (!ativo && perfil.papel === 'ADMIN_TENANT' && perfil.ativo) {
      await this.validarPreservacaoAdministrador();
    }
    const atualizado = await this.perfis.alterarAtivo(
      perfilPublicId,
      ativo,
      contexto.autorPublicId,
    );
    if (!atualizado) throw new NaoEncontradoError('Usuário não encontrado');
    try {
      await this.centrais.alterarAtivoERevogar(perfil.usuario_central_public_id, ativo);
    } catch (erro: unknown) {
      await this.perfis.alterarAtivo(perfilPublicId, perfil.ativo, contexto.autorPublicId);
      throw erro;
    }
    return atualizado;
  }

  public async excluir(perfilPublicId: string, contexto: ContextoUsuarioTenant): Promise<void> {
    const perfil = await this.perfis.buscar(perfilPublicId);
    if (!perfil) throw new NaoEncontradoError('Usuário não encontrado');
    this.validarEscopoGestor(contexto.autorPapel, perfil.papel);
    if (perfil.papel === 'ADMIN_TENANT' && perfil.ativo) {
      await this.validarPreservacaoAdministrador();
    }
    const excluido = await this.perfis.excluir(perfilPublicId, contexto.autorPublicId);
    if (!excluido) throw new NaoEncontradoError('Usuário não encontrado');
    try {
      await this.centrais.excluirERevogar(perfil.usuario_central_public_id);
    } catch (erro: unknown) {
      await this.perfis.restaurarExclusao(perfilPublicId, perfil.ativo, contexto.autorPublicId);
      throw erro;
    }
  }

  private async validarPreservacaoAdministrador() {
    if ((await this.perfis.contarAdministradoresAtivos()) <= 1) {
      throw new ValidacaoError('O tenant deve manter ao menos um administrador ativo');
    }
  }

  private papelCentral(papel: PapelOperacional): PapelUsuario {
    return papel;
  }

  private papelOperacional(papel: PapelUsuario): PapelOperacional {
    if (papel === 'SUPER_ADMIN') throw new ValidacaoError('Papel central inválido para tenant');
    return papel;
  }

  private validarEscopoGestor(autorPapel: PapelOperacional, alvoPapel: PapelOperacional): void {
    if (autorPapel === 'GESTOR' && alvoPapel === 'ADMIN_TENANT') {
      throw new ValidacaoError('Gestores não podem administrar usuários ADMIN_TENANT');
    }
  }
}
