process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_INTERNO_SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';
process.env.JWT_INTERNO_EXPIRACAO_SEGUNDOS = '900';
process.env.TOTP_CRIPTOGRAFIA_CHAVE =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.TOTP_INTERNO_OBRIGATORIO = 'true';
process.env.ORIGENS_PERMITIDAS = 'http://localhost:3001';
process.env.CENTRAL_DATABASE_URL =
  'postgresql://zapbot:senha-de-teste@localhost:5432/zapbot_central_test';
process.env.JWT_TENANT_SECRET = 'segredo-tenant-de-teste-com-mais-de-trinta-e-dois';
process.env.JWT_TENANT_EXPIRACAO_SEGUNDOS = '900';
process.env.REFRESH_TOKEN_EXPIRACAO_DIAS = '30';
process.env.TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE =
  'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
process.env.TENANT_CLIENTES_CACHE_MAXIMO = '20';
process.env.POSTGRES_ADMIN_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
process.env.HTTP_REQUEST_TIMEOUT_MS = '30000';
process.env.HTTP_HEADERS_TIMEOUT_MS = '31000';
process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS = '5000';
process.env.HTTP_SHUTDOWN_TIMEOUT_MS = '10000';
process.env.SWAGGER_USUARIO = 'admin-docs';
process.env.SWAGGER_SENHA = 'senha-forte-de-teste';
