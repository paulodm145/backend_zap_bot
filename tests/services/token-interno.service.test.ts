import '../configurar-ambiente.js';

import { describe, expect, it } from 'vitest';

import { TokenInternoService } from '../../src/services/token-interno.service.js';

const configuracao = {
  segredo: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres',
  expiracaoSegundos: 900,
};

describe('TokenInternoService', () => {
  it('emite e valida um token interno', () => {
    const servico = new TokenInternoService(configuracao);
    const token = servico.emitir({
      id: '62b07d40-f7a7-4c52-ab82-41536fc77bc2',
      email: 'admin@zapbot.local',
      papel: 'super_admin',
    });

    expect(servico.verificar(token)).toMatchObject({
      sub: '62b07d40-f7a7-4c52-ab82-41536fc77bc2',
      email: 'admin@zapbot.local',
      papel: 'super_admin',
      escopo: 'interno',
    });
  });

  it('rejeita token assinado com outro segredo', () => {
    const emissor = new TokenInternoService(configuracao);
    const verificador = new TokenInternoService({
      ...configuracao,
      segredo: 'outro-segredo-de-teste-com-mais-de-trinta-caracteres',
    });
    const token = emissor.emitir({
      id: '62b07d40-f7a7-4c52-ab82-41536fc77bc2',
      email: 'admin@zapbot.local',
      papel: 'super_admin',
    });

    expect(() => verificador.verificar(token)).toThrow('Token interno inválido ou expirado');
  });
});
