# Login de homologação — 07/10/2026

O login chamava `toast` do Sonner, mas a raiz da interface montava apenas o
Toaster Radix. Montado também o Sonner; falhas agora ficam visíveis no formulário
em um elemento `role="alert"`. Credenciais inválidas, origem não autorizada e
falha de conexão têm mensagens nos idiomas existentes da tela.

O launcher de desenvolvimento/homologação inclui explicitamente
`http://localhost:<porta da interface>` e `http://127.0.0.1:<porta da interface>`
na lista de origens. Preserva as origens configuradas no perfil. Não aceita
automaticamente domínios de túneis nem altera a proteção de origem da API.

Evidência deste checkpoint:

- Senha inválida no navegador: mensagem de acesso negado visível no formulário.
- Login do founder no navegador com a senha solicitada: dashboard do seu
  workspace aberto; sessão deixada ativa para o usuário continuar o teste.
- TypeScript da interface: PASS.
- Login HTTP sem credenciais pelos dois endereços locais: 400 de validação,
  comprovando que passaram pelo controle de origem.
- Origem externa não configurada: 403 `UNTRUSTED_ORIGIN`.
- API através do proxy da interface: 200 `ready` após reinício da homologação.
- Scanner de segredos: PASS; nenhuma senha ou token registrado nesta evidência.

Supabase permanece como banco de homologação; não foram criadas fixtures.

O usuário informou `https://agencianexos.vip`. Perfil privado de homologação
atualizado com esse `APP_URL`, origem explícita, base pública do webhook Meta e
retorno OAuth `https://agencianexos.vip/api/social/callback/meta`. Reinício feito.
Não houve alteração no painel da Meta nem assinatura automática de contas.

Validação pelo domínio público:

- `/api/readyz`: HTTP 200 `ready`.
- Login do founder: HTTP 200.
- Sessão administrativa: HTTP 200, UUID igual ao cadastrado na homologação.
- Logout da sessão de verificação: HTTP 204.
- Origem externa não configurada continua recebendo HTTP 403.

Próximo checkpoint: configurar e verificar os retornos/permissões da Meta e
homologar recebimento real do comentário MAPA. A entrega Meta não foi testada aqui.
