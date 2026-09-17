import { describe, expect, it } from 'vitest';

import { hostInterno, validarUrlExterna } from '../../src/helpers/url-externa.helper.js';

describe('validarUrlExterna', () => {
  it('aceita URL HTTPS pública', () => {
    const resultado = validarUrlExterna('https://api.erp-exemplo.com/v1');
    expect(resultado.valida).toBe(true);
    if (resultado.valida) expect(resultado.url.hostname).toBe('api.erp-exemplo.com');
  });

  it.each([
    ['nao-e-url', 'FORMATO_INVALIDO'],
    ['ftp://api.exemplo.com', 'PROTOCOLO_NAO_PERMITIDO'],
    ['http://api.exemplo.com', 'PROTOCOLO_NAO_PERMITIDO'],
    ['https://usuario:senha@api.exemplo.com', 'CREDENCIAL_NA_URL'],
  ])('recusa %s', (valor, motivo) => {
    const resultado = validarUrlExterna(valor);
    expect(resultado.valida).toBe(false);
    if (!resultado.valida) expect(resultado.motivo).toBe(motivo);
  });

  it.each([
    'https://localhost/api',
    'https://127.0.0.1/api',
    'https://10.1.2.3/api',
    'https://192.168.0.10/api',
    'https://172.16.0.1/api',
    'https://169.254.169.254/latest/meta-data',
    'https://servico.internal/api',
    'https://[::1]/api',
    'https://[fd00::1]/api',
  ])('recusa host privado %s', (valor) => {
    const resultado = validarUrlExterna(valor);
    expect(resultado.valida).toBe(false);
    if (!resultado.valida) expect(resultado.motivo).toBe('HOST_PRIVADO');
  });

  it('aceita IP público literal', () => {
    expect(validarUrlExterna('https://8.8.8.8/api').valida).toBe(true);
  });
});

describe('hostInterno', () => {
  it('trata 172.32 como público e 172.31 como privado', () => {
    expect(hostInterno('172.31.255.255')).toBe(true);
    expect(hostInterno('172.32.0.1')).toBe(false);
  });

  it('reconhece IPv4 mapeado em IPv6', () => {
    expect(hostInterno('::ffff:127.0.0.1')).toBe(true);
    expect(hostInterno('::ffff:8.8.8.8')).toBe(false);
  });

  it('ignora ponto final e diferença de caixa', () => {
    expect(hostInterno('LocalHost.')).toBe(true);
  });
});
