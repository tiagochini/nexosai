export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 bg-black/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-mono text-sm font-bold tracking-widest text-white hover:text-white/70 transition-colors">
            ← NEXOS AI
          </a>
          <span className="font-mono text-xs text-white/30 uppercase tracking-widest">Data Deletion</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16 font-mono">
        <div className="mb-12">
          <div className="text-xs uppercase tracking-widest text-white/30 mb-3">Exclusão de Dados</div>
          <h1 className="text-3xl font-bold text-white mb-2">Data Deletion Instructions</h1>
          <p className="text-sm text-white/40">Última atualização: 16 de maio de 2026</p>
        </div>

        <div className="space-y-10 text-sm text-white/70 leading-relaxed">

          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">
              Revogar acesso via Meta / Facebook
            </h2>
            <p className="mb-4">
              Se você conectou sua conta do Facebook ou Instagram ao NexOS AI e deseja remover
              o acesso e excluir os dados associados, siga os passos abaixo:
            </p>
            <ol className="list-decimal list-inside space-y-3 ml-4">
              <li>
                Acesse{" "}
                <a
                  href="https://www.facebook.com/settings?tab=applications"
                  className="text-blue-400 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  facebook.com/settings → Aplicativos e Sites
                </a>
              </li>
              <li>Localize <strong className="text-white">NexOS AI</strong> na lista de apps conectados</li>
              <li>Clique em <strong className="text-white">Remover</strong></li>
              <li>Confirme a remoção na caixa de diálogo</li>
            </ol>
            <p className="mt-4">
              Após a remoção, o NexOS AI perde imediatamente o acesso à sua conta Meta.
              Os tokens de acesso são invalidados e nenhum dado adicional é coletado.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">
              Solicitar exclusão completa de dados
            </h2>
            <p className="mb-4">
              Para solicitar a exclusão de todos os dados pessoais armazenados pelo NexOS AI
              — incluindo conta, histórico de campanhas e dados de integrações — envie um
              e-mail para:
            </p>
            <div className="border border-white/10 bg-white/5 p-4 space-y-2">
              <p><span className="text-white/40">E-mail:</span>{" "}
                <a href="mailto:privacy@agencianexos.vip" className="text-blue-400 hover:underline">privacy@agencianexos.vip</a>
              </p>
              <p><span className="text-white/40">Assunto:</span> <strong className="text-white">Exclusão de Dados</strong></p>
              <p><span className="text-white/40">Inclua:</span> o e-mail cadastrado na sua conta NexOS AI</p>
            </div>
            <p className="mt-4">
              Processamos todas as solicitações em até <strong className="text-white">30 dias úteis</strong> conforme
              a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-3 uppercase tracking-widest border-b border-white/10 pb-2">
              Dados que são excluídos
            </h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Dados de perfil e conta de usuário</li>
              <li>Tokens de acesso às plataformas (Meta, Google, TikTok, LinkedIn)</li>
              <li>Histórico de campanhas e conteúdo gerado</li>
              <li>Dados de leads e sequências de lançamento</li>
              <li>Logs de uso de IA e créditos</li>
              <li>Dados de pagamento (referência de transação apenas; dados de cartão nunca são armazenados)</li>
            </ul>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-white/10 text-center">
          <p className="text-xs text-white/20">© 2026 NexOS AI — Todos os direitos reservados</p>
          <div className="mt-3 space-x-4">
            <a href="/privacy" className="text-xs text-white/30 hover:text-white/60 transition-colors">Política de Privacidade</a>
            <a href="/terms" className="text-xs text-white/30 hover:text-white/60 transition-colors">Termos de Uso</a>
            <a href="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">← Voltar ao site</a>
          </div>
        </div>
      </div>
    </div>
  );
}
