import Watermark from "@/components/Watermark";

interface FreeGuideProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const ERRORS = [
  {
    n: "01",
    titulo: "Postar para todo mundo — e não falar com ninguém",
    descricao: "Tem um conteúdo que agrada a todos e converte zero. Quando você tenta falar com 'quem quer crescer online', você não fala com ninguém de verdade. O algoritmo não é o seu problema — é a falta de um avatar tão específico que, ao ler seu post, a pessoa pensa: 'como ele sabe exatamente o que eu estou vivendo?'",
    aprofundamento: "A especificidade é contra-intuitiva. Parece que restringir o público vai diminuir o alcance. Na prática, é o oposto: quanto mais específico for o problema que você resolve, mais as pessoas certas te compartilham para outras pessoas certas. Um post para 'empreendedores' performa mediano. Um post para 'nutricionistas que querem sair do atendimento individual' viraliza dentro do nicho — e esse nicho te compra.",
    exemplo: "Felipe criava conteúdo de 'saúde e bem-estar' há 11 meses. 1.200 seguidores, engajamento morto. Quando mudou o posicionamento para 'homens acima dos 40 que querem emagrecer sem abrir mão de churrasco e cerveja no fim de semana', foi de 1.200 para 8.400 seguidores em 4 meses — e vendeu R$34k no primeiro lançamento.",
    correcao: "Escreva a frase: 'Meu conteúdo é para [cargo/situação específica] que quer [resultado concreto] sem [sacrifício que detestam].' Se você travar na frase, seu posicionamento ainda não está pronto. Se sair fácil, você tem o filtro para todo conteúdo que vai criar.",
    cor: "hsl(0_90%_65%)",
    icone: "🎯",
  },
  {
    n: "02",
    titulo: "Ensinar demais, conectar de menos",
    descricao: "O criador que só educa cria audiência de leitores. O criador que educa e se revela cria audiência de seguidores fiéis. A diferença é brutal: a primeira te lê enquanto você é útil. A segunda te segue enquanto você existe.",
    aprofundamento: "Conteúdo puramente educativo tem prazo de validade. Quando alguém aprende o que você ensina, não precisa mais de você. Mas quando você mostra seu processo — seus erros, suas dúvidas, o que estava errado antes de acertar — você cria algo que nenhuma equipe especializada ou concorrente consegue copiar: a sua história. É isso que as pessoas compram quando compram de você. Não o conhecimento. A versão de você que acredita que elas conseguem.",
    exemplo: "Camila ensinava design para iniciantes com posts de dicas e tutoriais. Platôu em 3.200 seguidores. Publicou um carrossel 'Os 3 projetos que me envergonham hoje — e o que cada um me ensinou'. Foi compartilhado 847 vezes. Ganhou 1.100 seguidores naquela semana. O conteúdo educativo não mudou. O que mudou foi a humanidade por trás.",
    correcao: "A proporção que funciona: 60% ensino prático, 30% história pessoal e processo, 10% bastidores e vulnerabilidade calculada. 'Vulnerabilidade calculada' não é expor tudo — é escolher uma dificuldade real que seu avatar também vive, mostrar como você passou por ela, e extrair o aprendizado.",
    cor: "hsl(45_100%_60%)",
    icone: "🪞",
  },
  {
    n: "03",
    titulo: "Consistência de volume sem consistência de qualidade",
    descricao: "Ninguém te disse que postar todo dia é uma armadilha. O algoritmo recompensa frequência, mas a audiência recompensa impacto. Você pode postar 30 vezes por mês e encolher — ou postar 8 vezes e crescer 40%. A diferença não está na quantidade. Está em quantas vezes por mês você publicou algo que fez a pessoa parar o scroll.",
    aprofundamento: "Existe um fenômeno chamado fadiga de criador. Quando você se compromete com volume antes de dominar a essência de cada peça, começa a produzir por obrigação — e sua audiência sente. Um post feito com pressa transmite pressa. Um post feito com intenção transmite intenção. O criador que publica 10 posts impactantes fatura mais do que o que publica 30 posts medianos.",
    exemplo: "Renata postava stories todos os dias às 8h, 12h e 19h. Crescia 80 seguidores por mês. Quando parou a planilha e passou a publicar apenas quando tinha algo real para dizer — uma descoberta, um caso de aluno, um erro —, foi para 400 seguidores por mês. Menos posts, mais crescimento.",
    correcao: "Crie um banco de 'momentos de insight' — anote quando algo te surpreendeu, quando um cliente disse algo revelador, quando você errou e entendeu o porquê. Esses momentos reais valem mais do que qualquer calendário editorial. Sua obrigação não é postar. É não deixar os momentos de impacto passarem sem registrar.",
    cor: "hsl(250_90%_65%)",
    icone: "⚡",
  },
  {
    n: "04",
    titulo: "O gancho que não para o scroll — os 3 primeiros segundos que decidem tudo",
    descricao: "Você pode ter o melhor conteúdo do mundo no segundo 0:30. Se os primeiros 3 segundos não prenderem, ninguém vai chegar lá. O algoritmo mede retenção desde o primeiro frame. Queda imediata = distribuição zero. Seu conteúdo não está sendo ignorado porque é ruim. Está sendo ignorado porque começa errado.",
    aprofundamento: "Existe uma anatomia do gancho que converte: (1) Uma afirmação que incomoda ou intriga. (2) Uma pergunta que o avatar faz para si mesmo toda semana. (3) Uma promessa de revelação de algo que poucos sabem. Ganchos fracos começam com 'Hoje vou falar sobre...'. Ganchos fortes começam com o problema, a dor, a contradição ou a revelação — sem apresentação, sem setup.",
    exemplo: "Daniel começava todos os vídeos com 'Olá galera, hoje trago mais um conteúdo sobre...' Média de retenção: 22%. Reformulou o início: começava direto na frase mais forte — a virada, o dado surpreendente, a afirmação controversa. Retenção foi para 61%. O mesmo conteúdo. Apenas os primeiros 8 segundos mudaram.",
    correcao: "Antes de publicar, escreva os primeiros 15 segundos como se estivesse respondendo: 'O que eu diria se só tivesse 3 segundos para convencer essa pessoa a não sair?' Se a resposta não é como você começa, inverta. Comece pelo mais forte. Sempre.",
    cor: "hsl(168_100%_42%)",
    icone: "🎣",
  },
  {
    n: "05",
    titulo: "Ignorar quem já te segue — e só pensar em crescer",
    descricao: "Você trata seus seguidores atuais como plateia e fica em busca de novos espectadores. Mas as pessoas que já te seguem são seus melhores vendedores, depoentes e distribuidores — e a maioria dos criadores as ignora completamente depois do follow.",
    aprofundamento: "A matemática simples: se 3% dos seus 5.000 seguidores te recomendam para uma pessoa cada, você ganha 150 novos seguidores por mês sem criar nada novo. Para 3% recomendar, precisam ter tido uma experiência de conexão real. Isso acontece quando você responde DMs, menciona comentaristas pelo nome em novos conteúdos, cria para quem já está lá.",
    exemplo: "Tatiana tinha 2.800 seguidores e focava 100% em criação para alcançar novos. Um mês fez o oposto: respondeu todos os DMs antigos, repostou histórias de 3 seguidoras com resultados, criou post agradecendo quem mais interagia. Resultado: 430 novos seguidores em 15 dias, vindos de indicação orgânica. Sem anúncio, sem colaboração.",
    correcao: "Reserve 20 minutos por dia para 'modo comunidade': responda comentários como conversas, não notificações. Mencione seguidores que compartilharam resultados. Faça enquetes reais com perguntas que você genuinamente quer saber. A audiência que se sente vista cresce em silêncio e compra em voz alta.",
    cor: "hsl(280_90%_70%)",
    icone: "🤝",
  },
  {
    n: "06",
    titulo: "Construir audiência em terreno alugado — sem capturar nada",
    descricao: "Você tem 4.000 seguidores no Instagram. Sabe quantos emails você tem dessas 4.000 pessoas? Se a resposta for 'poucos', você está construindo um negócio em cima de um servidor que não controla, com regras que mudam sem aviso, e alcance que cai toda semana.",
    aprofundamento: "A conta é simples e brutal: posts orgânicos chegam a 3–8% dos seguidores. 4.000 seguidores = você fala de verdade com 120–320 pessoas por post. Um email para 1.000 é aberto por 200–350 pessoas. Taxa de abertura vs. alcance orgânico: a lista ganha — e nunca te suspende.",
    exemplo: "Marcos construiu 11.000 seguidores em 14 meses. Quando foi lançar, tinha 312 emails. O lançamento chegou a 312 pessoas via email e ao que o algoritmo quis mostrar dos stories. Se tivesse construído lista desde o primeiro dia, teria 2.000–3.000 emails e controle real do lançamento.",
    correcao: "Crie uma isca digital simples — checklist, mini-guia, template — e coloque o link na bio com frase de valor claro. Toda semana, mencione nos stories que a isca existe. Com isso, você transforma seguidores em contatos que são seus — independente de qualquer plataforma.",
    cor: "hsl(15_100%_65%)",
    icone: "🔒",
  },
  {
    n: "07",
    titulo: "Medir as métricas que não pagam boleto",
    descricao: "Você comemora quando um post bomba em likes e fica frustrado quando não. Mas likes não pagam boleto. Salvamentos e compartilhamentos indicam valor real. Cliques no link indicam intenção. Leads capturados indicam futuro comprador. A métrica que você acompanha determina o tipo de conteúdo que cria — e a audiência que constrói.",
    aprofundamento: "A hierarquia de métricas: Curtidas (vaidade) → Comentários (engajamento) → Salvamentos (valor percebido) → Compartilhamentos (confiança) → Cliques (intenção) → Leads (futura receita). O criador que otimiza para likes cria entretenimento. O que otimiza para salvamentos e leads cria conteúdo de valor que converte.",
    exemplo: "Letícia tinha posts com 800 likes e zero vendas. Analisou o que levava salvamentos: eram os posts práticos — listas, processos, frameworks. Reposicionou 70% do conteúdo. Likes caíram para 300–400. Salvamentos foram 3x. Em 60 dias, lista cresceu 680 contatos e ela fez R$18k no primeiro lançamento para essa lista.",
    correcao: "Toda semana responda: quais posts tiveram mais salvamentos? Quais geraram mais cliques no link? Quais vieram acompanhados de DM espontânea? Esse é o mapa do que criar mais. O resto é dado decorativo.",
    cor: "hsl(0_90%_65%)",
    icone: "📊",
  },
];

const VALUE_FRAMEWORK = {
  camadas: [
    {
      numero: "Camada 1",
      nome: "O Padrão de Interrupção",
      desc: "Comece com algo que quebre a expectativa. Uma afirmação que contraria o que a pessoa acredita, um dado surpreendente, ou uma pergunta que ela faz para si mesma toda semana mas nunca viu ninguém responder diretamente.",
      fracos: ["'Hoje vou falar sobre crescimento no Instagram...'", "'Dica número 1 para aumentar sua audiência...'"],
      fortes: ["'Você está crescendo errado — e o algoritmo está te mostrando isso.'", "'3.200 seguidores. Zero vendas. Aqui está o que eu não entendia.'"],
      cor: "#f87171",
    },
    {
      numero: "Camada 2",
      nome: "A Promessa de Revelação",
      desc: "Depois do padrão de interrupção, você tem 5 segundos para entregar a promessa do que vai ser revelado. Não o que vai ensinar — o que a pessoa vai conseguir fazer ou evitar depois de consumir.",
      fracos: ["'Nesse vídeo vou explicar como funciona o algoritmo.'", "'Vou compartilhar algumas dicas que aprendi.'"],
      fortes: ["'Em 90 segundos você vai entender por que seu alcance caiu — e a correção não exige nenhum novo conteúdo.'", "'Vou te mostrar o padrão exato dos posts que geram salvamentos — com 3 exemplos que você pode copiar hoje.'"],
      cor: "#34d399",
    },
    {
      numero: "Camada 3",
      nome: "O Prêmio da Continuidade",
      desc: "Logo no início — não no final — sinalize que tem algo ainda mais valioso chegando. É o que os roteiristas de séries chamam de 'próximo episódio' inserido no começo.",
      fracos: ["'Fica até o final que tem uma dica especial.'", "'Não sai que tem um bônus.'"],
      fortes: ["'E no final vou mostrar o formato exato que uso nos posts que mais convertem — que não é o que a maioria acha que é.'", "'Antes de terminar, vou te dar o template que uso antes de publicar qualquer coisa.'"],
      cor: "#a78bfa",
    },
  ],
};

export default function FreeGuide({ onNavigate }: FreeGuideProps) {
  return (
    <Watermark>
      <div className="max-w-3xl mx-auto space-y-10 pb-16">

        <div className="rounded-2xl border border-[hsl(250_90%_60%/0.3)] bg-gradient-to-br from-[hsl(222_25%_7%)] to-[hsl(250_30%_8%)] p-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[hsl(250_90%_60%/0.15)] text-[hsl(250_90%_75%)] border border-[hsl(250_90%_60%/0.3)]">🎁 Guia Gratuito</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-3">Os 7 Erros que Travam o Crescimento da Sua Audiência</h1>
          <p className="text-[hsl(220_10%_65%)] text-lg leading-relaxed mb-4">
            Por que criadores com conteúdo bom ficam estagnados — e o que os que crescem de verdade fazem diferente. Com o Framework do Gancho em 3 Camadas incluso.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-[hsl(220_10%_60%)]">
            <span>⚠️ 7 erros com casos reais</span>
            <span>·</span>
            <span>🎣 Framework do Gancho</span>
            <span>·</span>
            <span>✅ Checklist de diagnóstico</span>
          </div>
        </div>

        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">Por que criadores com conteúdo bom ficam estagnados?</h2>
          <p className="text-[hsl(220_10%_65%)] leading-relaxed">
            Não é o algoritmo. Não é o nicho saturado. Não é falta de consistência. É porque existe um conjunto de erros específicos que criam o teto do crescimento — e a maioria dos criadores comete todos eles ao mesmo tempo, sem saber que são esses os freios.
          </p>
          <p className="text-[hsl(220_10%_65%)] leading-relaxed">
            Cada erro vem acompanhado de por que acontece, um caso real com números, e a correção exata para implementar na próxima publicação.
          </p>
          <div className="rounded-xl p-4" style={{ background: "hsl(250 90% 60% / 0.08)", border: "1px solid hsl(250 90% 60% / 0.2)" }}>
            <p className="text-[hsl(250_90%_80%)] font-semibold text-xs uppercase tracking-wider mb-1">📌 Incluso ao final</p>
            <p className="text-[hsl(220_10%_65%)] text-sm">
              O <strong className="text-white">Framework do Gancho em 3 Camadas</strong> — como escrever os primeiros 15 segundos de qualquer conteúdo para que o algoritmo e a pessoa não consigam parar. Com template pronto.
            </p>
          </div>
        </section>

        <section className="space-y-5">
          {ERRORS.map(erro => (
            <div key={erro.n} className="card p-6 space-y-4">
              <div className="flex items-start gap-4">
                <span className="text-2xl shrink-0">{erro.icone}</span>
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: erro.cor }}>Erro #{erro.n}</span>
                  <h3 className="text-white font-bold text-lg leading-tight mt-0.5">{erro.titulo}</h3>
                </div>
              </div>
              <p className="text-[hsl(220_10%_65%)] leading-relaxed">{erro.descricao}</p>

              <div className="rounded-xl p-4" style={{ background: "hsl(250 90% 60% / 0.05)", border: "1px solid hsl(250 90% 60% / 0.15)" }}>
                <p className="text-[hsl(250_90%_75%)] font-semibold text-xs uppercase tracking-wider mb-2">↗ Por que acontece</p>
                <p className="text-[hsl(220_10%_65%)] leading-relaxed text-sm">{erro.aprofundamento}</p>
              </div>

              <div className="rounded-xl bg-[hsl(0_90%_65%/0.05)] border border-[hsl(0_90%_65%/0.15)] p-4 text-sm">
                <p className="text-[hsl(0_90%_70%)] font-semibold text-xs uppercase tracking-wider mb-2">📍 Caso real</p>
                <p className="text-[hsl(220_10%_65%)] leading-relaxed italic">{erro.exemplo}</p>
              </div>

              <div className="rounded-xl bg-[hsl(168_100%_42%/0.05)] border border-[hsl(168_100%_42%/0.2)] p-4 text-sm">
                <p className="text-[hsl(168_100%_55%)] font-semibold text-xs uppercase tracking-wider mb-2">✓ O que fazer</p>
                <p className="text-[hsl(220_10%_65%)] leading-relaxed">{erro.correcao}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">Checklist de Diagnóstico</h2>
          <p className="text-[hsl(220_10%_65%)]">Responda honestamente sobre sua estratégia de conteúdo atual:</p>
          <div className="card p-6 space-y-3">
            {[
              "Meu posicionamento é específico o suficiente para excluir quem não é meu cliente ideal",
              "Meu conteúdo tem pelo menos 30% de história pessoal e processo — não só ensino",
              "Cada publicação começa pelos 3 segundos mais fortes — não por apresentação",
              "Tenho um ritual semanal de responder DMs e comentários como conversa real",
              "Tenho uma isca digital ativa e coleto emails ou contatos além de seguidores",
              "Acompanho salvamentos e cliques — não só likes e visualizações",
              "Sei exatamente para quem falo: cargo, dor, resultado e sacrifício que querem evitar",
            ].map((item, i) => (
              <label key={i} className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" className="mt-0.5 w-4 h-4 rounded accent-[hsl(250_90%_65%)] shrink-0" />
                <span className="text-sm text-[hsl(220_10%_65%)] group-hover:text-white transition-colors leading-relaxed">{item}</span>
              </label>
            ))}
            <div className="pt-2 border-t border-[hsl(220_20%_12%)]">
              <p className="text-xs text-[hsl(220_10%_40%)]">
                Menos de 4: os erros estão ativos e travando seu crescimento agora.<br />
                4–5: você tem base — os ajustes são pontuais e de alto impacto.<br />
                6–7: você está pronto para escalar — foque em volume com qualidade.
              </p>
            </div>
          </div>
        </section>

        <section className="card p-6 space-y-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "hsl(250 90% 75%)" }}>🎣 Conteúdo de valor incluso</span>
            <h2 className="text-xl font-bold text-white mt-1">Framework do Gancho em 3 Camadas</h2>
            <p className="text-[hsl(220_10%_55%)] text-sm mt-1">Como escrever os primeiros 15 segundos de qualquer conteúdo para que o algoritmo — e a pessoa — não consigam parar</p>
          </div>

          <p className="text-[hsl(220_10%_65%)] leading-relaxed text-sm">
            Você pode ter o melhor conteúdo do mundo. Se os primeiros 3 segundos não prenderem, o algoritmo entende que ninguém quer assistir — e para de distribuir. Aqui está o framework que os maiores criadores usam, com ou sem consciência:
          </p>

          <div className="space-y-4">
            {VALUE_FRAMEWORK.camadas.map(camada => (
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
                      {camada.fracos.map((ex, i) => <p key={i} className="text-xs text-[hsl(220_10%_50%)] italic">{ex}</p>)}
                    </div>
                  </div>
                  <div className="rounded-lg p-3" style={{ background: "hsl(168 100% 42% / 0.05)", border: "1px solid hsl(168 100% 42% / 0.2)" }}>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">✓ Forte</p>
                    <div className="space-y-1">
                      {camada.fortes.map((ex, i) => <p key={i} className="text-xs text-[hsl(220_10%_65%)] italic">{ex}</p>)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-5 space-y-3" style={{ background: "linear-gradient(135deg, hsl(250 40% 8%), hsl(270 30% 7%))", border: "1px solid hsl(250 90% 60% / 0.3)" }}>
            <h3 className="text-white font-bold text-sm">Template Pronto para Usar</h3>
            <div className="rounded-lg p-3" style={{ background: "hsl(250 90% 60% / 0.1)", border: "1px solid hsl(250 90% 60% / 0.2)" }}>
              <p className="text-xs font-mono text-[hsl(250_90%_80%)] font-bold">
                [AFIRMAÇÃO QUE CONTRARIA UMA CRENÇA] + [PROMESSA ESPECÍFICA DO QUE VÃO APRENDER] + [SINALIZAÇÃO DO QUE VEM NO FINAL]
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ background: "hsl(222 25% 5%)", border: "1px solid hsl(220 20% 12%)" }}>
              <p className="text-xs font-bold uppercase tracking-wider text-[hsl(220_10%_40%)] mb-2">Exemplo completo</p>
              <p className="text-sm text-[hsl(220_10%_70%)] leading-relaxed italic">
                "A maioria das pessoas está construindo audiência para crescer — e por isso não vende. Nesse conteúdo eu vou te mostrar a diferença entre audiência de alcance e audiência de compra — e como virar essa chave sem trocar o que você já cria. E no final, o teste de 3 perguntas que faço antes de publicar qualquer coisa para saber se vai converter ou só viralizar."
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[hsl(250_90%_65%/0.3)] bg-gradient-to-br from-[hsl(222_25%_7%)] to-[hsl(250_30%_8%)] p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-white">Quer o método completo de lançamento?</h2>
          <p className="text-[hsl(220_10%_65%)] leading-relaxed">
            Este guia cobre o crescimento de audiência. A Metodologia NexOS cobre o passo seguinte — como transformar essa audiência em um lançamento estruturado, com 12 módulos, 45 capítulos e automação pela equipe especializada.
          </p>
          <button
            onClick={() => onNavigate("products")}
            className="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-[hsl(250_90%_60%)] to-[hsl(270_80%_55%)] text-white font-bold hover:opacity-90 transition-opacity"
          >
            Ver Metodologia NexOS Completa →
          </button>
        </section>

      </div>
    </Watermark>
  );
}
