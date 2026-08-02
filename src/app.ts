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
import { RecuperacaoSenhaController } from './controllers/recuperacao-senha.controller.js';
import { AutenticacaoInternaController } from './controllers/autenticacao-interna.controller.js';
import { ProntidaoController } from './controllers/prontidao.controller.js';
import { TenantsInternosController } from './controllers/tenants-internos.controller.js';
import type { WebhookWhatsappController } from './controllers/webhook-whatsapp.controller.js';
import { FluxoController } from './controllers/fluxo.controller.js';
import { EmpresaController } from './controllers/empresa.controller.js';
import { ContaWhatsappController } from './controllers/conta-whatsapp.controller.js';
import { UsuarioTenantController } from './controllers/usuario-tenant.controller.js';
import { SetorController } from './controllers/setor.controller.js';
import { PerfilController } from './controllers/perfil.controller.js';
import { HistoricoController } from './controllers/historico.controller.js';
import { DirecionamentoAtendimentoController } from './controllers/direcionamento-atendimento.controller.js';
import { MensagemAtendimentoController } from './controllers/mensagem-atendimento.controller.js';
import type { EnfileiradorMensagemSaida } from './services/mensagem-atendimento.service.js';
import { obterGerenciadorConexoesTenant } from './database/gerenciador-conexoes-tenant.js';
import { obterPrismaCentral } from './database/prisma-central.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { MuitasRequisicoesError } from './erros/erro-aplicacao.js';
import { adicionarCorrelacao } from './middlewares/correlacao.middleware.js';
import { protegerDocumentacao } from './middlewares/documentacao.middleware.js';
import { tratarErro } from './middlewares/erro.middleware.js';
import { criarAutenticacaoMiddleware } from './middlewares/autenticacao.middleware.js';
import { criarResolucaoTenantMiddleware } from './middlewares/resolucao-tenant.middleware.js';
import { RefreshTokenRepository } from './repositories/refresh-token.repository.js';
import { RecuperacaoSenhaRepository } from './repositories/recuperacao-senha.repository.js';
import { UsuarioInternoMemoriaRepository } from './repositories/memoria/usuario-interno-memoria.repository.js';
import { UsuarioCentralRepository } from './repositories/usuario-central.repository.js';
import { TenantCentralRepository } from './repositories/tenant-central.repository.js';
import { criarRotasAutenticacao } from './rotas/autenticacao.rotas.js';
import { criarRotasAutenticacaoInterna } from './rotas/autenticacao-interna.rotas.js';
import { criarRotasInternas } from './rotas/interno.rotas.js';
import { criarRotasSaude } from './rotas/saude.rotas.js';
import { criarRotasWebhookWhatsapp } from './rotas/webhook-whatsapp.rotas.js';
import { criarRotasFluxos } from './rotas/fluxo.rotas.js';
import { criarRotasEmpresa } from './rotas/empresa.rotas.js';
import { criarRotasContasWhatsapp } from './rotas/conta-whatsapp.rotas.js';
import { criarRotasUsuariosTenant } from './rotas/usuario-tenant.rotas.js';
import { criarRotasSetores, criarRotaVinculosSetores } from './rotas/setor.rotas.js';
import { criarRotasPerfil } from './rotas/perfil.rotas.js';
import { criarRotasContatos, criarRotasConversas } from './rotas/historico.rotas.js';
import { AutenticacaoInternaService } from './services/autenticacao-interna.service.js';
import { AutenticacaoService } from './services/autenticacao.service.js';
import { AdministracaoTenantsService } from './services/administracao-tenants.service.js';
import { EstadoAutenticacaoInternaService } from './services/estado-autenticacao-interna.service.js';
import { HashSenhaService } from './services/hash-senha.service.js';
import {
  EnfileiradorEmailLocal,
  type EnfileiradorEmail,
} from './services/enfileirador-email.service.js';
import { RecuperacaoSenhaService } from './services/recuperacao-senha.service.js';
import { ProntidaoService } from './services/prontidao.service.js';
import type { VerificadorDependencia } from './services/prontidao.service.js';
import { TokenInternoService } from './services/token-interno.service.js';
import { TokenTenantService } from './services/token-tenant.service.js';
import { TotpService } from './services/totp.service.js';
import { CriptografiaService } from './services/criptografia.service.js';
import { ProvisionadorBancoTenantService } from './services/provisionador-banco-tenant.service.js';
import { ProvisionamentoTenantService } from './services/provisionamento-tenant.service.js';
import { BrasilApiService } from './services/brasil-api.service.js';
import { WhatsappGraphApiService } from './services/whatsapp-graph-api.service.js';
import { RoteamentoWhatsappRepository } from './repositories/roteamento-whatsapp.repository.js';

interface OpcoesAplicacao {
  verificadoresProntidao?: VerificadorDependencia[];
  prismaCentral?: PrismaClient;
  webhookWhatsapp?: {
    controller: WebhookWhatsappController;
    appSecret: string;
  };
  enfileiradorMensagemSaida?: EnfileiradorMensagemSaida;
  enfileiradorEmail?: EnfileiradorEmail;
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
    ambiente.TOTP_INTERNO_OBRIGATORIO,
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
  const recuperacaoSenhaController = new RecuperacaoSenhaController(
    new RecuperacaoSenhaService(
      usuariosCentrais,
      new RecuperacaoSenhaRepository(prismaCentral),
      new HashSenhaService(),
      opcoes.enfileiradorEmail ?? new EnfileiradorEmailLocal(),
      ambiente.FRONTEND_URL,
      ambiente.RECUPERACAO_SENHA_EXPIRACAO_MINUTOS,
    ),
  );
  const tenantsRepository = new TenantCentralRepository(prismaCentral);
  const criptografiaConexaoTenant = new CriptografiaService(
    ambiente.TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE,
  );
  const tenantsController = new TenantsInternosController(
    tenantsRepository,
    new AdministracaoTenantsService(tenantsRepository),
    new ProvisionamentoTenantService(
      tenantsRepository,
      new HashSenhaService(),
      new CriptografiaService(ambiente.TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE),
      new ProvisionadorBancoTenantService(
        ambiente.POSTGRES_ADMIN_URL ?? 'postgresql://configuracao:ausente@localhost:5432/postgres',
      ),
    ),
  );
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
  if (opcoes.webhookWhatsapp) {
    aplicacao.use(
      '/api/v1/webhook/whatsapp',
      criarRotasWebhookWhatsapp(
        opcoes.webhookWhatsapp.controller,
        opcoes.webhookWhatsapp.appSecret,
      ),
    );
  }
  aplicacao.use(express.json({ limit: '1mb' }));
  aplicacao.use(
    '/api/v1/auth',
    criarRotasAutenticacao(autenticacaoTenantController, recuperacaoSenhaController),
  );
  aplicacao.use(
    '/api/v1/fluxos',
    criarAutenticacaoMiddleware(tokenTenant),
    criarResolucaoTenantMiddleware(
      tenantsRepository,
      criptografiaConexaoTenant,
      obterGerenciadorConexoesTenant(),
    ),
    criarRotasFluxos(new FluxoController()),
  );
  aplicacao.use(
    '/api/v1/empresa',
    criarAutenticacaoMiddleware(tokenTenant),
    criarResolucaoTenantMiddleware(
      tenantsRepository,
      criptografiaConexaoTenant,
      obterGerenciadorConexoesTenant(),
    ),
    criarRotasEmpresa(
      new EmpresaController(
        new BrasilApiService(
          ambiente.BRASIL_API_URL,
          ambiente.BRASIL_API_TIMEOUT_MS,
          ambiente.BRASIL_API_TENTATIVAS,
        ),
      ),
    ),
  );
  aplicacao.use(
    '/api/v1/contas-whatsapp',
    criarAutenticacaoMiddleware(tokenTenant),
    criarResolucaoTenantMiddleware(
      tenantsRepository,
      criptografiaConexaoTenant,
      obterGerenciadorConexoesTenant(),
    ),
    criarRotasContasWhatsapp(
      new ContaWhatsappController(
        new RoteamentoWhatsappRepository(prismaCentral),
        new CriptografiaService(ambiente.WHATSAPP_CREDENCIAIS_CRIPTOGRAFIA_CHAVE),
        new WhatsappGraphApiService(ambiente.WHATSAPP_GRAPH_API_URL),
      ),
    ),
  );
  aplicacao.use(
    '/api/v1/contatos',
    criarAutenticacaoMiddleware(tokenTenant),
    criarResolucaoTenantMiddleware(
      tenantsRepository,
      criptografiaConexaoTenant,
      obterGerenciadorConexoesTenant(),
    ),
    criarRotasContatos(new HistoricoController()),
  );
  aplicacao.use(
    '/api/v1/conversas',
    criarAutenticacaoMiddleware(tokenTenant),
    criarResolucaoTenantMiddleware(
      tenantsRepository,
      criptografiaConexaoTenant,
      obterGerenciadorConexoesTenant(),
    ),
    criarRotasConversas(
      new HistoricoController(),
      new DirecionamentoAtendimentoController(),
      opcoes.enfileiradorMensagemSaida
        ? new MensagemAtendimentoController(opcoes.enfileiradorMensagemSaida)
        : undefined,
    ),
  );
  aplicacao.use(
    '/api/v1/me',
    criarAutenticacaoMiddleware(tokenTenant),
    criarResolucaoTenantMiddleware(
      tenantsRepository,
      criptografiaConexaoTenant,
      obterGerenciadorConexoesTenant(),
    ),
    criarRotasPerfil(new PerfilController(usuariosCentrais, new HashSenhaService())),
  );
  aplicacao.use(
    '/api/v1/setores',
    criarAutenticacaoMiddleware(tokenTenant),
    criarResolucaoTenantMiddleware(
      tenantsRepository,
      criptografiaConexaoTenant,
      obterGerenciadorConexoesTenant(),
    ),
    criarRotasSetores(new SetorController()),
  );
  aplicacao.use(
    '/api/v1/usuarios',
    criarAutenticacaoMiddleware(tokenTenant),
    criarResolucaoTenantMiddleware(
      tenantsRepository,
      criptografiaConexaoTenant,
      obterGerenciadorConexoesTenant(),
    ),
    criarRotasUsuariosTenant(new UsuarioTenantController(usuariosCentrais, new HashSenhaService())),
    criarRotaVinculosSetores(new SetorController()),
  );
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
  aplicacao.use('/api/v1/interno', criarRotasInternas(tokens, tenantsController));
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
