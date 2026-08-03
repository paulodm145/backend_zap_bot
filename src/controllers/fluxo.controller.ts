import type { Request, Response } from 'express';

import {
  definicaoFluxoSchema,
  type AtualizarFluxoEntrada,
  type CriarFluxoEntrada,
  type ListarFluxosEntrada,
  type SimularFluxoEntrada,
} from '../dtos/fluxo.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import { FluxoRepository } from '../repositories/fluxo.repository.js';
import { SetorRepository } from '../repositories/setor.repository.js';
import { MotorFluxoService } from '../services/motor-fluxo.service.js';
import { CatalogoBlocosFluxoService } from '../services/catalogo-blocos-fluxo.service.js';
import { PublicacaoFluxoService } from '../services/publicacao-fluxo.service.js';
import { ValidacaoGrafoFluxoService } from '../services/validacao-grafo-fluxo.service.js';

export class FluxoController {
  public catalogoBlocos = (_requisicao: Request, resposta: Response): void => {
    resposta.status(200).json(new CatalogoBlocosFluxoService().consultar());
  };

  public listar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const repository = this.repository(requisicao);
    resposta
      .status(200)
      .json(await repository.listar(requisicao.query as unknown as ListarFluxosEntrada));
  };

  public detalhar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const fluxo = await this.repository(requisicao).buscarPorPublicId(this.fluxoId(requisicao));
    if (!fluxo) throw new NaoEncontradoError('Fluxo não encontrado');
    resposta.status(200).json(fluxo);
  };

  public criar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const fluxo = await this.repository(requisicao).criar(requisicao.body as CriarFluxoEntrada);
    resposta.status(201).json(fluxo);
  };

  public atualizar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const repository = this.repository(requisicao);
    const publicId = this.fluxoId(requisicao);
    const resultado = await repository.atualizarRascunho(
      publicId,
      requisicao.body as AtualizarFluxoEntrada,
    );
    if (resultado.count === 0) throw new NaoEncontradoError('Fluxo não encontrado');
    resposta.status(200).json(await repository.buscarPorPublicId(publicId));
  };

  public publicar = async (requisicao: Request, resposta: Response): Promise<void> => {
    const prisma = this.prisma(requisicao);
    const repository = new FluxoRepository(prisma);
    const versao = await new PublicacaoFluxoService(
      repository,
      new ValidacaoGrafoFluxoService(new SetorRepository(prisma)),
    ).publicar(this.fluxoId(requisicao));
    resposta.status(201).json(versao);
  };

  public simular = async (requisicao: Request, resposta: Response): Promise<void> => {
    const repository = this.repository(requisicao);
    const entrada = requisicao.body as SimularFluxoEntrada;
    const versao = entrada.estado
      ? await repository.buscarVersaoPorPublicId(entrada.estado.fluxoVersaoId)
      : (await repository.buscarVersaoPublicada(this.fluxoId(requisicao)))?.versoes[0];
    if (!versao) throw new NaoEncontradoError('Versão publicada do fluxo não encontrada');

    const resultado = new MotorFluxoService().executar({
      definicao: definicaoFluxoSchema.parse(versao.definicao),
      fluxoVersaoId: versao.public_id,
      ...(entrada.estado ? { estado: entrada.estado } : {}),
      ...(entrada.mensagem === undefined ? {} : { mensagem: entrada.mensagem }),
      maxPassos: entrada.maxPassos,
    });
    resposta.status(200).json(resultado);
  };

  public excluir = async (requisicao: Request, resposta: Response): Promise<void> => {
    const resultado = await this.repository(requisicao).excluir(this.fluxoId(requisicao));
    if (resultado.count === 0) throw new NaoEncontradoError('Fluxo não encontrado');
    resposta.status(204).send();
  };

  private repository(requisicao: Request): FluxoRepository {
    return new FluxoRepository(this.prisma(requisicao));
  }

  private prisma(requisicao: Request): PrismaClient {
    if (!requisicao.contextoTenant) throw new NaoEncontradoError('Contexto do tenant ausente');
    return requisicao.contextoTenant.prisma;
  }

  private fluxoId(requisicao: Request): string {
    const fluxoId = requisicao.params.fluxoId;
    if (typeof fluxoId !== 'string') throw new ValidacaoError('Identificador do fluxo inválido');
    return fluxoId;
  }
}
