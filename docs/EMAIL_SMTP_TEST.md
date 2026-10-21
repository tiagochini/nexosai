# Teste de e-mail SMTP cPanel

O provedor `custom_smtp` pode enviar um e-mail individual pelo SMTP configurado no servidor. A senha é carregada somente de `SMTP_PASSWORD`; nunca deve ser adicionada ao Git, aos logs ou enviada pelo chat.

Configuração indicada pela tela do cPanel:

```dotenv
SMTP_HOST=vps-12911741.turingdesenvolvimento.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contato@agencianexos.vip
SMTP_PASSWORD=<senha da caixa, armazenada no ambiente local/secret manager>
SMTP_FROM_EMAIL=contato@agencianexos.vip
```

Para validar, defina os campos no `.env.local` ignorado pelo Git ou no secret manager do servidor, reinicie a API e crie um dispatch `custom_smtp` com o e-mail de teste como destinatário. O SMTP envia para um endereço por dispatch; não transforma uma lista de contatos em campanha e não agenda mensagens futuras. O NexOS marca como enviado apenas após o servidor SMTP aceitar o destinatário.

## Estado desta validação

- O endereço de rede `162.240.170.97` respondeu na porta TCP 465 a partir do ambiente de desenvolvimento.
- O hostname informado pelo cPanel não resolveu no DNS consultado durante o teste. Confirme com a hospedagem o hostname SMTP correto antes de autenticar; não substitua pelo IP sem validar o certificado TLS.
- O envio autenticado ainda depende da senha da caixa, que não estava na imagem. Configure-a localmente como segredo e não a compartilhe no chat.
