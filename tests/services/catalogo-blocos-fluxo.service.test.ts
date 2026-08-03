import { describe, expect, it } from 'vitest';

import { noFluxoSchema, TIPOS_NO_FLUXO } from '../../src/dtos/fluxo.dto.js';
import { CatalogoBlocosFluxoService } from '../../src/services/catalogo-blocos-fluxo.service.js';

describe('CatalogoBlocosFluxoService', () => {
  const catalogo = new CatalogoBlocosFluxoService().consultar();

  it('expõe uma configuração para cada tipo executado pelo motor', () => {
    expect(catalogo.blocos.map((bloco) => bloco.tipo)).toEqual(TIPOS_NO_FLUXO);
    expect(catalogo.schemaVersao).toBe(1);
  });

  it('mantém todos os exemplos compatíveis com o schema persistido', () => {
    for (const bloco of catalogo.blocos) {
      expect(noFluxoSchema.parse(bloco.exemplo).tipo).toBe(bloco.tipo);
    }
  });

  it('informa ao frontend como carregar somente setores ativos', () => {
    const bloco = catalogo.blocos.find((item) => item.tipo === 'direcionar_setor');
    const fonte = bloco?.campos[0]?.fonteOpcoes;

    expect(fonte).toMatchObject({
      tipo: 'endpoint',
      caminho: '/api/v1/setores',
      query: { ativo: 'true' },
    });
  });
});
