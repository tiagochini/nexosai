# Backoffice: preços e recursos dos planos

Área administrativa exclusiva em `/admin`, com navegação própria separada do menu de operações do usuário. A página de planos fica em `/admin/pricing`.

O acesso exige uma sessão ativa de Platform Admin. As rotas da interface aguardam a identificação da sessão e redirecionam usuários sem privilégio; a API usa o middleware existente `requireAuth` + `requirePlatformAdmin`. A identidade autorizada vem do UUID configurado, não de e-mail ou campo enviado pelo navegador. O menu administrativo não aparece no layout operacional.

O painel permite editar os planos Solo e Agency já armazenados em `plans`: preço de acesso, preço de onboarding, créditos incluídos, campanhas simultâneas, workspaces, redes sociais permitidas, texto de recursos exibido na oferta e disponibilidade no catálogo. As alterações são persistidas no banco. Os limites de campanhas, workspaces, saldo inicial de créditos e redes sociais são lidos pelas regras já existentes do servidor. Preços atualizados afetam novas cobranças; pagamentos já criados conservam o valor registrado.

O produto está atualmente configurado como acesso único. O nome legado `priceMonthly` não representa necessariamente uma cobrança recorrente; a tela avisa isso antes da edição. Os pacotes de créditos permanecem em configuração de código e não são alterados por esta página.

O campo “Recursos descritos no plano” controla texto da oferta e não funciona como chave liga/desliga para módulos globais. Também não foram expostos limites de vídeo/domínio ou flags que o servidor não aplica como entitlements. Um catálogo global de feature flags exigiria definir os módulos desejados e inserir verificações reais nas rotas da API e na interface.

Validação: `test-platform-admin-db` verifica leitura, atualização persistida de preço, validação de entrada e bloqueio a usuários sem privilégio. Executado pela suite de integração em banco PostgreSQL/Redis descartável, sem chamadas a provedores externos.
