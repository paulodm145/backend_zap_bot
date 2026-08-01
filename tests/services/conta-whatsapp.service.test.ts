import { describe, expect, it, vi } from 'vitest';

import type { ContaWhatsappRepository } from '../../src/repositories/conta-whatsapp.repository.js';
import type { RoteamentoWhatsappRepository } from '../../src/repositories/roteamento-whatsapp.repository.js';
import { ContaWhatsappService } from '../../src/services/conta-whatsapp.service.js';
import { CriptografiaService } from '../../src/services/criptografia.service.js';
import type { WhatsappGraphApiService } from '../../src/services/whatsapp-graph-api.service.js';

const conta = {
  id: 1,
  public_id: '40ca22c9-5435-4bb7-81a2-27ee3dfb6277',
  nome: 'Principal',
  phone_number_id: '123456',
  waba_id: '654321',
  numero_exibicao: null,
  versao_graph_api: 'v23.0',
  token_encrypted: 'payload-criptografado',
  status: 'PENDENTE' as const,
  ultima_validacao_at: null,
  ultimo_erro_codigo: null,
  ultimo_erro_mensagem: null,
  ativo: true,
  deletado_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function dependencias() {
  const contas = {
    contarAtivas: vi.fn().mockResolvedValue(0),
    criar: vi.fn().mockResolvedValue(conta),
    excluirCriacaoCompensatoria: vi.fn().mockResolvedValue(conta),
  };
  const roteamentos = {
    obterLimiteDoTenant: vi.fn().mockResolvedValue(1),
    buscar: vi.fn().mockResolvedValue(null),
    sincronizar: vi.fn().mockResolvedValue({}),
  };
  const criptografia = new CriptografiaService(
    '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  );
  const graphApi = {};
  const service = new ContaWhatsappService(
    contas as unknown as ContaWhatsappRepository,
    roteamentos as unknown as RoteamentoWhatsappRepository,
    criptografia,
    graphApi as WhatsappGraphApiService,
  );
  return { service, contas, roteamentos };
}

describe('ContaWhatsappService', () => {
  const entrada = {
    nome: 'Principal',
    phoneNumberId: '123456',
    wabaId: '654321',
    versaoGraphApi: 'v23.0',
    accessToken: 'token-com-tamanho-suficiente',
  };
  const contexto = { tenantId: 10, autorUsuarioId: '40ca22c9-5435-4bb7-81a2-27ee3dfb6277' };

  it('criptografa, sincroniza e nunca devolve o token', async () => {
    const { service, contas, roteamentos } = dependencias();
    const resultado = await service.criar(entrada, contexto);
    const argumentoCriacao = contas.criar.mock.calls[0]?.[0] as unknown as {
      tokenEncrypted: string;
    };
    expect(argumentoCriacao.tokenEncrypted).not.toContain(entrada.accessToken);
    expect(roteamentos.sincronizar).toHaveBeenCalledWith(10, '123456');
    expect(resultado).not.toHaveProperty('token_encrypted');
  });

  it('impede cadastro acima do limite do plano', async () => {
    const { service, contas } = dependencias();
    contas.contarAtivas.mockResolvedValue(1);
    await expect(service.criar(entrada, contexto)).rejects.toMatchObject({ codigo: 'VALIDACAO' });
  });

  it('impede phone_number_id pertencente a outro tenant', async () => {
    const { service, roteamentos } = dependencias();
    roteamentos.buscar.mockResolvedValue({ tenant_id: 99 });
    await expect(service.criar(entrada, contexto)).rejects.toMatchObject({ codigo: 'CONFLITO' });
  });

  it('compensa a criação tenant se o índice central falhar', async () => {
    const { service, contas, roteamentos } = dependencias();
    roteamentos.sincronizar.mockRejectedValue(new Error('central indisponível'));
    await expect(service.criar(entrada, contexto)).rejects.toThrow('central indisponível');
    expect(contas.excluirCriacaoCompensatoria).toHaveBeenCalledWith(1);
  });
});
