import type { PrismaClient } from '../generated/prisma/client.js';
import { normalizarTextoBusca } from '../helpers/texto.helper.js';
import type { EstadoBrasilApi, MunicipioBrasilApi } from '../dtos/brasil-api.dto.js';

export interface ResumoImportacaoGeografica {
  estadosCriados: number;
  estadosAtualizados: number;
  estadosInalterados: number;
  municipiosCriados: number;
  municipiosAtualizados: number;
  municipiosInalterados: number;
  municipiosDesativados: number;
}

export class CatalogoGeograficoRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async importarEstado(
    estado: EstadoBrasilApi,
    municipios: MunicipioBrasilApi[],
  ): Promise<ResumoImportacaoGeografica> {
    return this.prisma.$transaction(async (transacao) => {
      const estadoExistente = await transacao.estado.findUnique({
        where: { codigo_ibge: estado.id },
      });
      const municipiosExistentes = await transacao.municipio.findMany({
        where: { codigo_ibge: { in: municipios.map((municipio) => municipio.codigo_ibge) } },
      });
      const municipiosPorCodigo = new Map(
        municipiosExistentes.map((municipio) => [municipio.codigo_ibge, municipio]),
      );
      const estadoAlterado = Boolean(
        estadoExistente &&
        (estadoExistente.sigla !== estado.sigla ||
          estadoExistente.nome !== estado.nome ||
          estadoExistente.nome_normalizado !== normalizarTextoBusca(estado.nome) ||
          estadoExistente.regiao !== estado.regiao.nome ||
          !estadoExistente.ativo),
      );
      const registroEstado = await transacao.estado.upsert({
        where: { codigo_ibge: estado.id },
        create: {
          codigo_ibge: estado.id,
          sigla: estado.sigla,
          nome: estado.nome,
          nome_normalizado: normalizarTextoBusca(estado.nome),
          regiao: estado.regiao.nome,
        },
        update: {
          sigla: estado.sigla,
          nome: estado.nome,
          nome_normalizado: normalizarTextoBusca(estado.nome),
          regiao: estado.regiao.nome,
          ativo: true,
        },
      });

      let municipiosCriados = 0;
      let municipiosAtualizados = 0;
      let municipiosInalterados = 0;
      for (const municipio of municipios) {
        const existente = municipiosPorCodigo.get(municipio.codigo_ibge);
        const nomeNormalizado = normalizarTextoBusca(municipio.nome);
        if (!existente) municipiosCriados += 1;
        else if (
          existente.estado_id !== registroEstado.id ||
          existente.nome !== municipio.nome ||
          existente.nome_normalizado !== nomeNormalizado ||
          !existente.ativo
        )
          municipiosAtualizados += 1;
        else municipiosInalterados += 1;
        await transacao.municipio.upsert({
          where: { codigo_ibge: municipio.codigo_ibge },
          create: {
            codigo_ibge: municipio.codigo_ibge,
            estado_id: registroEstado.id,
            nome: municipio.nome,
            nome_normalizado: nomeNormalizado,
          },
          update: {
            estado_id: registroEstado.id,
            nome: municipio.nome,
            nome_normalizado: nomeNormalizado,
            ativo: true,
          },
        });
      }

      const codigos = municipios.map((municipio) => municipio.codigo_ibge);
      const desativados = await transacao.municipio.updateMany({
        where: {
          estado_id: registroEstado.id,
          ativo: true,
          codigo_ibge: { notIn: codigos },
        },
        data: { ativo: false },
      });

      return {
        estadosCriados: estadoExistente ? 0 : 1,
        estadosAtualizados: estadoAlterado ? 1 : 0,
        estadosInalterados: estadoExistente !== null && !estadoAlterado ? 1 : 0,
        municipiosCriados,
        municipiosAtualizados,
        municipiosInalterados,
        municipiosDesativados: desativados.count,
      };
    });
  }
}
