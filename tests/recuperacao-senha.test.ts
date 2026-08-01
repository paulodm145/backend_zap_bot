import './configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { criarAplicacao } from '../src/app.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { RecuperacaoSenhaRepository } from '../src/repositories/recuperacao-senha.repository.js';
import { UsuarioCentralRepository } from '../src/repositories/usuario-central.repository.js';
import type { EnviadorEmail, MensagemEmail } from '../src/services/enviador-email.service.js';
import { HashSenhaService } from '../src/services/hash-senha.service.js';
import { RecuperacaoSenhaService } from '../src/services/recuperacao-senha.service.js';

const url = process.env.TEST_DATABASE_URL;
const descreverIntegracao = url ? describe : describe.skip;

class EmailMemoria implements EnviadorEmail {
  public mensagens: MensagemEmail[] = [];
  public enviar(mensagem: MensagemEmail): Promise<void> {
    this.mensagens.push(mensagem);
    return Promise.resolve();
  }
}

descreverIntegracao('recuperação de senha', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(url ?? '') });
  const emails = new EmailMemoria();
  const senhas = new HashSenhaService();
  const service = new RecuperacaoSenhaService(
    new UsuarioCentralRepository(prisma),
    new RecuperacaoSenhaRepository(prisma),
    senhas,
    emails,
    'http://frontend.local',
    30,
  );
  let usuarioId = 0;

  beforeEach(async () => {
    emails.mensagens.length = 0;
    await prisma.tokenRecuperacaoSenha.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.assinatura.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.tenant.deleteMany();
    const tenant = await prisma.tenant.create({ data: { nome: 'Recuperação', status: 'ATIVO' } });
    const usuario = await prisma.usuario.create({
      data: {
        tenant_id: tenant.id,
        nome: 'Pessoa',
        email: 'pessoa@tenant.com',
        senha_hash: await senhas.gerar('SenhaAntiga123'),
        papel: 'ADMIN_TENANT',
      },
    });
    usuarioId = usuario.id;
  });

  afterAll(async () => prisma.$disconnect());

  function tokenEnviado(): string {
    const texto = emails.mensagens[0]?.texto ?? '';
    return new URL(texto.replace('Acesse ', '')).searchParams.get('token') ?? '';
  }

  it('responde de forma neutra e persiste somente o hash', async () => {
    await service.solicitar({ email: 'inexistente@tenant.com' });
    expect(emails.mensagens).toHaveLength(0);
    await service.solicitar({ email: ' PESSOA@TENANT.COM ' });
    const token = tokenEnviado();
    const registro = await prisma.tokenRecuperacaoSenha.findFirstOrThrow();
    expect(token).not.toBe('');
    expect(registro.token_hash).not.toContain(token);
  });

  it('consome uma única vez, revoga sessões e bloqueia replay concorrente', async () => {
    await prisma.refreshToken.create({
      data: {
        usuario_id: usuarioId,
        token_hash: 'refresh',
        familia: crypto.randomUUID(),
        expira_at: new Date(Date.now() + 60_000),
      },
    });
    await service.solicitar({ email: 'pessoa@tenant.com' });
    const entrada = { token: tokenEnviado(), novaSenha: 'SenhaNovaSegura123' };
    const resultados = await Promise.allSettled([
      service.redefinir(entrada),
      service.redefinir(entrada),
    ]);
    expect(resultados.filter((resultado) => resultado.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.refreshToken.findFirst()).toMatchObject({
      motivo_revogacao: 'SENHA_REDEFINIDA',
    });
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(await senhas.comparar(entrada.novaSenha, usuario.senha_hash)).toBe(true);
  });

  it('rejeita token expirado', async () => {
    await service.solicitar({ email: 'pessoa@tenant.com' });
    const token = tokenEnviado();
    await prisma.tokenRecuperacaoSenha.updateMany({ data: { expira_at: new Date(0) } });
    await expect(
      service.redefinir({ token, novaSenha: 'SenhaNovaSegura123' }),
    ).rejects.toMatchObject({ codigo: 'TOKEN_RECUPERACAO_INVALIDO' });
  });

  it('rejeita token desconhecido sem criar registro', async () => {
    await expect(
      service.redefinir({
        token: 'token-desconhecido-com-tamanho-suficiente',
        novaSenha: 'SenhaNovaSegura123',
      }),
    ).rejects.toMatchObject({ codigo: 'TOKEN_RECUPERACAO_INVALIDO' });
    expect(await prisma.tokenRecuperacaoSenha.count()).toBe(0);
  });

  it('expõe os contratos HTTP públicos', async () => {
    const aplicacao = criarAplicacao({ prismaCentral: prisma });
    await request(aplicacao)
      .post('/api/v1/auth/esqueci-senha')
      .send({ email: 'inexistente@tenant.com' })
      .expect(202);
    await request(aplicacao)
      .post('/api/v1/auth/redefinir-senha')
      .send({ token: 'token-desconhecido-com-tamanho-suficiente', novaSenha: 'SenhaNovaSegura123' })
      .expect(422);
  });
});
