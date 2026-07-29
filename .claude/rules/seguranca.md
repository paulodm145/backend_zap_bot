# Segurança

- Nunca escreva segredos em código, fixtures, documentação ou logs.
- Valide a assinatura do webhook da Meta antes de enfileirar eventos.
- Criptografe credenciais externas, tokens do WhatsApp, conexões de tenant e
  segredos TOTP.
- Separe JWT e middlewares do tenant dos usados por `super_admin`.
- Valide todo dado externo e aplique timeout, limites de tamanho e allowlists
  quando adequados.
- Verifique autorização por tenant e setor em toda leitura ou mutação.
- Proteja Swagger, Bull Board e rotas internas no ambiente de produção.
- Considere isolamento multi-tenant requisito de segurança, não apenas detalhe
  de persistência.
