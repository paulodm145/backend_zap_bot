import './configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { criarAplicacao } from '../src/app.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { HashSenhaService } from '../src/services/hash-senha.service.js';
import { TokenInternoService } from '../src/services/token-interno.service.js';
import { TokenTenantService } from '../src/services/token-tenant.service.js';
import { TenantCentralRepository } from '../src/repositories/tenant-central.repository.js';
import { CriptografiaService } from '../src/services/criptografia.service.js';
import { ProvisionamentoTenantService } from '../src/services/provisionamento-tenant.service.js';

const urlTeste = process.env.TEST_DATABASE_URL ?? 'postgresql://invalido';
const descreverIntegracao = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const respostaPaginadaSchema = z.object({
  dados: z.array(z.object({ public_id: z.string(), nome: z.string(), status: z.string() })),
  total: z.number(),
  skip: z.number(),
  take: z.number(),
});

descreverIntegracao('administração interna de tenants', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(urlTeste) });
  const aplicacao = criarAplicacao({ prismaCentral: prisma });
  const tokens = new TokenInternoService({
    segredo: process.env.JWT_INTERNO_SECRET ?? '',
    expiracaoSegundos: 900,
  });
  let token: string;
  let adminPublicId: string;

  beforeAll(async () => prisma.$connect());
  beforeEach(async () => {
    await prisma.auditoriaInterna.deleteMany({
      where: { autor: { email: 'admin-tenants@interno.test' } },
    });
    await prisma.assinatura.deleteMany({
      where: { tenant: { nome: { startsWith: 'Admin Teste' } } },
    });
    await prisma.usuario.deleteMany({ where: { email: 'admin-tenants@interno.test' } });
    await prisma.usuario.deleteMany({
      where: { tenant: { nome: { startsWith: 'Admin Teste' } } },
    });
    await prisma.tenant.deleteMany({ where: { nome: { startsWith: 'Admin Teste' } } });
    await prisma.plano.deleteMany({ where: { nome: { startsWith: 'Plano Admin Teste' } } });

    const admin = await prisma.usuario.create({
      data: {
        nome: 'Admin de Tenants',
        email: 'admin-tenants@interno.test',
        senha_hash: await new HashSenhaService().gerar('senha-interna-forte'),
        papel: 'SUPER_ADMIN',
      },
    });
    adminPublicId = admin.public_id;
    token = tokens.emitir({
      id: admin.public_id,
      email: admin.email,
      papel: 'super_admin',
    });
  });

  afterAll(async () => {
    await prisma.auditoriaInterna.deleteMany({
      where: { autor: { email: 'admin-tenants@interno.test' } },
    });
    await prisma.assinatura.deleteMany({
      where: { tenant: { nome: { startsWith: 'Admin Teste' } } },
    });
    await prisma.usuario.deleteMany({ where: { email: 'admin-tenants@interno.test' } });
    await prisma.usuario.deleteMany({
      where: { tenant: { nome: { startsWith: 'Admin Teste' } } },
    });
    await prisma.tenant.deleteMany({ where: { nome: { startsWith: 'Admin Teste' } } });
    await prisma.plano.deleteMany({ where: { nome: { startsWith: 'Plano Admin Teste' } } });
    await prisma.$disconnect();
  });

  it('lista com busca, filtro, ordenação e paginação padronizada', async () => {
    await prisma.tenant.createMany({
      data: [
        { nome: 'Admin Teste Alfa', status: 'ATIVO' },
        { nome: 'Admin Teste Beta', status: 'SUSPENSO' },
      ],
    });
    const resposta = await request(aplicacao)
      .get('/api/v1/interno/tenants')
      .query({
        busca: 'alfa',
        status: 'ATIVO',
        skip: 0,
        take: 10,
        ordenarPor: 'nome',
        ordem: 'asc',
      })
      .set('Authorization', `Bearer ${token}`);
    expect(resposta.status, JSON.stringify(resposta.body as unknown)).toBe(200);
    const corpo = respostaPaginadaSchema.parse(resposta.body as unknown);
    expect(corpo).toMatchObject({ total: 1, skip: 0, take: 10 });
    expect(corpo.dados[0]?.nome).toBe('Admin Teste Alfa');
  });

  it('protege a listagem com autenticação exclusiva do super admin', async () => {
    expect((await request(aplicacao).get('/api/v1/interno/tenants')).status).toBe(401);
  });

  it('detalha um tenant pelo public_id', async () => {
    const tenant = await prisma.tenant.create({ data: { nome: 'Admin Teste Detalhe' } });
    const resposta = await request(aplicacao)
      .get(`/api/v1/interno/tenants/${tenant.public_id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(resposta.status, JSON.stringify(resposta.body as unknown)).toBe(200);
    expect(resposta.body as unknown).toMatchObject({ public_id: tenant.public_id });
  });

  it('retorna 404 ao detalhar tenant inexistente', async () => {
    const resposta = await request(aplicacao)
      .get('/api/v1/interno/tenants/3ae6b7a8-22bf-46eb-a9ae-e722229602ee')
      .set('Authorization', `Bearer ${token}`);
    expect(resposta.status).toBe(404);
  });

  it('emite acesso tenant temporário, limpa refresh anterior e registra auditoria', async () => {
    const tenant = await prisma.tenant.create({
      data: {
        nome: 'Admin Teste Impersonação',
        status: 'ATIVO',
        usuarios: {
          create: {
            nome: 'Admin Tenant Impersonado',
            email: 'admin-impersonado@tenant.test',
            senha_hash: await new HashSenhaService().gerar('senha-tenant-segura'),
            papel: 'ADMIN_TENANT',
          },
        },
      },
      include: { usuarios: true },
    });

    const resposta = await request(aplicacao)
      .post(`/api/v1/interno/tenants/${tenant.public_id}/impersonar`)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', 'refreshToken=sessao-tenant-anterior');

    expect(resposta.status, JSON.stringify(resposta.body as unknown)).toBe(200);
    expect(resposta.headers['set-cookie']?.[0]).toContain('refreshToken=;');
    expect(resposta.body as unknown).toMatchObject({
      usuario: {
        id: tenant.usuarios[0]?.public_id,
        tenantId: tenant.public_id,
        papel: 'ADMIN_TENANT',
      },
      impersonacao: { ativa: true, operadorId: adminPublicId, expiraEmSegundos: 900 },
    });
    const accessToken = z.object({ accessToken: z.string() }).parse(resposta.body).accessToken;
    const payload = new TokenTenantService(process.env.JWT_TENANT_SECRET ?? '', 900).verificar(
      accessToken,
    );
    expect(payload).toMatchObject({
      sub: tenant.usuarios[0]?.public_id,
      tenantId: tenant.public_id,
      papel: 'ADMIN_TENANT',
      impersonacao: { operadorPublicId: adminPublicId },
    });
    expect(
      await prisma.auditoriaInterna.count({
        where: {
          acao: 'IMPERSONAR_TENANT',
          entidade_public_id: tenant.public_id,
          autor: { public_id: adminPublicId },
        },
      }),
    ).toBe(1);
  });

  it('não permite impersonar tenant suspenso ou sem administrador ativo', async () => {
    const suspenso = await prisma.tenant.create({
      data: { nome: 'Admin Teste Impersonação Suspenso', status: 'SUSPENSO' },
    });
    const semAdministrador = await prisma.tenant.create({
      data: { nome: 'Admin Teste Impersonação Sem Admin', status: 'ATIVO' },
    });

    const [respostaSuspenso, respostaSemAdministrador] = await Promise.all([
      request(aplicacao)
        .post(`/api/v1/interno/tenants/${suspenso.public_id}/impersonar`)
        .set('Authorization', `Bearer ${token}`),
      request(aplicacao)
        .post(`/api/v1/interno/tenants/${semAdministrador.public_id}/impersonar`)
        .set('Authorization', `Bearer ${token}`),
    ]);

    expect(respostaSuspenso.status).toBe(404);
    expect(respostaSemAdministrador.status).toBe(404);
  });

  it('altera status com confirmação e registra auditoria', async () => {
    const tenant = await prisma.tenant.create({
      data: { nome: 'Admin Teste Status', status: 'ATIVO' },
    });
    const resposta = await request(aplicacao)
      .patch(`/api/v1/interno/tenants/${tenant.public_id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SUSPENSO', confirmar: true, motivo: 'Solicitação operacional' });
    expect(resposta.status).toBe(200);
    expect(resposta.body as unknown).toMatchObject({ status: 'SUSPENSO' });
    const auditoria = await prisma.auditoriaInterna.findFirstOrThrow({
      where: { autor: { public_id: adminPublicId }, entidade_public_id: tenant.public_id },
    });
    expect(auditoria.acao).toBe('ALTERAR_STATUS_TENANT');
  });

  it('altera plano manualmente e registra auditoria', async () => {
    const tenant = await prisma.tenant.create({
      data: { nome: 'Admin Teste Plano', status: 'ATIVO' },
    });
    const plano = await prisma.plano.create({
      data: {
        nome: 'Plano Admin Teste Pro',
        limite_conversas_mes: 1000,
        preco_centavos: 9900,
      },
    });
    const resposta = await request(aplicacao)
      .patch(`/api/v1/interno/tenants/${tenant.public_id}/plano`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planoId: plano.public_id, confirmar: true, motivo: 'Acordo comercial manual' });
    expect(resposta.status).toBe(200);
    expect(resposta.body as unknown).toMatchObject({ status: 'MANUAL' });
    expect(
      await prisma.auditoriaInterna.count({
        where: { acao: 'ALTERAR_PLANO_TENANT', entidade_public_id: tenant.public_id },
      }),
    ).toBe(1);
  });

  it('recusa transição de status não permitida', async () => {
    const tenant = await prisma.tenant.create({
      data: { nome: 'Admin Teste Transição', status: 'AGUARDANDO_PAGAMENTO' },
    });
    const resposta = await request(aplicacao)
      .patch(`/api/v1/interno/tenants/${tenant.public_id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ATIVO', confirmar: true, motivo: 'Tentativa não permitida' });
    expect(resposta.status).toBe(422);
  });

  it('recusa alteração de plano para tenant cancelado', async () => {
    const tenant = await prisma.tenant.create({
      data: { nome: 'Admin Teste Cancelado', status: 'CANCELADO' },
    });
    const resposta = await request(aplicacao)
      .patch(`/api/v1/interno/tenants/${tenant.public_id}/plano`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        planoId: 'f50e7241-c38b-4d15-bbee-bf3121ad9b11',
        confirmar: true,
        motivo: 'Tentativa não permitida',
      });
    expect(resposta.status).toBe(422);
  });

  it('retoma provisionamento após falha sem duplicar registros', async () => {
    const plano = await prisma.plano.create({
      data: {
        nome: 'Plano Admin Teste Provisionamento',
        limite_conversas_mes: 500,
        preco_centavos: 4900,
      },
    });
    let tentativas = 0;
    const banco = {
      criarSeAusente: () =>
        Promise.resolve('postgresql://postgres:postgres@127.0.0.1:5432/zapbot_tenant_retry'),
      aplicarMigrations: () => {
        tentativas += 1;
        return tentativas === 1 ? Promise.reject(new Error('Falha simulada')) : Promise.resolve();
      },
      criarPerfilAdministrador: () => Promise.resolve(),
    };
    const servico = new ProvisionamentoTenantService(
      new TenantCentralRepository(prisma),
      new HashSenhaService(),
      new CriptografiaService(process.env.TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE ?? ''),
      banco,
    );
    const entrada = {
      chaveIdempotencia: '128fa69c-41ea-49da-bf49-c5562198b115',
      nome: 'Admin Teste Provisionamento',
      planoId: plano.public_id,
      administrador: {
        nome: 'Primeira Administradora',
        email: 'primeira-admin@tenant.test',
        senha: 'senha-inicial-segura',
      },
    };
    await expect(servico.provisionar(entrada)).rejects.toThrow('Falha simulada');
    const concluido = await servico.provisionar(entrada);
    expect(concluido).toMatchObject({
      status: 'ATIVO',
      etapa_provisionamento: 'CONCLUIDO',
    });
    expect(
      await prisma.tenant.count({
        where: { provisionamento_chave: entrada.chaveIdempotencia },
      }),
    ).toBe(1);
    expect(await prisma.usuario.count({ where: { email: entrada.administrador.email } })).toBe(1);
    const repetido = await servico.provisionar(entrada);
    expect(repetido.etapa_provisionamento).toBe('CONCLUIDO');
    expect(tentativas).toBe(2);
  });

  it('recusa provisionamento com plano inexistente', async () => {
    const servico = new ProvisionamentoTenantService(
      new TenantCentralRepository(prisma),
      new HashSenhaService(),
      new CriptografiaService(process.env.TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE ?? ''),
      {
        criarSeAusente: () => Promise.reject(new Error('Não deveria criar banco')),
        aplicarMigrations: () => Promise.resolve(),
        criarPerfilAdministrador: () => Promise.resolve(),
      },
    );
    await expect(
      servico.provisionar({
        chaveIdempotencia: '99cc0f13-61c8-418e-9273-04d3186375b0',
        nome: 'Admin Teste Plano Ausente',
        planoId: '7fd60142-bb34-49f1-95f1-13745b737b66',
        administrador: {
          nome: 'Admin Ausente',
          email: 'admin-ausente@tenant.test',
          senha: 'senha-inicial-segura',
        },
      }),
    ).rejects.toMatchObject({ codigo: 'NAO_ENCONTRADO' });
  });
});
