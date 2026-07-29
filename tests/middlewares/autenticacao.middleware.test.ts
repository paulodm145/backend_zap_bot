import '../configurar-ambiente.js';

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { criarAutenticacaoMiddleware } from '../../src/middlewares/autenticacao.middleware.js';
import { tratarErro } from '../../src/middlewares/erro.middleware.js';
import { TokenTenantService } from '../../src/services/token-tenant.service.js';

describe('middleware de autenticação do tenant', () => {
  const tokens = new TokenTenantService(
    'segredo-tenant-do-middleware-com-mais-de-trinta-e-dois',
    900,
  );

  function criarApp() {
    const app = express();
    app.get('/protegida', criarAutenticacaoMiddleware(tokens), (requisicao, resposta) => {
      resposta.json(requisicao.usuarioTenant);
    });
    app.use(tratarErro);
    return app;
  }

  it('anexa usuário e tenant de um Bearer válido', async () => {
    const token = tokens.emitir({
      publicId: '72f810fd-7355-4653-9ca7-d8b46f75450e',
      tenantPublicId: 'c480f80d-15f4-490a-9304-091da5f77e31',
      email: 'usuario@empresa.com',
    });
    const resposta = await request(criarApp())
      .get('/protegida')
      .set('Authorization', `Bearer ${token}`);
    expect(resposta.status).toBe(200);
    expect(resposta.body as unknown).toEqual({
      id: '72f810fd-7355-4653-9ca7-d8b46f75450e',
      tenantId: 'c480f80d-15f4-490a-9304-091da5f77e31',
      email: 'usuario@empresa.com',
    });
  });

  it.each([undefined, 'Bearer inválido'])(
    'retorna 401 padronizado para autorização %s',
    async (authorization) => {
      const requisicao = request(criarApp()).get('/protegida');
      const resposta = authorization
        ? await requisicao.set('Authorization', authorization)
        : await requisicao;
      expect(resposta.status).toBe(401);
    },
  );
});
