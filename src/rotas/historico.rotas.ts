import { Router } from 'express';
import type { HistoricoController } from '../controllers/historico.controller.js';
import {
  conversaParametroSchema,
  listarContatosSchema,
  listarConversasSchema,
  listarMensagensSchema,
} from '../dtos/historico.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasContatos(controller: HistoricoController): Router {
  const rotas = Router();
  rotas.get('/', validar(listarContatosSchema, 'query'), tratarAsync(controller.listarContatos));
  return rotas;
}
export function criarRotasConversas(controller: HistoricoController): Router {
  const rotas = Router();
  rotas.get('/', validar(listarConversasSchema, 'query'), tratarAsync(controller.listarConversas));
  rotas.get(
    '/:conversaId/mensagens',
    validar(conversaParametroSchema, 'params'),
    validar(listarMensagensSchema, 'query'),
    tratarAsync(controller.listarMensagens),
  );
  rotas.get(
    '/:conversaId',
    validar(conversaParametroSchema, 'params'),
    tratarAsync(controller.buscarConversa),
  );
  return rotas;
}
