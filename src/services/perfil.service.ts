import type {
  AlterarEmailPerfilEntrada,
  AlterarSenhaPerfilEntrada,
  AtualizarPerfilEntrada,
} from '../dtos/perfil.dto.js';
import {
  ConflitoError,
  CredenciaisInvalidasError,
  NaoEncontradoError,
} from '../erros/erro-aplicacao.js';
import { normalizarEmail } from '../helpers/email.helper.js';
import type { UsuarioCentralRepository } from '../repositories/usuario-central.repository.js';
import type { UsuarioTenantRepository } from '../repositories/usuario-tenant.repository.js';
import type { HashSenhaService } from './hash-senha.service.js';

export class PerfilService {
  public constructor(
    private readonly centrais: UsuarioCentralRepository,
    private readonly perfis: UsuarioTenantRepository,
    private readonly senhas: HashSenhaService,
  ) {}

  public async buscar(centralPublicId: string) {
    const [central, perfil] = await Promise.all([
      this.centrais.buscarPerfilPorPublicId(centralPublicId),
      this.perfis.buscarPerfilCompleto(centralPublicId),
    ]);
    if (!central?.tenant || !perfil) throw new NaoEncontradoError('Perfil não encontrado');
    return {
      id: perfil.public_id,
      nome: perfil.nome,
      email: perfil.email,
      papel: perfil.papel,
      ativo: perfil.ativo,
      tenant: {
        id: central.tenant.public_id,
        nome: central.tenant.nome,
        status: central.tenant.status,
      },
      permissoes: this.permissoes(perfil.papel),
      setores: perfil.atendente?.setores.map((vinculo) => vinculo.setor) ?? [],
    };
  }

  public async atualizar(centralPublicId: string, entrada: AtualizarPerfilEntrada) {
    const perfil = await this.perfis.buscarPorCentralId(centralPublicId);
    if (!perfil) throw new NaoEncontradoError('Perfil não encontrado');
    const resultado = await this.perfis.atualizar(
      perfil.public_id,
      { nome: entrada.nome },
      centralPublicId,
    );
    if (!resultado) throw new NaoEncontradoError('Perfil não encontrado');
    try {
      await this.centrais.atualizarOperacional(centralPublicId, { nome: entrada.nome });
    } catch (erro: unknown) {
      await this.perfis.atualizar(perfil.public_id, { nome: perfil.nome }, centralPublicId);
      throw erro;
    }
    return this.buscar(centralPublicId);
  }

  public async alterarSenha(
    centralPublicId: string,
    entrada: AlterarSenhaPerfilEntrada,
  ): Promise<void> {
    const central = await this.reautenticar(centralPublicId, entrada.senhaAtual);
    if (await this.senhas.comparar(entrada.novaSenha, central.senha_hash))
      throw new ConflitoError('A nova senha deve ser diferente da senha atual');
    await this.centrais.alterarSenhaERevogar(
      centralPublicId,
      await this.senhas.gerar(entrada.novaSenha),
    );
  }

  public async alterarEmail(centralPublicId: string, entrada: AlterarEmailPerfilEntrada) {
    await this.reautenticar(centralPublicId, entrada.senhaAtual);
    const email = normalizarEmail(entrada.novoEmail);
    const existente = await this.centrais.buscarRegistroPorEmail(email);
    if (existente && existente.public_id !== centralPublicId)
      throw new ConflitoError('E-mail já cadastrado');
    const perfil = await this.perfis.buscarPorCentralId(centralPublicId);
    if (!perfil) throw new NaoEncontradoError('Perfil não encontrado');
    const atualizado = await this.perfis.atualizar(perfil.public_id, { email }, centralPublicId);
    if (!atualizado) throw new NaoEncontradoError('Perfil não encontrado');
    try {
      await this.centrais.alterarEmailERevogar(centralPublicId, email);
    } catch (erro: unknown) {
      await this.perfis.atualizar(perfil.public_id, { email: perfil.email }, centralPublicId);
      throw erro;
    }
    return { email };
  }

  private async reautenticar(publicId: string, senha: string) {
    const usuario = await this.centrais.buscarRegistroPorPublicId(publicId);
    const hash = usuario?.senha_hash ?? '$2b$12$000000000000000000000uGFr4A5Zs4P2RQmC8YlQXrZ8Pq9a';
    if (!usuario || !(await this.senhas.comparar(senha, hash)))
      throw new CredenciaisInvalidasError('Senha atual inválida');
    return usuario;
  }

  private permissoes(papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE') {
    if (papel === 'ADMIN_TENANT')
      return [
        'usuarios:gerenciar',
        'setores:gerenciar',
        'conversas:gerenciar',
        'configuracoes:gerenciar',
      ];
    if (papel === 'GESTOR')
      return ['usuarios:gerenciar', 'setores:gerenciar', 'conversas:gerenciar'];
    return ['conversas:setores-vinculados', 'conversas:atender'];
  }
}
