import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { FluxoController } from '../src/controllers/fluxo.controller.js';
import { catalogoBlocosFluxoSchema } from '../src/dtos/fluxo.dto.js';
import { criarRotasFluxos } from '../src/rotas/fluxo.rotas.js';

const aplicacao = express();
aplicacao.use('/api/v1/fluxos', criarRotasFluxos(new FluxoController()));

describe('catálogo de blocos da API de fluxos', () => {
  it('resolve a rota estática antes do parâmetro fluxoId', async () => {
    const resposta = await request(aplicacao).get('/api/v1/fluxos/blocos');

    expect(resposta.status).toBe(200);
    expect(() => catalogoBlocosFluxoSchema.parse(resposta.body as unknown)).not.toThrow();
  });
});
