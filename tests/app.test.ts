import './configurar-ambiente.js';

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { criarAplicacao } from '../src/app.js';
import { adicionarCorrelacao } from '../src/middlewares/correlacao.middleware.js';
import { tratarErro } from '../src/middlewares/erro.middleware.js';
import { TokenInternoService } from '../src/services/token-interno.service.js';

describe('aplicação', () => {
  const aplicacao = criarAplicacao();

  it('informa a saúde da API', async () => {
    const resposta = await request(aplicacao).get('/api/v1/saude');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ status: 'ok' });
    expect(resposta.headers['x-correlation-id']).toEqual(expect.any(String));
  });

  it('informa a prontidão da API', async () => {
    const resposta = await request(aplicacao).get('/api/v1/prontidao');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({
      status: 'pronto',
      dependencias: [],
    });
  });

  it('expõe o documento OpenAPI em desenvolvimento e teste', async () => {
    const resposta = await request(aplicacao).get('/api/v1/openapi.json');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({ openapi: '3.0.3' });
  });

  it('permite ao frontend configurado obter o contrato OpenAPI', async () => {
    const resposta = await request(aplicacao)
      .get('/api/v1/openapi.json')
      .set('Origin', 'http://localhost:3001');

    expect(resposta.status).toBe(200);
    expect(resposta.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(resposta.headers['access-control-allow-credentials']).toBe('true');
  });

  it('expõe o Swagger UI em desenvolvimento e teste', async () => {
    const resposta = await request(aplicacao).get('/api/v1/docs/');

    expect(resposta.status).toBe(200);
    expect(resposta.text).toContain('Swagger UI');
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

  it('aceita token válido exclusivamente na rota interna', async () => {
    const tokens = new TokenInternoService({
      segredo: process.env.JWT_INTERNO_SECRET ?? '',
      expiracaoSegundos: 900,
    });
    const accessToken = tokens.emitir({
      id: '62b07d40-f7a7-4c52-ab82-41536fc77bc2',
      email: 'admin@zapbot.local',
      papel: 'super_admin',
    });

    const resposta = await request(aplicacao)
      .get('/api/v1/interno/saude')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      status: 'ok',
      escopo: 'interno',
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

  it('limita tentativas repetidas de login interno', async () => {
    const aplicacaoIsolada = criarAplicacao();
    let ultimoStatus = 0;
    let ultimoCorpo: unknown;

    for (let tentativa = 0; tentativa < 11; tentativa += 1) {
      const resposta = await request(aplicacaoIsolada).post('/api/v1/interno/auth/login').send({
        email: 'admin@zapbot.local',
        senha: 'senha-segura',
      });
      ultimoStatus = resposta.status;
      ultimoCorpo = resposta.body;
    }

    expect(ultimoStatus).toBe(429);
    expect(ultimoCorpo).toMatchObject({
      erro: {
        codigo: 'LIMITE_TENTATIVAS',
      },
    });
  });

  it('responde com erro padronizado para rota inexistente', async () => {
    const resposta = await request(aplicacao).get('/api/v1/rota-inexistente');

    expect(resposta.status).toBe(404);
    expect(resposta.body).toEqual({
      erro: {
        codigo: 'ROTA_NAO_ENCONTRADA',
        mensagem: 'Rota não encontrada',
      },
    });
  });

  it('não expõe detalhes de um erro interno', async () => {
    const aplicacaoComErro = express();
    aplicacaoComErro.use(adicionarCorrelacao);
    aplicacaoComErro.get('/erro', () => {
      throw new Error('detalhe interno sigiloso');
    });
    aplicacaoComErro.use(tratarErro);

    const resposta = await request(aplicacaoComErro).get('/erro');

    expect(resposta.status).toBe(500);
    expect(resposta.body).toEqual({
      erro: {
        codigo: 'ERRO_INTERNO',
        mensagem: 'Ocorreu um erro interno',
      },
    });
    expect(JSON.stringify(resposta.body)).not.toContain('detalhe interno sigiloso');
    expect(JSON.stringify(resposta.body)).not.toContain('stack');
  });

  it('autoriza a origem CORS configurada com credenciais', async () => {
    const resposta = await request(aplicacao)
      .get('/api/v1/saude')
      .set('Origin', 'http://localhost:3001');

    expect(resposta.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(resposta.headers['access-control-allow-credentials']).toBe('true');
  });

  it('não autoriza uma origem CORS não configurada', async () => {
    const resposta = await request(aplicacao)
      .get('/api/v1/saude')
      .set('Origin', 'https://origem-nao-permitida.example');

    expect(resposta.headers['access-control-allow-origin']).toBeUndefined();
  });
});
