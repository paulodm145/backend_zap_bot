import type { ErrorRequestHandler } from 'express';
import { z, ZodError } from 'zod';

import { logger } from '../config/logger.js';
import { ErroAplicacao } from '../erros/erro-aplicacao.js';

export const tratarErro: ErrorRequestHandler = (erro, requisicao, resposta, _proximo) => {
  void _proximo;

  if (erro instanceof ErroAplicacao) {
    resposta.status(erro.statusCode).json({
      erro: {
        codigo: erro.codigo,
        mensagem: erro.message,
        ...(erro.detalhes === undefined ? {} : { detalhes: erro.detalhes }),
      },
    });
    return;
  }

  if (erro instanceof ZodError) {
    resposta.status(422).json({
      erro: {
        codigo: 'VALIDACAO',
        mensagem: 'Dados da requisição inválidos',
        detalhes: z.treeifyError(erro),
      },
    });
    return;
  }

  logger.error(
    {
      erro,
      correlationId: requisicao.correlationId,
      metodo: requisicao.method,
      rota: requisicao.originalUrl,
    },
    'Erro não tratado',
  );

  resposta.status(500).json({
    erro: {
      codigo: 'ERRO_INTERNO',
      mensagem: 'Ocorreu um erro interno',
    },
  });
};
