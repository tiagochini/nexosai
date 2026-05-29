import { useState } from "react";
import { generateProtectedPDF } from "@/lib/generate-pdf";

const CAPTURE_KEY = "nexos-lead-captured";
const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/../../api";

// ── Grupo VIP ─────────────────────────────────────────────────────────────────
const WHATSAPP_GROUP_URL = "https://wa.me/message/NBJH4EXPAV2EN1";

interface Props {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

type Stage = "capture" | "guide";

const ERRORS = [
  {
    n: "01",
    titulo: "Postar para todo mundo — e não falar com ninguém",
    descricao: "Tem um conteúdo que agrada a todos e converte zero. Quando você tenta falar com 'quem quer crescer online', você não fala com ninguém de verdade. O algoritmo não é o seu problema — é a falta de um avatar tão específico que, ao ler seu post, a pessoa pensa: 'como ele sabe exatamente o que eu estou vivendo?'",
    aprofundamento: "A especificidade é contra-intuitiva. Parece que restringir o público vai diminuir o alcance. Na prática, é o oposto: quanto mais específico for o problema que você resolve, mais as pessoas certas te compartilham para outras pessoas certas. Um post para 'empreendedores' performa mediano. Um post para 'nutricionistas que querem sair do atendimento individual' viraliza dentro do nicho — e esse nicho te compra. Jonah Berger documenta em 'Contágio' (2013) que o principal motor de compartilhamento orgânico é identidade de grupo — e isso só acontece com especificidade de avatar.",
    exemplo: "Em 2004, Ramit Sethi era estudante universitário em Stanford quando começou a escrever sobre finanças pessoais para um avatar ultra-específico: 'jovens americanos de 20 e poucos anos que querem enriquecer devagar — sem MBA, sem herança, sem enrolação.' Quando amigos e professores sugeriram que ampliasse o escopo para 'finanças pessoais em geral', recusou. O blog cresceu especificamente por ser específico. Em 2009, 'I Will Teach You to Be Rich' (Workman Publishing) estreou na lista do New York Times — ainda falando com o mesmo avatar de 2004. (Fonte: iwillteachyoutoberich.com, arquivo público desde 2004 · NYT Bestseller verificável)\n\nNo Brasil, Nathalia Arcuri aplicou o mesmo princípio com o canal Me Poupe: um único avatar desde 2015 — 'brasileiros que querem organizar as finanças sem jargão de economista.' Manteve esse posicionamento mesmo quando o canal cresceu e a pressão para broadening aumentou. Resultado: mais de 10 milhões de inscritos verificáveis — sem nunca mudar o avatar. (Fonte: youtube.com/@mepoupe — dados públicos · Infomoney, 2019)",
    correcao: "Escreva a frase: 'Meu conteúdo é para [cargo/situação específica] que quer [resultado concreto] sem [sacrifício que detestam].' Se você travar na frase, seu posicionamento ainda não está pronto. Se a frase sair fácil, você tem o filtro para todo conteúdo que vai criar a partir de agora.",
    cor: "#f87171",
    icone: "🎯",
  },
  {
    n: "02",
    titulo: "Ensinar demais, conectar de menos",
    descricao: "O criador que só educa cria audiência de leitores. O criador que educa e se revela cria audiência de seguidores fiéis. Existe uma diferença brutal entre as duas: a primeira te lê enquanto você é útil. A segunda te segue enquanto você existe.",
    aprofundamento: "Conteúdo puramente educativo tem prazo de validade. Quando alguém aprende o que você ensina, não precisa mais de você. Mas quando você mostra o seu processo — seus erros, suas dúvidas, o que estava errado antes de acertar — você cria algo que nenhuma agente ou concorrente consegue copiar: a sua história. É isso que as pessoas compram quando compram de você. Brené Brown demonstrou empiricamente que conexão genuína exige exposição de imperfeição — e que tentar esconder fragilidade isola, não protege ('Daring Greatly', 2012).",
    exemplo: "James Clear era completamente desconhecido quando começou o blog jamesclear.com em 2012, escrevendo sobre hábitos a partir de sua própria experiência de recuperação de uma lesão grave. Ele não ensinava 'psicologia comportamental' de forma abstrata — narrava seu processo pessoal, seus erros reais, o que funcionava e o que não funcionava. Publicou revisões anuais com números de assinantes: 2012 lançamento, 2013 ~5.000, 2015 ~100.000, 2017 ~400.000. Em 2018, 'Atomic Habits' (Avery/Penguin Random House) tornou-se um dos livros de não-ficção mais vendidos da última década — mais de 15 milhões de cópias, mais de 100 semanas em listas de bestsellers. O livro existiu antes como blog pessoal. O blog cresceu porque ele se revelou, não apenas porque ensinou. (Fonte: jamesclear.com/annual-review — dados públicos · 'Atomic Habits' — James Clear, Avery, 2018 · NYT Bestseller verificável)",
    correcao: "A proporção que funciona: 60% ensino prático, 30% história pessoal e processo, 10% bastidores e vulnerabilidade calculada. 'Vulnerabilidade calculada' não é expor tudo — é escolher uma dificuldade real que seu avatar também vive, mostrar como você passou por ela, e extrair o aprendizado. Conecta sem overshare.",
    cor: "#fbbf24",
    icone: "🪞",
  },
  {
    n: "03",
    titulo: "Consistência de volume sem consistência de qualidade",
    descricao: "Ninguém te disse que postar todo dia é uma armadilha. O algoritmo recompensa frequência, mas a audiência recompensa impacto. Você pode postar 30 vezes por mês e encolher — ou postar 8 vezes e crescer 40%. A diferença não está na quantidade. Está em quantas vezes por mês você publicou algo que fez a pessoa parar o scroll e pensar.",
    aprofundamento: "Existe um fenômeno chamado 'fadiga de criador'. Quando você se compromete com volume antes de dominar a essência de cada peça, começa a produzir por obrigação — e sua audiência sente. Seth Godin, em 'Permission Marketing' (1999), demonstrou que a atenção do consumidor é o ativo mais escasso no mundo moderno — e que a forma mais rápida de destruí-la é entregando conteúdo que não valeu o tempo gasto. Um post feito com intenção transmite intenção. Um post feito com pressa transmite pressa.",
    exemplo: "Mark Manson tinha um blog de desenvolvimento pessoal com audiência modesta quando, em 2015, escreveu um artigo que considerou arriscado demais para publicar — contradizia completamente o que seus leitores esperavam dele. Segurou o texto por semanas. Quando finalmente publicou 'The Subtle Art of Not Giving a F*ck', o post acumulou milhões de visualizações e foi compartilhado em massa organicamente. O mesmo post tornou-se o livro publicado pela HarperOne (2016), que ficou mais de 100 semanas na lista do New York Times e vendeu mais de 12 milhões de cópias globalmente. Manson documentou em seu blog que não foi frequência que construiu isso — foi uma peça criada com total integridade, publicada apenas quando estava de fato pronta. (Fonte: markmanson.net/life-lessons · 'The Subtle Art of Not Giving a F*ck' — HarperOne, 2016 · NYT Bestseller verificável)",
    correcao: "Crie um banco de 'momentos de insight' — observe sua semana e anote quando algo te surpreendeu, quando um cliente disse algo revelador, quando você errou e entendeu o porquê. Esses momentos reais valem mais do que qualquer calendário editorial. Sua obrigação não é postar. É não deixar os momentos de impacto passarem sem registrar.",
    cor: "#a78bfa",
    icone: "⚡",
  },
  {
    n: "04",
    titulo: "O gancho que não para o scroll — os 3 primeiros segundos que decidem tudo",
    descricao: "Você pode ter o melhor conteúdo do mundo no segundo 0:30 de um vídeo. Se os primeiros 3 segundos não prenderem, ninguém vai chegar lá. O algoritmo mede o tempo de retenção desde o primeiro frame. Queda imediata = distribuição zero. O seu conteúdo não está sendo ignorado porque é ruim. Está sendo ignorado porque começa errado.",
    aprofundamento: "Existe uma anatomia do gancho que converte: (1) Uma afirmação que incomoda ou intriga. (2) Uma pergunta que o avatar faz para si mesmo toda semana. (3) Uma promessa de revelação de algo que 'poucos sabem'. Ganchos fracos começam com 'Hoje vou falar sobre...'. Ganchos fortes começam com o problema, a dor, a contradição ou a revelação — sem apresentação, sem introdução. Chip e Dan Heath chamam esse mecanismo de 'gap de curiosidade' em 'Feitas Para Durar' (2007): o cérebro fisicamente não consegue descansar com um loop cognitivo aberto.",
    exemplo: "Nuseir Yassin era recém-formado em Harvard e trabalhava em finanças quando decidiu, em abril de 2016, fazer um vídeo por dia durante 1.000 dias. Seus primeiros vídeos foram assistidos por menos de 300 pessoas. Em seu livro 'Around the World in 60 Seconds' (2020), documentou o momento exato em que identificou a variável que determinava o alcance: a frase de abertura. A mais impactante precisava ser a primeira — não a décima. Mudou apenas isso. A partir do vídeo 100, cada vídeo alcançava mais pessoas que o anterior. Ao completar os 1.000 dias, tinha mais de 14 milhões de seguidores no Facebook — documentados publicamente. O conteúdo de cada vídeo não mudou. Apenas os primeiros 5 segundos foram repensados. (Fonte: 'Around the World in 60 Seconds' — Nuseir Yassin, 2020 · facebook.com/nasdaily, dados verificáveis)",
    correcao: "Antes de publicar qualquer conteúdo, escreva os primeiros 15 segundos como se você estivesse respondendo a pergunta: 'O que eu diria se só tivesse 3 segundos para convencer essa pessoa a não sair?' Se a resposta não é o que você começa, inverta. Comece pelo mais forte. Sempre.",
    cor: "#34d399",
    icone: "🎣",
  },
  {
    n: "05",
    titulo: "Ignorar quem já te segue — e só pensar em crescer",
    descricao: "Você trata seus seguidores atuais como plateia e fica em busca de novos espectadores. Mas as pessoas que já te seguem são os seus melhores vendedores, depoentes e distribuidores — e a maioria dos criadores as ignora completamente depois do follow.",
    aprofundamento: "Existe uma matemática simples que poucos calculam: se 3% dos seus 5.000 seguidores te recomendam ativamente para uma pessoa cada, você ganha 150 novos seguidores por mês sem criar nada novo. Jay Abraham chama esse princípio de 'Strategy of Preeminence' em 'Getting Everything You Can Out of All You've Got' (2000): o criador que genuinamente se preocupa com quem já está na sua audiência cria defensores de marca — não apenas consumidores de conteúdo.",
    exemplo: "Pat Flynn (Smart Passive Income) documentou em seus Income Reports públicos que respondeu 100% das mensagens e comentários nos primeiros 18 meses — manualmente, sem equipe. No relatório de dezembro de 2013 (verificável em smartpassiveincome.com/income), sua receita atingiu US$203.000 no mês. Em análise publicada no próprio blog, identificou que a maioria dos compradores havia interagido individualmente com ele antes de comprar. O crescimento veio das conexões individuais — não de mais conteúdo novo. (Fonte: Smart Passive Income Income Reports, dez/2013 · SPI Podcast ep. 245, 'Why I Reply to Every Email', 2017)",
    correcao: "Reserve 20 minutos por dia para 'modo comunidade': responda comentários como se fossem conversas, não notificações. Mencione seguidores que compartilharam resultados. Faça enquetes reais com perguntas que você quer saber — não perguntas decorativas. A audiência que se sente vista cresce em silêncio e compra em voz alta.",
    cor: "#c084fc",
    icone: "🤝",
  },
  {
    n: "06",
    titulo: "Construir audiência em terreno alugado — sem capturar nada",
    descricao: "Você tem 4.000 seguidores no Instagram. Sabe quantos emails ou contatos de WhatsApp você tem dessas 4.000 pessoas? Se a resposta for 'poucos' ou 'nenhum', você está construindo um negócio em cima de um servidor que você não controla, com regras que mudam sem aviso, e alcance que cai toda semana.",
    aprofundamento: "A conta de como o algoritmo funciona é simples e brutal: posts orgânicos no Instagram chegam a 2–6% dos seus seguidores. Um email disparado para uma lista de 1.000 é aberto por 200–280 pessoas (taxa média 20–28%, dados Mailchimp 2023). Seth Godin nomeou esse princípio em 'Permission Marketing' (1999): comunicação com permissão explícita — sua lista — converte de 5 a 10x mais que interrupção algorítmica. E a lista não muda as regras sem aviso.",
    exemplo: "Darren Rowse, blogueiro australiano que construiu o ProBlogger e o Digital Photography School desde 2004, adotou desde o início uma estratégia que seus colegas achavam excessiva: email list como ativo central, redes sociais como canal de descoberta — nunca como canal principal. Em 2012, quando o Facebook reduziu o alcance orgânico de páginas de 16% para menos de 6% em seis meses, ele publicou abertamente em seu blog: seu negócio não sentiu o impacto. Toda a sua receita era gerada por interações com a lista de email — que ele controlava completamente. Outros criadores com duas ou três vezes mais seguidores perderam o contato com suas audiências da noite para o dia. A diferença não foi o número de seguidores. Foi quem era dono do canal. (Fonte: problogger.com, arquivo público desde 2004 · 'ProBlogger: Secrets for Blogging Your Way to a Six-Figure Income' — Rowse & Garrett, Wiley)",
    correcao: "Crie uma isca digital simples — um checklist, um mini-guia, um template — e coloque o link na bio com uma frase de valor claro. Toda semana, mencione nos stories que a isca existe. Com isso, você transforma seguidores em contatos que são seus — independente de qualquer plataforma.",
    cor: "#fb923c",
    icone: "🔒",
  },
  {
    n: "07",
    titulo: "Medir as métricas que não pagam boleto",
    descricao: "Você comemora quando um post bomba em likes e fica frustrado quando não. Mas likes não pagam boleto. Salvamentos e compartilhamentos indicam valor real. Cliques no link indicam intenção. Leads capturados indicam futuro comprador. A métrica que você acompanha determina o tipo de conteúdo que você cria — e o tipo de audiência que você constrói.",
    aprofundamento: "Existe uma hierarquia de métricas que separa criadores que constroem audiência para crescer dos que constroem audiência para vender: Curtidas (vaidade) → Comentários (engajamento) → Salvamentos (valor percebido) → Compartilhamentos (confiança) → Cliques (intenção) → Leads (futura receita). Claude Hopkins foi o primeiro a sistematizar esse raciocínio em 'A Publicidade Científica' (1923): 'Meça resultados reais, não impressões.' A frase tem 100 anos e ainda é ignorada pela maioria.",
    exemplo: "O Content Marketing Institute publicou em sua pesquisa anual de 2023 — conduzida com mais de 1.700 profissionais de marketing em 92 países — que criadores e empresas que acompanham métricas de conversão (leads gerados, salvamentos, cliques com intenção) atingem metas de receita 3,8× mais frequentemente do que os que medem apenas alcance e curtidas. A métrica que você persegue molda o conteúdo que você cria — e o conteúdo molda a audiência que você constrói. (Fonte: Content Marketing Institute, 'B2C Content Marketing Benchmarks, Budgets, and Trends 2023', contentmarketinginstitute.com)",
    correcao: "Toda semana, abra as métricas e responda: quais posts tiveram mais salvamentos? Quais geraram mais cliques no link? Quais vieram acompanhados de DM espontânea? Esse é o seu mapa do que criar mais. O resto é dado decorativo.",
    cor: "#f87171",
    icone: "📊",
  },
];

const CHECKLIST_ITEMS = [
  "Meu posicionamento é específico o suficiente para excluir quem não é meu cliente ideal",
  "Meu conteúdo tem pelo menos 30% de história pessoal e processo — não só ensino",
  "Cada publicação começa pelos 3 segundos mais fortes — não por apresentação",
  "Tenho um ritual semanal de responder DMs e comentários como conversa real",
  "Tenho uma isca digital ativa e coleto emails ou contatos além de seguidores",
  "Acompanho salvamentos e cliques — não só likes e visualizações",
  "Sei exatamente para quem falo: o cargo, a dor, o resultado e o sacrifício que querem evitar",
];

const VALUE_CONTENT = {
  titulo: "O Framework do Gancho em 3 Camadas",
  subtitulo: "Como escrever os primeiros 15 segundos de qualquer conteúdo para que o algoritmo — e a pessoa — não consigam parar",
  intro: "Você pode ter o melhor conteúdo do mundo. Se os primeiros 3 segundos não prenderem, o algoritmo entende que ninguém quer assistir — e para de distribuir. Aqui está o framework que os maiores criadores usam, com ou sem consciência:",
  camadas: [
    {
      numero: "Camada 1",
      nome: "O Padrão de Interrupção",
      desc: "Comece com algo que quebre a expectativa. Uma afirmação que contraria o que a pessoa acredita, um dado que surpreende, uma pergunta que ela faz para si mesma toda semana mas nunca viu ninguém responder diretamente.",
      exemplos_fracos: ["'Hoje vou falar sobre crescimento no Instagram...'", "'Dica número 1 para aumentar sua audiência...'", "'Olá pessoal, tudo bem? Hoje trago...'"],
      exemplos_fortes: ["'Você está crescendo errado — e o algoritmo está te mostrando isso.'", "'3.200 seguidores. Zero vendas. Aqui está o que eu não entendia.'", "'O criador que posta todo dia e não cresce está cometendo esse erro específico.'"],
      cor: "#f87171",
    },
    {
      numero: "Camada 2",
      nome: "A Promessa de Revelação",
      desc: "Depois do padrão de interrupção, você tem 5 segundos para entregar a promessa do que vai ser revelado. Não o que você vai ensinar — o que a pessoa vai conseguir entender, fazer ou evitar depois de consumir o conteúdo.",
      exemplos_fracos: ["'Nesse vídeo vou explicar como funciona o algoritmo.'", "'Vou compartilhar algumas dicas que aprendi.'"],
      exemplos_fortes: ["'Em 90 segundos você vai entender por que seu alcance caiu — e a correção não exige nenhum novo conteúdo.'", "'Vou te mostrar o padrão exato dos posts que geram salvamentos — com 3 exemplos que você pode copiar hoje.'"],
      cor: "#34d399",
    },
    {
      numero: "Camada 3",
      nome: "O Prêmio da Continuidade",
      desc: "Logo no início — não no final — sinalize que tem algo ainda mais valioso chegando. Isso retém quem está decidindo se vai continuar. É o que os roteiristas de séries chamam de 'próximo episódio' inserido no começo, não no fim.",
      exemplos_fracos: ["'Fica até o final que tem uma dica especial.'", "'Não sai que tem um bônus.'"],
      exemplos_fortes: ["'E no final vou mostrar o formato exato que uso nos posts que mais convertem — que não é o que a maioria acha que é.'", "'Antes de terminar, vou te dar o template que uso antes de publicar qualquer coisa — simples, mas elimina o principal erro.'"],
      cor: "#a78bfa",
    },
  ],
  template: {
    titulo: "Template de Gancho Pronto para Usar",
    estrutura: "[AFIRMAÇÃO QUE CONTRARIA UMA CRENÇA COMUM] + [PROMESSA ESPECÍFICA DO QUE VÃO APRENDER] + [SINALIZAÇÃO DO QUE VEM NO FINAL]",
    exemplo_completo: "\"A maioria das pessoas está construindo audiência para crescer — e por isso não vende. [pausa] Nesse conteúdo eu vou te mostrar a diferença entre audiência de alcance e audiência de compra — e como virar essa chave sem trocar o que você já cria. [pausa] E no final, o teste de 3 perguntas que eu faço antes de publicar qualquer coisa para saber se vai converter ou só viralizar.\"",
  },
};

function CaptureStage({ onCapture }: { onCapture: (name: string, email: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    setErrorMsg("");
    try {
      await fetch(`${API_BASE}/academy/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: whatsapp.trim() || undefined,
          source: "lead_magnet_guia_audiencia",
        }),
      });
      localStorage.setItem(CAPTURE_KEY, JSON.stringify({ name: name.trim(), email: email.trim() }));
      onCapture(name.trim(), email.trim().toLowerCase());
    } catch {
      setErrorMsg("Erro ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(135deg, hsl(222 25% 5%) 0%, hsl(250 30% 8%) 50%, hsl(222 25% 5%) 100%)" }}
    >
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-bold uppercase tracking-widest"
            style={{ background: "hsl(250 90% 60% / 0.15)", color: "hsl(250 90% 75%)", border: "1px solid hsl(250 90% 60% / 0.3)" }}>
            NexOS Academy · Diagnóstico Gratuito
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            O Motivo Real por Que Sua Audiência Não Cresce —{" "}
            <span style={{ background: "linear-gradient(135deg, hsl(250 90% 70%), hsl(270 80% 65%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              e Não É o Algoritmo
            </span>
          </h1>

          <p className="text-lg text-[hsl(220_10%_65%)] leading-relaxed mb-6">
            7 padrões que travam criadores consistentes — com casos reais, diagnóstico e o Framework do Gancho em 3 Camadas que os que crescem de verdade aplicam (e quase ninguém fala).
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {["⚠️ 7 erros com casos reais", "🎣 Framework do Gancho", "✅ Checklist de diagnóstico", "⬇️ Download em PDF"].map(item => (
              <span key={item} className="text-sm text-[hsl(220_10%_55%)] bg-[hsl(220_20%_8%)] px-4 py-1.5 rounded-full border border-[hsl(220_20%_13%)]">
                {item}
              </span>
            ))}
          </div>

          <p className="text-sm text-[hsl(220_10%_40%)] mb-4">
            Mais de <strong className="text-[hsl(220_10%_60%)]">2.400 criadores</strong> já usaram esse diagnóstico para identificar o que estava travando o crescimento.
          </p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "hsl(222 25% 7%)", border: "1px solid hsl(250 90% 60% / 0.2)" }}>
          <h2 className="text-lg font-bold text-white mb-1">Acesso imediato — leva 30 segundos</h2>
          <p className="text-sm text-[hsl(220_10%_50%)] mb-6">Preencha abaixo e receba o diagnóstico completo agora.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[hsl(220_10%_50%)] uppercase tracking-widest mb-1.5">
                Seu nome
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Como você se chama?"
                className="w-full px-4 py-3 rounded-xl border text-white placeholder-[hsl(220_10%_30%)] text-sm focus:outline-none transition-all"
                style={{ background: "hsl(222 25% 5%)", borderColor: "hsl(220 20% 14%)" }}
                onFocus={e => (e.target.style.borderColor = "hsl(250 90% 60% / 0.6)")}
                onBlur={e => (e.target.style.borderColor = "hsl(220 20% 14%)")}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(220_10%_50%)] uppercase tracking-widest mb-1.5">
                Seu melhor email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full px-4 py-3 rounded-xl border text-white placeholder-[hsl(220_10%_30%)] text-sm focus:outline-none transition-all"
                style={{ background: "hsl(222 25% 5%)", borderColor: "hsl(220 20% 14%)" }}
                onFocus={e => (e.target.style.borderColor = "hsl(250 90% 60% / 0.6)")}
                onBlur={e => (e.target.style.borderColor = "hsl(220 20% 14%)")}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(220_10%_50%)] uppercase tracking-widest mb-1.5">
                WhatsApp <span className="normal-case text-[hsl(220_10%_35%)] font-normal">(opcional)</span>
              </label>
              <input
                type="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full px-4 py-3 rounded-xl border text-white placeholder-[hsl(220_10%_30%)] text-sm focus:outline-none transition-all"
                style={{ background: "hsl(222 25% 5%)", borderColor: "hsl(220 20% 14%)" }}
                onFocus={e => (e.target.style.borderColor = "hsl(250 90% 60% / 0.6)")}
                onBlur={e => (e.target.style.borderColor = "hsl(220 20% 14%)")}
              />
            </div>

            {errorMsg && <p className="text-sm text-red-400 text-center">{errorMsg}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-white font-bold text-base tracking-wide transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 mt-2"
              style={{ background: "linear-gradient(135deg, hsl(250 90% 58%), hsl(270 80% 52%))" }}
            >
              {loading ? "Processando..." : "Quero o Diagnóstico Completo →"}
            </button>

            <p className="text-xs text-center text-[hsl(220_10%_35%)] pt-1">
              🔒 Seus dados estão seguros. Acesso imediato, sem spam.
            </p>
          </form>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs text-[hsl(220_10%_40%)]">
          <span>✓ Acesso imediato</span>
          <span>✓ 100% gratuito</span>
          <span>✓ Sem cartão de crédito</span>
        </div>
      </div>
    </div>
  );
}

function GuideStage({ onNavigate, leadName, leadEmail }: { onNavigate: (page: string, params?: Record<string, string>) => void; leadName: string; leadEmail: string }) {
  const [generating, setGenerating] = useState(false);

  async function handleDownloadPDF() {
    setGenerating(true);
    try {
      await generateProtectedPDF(leadName || "Usuário", leadEmail || "usuario@nexosacademy.com");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #pdf-guide, #pdf-guide * { visibility: visible !important; }
          #pdf-guide { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: #111 !important; }
          .no-print { display: none !important; }
          .pdf-error-card { background: #fff5f5 !important; border: 1px solid #fca5a5 !important; }
          .pdf-fix-card { background: #f0fdf4 !important; border: 1px solid #86efac !important; }
          h1, h2, h3 { color: #111 !important; }
          p, span, li, label { color: #333 !important; }
          .pdf-header { background: #1e1b4b !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>

      <div id="pdf-guide" className="max-w-3xl mx-auto space-y-8 pb-16">

        <div className="pdf-header rounded-2xl p-6 flex items-center justify-between gap-4"
          style={{ background: "linear-gradient(135deg, hsl(250 40% 15%), hsl(250 30% 10%))", border: "1px solid hsl(250 90% 60% / 0.3)" }}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full text-white"
                style={{ background: "hsl(250 90% 60% / 0.3)", border: "1px solid hsl(250 90% 60% / 0.4)" }}>
                🎁 Guia Gratuito
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white leading-snug">
              Os 7 Erros que Travam o Crescimento da Sua Audiência
            </h1>
            <p className="text-sm text-[hsl(220_10%_60%)] mt-1">
              {leadName ? `Preparado para ${leadName} · ` : ""}NexOS Academy · agencianexos.vip
            </p>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={generating}
            className="no-print shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: "hsl(250 90% 58%)", border: "1px solid hsl(250 90% 70% / 0.4)" }}
          >
            {generating ? "⏳ Gerando..." : "↓ Baixar PDF"}
          </button>
        </div>

        {/* ── Botão do Grupo VIP ───────────────────────────────────────────── */}
        <div className="no-print rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4"
          style={{ background: "linear-gradient(135deg, hsl(142 70% 8%), hsl(142 60% 6%))", border: "1px solid hsl(142 70% 40% / 0.3)" }}>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color: "hsl(142 70% 55%)" }}>💬 Grupo VIP — NexOS Academy</p>
            <p className="text-white font-semibold text-sm">
              Entre no grupo exclusivo com conteúdo diário, dúvidas e acesso antecipado.
            </p>
          </div>
          {WHATSAPP_GROUP_URL ? (
            <a
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-6 py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, hsl(142 70% 38%), hsl(142 60% 28%))" }}
            >
              Quero entrar no grupo →
            </a>
          ) : (
            <span
              className="shrink-0 px-6 py-3 rounded-xl text-sm font-bold cursor-not-allowed"
              style={{ background: "hsl(220 20% 10%)", color: "hsl(220 10% 35%)", border: "1px solid hsl(220 20% 14%)" }}
              title="Em breve"
            >
              Em breve...
            </span>
          )}
        </div>

        <section className="card p-6 space-y-3">
          <h2 className="text-lg font-bold text-white">Por que criadores com conteúdo bom ficam estagnados?</h2>
          <p className="text-[hsl(220_10%_65%)] leading-relaxed text-sm">
            Não é o algoritmo. Não é o nicho saturado. Não é falta de consistência. É porque existe um conjunto de erros específicos que criam o teto do crescimento — e a maioria dos criadores comete todos eles ao mesmo tempo, sem saber que são esses os freios.
          </p>
          <p className="text-[hsl(220_10%_65%)] leading-relaxed text-sm">
            Cada erro neste guia vem acompanhado de como ele acontece na prática, um caso real com números e contexto, e a correção exata — não uma dica genérica, mas o que fazer diferente na próxima publicação.
          </p>
          <div className="rounded-xl p-4 text-sm mt-2" style={{ background: "hsl(250 90% 60% / 0.08)", border: "1px solid hsl(250 90% 60% / 0.2)" }}>
            <p className="text-[hsl(250 90% 80%)] font-semibold text-xs uppercase tracking-wider mb-1">📌 Nota antes de começar</p>
            <p className="text-[hsl(220_10%_65%)] leading-relaxed">
              Ao final deste guia, você vai encontrar o <strong className="text-white">Framework do Gancho em 3 Camadas</strong> — o método para escrever os primeiros 15 segundos de qualquer conteúdo que prende o algoritmo e a pessoa ao mesmo tempo. Com template pronto para usar.
            </p>
          </div>
        </section>

        <section className="space-y-5">
          {ERRORS.map(erro => (
            <div key={erro.n} className="card p-6 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl font-extrabold shrink-0" style={{ color: erro.cor }}>{erro.icone}</span>
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: erro.cor }}>Erro #{erro.n}</span>
                  <h3 className="text-white font-bold text-base leading-tight mt-0.5">{erro.titulo}</h3>
                </div>
              </div>
              <p className="text-[hsl(220_10%_65%)] leading-relaxed text-sm">{erro.descricao}</p>

              <div className="rounded-xl p-4 text-sm" style={{ background: "hsl(250 90% 60% / 0.05)", border: "1px solid hsl(250 90% 60% / 0.15)" }}>
                <p className="font-semibold text-xs uppercase tracking-wider mb-1.5" style={{ color: "hsl(250 90% 75%)" }}>↗ Por que isso acontece</p>
                <p className="text-[hsl(220_10%_65%)] leading-relaxed">{erro.aprofundamento}</p>
              </div>

              <div className="pdf-error-card rounded-xl p-4 text-sm" style={{ background: "hsl(0 90% 65% / 0.05)", border: "1px solid hsl(0 90% 65% / 0.15)" }}>
                <p className="font-semibold text-xs uppercase tracking-wider mb-1.5" style={{ color: "hsl(0 90% 70%)" }}>📍 Caso real</p>
                <p className="text-[hsl(220_10%_65%)] leading-relaxed italic">{erro.exemplo}</p>
              </div>

              <div className="pdf-fix-card rounded-xl p-4 text-sm" style={{ background: "hsl(168 100% 42% / 0.05)", border: "1px solid hsl(168 100% 42% / 0.2)" }}>
                <p className="font-semibold text-xs uppercase tracking-wider mb-1.5" style={{ color: "hsl(168 100% 55%)" }}>✓ O que fazer</p>
                <p className="text-[hsl(220_10%_65%)] leading-relaxed">{erro.correcao}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Checklist de Diagnóstico</h2>
          <p className="text-[hsl(220_10%_65%)] text-sm">Responda honestamente sobre sua estratégia de conteúdo atual:</p>
          <div className="space-y-3">
            {CHECKLIST_ITEMS.map((item, i) => (
              <label key={i} className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" className="mt-0.5 w-4 h-4 rounded shrink-0" style={{ accentColor: "hsl(250 90% 65%)" }} />
                <span className="text-sm text-[hsl(220_10%_65%)] group-hover:text-white transition-colors leading-relaxed">{item}</span>
              </label>
            ))}
          </div>
          <div className="pt-3 border-t border-[hsl(220_20%_12%)] text-xs text-[hsl(220_10%_40%)] space-y-0.5">
            <p>Se marcou menos de 4: os erros estão ativos e travando seu crescimento agora.</p>
            <p>Se marcou 4–5: você tem base — os ajustes são pontuais e de alto impacto.</p>
            <p>Se marcou 6–7: você está pronto para escalar — foque no volume com qualidade.</p>
          </div>
        </section>

        <section className="card p-6 space-y-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "hsl(250 90% 75%)" }}>🎣 Conteúdo de valor incluído</span>
            <h2 className="text-xl font-bold text-white mt-1">{VALUE_CONTENT.titulo}</h2>
            <p className="text-[hsl(220_10%_55%)] text-sm mt-1">{VALUE_CONTENT.subtitulo}</p>
          </div>

          <p className="text-[hsl(220_10%_65%)] leading-relaxed text-sm">{VALUE_CONTENT.intro}</p>

          <div className="space-y-4">
            {VALUE_CONTENT.camadas.map(camada => (
              <div key={camada.numero} className="rounded-xl p-5 space-y-3" style={{ background: "hsl(222 25% 6%)", border: `1px solid ${camada.cor}30` }}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: camada.cor }}>{camada.numero}</span>
                  <h3 className="text-white font-bold text-sm mt-0.5">{camada.nome}</h3>
                </div>
                <p className="text-[hsl(220_10%_65%)] text-sm leading-relaxed">{camada.desc}</p>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-lg p-3" style={{ background: "hsl(0 90% 65% / 0.05)", border: "1px solid hsl(0 90% 65% / 0.15)" }}>
                    <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2">✗ Fraco</p>
                    <div className="space-y-1">
                      {camada.exemplos_fracos.map((ex, i) => (
                        <p key={i} className="text-xs text-[hsl(220_10%_50%)] italic">{ex}</p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg p-3" style={{ background: "hsl(168 100% 42% / 0.05)", border: "1px solid hsl(168 100% 42% / 0.2)" }}>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">✓ Forte</p>
                    <div className="space-y-1">
                      {camada.exemplos_fortes.map((ex, i) => (
                        <p key={i} className="text-xs text-[hsl(220_10%_65%)] italic">{ex}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-5 space-y-3" style={{ background: "linear-gradient(135deg, hsl(250 40% 8%), hsl(270 30% 7%))", border: "1px solid hsl(250 90% 60% / 0.3)" }}>
            <h3 className="text-white font-bold text-sm">{VALUE_CONTENT.template.titulo}</h3>
            <div className="rounded-lg p-3" style={{ background: "hsl(250 90% 60% / 0.1)", border: "1px solid hsl(250 90% 60% / 0.2)" }}>
              <p className="text-xs font-mono text-[hsl(250 90% 80%)] font-bold">{VALUE_CONTENT.template.estrutura}</p>
            </div>
            <div className="rounded-lg p-4" style={{ background: "hsl(222 25% 5%)", border: "1px solid hsl(220 20% 12%)" }}>
              <p className="text-xs font-bold uppercase tracking-wider text-[hsl(220_10%_40%)] mb-2">Exemplo completo</p>
              <p className="text-sm text-[hsl(220_10%_70%)] leading-relaxed italic">{VALUE_CONTENT.template.exemplo_completo}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl p-6 space-y-4" style={{ background: "hsl(222 25% 5%)", border: "1px solid hsl(220 20% 10%)" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📚</span>
            <h2 className="text-base font-bold text-white">Base Bibliográfica</h2>
          </div>
          <p className="text-xs text-[hsl(220_10%_45%)] leading-relaxed">
            Os conceitos deste guia têm fontes verificáveis. Se quiser aprofundar, estes são os livros que embasam cada princípio:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { autor: "Jonah Berger", titulo: "Contágio: Por Que as Coisas Pegam", ano: "2013", detalhe: "Erro 01 — especificidade e compartilhamento orgânico" },
              { autor: "Brené Brown", titulo: "Daring Greatly", ano: "2012", detalhe: "Erro 02 — vulnerabilidade e conexão genuína" },
              { autor: "Seth Godin", titulo: "Permission Marketing", ano: "1999", detalhe: "Erros 03 e 06 — qualidade de atenção e lista própria" },
              { autor: "Chip & Dan Heath", titulo: "Feitas Para Durar (Made to Stick)", ano: "2007", detalhe: "Erro 04 — gap de curiosidade e ganchos memoráveis" },
              { autor: "Jay Abraham", titulo: "Getting Everything You Can Out of All You've Got", ano: "2000", detalhe: "Erro 05 — Strategy of Preeminence e LTV" },
              { autor: "Claude Hopkins", titulo: "A Publicidade Científica", ano: "1923", detalhe: "Erro 07 — medir resultados reais, não impressões" },
              { autor: "Robert Cialdini", titulo: "As Armas da Persuasão", ano: "1984", detalhe: "Gatilhos mentais e atalhos cognitivos" },
              { autor: "Daniel Kahneman", titulo: "Rápido e Devagar (Thinking, Fast and Slow)", ano: "2011", detalhe: "Sistema 1 / Sistema 2 e decisão de compra" },
            ].map((livro, i) => (
              <div key={i} className="rounded-lg p-3 space-y-0.5" style={{ background: "hsl(220 20% 7%)", border: "1px solid hsl(220 20% 12%)" }}>
                <p className="text-xs font-bold text-white leading-snug">{livro.titulo}</p>
                <p className="text-xs text-[hsl(220_10%_45%)]">{livro.autor} · {livro.ano}</p>
                <p className="text-xs text-[hsl(220_10%_35%)] italic">{livro.detalhe}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="no-print rounded-2xl overflow-hidden"
          style={{ border: "1px solid hsl(168 100% 42% / 0.35)", boxShadow: "0 0 40px hsl(168 100% 42% / 0.06)" }}>
          <div className="px-8 pt-6 pb-2 text-center"
            style={{ background: "linear-gradient(135deg, hsl(168 100% 10% / 0.5), hsl(250 30% 8%))" }}>
            <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3"
              style={{ background: "hsl(168 100% 42% / 0.15)", color: "hsl(168 100% 60%)", border: "1px solid hsl(168 100% 42% / 0.3)" }}>
              🔥 Próximo Passo Natural
            </span>
            <h2 className="text-2xl font-extrabold text-white leading-tight mb-2">
              Mapa dos Primeiros R$10K em Vendas Online
            </h2>
            <p className="text-[hsl(220_10%_60%)] text-sm max-w-lg mx-auto mb-4">
              Você acabou de ver os 7 erros. Agora veja o caminho completo: 10 capítulos operacionais com scripts de copy prontos, checklist de 7 dias e a estratégia para chegar aos primeiros 5 dígitos — mesmo sem produto, sem seguidores, sem equipe.
            </p>
          </div>

          <div className="px-8 py-5" style={{ background: "hsl(222 25% 6%)" }}>
            <div className="grid sm:grid-cols-2 gap-3 mb-5">
              {[
                "10 capítulos práticos — sem teoria vaga",
                "Scripts de copy prontos para usar agora",
                "Checklist de 7 dias: 1 cliente em 7 dias",
                "Estratégia 'Sem Seguidores' para quem está no zero",
                "Matador de objeções com respostas exatas",
                "Produto Escada: de R$97 até R$10K no mesmo funil",
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-[hsl(220_10%_70%)]">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs shrink-0"
                    style={{ background: "hsl(168 100% 42% / 0.15)", color: "hsl(168 100% 55%)" }}>✓</span>
                  {f}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="text-center sm:text-left">
                <span className="text-xs text-[hsl(220_10%_40%)] line-through">R$299</span>
                <span className="text-xs text-[hsl(168_100%_50%)] ml-2">67% off</span>
                <div className="text-3xl font-extrabold" style={{ background: "linear-gradient(135deg, hsl(168 100% 50%), hsl(168 100% 40%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  R$97
                </div>
                <p className="text-xs text-[hsl(220_10%_40%)]">pagamento único · acesso imediato</p>
              </div>
              <button
                onClick={() => onNavigate("products")}
                className="flex-1 sm:flex-none py-3 px-8 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, hsl(168 100% 38%), hsl(168 100% 30%))" }}
              >
                Quero o Mapa Completo — R$97 →
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={generating}
                className="text-xs text-[hsl(220_10%_40%)] hover:text-[hsl(220_10%_60%)] transition-colors disabled:opacity-50"
              >
                {generating ? "⏳ Gerando..." : "↓ Salvar PDF"}
              </button>
            </div>

            <p className="text-xs text-center text-[hsl(220_10%_35%)] mt-3">
              🔒 Garantia de 30 dias · Acesso imediato após o pagamento
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export default function LeadMagnet({ onNavigate }: Props) {
  const existing = (() => {
    try { return JSON.parse(localStorage.getItem(CAPTURE_KEY) ?? "null") as { name: string; email: string } | null; } catch { return null; }
  })();

  const [stage, setStage] = useState<Stage>(existing ? "guide" : "capture");
  const [leadName, setLeadName] = useState<string>(existing?.name ?? "");
  const [leadEmail, setLeadEmail] = useState<string>(existing?.email ?? "");

  function handleCapture(name: string, email: string) {
    setLeadName(name);
    setLeadEmail(email);
    setStage("guide");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (stage === "capture") return <CaptureStage onCapture={handleCapture} />;
  return <GuideStage onNavigate={onNavigate} leadName={leadName} leadEmail={leadEmail} />;
}
