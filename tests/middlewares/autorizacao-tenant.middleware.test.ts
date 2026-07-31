import '../configurar-ambiente.js';

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { exigirAdminTenant } from '../../src/middlewares/autorizacao-tenant.middleware.js';
import { tratarErro } from '../../src/middlewares/erro.middleware.js';

const criarApp = (papel: 'ADMIN_TENANT' | 'USUARIO') => {
  const app = express();
  app.use((requisicao, _resposta, proximo) => {
    requisicao.usuarioTenant = { id: 'id', email: 'a@b.com', tenantId: 'tenant', papel };
    proximo();
  });
  app.put('/empresa', exigirAdminTenant, (_requisicao, resposta) => resposta.sendStatus(204));
  app.use(tratarErro);
  return app;
};

describe('autorização do tenant', () => {
  it('permite administrador', async () => {
    await request(criarApp('ADMIN_TENANT')).put('/empresa').expect(204);
  });

  it('nega usuário comum', async () => {
    const resposta = await request(criarApp('USUARIO')).put('/empresa').expect(403);
    expect(resposta.body).toMatchObject({ erro: { codigo: 'ACESSO_NEGADO' } });
  });
});
