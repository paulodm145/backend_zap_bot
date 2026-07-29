import bcrypt from 'bcryptjs';

import type { LoginInternoDTO } from '../dtos/login-interno.dto.js';
import { AcessoNegadoError, NaoAutenticadoError } from '../erros/erro-aplicacao.js';
import type { UsuarioInternoRepository } from '../repositories/contratos/usuario-interno.repository.js';
import type { TokenInternoService } from './token-interno.service.js';

export interface ResultadoLoginInterno {
  exigeSegundoFator: boolean;
  accessToken?: string;
}

export class AutenticacaoInternaService {
  public constructor(
    private readonly usuarios: UsuarioInternoRepository,
    private readonly tokens: TokenInternoService,
  ) {}

  public async login(entrada: LoginInternoDTO): Promise<ResultadoLoginInterno> {
    const usuario = await this.usuarios.buscarPorEmail(entrada.email);

    if (!usuario || !(await bcrypt.compare(entrada.senha, usuario.senhaHash))) {
      throw new NaoAutenticadoError('E-mail ou senha inválidos');
    }

    if (!usuario.ativo || usuario.papel !== 'super_admin') {
      throw new AcessoNegadoError('Usuário sem acesso ao painel interno');
    }

    if (usuario.totpHabilitado) {
      return { exigeSegundoFator: true };
    }

    return {
      exigeSegundoFator: false,
      accessToken: this.tokens.emitir({
        id: usuario.id,
        email: usuario.email,
        papel: 'super_admin',
      }),
    };
  }
}
