import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { LoginEntrada } from '../dtos/login.dto.js';
import { CredenciaisInvalidasError, RefreshTokenInvalidoError } from '../erros/erro-aplicacao.js';
import { normalizarEmail } from '../helpers/email.helper.js';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository.js';
import type { UsuarioCentralRepository } from '../repositories/usuario-central.repository.js';
import type { HashSenhaService } from './hash-senha.service.js';
import type { TokenTenantService } from './token-tenant.service.js';

interface ContextoRequisicao {
  ip?: string;
  userAgent?: string;
}

interface SessaoEmitida {
  accessToken: string;
  refreshToken: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    tenantId: string;
  };
}

export class AutenticacaoService {
  public constructor(
    private readonly usuarios: UsuarioCentralRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly senhas: HashSenhaService,
    private readonly tokens: TokenTenantService,
    private readonly refreshExpiracaoDias: number,
  ) {}

  public async login(entrada: LoginEntrada, contexto: ContextoRequisicao): Promise<SessaoEmitida> {
    const usuario = await this.usuarios.buscarTenantPorEmail(normalizarEmail(entrada.email));
    const hashComparacao =
      usuario?.senha_hash ?? '$2b$12$000000000000000000000uGFr4A5Zs4P2RQmC8YlQXrZ8Pq9a';
    const senhaValida = await this.senhas.comparar(entrada.senha, hashComparacao);

    if (!usuario || !senhaValida || !usuario.tenant) {
      throw new CredenciaisInvalidasError();
    }

    if (usuario.tenant.status !== 'ATIVO') {
      throw new CredenciaisInvalidasError();
    }

    const refreshToken = this.gerarTokenOpaco();
    await this.refreshTokens.criar({
      usuario_id: usuario.id,
      token_hash: this.gerarHash(refreshToken),
      familia: randomUUID(),
      expira_at: this.calcularExpiracao(),
      ...this.contextoPersistencia(contexto),
    });

    return {
      accessToken: this.tokens.emitir({
        publicId: usuario.public_id,
        tenantPublicId: usuario.tenant.public_id,
        email: usuario.email,
      }),
      refreshToken,
      usuario: {
        id: usuario.public_id,
        nome: usuario.nome,
        email: usuario.email,
        tenantId: usuario.tenant.public_id,
      },
    };
  }

  public async refresh(
    refreshToken: string | undefined,
    contexto: ContextoRequisicao,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshToken) {
      throw new RefreshTokenInvalidoError();
    }

    const atual = await this.refreshTokens.buscarPorHash(this.gerarHash(refreshToken));

    if (!atual) {
      throw new RefreshTokenInvalidoError();
    }

    if (atual.revogado_at) {
      await this.refreshTokens.revogarFamilia(atual.familia, 'REUTILIZACAO_DETECTADA');
      throw new RefreshTokenInvalidoError();
    }

    if (atual.expira_at <= new Date()) {
      await this.refreshTokens.revogar(atual.id, 'EXPIRADO');
      throw new RefreshTokenInvalidoError();
    }

    const usuario = await this.usuarios.buscarPorIdComTenant(atual.usuario_id);
    if (!usuario?.tenant || !usuario.ativo || usuario.tenant.status !== 'ATIVO') {
      await this.refreshTokens.revogarFamilia(atual.familia, 'USUARIO_OU_TENANT_INATIVO');
      throw new RefreshTokenInvalidoError();
    }

    const novoRefreshToken = this.gerarTokenOpaco();
    await this.refreshTokens.rotacionar(atual.id, {
      usuario_id: atual.usuario_id,
      token_hash: this.gerarHash(novoRefreshToken),
      familia: atual.familia,
      expira_at: this.calcularExpiracao(),
      ...this.contextoPersistencia(contexto),
    });

    return {
      accessToken: this.tokens.emitir({
        publicId: usuario.public_id,
        tenantPublicId: usuario.tenant.public_id,
        email: usuario.email,
      }),
      refreshToken: novoRefreshToken,
    };
  }

  public async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const existente = await this.refreshTokens.buscarPorHash(this.gerarHash(refreshToken));
    if (existente) await this.refreshTokens.revogar(existente.id, 'LOGOUT');
  }

  private gerarTokenOpaco(): string {
    return randomBytes(48).toString('base64url');
  }

  private gerarHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private calcularExpiracao(): Date {
    return new Date(Date.now() + this.refreshExpiracaoDias * 86_400_000);
  }

  private contextoPersistencia(contexto: ContextoRequisicao) {
    return {
      ...(contexto.ip ? { ip: contexto.ip } : {}),
      ...(contexto.userAgent ? { user_agent: contexto.userAgent.slice(0, 500) } : {}),
    };
  }
}
