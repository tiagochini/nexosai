interface MiniGuideProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export default function MiniGuide({ onNavigate }: MiniGuideProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-16">

      {/* Header */}
      <div className="rounded-2xl border border-[hsl(250_90%_65%/0.3)] bg-gradient-to-br from-[hsl(222_25%_7%)] to-[hsl(250_30%_8%)] p-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[hsl(250_90%_65%/0.2)] text-[hsl(250_90%_75%)] border border-[hsl(250_90%_65%/0.3)]">📘 Mini-Guia Exclusivo</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-3">Primeiros R$10k Online</h1>
        <p className="text-[hsl(220_10%_65%)] text-lg leading-relaxed mb-4">
          O caminho mais rápido para sua primeira renda digital — sem enrolação, sem teoria vaga.
          47 páginas direto ao ponto.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-[hsl(220_10%_60%)]">
          <span>📄 47 páginas</span>
          <span>·</span>
          <span>✅ Checklist de 7 dias</span>
          <span>·</span>
          <span>📊 Planilha de projeção</span>
          <span>·</span>
          <span>🎯 3 estudos de caso reais</span>
        </div>
      </div>

      {/* Intro */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xl font-bold text-white">Por que a maioria não chega ao primeiro R$10k?</h2>
        <p className="text-[hsl(220_10%_65%)] leading-relaxed">
          Não é falta de produto. Não é falta de seguidores. Não é falta de talento.
        </p>
        <p className="text-[hsl(220_10%_65%)] leading-relaxed">
          É falta de sequência. As pessoas tentam fazer tudo ao mesmo tempo — produto, audiência, tráfego, copy, automação — e acabam não fazendo nada direito. O resultado: seis meses de esforço, zero em vendas, e a sensação de que "isso não é para mim".
        </p>
        <p className="text-[hsl(220_10%_65%)] leading-relaxed">
          Este guia existe para mudar isso. Você vai sair daqui com uma sequência exata de 7 dias para gerar sua primeira receita digital — mesmo sem produto pronto, sem lista de email, sem equipe.
        </p>
        <div className="rounded-xl border border-[hsl(250_90%_65%/0.3)] bg-[hsl(250_90%_65%/0.08)] p-4 text-[hsl(250_90%_75%)] text-sm font-semibold">
          ⚡ A promessa: seguindo este método, você vai ter ao menos um cliente pagante em 7 dias — ou saberá exatamente por quê não teve e como corrigir.
        </div>
      </section>

      {/* Capítulo 1 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[hsl(250_90%_65%)] text-white text-sm font-bold flex items-center justify-center">1</span>
          <h2 className="text-xl font-bold text-white">O Modelo Mental Certo</h2>
        </div>
        <div className="card p-6 space-y-4">
          <h3 className="text-base font-bold text-[hsl(250_90%_75%)]">Você não precisa de produto para começar a vender</h3>
          <p className="text-[hsl(220_10%_65%)] leading-relaxed">
            O maior erro de quem está começando é gastar três meses criando um curso antes de ter uma venda. Isso se chama lançamento semente — e é o oposto do que você deve fazer.
          </p>
          <p className="text-[hsl(220_10%_65%)] leading-relaxed">
            O modelo certo é: <strong className="text-white">vender primeiro, criar depois</strong>. Você apresenta a transformação, coleta pagamentos, e então entrega. Se ninguém comprar, você não perdeu meses criando algo que o mercado não quer.
          </p>
          <div className="rounded-xl bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_14%)] p-4 space-y-3 text-sm">
            <p className="text-[hsl(220_10%_50%)] uppercase tracking-wider font-semibold text-xs">Exemplo real</p>
            <p className="text-[hsl(220_10%_70%)] leading-relaxed">
              João, personal trainer, criou um post no Instagram explicando que ia abrir 5 vagas para acompanhamento online por 30 dias a R$297. Ele recebeu 11 pedidos em 48h. Faturou R$1.485 antes de criar qualquer conteúdo. Só depois montou o método.
            </p>
          </div>
          <h3 className="text-base font-bold text-[hsl(250_90%_75%)] pt-2">A equação básica do digital</h3>
          <div className="rounded-xl bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_14%)] p-4 text-center">
            <p className="text-white font-bold text-lg">Audiência Aquecida × Oferta Certa × Momento Certo = Venda</p>
            <p className="text-[hsl(220_10%_50%)] text-sm mt-2">Faltando qualquer um dos três, não acontece.</p>
          </div>
          <p className="text-[hsl(220_10%_65%)] leading-relaxed">
            Nos próximos 7 dias você vai construir esses três elementos em paralelo — de forma enxuta, sem desperdício.
          </p>
        </div>
      </section>

      {/* Capítulo 2 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[hsl(250_90%_65%)] text-white text-sm font-bold flex items-center justify-center">2</span>
          <h2 className="text-xl font-bold text-white">Escolha seu Tema em 30 Minutos</h2>
        </div>
        <div className="card p-6 space-y-4">
          <p className="text-[hsl(220_10%_65%)] leading-relaxed">
            Você já sabe fazer algo que outra pessoa pagaria para aprender. O problema não é falta de conhecimento — é não saber como empacotar.
          </p>
          <h3 className="text-base font-bold text-[hsl(250_90%_75%)]">O filtro dos 3 critérios</h3>
          <div className="space-y-3">
            {[
              { n: "1", title: "Você domina", desc: "Não precisa ser PhD. Precisa saber mais do que 80% das pessoas sobre o assunto. Alguém que nunca treinou e quer emagrecer 10kg vai pagar para aprender com alguém que emagreceu 20kg — não precisa de nutricionista." },
              { n: "2", title: "O mercado quer", desc: "As pessoas estão buscando isso? Teste simples: pesquise no Google, TikTok e Instagram. Se aparecerem criadores com mais de 10k seguidores falando sobre o tema, existe mercado." },
              { n: "3", title: "Tem transação óbvia", desc: "Existe um resultado claro e mensurável que a pessoa vai alcançar? 'Emagrecer 5kg em 30 dias' vende. 'Ter mais saúde' não vende — é vago demais." },
            ].map(item => (
              <div key={item.n} className="flex gap-4 rounded-xl bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_14%)] p-4">
                <span className="w-7 h-7 rounded-full border-2 border-[hsl(250_90%_65%)] text-[hsl(250_90%_75%)] text-sm font-bold flex items-center justify-center shrink-0">{item.n}</span>
                <div>
                  <p className="text-white font-semibold mb-1">{item.title}</p>
                  <p className="text-[hsl(220_10%_60%)] text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <h3 className="text-base font-bold text-[hsl(250_90%_75%)] pt-2">Exercício — 30 minutos agora</h3>
          <div className="rounded-xl bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_14%)] p-4 space-y-2 text-sm text-[hsl(220_10%_65%)]">
            <p>Responda no papel:</p>
            <p>1. Liste 5 coisas que você sabe fazer melhor que a maioria das pessoas ao seu redor.</p>
            <p>2. Para cada uma, anote se existe gente buscando sobre isso nas redes (sim/não).</p>
            <p>3. Para cada uma, complete: "Após aprender comigo, o cliente vai conseguir _____ em _____ dias."</p>
            <p className="text-[hsl(250_90%_75%)] font-semibold pt-1">O item que passar nos 3 critérios é o seu tema. Escolha e siga em frente — não existe tema perfeito, existe execução.</p>
          </div>
        </div>
      </section>

      {/* Capítulo 3 — Checklist 7 dias */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[hsl(250_90%_65%)] text-white text-sm font-bold flex items-center justify-center">3</span>
          <h2 className="text-xl font-bold text-white">Checklist: Os 7 Dias do Primeiro Lançamento</h2>
        </div>
        <div className="card p-6 space-y-6">
          <p className="text-[hsl(220_10%_65%)]">Execute nessa ordem. Não pule dias. Não adapte antes de fazer uma vez do jeito certo.</p>
          {[
            {
              dia: "Dia 1",
              titulo: "Defina a oferta",
              cor: "hsl(250_90%_65%)",
              itens: [
                "Escolha o tema (filtro dos 3 critérios)",
                "Defina o resultado prometido (claro e mensurável)",
                "Defina o formato: consultoria 1:1, grupo, minicurso gravado",
                "Defina o preço: entre R$97 e R$497 para o primeiro lançamento",
                "Crie o título da oferta: [Número] + [Verbo] + [Resultado] + [Prazo]",
              ],
              exemplo: "Exemplo: '5 clientes em 30 dias sem gastar com tráfego pago'"
            },
            {
              dia: "Dia 2",
              titulo: "Monte a prova social",
              cor: "hsl(168_100%_42%)",
              itens: [
                "Identifique 3 pessoas que já se beneficiaram do seu conhecimento (de graça ou não)",
                "Peça um depoimento em texto ou áudio de 30 segundos",
                "Se não tiver nenhum: ofereça 1 vaga gratuita em troca de depoimento",
                "Tire uma foto ou print de cada resultado obtido",
              ],
              exemplo: "Depoimento mínimo: 'Antes eu tinha X problema. Aprendi com [você] e agora Y. Recomendo.'"
            },
            {
              dia: "Dia 3",
              titulo: "Crie a página de captura",
              cor: "hsl(45_100%_60%)",
              itens: [
                "Use um desses: Linktree, Stan.Store, Notion público ou Google Forms",
                "Escreva o título, 3-5 benefícios e o CTA ('Quero participar')",
                "Adicione os depoimentos coletados ontem",
                "Adicione escassez real: 'Apenas 5 vagas'",
                "Inclua o preço e o método de pagamento (Pix ou link do Mercado Pago)",
              ],
              exemplo: "Não precisa ser perfeita. Perfeita não converte mais que boa o suficiente."
            },
            {
              dia: "Dia 4",
              titulo: "Aquecimento da audiência",
              cor: "hsl(280_90%_70%)",
              itens: [
                "Poste um conteúdo gratuito de alto valor sobre o tema (não mencione a venda ainda)",
                "Stories com pergunta: 'Qual é sua maior dificuldade com [tema]?'",
                "Responda cada resposta individualmente com insights valiosos",
                "Liste os perfis que engajaram — eles são seus leads mais quentes",
              ],
              exemplo: "Dica: Conteúdo de valor + pergunta = você descobre objeções antes de fazer o lançamento."
            },
            {
              dia: "Dia 5",
              titulo: "Apresente a oferta",
              cor: "hsl(15_100%_65%)",
              itens: [
                "Post no feed: problema → agitação → solução → CTA",
                "Stories em sequência: antes/depois → depoimento → 'link na bio'",
                "Mensagem direta para quem engajou no dia 4: 'Vi que você tem interesse em [tema]...'",
                "Abra o link de pagamento e coloque no perfil",
              ],
              exemplo: "Script do DM: 'Oi [nome], vi que você curtiu meu post sobre [tema]. Montei algo específico para quem quer [resultado]. Posso te mandar os detalhes?'"
            },
            {
              dia: "Dia 6",
              titulo: "Urgência e follow-up",
              cor: "hsl(0_90%_65%)",
              itens: [
                "Stories com contagem regressiva: '24h para fechar'",
                "Post com depoimento (se já tiver algum comprador, use o feedback deles)",
                "Responda objeções publicamente nos comentários",
                "DM para quem visualizou a página mas não comprou (se usar ferramenta que mostra isso)",
              ],
              exemplo: "Urgência funciona quando é real. Não ameace fechar e não fechar — isso destrói a credibilidade."
            },
            {
              dia: "Dia 7",
              titulo: "Fechamento e entrega",
              cor: "hsl(168_100%_42%)",
              itens: [
                "Post de fechamento: 'Últimas vagas — encerro hoje às 23h59'",
                "Stories de encerramento com CTA final",
                "Confirme todos os pagamentos e envie boas-vindas para os compradores",
                "Inicie a entrega (mesmo que seja uma call de 60 minutos)",
                "Peça depoimento em 48h após a primeira entrega",
              ],
              exemplo: "Objetivo do Dia 7: zero remorso. Entregue além do prometido — esse comprador vai ser sua próxima prova social."
            },
          ].map(d => (
            <div key={d.dia} className="rounded-xl bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_14%)] p-5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${d.cor}25`, color: d.cor, border: `1px solid ${d.cor}40` }}>{d.dia}</span>
                <h3 className="text-white font-bold">{d.titulo}</h3>
              </div>
              <ul className="space-y-1.5">
                {d.itens.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[hsl(220_10%_65%)]">
                    <span className="text-[hsl(250_90%_70%)] mt-0.5 shrink-0">☐</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[hsl(220_10%_45%)] italic border-t border-[hsl(220_20%_12%)] pt-2">{d.exemplo}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capítulo 4 — Planilha de projeção */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[hsl(250_90%_65%)] text-white text-sm font-bold flex items-center justify-center">4</span>
          <h2 className="text-xl font-bold text-white">Planilha de Projeção de Receita</h2>
        </div>
        <div className="card p-6 space-y-4">
          <p className="text-[hsl(220_10%_65%)]">Use esta tabela para calcular sua meta antes de começar. O objetivo é ter clareza sobre quantas vendas você precisa — não chegar no final sem saber o que deu errado.</p>
          <div className="overflow-x-auto rounded-xl border border-[hsl(220_20%_14%)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(220_20%_14%)] bg-[hsl(220_20%_8%)]">
                  <th className="text-left px-4 py-3 text-[hsl(220_10%_45%)] font-semibold uppercase text-xs tracking-wider">Preço</th>
                  <th className="text-left px-4 py-3 text-[hsl(220_10%_45%)] font-semibold uppercase text-xs tracking-wider">Vendas p/ R$5k</th>
                  <th className="text-left px-4 py-3 text-[hsl(220_10%_45%)] font-semibold uppercase text-xs tracking-wider">Vendas p/ R$10k</th>
                  <th className="text-left px-4 py-3 text-[hsl(220_10%_45%)] font-semibold uppercase text-xs tracking-wider">Leads necessários*</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { preco: "R$97", v5k: 52, v10k: 103, leads: "300–500" },
                  { preco: "R$197", v5k: 26, v10k: 51, leads: "150–250" },
                  { preco: "R$297", v5k: 17, v10k: 34, leads: "100–170" },
                  { preco: "R$497", v5k: 11, v10k: 21, leads: "60–100" },
                  { preco: "R$997", v5k: 6, v10k: 11, leads: "30–55" },
                ].map((row, i) => (
                  <tr key={row.preco} className={`border-b border-[hsl(220_20%_12%)] ${i === 2 ? "bg-[hsl(250_90%_65%/0.06)]" : ""}`}>
                    <td className="px-4 py-3 text-white font-bold">{row.preco}</td>
                    <td className="px-4 py-3 text-[hsl(220_10%_65%)]">{row.v5k}</td>
                    <td className="px-4 py-3 text-[hsl(168_100%_42%)] font-semibold">{row.v10k}</td>
                    <td className="px-4 py-3 text-[hsl(220_10%_55%)]">{row.leads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[hsl(220_10%_40%)]">* Estimativa para taxa de conversão de 2–3%, que é o mínimo esperado em oferta bem construída para audiência aquecida. Linha destacada = preço mais indicado para primeiros lançamentos.</p>
          <div className="rounded-xl border border-[hsl(250_90%_65%/0.3)] bg-[hsl(250_90%_65%/0.06)] p-4 text-sm text-[hsl(250_90%_75%)]">
            <strong>Insight importante:</strong> Para chegar a R$10k com um produto de R$297, você precisa de ~34 vendas — o que exige uma audiência de ~1.700 pessoas aquecidas (ou anúncios bem direcionados para uma lista de ~500 leads quentes). Se você está começando do zero, comece com R$497–R$997 e menos vagas.
          </div>
        </div>
      </section>

      {/* Capítulo 5 — 3 Estudos de caso */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[hsl(250_90%_65%)] text-white text-sm font-bold flex items-center justify-center">5</span>
          <h2 className="text-xl font-bold text-white">3 Estudos de Caso Reais</h2>
        </div>
        <div className="space-y-4">
          {[
            {
              nome: "Caso 1 — Personal Trainer sem audiência",
              tag: "Do zero",
              cor: "hsl(168_100%_42%)",
              contexto: "Rafael, 29 anos. Personal trainer em academia. 380 seguidores no Instagram. Nunca tinha vendido nada online.",
              problema: "Queria criar um app de treinos, levaria 3 meses e R$8.000 para desenvolver.",
              solucao: "Em vez disso: criou uma oferta de acompanhamento online por 60 dias a R$397. Postou um conteúdo sobre os 3 erros mais comuns em treinos caseiros. Abriu 10 vagas.",
              resultado: "9 vendas em 5 dias = R$3.573. Com esse capital, gravou um módulo por semana durante o período de acompanhamento. No segundo lançamento, 60 dias depois: 23 vendas.",
              aprendizado: "Vender antes de criar eliminou o risco. O produto foi desenvolvido com feedback dos primeiros clientes, tornando-se muito mais preciso.",
            },
            {
              nome: "Caso 2 — Nutricionista com audiência",
              tag: "Com base",
              cor: "hsl(250_90%_65%)",
              contexto: "Camila, 34 anos. Nutricionista clínica. 2.400 seguidores no Instagram. Já tinha perfil ativo mas nunca tinha monetizado.",
              problema: "Achava que precisava de um curso completo, um site profissional e uma identidade visual para lançar. Ficou 4 meses na fase de 'preparação'.",
              solucao: "Parou de preparar e lançou: um grupo no WhatsApp de 28 dias com cardápios semanais e acompanhamento a R$197/pessoa. Usou a bio do Instagram e três Stories.",
              resultado: "18 vendas no primeiro lançamento = R$3.546. No segundo (60 dias depois), com depoimentos: 41 vendas = R$8.077.",
              aprendizado: "A audiência já existia. O problema era a barreira mental de 'não estar pronta'. O produto mais simples possível testou o mercado — e o mercado respondeu.",
            },
            {
              nome: "Caso 3 — Contabilista sem rede social",
              tag: "Sem seguidores",
              cor: "hsl(45_100%_60%)",
              contexto: "Paulo, 41 anos. Contabilista com 22 anos de experiência. Nenhuma rede social. Lista de WhatsApp de 180 contatos (clientes e conhecidos).",
              problema: "Não queria aparecer. Não sabia nada de Instagram. Achava que marketing digital não era para o seu perfil.",
              solucao: "Criou um workshop online de 3h sobre 'Como declarar imposto de renda para MEI sem erros' a R$127. Divulgou apenas pelo WhatsApp pessoal e indicou para colegas divulgarem também.",
              resultado: "34 inscrições = R$4.318. Apresentou para uma turma ao vivo. Gravou e vendeu como gravação por mais 2 meses: mais 51 vendas = R$6.477 adicionais.",
              aprendizado: "Não precisa de rede social para começar. A lista quente de WhatsApp é o ativo mais subestimado do mercado. Workshop ao vivo vira produto perpétuo com uma gravação.",
            },
          ].map(caso => (
            <div key={caso.nome} className="card p-6 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h3 className="text-white font-bold text-base">{caso.nome}</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${caso.cor}20`, color: caso.cor, border: `1px solid ${caso.cor}40` }}>{caso.tag}</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg bg-[hsl(220_20%_8%)] p-3">
                  <p className="text-[hsl(220_10%_45%)] text-xs uppercase tracking-wider font-semibold mb-1">Contexto</p>
                  <p className="text-[hsl(220_10%_65%)]">{caso.contexto}</p>
                </div>
                <div className="rounded-lg bg-[hsl(0_90%_65%/0.06)] border border-[hsl(0_90%_65%/0.2)] p-3">
                  <p className="text-[hsl(0_90%_70%)] text-xs uppercase tracking-wider font-semibold mb-1">⚠ Erro inicial</p>
                  <p className="text-[hsl(220_10%_65%)]">{caso.problema}</p>
                </div>
                <div className="rounded-lg bg-[hsl(220_20%_8%)] p-3">
                  <p className="text-[hsl(250_90%_70%)] text-xs uppercase tracking-wider font-semibold mb-1">→ O que fez</p>
                  <p className="text-[hsl(220_10%_65%)]">{caso.solucao}</p>
                </div>
                <div className="rounded-lg bg-[hsl(168_100%_42%/0.06)] border border-[hsl(168_100%_42%/0.25)] p-3">
                  <p className="text-[hsl(168_100%_42%)] text-xs uppercase tracking-wider font-semibold mb-1">✓ Resultado</p>
                  <p className="text-white font-semibold">{caso.resultado}</p>
                </div>
                <div className="rounded-lg bg-[hsl(220_20%_8%)] p-3">
                  <p className="text-[hsl(220_10%_45%)] text-xs uppercase tracking-wider font-semibold mb-1">Aprendizado</p>
                  <p className="text-[hsl(220_10%_60%)] italic">{caso.aprendizado}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Conclusão */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xl font-bold text-white">O que fazer agora</h2>
        <p className="text-[hsl(220_10%_65%)] leading-relaxed">
          Você chegou até aqui. Isso já te coloca à frente de 90% das pessoas que baixam materiais e nunca chegam na última página.
        </p>
        <p className="text-[hsl(220_10%_65%)] leading-relaxed">
          O próximo passo é simples: abra o checklist do Dia 1 agora e complete as 5 tarefas. Não amanhã. Hoje.
        </p>
        <p className="text-[hsl(220_10%_65%)] leading-relaxed">
          Se você quiser ir além dos R$10k e entender como estruturar lançamentos de R$100k, R$500k e além — com estratégia, copy, automação e IA trabalhando por você — a Metodologia NexOS cobre isso em 10 módulos completos.
        </p>
        <button
          onClick={() => onNavigate("products")}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[hsl(250_90%_60%)] to-[hsl(270_80%_55%)] text-white font-bold hover:opacity-90 transition-opacity"
        >
          Conhecer a Metodologia NexOS Completa →
        </button>
      </section>

    </div>
  );
}
