import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { ambiente } from './config/ambiente.js';
import { logger } from './config/logger.js';
import { AutenticacaoInternaController } from './controllers/autenticacao-interna.controller.js';
import { ProntidaoController } from './controllers/prontidao.controller.js';
import { adicionarCorrelacao } from './middlewares/correlacao.middleware.js';
import { tratarErro } from './middlewares/erro.middleware.js';
import { UsuarioInternoMemoriaRepository } from './repositories/memoria/usuario-interno-memoria.repository.js';
import { criarRotasAutenticacaoInterna } from './rotas/autenticacao-interna.rotas.js';
import { criarRotasInternas } from './rotas/interno.rotas.js';
import { criarRotasSaude } from './rotas/saude.rotas.js';
import { AutenticacaoInternaService } from './services/autenticacao-interna.service.js';
import { ProntidaoService } from './services/prontidao.service.js';
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
  const prontidaoController = new ProntidaoController(new ProntidaoService([]));

  aplicacao.disable('x-powered-by');
  aplicacao.use(adicionarCorrelacao);
  aplicacao.use(
    pinoHttp({
      logger,
      customProps: (requisicao) => ({
        correlationId: requisicao.correlationId,
      }),
    }),
  );
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
  aplicacao.use('/api/v1', criarRotasSaude(prontidaoController));

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
