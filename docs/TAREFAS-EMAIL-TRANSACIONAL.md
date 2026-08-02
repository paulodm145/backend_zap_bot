# Tarefas de e-mail transacional

Branch: `feat/email-recuperacao-fila`

- [x] Definir contrato tipado e extensível para jobs de e-mail.
- [x] Adicionar fila BullMQ compartilhada e namespacada por tenant.
- [x] Desacoplar a solicitação de recuperação do provedor de e-mail.
- [x] Criar worker com validação Zod, retry e backoff.
- [x] Criar template textual e HTML para recuperação de senha.
- [x] Implementar entrega SMTP compatível com MailHog.
- [x] Preservar provedor Resend para produção.
- [x] Validar as configurações SMTP no ambiente.
- [x] Documentar MailHog, Redis, variáveis e teste manual no README.
- [x] Atualizar a documentação funcional de recuperação de senha.
- [x] Testar enfileiramento, renderização e entrega SMTP.
- [x] Executar formatação, lint, typecheck, build e cobertura.
- [x] Commitar e publicar a branch.

## Saída

- [x] A API responde sem aguardar o servidor SMTP.
- [x] O token continua armazenado apenas como hash no PostgreSQL.
- [x] Falhas temporárias de SMTP são repetidas pela fila.
- [x] O MailHog recebe o link válido de redefinição.
- [x] A implementação serve como modelo para novos e-mails transacionais.
