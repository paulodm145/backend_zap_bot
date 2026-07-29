import { timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';

import { ambiente } from '../config/ambiente.js';

interface ConfiguracaoDocumentacao {
  ambiente: 'development' | 'test' | 'production';
  usuario?: string;
  senha?: string;
}

function compararSeguro(valorRecebido: string, valorEsperado: string): boolean {
  const recebido = Buffer.from(valorRecebido);
  const esperado = Buffer.from(valorEsperado);

  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export function criarProtecaoDocumentacao(configuracao: ConfiguracaoDocumentacao): RequestHandler {
  return (requisicao, resposta, proximo) => {
    if (configuracao.ambiente !== 'production') {
      proximo();
      return;
    }

    const authorization = requisicao.headers.authorization;

    if (!authorization?.startsWith('Basic ')) {
      resposta.setHeader('WWW-Authenticate', 'Basic realm="ZapBot API Docs"');
      resposta.status(401).json({
        erro: {
          codigo: 'NAO_AUTENTICADO',
          mensagem: 'Autenticação necessária',
        },
      });
      return;
    }

    const credenciais = Buffer.from(authorization.slice('Basic '.length), 'base64').toString(
      'utf8',
    );
    const separador = credenciais.indexOf(':');
    const usuario = separador >= 0 ? credenciais.slice(0, separador) : '';
    const senha = separador >= 0 ? credenciais.slice(separador + 1) : '';

    if (
      !compararSeguro(usuario, configuracao.usuario ?? '') ||
      !compararSeguro(senha, configuracao.senha ?? '')
    ) {
      resposta.setHeader('WWW-Authenticate', 'Basic realm="ZapBot API Docs"');
      resposta.status(401).json({
        erro: {
          codigo: 'NAO_AUTENTICADO',
          mensagem: 'Credenciais da documentação inválidas',
        },
      });
      return;
    }

    proximo();
  };
}

export const protegerDocumentacao = criarProtecaoDocumentacao({
  ambiente: ambiente.NODE_ENV,
  ...(ambiente.SWAGGER_USUARIO === undefined ? {} : { usuario: ambiente.SWAGGER_USUARIO }),
  ...(ambiente.SWAGGER_SENHA === undefined ? {} : { senha: ambiente.SWAGGER_SENHA }),
});
