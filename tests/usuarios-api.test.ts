import './configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { UsuarioTenantController } from '../src/controllers/usuario-tenant.controller.js';
import { PrismaClient as PrismaCentral } from '../src/generated/prisma/client.js';
import { PrismaClient as PrismaTenant } from '../src/generated/prisma-tenant/client.js';
import { tratarErro } from '../src/middlewares/erro.middleware.js';
import { UsuarioCentralRepository } from '../src/repositories/usuario-central.repository.js';
import { criarRotasUsuariosTenant } from '../src/rotas/usuario-tenant.rotas.js';
import { HashSenhaService } from '../src/services/hash-senha.service.js';

const urlCentral = process.env.TEST_DATABASE_URL;
const urlTenant = process.env.TEST_TENANT_DATABASE_URL_A;
const descreverIntegracao = urlCentral && urlTenant ? describe : describe.skip;

descreverIntegracao('API de usuários do tenant', () => {
  const central = new PrismaCentral({ adapter: new PrismaPg(urlCentral ?? '') });
  const tenant = new PrismaTenant({ adapter: new PrismaPg(urlTenant ?? '') });
  let tenantId = 0;
  let adminCentralPublicId = '';
  let adminPerfilPublicId = '';

  beforeEach(async () => {
    await tenant.auditoriaUsuarioTenant.deleteMany();
    await tenant.usuarioTenant.deleteMany();
    await central.refreshToken.deleteMany();
    await central.assinatura.deleteMany();
    await central.usuario.deleteMany();
    await central.tenant.deleteMany();
    const registroTenant = await central.tenant.create({
      data: { nome: 'Tenant RBAC', status: 'ATIVO' },
    });
    tenantId = registroTenant.id;
    const admin = await central.usuario.create({
      data: {
        tenant_id: tenantId,
        nome: 'Admin',
        email: 'admin-rbac@tenant.com',
        senha_hash: 'hash',
        papel: 'ADMIN_TENANT',
      },
    });
    adminCentralPublicId = admin.public_id;
    const perfil = await tenant.usuarioTenant.create({
      data: {
        usuario_central_public_id: admin.public_id,
        nome: admin.nome,
        nome_normalizado: 'admin',
        email: admin.email,
        papel: 'ADMIN_TENANT',
      },
    });
    adminPerfilPublicId = perfil.public_id;
  });

  afterAll(async () => {
    await tenant.$disconnect();
    await central.$disconnect();
  });

  function app(papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE' = 'ADMIN_TENANT') {
    const aplicacao = express();
    aplicacao.use(express.json());
    aplicacao.use((requisicao, _resposta, proximo) => {
      requisicao.usuarioTenant = {
        id: adminCentralPublicId,
        email: 'admin-rbac@tenant.com',
        tenantId: 'b729496b-7a96-4296-922a-9cf6c55e55df',
        papel,
      };
      requisicao.contextoTenant = {
        id: tenantId,
        publicId: 'b729496b-7a96-4296-922a-9cf6c55e55df',
        prisma: tenant,
      };
      proximo();
    });
    aplicacao.use(
      '/usuarios',
      criarRotasUsuariosTenant(
        new UsuarioTenantController(new UsuarioCentralRepository(central), new HashSenhaService()),
      ),
    );
    aplicacao.use(tratarErro);
    return aplicacao;
  }

  it('cria, lista, edita, desativa e exclui sem retornar senha', async () => {
    const criada = await request(app())
      .post('/usuarios')
      .send({
        nome: 'Atendente Um',
        email: ' ATENDENTE@TENANT.COM ',
        senha: 'SenhaSegura123!',
        papel: 'ATENDENTE',
      })
      .expect(201);
    const usuarioId = (criada.body as unknown as { public_id: string }).public_id;
    expect(JSON.stringify(criada.body)).not.toContain('senha');
    expect(
      await central.usuario.findUnique({ where: { email: 'atendente@tenant.com' } }),
    ).not.toBeNull();

    const lista = await request(app()).get('/usuarios?skip=0&take=20&busca=atendente').expect(200);
    expect((lista.body as unknown as { total: number }).total).toBe(1);
    await request(app()).get(`/usuarios/${usuarioId}`).expect(200);
    await request(app())
      .put(`/usuarios/${usuarioId}`)
      .send({ nome: 'Gestora Editada', email: 'gestora@tenant.com', papel: 'GESTOR' })
      .expect(200);
    await request(app()).patch(`/usuarios/${usuarioId}/status`).send({ ativo: false }).expect(200);
    expect(
      await central.usuario.findUnique({ where: { email: 'gestora@tenant.com' } }),
    ).toMatchObject({ ativo: false });
    await request(app()).patch(`/usuarios/${usuarioId}/status`).send({ ativo: true }).expect(200);
    await request(app()).delete(`/usuarios/${usuarioId}`).expect(204);
    expect(await tenant.auditoriaUsuarioTenant.count()).toBeGreaterThanOrEqual(4);
  });

  it('protege último administrador e aplica matriz de papéis', async () => {
    await request(app())
      .patch(`/usuarios/${adminPerfilPublicId}/status`)
      .send({ ativo: false })
      .expect(422);
    await request(app('ATENDENTE')).get('/usuarios').expect(403);
    await request(app('GESTOR'))
      .put(`/usuarios/${adminPerfilPublicId}`)
      .send({ nome: 'Inválido' })
      .expect(422);
    await request(app('GESTOR'))
      .post('/usuarios')
      .send({
        nome: 'Admin proibido',
        email: 'admin-proibido@tenant.com',
        senha: 'SenhaSegura123!',
        papel: 'ADMIN_TENANT',
      })
      .expect(422);
  });

  it('permite rebaixar administrador quando existe outro ativo', async () => {
    await request(app())
      .post('/usuarios')
      .send({
        nome: 'Segundo Admin',
        email: 'segundo-admin@tenant.com',
        senha: 'SenhaSegura123!',
        papel: 'ADMIN_TENANT',
      })
      .expect(201);
    await request(app())
      .put(`/usuarios/${adminPerfilPublicId}`)
      .send({ papel: 'GESTOR' })
      .expect(200);
    expect(
      await tenant.usuarioTenant.findUnique({ where: { public_id: adminPerfilPublicId } }),
    ).toMatchObject({ papel: 'GESTOR' });
  });

  it('repara perfil ausente idempotentemente e impede e-mail global duplicado', async () => {
    const centralExistente = await central.usuario.create({
      data: {
        tenant_id: tenantId,
        nome: 'Perfil ausente',
        email: 'reparar@tenant.com',
        senha_hash: 'hash',
        papel: 'ATENDENTE',
      },
    });
    await request(app())
      .post('/usuarios')
      .send({
        nome: 'Ignorado',
        email: centralExistente.email,
        senha: 'SenhaSegura123!',
        papel: 'GESTOR',
      })
      .expect(201);
    expect(
      await tenant.usuarioTenant.findUnique({
        where: { usuario_central_public_id: centralExistente.public_id },
      }),
    ).not.toBeNull();

    const outroTenant = await central.tenant.create({ data: { nome: 'Outro', status: 'ATIVO' } });
    await central.usuario.create({
      data: {
        tenant_id: outroTenant.id,
        nome: 'Outro',
        email: 'global@tenant.com',
        senha_hash: 'hash',
        papel: 'ATENDENTE',
      },
    });
    await request(app())
      .post('/usuarios')
      .send({
        nome: 'Duplicado',
        email: 'global@tenant.com',
        senha: 'SenhaSegura123!',
        papel: 'ATENDENTE',
      })
      .expect(409);
  });

  it('restaura o perfil tenant quando a exclusão central falha', async () => {
    const criada = await request(app())
      .post('/usuarios')
      .send({
        nome: 'Perfil recuperável',
        email: 'recuperavel@tenant.com',
        senha: 'SenhaSegura123!',
        papel: 'ATENDENTE',
      })
      .expect(201);
    const usuarioId = (criada.body as unknown as { public_id: string }).public_id;
    const falha = vi
      .spyOn(UsuarioCentralRepository.prototype, 'excluirERevogar')
      .mockRejectedValueOnce(new Error('Falha central simulada'));

    await request(app()).delete(`/usuarios/${usuarioId}`).expect(500);

    expect(
      await tenant.usuarioTenant.findUnique({ where: { public_id: usuarioId } }),
    ).toMatchObject({ ativo: true, deletado_at: null });
    falha.mockRestore();
  });
});
