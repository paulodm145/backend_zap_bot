import { PrismaPg } from '@prisma/adapter-pg';

import { ambiente } from '../config/ambiente.js';
import { PrismaClient } from '../generated/prisma/client.js';

let prismaCentral: PrismaClient | undefined;

export function obterPrismaCentral(): PrismaClient {
  prismaCentral ??= new PrismaClient({
    adapter: new PrismaPg(ambiente.CENTRAL_DATABASE_URL),
  });

  return prismaCentral;
}

export async function desconectarPrismaCentral(): Promise<void> {
  if (!prismaCentral) {
    return;
  }

  await prismaCentral.$disconnect();
  prismaCentral = undefined;
}
