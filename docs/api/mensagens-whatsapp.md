# Mensagens de atendimento e WhatsApp

## Envio manual

Use `POST /api/v1/conversas/{conversaId}/mensagens`. A conversa deve estar em `COM_ATENDENTE`, pertencer ao atendente autenticado, possuir janela aberta e usar uma conta WhatsApp ativa e validada.

```json
{
  "tipo": "TEXTO",
  "texto": "Olá! Como posso ajudar?",
  "chaveIdempotencia": "uuid-ou-chave-estavel-do-frontend"
}
```

Para `IMAGEM`, `AUDIO` ou `DOCUMENTO`, envie `midiaUrl`; `midiaMimeType` e `midiaNome` são opcionais. `respostaMensagemId` referencia outra mensagem da mesma conversa.

Gere uma `chaveIdempotencia` por ação e reutilize-a em retry de rede. `202` significa persistida e enfileirada; `200` com `duplicada: true` indica que a chave já existia. Use o `public_id` retornado na bolha existente.

## Estados para a tela

- `PENDENTE`: persistida, aguardando worker;
- `ENVIADA`: aceita pela Meta;
- `ENTREGUE`: webhook confirmou entrega;
- `LIDA`: webhook confirmou leitura;
- `FALHA`: erro permanente ou falha informada pela Meta.

Falhas `429` e `5xx` usam retry exponencial. Erros permanentes não são repetidos. A timeline REST contém erros sanitizados, nunca tokens ou corpos sensíveis da Meta. Em `403`, recarregue a atribuição; em `422`, desabilite o compositor e recarregue janela, estado e conta.
