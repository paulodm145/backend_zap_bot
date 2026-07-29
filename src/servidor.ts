import { criarAplicacao } from './app.js';
import { ambiente } from './config/ambiente.js';
import { logger } from './config/logger.js';

const aplicacao = criarAplicacao();

const servidor = aplicacao.listen(ambiente.PORTA, () => {
  logger.info({ porta: ambiente.PORTA }, 'API iniciada');
});

function encerrar(sinal: NodeJS.Signals): void {
  logger.info({ sinal }, 'Encerrando API');
  servidor.close((erro) => {
    if (erro) {
      logger.error({ erro }, 'Falha ao encerrar API');
      process.exitCode = 1;
      return;
    }

    process.exitCode = 0;
  });
}

process.once('SIGTERM', encerrar);
process.once('SIGINT', encerrar);
