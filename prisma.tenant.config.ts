import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/tenant/schema.prisma',
  migrations: {
    path: 'prisma/tenant/migrations',
  },
  datasource: {
    url:
      process.env.TENANT_DATABASE_URL ??
      'postgresql://configuracao:ausente@localhost:5432/configuracao_ausente',
  },
});
