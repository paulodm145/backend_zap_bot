import { describe, expect, it, vi } from 'vitest';

import {
  ProntidaoService,
  type VerificadorDependencia,
} from '../../src/services/prontidao.service.js';

describe('ProntidaoService', () => {
  it('informa que todas as dependências estão disponíveis', async () => {
    const verificador: VerificadorDependencia = {
      nome: 'postgresql',
      verificar: vi.fn().mockResolvedValue(undefined),
    };

    const resultado = await new ProntidaoService([verificador]).verificar();

    expect(resultado).toEqual({
      pronto: true,
      dependencias: [{ nome: 'postgresql', disponivel: true }],
    });
  });

  it('informa indisponibilidade sem expor o erro da dependência', async () => {
    const verificador: VerificadorDependencia = {
      nome: 'redis',
      verificar: vi.fn().mockRejectedValue(new Error('credencial sigilosa')),
    };

    const resultado = await new ProntidaoService([verificador]).verificar();

    expect(resultado).toEqual({
      pronto: false,
      dependencias: [{ nome: 'redis', disponivel: false }],
    });
  });
});
