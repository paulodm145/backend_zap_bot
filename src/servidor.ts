import { criarAplicacao } from './app.js';
import { ambiente } from './config/ambiente.js';
import { logger } from './config/logger.js';
import { NOMES_FILAS } from './config/filas.js';
import { criarConexaoRedis } from './config/redis.js';
import { WebhookWhatsappController } from './controllers/webhook-whatsapp.controller.js';
import { desconectarPrismaCentral, obterPrismaCentral } from './database/prisma-central.js';
import {
  fecharConexoesTenant,
  obterGerenciadorConexoesTenant,
} from './database/gerenciador-conexoes-tenant.js';
import { criarFila } from './queues/fila.factory.js';
import { RegistroRecursosMensageria } from './queues/registro-recursos-mensageria.js';
import { IdempotenciaRedisRepository } from './repositories/idempotencia-redis.repository.js';
import { RoteamentoWhatsappRepository } from './repositories/roteamento-whatsapp.repository.js';
import { TenantCentralRepository } from './repositories/tenant-central.repository.js';
import { EnfileiradorMensagemBullMqService } from './services/enfileirador-mensagem.service.js';
import { VerificadorBancoCentralService } from './services/verificador-banco-central.service.js';
import { VerificadorRedisService } from './services/verificador-redis.service.js';
import { WebhookWhatsappService } from './services/webhook-whatsapp.service.js';
import { CriptografiaService } from './services/criptografia.service.js';
import { ProcessadorMensagemRecebidaService } from './services/processador-mensagem-recebida.service.js';
import { jobMensagemRecebidaSchema, type JobMensagemRecebida } from './types/jobs.js';
import { criarWorker } from './workers/worker.factory.js';

const prismaCentral = obterPrismaCentral();
const redis = criarConexaoRedis(ambiente.REDIS_URL, 'api');
const recursosMensageria = new RegistroRecursosMensageria();
const filaMensagens = recursosMensageria.registrar(
  criarFila<JobMensagemRecebida>(NOMES_FILAS.mensagensRecebidas, redis),
);
const processadorMensagens = new ProcessadorMensagemRecebidaService(
  new TenantCentralRepository(prismaCentral),
  new CriptografiaService(ambiente.TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE),
  obterGerenciadorConexoesTenant(),
);
recursosMensageria.registrar(
  criarWorker(
    NOMES_FILAS.mensagensRecebidas,
    jobMensagemRecebidaSchema,
    async (job) => processadorMensagens.processar(job.data),
    redis,
    { concurrency: 10 },
  ),
);
const webhookWhatsappController = new WebhookWhatsappController(
  new WebhookWhatsappService(
    new RoteamentoWhatsappRepository(prismaCentral),
    new IdempotenciaRedisRepository(redis),
    new EnfileiradorMensagemBullMqService(filaMensagens),
    ambiente.WEBHOOK_IDEMPOTENCIA_SEGUNDOS,
  ),
  ambiente.WEBHOOK_WHATSAPP_VERIFY_TOKEN,
);
const aplicacao = criarAplicacao({
  prismaCentral,
  verificadoresProntidao: [
    new VerificadorBancoCentralService(prismaCentral),
    new VerificadorRedisService(redis),
  ],
  webhookWhatsapp: {
    controller: webhookWhatsappController,
    appSecret: ambiente.WEBHOOK_WHATSAPP_APP_SECRET,
  },
});

const servidor = aplicacao.listen(ambiente.PORTA, () => {
  logger.info({ porta: ambiente.PORTA }, 'API iniciada');
});

servidor.requestTimeout = ambiente.HTTP_REQUEST_TIMEOUT_MS;
servidor.headersTimeout = ambiente.HTTP_HEADERS_TIMEOUT_MS;
servidor.keepAliveTimeout = ambiente.HTTP_KEEP_ALIVE_TIMEOUT_MS;

let encerrando = false;

function encerrar(motivo: string, erro?: unknown): void {
  if (encerrando) {
    return;
  }

  encerrando = true;
  process.exitCode = erro === undefined ? 0 : 1;
  logger.info({ motivo }, 'Encerrando API');

  const encerramentoForcado = setTimeout(() => {
    logger.fatal({ motivo }, 'Tempo limite excedido durante o encerramento');
    process.exit(1);
  }, ambiente.HTTP_SHUTDOWN_TIMEOUT_MS);
  encerramentoForcado.unref();

  servidor.close((erro) => {
    void (async () => {
      if (erro) {
        logger.error({ erro }, 'Falha ao encerrar API');
        process.exitCode = 1;
      }

      try {
        await recursosMensageria.fecharTodos();
        if (redis.status === 'wait') {
          redis.disconnect();
        } else {
          await redis.quit();
        }
        await fecharConexoesTenant();
        await desconectarPrismaCentral();
      } catch (erroDesconexao) {
        logger.error({ erro: erroDesconexao }, 'Falha ao desconectar o banco central');
        process.exitCode = 1;
      }

      clearTimeout(encerramentoForcado);
    })();
  });
}

process.once('SIGTERM', () => {
  encerrar('SIGTERM');
});
process.once('SIGINT', () => {
  encerrar('SIGINT');
});
process.once('unhandledRejection', (erro) => {
  logger.fatal({ erro }, 'Rejeição de Promise não tratada');
  encerrar('unhandledRejection', erro);
});
process.once('uncaughtException', (erro) => {
  logger.fatal({ erro }, 'Exceção não capturada');
  encerrar('uncaughtException', erro);
});
