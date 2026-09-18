import { Router } from 'express';
import type { ContatoController } from '../controllers/contato.controller.js';
import {
  atualizarContatoSchema,
  contatoParametroSchema,
  criarContatoSchema,
  iniciarConversaContatoSchema,
  listarContatosSchema,
} from '../dtos/contato.dto.js';
import { exigirGestaoTenant } from '../middlewares/autorizacao-tenant.middleware.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasContatos(controller: ContatoController): Router {
  const rotas = Router();
  rotas.get('/', validar(listarContatosSchema, 'query'), tratarAsync(controller.listar));
  rotas.post(
    '/',
    exigirGestaoTenant,
    validar(criarContatoSchema, 'body'),
    tratarAsync(controller.criar),
  );
  rotas.get(
    '/:contatoId',
    validar(contatoParametroSchema, 'params'),
    tratarAsync(controller.buscar),
  );
  rotas.put(
    '/:contatoId',
    exigirGestaoTenant,
    validar(contatoParametroSchema, 'params'),
    validar(atualizarContatoSchema, 'body'),
    tratarAsync(controller.atualizar),
  );
  rotas.delete(
    '/:contatoId',
    exigirGestaoTenant,
    validar(contatoParametroSchema, 'params'),
    tratarAsync(controller.excluir),
  );
  rotas.post(
    '/:contatoId/conversas',
    validar(contatoParametroSchema, 'params'),
    validar(iniciarConversaContatoSchema, 'body'),
    tratarAsync(controller.iniciarConversa),
  );
  return rotas;
}
