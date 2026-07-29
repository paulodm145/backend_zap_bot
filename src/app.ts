import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { ambiente } from './config/ambiente.js';
import { logger } from './config/logger.js';
import { AutenticacaoInternaController } from './controllers/autenticacao-interna.controller.js';
import { tratarErro } from './middlewares/erro.middleware.js';
import { UsuarioInternoMemoriaRepository } from './repositories/memoria/usuario-interno-memoria.repository.js';
import { criarRotasAutenticacaoInterna } from './rotas/autenticacao-interna.rotas.js';
import { criarRotasInternas } from './rotas/interno.rotas.js';
import { AutenticacaoInternaService } from './services/autenticacao-interna.service.js';
import { TokenInternoService } from './services/token-interno.service.js';

export function criarAplicacao(): Express {
  const aplicacao = express();
  const tokens = new TokenInternoService({
    segredo: ambiente.JWT_INTERNO_SECRET,
    expiracaoSegundos: ambiente.JWT_INTERNO_EXPIRACAO_SEGUNDOS,
  });
  const usuarios = new UsuarioInternoMemoriaRepository();
  const autenticacao = new AutenticacaoInternaService(usuarios, tokens);
  const autenticacaoController = new AutenticacaoInternaController(autenticacao);

  aplicacao.disable('x-powered-by');
  aplicacao.use(pinoHttp({ logger }));
  aplicacao.use(helmet());
  aplicacao.use(
    cors({
      origin: ambiente.ORIGENS_PERMITIDAS,
      credentials: true,
    }),
  );
  aplicacao.use(express.json({ limit: '1mb' }));
  aplicacao.use(
    '/api/v1/interno/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
    criarRotasAutenticacaoInterna(autenticacaoController),
  );
  aplicacao.use('/api/v1/interno', criarRotasInternas(tokens));

  aplicacao.get('/api/v1/saude', (_requisicao, resposta) => {
    resposta.status(200).json({ status: 'ok' });
  });

  aplicacao.use((_requisicao, resposta) => {
    resposta.status(404).json({
      erro: {
        codigo: 'ROTA_NAO_ENCONTRADA',
        mensagem: 'Rota não encontrada',
      },
    });
  });
  aplicacao.use(tratarErro);

  return aplicacao;
}
