import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { ambiente } from './config/ambiente.js';
import { logger } from './config/logger.js';
import { gerarDocumentoOpenApi } from './config/openapi.js';
import { AutenticacaoController } from './controllers/autenticacao.controller.js';
import { AutenticacaoInternaController } from './controllers/autenticacao-interna.controller.js';
import { ProntidaoController } from './controllers/prontidao.controller.js';
import { obterPrismaCentral } from './database/prisma-central.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { MuitasRequisicoesError } from './erros/erro-aplicacao.js';
import { adicionarCorrelacao } from './middlewares/correlacao.middleware.js';
import { protegerDocumentacao } from './middlewares/documentacao.middleware.js';
import { tratarErro } from './middlewares/erro.middleware.js';
import { RefreshTokenRepository } from './repositories/refresh-token.repository.js';
import { UsuarioInternoMemoriaRepository } from './repositories/memoria/usuario-interno-memoria.repository.js';
import { UsuarioCentralRepository } from './repositories/usuario-central.repository.js';
import { criarRotasAutenticacao } from './rotas/autenticacao.rotas.js';
import { criarRotasAutenticacaoInterna } from './rotas/autenticacao-interna.rotas.js';
import { criarRotasInternas } from './rotas/interno.rotas.js';
import { criarRotasSaude } from './rotas/saude.rotas.js';
import { AutenticacaoInternaService } from './services/autenticacao-interna.service.js';
import { AutenticacaoService } from './services/autenticacao.service.js';
import { EstadoAutenticacaoInternaService } from './services/estado-autenticacao-interna.service.js';
import { HashSenhaService } from './services/hash-senha.service.js';
import { ProntidaoService } from './services/prontidao.service.js';
import type { VerificadorDependencia } from './services/prontidao.service.js';
import { TokenInternoService } from './services/token-interno.service.js';
import { TokenTenantService } from './services/token-tenant.service.js';
import { TotpService } from './services/totp.service.js';

interface OpcoesAplicacao {
  verificadoresProntidao?: VerificadorDependencia[];
  prismaCentral?: PrismaClient;
}

export function criarAplicacao(opcoes: OpcoesAplicacao = {}): Express {
  const aplicacao = express();
  const tokens = new TokenInternoService({
    segredo: ambiente.JWT_INTERNO_SECRET,
    expiracaoSegundos: ambiente.JWT_INTERNO_EXPIRACAO_SEGUNDOS,
  });
  const prismaCentral = opcoes.prismaCentral ?? obterPrismaCentral();
  const usuariosCentrais = new UsuarioCentralRepository(prismaCentral);
  const usuarios =
    ambiente.NODE_ENV === 'test' && !opcoes.prismaCentral
      ? new UsuarioInternoMemoriaRepository()
      : usuariosCentrais;
  const autenticacao = new AutenticacaoInternaService(
    usuarios,
    tokens,
    new EstadoAutenticacaoInternaService(ambiente.JWT_INTERNO_SECRET),
    new TotpService(ambiente.TOTP_CRIPTOGRAFIA_CHAVE),
  );
  const autenticacaoController = new AutenticacaoInternaController(autenticacao);
  const tokenTenant = new TokenTenantService(
    ambiente.JWT_TENANT_SECRET,
    ambiente.JWT_TENANT_EXPIRACAO_SEGUNDOS,
  );
  const autenticacaoTenant = new AutenticacaoService(
    usuariosCentrais,
    new RefreshTokenRepository(prismaCentral),
    new HashSenhaService(),
    tokenTenant,
    ambiente.REFRESH_TOKEN_EXPIRACAO_DIAS,
  );
  const autenticacaoTenantController = new AutenticacaoController(autenticacaoTenant);
  const prontidaoController = new ProntidaoController(
    new ProntidaoService(opcoes.verificadoresProntidao ?? []),
  );
  const documentoOpenApi = gerarDocumentoOpenApi();

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
  aplicacao.get(
    '/api/v1/openapi.json',
    protegerDocumentacao,
    helmet({ contentSecurityPolicy: false }),
    (_requisicao, resposta) => {
      resposta.status(200).json(documentoOpenApi);
    },
  );
  aplicacao.use(
    '/api/v1/docs',
    protegerDocumentacao,
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(documentoOpenApi),
  );
  aplicacao.use(helmet());
  aplicacao.use(
    cors({
      origin: ambiente.ORIGENS_PERMITIDAS,
      credentials: true,
    }),
  );
  aplicacao.use(express.json({ limit: '1mb' }));
  aplicacao.use('/api/v1/auth', criarRotasAutenticacao(autenticacaoTenantController));
  aplicacao.use(
    '/api/v1/interno/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_requisicao, _resposta, proximo) => {
        proximo(new MuitasRequisicoesError());
      },
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
