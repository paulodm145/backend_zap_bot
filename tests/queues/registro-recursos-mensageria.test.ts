import { describe, expect, it } from 'vitest';

import { RegistroRecursosMensageria } from '../../src/queues/registro-recursos-mensageria.js';

describe('registro de recursos de mensageria', () => {
  it('fecha filas e workers registrados na ordem inversa', async () => {
    const fechados: string[] = [];
    const registro = new RegistroRecursosMensageria();
    const fila = registro.registrar({
      close: () => {
        fechados.push('fila');
        return Promise.resolve();
      },
    });
    registro.registrar({
      close: () => {
        fechados.push('worker');
        return Promise.resolve();
      },
    });

    await registro.fecharTodos();
    await registro.fecharTodos();

    expect(fila).toHaveProperty('close');
    expect(fechados).toEqual(['worker', 'fila']);
  });
});
