import bcrypt from 'bcryptjs';

import type { LoginInternoDTO } from '../dtos/login-interno.dto.js';
import type { EstadoInternoDTO, VerificarTotpInternoDTO } from '../dtos/totp-interno.dto.js';
import { AcessoNegadoError, NaoAutenticadoError } from '../erros/erro-aplicacao.js';
import type { UsuarioInternoRepository } from '../repositories/contratos/usuario-interno.repository.js';
import type { TokenInternoService } from './token-interno.service.js';
import type { EstadoAutenticacaoInternaService } from './estado-autenticacao-interna.service.js';
import type { TotpService } from './totp.service.js';

export interface ResultadoLoginInterno {
  exigeSegundoFator: boolean;
  accessToken?: string;
  exigeConfiguracao?: boolean;
  estadoToken?: string;
}

export class AutenticacaoInternaService {
  public constructor(
    private readonly usuarios: UsuarioInternoRepository,
    private readonly tokens: TokenInternoService,
    private readonly estados: EstadoAutenticacaoInternaService,
    private readonly totp: TotpService,
    private readonly totpObrigatorio = true,
  ) {}

  public async login(entrada: LoginInternoDTO): Promise<ResultadoLoginInterno> {
    const usuario = await this.usuarios.buscarPorEmail(entrada.email);

    if (!usuario || !(await bcrypt.compare(entrada.senha, usuario.senhaHash))) {
      throw new NaoAutenticadoError('E-mail ou senha inválidos');
    }

    if (!usuario.ativo || usuario.papel !== 'super_admin') {
      throw new AcessoNegadoError('Usuário sem acesso ao painel interno');
    }

    if (!this.totpObrigatorio) {
      return {
        exigeSegundoFator: false,
        accessToken: this.emitirToken(usuario),
      };
    }

    return {
      exigeSegundoFator: true,
      exigeConfiguracao: !usuario.totpHabilitado,
      estadoToken: this.estados.emitir(usuario.publicId),
    };
  }

  public async configurar(entrada: EstadoInternoDTO): Promise<{ segredo: string; qrCode: string }> {
    const estado = this.estados.verificar(entrada.estadoToken);
    const usuario = await this.buscarSuperAdmin(estado.sub);
    if (usuario.totpHabilitado) {
      throw new AcessoNegadoError('TOTP já configurado');
    }
    const configuracao = this.totp.gerar(usuario.email);
    await this.usuarios.salvarTotp(
      usuario.publicId,
      this.totp.criptografar(configuracao.segredo),
      false,
    );
    return {
      segredo: configuracao.segredo,
      qrCode: await this.totp.gerarQrCode(configuracao.uri),
    };
  }

  public async verificar(entrada: VerificarTotpInternoDTO): Promise<{ accessToken: string }> {
    const estado = this.estados.verificar(entrada.estadoToken);
    const usuario = await this.buscarSuperAdmin(estado.sub);
    if (!usuario.totpSecretEncrypted) {
      throw new NaoAutenticadoError('TOTP ainda não configurado');
    }
    const segredo = this.totp.descriptografar(usuario.totpSecretEncrypted);
    if (!this.totp.validar(segredo, usuario.email, entrada.codigo)) {
      throw new NaoAutenticadoError('Código TOTP inválido');
    }
    if (!usuario.totpHabilitado) {
      await this.usuarios.salvarTotp(usuario.publicId, usuario.totpSecretEncrypted, true);
    }
    return {
      accessToken: this.emitirToken(usuario),
    };
  }

  private async buscarSuperAdmin(publicId: string) {
    const usuario = await this.usuarios.buscarPorPublicId(publicId);
    if (!usuario || !usuario.ativo || usuario.papel !== 'super_admin') {
      throw new NaoAutenticadoError();
    }
    return usuario;
  }

  private emitirToken(usuario: { publicId: string; email: string }): string {
    return this.tokens.emitir({
      id: usuario.publicId,
      email: usuario.email,
      papel: 'super_admin',
    });
  }
}
