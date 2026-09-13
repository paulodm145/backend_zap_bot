import { describe, expect, it, vi } from 'vitest';

import type { ContaWhatsappRepository } from '../../src/repositories/conta-whatsapp.repository.js';
import type { RoteamentoWhatsappRepository } from '../../src/repositories/roteamento-whatsapp.repository.js';
import { ContaWhatsappService } from '../../src/services/conta-whatsapp.service.js';
import { CriptografiaService } from '../../src/services/criptografia.service.js';
import type { EvolutionApiService } from '../../src/services/evolution-api.service.js';

const conta = {
  id: 1,
  public_id: '40ca22c9-5435-4bb7-81a2-27ee3dfb6277',
  nome: 'Principal',
  instance_name: 'tenant-10-gerado',
  instance_id: 'evo-instance-1',
  numero_exibicao: null,
  api_key_encrypted: 'payload-criptografado',
  status: 'CONECTANDO' as const,
  ultima_sincronizacao_at: null,
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
  const evolution = {
    criarInstancia: vi.fn().mockResolvedValue({
      instanceId: 'evo-instance-1',
      apiKey: 'apikey-bruta-da-evolution',
      qrCodeBase64: 'data:image/png;base64,QRCODE',
    }),
    excluirInstancia: vi.fn().mockResolvedValue(undefined),
    desconectar: vi.fn().mockResolvedValue(undefined),
  };
  const service = new ContaWhatsappService(
    contas as unknown as ContaWhatsappRepository,
    roteamentos as unknown as RoteamentoWhatsappRepository,
    criptografia,
    evolution as unknown as EvolutionApiService,
  );
  return { service, contas, roteamentos, evolution };
}

describe('ContaWhatsappService', () => {
  const entrada = { nome: 'Principal' };
  const contexto = { tenantId: 10, autorUsuarioId: '40ca22c9-5435-4bb7-81a2-27ee3dfb6277' };

  it('cria a instância na Evolution API, criptografa a apikey e nunca a devolve', async () => {
    const { service, contas, roteamentos, evolution } = dependencias();
    const resultado = await service.criar(entrada, contexto);
    const argumentoCriacao = contas.criar.mock.calls[0]?.[0] as unknown as {
      instanceName: string;
      apiKeyEncrypted: string;
    };
    expect(evolution.criarInstancia).toHaveBeenCalledWith(argumentoCriacao.instanceName);
    expect(argumentoCriacao.apiKeyEncrypted).not.toContain('apikey-bruta-da-evolution');
    expect(roteamentos.sincronizar).toHaveBeenCalledWith(10, argumentoCriacao.instanceName);
    expect(resultado.conta).not.toHaveProperty('api_key_encrypted');
    expect(resultado.qrCodeBase64).toBe('data:image/png;base64,QRCODE');
  });

  it('impede cadastro acima do limite do plano', async () => {
    const { service, contas } = dependencias();
    contas.contarAtivas.mockResolvedValue(1);
    await expect(service.criar(entrada, contexto)).rejects.toMatchObject({ codigo: 'VALIDACAO' });
  });

  it('impede instância pertencente a outro tenant', async () => {
    const { service, roteamentos } = dependencias();
    roteamentos.buscar.mockResolvedValue({ tenant_id: 99 });
    await expect(service.criar(entrada, contexto)).rejects.toMatchObject({ codigo: 'CONFLITO' });
  });

  it('compensa a criação tenant e remove a instância se o índice central falhar', async () => {
    const { service, contas, roteamentos, evolution } = dependencias();
    roteamentos.sincronizar.mockRejectedValue(new Error('central indisponível'));
    await expect(service.criar(entrada, contexto)).rejects.toThrow('central indisponível');
    const instanceName = evolution.criarInstancia.mock.calls[0]?.[0] as string;
    expect(contas.excluirCriacaoCompensatoria).toHaveBeenCalledWith(1);
    expect(evolution.excluirInstancia).toHaveBeenCalledWith(
      instanceName,
      'apikey-bruta-da-evolution',
    );
  });
});
