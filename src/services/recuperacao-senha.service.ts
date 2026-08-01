import { createHash, randomBytes } from 'node:crypto';

import type { EsqueciSenhaEntrada, RedefinirSenhaEntrada } from '../dtos/recuperacao-senha.dto.js';
import { TokenRecuperacaoInvalidoError } from '../erros/erro-aplicacao.js';
import { normalizarEmail } from '../helpers/email.helper.js';
import type { RecuperacaoSenhaRepository } from '../repositories/recuperacao-senha.repository.js';
import type { UsuarioCentralRepository } from '../repositories/usuario-central.repository.js';
import type { EnviadorEmail } from './enviador-email.service.js';
import type { HashSenhaService } from './hash-senha.service.js';

export class RecuperacaoSenhaService {
  public constructor(
    private readonly usuarios: UsuarioCentralRepository,
    private readonly recuperacoes: RecuperacaoSenhaRepository,
    private readonly senhas: HashSenhaService,
    private readonly emails: EnviadorEmail,
    private readonly frontendUrl: string,
    private readonly expiracaoMinutos: number,
  ) {}

  public async solicitar(entrada: EsqueciSenhaEntrada): Promise<void> {
    const usuario = await this.usuarios.buscarTenantPorEmail(normalizarEmail(entrada.email));
    if (!usuario) return;
    const token = randomBytes(48).toString('base64url');
    await this.recuperacoes.substituir(
      usuario.id,
      this.hash(token),
      new Date(Date.now() + this.expiracaoMinutos * 60_000),
    );
    await this.emails.enviar({
      destinatario: usuario.email,
      assunto: 'Recuperação de senha',
      texto: `Acesse ${this.frontendUrl}/redefinir-senha?token=${encodeURIComponent(token)}`,
    });
  }

  public async redefinir(entrada: RedefinirSenhaEntrada): Promise<void> {
    const alterado = await this.recuperacoes.redefinir(
      this.hash(entrada.token),
      await this.senhas.gerar(entrada.novaSenha),
    );
    if (!alterado) throw new TokenRecuperacaoInvalidoError();
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
