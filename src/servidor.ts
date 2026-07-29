import { criarAplicacao } from './app.js';
import { ambiente } from './config/ambiente.js';
import { logger } from './config/logger.js';
import { desconectarPrismaCentral, obterPrismaCentral } from './database/prisma-central.js';
import { VerificadorBancoCentralService } from './services/verificador-banco-central.service.js';

const aplicacao = criarAplicacao({
  verificadoresProntidao: [new VerificadorBancoCentralService(obterPrismaCentral())],
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
