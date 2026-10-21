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

## Primeiro teste (hostname inicial)

- O endereço de rede `162.240.170.97` respondeu na porta TCP 465 a partir do ambiente de desenvolvimento.
- O hostname inicial informado (`vps-12911741.turingdesenvolvimento.com`) não resolveu no DNS e não correspondia ao certificado TLS apresentado pelo servidor.
- Essa tentativa inicial não autenticou e nenhum e-mail foi enviado.

## Reteste em 2026-10-21

- O cPanel confirmou `mail.agencianexos.vip` como servidor de entrada e saída.
- O resolvedor DNS local não resolveu esse hostname. A conexão foi testada pelo IP do servidor com SNI `mail.agencianexos.vip`.
- A porta TCP 465 respondeu; o certificado TLS 1.3 foi válido para `mail.agencianexos.vip`.
- A autenticação SMTP passou usando as credenciais locais; nenhum segredo foi registrado neste documento.
- Uma mensagem de teste enviada para a própria caixa foi aceita pelo servidor SMTP (1 aceita, 0 rejeitadas) e sua chegada à caixa de entrada foi confirmada pela captura do webmail, em 21/10/2026 às 08:35.
