import '../configurar-ambiente.js';

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { GerenciadorConexoesTenant } from '../../src/database/gerenciador-conexoes-tenant.js';
import type { PrismaClient } from '../../src/generated/prisma-tenant/client.js';
import { criarResolucaoTenantMiddleware } from '../../src/middlewares/resolucao-tenant.middleware.js';
import { CriptografiaService } from '../../src/services/criptografia.service.js';

describe('resolução do tenant', () => {
  it('usa somente e-mail e tenant autenticados, ignorando seletores do cliente', async () => {
    const criptografia = new CriptografiaService(
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    );
    const buscarAtivoDoUsuario = vi.fn().mockResolvedValue({
      id: 12,
      public_id: 'tenant-autenticado',
      string_conexao_encrypted: criptografia.criptografar('postgresql://conexao-interna'),
    });
    const prisma = {} as PrismaClient;
    const conexoes: GerenciadorConexoesTenant = {
      obter: vi.fn().mockResolvedValue(prisma),
      fecharTodos: vi.fn().mockResolvedValue(undefined),
    };
    const app = express();
    app.use(express.json());
    app.use((requisicao, _resposta, proximo) => {
      requisicao.usuarioTenant = {
        id: 'usuario-publico',
        email: 'usuario@empresa.com',
        tenantId: 'tenant-autenticado',
      };
      proximo();
    });
    app.post(
      '/rota',
      criarResolucaoTenantMiddleware({ buscarAtivoDoUsuario }, criptografia, conexoes),
      (requisicao, resposta) => resposta.json({ tenantId: requisicao.contextoTenant?.publicId }),
    );

    const resposta = await request(app)
      .post('/rota?tenantId=tenant-invasor')
      .set('Host', 'tenant-invasor.exemplo.com')
      .set('X-Tenant-Id', 'tenant-invasor')
      .send({ tenantId: 'tenant-invasor' });

    expect(resposta.body as unknown).toEqual({ tenantId: 'tenant-autenticado' });
    expect(buscarAtivoDoUsuario).toHaveBeenCalledWith('usuario@empresa.com', 'tenant-autenticado');
  });
});
