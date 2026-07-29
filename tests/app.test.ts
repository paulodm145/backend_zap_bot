import './configurar-ambiente.js';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { criarAplicacao } from '../src/app.js';

describe('aplicação', () => {
  const aplicacao = criarAplicacao();

  it('informa a saúde da API', async () => {
    const resposta = await request(aplicacao).get('/api/v1/saude');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ status: 'ok' });
  });

  it('protege as rotas internas', async () => {
    const resposta = await request(aplicacao).get('/api/v1/interno/saude');

    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({
      erro: {
        codigo: 'NAO_AUTENTICADO',
        mensagem: 'Autenticação necessária',
      },
    });
  });

  it('valida os dados do login interno', async () => {
    const resposta = await request(aplicacao).post('/api/v1/interno/auth/login').send({
      email: 'email-invalido',
      senha: 'curta',
    });

    expect(resposta.status).toBe(422);
    expect(resposta.body).toMatchObject({
      erro: {
        codigo: 'VALIDACAO',
      },
    });
  });

  it('não autentica um usuário inexistente', async () => {
    const resposta = await request(aplicacao).post('/api/v1/interno/auth/login').send({
      email: 'admin@zapbot.local',
      senha: 'senha-segura',
    });

    expect(resposta.status).toBe(401);
    expect(resposta.body).toMatchObject({
      erro: {
        codigo: 'NAO_AUTENTICADO',
      },
    });
  });
});
