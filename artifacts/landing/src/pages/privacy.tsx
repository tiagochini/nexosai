export default function PrivacyPolicy() {
  const lastUpdated = "15 de maio de 2026";
  const contactEmail = "privacy@nexos.ai";
  const companyName = "NexOS AI";
  const appUrl = "https://app.nexos.ai";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-mono text-sm font-bold tracking-widest text-white hover:text-white/70 transition-colors">
            ← NEXOS AI
          </a>
          <span className="font-mono text-xs text-white/30 uppercase tracking-widest">Privacy Policy</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="mb-12">
          <div className="font-mono text-xs uppercase tracking-widest text-white/30 mb-3">Política de Privacidade</div>
          <h1 className="font-mono text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="font-mono text-sm text-white/40">Última atualização: {lastUpdated}</p>
        </div>

        <div className="space-y-10 font-mono text-sm text-white/70 leading-relaxed">

          {/* 1. Introduction */}
          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">1. Introdução</h2>
            <p>
              {companyName} ("nós", "nosso", "a plataforma") opera o sistema de automação de lançamentos digitais disponível em {appUrl}.
              Esta Política de Privacidade descreve como coletamos, usamos e protegemos as informações dos usuários, incluindo dados obtidos por meio de integrações com plataformas de terceiros como Meta (Instagram e Facebook), TikTok, Google, LinkedIn e WhatsApp Business.
            </p>
            <p className="mt-3">
              Ao usar o {companyName}, você concorda com esta política. Se não concordar, não utilize a plataforma.
            </p>
          </section>

          {/* 2. Data collected */}
          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">2. Dados que Coletamos</h2>
            <div className="space-y-4">
              <div>
                <p className="text-white font-semibold mb-1">2.1 Dados de conta</p>
                <p>Nome, endereço de e-mail, número de telefone (opcional) e senha (armazenada com hash bcrypt). Nenhuma senha é armazenada em texto claro.</p>
              </div>
              <div>
                <p className="text-white font-semibold mb-1">2.2 Tokens de plataformas sociais</p>
                <p>
                  Quando você conecta sua conta do Instagram, Facebook, TikTok, LinkedIn ou Google Ads via OAuth, armazenamos o <strong className="text-white">access token</strong> de forma segura no banco de dados.
                  Esse token é usado exclusivamente para executar ações autorizadas por você (publicar conteúdo, gerenciar anúncios, enviar mensagens) em nome da sua conta.
                </p>
                <ul className="mt-2 ml-4 space-y-1 text-white/50 list-disc">
                  <li>Nunca compartilhamos tokens com terceiros</li>
                  <li>Você pode revogar o acesso a qualquer momento desconectando a integração na plataforma ou diretamente nas configurações do Meta/TikTok/Google</li>
                  <li>Após desconexão, o token é deletado imediatamente do nosso banco de dados</li>
                </ul>
              </div>
              <div>
                <p className="text-white font-semibold mb-1">2.3 Dados de campanha e conteúdo</p>
                <p>Textos, copies, estratégias e dados de briefing que você insere para geração de conteúdo com IA. Esses dados são usados para operar a plataforma e melhorá-la.</p>
              </div>
              <div>
                <p className="text-white font-semibold mb-1">2.4 Dados de leads e sequências</p>
                <p>
                  E-mails e informações de leads capturados por meio de suas sequências de lançamento. Esses dados pertencem a você (o operador).
                  Coletamos também metadados de engajamento (aberturas, cliques, conversões) para otimizar o desempenho das sequências.
                </p>
              </div>
              <div>
                <p className="text-white font-semibold mb-1">2.5 Dados de uso e logs</p>
                <p>Endereço IP, tipo de dispositivo, páginas acessadas, ações realizadas na plataforma, e logs de erros — para fins de segurança, diagnóstico e melhoria do serviço.</p>
              </div>
              <div>
                <p className="text-white font-semibold mb-1">2.6 Dados de pagamento</p>
                <p>Transações de assinatura são processadas por gateways de terceiros (Asaas, Stripe, Hotmart). Não armazenamos dados de cartão de crédito.</p>
              </div>
            </div>
          </section>

          {/* 3. How we use */}
          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">3. Como Usamos os Dados</h2>
            <ul className="ml-4 space-y-2 list-disc">
              <li>Operar a plataforma e executar campanhas, sequências e publicações automáticas em seu nome</li>
              <li>Fornecer inteligência de IA para estratégia, copywriting e otimização de lançamentos</li>
              <li>Enviar notificações e relatórios semanais sobre o desempenho das suas campanhas</li>
              <li>Processar pagamentos e gerenciar assinaturas</li>
              <li>Garantir a segurança da plataforma e prevenir abusos</li>
              <li>Melhorar os algoritmos e modelos de IA da plataforma (dados anonimizados)</li>
            </ul>
            <p className="mt-3">
              Não vendemos seus dados. Não usamos seus tokens de plataformas sociais para nenhuma finalidade além das ações explicitamente autorizadas por você.
            </p>
          </section>

          {/* 4. Meta / Instagram specific */}
          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">4. Integração com Meta (Instagram e Facebook)</h2>
            <p>
              O {companyName} usa a API do Meta para publicar conteúdo no Instagram e Facebook, gerenciar anúncios via Meta Ads, e enviar mensagens via WhatsApp Business API — exclusivamente mediante sua autorização via OAuth.
            </p>
            <div className="mt-4 space-y-2">
              <p><strong className="text-white">Permissões usadas:</strong></p>
              <ul className="ml-4 space-y-1 list-disc text-white/50">
                <li><code className="text-white/70">instagram_content_publish</code> — publicar posts e reels</li>
                <li><code className="text-white/70">pages_manage_posts</code> — publicar no Facebook</li>
                <li><code className="text-white/70">instagram_basic</code> — ler informações básicas do perfil</li>
                <li><code className="text-white/70">pages_read_engagement</code> — ler métricas de engajamento</li>
                <li><code className="text-white/70">ads_management</code> — criar e gerenciar anúncios</li>
                <li><code className="text-white/70">business_management</code> — gerenciar ativos do Business Manager</li>
                <li><code className="text-white/70">whatsapp_business_messaging</code> — enviar mensagens via WhatsApp Business API</li>
              </ul>
            </div>
            <p className="mt-4">
              Você pode revogar qualquer permissão a qualquer momento em{" "}
              <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                facebook.com/settings → Aplicativos e sites
              </a>.
              Após revogação, o {companyName} não poderá mais executar ações nessas plataformas.
            </p>
            <p className="mt-3">
              Não compartilhamos dados do Meta com terceiros. Não acessamos mensagens privadas de usuários finais.
              Seguimos a{" "}
              <a href="https://developers.facebook.com/policy/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                Política da Plataforma Meta
              </a>.
            </p>
          </section>

          {/* 5. Third-party AI */}
          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">5. Provedores de IA de Terceiros</h2>
            <p>
              A plataforma usa modelos de linguagem de terceiros para gerar conteúdo e estratégias:
              Anthropic (Claude), OpenAI (GPT), e Google (Gemini).
              Os dados de briefing e contexto de campanha são enviados a esses provedores apenas para processar suas requisições.
              Cada provedor tem sua própria política de privacidade e não retém dados para treinamento (mediante nossos contratos de uso comercial).
            </p>
          </section>

          {/* 6. Data retention */}
          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">6. Retenção de Dados</h2>
            <ul className="ml-4 space-y-1 list-disc">
              <li>Dados de conta: retidos enquanto a conta estiver ativa. Após cancelamento, excluídos em até 90 dias.</li>
              <li>Tokens de plataformas sociais: excluídos imediatamente após desconexão da integração.</li>
              <li>Dados de leads (suas sequências): retidos pelo período da sua assinatura + 30 dias de grace period.</li>
              <li>Logs de sistema: retidos por até 12 meses para fins de segurança.</li>
            </ul>
          </section>

          {/* 7. Your rights */}
          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">7. Seus Direitos (LGPD)</h2>
            <p>Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a:</p>
            <ul className="mt-3 ml-4 space-y-1 list-disc">
              <li>Confirmar a existência de tratamento dos seus dados</li>
              <li>Acessar seus dados</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar anonimização, bloqueio ou eliminação dos dados</li>
              <li>Portabilidade dos dados</li>
              <li>Revogar consentimento</li>
            </ul>
            <p className="mt-3">
              Para exercer esses direitos, entre em contato por: <a href={`mailto:${contactEmail}`} className="text-blue-400 hover:underline">{contactEmail}</a>
            </p>
          </section>

          {/* 8. Security */}
          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">8. Segurança</h2>
            <p>
              Utilizamos criptografia em trânsito (TLS/HTTPS) e em repouso para dados sensíveis. Senhas são armazenadas com bcrypt.
              Tokens de acesso são armazenados de forma criptografada. Realizamos monitoramento contínuo de segurança e auditoria de logs.
            </p>
          </section>

          {/* 9. Cookies */}
          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">9. Cookies e Rastreamento</h2>
            <p>
              Usamos cookies essenciais para autenticação e sessão. Não usamos cookies de rastreamento de terceiros para fins publicitários próprios.
              Eventos de conversão (Meta CAPI, TikTok Events API) são disparados a pedido seus para suas próprias campanhas de anúncios.
            </p>
          </section>

          {/* 10. Changes */}
          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">10. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Notificaremos usuários ativos por e-mail sobre mudanças materiais com pelo menos 7 dias de antecedência.
              A versão mais recente estará sempre disponível nesta página.
            </p>
          </section>

          {/* 11. Contact */}
          <section id="data-deletion">
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">11. Exclusão de Dados</h2>
            <p className="mb-3">
              Você pode solicitar a exclusão completa dos seus dados pessoais armazenados pelo NexOS AI a qualquer momento.
              Isso inclui dados de conta, histórico de campanhas, integrações conectadas e qualquer dado vinculado
              a plataformas de terceiros como Meta (Facebook e Instagram).
            </p>
            <p className="mb-3">
              Para revogar o acesso do NexOS AI à sua conta Meta e solicitar exclusão dos dados coletados via Facebook Login:
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-4 mb-3">
              <li>Acesse <a href="https://www.facebook.com/settings?tab=applications" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">facebook.com/settings → Aplicativos e Sites</a></li>
              <li>Localize <strong className="text-white">NexOS AI</strong> na lista</li>
              <li>Clique em <strong className="text-white">Remover</strong></li>
            </ol>
            <p className="mb-3">
              Para solicitar exclusão diretamente ao NexOS AI, envie um e-mail para{" "}
              <a href="mailto:privacy@nexos.ai" className="text-blue-400 hover:underline">privacy@nexos.ai</a>{" "}
              com o assunto <strong className="text-white">"Exclusão de Dados"</strong>. Processamos todas as
              solicitações em até 30 dias úteis conforme a LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">12. Contato</h2>
            <p>
              Para dúvidas, solicitações ou exercício dos seus direitos:
            </p>
            <div className="mt-3 border border-white/10 p-4 bg-white/5 space-y-1">
              <p><span className="text-white/40">Empresa:</span> NexOS AI</p>
              <p><span className="text-white/40">E-mail:</span> <a href={`mailto:${contactEmail}`} className="text-blue-400 hover:underline">{contactEmail}</a></p>
              <p><span className="text-white/40">Website:</span> <a href={appUrl} className="text-blue-400 hover:underline">{appUrl}</a></p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/10 text-center">
          <p className="font-mono text-xs text-white/20">© 2026 NexOS AI — Todos os direitos reservados</p>
          <a href="/" className="mt-3 inline-block font-mono text-xs text-white/30 hover:text-white/60 transition-colors">← Voltar ao site</a>
        </div>
      </div>
    </div>
  );
}
