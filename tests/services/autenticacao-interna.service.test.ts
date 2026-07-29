import '../configurar-ambiente.js';

import bcrypt from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';

import type {
  UsuarioInterno,
  UsuarioInternoRepository,
} from '../../src/repositories/contratos/usuario-interno.repository.js';
import { AutenticacaoInternaService } from '../../src/services/autenticacao-interna.service.js';
import { EstadoAutenticacaoInternaService } from '../../src/services/estado-autenticacao-interna.service.js';
import { TokenInternoService } from '../../src/services/token-interno.service.js';
import { TotpService } from '../../src/services/totp.service.js';

const usuarioBase: UsuarioInterno = {
  id: 1,
  publicId: '62b07d40-f7a7-4c52-ab82-41536fc77bc2',
  email: 'admin@zapbot.local',
  senhaHash: bcrypt.hashSync('senha-segura', 4),
  papel: 'super_admin',
  ativo: true,
  totpHabilitado: false,
};

function criarServico(usuario: UsuarioInterno | null): AutenticacaoInternaService {
  const repository: UsuarioInternoRepository = {
    buscarPorEmail: vi.fn().mockResolvedValue(usuario),
    buscarPorPublicId: vi.fn().mockResolvedValue(usuario),
    salvarTotp: vi.fn().mockResolvedValue(undefined),
  };
  const tokens = new TokenInternoService({
    segredo: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres',
    expiracaoSegundos: 900,
  });

  return new AutenticacaoInternaService(
    repository,
    tokens,
    new EstadoAutenticacaoInternaService('segredo-de-teste-com-mais-de-trinta-e-dois-caracteres'),
    new TotpService('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  );
}

describe('AutenticacaoInternaService', () => {
  it('exige configuração do TOTP para super admin ativo', async () => {
    const servico = criarServico(usuarioBase);

    const resultado = await servico.login({
      email: usuarioBase.email,
      senha: 'senha-segura',
    });

    expect(resultado.exigeSegundoFator).toBe(true);
    expect(resultado.exigeConfiguracao).toBe(true);
    expect(resultado.estadoToken).toEqual(expect.any(String));
  });

  it('não revela se o e-mail ou a senha estão incorretos', async () => {
    const servico = criarServico(null);

    await expect(
      servico.login({
        email: 'desconhecido@zapbot.local',
        senha: 'senha-segura',
      }),
    ).rejects.toMatchObject({
      codigo: 'NAO_AUTENTICADO',
      message: 'E-mail ou senha inválidos',
    });
  });

  it('exige segundo fator sem emitir token quando TOTP está habilitado', async () => {
    const servico = criarServico({ ...usuarioBase, totpHabilitado: true });

    const resultado = await servico.login({
      email: usuarioBase.email,
      senha: 'senha-segura',
    });

    expect(resultado.exigeSegundoFator).toBe(true);
    expect(resultado.exigeConfiguracao).toBe(false);
    expect(resultado.estadoToken).toEqual(expect.any(String));
  });
});
