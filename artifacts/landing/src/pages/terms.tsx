import { useEffect } from "react";

export default function TermsOfService() {
  useEffect(() => {
    document.title = "NexOS AI Terms of Service";
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-mono text-sm font-bold tracking-widest text-white hover:text-white/70 transition-colors">
            ← NEXOS AI
          </a>
          <span className="font-mono text-xs text-white/30 uppercase tracking-widest">NexOS AI Terms of Service</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="font-mono text-xs uppercase tracking-widest text-white/30 mb-3">Termos de Uso</div>
          <h1 className="font-mono text-3xl font-bold text-white mb-2">NexOS AI Terms of Service</h1>
          <p className="font-mono text-sm text-white/40">Última atualização: 15 de maio de 2026</p>
        </div>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1. Aceitação dos Termos</h2>
          <p className="text-gray-300 leading-relaxed">
            Ao acessar ou usar a plataforma NexOS AI ("Serviço"), você concorda em ficar
            vinculado a estes Termos de Uso. Se você não concordar com qualquer parte dos
            termos, não poderá acessar o Serviço.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">2. Descrição do Serviço</h2>
          <p className="text-gray-300 leading-relaxed">
            O NexOS AI é uma plataforma SaaS de automação de campanhas digitais com inteligência
            artificial. O Serviço permite que usuários criem, gerenciem e publiquem campanhas de
            marketing em plataformas como Instagram, Facebook, WhatsApp e outras redes sociais,
            com auxílio de agentes de IA.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">3. Contas de Usuário</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            Para usar o Serviço, você deve criar uma conta fornecendo informações precisas e
            completas. Você é responsável por manter a confidencialidade de sua senha e por
            todas as atividades realizadas em sua conta.
          </p>
          <p className="text-gray-300 leading-relaxed">
            Você concorda em notificar imediatamente o NexOS AI sobre qualquer uso não autorizado
            de sua conta. O NexOS AI não será responsável por perdas decorrentes do uso não
            autorizado de sua conta.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">4. Integrações com Plataformas de Terceiros</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            O Serviço integra-se com plataformas de terceiros, incluindo Meta (Facebook e
            Instagram), Google, TikTok e LinkedIn. Ao conectar essas integrações, você autoriza
            o NexOS AI a acessar e usar os dados dessas plataformas conforme suas respectivas
            políticas de uso.
          </p>
          <p className="text-gray-300 leading-relaxed">
            Você pode revogar o acesso do NexOS AI a qualquer integração a qualquer momento,
            tanto pelas configurações do NexOS AI quanto diretamente nas plataformas de terceiros.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">5. Uso Aceitável</h2>
          <p className="text-gray-300 leading-relaxed mb-3">Você concorda em não usar o Serviço para:</p>
          <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
            <li>Publicar conteúdo ilegal, enganoso, difamatório ou ofensivo</li>
            <li>Violar direitos de propriedade intelectual de terceiros</li>
            <li>Enviar spam ou comunicações não solicitadas em massa</li>
            <li>Tentar acessar sistemas ou dados sem autorização</li>
            <li>Revender ou sublicenciar o Serviço sem autorização expressa</li>
            <li>Violar as políticas de uso das plataformas integradas</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">6. Créditos e Pagamentos</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            O Serviço opera com um sistema de créditos. Os créditos são consumidos conforme o
            uso de funcionalidades de IA. Créditos não utilizados ao final do ciclo de
            assinatura mensal não são transferidos para o período seguinte, exceto quando
            expressamente indicado.
          </p>
          <p className="text-gray-300 leading-relaxed">
            Pagamentos são processados por meio de gateways de pagamento de terceiros. O NexOS AI
            não armazena dados de cartão de crédito. Reembolsos são avaliados caso a caso
            conforme nossa política de reembolso.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">7. Propriedade Intelectual</h2>
          <p className="text-gray-300 leading-relaxed">
            O Serviço e seu conteúdo original, recursos e funcionalidades são e permanecerão
            propriedade exclusiva do NexOS AI. O conteúdo gerado por IA em nome do usuário
            pertence ao usuário, sujeito às limitações dos modelos de IA utilizados. Você
            concede ao NexOS AI uma licença limitada para processar seu conteúdo exclusivamente
            para fins de prestação do Serviço.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">8. Limitação de Responsabilidade</h2>
          <p className="text-gray-300 leading-relaxed">
            O NexOS AI não se responsabiliza por resultados de negócios, receitas ou metas de
            conversão não atingidas. O Serviço é fornecido "como está". Em nenhuma circunstância
            a responsabilidade total do NexOS AI excederá o valor pago pelo usuário nos 3 meses
            anteriores ao evento que deu origem à reclamação.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">9. Rescisão</h2>
          <p className="text-gray-300 leading-relaxed">
            O NexOS AI pode encerrar ou suspender sua conta imediatamente, sem aviso prévio,
            por violação destes Termos. Após a rescisão, seu direito de usar o Serviço cessa
            imediatamente. Você pode solicitar a exclusão de seus dados conforme nossa
            Política de Privacidade.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">10. Lei Aplicável</h2>
          <p className="text-gray-300 leading-relaxed">
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Qualquer
            disputa será submetida à jurisdição exclusiva dos tribunais da comarca de São Paulo, SP.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">11. Contato</h2>
          <p className="text-gray-300 leading-relaxed">
            Para dúvidas sobre estes Termos de Uso, entre em contato:
          </p>
          <ul className="mt-2 text-gray-300 space-y-1">
            <li>E-mail: <a href="mailto:legal@nexos.ai" className="text-blue-400 hover:underline">legal@nexos.ai</a></li>
            <li>Site: <a href="https://nexos.ai" className="text-blue-400 hover:underline">nexos.ai</a></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
