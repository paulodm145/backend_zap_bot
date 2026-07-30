import '../configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PapelUsuario, PrismaClient } from '../../src/generated/prisma/client.js';
import { RoteamentoWhatsappRepository } from '../../src/repositories/roteamento-whatsapp.repository.js';
import { TenantCentralRepository } from '../../src/repositories/tenant-central.repository.js';
import { UsuarioCentralRepository } from '../../src/repositories/usuario-central.repository.js';

const urlTeste =
  process.env.TEST_DATABASE_URL ??
  'postgresql://configuracao:ausente@localhost:5432/configuracao_ausente';
const prisma = new PrismaClient({
  adapter: new PrismaPg(urlTeste),
});
const descreverIntegracao = process.env.TEST_DATABASE_URL ? describe : describe.skip;

descreverIntegracao('repositories do banco central', () => {
  beforeEach(async () => {
    await prisma.auditoriaInterna.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.assinatura.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.plano.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('cria e busca usuário pelo e-mail', async () => {
    const repository = new UsuarioCentralRepository(prisma);
    const senhaHash = await bcrypt.hash('senha-de-teste', 4);

    const criado = await repository.criar({
      nome: 'Administrador',
      email: 'admin@zapbot.local',
      senhaHash,
      papel: PapelUsuario.SUPER_ADMIN,
    });
    const encontrado = await repository.buscarPorEmail('admin@zapbot.local');

    expect(criado.id).toBeTypeOf('number');
    expect(criado.public_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(encontrado).toMatchObject({
      id: criado.id,
      publicId: criado.public_id,
      papel: 'super_admin',
    });
  });

  it('impede e-mails duplicados', async () => {
    const repository = new UsuarioCentralRepository(prisma);
    const entrada = {
      nome: 'Administrador',
      email: 'admin@zapbot.local',
      senhaHash: 'hash-de-teste',
      papel: PapelUsuario.SUPER_ADMIN,
    };

    await repository.criar(entrada);

    await expect(repository.criar(entrada)).rejects.toThrow();
  });

  it('cria e busca tenant pelo identificador público', async () => {
    const repository = new TenantCentralRepository(prisma);

    const criado = await repository.criar({ nome: 'Empresa de teste' });
    const encontrado = await repository.buscarPorPublicId(criado.public_id);

    expect(criado.id).toBeTypeOf('number');
    expect(encontrado?.id).toBe(criado.id);
  });

  it('resolve tenant ativo pelo phone_number_id central', async () => {
    const tenant = await prisma.tenant.create({
      data: { nome: 'Empresa com WhatsApp', status: 'ATIVO' },
    });
    await prisma.roteamentoWhatsapp.create({
      data: {
        tenant_id: tenant.id,
        phone_number_id: 'numero-central-teste',
      },
    });

    const encontrado = await new RoteamentoWhatsappRepository(prisma).buscarTenantAtivo(
      'numero-central-teste',
    );

    expect(encontrado?.tenant).toMatchObject({
      public_id: tenant.public_id,
      status: 'ATIVO',
      deletado_at: null,
    });
  });

  it('possui os índices essenciais da migration', async () => {
    const indices = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;
    const nomes = indices.map((indice) => indice.indexname);

    expect(nomes).toContain('users_email_key');
    expect(nomes).toContain('tenants_status_updated_at_idx');
    expect(nomes).toContain('tenants_status_created_at_idx');
    expect(nomes).toContain('tenants_nome_trgm_idx');
    expect(nomes).toContain('assinaturas_tenant_id_status_idx');
    expect(nomes).toContain('refresh_tokens_expira_at_idx');
    expect(nomes).toContain('roteamentos_whatsapp_phone_number_id_key');
    expect(nomes).toContain('roteamentos_whatsapp_tenant_id_idx');
  });
});
