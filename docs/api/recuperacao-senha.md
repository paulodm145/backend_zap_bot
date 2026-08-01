# Recuperação de senha

## Fluxo do frontend

1. Na tela “Esqueci minha senha”, envie `{ "email": "pessoa@empresa.com" }` para `POST /api/v1/auth/esqueci-senha`.
2. Trate sempre o `202` com a mesma tela de sucesso: “Se o e-mail estiver cadastrado, enviaremos as instruções”. Não indique se a conta existe.
3. O link recebido abre `/redefinir-senha?token=...`. O token deve permanecer apenas em memória durante a tela e nunca ser registrado em analytics ou logs.
4. Envie `{ "token": "...", "novaSenha": "SenhaNova123" }` para `POST /api/v1/auth/redefinir-senha`.
5. Em `204`, mostre sucesso e direcione ao login. Todas as sessões anteriores foram revogadas.
6. Em `422` com `TOKEN_RECUPERACAO_INVALIDO`, use uma única tela para token inválido, expirado ou já utilizado, oferecendo solicitar novo link.
7. Em `429`, bloqueie temporariamente o botão e mostre que novas tentativas devem aguardar.

## Política de senha

A nova senha precisa ter de 12 a 128 caracteres, incluindo letra maiúscula, minúscula e número.

## Ambiente

`EMAIL_PROVEDOR=local` suprime o envio e registra somente destinatário e assunto, nunca o token. Em produção, use `EMAIL_PROVEDOR=resend`, configure `RESEND_API_KEY`, `EMAIL_REMETENTE` e `FRONTEND_URL`.
