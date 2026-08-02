# Recuperação de senha

## Fluxo do frontend

1. Na tela “Esqueci minha senha”, envie `{ "email": "pessoa@empresa.com" }` para `POST /api/v1/auth/esqueci-senha`.
2. Trate sempre o `202` com a mesma tela de sucesso: “Se o e-mail estiver cadastrado, enviaremos as instruções”. Não indique se a conta existe.
   A resposta confirma somente que a solicitação foi aceita; a entrega ocorre de forma assíncrona pela fila Redis/BullMQ.
3. O link recebido abre `/redefinir-senha?token=...`. O token deve permanecer apenas em memória durante a tela e nunca ser registrado em analytics ou logs.
4. Envie `{ "token": "...", "novaSenha": "SenhaNova123" }` para `POST /api/v1/auth/redefinir-senha`.
5. Em `204`, mostre sucesso e direcione ao login. Todas as sessões anteriores foram revogadas.
6. Em `422` com `TOKEN_RECUPERACAO_INVALIDO`, use uma única tela para token inválido, expirado ou já utilizado, oferecendo solicitar novo link.
7. Em `429`, bloqueie temporariamente o botão e mostre que novas tentativas devem aguardar.

## Política de senha

A nova senha precisa ter de 12 a 128 caracteres, incluindo letra maiúscula, minúscula e número.

## Ambiente

Em desenvolvimento, use `EMAIL_PROVEDOR=smtp`, `SMTP_HOST=127.0.0.1` e `SMTP_PORTA=1025` para entregar ao MailHog. A interface fica normalmente em `http://127.0.0.1:8025`. MailHog não exige usuário, senha nem TLS.

`EMAIL_PROVEDOR=local` suprime a entrega, mas mantém o enfileiramento. Em produção, use `EMAIL_PROVEDOR=resend` com `RESEND_API_KEY`, ou configure um servidor SMTP autenticado. `EMAIL_REMETENTE` e `FRONTEND_URL` são usados em todos os provedores.

O job `RECUPERACAO_SENHA` carrega tenant, destinatário e dados do template. O worker valida o payload com Zod, renderiza texto e HTML e tenta novamente falhas temporárias com backoff exponencial. Nunca apresente estado de entrega ao frontend porque isso permitiria inferir se o e-mail está cadastrado.
Jobs concluídos são removidos do Redis imediatamente. Jobs falhos são retidos por no máximo uma hora para diagnóstico e o link expira em até 60 minutos.
