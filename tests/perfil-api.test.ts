import './configurar-ambiente.js';
import { PrismaPg } from '@prisma/adapter-pg';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PerfilController } from '../src/controllers/perfil.controller.js';
import { PrismaClient as PrismaCentral } from '../src/generated/prisma/client.js';
import { PrismaClient as PrismaTenant } from '../src/generated/prisma-tenant/client.js';
import { tratarErro } from '../src/middlewares/erro.middleware.js';
import { UsuarioCentralRepository } from '../src/repositories/usuario-central.repository.js';
import { criarRotasPerfil } from '../src/rotas/perfil.rotas.js';
import { HashSenhaService } from '../src/services/hash-senha.service.js';

const urlCentral = process.env.TEST_DATABASE_URL;
const urlTenant = process.env.TEST_TENANT_DATABASE_URL_A;
const descreverIntegracao = urlCentral && urlTenant ? describe : describe.skip;

descreverIntegracao('API do perfil autenticado', () => {
  const central = new PrismaCentral({ adapter: new PrismaPg(urlCentral ?? '') });
  const tenant = new PrismaTenant({ adapter: new PrismaPg(urlTenant ?? '') });
  const senhas = new HashSenhaService();
  let centralPublicId = '';

  beforeEach(async () => {
    await tenant.atendenteSetor.deleteMany();
    await tenant.atendente.deleteMany();
    await tenant.usuarioTenant.deleteMany();
    await tenant.setor.deleteMany();
    await central.tokenRecuperacaoSenha.deleteMany();
    await central.refreshToken.deleteMany();
    await central.assinatura.deleteMany();
    await central.usuario.deleteMany();
    await central.tenant.deleteMany();
    const registroTenant = await central.tenant.create({
      data: { nome: 'Empresa Perfil', status: 'ATIVO' },
    });
    const usuario = await central.usuario.create({
      data: {
        tenant_id: registroTenant.id,
        nome: 'Pessoa Inicial',
        email: 'perfil@tenant.com',
        senha_hash: await senhas.gerar('SenhaAtual123'),
        papel: 'ATENDENTE',
      },
    });
    centralPublicId = usuario.public_id;
    const perfil = await tenant.usuarioTenant.create({
      data: {
        usuario_central_public_id: usuario.public_id,
        nome: usuario.nome,
        nome_normalizado: 'pessoa inicial',
        email: usuario.email,
        papel: 'ATENDENTE',
      },
    });
    const setor = await tenant.setor.create({
      data: { nome: 'Suporte', nome_normalizado: 'suporte' },
    });
    const atendente = await tenant.atendente.create({
      data: { usuario_tenant_id: perfil.id, nome: perfil.nome, email: perfil.email },
    });
    await tenant.atendenteSetor.create({
      data: { atendente_id: atendente.id, setor_id: setor.id },
    });
    await central.refreshToken.create({
      data: {
        usuario_id: usuario.id,
        token_hash: 'sessao-perfil',
        familia: crypto.randomUUID(),
        expira_at: new Date(Date.now() + 60_000),
      },
    });
  });

  afterAll(async () => {
    await tenant.$disconnect();
    await central.$disconnect();
  });

  function app() {
    const aplicacao = express();
    aplicacao.use(express.json());
    aplicacao.use((requisicao, _resposta, proximo) => {
      requisicao.usuarioTenant = {
        id: centralPublicId,
        email: 'perfil@tenant.com',
        tenantId: crypto.randomUUID(),
        papel: 'ATENDENTE',
      };
      requisicao.contextoTenant = { id: 1, publicId: crypto.randomUUID(), prisma: tenant };
      proximo();
    });
    aplicacao.use(
      '/me',
      criarRotasPerfil(new PerfilController(new UsuarioCentralRepository(central), senhas)),
    );
    aplicacao.use(tratarErro);
    return aplicacao;
  }

  it('retorna tenant, permissões efetivas e setores', async () => {
    await request(app())
      .get('/me')
      .expect(200)
      .expect((resposta) => {
        const corpo = resposta.body as unknown as {
          tenant: { nome: string };
          permissoes: string[];
          setores: unknown[];
        };
        expect(corpo.tenant.nome).toBe('Empresa Perfil');
        expect(corpo.permissoes).toContain('conversas:atender');
        expect(corpo.setores).toHaveLength(1);
      });
  });

  it('sincroniza nome sem permitir papel ou permissões', async () => {
    await request(app()).put('/me').send({ nome: 'Pessoa Editada' }).expect(200);
    expect(
      await central.usuario.findUnique({ where: { public_id: centralPublicId } }),
    ).toMatchObject({ nome: 'Pessoa Editada', papel: 'ATENDENTE' });
    expect(await tenant.atendente.findFirst()).toMatchObject({ nome: 'Pessoa Editada' });
    await request(app()).put('/me').send({ nome: 'Tentativa', papel: 'ADMIN_TENANT' }).expect(422);
  });

  it('exige senha atual, altera senha e revoga sessões', async () => {
    await request(app())
      .put('/me/senha')
      .send({ senhaAtual: 'errada', novaSenha: 'OutraSenhaNova123' })
      .expect(401);
    await request(app())
      .put('/me/senha')
      .send({ senhaAtual: 'SenhaAtual123', novaSenha: 'SenhaAtual123' })
      .expect(409);
    await request(app())
      .put('/me/senha')
      .send({ senhaAtual: 'SenhaAtual123', novaSenha: 'OutraSenhaNova123' })
      .expect(204);
    const usuario = await central.usuario.findUniqueOrThrow({
      where: { public_id: centralPublicId },
    });
    expect(await senhas.comparar('OutraSenhaNova123', usuario.senha_hash)).toBe(true);
    expect(await central.refreshToken.findFirst()).toMatchObject({
      motivo_revogacao: 'SENHA_ALTERADA',
    });
  });

  it('altera e-mail em fluxo separado com reautenticação', async () => {
    await request(app())
      .put('/me/email')
      .send({ senhaAtual: 'SenhaAtual123', novoEmail: ' NOVO@TENANT.COM ' })
      .expect(200);
    expect(
      await central.usuario.findUnique({ where: { public_id: centralPublicId } }),
    ).toMatchObject({ email: 'novo@tenant.com' });
    expect(await tenant.usuarioTenant.findFirst()).toMatchObject({ email: 'novo@tenant.com' });
    expect(await tenant.atendente.findFirst()).toMatchObject({ email: 'novo@tenant.com' });
  });
});
