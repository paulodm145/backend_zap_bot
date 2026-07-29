import pino from 'pino';

import { ambiente } from './ambiente.js';

export const logger = pino({
  level: ambiente.NODE_ENV === 'test' ? 'silent' : ambiente.LOG_LEVEL,
  base: {
    servico: 'backend-zap-bot',
    ambiente: ambiente.NODE_ENV,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'senha',
      '*.senha',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[REMOVIDO]',
  },
});
