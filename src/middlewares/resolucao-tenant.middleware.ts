import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AcessoNegadoError } from '../erros/erro-aplicacao.js';
import type { GerenciadorConexoesTenant } from '../database/gerenciador-conexoes-tenant.js';
import type { CriptografiaService } from '../services/criptografia.service.js';

interface LeitorTenantCentral {
  buscarAtivoDoUsuario(
    email: string,
    tenantPublicId: string,
  ): Promise<{
    id: number;
    public_id: string;
    string_conexao_encrypted: string | null;
  } | null>;
}

export function criarResolucaoTenantMiddleware(
  tenants: LeitorTenantCentral,
  criptografia: CriptografiaService,
  conexoes: GerenciadorConexoesTenant,
): RequestHandler {
  return async (requisicao: Request, _resposta: Response, proximo: NextFunction): Promise<void> => {
    try {
      const identidade = requisicao.usuarioTenant;
      if (!identidade) throw new AcessoNegadoError();

      const tenant = await tenants.buscarAtivoDoUsuario(identidade.email, identidade.tenantId);
      if (!tenant?.string_conexao_encrypted) {
        throw new AcessoNegadoError('Tenant inativo ou sem banco provisionado');
      }

      requisicao.contextoTenant = {
        id: tenant.id,
        publicId: tenant.public_id,
        prisma: await conexoes.obter(
          tenant.id,
          criptografia.descriptografar(tenant.string_conexao_encrypted),
        ),
      };
      proximo();
    } catch (erro) {
      proximo(erro);
    }
  };
}
