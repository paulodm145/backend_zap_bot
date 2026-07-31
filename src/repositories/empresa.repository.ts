import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import type { AtualizarEmpresaEntrada } from '../dtos/empresa.dto.js';

const CHAVE_EMPRESA = 'PADRAO';

export class EmpresaRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public buscar() {
    return this.prisma.empresa.findUnique({ where: { chave: CHAVE_EMPRESA } });
  }

  public salvar(entrada: AtualizarEmpresaEntrada) {
    const dados = this.mapear(entrada);
    return this.prisma.empresa.upsert({
      where: { chave: CHAVE_EMPRESA },
      create: { chave: CHAVE_EMPRESA, ...dados },
      update: dados,
    });
  }

  private mapear(entrada: AtualizarEmpresaEntrada) {
    return {
      ...(entrada.razaoSocial === undefined ? {} : { razao_social: entrada.razaoSocial }),
      ...(entrada.nomeFantasia === undefined ? {} : { nome_fantasia: entrada.nomeFantasia }),
      ...(entrada.cnpj === undefined ? {} : { cnpj: entrada.cnpj }),
      ...(entrada.email === undefined ? {} : { email: entrada.email }),
      ...(entrada.telefone === undefined ? {} : { telefone: entrada.telefone }),
      ...(entrada.site === undefined ? {} : { site: entrada.site }),
      ...(entrada.cep === undefined ? {} : { cep: entrada.cep }),
      ...(entrada.logradouro === undefined ? {} : { logradouro: entrada.logradouro }),
      ...(entrada.numero === undefined ? {} : { numero: entrada.numero }),
      ...(entrada.complemento === undefined ? {} : { complemento: entrada.complemento }),
      ...(entrada.bairro === undefined ? {} : { bairro: entrada.bairro }),
      ...(entrada.municipioCodigoIbge === undefined
        ? {}
        : { municipio_codigo_ibge: entrada.municipioCodigoIbge }),
      ...(entrada.municipioNome === undefined ? {} : { municipio_nome: entrada.municipioNome }),
      ...(entrada.uf === undefined ? {} : { uf: entrada.uf }),
    };
  }
}
