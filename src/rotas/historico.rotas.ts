import { Router } from 'express';
import type { HistoricoController } from '../controllers/historico.controller.js';
import type { DirecionamentoAtendimentoController } from '../controllers/direcionamento-atendimento.controller.js';
import type { MensagemAtendimentoController } from '../controllers/mensagem-atendimento.controller.js';
import { enviarMensagemAtendimentoSchema } from '../dtos/mensagem-atendimento.dto.js';
import {
  encerrarConversaSchema,
  reatribuirConversaSchema,
} from '../dtos/direcionamento-atendimento.dto.js';
import {
  conversaParametroSchema,
  listarContatosSchema,
  listarConversasSchema,
  listarMensagensSchema,
} from '../dtos/historico.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { exigirGestaoTenant } from '../middlewares/autorizacao-tenant.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasContatos(controller: HistoricoController): Router {
  const rotas = Router();
  rotas.get('/', validar(listarContatosSchema, 'query'), tratarAsync(controller.listarContatos));
  return rotas;
}
export function criarRotasConversas(
  controller: HistoricoController,
  direcionamento?: DirecionamentoAtendimentoController,
  mensagens?: MensagemAtendimentoController,
): Router {
  const rotas = Router();
  rotas.get('/', validar(listarConversasSchema, 'query'), tratarAsync(controller.listarConversas));
  rotas.get(
    '/:conversaId/mensagens',
    validar(conversaParametroSchema, 'params'),
    validar(listarMensagensSchema, 'query'),
    tratarAsync(controller.listarMensagens),
  );
  if (direcionamento) {
    rotas.post(
      '/:conversaId/assumir',
      validar(conversaParametroSchema, 'params'),
      tratarAsync(direcionamento.assumir),
    );
    rotas.post(
      '/:conversaId/reatribuir',
      exigirGestaoTenant,
      validar(conversaParametroSchema, 'params'),
      validar(reatribuirConversaSchema, 'body'),
      tratarAsync(direcionamento.reatribuir),
    );
    rotas.post(
      '/:conversaId/encerrar',
      validar(conversaParametroSchema, 'params'),
      validar(encerrarConversaSchema, 'body'),
      tratarAsync(direcionamento.encerrar),
    );
  }
  if (mensagens) {
    rotas.post(
      '/:conversaId/mensagens',
      validar(conversaParametroSchema, 'params'),
      validar(enviarMensagemAtendimentoSchema, 'body'),
      tratarAsync(mensagens.enviar),
    );
  }
  rotas.get(
    '/:conversaId',
    validar(conversaParametroSchema, 'params'),
    tratarAsync(controller.buscarConversa),
  );
  return rotas;
}
