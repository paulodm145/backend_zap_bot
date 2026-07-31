import { describe, expect, it, vi } from 'vitest';

import { BrasilApiService } from '../../src/services/brasil-api.service.js';

const resposta = (corpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('BrasilApiService', () => {
  it('valida e converte a consulta de CEP', async () => {
    const executarFetch = vi.fn<typeof fetch>().mockResolvedValue(
      resposta({
        cep: '01001-000',
        state: 'SP',
        city: 'São Paulo',
        neighborhood: 'Sé',
        street: 'Praça da Sé',
        city_ibge: 3550308,
      }),
    );
    const resultado = await new BrasilApiService(
      'https://teste/api',
      1000,
      1,
      executarFetch,
    ).consultarCep('01001-000');
    expect(resultado.city_ibge).toBe('3550308');
  });

  it('repete uma falha transitória e recupera', async () => {
    const executarFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(resposta({}, 503))
      .mockResolvedValueOnce(resposta({ cep: '01001000', state: 'SP', city: 'São Paulo' }));
    await expect(
      new BrasilApiService('https://teste/api', 1000, 2, executarFetch).consultarCep('01001000'),
    ).resolves.toMatchObject({ city: 'São Paulo' });
    expect(executarFetch).toHaveBeenCalledTimes(2);
  });

  it('rejeita resposta externa fora do contrato', async () => {
    const executarFetch = vi.fn<typeof fetch>().mockResolvedValue(resposta({ cep: '01001000' }));
    await expect(
      new BrasilApiService('https://teste/api', 1000, 1, executarFetch).consultarCep('01001000'),
    ).rejects.toThrow();
  });
});
