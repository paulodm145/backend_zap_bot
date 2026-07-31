import type { Request, Response } from 'express';

import type { AtualizarEmpresaEntrada } from '../dtos/empresa.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import { EmpresaRepository } from '../repositories/empresa.repository.js';
import type { BrasilApiService } from '../services/brasil-api.service.js';

export class EmpresaController {
  public constructor(private readonly brasilApi: BrasilApiService) {}

  public buscar = async (requisicao: Request, resposta: Response): Promise<void> => {
    resposta.status(200).json(await this.repository(requisicao).buscar());
  };

  public atualizar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const empresa = await this.repository(requisicao).salvar(
      requisicao.body as AtualizarEmpresaEntrada,
    );
    resposta.status(200).json(empresa);
  };

  public consultarCep = async (requisicao: Request, resposta: Response): Promise<void> => {
    const cep = requisicao.params.cep;
    if (typeof cep !== 'string') throw new ValidacaoError('CEP inválido');
    const endereco = await this.brasilApi.consultarCep(cep);
    resposta.status(200).json({
      cep: endereco.cep.replace(/\D/g, ''),
      uf: endereco.state,
      municipio: endereco.city,
      bairro: endereco.neighborhood,
      logradouro: endereco.street,
      ...(endereco.city_ibge === undefined ? {} : { municipioCodigoIbge: endereco.city_ibge }),
    });
  };

  private repository(requisicao: Request): EmpresaRepository {
    return new EmpresaRepository(this.prisma(requisicao));
  }

  private prisma(requisicao: Request): PrismaClient {
    if (!requisicao.contextoTenant) throw new NaoEncontradoError('Contexto do tenant ausente');
    return requisicao.contextoTenant.prisma;
  }
}
