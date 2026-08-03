import './configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { criarAplicacao } from '../src/app.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { HashSenhaService } from '../src/services/hash-senha.service.js';
import { TokenInternoService } from '../src/services/token-interno.service.js';

const urlTeste = process.env.TEST_DATABASE_URL ?? 'postgresql://invalido';
const descreverIntegracao = process.env.TEST_DATABASE_URL ? describe : describe.skip;

descreverIntegracao('exclusão definitiva de tenant', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(urlTeste) });
  const excluirBanco = vi.fn<(nomeBanco: string) => Promise<void>>();
  const fecharConexao = vi.fn<(tenantId: number) => Promise<void>>();
  const aplicacao = criarAplicacao({
    prismaCentral: prisma,
    exclusorBancoTenant: { excluirDefinitivamente: excluirBanco },
    encerradorConexaoTenant: { fechar: fecharConexao },
  });
  const tokens = new TokenInternoService({
    segredo: process.env.JWT_INTERNO_SECRET ?? '',
    expiracaoSegundos: 900,
  });
  const senha = 'senha-exclusao-segura';
  let token: string;
  let operadorPublicId: string;

  beforeAll(async () => prisma.$connect());

  beforeEach(async () => {
    excluirBanco.mockReset();
    excluirBanco.mockResolvedValue(undefined);
    fecharConexao.mockReset();
    fecharConexao.mockResolvedValue(undefined);
    await limparDados();
    const operador = await prisma.usuario.create({
      data: {
        nome: 'Operador Exclusão',
        email: 'operador-exclusao@interno.test',
        senha_hash: await new HashSenhaService().gerar(senha),
        papel: 'SUPER_ADMIN',
      },
    });
    operadorPublicId = operador.public_id;
    token = tokens.emitir({
      id: operador.public_id,
      email: operador.email,
      papel: 'super_admin',
    });
  });

  afterAll(async () => {
    await limparDados();
    await prisma.$disconnect();
  });

  it('exige a senha atual do super administrador', async () => {
    const tenant = await criarTenant('Senha', 'SUSPENSO');
    const resposta = await excluir(tenant.public_id, tenant.nome, 'senha-incorreta');

    expect(resposta.status).toBe(401);
    expect(excluirBanco).not.toHaveBeenCalled();
    expect(await prisma.tenant.count({ where: { id: tenant.id } })).toBe(1);
  });

  it('exige nome exato e bloqueio prévio do tenant', async () => {
    const suspenso = await criarTenant('Nome', 'SUSPENSO');
    const ativo = await criarTenant('Ativo', 'ATIVO');

    const [nomeInvalido, tenantAtivo] = await Promise.all([
      excluir(suspenso.public_id, 'Outro nome', senha),
      excluir(ativo.public_id, ativo.nome, senha),
    ]);

    expect(nomeInvalido.status).toBe(422);
    expect(tenantAtivo.status).toBe(409);
    expect(excluirBanco).not.toHaveBeenCalled();
  });

  it('preserva registros centrais, cancela acesso e audita quando o drop falha', async () => {
    const tenant = await criarTenant('Falha', 'SUSPENSO');
    excluirBanco.mockRejectedValueOnce(new Error('drop indisponível'));

    const resposta = await excluir(tenant.public_id, tenant.nome, senha);

    expect(resposta.status).toBe(500);
    expect(fecharConexao).toHaveBeenCalledWith(tenant.id);
    expect(await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).toMatchObject({
      status: 'CANCELADO',
    });
    expect(await prisma.usuario.count({ where: { tenant_id: tenant.id } })).toBe(1);
    expect(
      await prisma.auditoriaInterna.count({
        where: {
          acao: 'FALHA_EXCLUSAO_DEFINITIVA_TENANT',
          entidade_public_id: tenant.public_id,
        },
      }),
    ).toBe(1);
  });

  it('remove banco, usuários, assinaturas e tenant e preserva auditoria final', async () => {
    const tenant = await criarTenant('Sucesso', 'SUSPENSO');
    const plano = await prisma.plano.create({
      data: {
        nome: 'Plano Exclusão Sucesso',
        limite_conversas_mes: 100,
        preco_centavos: 0,
      },
    });
    await prisma.assinatura.create({
      data: { tenant_id: tenant.id, plano_id: plano.id, status: 'MANUAL' },
    });

    const resposta = await excluir(tenant.public_id, tenant.nome, senha);

    expect(resposta.status).toBe(204);
    expect(resposta.text).toBe('');
    expect(fecharConexao).toHaveBeenCalledWith(tenant.id);
    expect(excluirBanco).toHaveBeenCalledWith(tenant.nome_do_banco);
    expect(await prisma.tenant.count({ where: { id: tenant.id } })).toBe(0);
    expect(await prisma.usuario.count({ where: { tenant_id: tenant.id } })).toBe(0);
    expect(await prisma.assinatura.count({ where: { tenant_id: tenant.id } })).toBe(0);
    expect(
      await prisma.auditoriaInterna.count({
        where: {
          acao: 'EXCLUIR_TENANT_DEFINITIVAMENTE',
          entidade_public_id: tenant.public_id,
          autor: { public_id: operadorPublicId },
        },
      }),
    ).toBe(1);
  });

  async function criarTenant(sufixo: string, status: 'ATIVO' | 'SUSPENSO') {
    const identificadores: Record<string, string> = {
      Senha: 'aaaaaaaaaaaa',
      Nome: 'bbbbbbbbbbbb',
      Ativo: 'cccccccccccc',
      Falha: 'dddddddddddd',
      Sucesso: 'eeeeeeeeeeee',
    };
    return prisma.tenant.create({
      data: {
        nome: `Exclusão Teste ${sufixo}`,
        nome_do_banco: `zapbot_tenant_${identificadores[sufixo] ?? 'ffffffffffff'}`,
        string_conexao_encrypted: 'conexao-criptografada-de-teste',
        status,
        usuarios: {
          create: {
            nome: `Admin ${sufixo}`,
            email: `admin-exclusao-${sufixo.toLowerCase()}@tenant.test`,
            senha_hash: await new HashSenhaService().gerar('senha-tenant-segura'),
            papel: 'ADMIN_TENANT',
          },
        },
      },
    });
  }

  function excluir(tenantId: string, nomeTenant: string, senhaInformada: string) {
    return request(aplicacao)
      .delete(`/api/v1/interno/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        senha: senhaInformada,
        confirmar: true,
        nomeTenant,
        motivo: 'Remoção definitiva solicitada no teste automatizado',
      });
  }

  async function limparDados(): Promise<void> {
    await prisma.auditoriaInterna.deleteMany({
      where: {
        OR: [
          { autor: { email: 'operador-exclusao@interno.test' } },
          { acao: { in: ['FALHA_EXCLUSAO_DEFINITIVA_TENANT', 'EXCLUIR_TENANT_DEFINITIVAMENTE'] } },
        ],
      },
    });
    await prisma.assinatura.deleteMany({
      where: { tenant: { nome: { startsWith: 'Exclusão Teste' } } },
    });
    await prisma.usuario.deleteMany({
      where: {
        OR: [
          { email: 'operador-exclusao@interno.test' },
          { tenant: { nome: { startsWith: 'Exclusão Teste' } } },
        ],
      },
    });
    await prisma.tenant.deleteMany({ where: { nome: { startsWith: 'Exclusão Teste' } } });
    await prisma.plano.deleteMany({ where: { nome: { startsWith: 'Plano Exclusão' } } });
  }
});
