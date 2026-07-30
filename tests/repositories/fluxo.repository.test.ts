import '../configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { definicaoFluxoSchema } from '../../src/dtos/fluxo.dto.js';
import { PrismaClient } from '../../src/generated/prisma-tenant/client.js';
import { FluxoRepository } from '../../src/repositories/fluxo.repository.js';
import { SetorRepository } from '../../src/repositories/setor.repository.js';
import { PublicacaoFluxoService } from '../../src/services/publicacao-fluxo.service.js';
import { ValidacaoGrafoFluxoService } from '../../src/services/validacao-grafo-fluxo.service.js';

const urlTeste = process.env.TEST_TENANT_DATABASE_URL_A;
const descreverIntegracao = urlTeste ? describe : describe.skip;
const prisma = new PrismaClient({
  adapter: new PrismaPg(urlTeste ?? 'postgresql://configuracao:ausente'),
});
const definicaoInicial = definicaoFluxoSchema.parse({
  schemaVersao: 1,
  noInicial: 'inicio',
  nos: [{ id: 'inicio', tipo: 'mensagem', dados: { texto: 'Versão 1' } }],
});

descreverIntegracao('repository e publicação de fluxos', () => {
  beforeEach(async () => {
    await prisma.fluxoVersao.deleteMany();
    await prisma.fluxo.deleteMany();
  });

  afterAll(async () => prisma.$disconnect());

  it('mantém rascunho editável e versões publicadas imutáveis', async () => {
    const repository = new FluxoRepository(prisma);
    const publicacao = new PublicacaoFluxoService(
      repository,
      new ValidacaoGrafoFluxoService(new SetorRepository(prisma)),
    );
    const fluxo = await repository.criar({
      nome: 'Atendimento inicial',
      definicao: definicaoInicial,
    });
    const primeira = await publicacao.publicar(fluxo.public_id);
    const definicaoDois = definicaoFluxoSchema.parse({
      ...definicaoInicial,
      nos: [{ id: 'inicio', tipo: 'mensagem', dados: { texto: 'Versão 2' } }],
    });
    await repository.atualizarRascunho(fluxo.public_id, {
      nome: 'Atendimento atualizado',
      definicao: definicaoDois,
    });

    const primeiraAposEdicao = await prisma.fluxoVersao.findUniqueOrThrow({
      where: { id: primeira.id },
    });
    expect(primeiraAposEdicao.definicao).toEqual(definicaoInicial);

    const segunda = await publicacao.publicar(fluxo.public_id);
    expect(segunda.versao).toBe(2);
    expect(await prisma.fluxoVersao.count({ where: { fluxo_id: fluxo.id } })).toBe(2);
  });

  it('não publica uma versão quando o grafo é semanticamente inválido', async () => {
    const repository = new FluxoRepository(prisma);
    const publicacao = new PublicacaoFluxoService(
      repository,
      new ValidacaoGrafoFluxoService(new SetorRepository(prisma)),
    );
    const fluxo = await repository.criar({
      nome: 'Fluxo inválido',
      definicao: definicaoFluxoSchema.parse({
        schemaVersao: 1,
        noInicial: 'inicio',
        nos: [
          {
            id: 'inicio',
            tipo: 'mensagem',
            dados: { texto: 'Olá' },
            proximo: 'inexistente',
          },
        ],
      }),
    });

    await expect(publicacao.publicar(fluxo.public_id)).rejects.toMatchObject({
      codigo: 'VALIDACAO',
      statusCode: 422,
    });
    expect(await prisma.fluxoVersao.count({ where: { fluxo_id: fluxo.id } })).toBe(0);
  });

  it('lista com busca, estado, paginação e ignora soft delete', async () => {
    const repository = new FluxoRepository(prisma);
    const fluxo = await repository.criar({
      nome: 'Fluxo Financeiro',
      definicao: definicaoInicial,
    });
    await repository.criar({ nome: 'Fluxo Comercial', definicao: definicaoInicial });
    await repository.excluir(fluxo.public_id);

    const pagina = await repository.listar({
      busca: 'comercial',
      estado: 'RASCUNHO',
      skip: 0,
      take: 10,
    });

    expect(pagina).toMatchObject({ total: 1, skip: 0, take: 10 });
    expect(pagina.dados[0]?.nome).toBe('Fluxo Comercial');
  });

  it('possui índices de listagem e versionamento', async () => {
    const indices = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    `;
    const nomes = indices.map((indice) => indice.indexname);
    expect(nomes).toContain('fluxos_nome_trgm_idx');
    expect(nomes).toContain('fluxos_deletado_at_updated_at_idx');
    expect(nomes).toContain('fluxo_versoes_fluxo_id_versao_key');
  });
});
