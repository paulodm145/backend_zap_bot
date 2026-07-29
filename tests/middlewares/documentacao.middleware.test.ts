import '../configurar-ambiente.js';

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { criarProtecaoDocumentacao } from '../../src/middlewares/documentacao.middleware.js';

function criarAplicacaoProtegida() {
  const aplicacao = express();
  aplicacao.get(
    '/docs',
    criarProtecaoDocumentacao({
      ambiente: 'production',
      usuario: 'admin-docs',
      senha: 'senha-forte-de-teste',
    }),
    (_requisicao, resposta) => {
      resposta.status(200).json({ status: 'ok' });
    },
  );
  return aplicacao;
}

describe('proteção da documentação', () => {
  it('não exige autenticação fora de produção', async () => {
    const aplicacao = express();
    aplicacao.get(
      '/docs',
      criarProtecaoDocumentacao({ ambiente: 'test' }),
      (_requisicao, resposta) => {
        resposta.status(200).json({ status: 'ok' });
      },
    );

    const resposta = await request(aplicacao).get('/docs');

    expect(resposta.status).toBe(200);
  });

  it('rejeita acesso sem autenticação em produção', async () => {
    const resposta = await request(criarAplicacaoProtegida()).get('/docs');

    expect(resposta.status).toBe(401);
    expect(resposta.headers['www-authenticate']).toContain('Basic');
  });

  it('rejeita credenciais incorretas em produção', async () => {
    const resposta = await request(criarAplicacaoProtegida())
      .get('/docs')
      .auth('admin-docs', 'senha-incorreta');

    expect(resposta.status).toBe(401);
  });

  it('rejeita um header Basic malformado', async () => {
    const resposta = await request(criarAplicacaoProtegida())
      .get('/docs')
      .set('Authorization', `Basic ${Buffer.from('sem-separador').toString('base64')}`);

    expect(resposta.status).toBe(401);
  });

  it('permite credenciais corretas em produção', async () => {
    const resposta = await request(criarAplicacaoProtegida())
      .get('/docs')
      .auth('admin-docs', 'senha-forte-de-teste');

    expect(resposta.status).toBe(200);
  });
});
