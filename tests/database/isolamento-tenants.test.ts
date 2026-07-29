import '../configurar-ambiente.js';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GerenciadorConexoesTenantLru } from '../../src/database/gerenciador-conexoes-tenant.js';

const urlA = process.env.TEST_TENANT_DATABASE_URL_A;
const urlB = process.env.TEST_TENANT_DATABASE_URL_B;
const descreverIntegracao = urlA && urlB ? describe : describe.skip;

descreverIntegracao('isolamento físico e cache LRU dos tenants', () => {
  const gerenciador = new GerenciadorConexoesTenantLru(1);

  beforeAll(async () => {
    const clienteA = await gerenciador.obter(1, urlA ?? '');
    await clienteA.contato.deleteMany();
    const clienteB = await gerenciador.obter(2, urlB ?? '');
    await clienteB.contato.deleteMany();
  });

  afterAll(async () => gerenciador.fecharTodos());

  it('não compartilha dados entre dois bancos e reabre o removido pelo LRU', async () => {
    const clienteA = await gerenciador.obter(1, urlA ?? '');
    await clienteA.contato.create({ data: { nome: 'Somente A', telefone: '5511999990001' } });

    const clienteB = await gerenciador.obter(2, urlB ?? '');
    expect(await clienteB.contato.count()).toBe(0);
    await clienteB.contato.create({ data: { nome: 'Somente B', telefone: '5511999990002' } });

    const clienteAReaberto = await gerenciador.obter(1, urlA ?? '');
    expect(await clienteAReaberto.contato.findMany()).toHaveLength(1);
    expect(await clienteAReaberto.contato.findFirst()).toMatchObject({ nome: 'Somente A' });
  });

  it('reaproveita a mesma abertura quando há acessos concorrentes', async () => {
    const gerenciadorConcorrente = new GerenciadorConexoesTenantLru(2);
    const [primeiro, segundo] = await Promise.all([
      gerenciadorConcorrente.obter(1, urlA ?? ''),
      gerenciadorConcorrente.obter(1, urlA ?? ''),
    ]);
    expect(primeiro).toBe(segundo);
    await gerenciadorConcorrente.fecharTodos();
  });
});
