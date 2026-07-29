import { desconectarPrismaCentral, obterPrismaCentral } from '../src/database/prisma-central.js';
import { RefreshTokenRepository } from '../src/repositories/refresh-token.repository.js';

try {
  const removidos = await new RefreshTokenRepository(obterPrismaCentral()).limparExpirados();
  process.stdout.write(`${String(removidos)} refresh token(s) expirado(s) removido(s).\n`);
} finally {
  await desconectarPrismaCentral();
}
