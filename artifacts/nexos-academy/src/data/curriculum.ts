export interface Lesson {
  id: string;
  title: string;
  duration: string;
  type: "text" | "video" | "exercise" | "quiz";
  content: string;
  keyPoints: string[];
  locked?: boolean;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  duration: string;
  lessons: Lesson[];
  summary: string;
  locked?: boolean;
}

export interface Module {
  id: string;
  number: number;
  title: string;
  description: string;
  chapters: Chapter[];
  badge: string;
}

export const CURRICULUM: Module[] = [
  {
    id: "fundamentos",
    number: 1,
    title: "Fundamentos do Marketing Digital",
    description: "A base que sustenta toda campanha de 7 dígitos. Entenda como a atenção funciona, onde o tráfego nasce e por que a maioria falha antes mesmo de começar.",
    badge: "Fundação",
    chapters: [
      {
        id: "atencao-digital",
        number: 1,
        title: "A Economia da Atenção",
        subtitle: "Por que a atenção é a nova moeda do século XXI",
        icon: "👁",
        color: "from-blue-600 to-indigo-600",
        duration: "45 min",
        summary: "Compreenda como a atenção humana foi transformada em commodity pelas redes sociais e como você pode aproveitar isso a seu favor em campanhas de lançamento.",
        lessons: [
          {
            id: "atencao-1",
            title: "O que é a Economia da Atenção",
            duration: "12 min",
            type: "text",
            keyPoints: ["Atenção como recurso escasso", "A guerra pelos eyeballs", "Por que 8 segundos é tudo que você tem"],
            content: `<h2>A Moeda do Século XXI</h2>
<p>Em 1971, o economista Herbert Simon previu algo que poucos entenderam: "A riqueza de informação cria pobreza de atenção." Cinquenta anos depois, vivemos exatamente isso.</p>

<p>Cada scroll no Instagram, cada story assistido, cada vídeo pausado representa uma micro-decisão humana. E essas micro-decisões somadas constroem ou destroem campanhas inteiras.</p>

<h3>Os Três Atores da Economia da Atenção</h3>
<ul>
  <li><strong>Plataformas:</strong> vendem atenção do usuário para anunciantes</li>
  <li><strong>Criadores:</strong> capturam atenção para monetizar depois</li>
  <li><strong>Usuários:</strong> trocam atenção por entretenimento, informação e conexão</li>
</ul>

<blockquote>O usuário não está consumindo conteúdo. Ele está gastando o recurso mais finito que possui: tempo consciente.</blockquote>

<h3>O Colapso do Span de Atenção</h3>
<p>Estudos da Microsoft (2015) mostraram que o span de atenção humana caiu de 12 segundos (2000) para 8 segundos. O de um peixinho dourado é 9 segundos.</p>

<p>O que isso significa na prática? Que você tem <em>menos de 3 segundos</em> para capturar atenção antes que o dedo role para o próximo conteúdo.</p>

<h3>A Fórmula NexOS de Atenção</h3>
<p>No NexOS, modelamos atenção assim:</p>
<code>Atenção = Curiosidade × Relevância ÷ Custo Cognitivo</code>

<p>Maximizar a numeradora e minimizar o denominador é a ciência por trás de todo copy de alto impacto que você verá neste curso.</p>`
          },
          {
            id: "atencao-2",
            title: "Algoritmos: Como Plataformas Distribuem Conteúdo",
            duration: "18 min",
            type: "text",
            keyPoints: ["Sinais de engajamento", "Tempo de retenção vs. curtidas", "Fingerprint do algoritmo do Instagram"],
            content: `<h2>Decodificando os Algoritmos</h2>
<p>Algoritmos não são mistérios. São sistemas de ranqueamento com objetivos declarados: maximizar o tempo que o usuário passa na plataforma.</p>

<h3>Os 5 Sinais que Importam</h3>
<ul>
  <li><strong>Watch Time / Tempo de Leitura:</strong> O rei absoluto. Quanto mais tempo, mais distribuição.</li>
  <li><strong>Saves / Bookmarks:</strong> Sinaliza valor percebido alto. Instagram valoriza muito.</li>
  <li><strong>Shares:</strong> O sinal social mais poderoso. Indica que o conteúdo saiu da bolha.</li>
  <li><strong>Comments com texto:</strong> Comentários substanciais pesam mais que emojis.</li>
  <li><strong>Clique no perfil:</strong> Curiosidade gerada. Indica lead qualificado.</li>
</ul>

<h3>Instagram 2024: O Fingerprint</h3>
<p>O algoritmo atual do Instagram usa um modelo chamado IG Score que pondera:</p>
<ul>
  <li>30% — Relevância para o usuário específico (histórico de interações)</li>
  <li>25% — Qualidade do conteúdo (retenção primeiros 3 segundos)</li>
  <li>25% — Engajamento dos primeiros 100 seguidores que viram</li>
  <li>20% — Atualidade (posts novos recebem boost inicial de 2h)</li>
</ul>

<blockquote>A melhor estratégia não é "hackear" o algoritmo. É criar conteúdo que o usuário queira consumir até o fim. O algoritmo seguirá naturalmente.</blockquote>

<h3>Implicação Direta para Lançamentos</h3>
<p>Em um lançamento, você precisa de <em>ondas de distribuição orgânica</em> para amplificar o tráfego pago. Isso significa: criar conteúdo de pré-lançamento que já gera saves e shares antes mesmo do carrinho abrir.</p>`
          },
          {
            id: "atencao-3",
            title: "Exercício: Audite Seu Feed",
            duration: "15 min",
            type: "exercise",
            keyPoints: ["Análise de 10 posts virais", "Identificar padrões de gancho", "Template de análise NexOS"],
            content: `<h2>Exercício Prático: Auditoria de Feed</h2>
<p>Vamos colocar a teoria em prática. Você precisará de 30 minutos e seu celular.</p>

<h3>Passo 1: Colete 10 Posts Virais do Seu Nicho</h3>
<p>Abra o Instagram ou TikTok e pesquise sua palavra-chave principal. Salve os 10 primeiros posts com mais de 10k interações.</p>

<h3>Passo 2: Para Cada Post, Responda</h3>
<ul>
  <li>Qual é o gancho visual? (primeira impressão em 0.5s)</li>
  <li>Qual é o gancho textual? (primeira frase/legenda)</li>
  <li>Qual emoção ele ativa? (curiosidade, medo, inveja, inspiração)</li>
  <li>Qual é o CTA implícito ou explícito?</li>
  <li>Por que eu continuei consumindo?</li>
</ul>

<h3>Passo 3: Monte Seu Swipe File</h3>
<p>Um swipe file é uma coleção curada de referências. É a principal arma dos melhores copywriters do mundo.</p>

<blockquote>Gary Halbert, um dos maiores copywriters da história, tinha uma pasta física com centenas de anúncios. Ele dizia: "Não invente o que já funciona. Roube como um artista."</blockquote>

<h3>Template de Análise NexOS</h3>
<code>
GANCHO VISUAL: ___
GANCHO TEXTUAL: ___
EMOÇÃO ATIVADA: ___
PROMESSA IMPLÍCITA: ___
POR QUE FUNCIONA: ___
</code>

<p>Este exercício é obrigatório antes de criar qualquer conteúdo para lançamento. Os melhores lançamentos do Brasil foram construídos sobre swipe files sólidos.</p>`
          }
        ]
      },
      {
        id: "trafego-organico",
        number: 2,
        title: "Tráfego Orgânico Dominante",
        subtitle: "A máquina gratuita que alimenta qualquer lançamento",
        icon: "🌱",
        color: "from-emerald-600 to-teal-600",
        duration: "1h 20min",
        summary: "Construa uma audiência que compra antes mesmo do carrinho abrir. A estratégia de conteúdo NexOS para os 90 dias antes do lançamento.",
        lessons: [
          {
            id: "organico-1",
            title: "Os 4 Tipos de Conteúdo Que Convertem",
            duration: "20 min",
            type: "text",
            keyPoints: ["Educacional vs. Inspiracional vs. Entretenimento vs. Vendas", "Proporção 80/20", "Calendário de conteúdo pré-lançamento"],
            content: `<h2>A Matriz de Conteúdo NexOS</h2>
<p>Na NexOS, dividimos conteúdo em 4 categorias com papéis distintos na jornada do comprador:</p>

<h3>1. Conteúdo Educacional (40% do volume)</h3>
<p>Resolve problemas específicos, ensina algo prático, posiciona você como autoridade. Este é o conteúdo que gera saves e bookmarks.</p>
<p><em>Exemplo:</em> "Os 7 erros que matam campanhas de tráfego pago" — resolve dor, gera identificação.</p>

<h3>2. Conteúdo de Prova Social (25% do volume)</h3>
<p>Cases de clientes, depoimentos, resultados. A prova social não vende produto — vende possibilidade. A pessoa não quer o produto, ela quer o resultado do produto.</p>
<p><em>Exemplo:</em> "Como a Ana saiu do zero para R$87.000 em 8 dias"</p>

<h3>3. Conteúdo de Identidade (20% do volume)</h3>
<p>Stories, bastidores, posicionamento. Constrói o personagem, gera conexão humana. Pessoas compram de pessoas que conhecem, gostam e confiam.</p>

<h3>4. Conteúdo de Venda Direta (15% do volume)</h3>
<p>Só funciona quando os 3 acima já criaram contexto. Uma oferta sem contexto é spam. Uma oferta com contexto é oportunidade.</p>

<blockquote>O erro fatal: publicar conteúdo de venda sem ter construído os outros 3 tipos antes. É como pedir casamento no primeiro encontro.</blockquote>`
          },
          {
            id: "organico-2",
            title: "Reels & Shorts: A Corrida do Ouro de 2024",
            duration: "25 min",
            type: "text",
            keyPoints: ["Estrutura de Reels que viralizam", "Hook-Retenção-CTA", "Os 7 formatos que funcionam"],
            content: `<h2>A Era do Vídeo Curto</h2>
<p>O Instagram Reels e o YouTube Shorts são, em 2024, a maior oportunidade de crescimento orgânico disponível para produtores digitais. A razão é simples: as plataformas estão subsidiando criadores para competir com o TikTok.</p>

<h3>A Estrutura dos 3 Atos</h3>
<p>Todo Reel que converte segue esta estrutura:</p>

<h3>Ato 1 — O Hook (0-3 segundos)</h3>
<p>Tem um único trabalho: impedir o scroll. Use um dos gatilhos:</p>
<ul>
  <li><strong>Curiosidade:</strong> "O segredo que nenhum guru te conta sobre..."</li>
  <li><strong>Controvérsia:</strong> "Você está fazendo tráfego pago errado e aqui está a prova"</li>
  <li><strong>Resultado chocante:</strong> "Como fiz R$142.000 em 7 dias sem lista"</li>
  <li><strong>Pergunta direta:</strong> "Você sabe quanto dinheiro está deixando na mesa?"</li>
</ul>

<h3>Ato 2 — A Retenção (3s ao fim)</h3>
<p>Entregue o prometido. Quebre em passos claros. Use texto na tela. Mostre, não apenas diga. Crie loops de curiosidade ("Mas tem um detalhe que muda tudo... veja no próximo ponto").</p>

<h3>Ato 3 — O CTA (últimos 5 segundos)</h3>
<p>Um CTA. Não dois. Não três. Um. O cérebro paralisa com múltiplas escolhas. Exemplos: "Salva esse vídeo para não esquecer" / "Comenta UM se quiser o template"</p>

<h3>Os 7 Formatos que Funcionam</h3>
<ol>
  <li>Lista numerada ("7 erros que...")</li>
  <li>Before/After ("De R$0 para R$X em Y dias")</li>
  <li>Tutorial rápido ("Em 60 segundos, aprenda...")</li>
  <li>Reação/Opinião ("Analisei 50 campanhas e descobri...")</li>
  <li>Bastidores ("Mostrando como funciona por dentro...")</li>
  <li>Mito vs Verdade ("Esqueça tudo que te ensinaram sobre...")</li>
  <li>Perguntas e Respostas ("Respondo as 5 perguntas mais frequentes")</li>
</ol>`
          },
          {
            id: "organico-3",
            title: "SEO no Instagram e YouTube",
            duration: "20 min",
            type: "text",
            keyPoints: ["Pesquisa de palavras-chave para redes sociais", "Otimização de perfil", "Hashtags estratégicas vs. hashtags por volume"],
            content: `<h2>SEO Social: Seja Encontrado</h2>
<p>As redes sociais se tornaram motores de busca. 40% dos Millennials preferem pesquisar no Instagram e TikTok em vez do Google. Isso é uma oportunidade enorme.</p>

<h3>Pesquisa de Palavras-Chave Social</h3>
<p>Ferramentas para usar:</p>
<ul>
  <li><strong>Instagram Explore:</strong> Digite sua palavra-chave e veja sugestões de busca</li>
  <li><strong>YouTube Search Predictions:</strong> Ouro para conteúdo longo</li>
  <li><strong>TikTok Creative Center:</strong> Trending hashtags e sons</li>
  <li><strong>Google Trends:</strong> Valide o volume de busca</li>
</ul>

<h3>Os 3 Campos de SEO do Instagram</h3>
<ol>
  <li><strong>Nome:</strong> Inclua sua palavra-chave principal. "João | Marketing Digital para Infoprodutores"</li>
  <li><strong>Bio:</strong> Use as palavras-chave secundárias naturalmente</li>
  <li><strong>Alt Text das imagens:</strong> Acessível e indexável pelo algoritmo</li>
</ol>

<h3>Hashtags: A Estratégia Correta</h3>
<p>A maioria usa hashtags aleatoriamente. A estratégia NexOS é a pirâmide de hashtags:</p>
<ul>
  <li>3 hashtags grandes (+1M posts): visibilidade ampla</li>
  <li>4 hashtags médias (100k-1M): competição moderada</li>
  <li>3 hashtags pequenas (-100k): maior chance de rankear</li>
</ul>

<blockquote>Não use #marketing com 500 milhões de posts se você tem 1.000 seguidores. É como gritar em um estádio cheio. Use hashtags onde você pode estar na página 1.</blockquote>`
          },
          {
            id: "organico-4",
            title: "Quiz: Fundamentos de Tráfego Orgânico",
            duration: "15 min",
            type: "quiz",
            keyPoints: ["10 questões", "Nota mínima 7/10 para avançar", "Feedback imediato"],
            content: `<h2>Quiz de Avaliação</h2>
<p>Este quiz avalia sua compreensão dos fundamentos de tráfego orgânico. Você precisa de 7 acertos para desbloquear o próximo capítulo.</p>
<p>O quiz será iniciado ao clicar em "Começar Avaliação".</p>`
          }
        ]
      },
      {
        id: "trafego-pago",
        number: 3,
        title: "Tráfego Pago: A Ciência dos Anúncios",
        subtitle: "Do pixel ao ROI positivo com consistência",
        icon: "💰",
        color: "from-amber-600 to-orange-600",
        duration: "1h 45min",
        summary: "Meta Ads, Google Ads e TikTok Ads na visão de quem já gerenciou R$50M em verba. Cada real investido deve ter destino calculado.",
        lessons: [
          {
            id: "pago-1",
            title: "Meta Ads: Estrutura de Campanha para Lançamentos",
            duration: "30 min",
            type: "text",
            keyPoints: ["CBO vs ABO", "Audiences: Interesse, Lookalike, Retargeting", "Estrutura de funil completa"],
            content: `<h2>Meta Ads para Lançamentos</h2>
<p>O Meta Ads (Facebook + Instagram) continua sendo a plataforma mais eficiente para lançamentos de produtos digitais no Brasil. Aqui está a estrutura que usamos no NexOS para campanhas de 6 a 10 dígitos.</p>

<h3>A Estrutura de 3 Camadas</h3>

<h3>Camada 1 — Topo de Funil (Aquisição)</h3>
<ul>
  <li>Objetivo: Alcance ou Visualizações de Vídeo</li>
  <li>Audiência: Interesses amplos (1-5M pessoas)</li>
  <li>Budget: 20% do total</li>
  <li>Meta: CPM baixo, construção de audiência de retargeting</li>
</ul>

<h3>Camada 2 — Meio de Funil (Aquecimento)</h3>
<ul>
  <li>Objetivo: Engajamento ou Tráfego</li>
  <li>Audiência: Engajamento dos últimos 90 dias + Lookalike 1%</li>
  <li>Budget: 40% do total</li>
  <li>Meta: Leads qualificados, lista aquecida</li>
</ul>

<h3>Camada 3 — Fundo de Funil (Conversão)</h3>
<ul>
  <li>Objetivo: Conversão / Compras</li>
  <li>Audiência: Visitantes site 30d + Engajamento 30d</li>
  <li>Budget: 40% do total</li>
  <li>Meta: ROAS mínimo 3x (quanto menor o ticket, maior o ROAS esperado)</li>
</ul>

<blockquote>CBO (Campaign Budget Optimization) para campanhas acima de R$500/dia. ABO (Ad Set Budget) para campanhas abaixo, quando você precisa controlar granularmente.</blockquote>

<h3>Os KPIs que Importam</h3>
<ul>
  <li><strong>CPM:</strong> Custo por mil impressões. Bom: &lt;R$15. Excelente: &lt;R$8</li>
  <li><strong>CTR:</strong> Taxa de clique. Bom: &gt;2%. Excelente: &gt;4%</li>
  <li><strong>CPL:</strong> Custo por lead. Depende do ticket. Para R$2.500, até R$35 é viável.</li>
  <li><strong>ROAS:</strong> Retorno sobre gasto em anúncios. Para produtos R$1.500+, ROAS &gt;3x = saudável.</li>
</ul>`
          },
          {
            id: "pago-2",
            title: "Criativos que Param o Scroll",
            duration: "25 min",
            type: "text",
            keyPoints: ["Fórmula do criativo de alta performance", "Tipos de criativo por fase do lançamento", "A/B testing sistemático"],
            content: `<h2>Criativos de Alta Performance</h2>
<p>Um criativo ruim desperdiça 90% do budget. Um criativo excelente pode ser o diferencial entre 3x e 10x de ROAS. Aqui está o que funcionou em R$50M+ de verba gerenciada.</p>

<h3>Os 4 Tipos de Criativo por Fase</h3>

<h3>Pré-lançamento (30-7 dias antes)</h3>
<ul>
  <li><strong>Curiosity Ads:</strong> Levantam o problema sem mostrar a solução. "Você está cometendo este erro fatal em sua estratégia de lançamento?"</li>
  <li><strong>Authority Ads:</strong> Posicionam você como especialista. Cases, métricas, bastidores de resultados.</li>
</ul>

<h3>Aquecimento (7-1 dias antes)</h3>
<ul>
  <li><strong>Social Proof Ads:</strong> Depoimentos de alunos, prints de resultados, transformações</li>
  <li><strong>Urgência suave:</strong> "Lista VIP abre em 3 dias" — sem pressão excessiva ainda</li>
</ul>

<h3>Carrinho Aberto (dias 1-3)</h3>
<ul>
  <li><strong>Oferta direta:</strong> Produto, preço, bônus, garantia. Clareza absoluta.</li>
  <li><strong>Objeção Busters:</strong> "Mas e se eu não tiver tempo?" — destrói a principal objeção</li>
</ul>

<h3>Fechamento (últimas 24h)</h3>
<ul>
  <li><strong>Escassez real:</strong> "Últimas 12 vagas" (só use se for verdade)</li>
  <li><strong>Deadline hard:</strong> Contador regressivo visível</li>
</ul>

<h3>A Fórmula do Teste A/B</h3>
<p>Teste uma variável por vez. Nunca duas simultaneamente. Ordem de impacto:</p>
<ol>
  <li>Hook (primeiros 3 segundos) — impacto alto</li>
  <li>Headline principal — impacto alto</li>
  <li>Formato (vídeo vs. imagem) — impacto médio</li>
  <li>CTA — impacto baixo</li>
</ol>`
          },
          {
            id: "pago-3",
            title: "Google Ads: Search + Display para Lançamentos",
            duration: "20 min",
            type: "text",
            keyPoints: ["Palavras-chave de intenção de compra", "Display para retargeting", "YouTube Ads antes do carrinho"],
            content: `<h2>Google Ads no Contexto de Lançamentos</h2>
<p>O Google Ads é subutilizado em lançamentos de produtos digitais. A maioria foca 100% em Meta e deixa dinheiro na mesa. Aqui está como usamos o Google estrategicamente.</p>

<h3>Search: Capturando Intenção</h3>
<p>Pessoas que buscam no Google estão em modo de pesquisa/compra. A temperatura do lead é muito mais alta.</p>
<p>Palavras-chave de intenção alta para infoprodutos:</p>
<ul>
  <li>"[seu nome] curso" — branded intent</li>
  <li>"[tema] curso online" — categoria intent</li>
  <li>"como [resultado desejado]" — problema intent</li>
</ul>

<h3>YouTube Ads: O Pré-Aquecimento Invisível</h3>
<p>Anúncios no YouTube funcionam melhor para criar familiaridade antes do carrinho abrir. A fórmula: mostre um VSL de 3-5 minutos para quem assistiu seus Reels nos últimos 30 dias.</p>

<p>Tipos de anúncio:</p>
<ul>
  <li><strong>TrueView In-Stream:</strong> Pulável após 5s. Pague apenas por quem assistiu 30s+.</li>
  <li><strong>Bumper Ads:</strong> 6s não puláveis. Perfeitos para retargeting de carrinho.</li>
</ul>

<h3>Display: O Perseguidor</h3>
<p>Quem visitou sua página de vendas mas não comprou deve ser perseguido no Google Display por 7 dias. Configure exclusão automática após a compra (via pixel de conversão).</p>

<blockquote>O erro mais comum: gastar R$10.000 em tráfego para uma landing page que converte 2%. Antes de aumentar budget, aumente conversão.</blockquote>`
          }
        ]
      }
    ]
  },
  {
    id: "formula-lancamento",
    number: 2,
    title: "Fórmula de Lançamento e PLF",
    description: "O método que gerou mais de R$1 bilhão em vendas no Brasil. Aprenda a executar um lançamento completo do zero ao carrinho fechado.",
    badge: "Core",
    chapters: [
      {
        id: "plf-estrutura",
        number: 4,
        title: "PLF: Product Launch Formula",
        subtitle: "O método de Jeff Walker adaptado para o mercado brasileiro",
        icon: "🚀",
        color: "from-violet-600 to-purple-600",
        duration: "1h 30min",
        summary: "A PLF (Product Launch Formula) de Jeff Walker gerou mais de US$1 bilhão em vendas. Aprenda a versão brasileira adaptada para o comportamento do consumidor local.",
        lessons: [
          {
            id: "plf-1",
            title: "Estrutura da PLF Brasileira",
            duration: "25 min",
            type: "text",
            keyPoints: ["As 4 fases: Pré-lançamento, Lançamento, Abertura, Fechamento", "Timeline de 14-21 dias", "O papel do conteúdo de valor gratuito"],
            content: `<h2>A Fórmula que Mudou o Mercado Digital</h2>
<p>Jeff Walker publicou "Launch" em 2014 e revolucionou como produtos digitais são vendidos. No Brasil, esse método foi adaptado com características únicas do consumidor brasileiro: maior emotividade, menor tolerância a formalidade e preferência por comunicação pessoal.</p>

<h3>As 4 Fases do Lançamento PLF</h3>

<h3>Fase 1: Pré-Pré-Lançamento (30-14 dias antes)</h3>
<p>O objetivo é despertar curiosidade e criar lista de espera. Você <em>não revela o produto</em> ainda. Levanta problemas, instiga curiosidade, constrói antecipação.</p>
<p>Conteúdos típicos: posts provocativos, enquetes, "o que você mais luta com X?", bastidores vagos.</p>

<h3>Fase 2: Pré-Lançamento (14-1 dias antes)</h3>
<p>Aqui entram os famosos PLC (Pre-Launch Content): 3 vídeos/textos de alto valor que educam e pré-vendem ao mesmo tempo. Cada PLC aumenta a antecipação e derruba uma objeção.</p>
<ul>
  <li><strong>PLC 1:</strong> Oportunidade — "Existe um jeito melhor"</li>
  <li><strong>PLC 2:</strong> Transformação — "Veja quem já fez"</li>
  <li><strong>PLC 3:</strong> Você precisa disso — Proof + Antecipação da abertura</li>
</ul>

<h3>Fase 3: Abertura do Carrinho (Dias 1-3)</h3>
<p>Launch day tem energia de evento. Email + WhatsApp + Instagram simultâneos. Stories em tempo real. Live de abertura se possível.</p>

<h3>Fase 4: Urgência + Fechamento (Últimos 2 dias)</h3>
<p>Escassez real, deadline hard, última chance. A receita se concentra aqui: 60-70% das vendas ocorrem nas últimas 24h.</p>

<blockquote>O segredo da PLF não é o roteiro. É o estado emocional que você cria na audiência ao longo das semanas. Cada mensagem é uma peça de uma história que termina com a compra como ato natural.</blockquote>`
          },
          {
            id: "plf-2",
            title: "Construindo Sua Lista de Espera",
            duration: "20 min",
            type: "text",
            keyPoints: ["Páginas de captura de alta conversão", "Lead magnet irresistível", "Sequência de e-mail de pré-lançamento"],
            content: `<h2>A Lista é Seu Ativo Mais Valioso</h2>
<p>Empresas que dependem 100% de redes sociais estão sempre um algoritmo de mudança de perderem tudo. Sua lista de emails e WhatsApp é o único ativo digital que você realmente controla.</p>

<h3>Taxas de Conversão de Referência</h3>
<ul>
  <li>Landing Page genérica: 15-25%</li>
  <li>Landing Page com lead magnet forte: 35-55%</li>
  <li>Landing Page de lista VIP (produto aguardado): 45-70%</li>
</ul>

<h3>O Lead Magnet Irresistível</h3>
<p>Um lead magnet funciona quando a percepção de valor é maior que o "custo" (email/telefone). Ele deve:</p>
<ul>
  <li>Resolver um problema específico em 10-15 minutos</li>
  <li>Gerar resultado imediato e mensurável</li>
  <li>Ser o primeiro passo para o produto principal</li>
</ul>

<p>Tipos por conversão (maior para menor):</p>
<ol>
  <li>Mini-curso em vídeo (3-5 aulas curtas)</li>
  <li>Checklist ou template preenchível</li>
  <li>Calculadora ou ferramenta</li>
  <li>Ebook ou guia PDF</li>
  <li>Webinar gravado</li>
</ol>

<h3>A Sequência de Emails de Pré-Lançamento</h3>
<p>Após o opt-in, uma sequência de 7 emails ao longo de 14 dias:</p>
<ul>
  <li>Email 1 (imediato): Entrega o lead magnet + apresentação</li>
  <li>Email 2 (dia 2): História de transformação</li>
  <li>Email 3 (dia 4): Conteúdo de valor direto</li>
  <li>Email 4 (dia 6): Prova social</li>
  <li>Email 5 (dia 9): Objeção principal destruída</li>
  <li>Email 6 (dia 12): Antecipação do lançamento</li>
  <li>Email 7 (dia 14): "Abre amanhã"</li>
</ul>`
          }
        ]
      },
      {
        id: "mental-triggers",
        number: 5,
        title: "Gatilhos Mentais e Neurociência da Venda",
        subtitle: "Por que as pessoas compram e como ativar esse processo",
        icon: "🧠",
        color: "from-rose-600 to-pink-600",
        duration: "1h 10min",
        summary: "A venda acontece no cérebro limbico, não no neocórtex. Entenda os 12 gatilhos mentais e como aplicá-los eticamente em cada fase do lançamento.",
        lessons: [
          {
            id: "triggers-1",
            title: "Os 12 Gatilhos Mentais do NexOS",
            duration: "30 min",
            type: "text",
            keyPoints: ["Autoridade, Prova Social, Escassez, Urgência, Reciprocidade", "Comunidade, Antecipação, Evento, Transformação", "Medo de Perda, Curiosidade, Contraste"],
            content: `<h2>A Neurociência Por Trás da Compra</h2>
<p>Antonio Damasio, neurocientista de Harvard, descobriu que pessoas com dano na região emocional do cérebro eram incapazes de tomar decisões, mesmo simples. Conclusão: <em>toda decisão de compra é emocional, justificada depois pela razão.</em></p>

<h3>Os 12 Gatilhos Mentais do Sistema NexOS</h3>

<h3>1. Autoridade</h3>
<p>Pessoas seguem especialistas. Construa credibilidade com dados específicos, casos reais, mídia e associações com autoridades maiores.</p>
<p><em>Ativação:</em> "Fui estudar nos EUA...", "Já gerenciei R$50M em verba...", "Meu aluno apareceu no Globo..."</p>

<h3>2. Prova Social</h3>
<p>O comportamento da manada. Se outros compraram e aprovaram, reduz risco percebido imensamente.</p>
<p><em>Ativação:</em> Depoimentos em vídeo, prints de WhatsApp, número de alunos, avaliações.</p>

<h3>3. Escassez (Real)</h3>
<p>O cérebro valoriza mais o que é raro. Vagas limitadas, bônus exclusivos para os primeiros, turma fechada.</p>
<p><strong>Aviso crítico:</strong> Escassez falsa destrói credibilidade para sempre. Use apenas quando real.</p>

<h3>4. Urgência</h3>
<p>Deadline claro cria ação. Sem prazo, a decisão fica para "depois" — e depois raramente chega.</p>
<p><em>Ativação:</em> Contador regressivo, data de encerramento, "preço especial até sexta".</p>

<h3>5. Reciprocidade</h3>
<p>Quando você dá algo de valor, o cérebro cria um débito emocional. O conteúdo gratuito de valor cria reciprocidade poderosa.</p>

<h3>6. Comunidade</h3>
<p>Pertencimento. Acesso a um grupo exclusivo de pessoas que pensam igual. "Venha fazer parte de..."</p>

<h3>7. Antecipação</h3>
<p>Ativar dopamina antes da abertura. O prazer da antecipação é frequentemente maior que o da conquista.</p>

<h3>8. Transformação</h3>
<p>O produto não é o produto — é a nova identidade. Quem a pessoa se tornará após comprar?</p>

<h3>9. Medo de Perda (FOMO)</h3>
<p>A perda pesa 2.5x mais que o ganho equivalente (Kahneman). "O que você perde ao não comprar" converte mais que "o que você ganha".</p>

<h3>10. Curiosidade</h3>
<p>O gap de informação. Quando o cérebro percebe que há algo que ele não sabe, cria tensão até descobrir.</p>

<h3>11. Evento</h3>
<p>Transforme o lançamento num acontecimento. Com data marcada, tema, personagens, rituais.</p>

<h3>12. Contraste</h3>
<p>O preço fica caro ou barato em relação ao que foi comparado antes. Compare com o custo do problema, não com outros produtos.</p>`
          }
        ],
        locked: false
      },
      {
        id: "copywriting",
        number: 6,
        title: "Copywriting de Alto Impacto",
        subtitle: "Palavras que vendem: do headline ao fechamento",
        icon: "✍️",
        color: "from-cyan-600 to-blue-600",
        duration: "1h 50min",
        summary: "Copywriting é a habilidade mais valiosa do marketing digital. Aprenda as fórmulas, os frameworks e a psicologia por trás de cada palavra.",
        lessons: [
          {
            id: "copy-1",
            title: "A Anatomia do Copy Perfeito",
            duration: "25 min",
            type: "text",
            keyPoints: ["AIDA, PAS, PASTOR", "Headlines que param o scroll", "A estrutura da VSL (Video Sales Letter)"],
            content: `<h2>Copywriting: A Arte de Vender com Palavras</h2>
<p>Claude Hopkins escreveu em 1923: "A única função do copy é vender. Não entreter, não impressionar — vender." Um século depois, isso continua verdade absoluta.</p>

<h3>As 3 Fórmulas Fundamentais</h3>

<h3>AIDA — O Clássico</h3>
<ul>
  <li><strong>A</strong>tenção: Pare o scroll</li>
  <li><strong>I</strong>nteresse: Mantenha lendo</li>
  <li><strong>D</strong>esejo: Crie querer</li>
  <li><strong>A</strong>ção: Provoque a compra</li>
</ul>

<h3>PAS — Para Produtos de Solução de Dor</h3>
<ul>
  <li><strong>P</strong>roblema: Identifique e agite a dor</li>
  <li><strong>A</strong>gitação: Amplifique as consequências</li>
  <li><strong>S</strong>olução: Apresente o produto como alívio</li>
</ul>

<h3>PASTOR — Para Copy Longo</h3>
<ul>
  <li><strong>P</strong>roblema</li>
  <li><strong>A</strong>mplify (consequências)</li>
  <li><strong>S</strong>tory (prova através de narrativa)</li>
  <li><strong>T</strong>ransformation (mudança que o produto gera)</li>
  <li><strong>O</strong>ffer (a oferta)</li>
  <li><strong>R</strong>esponse (o CTA)</li>
</ul>

<h3>Headlines que Param o Scroll</h3>
<p>8 fórmulas de headline com altas taxas de abertura:</p>
<ol>
  <li>"Como [resultado desejado] sem [objeção principal]"</li>
  <li>"[Número] [adjetivo] jeitos de [resultado] em [tempo]"</li>
  <li>"O segredo de [autoridade/especialista] para [resultado]"</li>
  <li>"Por que [crença comum] está errada (e o que fazer)"</li>
  <li>"[Resultado chocante]: o estudo que ninguém quer que você veja"</li>
  <li>"Se você [condição], você precisa ler isto"</li>
  <li>"Aviso: [afirmação provocativa]"</li>
  <li>"[Pergunta direta que levanta dor/desejo]?"</li>
</ol>`
          },
          {
            id: "copy-2",
            title: "VSL: Video Sales Letter do Zero",
            duration: "35 min",
            type: "text",
            keyPoints: ["Roteiro completo de VSL", "Os 15 blocos de uma VSL vencedora", "Erros fatais que matam a conversão"],
            content: `<h2>VSL: A Ferramenta de Vendas Mais Poderosa</h2>
<p>Uma VSL bem estruturada pode converter de 3% a 15% dos visitantes em clientes. É o elemento mais importante de qualquer funil de vendas de produto digital acima de R$500.</p>

<h3>Os 15 Blocos de uma VSL Vencedora</h3>
<ol>
  <li><strong>Hook de abertura</strong> — 10-15 segundos. Para o visitante.</li>
  <li><strong>Promessa de resultado</strong> — O que eles vão descobrir</li>
  <li><strong>Por que acreditar em mim</strong> — Credenciais rápidas</li>
  <li><strong>Identificação com a dor</strong> — "Eu sei como você se sente..."</li>
  <li><strong>Agitação da dor</strong> — Consequências de não mudar</li>
  <li><strong>Historia de transformação</strong> — Sua ou de um aluno</li>
  <li><strong>Introdução da solução</strong> — O método/produto</li>
  <li><strong>O que está dentro</strong> — Módulos, conteúdos, bônus</li>
  <li><strong>Stack de valor</strong> — Quanto valeria cada parte</li>
  <li><strong>Provas sociais</strong> — Depoimentos em vídeo</li>
  <li><strong>Destruição de objeções</strong> — Q&A antecipado</li>
  <li><strong>A oferta</strong> — Preço, condições, bônus</li>
  <li><strong>Garantia</strong> — Remove risco da compra</li>
  <li><strong>Urgência/Escassez</strong> — Razão para agir agora</li>
  <li><strong>CTA final</strong> — Instrução clara de como comprar</li>
</ol>

<h3>Duração Ideal por Ticket</h3>
<ul>
  <li>R$97-R$497: 15-25 minutos</li>
  <li>R$500-R$1.500: 25-40 minutos</li>
  <li>R$1.500+: 40-60 minutos</li>
</ul>

<blockquote>Uma VSL não é um vídeo de vendas. É uma jornada emocional cuidadosamente orquestrada onde, ao final, o visitante sente que seria irracional NÃO comprar.</blockquote>`
          }
        ],
        locked: true
      }
    ]
  },
  {
    id: "tipos-lancamento",
    number: 3,
    title: "Tipos de Lançamento e Monetização",
    description: "Cada produto e momento de negócio pede um modelo diferente. Aprenda quando usar Semente, Perpétuo, Interno, Afiliado e como montar uma escada de valor que maximiza o LTV do cliente.",
    badge: "Estratégia",
    chapters: [
      {
        id: "modelos-lancamento",
        number: 7,
        title: "Os 6 Modelos de Lançamento",
        subtitle: "Semente, Perpétuo, Interno, Externo, Afiliado e Co-criação",
        icon: "🗺",
        color: "from-violet-600 to-purple-600",
        duration: "1h 30min",
        summary: "Cada modelo de lançamento tem um contexto ideal, vantagens específicas e armadilhas a evitar. Escolher o modelo errado para o momento certo é o erro mais caro que um produtor digital pode cometer.",
        lessons: [
          {
            id: "semente",
            title: "Lançamento Semente: Venda Antes de Criar",
            duration: "22 min",
            type: "text",
            keyPoints: ["O que é o lançamento semente", "Como vender sem produto pronto", "Validação de mercado com risco zero", "Quando usar e quando evitar"],
            content: `<h2>Lançamento Semente: A Arte de Vender o que Ainda Não Existe</h2>
<p>O lançamento semente é o modelo mais inteligente para quem está começando ou testando uma nova ideia. A lógica é simples e poderosa: <em>você vende primeiro, cria depois</em>. Isso elimina o maior risco do empreendedorismo digital — criar algo que ninguém quer comprar.</p>

<h3>Como Funciona na Prática</h3>
<p>Você apresenta a ideia do produto para uma audiência pequena (sua lista de email, grupo de WhatsApp, seguidores próximos) e oferece acesso a um preço de fundador — significativamente mais barato que o preço final. Em troca, o comprador sabe que está adquirindo algo em construção e que terá participação no processo.</p>

<p>O número mínimo viável é <strong>entre 10 e 30 compradores</strong>. Esse volume já valida a demanda, gera receita para cobrir a produção e cria um grupo de "co-criadores" que darão feedback valioso.</p>

<h3>A Estrutura em 4 Etapas</h3>
<ol>
  <li><strong>Pré-anúncio:</strong> Compartilhe a ideia informalmente. "Estou pensando em criar X. Você teria interesse?" — colete reações sem compromisso.</li>
  <li><strong>Oferta de Fundador:</strong> Apresente formalmente com preço reduzido (30-50% do preço final), prazo curto (48-72h) e transparência sobre o estágio atual.</li>
  <li><strong>Criação com Feedback:</strong> Entregue módulos progressivamente. Cada entrega é uma oportunidade de coletar feedback e ajustar o conteúdo.</li>
  <li><strong>Lançamento Completo:</strong> Com produto pronto, provas sociais reais e depoimentos dos fundadores, você relança para o mercado amplo a preço cheio.</li>
</ol>

<h3>Quando Usar o Lançamento Semente</h3>
<ul>
  <li>Primeiro produto digital — validar antes de investir tempo em produção</li>
  <li>Nova área ou nicho — testar demanda sem assumir que você sabe o que o mercado quer</li>
  <li>Produto de alto ticket — o risco de criar sem validação é maior quando o investimento de produção é alto</li>
  <li>Audiência pequena — mesmo com 200 seguidores é possível fazer um semente bem-sucedido</li>
</ul>

<h3>Quando Evitar</h3>
<ul>
  <li>Produtos físicos com custo de produção alto — o modelo não se aplica bem</li>
  <li>Quando você não consegue entregar em 30-60 dias — compromisso com o comprador é sagrado</li>
  <li>Se sua audiência já espera produto acabado — certos mercados não aceitam "em construção"</li>
</ul>

<blockquote>Jeff Walker, criador da PLF, começou com um lançamento semente para sua própria lista de email. Faturou US$34.000 em uma semana com um produto que ainda não existia. O semente não é gambito de iniciante — é estratégia de risco calculado.</blockquote>

<h3>Erros Fatais no Semente</h3>
<ul>
  <li><strong>Prometer mais do que pode entregar:</strong> Transparência é o ativo principal deste modelo</li>
  <li><strong>Não ter deadline na oferta de fundador:</strong> Sem urgência, "vou pensar" vira nunca</li>
  <li><strong>Precificar muito barato:</strong> Preço de fundador deve ser especial, não irrisório. Produto de R$1.000 pode ter fundador a R$497, não a R$97</li>
  <li><strong>Ignorar o feedback dos compradores:</strong> Eles são seus co-criadores, não apenas primeiros clientes</li>
</ul>`
          },
          {
            id: "perpetuo",
            title: "Lançamento Perpétuo: A Máquina de Vendas 24/7",
            duration: "25 min",
            type: "text",
            keyPoints: ["Funil perpétuo vs. lançamento pontal", "Sequência de email automatizada", "Webinar evergreen", "Quando escalar para perpétuo"],
            content: `<h2>Perpétuo: Quando Seu Funil Trabalha Enquanto Você Dorme</h2>
<p>O lançamento perpétuo (também chamado de evergreen) é um sistema de vendas automatizado que roda continuamente — sem janelas de abertura e fechamento de carrinho, sem pico de estresse, sem dependência de você estar online.</p>

<p>A diferença fundamental: enquanto o lançamento pontual gera picos de receita, o perpétuo gera receita <em>previsível e crescente</em>. É a diferença entre sprint e maratona.</p>

<h3>Como Funciona a Estrutura Perpétua</h3>
<p>O visitante entra no funil via anúncio ou conteúdo orgânico, assiste a um webinar gravado (que ele percebe como ao vivo graças à tecnologia de "simulação de ao vivo"), recebe uma sequência de emails de 5-7 dias e é apresentado à oferta com um deadline individual — geralmente 48-72h após o cadastro.</p>

<h3>Os 4 Pilares do Funil Perpétuo</h3>

<h3>1. A Isca (Lead Magnet)</h3>
<p>O ponto de entrada. Deve resolver um problema específico e imediato. Mini-curso, checklist, calculadora. Quanto mais específico o problema que resolve, melhor a qualidade do lead.</p>

<h3>2. O Webinar Evergreen</h3>
<p>O coração do funil perpétuo. Um webinar de 60-90 minutos com estrutura: gancho → conteúdo de valor → transição → oferta. A chave é que ele deve converter tão bem gravado quanto ao vivo.</p>
<p>Ferramentas: EverWebinar, WebinarJam, Demio (modo simulado), ou simplesmente uma página com vídeo do YouTube não listado.</p>

<h3>3. A Sequência de Email</h3>
<p>7 emails disparados ao longo de 7 dias após o cadastro. Cada email tem um papel:</p>
<ul>
  <li>Email 1: Entrega o lead magnet + expectativa do que vem</li>
  <li>Email 2: Conteúdo de valor direto (sem vender)</li>
  <li>Email 3: Sua história de transformação</li>
  <li>Email 4: Prova social de alunos</li>
  <li>Email 5: Destruição da objeção principal</li>
  <li>Email 6: A oferta direta com deadline</li>
  <li>Email 7: Última chance + por que agir agora</li>
</ul>

<h3>4. O Deadline Individual</h3>
<p>Cada pessoa que entra no funil recebe um deadline personalizado (ex: 72h após o webinar). Ferramentas como Deadline Funnel criam contadores genuinamente únicos por usuário — não é fake, é real.</p>

<h3>Quando Migrar para o Perpétuo</h3>
<p>O erro mais comum é ir direto para o perpétuo antes de validar a oferta. A sequência correta é:</p>
<ol>
  <li>Lançamento semente (valida a ideia)</li>
  <li>1-2 lançamentos pontuais (refina a oferta, coleta provas sociais)</li>
  <li>Perpétuo (escala o que já funciona)</li>
</ol>

<blockquote>Um funil perpétuo mal construído é uma máquina de queimar dinheiro em anúncios. Um funil perpétuo bem construído é um ativo que se valoriza com o tempo — quanto mais dados, melhor a otimização.</blockquote>

<h3>Métricas do Funil Perpétuo Saudável</h3>
<ul>
  <li>Taxa de opt-in da landing page: &gt;35%</li>
  <li>Taxa de comparecimento ao webinar: &gt;25% dos inscritos</li>
  <li>Taxa de conversão do webinar: 5-15% dos participantes</li>
  <li>ROAS mínimo para escalar: 3x</li>
</ul>`
          },
          {
            id: "interno-externo",
            title: "Lançamento Interno e Externo",
            duration: "18 min",
            type: "text",
            keyPoints: ["Interno: sua própria audiência", "Externo: parceiros e afiliados", "Co-lançamento e JV (Joint Venture)", "Como estruturar comissões e acordos"],
            content: `<h2>Interno vs. Externo: Aproveitando Cada Audiência</h2>

<h3>Lançamento Interno</h3>
<p>O lançamento interno é feito exclusivamente para sua própria audiência — sua lista de email, seguidores nas redes, grupo de WhatsApp. Você controla tudo: timing, mensagem, frequência.</p>

<p><strong>Vantagens:</strong></p>
<ul>
  <li>Margem 100% para você (sem comissões)</li>
  <li>Relacionamento mais próximo — audiência que já te conhece e confia</li>
  <li>Velocidade de execução — não depende de parceiros</li>
  <li>Controle total da mensagem e posicionamento</li>
</ul>

<p><strong>Limitação:</strong> o teto de receita é limitado pelo tamanho da sua audiência. Para crescer, você precisa ou aumentar a lista constantemente, ou trazer audiências externas.</p>

<h3>Lançamento Externo</h3>
<p>No lançamento externo, você apresenta seu produto para a audiência de outra pessoa — um parceiro que tem a confiança de um público que você ainda não alcança. O parceiro (chamado de JV — Joint Venture) promove seu produto para a lista dele em troca de comissão sobre as vendas.</p>

<p><strong>Como estruturar um JV:</strong></p>
<ul>
  <li>Comissão padrão no mercado: 30-50% do valor do produto</li>
  <li>O JV cede a lista e faz os disparos; você entrega o produto e o suporte</li>
  <li>Acordar antecipadamente: reciprocidade futura, materiais de divulgação, tracking de vendas</li>
  <li>Ferramenta: Hotmart, Kiwify ou Eduzz têm sistema de afiliados embutido</li>
</ul>

<h3>Lançamento Co-criado</h3>
<p>Modelo híbrido onde dois produtores unem audiências e criam um produto juntos. Cada um contribui com sua área de expertise e divide a receita 50/50 (ou conforme acordo).</p>
<p><em>Exemplo clássico:</em> nutricionista + personal trainer criando um programa de emagrecimento completo.</p>

<h3>Como Encontrar Parceiros de JV</h3>
<ol>
  <li>Mapeie quem tem a audiência que você quer alcançar (mesmo tamanho ou maior)</li>
  <li>Construa relacionamento genuíno antes de pedir parceria</li>
  <li>Apresente a proposta com dados: taxa de conversão histórica, ticket médio, suporte ao aluno</li>
  <li>Comece com trocas menores para construir confiança mútua</li>
</ol>

<blockquote>Um único lançamento externo com o parceiro certo pode multiplicar sua receita em 5-10x em relação ao interno. Mas a reputação do parceiro é sua reputação — escolha com cuidado.</blockquote>`
          },
          {
            id: "afiliado",
            title: "Lançamento de Afiliado: Lucro Sem Produto Próprio",
            duration: "20 min",
            type: "text",
            keyPoints: ["Como funciona o modelo de afiliado", "Escolhendo o produto certo para promover", "Estratégias de afiliado avançado: bônus e posicionamento", "A transição de afiliado para produtor"],
            content: `<h2>Afiliado: A Porta de Entrada para o Mercado Digital</h2>
<p>O lançamento de afiliado é quando você promove o produto de outra pessoa para sua audiência em troca de comissão. Não há criação de produto, suporte ao cliente ou infraestrutura — apenas geração de tráfego e conversão.</p>

<p>Para quem está começando, o modelo de afiliado é a forma mais rápida de gerar receita enquanto aprende como o mercado funciona. Para quem já tem produto, o afiliado é uma linha de receita adicional com esforço incremental.</p>

<h3>Como Escolher o Produto Certo para Promover</h3>
<p>Critérios não negociáveis:</p>
<ul>
  <li><strong>Alinhamento com sua audiência:</strong> Promover algo fora do seu contexto destrói credibilidade rapidamente</li>
  <li><strong>Produto que você usaria:</strong> Autenticidade na promoção é detectável — e sua ausência também</li>
  <li><strong>Produtor com boa reputação:</strong> O suporte e a entrega do produto refletem em você</li>
  <li><strong>Comissão justa:</strong> Produtos digitais pagam 30-50%. Abaixo disso, o math raramente fecha</li>
  <li><strong>Material de divulgação de qualidade:</strong> Página de vendas, banners, copy pronto facilitam a promoção</li>
</ul>

<h3>A Estratégia do Bônus Exclusivo</h3>
<p>O afiliado mediano promove o produto. O afiliado avançado cria um <em>bônus exclusivo</em> que só quem comprar pelo seu link recebe. Esse bônus pode ser:</p>
<ul>
  <li>Uma consultoria de 1h com você</li>
  <li>Um template ou ferramenta complementar</li>
  <li>Um mini-curso de implementação do produto principal</li>
  <li>Acesso a um grupo fechado de suporte</li>
</ul>
<p>A pergunta que o comprador faz é: "Por que comprar pelo link do João e não direto?" Seu bônus é a resposta.</p>

<h3>Posicionamento de Afiliado: Curation vs. Promoção</h3>
<p>Há dois posicionamentos possíveis:</p>
<ul>
  <li><strong>Curador:</strong> "Testei 12 cursos de X e só recomendo este" — autoridade de quem seleciona o melhor</li>
  <li><strong>Usuário:</strong> "Comprei, usei, tive resultado Y" — prova social de quem viveu a transformação</li>
</ul>
<p>O posicionamento de curador funciona mesmo sem ter comprado — desde que o filtro seja real. O de usuário exige experiência genuína mas converte melhor.</p>

<h3>A Transição Natural: De Afiliado a Produtor</h3>
<p>O modelo de afiliado é excelente escola. Você aprende o que vende, o que converte, quais objeções existem e como o mercado reage. Com esse conhecimento, a transição para produto próprio é muito mais assertiva.</p>
<p>A sequência inteligente: afiliado → semente → lançamento pontual → perpétuo.</p>`
          },
          {
            id: "comparativo-modelos",
            title: "Exercício: Qual Modelo é o Seu?",
            duration: "15 min",
            type: "exercise",
            keyPoints: ["Matriz de decisão por modelo", "Análise do seu momento atual", "Planejamento para os próximos 90 dias"],
            content: `<h2>Exercício: Encontre Seu Modelo Ideal</h2>
<p>Com base no que você aprendeu, este exercício vai ajudar você a identificar qual modelo de lançamento faz mais sentido para o seu momento atual.</p>

<h3>Passo 1: Responda as 5 Perguntas</h3>

<p><strong>1. Você já tem um produto validado?</strong><br/>
Sim → considere perpétuo ou lançamento pontual<br/>
Não → comece pelo semente ou afiliado</p>

<p><strong>2. Qual é o tamanho da sua audiência própria?</strong><br/>
0-500: semente ou afiliado<br/>
500-5.000: lançamento interno pequeno<br/>
5.000+: lançamento completo com escala</p>

<p><strong>3. Você tem capital para investir em tráfego?</strong><br/>
Não → orgânico primeiro, semente ou afiliado<br/>
Sim → perpétuo ou externo com tráfego pago</p>

<p><strong>4. Você tem parceiros ou relacionamentos no mercado?</strong><br/>
Sim → externo ou JV são aceleradores poderosos<br/>
Não → construa seu interno primeiro</p>

<p><strong>5. Você consegue criar o produto em 60 dias?</strong><br/>
Sim → semente é seguro<br/>
Não → afiliado enquanto produz</p>

<h3>Passo 2: A Matriz de Decisão</h3>

<p>Com base nas respostas acima, identifique seu quadrante:</p>
<ul>
  <li><strong>Iniciante sem produto + sem audiência:</strong> Afiliado → Semente</li>
  <li><strong>Iniciante sem produto + com audiência:</strong> Semente imediato</li>
  <li><strong>Produto validado + audiência pequena:</strong> Interno + buscar JVs</li>
  <li><strong>Produto validado + audiência média:</strong> Perpétuo + lançamentos sazonais</li>
  <li><strong>Produto validado + audiência grande:</strong> Lançamento completo + perpétuo no intervalo</li>
</ul>

<h3>Passo 3: Planejamento 90 Dias</h3>
<p>Defina agora:</p>
<ul>
  <li>Qual modelo você vai executar nos próximos 90 dias?</li>
  <li>Qual é a meta de receita realista para este modelo?</li>
  <li>Quais são os 3 obstáculos principais que pode enfrentar?</li>
  <li>Quem pode ser seu primeiro parceiro JV se for o modelo externo?</li>
</ul>

<blockquote>Não existe modelo certo ou errado em abstrato. Existe o modelo certo para o seu momento. Um lançamento semente executado com excelência supera qualquer lançamento complexo feito na hora errada.</blockquote>`
          }
        ]
      },
      {
        id: "escada-valor",
        number: 8,
        title: "Escada de Valor e Monetização Avançada",
        subtitle: "Como maximizar o LTV de cada cliente com upsell, downsell e recorrência",
        icon: "📈",
        color: "from-emerald-600 to-teal-600",
        duration: "1h 15min",
        summary: "Vender uma vez é apenas o começo. A escada de valor é a arquitetura que transforma compradores em clientes recorrentes e multiplica a receita sem aumentar o custo de aquisição.",
        lessons: [
          {
            id: "escada-1",
            title: "Escada de Valor: Da Isca ao High Ticket",
            duration: "25 min",
            type: "text",
            keyPoints: ["O conceito de escada de valor (Value Ladder)", "Da isca digital ao produto premium", "Como cada produto financia o próximo", "Ticket médio vs. LTV"],
            content: `<h2>A Escada de Valor: Arquitetura de Receita Inteligente</h2>
<p>Russell Brunson popularizou o conceito de Value Ladder (escada de valor) no livro DotCom Secrets. A ideia é simples: em vez de ter um produto, você tem uma <em>jornada de produtos</em> — cada um entregando mais valor a um preço mais alto, para quem está pronto para subir o próximo degrau.</p>

<h3>Por Que a Escada Funciona</h3>
<p>O custo de aquisição de um cliente é alto. Uma vez que alguém comprou de você, a barreira da confiança foi vencida. Vender para quem já comprou custa <strong>5 a 7 vezes menos</strong> do que adquirir um novo cliente. A escada de valor é a estrutura que aproveita isso sistematicamente.</p>

<h3>Os 5 Degraus da Escada</h3>

<h3>Degrau 1: Isca Digital (Gratuito ou R$9-R$47)</h3>
<p>Objetivo: capturar o lead ou fazer a primeira venda de baixíssima resistência. Não precisa gerar lucro — precisa gerar cadastro e primeira experiência positiva com sua entrega.</p>
<p><em>Exemplos:</em> ebook, mini-curso, checklist, template, calculadora.</p>

<h3>Degrau 2: Produto de Entrada (R$47-R$297)</h3>
<p>A primeira compra real. Resolve um problema específico com profundidade suficiente para gerar resultado rápido. Este degrau financia os anúncios e mostra que você entrega o prometido.</p>
<p><em>Exemplos:</em> curso curto, workshop gravado, guia completo.</p>

<h3>Degrau 3: Produto Core (R$297-R$1.997)</h3>
<p>O produto principal do seu negócio. Solução completa para o problema central da sua audiência. A maioria dos produtores vive neste degrau — é onde está a maior parte da receita.</p>
<p><em>Exemplos:</em> curso completo, mentoria em grupo, programa com acompanhamento.</p>

<h3>Degrau 4: High Ticket (R$2.000-R$20.000)</h3>
<p>Acesso direto a você ou resultado garantido. A entrega é muito mais personalizada: mentoria 1:1, consultoria, mastermind fechado. 20% dos seus clientes têm potencial para este degrau.</p>

<h3>Degrau 5: Ultra High Ticket / Continuidade (R$10.000+)</h3>
<p>Parcerias estratégicas, participação societária, fee mensal por resultado. Só faz sentido para quem já tem casos de sucesso sólidos nos degraus anteriores.</p>

<h3>Como Construir Sua Escada</h3>
<ol>
  <li>Mapeie o resultado final que seu cliente quer alcançar</li>
  <li>Quebre essa jornada em etapas menores</li>
  <li>Crie um produto para cada etapa</li>
  <li>Garanta que cada produto entrega resultado real — não apenas "prepara" para o próximo</li>
  <li>Construa a subida naturalmente: quem tem resultado quer mais</li>
</ol>

<blockquote>A escada de valor não é um funil de vendas agressivo — é uma jornada de transformação progressiva. Cada degrau deve ser completo em si mesmo. Se o cliente parar no degrau 2, ele deve ter tido uma experiência excelente.</blockquote>`
          },
          {
            id: "upsell-downsell",
            title: "Upsell, Downsell e Order Bump",
            duration: "20 min",
            type: "text",
            keyPoints: ["Order Bump: +20-35% de receita no checkout", "Upsell de 1 clique pós-compra", "Downsell para quem recusa", "Como sequenciar sem parecer agressivo"],
            content: `<h2>Maximizando o Valor de Cada Transação</h2>
<p>A maioria dos produtores para de otimizar quando o cliente decide comprar. Esse é o momento em que a receita pode crescer 40-80% sem nenhum cliente adicional — apenas com técnicas de otimização do checkout.</p>

<h3>Order Bump: A Técnica Mais Simples e Poderosa</h3>
<p>O order bump é uma oferta adicional apresentada <em>dentro do checkout</em>, antes da confirmação de pagamento. É um checkbox que o cliente pode marcar para adicionar um produto complementar à compra com um único clique.</p>

<p><strong>Características do order bump ideal:</strong></p>
<ul>
  <li>Preço baixo em relação ao produto principal (10-30% do valor)</li>
  <li>Complementar e imediatamente relevante à compra</li>
  <li>Resultado rápido e tangível</li>
  <li>Taxa de aceitação de mercado: 20-40%</li>
</ul>

<p><em>Exemplo prático:</em> Você vende um curso de tráfego pago por R$997. No checkout, oferece uma "Biblioteca de Criativos Prontos" por R$197. Quem está comprando um curso de tráfego claramente precisa de criativos.</p>

<h3>Upsell de 1 Clique</h3>
<p>Apresentado <em>depois</em> da confirmação de pagamento, o upsell é uma oferta de maior valor que o cliente pode aceitar com um único clique — sem preencher cartão novamente.</p>

<p><strong>A psicologia por trás:</strong> o cliente acabou de tomar uma decisão de compra e está no pico de excitação. O "modo compra" está ativado. Apresentar uma oferta complementar neste momento encontra muito menos resistência do que em qualquer outro.</p>

<p><strong>Regra de ouro do upsell:</strong> deve ser uma versão superior ou mais completa do que foi comprado — nunca algo completamente diferente. "Quer o curso básico que você comprou + o avançado + mentoria mensal por R$500 a mais?" funciona. "Quer comprar meu curso de culinária?" não funciona.</p>

<h3>Downsell: Recuperando Quem Recusa</h3>
<p>Quando o cliente recusa o upsell, você apresenta uma versão menor e mais barata. O cliente já disse não ao R$500; ofereça o núcleo daquilo por R$197.</p>

<p>Taxa de aceitação de downsell: 10-20% dos que recusaram o upsell. Isso representa receita que seria perdida sem o sistema.</p>

<h3>A Sequência Completa</h3>
<p>Produto principal → Order Bump (checkout) → Upsell 1 → Recusa → Downsell 1 → Upsell 2 (opcional)</p>

<p>Não crie mais de 2 níveis de upsell. A experiência se torna frustrante e queima confiança.</p>

<blockquote>Jeff Bezos disse que a Amazon seria um negócio sem sentido se não fosse pelas compras repetidas. O mesmo vale para infoprodutos. A primeira venda é o custo de aquisição do cliente; as vendas seguintes são o lucro real.</blockquote>`
          },
          {
            id: "recorrencia",
            title: "Modelos de Recorrência: A Receita Previsível",
            duration: "22 min",
            type: "text",
            keyPoints: ["Assinatura vs. mensalidade vs. retainer", "Membership sites e comunidades pagas", "Como calcular o LTV ideal", "Churn: o inimigo silencioso"],
            content: `<h2>Recorrência: O Santo Graal da Renda Digital</h2>
<p>Receita recorrente é o ativo mais valioso que um negócio digital pode construir. Enquanto lançamentos geram picos de receita, a recorrência cria a <em>base</em> — o chão que sustenta toda a operação mesmo nos meses sem lançamento.</p>

<h3>Os 4 Modelos de Recorrência para Infoprodutores</h3>

<h3>1. Membership / Comunidade Paga</h3>
<p>Acesso a uma comunidade exclusiva, conteúdo novo mensalmente, encontros ao vivo periódicos. O valor está no pertencimento, na atualização constante e no networking.</p>
<p><em>Ticket típico:</em> R$47-R$297/mês</p>
<p><em>O que retém o membro:</em> qualidade das relações na comunidade e relevância do conteúdo novo</p>

<h3>2. Atualização de Produto (Content Club)</h3>
<p>O cliente paga mensalmente para receber novos materiais, templates, estudos de caso ou atualizações do conteúdo principal. Funciona bem para nichos que mudam rápido (marketing, tecnologia, finanças).</p>
<p><em>Ticket típico:</em> R$37-R$197/mês</p>

<h3>3. Mentoria / Acompanhamento Recorrente</h3>
<p>Calls mensais em grupo, sessões de Q&A, revisão de trabalhos. Você oferece acesso contínuo à sua expertise por uma mensalidade.</p>
<p><em>Ticket típico:</em> R$297-R$997/mês</p>
<p><em>Limitação:</em> escala limitada pelo seu tempo — cada novo membro demanda atenção</p>

<h3>4. Retainer de Resultado</h3>
<p>Você é contratado mensalmente para entregar um resultado específico — não conteúdo. Geralmente para agências ou consultores: "R$3.000/mês para gerenciar e otimizar sua estratégia de tráfego".</p>

<h3>Calculando o LTV (Lifetime Value)</h3>
<p>LTV = Ticket Médio Mensal × Tempo Médio de Permanência (em meses)</p>
<p>Se seu membership custa R$197/mês e os membros ficam em média 8 meses, seu LTV é R$1.576.</p>
<p>Isso significa que você pode gastar até R$500 para adquirir um assinante e ainda ter margem saudável.</p>

<h3>Churn: O Inimigo Silencioso</h3>
<p>Churn é a taxa de cancelamento mensal. Um churn de 10% ao mês significa que você perde metade da base em 7 meses. Para crescer, você precisa adquirir mais do que perde — o que se torna uma corrida sem fim.</p>

<p>Redutores de churn que funcionam:</p>
<ul>
  <li>Onboarding excepcional nos primeiros 30 dias</li>
  <li>Quick wins visíveis logo no início da assinatura</li>
  <li>Comunidade ativa — cancelar significa perder o grupo</li>
  <li>Plano anual com desconto: além de melhorar o fluxo de caixa, reduz churn (quem paga por 1 ano raramente cancela nos primeiros meses)</li>
</ul>

<blockquote>Um membership com 200 membros a R$297/mês gera R$59.400 previsíveis por mês — sem lançamento, sem sprint, sem estresse. Esse chão muda completamente a psicologia do empreendedor e a qualidade das decisões de negócio.</blockquote>`
          },
          {
            id: "monetizacao-quiz",
            title: "Quiz: Estratégia de Monetização",
            duration: "10 min",
            type: "quiz",
            keyPoints: ["12 questões sobre escada de valor e modelos", "Análise do seu modelo atual", "Recomendação personalizada"],
            content: `<h2>Quiz: Qual é a Sua Estratégia de Monetização?</h2>
<p>Este quiz avalia sua compreensão dos modelos de monetização e ajuda a identificar gaps na sua estrutura atual.</p>
<p>Ao concluir, você receberá uma análise do seu perfil e as principais oportunidades de crescimento de receita.</p>
<p>Clique em "Começar Avaliação" para iniciar as 12 questões.</p>`
          }
        ],
        locked: true
      },
      {
        id: "pos-venda",
        number: 9,
        title: "Pós-Venda e Retenção: O Ciclo Completo",
        subtitle: "De comprador a fã: como transformar resultados em indicações",
        icon: "🔄",
        color: "from-sky-600 to-blue-600",
        duration: "50 min",
        summary: "O pós-venda é onde os maiores lançamentos são decididos. Clientes que têm resultado indicam, compram de novo e protegem sua reputação quando alguém questiona seu trabalho.",
        lessons: [
          {
            id: "onboarding",
            title: "Onboarding: Os Primeiros 7 Dias Decidem Tudo",
            duration: "18 min",
            type: "text",
            keyPoints: ["Por que 70% dos abandonos acontecem na primeira semana", "Sequência de boas-vindas de alto impacto", "Quick wins planejados", "Gamificação no onboarding"],
            content: `<h2>Os 7 Dias Mais Importantes da Jornada do Aluno</h2>
<p>Pesquisas de SaaS e produtos digitais são consistentes: <strong>70% dos cancelamentos e abandonos acontecem nos primeiros 7 dias</strong>. O comprador que não vê valor rápido racionaliza a compra como erro e desengaja — primeiro dos conteúdos, depois da comunidade, depois do produto inteiro.</p>

<p>Onboarding não é burocracia de acesso. É a arquitetura da primeira experiência.</p>

<h3>A Sequência de Boas-Vindas em 7 Dias</h3>

<p><strong>Dia 1 — A Boas-Vindas Calorosa:</strong><br/>
Email pessoal do produtor (não da plataforma). Tom humano, não corporativo. Confirma a decisão de compra. Diz o que esperar. Link de acesso.</p>

<p><strong>Dia 2 — O Quick Win:</strong><br/>
Entregue algo acionável que o aluno pode implementar em 30 minutos e ver resultado. Não precisa ser grande — precisa ser rápido e visível. Isso cria o ciclo: "funciona, vou continuar".</p>

<p><strong>Dia 3 — A Comunidade:</strong><br/>
Apresente o grupo/comunidade. Peça que o aluno se apresente. Crie o primeiro senso de pertencimento.</p>

<p><strong>Dia 5 — O Check-in:</strong><br/>
"Já acessou? Tem alguma dúvida? O que achou até agora?" — humaniza o suporte e identifica alunos em risco de churn.</p>

<p><strong>Dia 7 — O Primeiro Marco:</strong><br/>
Celebre quem concluiu a primeira semana. Mesmo que seja pequeno. Reconhecimento público no grupo cria narrativa de progresso.</p>

<h3>Quick Wins Planejados</h3>
<p>O quick win ideal tem 3 características:</p>
<ol>
  <li>Pode ser feito em menos de 1 hora</li>
  <li>Gera um resultado visível (número, resultado, screenshot)</li>
  <li>É o primeiro passo real para o resultado final do produto</li>
</ol>

<blockquote>O aluno que implementa algo na primeira semana tem 5x mais chance de completar o curso e 8x mais chance de indicar para alguém. O investimento em onboarding tem o maior ROI de toda a operação de pós-venda.</blockquote>`
          },
          {
            id: "indicacoes",
            title: "Programa de Indicação: Crescimento Orgânico pelo Boca a Boca",
            duration: "20 min",
            type: "text",
            keyPoints: ["Por que indicação é o canal mais barato e de maior qualidade", "Como estruturar um programa formal de indicação", "Incentivos que funcionam", "NPS e como usar o feedback"],
            content: `<h2>Indicação: O Canal que a Maioria Subutiliza</h2>
<p>Um lead vindo de indicação converte em média <strong>3-5x mais</strong> do que um lead de anúncio pago. A razão é óbvia: ele chega com prova social embutida — alguém de confiança já validou o produto para ele.</p>

<p>Apesar disso, a maioria dos produtores deixa as indicações acontecerem organicamente, sem estrutura. Criar um programa formal de indicação pode dobrar esse volume sem custo adicional de aquisição.</p>

<h3>Os 3 Modelos de Programa de Indicação</h3>

<h3>1. Programa de Afiliados para Alunos</h3>
<p>Transforme seus melhores alunos em afiliados. Eles promovem porque acreditam no produto; você paga comissão apenas quando há venda. Sem resultado, sem custo.</p>
<p>Critério de elegibilidade: alunos que concluíram o produto + tiveram resultado documentado.</p>

<h3>2. Give to Get (Dê para Receber)</h3>
<p>O aluno ganha algo de valor ao indicar alguém que se cadastra (não necessariamente compra). Pode ser uma aula bônus, um mês de membership grátis, desconto na próxima compra.</p>
<p>Funciona bem para gerar leads qualificados mesmo sem venda imediata.</p>

<h3>3. Programa de Embaixadores</h3>
<p>Um grupo seleto de alunos que têm acesso privilegiado (calls exclusivas com você, conteúdo antecipado, créditos) em troca de representar o produto ativamente — criando conteúdo, respondendo dúvidas, sendo referência para o mercado.</p>

<h3>NPS: Medindo a Satisfação de Forma Acionável</h3>
<p>O NPS (Net Promoter Score) é a métrica mais simples e poderosa de satisfação. Uma única pergunta: "Em uma escala de 0 a 10, qual a probabilidade de você recomendar este produto a um amigo ou colega?"</p>
<ul>
  <li>9-10: Promotores — seus potenciais embaixadores</li>
  <li>7-8: Passivos — satisfeitos mas não entusiasmados</li>
  <li>0-6: Detratores — risco de churn e reputação negativa</li>
</ul>
<p>NPS = % Promotores - % Detratores. Acima de 50 é excelente para o mercado de infoprodutos.</p>

<p>Use o NPS não apenas para medir — use para agir:</p>
<ul>
  <li>Promotores: convide para o programa de embaixadores</li>
  <li>Passivos: entenda o que falta para virar promotor</li>
  <li>Detratores: reaja rápido, ofereça suporte, salve o relacionamento</li>
</ul>

<blockquote>Cada Detrator que você transforma em Promotor vale duas vezes: você eliminou a ameaça de reputação negativa e criou um novo canal de indicação. A gestão de Detratores é o trabalho mais rentável do pós-venda.</blockquote>`
          }
        ],
        locked: true
      }
    ]
  },
  {
    id: "ferramentas-plataformas",
    number: 4,
    title: "Ferramentas e Plataformas do Marketing Digital",
    description: "Domine o ecossistema de ferramentas que os maiores produtores usam. De criação de conteúdo a agendamento, análise e automação — cada plataforma tem seu jogo e suas regras.",
    badge: "Ferramentas",
    chapters: [
      {
        id: "instagram-tiktok",
        number: 10,
        title: "Instagram e TikTok: Orgânico de Alto Impacto",
        subtitle: "Os algoritmos, formatos e estratégias de crescimento que funcionam em 2025",
        icon: "📱",
        color: "from-pink-600 to-rose-600",
        duration: "1h 45min",
        summary: "Instagram e TikTok são os dois motores de crescimento orgânico mais poderosos do marketing digital. Cada um tem lógica própria — entender as diferenças é o que separa quem cresce de quem estagna.",
        lessons: [
          {
            id: "tiktok-algoritmo",
            title: "TikTok: O Algoritmo que Democratizou o Alcance",
            duration: "25 min",
            type: "text",
            keyPoints: ["Como o FYP (For You Page) funciona de verdade", "Os 3 estágios de distribuição de um vídeo", "Retenção é a métrica-rainha", "Estratégia de nicho antes de escalar"],
            content: `<h2>TikTok: A Plataforma que Quebrou as Regras do Jogo</h2>
<p>O TikTok é a única plataforma onde uma conta com zero seguidores pode viralizar no primeiro vídeo. Isso não é marketing — é a arquitetura do algoritmo. Entender isso muda completamente sua estratégia.</p>

<h3>Como o Algoritmo do TikTok Realmente Funciona</h3>
<p>Cada vídeo passa por estágios progressivos de distribuição. O TikTok não entrega seu conteúdo para toda a base — ele testa em grupos pequenos e expande para grupos maiores com base nas métricas de performance.</p>

<h3>Estágio 1: Pequeno Grupo de Teste (100-500 visualizações)</h3>
<p>Seu vídeo é mostrado para um grupo inicial. O algoritmo mede: taxa de conclusão do vídeo, taxa de interação (likes, comentários, shares, saves) e taxa de rewatch (pessoas que assistem mais de uma vez). Se as métricas ficam acima do threshold do nicho, o vídeo avança.</p>

<h3>Estágio 2: Expansão Moderada (1.000-50.000 visualizações)</h3>
<p>Vídeos que passaram no estágio 1 são mostrados para um grupo maior. As mesmas métricas são medidas, com threshold mais exigente. É aqui que a maioria dos vídeos para.</p>

<h3>Estágio 3: Viral (100k+)</h3>
<p>Vídeos que consistentemente superam os thresholds dos dois primeiros estágios entram no pool de distribuição ampla — o FYP global. Isso pode acontecer 2 dias ou 3 meses depois da publicação.</p>

<h3>A Métrica-Rainha: Taxa de Retenção</h3>
<p>De todas as métricas, a que o TikTok mais valoriza é a retenção — quanto do vídeo as pessoas assistem. Um vídeo de 30 segundos assistido até o fim supera um vídeo de 3 minutos assistido até a metade.</p>

<p>Benchmarks por tipo de conteúdo:</p>
<ul>
  <li>Vídeos de 15-30s: retenção alvo &gt;80%</li>
  <li>Vídeos de 1-2 min: retenção alvo &gt;60%</li>
  <li>Vídeos de 3-5 min: retenção alvo &gt;45%</li>
</ul>

<h3>Estrutura dos Primeiros 3 Segundos</h3>
<p>O hook decide tudo. As primeiras palavras ou imagem do vídeo determinam se a pessoa vai parar o scroll ou seguir em frente. Hooks que funcionam:</p>
<ul>
  <li><strong>Promessa de resultado:</strong> "Em 60 segundos vou te mostrar como faturei R$30k este mês"</li>
  <li><strong>Contraintuitivo:</strong> "Pare de postar todo dia no TikTok — isso está te prejudicando"</li>
  <li><strong>Pergunta polarizante:</strong> "Você ainda acredita que precisa de muita audiência para vender?"</li>
  <li><strong>Número específico:</strong> "7 erros que 95% dos produtores digitais cometem"</li>
</ul>

<h3>Estratégia de Nicho antes de Escalar</h3>
<p>O erro mais comum no TikTok é tentar ser relevante para todos. O algoritmo aprende com o tempo quem é sua audiência. Quanto mais consistente o nicho, mais eficiente a distribuição.</p>
<p>Defina: 1 problema central + 1 audiência específica. Fique nesse eixo por pelo menos 30 vídeos antes de diversificar.</p>

<h3>Ferramentas Essenciais para TikTok</h3>
<ul>
  <li><strong>TikTok Studio:</strong> analytics nativo, tendências de hashtags, performance por vídeo</li>
  <li><strong>CapCut:</strong> editor nativo integrado ao TikTok, templates virais, legendas automáticas</li>
  <li><strong>Tokboard / Pentos:</strong> análise competitiva — veja o que está viralizando no seu nicho</li>
  <li><strong>Creator Search Insights:</strong> ferramenta nativa que mostra o que as pessoas estão buscando no TikTok</li>
</ul>

<blockquote>O TikTok é a plataforma que mais recompensa consistência e qualidade de retenção. Um produtor com 500 seguidores pode ter mais impacto de vendas que outro com 50 mil — se seus vídeos terminam no FYP certo.</blockquote>`
          },
          {
            id: "instagram-estrategia",
            title: "Instagram: Reels, Carrosséis e a Estratégia de Conversão",
            duration: "28 min",
            type: "text",
            keyPoints: ["Reels vs. Feed vs. Stories: o papel de cada formato", "O algoritmo do Instagram em 2025", "Carrosséis de alto salvamento", "Bio e link na bio como funil"],
            content: `<h2>Instagram: A Plataforma de Relacionamento e Conversão</h2>
<p>O Instagram perdeu a batalha do alcance orgânico puro para o TikTok, mas ganhou outra batalha: <em>profundidade de relacionamento</em>. Enquanto o TikTok viraliza, o Instagram converte. Entender isso define a estratégia certa para cada plataforma.</p>

<h3>Os 4 Formatos e o Papel de Cada Um</h3>

<h3>Reels: Topo de Funil e Descoberta</h3>
<p>O único formato do Instagram com distribuição orgânica relevante para quem não te segue. Use Reels para ser descoberto. Estrutura: hook nos primeiros 2 segundos, conteúdo de valor comprimido, CTA para seguir ou salvar.</p>
<p>Duração ideal em 2025: 7-30 segundos para entretenimento, 30-90 segundos para educação.</p>

<h3>Carrosséis: O Formato que o Algoritmo Ama</h3>
<p>Carrosséis têm a maior taxa de salvamento do Instagram — e salvamento é o sinal mais forte de valor que você pode dar ao algoritmo. A lógica: quando alguém salva, está dizendo "quero voltar aqui".</p>
<p>Estrutura de carrossel de alto impacto:</p>
<ul>
  <li>Slide 1: Promessa irresistível (o que a pessoa vai aprender/ganhar)</li>
  <li>Slides 2-8: Conteúdo desmembrado — um ponto por slide, visual limpo</li>
  <li>Slide final: CTA claro (salvar, comentar com uma palavra, seguir)</li>
</ul>

<h3>Stories: Relacionamento e Conversão Direta</h3>
<p>Stories são vistas por quem já te segue — é o formato de relacionamento. Use para bastidores, enquetes, perguntas, countdown de lançamento e links diretos (qualquer conta pode usar link nos stories).</p>
<p>Taxa de conclusão de stories alvo: &gt;70%. Se está abaixo, seus stories são longos demais ou sem ritmo.</p>

<h3>Feed Estático: Portfólio e Credibilidade</h3>
<p>O feed é o que alguém vê quando abre seu perfil pela primeira vez. É o currículo visual. Foque em consistência estética e conteúdo que mostre autoridade no nicho.</p>

<h3>O Algoritmo do Instagram em 2025</h3>
<p>Quatro métricas que o Instagram usa para distribuição:</p>
<ol>
  <li><strong>Interesse previsto:</strong> com base no histórico do usuário, o Instagram estima a probabilidade de interação</li>
  <li><strong>Relacionamento:</strong> contas com quem o usuário interage frequentemente têm prioridade</li>
  <li><strong>Tempo de visualização:</strong> especialmente para Reels — retenção é o sinal principal</li>
  <li><strong>Popularidade:</strong> velocidade de engajamento nas primeiras horas após publicação</li>
</ol>

<h3>Bio como Funil: A Página de Captura Mais Visitada</h3>
<p>Sua bio do Instagram é visitada por cada pessoa que considera te seguir. Trate como uma mini landing page:</p>
<ul>
  <li>Linha 1: quem você ajuda e com o quê</li>
  <li>Linha 2: prova de resultado (número, credencial, marco)</li>
  <li>Linha 3: CTA + link na bio</li>
</ul>
<p>Ferramentas de link na bio: Linktree, Bio.site, ou uma página própria. Prefira domínio próprio para analytics completo.</p>

<h3>Ferramentas para Instagram</h3>
<ul>
  <li><strong>Meta Business Suite:</strong> agenda posts + stories, analytics unificado Instagram + Facebook</li>
  <li><strong>Later / Buffer:</strong> agendamento visual, análise de melhor horário de postagem</li>
  <li><strong>Canva:</strong> templates de carrossel, stories e feed com identidade visual consistente</li>
  <li><strong>Metricool:</strong> analytics avançado, comparação com concorrentes, relatórios automáticos</li>
</ul>`
          },
          {
            id: "facebook-youtube",
            title: "Facebook e YouTube: Audiência Madura e Conteúdo Longo",
            duration: "22 min",
            type: "text",
            keyPoints: ["Facebook Groups como comunidade de lançamento", "YouTube: o maior buscador de vídeo do mundo", "Shorts vs. vídeos longos: quando usar cada um", "SEO de vídeo no YouTube"],
            content: `<h2>Facebook e YouTube: Onde Está a Audiência com Poder de Compra</h2>

<h3>Facebook em 2025: Grupos e Comunidade</h3>
<p>O alcance orgânico do Facebook para páginas está morto. Mas os <strong>Grupos do Facebook</strong> continuam sendo um dos ativos mais poderosos do marketing digital brasileiro — especialmente para lançamentos.</p>

<h3>Estratégia de Grupo de Lançamento</h3>
<p>Criar um grupo fechado como parte de uma sequência de lançamento é uma das táticas mais eficazes do mercado PT-BR:</p>
<ol>
  <li>Crie o grupo com nome relacionado ao resultado (não ao produto): "Grupo de Preparação para R$10k Online"</li>
  <li>Divulgue como isca — quem entra no grupo recebe acesso antecipado, conteúdo exclusivo</li>
  <li>Durante a pré-lançamento, publique conteúdo de valor diariamente (PDFs livros digitais, lives)</li>
  <li>No dia da abertura do carrinho, o grupo é o canal de maior conversão — pessoas já aquecidas, com prova social acumulada durante a preparação</li>
</ol>

<p>Grupos bem gerenciados têm taxa de abertura de posts orgânicos de 20-30% — muito superior ao email.</p>

<h3>Facebook Live: Alcance Ainda Funciona</h3>
<p>O algoritmo do Facebook ainda distribui Lives organicamente — muito mais do que posts comuns. Use lives durante a fase de preparação do lançamento para alcançar quem está no grupo e amigos dos membros.</p>

<h3>YouTube: O Ativo de Longo Prazo</h3>
<p>O YouTube tem uma característica única que nenhuma outra plataforma oferece: <em>conteúdo que continua gerando leads anos depois de publicado</em>. Um vídeo bem posicionado no YouTube pode trazer leads orgânicos por 3-5 anos.</p>

<h3>SEO de Vídeo: Como Ranquear no YouTube</h3>
<p>O YouTube é o segundo maior buscador do mundo. Otimize seus vídeos para busca:</p>
<ul>
  <li><strong>Título:</strong> palavra-chave principal no início, promessa clara (ex: "Como Criar seu Primeiro Produto Digital — Passo a Passo Completo")</li>
  <li><strong>Descrição:</strong> primeiras 2 linhas são críticas (aparecem antes do "ver mais"). Inclua keyword + link para captura</li>
  <li><strong>Tags:</strong> keyword principal + variações + termos relacionados</li>
  <li><strong>Thumbnail:</strong> rosto + texto com promessa + contraste alto. CTR de thumbnail alvo: &gt;5%</li>
  <li><strong>Capítulos:</strong> timestamps na descrição melhoram watch time e aparecem no Google</li>
</ul>

<h3>Shorts vs. Vídeos Longos</h3>
<ul>
  <li><strong>Shorts (até 60s):</strong> descoberta e topo de funil — funciona igual ao TikTok, ganha novos inscritos</li>
  <li><strong>Vídeos de 8-20 min:</strong> conteúdo educacional aprofundado, maior watch time, melhor monetização, ranqueia no Google</li>
  <li><strong>Estratégia combinada:</strong> Shorts para crescimento de audiência + vídeos longos para conversão</li>
</ul>

<h3>Ferramentas para YouTube</h3>
<ul>
  <li><strong>TubeBuddy / VidIQ:</strong> pesquisa de keywords, análise de concorrentes, grade de tags</li>
  <li><strong>YouTube Studio:</strong> analytics, revenue, public retention graph por segundo de vídeo</li>
  <li><strong>Descript:</strong> edição de vídeo por transcrição — perfeito para longos sem experiência em edição</li>
</ul>`
          },
          {
            id: "ferramentas-producao",
            title: "Stack de Ferramentas: Do Zero ao Profissional",
            duration: "20 min",
            type: "text",
            keyPoints: ["Ferramentas gratuitas vs. pagas: o que priorizar", "Stack de criação de conteúdo", "Ferramentas de agendamento e automação", "Analytics e monitoramento"],
            content: `<h2>O Stack de Ferramentas do Produtor Digital Profissional</h2>
<p>A maioria dos iniciantes erra na ordem: compra ferramentas antes de saber o que fazer com elas. Este guia organiza o stack por estágio — começando pelo essencial gratuito e progredindo para ferramentas pagas conforme o negócio cresce.</p>

<h3>Nível 1: Começando (Gratuito)</h3>
<ul>
  <li><strong>Canva (free):</strong> design de posts, stories, carrosséis, thumbnails</li>
  <li><strong>CapCut (free):</strong> edição de vídeos para TikTok e Reels, legendas automáticas</li>
  <li><strong>Meta Business Suite (free):</strong> agendamento e analytics para Instagram e Facebook</li>
  <li><strong>Google Analytics 4 (free):</strong> análise do site e rastreamento de conversões</li>
  <li><strong>Mailchimp (free até 500 contatos):</strong> email marketing básico</li>
  <li><strong>Hotmart / Kiwify (free para criar):</strong> hospedagem de produto digital, sistema de pagamento</li>
</ul>

<h3>Nível 2: Crescimento (R$100-R$500/mês)</h3>
<ul>
  <li><strong>Canva Pro:</strong> banco de imagens, remoção de fundo, brand kit, pastas de time</li>
  <li><strong>Later ou Buffer:</strong> agendamento multi-plataforma, análise de melhor horário</li>
  <li><strong>Metricool:</strong> analytics avançado de redes sociais, relatórios automáticos</li>
  <li><strong>ActiveCampaign / RD Station:</strong> email marketing com automação, lead scoring, CRM</li>
  <li><strong>Manychat:</strong> automação de DMs no Instagram e WhatsApp</li>
</ul>

<h3>Nível 3: Escala (R$500+/mês)</h3>
<ul>
  <li><strong>Adobe Premiere / DaVinci Resolve:</strong> edição de vídeo profissional</li>
  <li><strong>Riverside.fm:</strong> gravação de podcast e entrevistas em alta qualidade</li>
  <li><strong>EverWebinar / WebinarJam:</strong> webinars ao vivo e evergreen com alta conversão</li>
  <li><strong>Hotjar / Microsoft Clarity:</strong> mapas de calor, gravação de sessões no site</li>
  <li><strong>Deadline Funnel:</strong> deadlines individuais reais para funis perpétuos</li>
</ul>

<h3>Ferramentas de IA que Mudaram o Jogo</h3>
<ul>
  <li><strong>ChatGPT / Claude:</strong> geração de copy, roteiros, títulos, emails, estratégia de conteúdo</li>
  <li><strong>Midjourney / DALL-E:</strong> criação de imagens para thumbnails e criativos</li>
  <li><strong>ElevenLabs:</strong> narração com voz sintética profissional para vídeos</li>
  <li><strong>Opus Clip:</strong> corta automaticamente longos vídeos nos melhores trechos para Shorts/Reels/TikTok</li>
  <li><strong>Descript:</strong> edita vídeo editando o texto da transcrição</li>
</ul>

<blockquote>Ferramenta não substitui estratégia. Um funil mal pensado com as melhores ferramentas do mundo ainda vai falhar. Mas uma boa estratégia com ferramentas corretas escala sem esforço adicional. Invista em aprender o jogo antes de comprar o equipamento.</blockquote>`
          }
        ],
        locked: true
      }
    ]
  },
  {
    id: "meta-ads",
    number: 5,
    title: "Meta Ads — O Curso Definitivo",
    description: "Do zero ao avançado em Facebook e Instagram Ads. Estrutura de campanha, públicos, criativos, otimização e escala — tudo que você precisa para dominar o tráfego pago na Meta.",
    badge: "Meta Ads",
    chapters: [
      {
        id: "meta-fundamentos",
        number: 11,
        title: "Fundamentos do Meta Ads",
        subtitle: "Business Manager, Pixel, estrutura de campanha e primeiros anúncios",
        icon: "🎯",
        color: "from-blue-600 to-blue-800",
        duration: "2h",
        summary: "Antes de gastar R$1 em anúncios, você precisa entender a arquitetura da plataforma. Business Manager, Pixel, estrutura CBO/ABO e objetivos de campanha — a base que determina se seu dinheiro vai trabalhar ou desperdiçar.",
        lessons: [
          {
            id: "meta-bm",
            title: "Business Manager: Configuração Profissional do Zero",
            duration: "20 min",
            type: "text",
            keyPoints: ["Por que nunca anunciar pelo perfil pessoal", "Configuração completa do BM", "Pixel de conversão e eventos", "Domínio verificado e CAPI"],
            content: `<h2>Business Manager: A Infraestrutura que Protege seus Anúncios</h2>
<p>O erro mais comum de quem começa no Meta Ads é anunciar diretamente pela conta pessoal ou pela página sem o Business Manager. Isso é frágil — qualquer problema na conta pessoal derruba tudo. O Business Manager é a infraestrutura empresarial da Meta.</p>

<h3>O Que é o Business Manager</h3>
<p>É uma plataforma separada (business.facebook.com) que centraliza ativos de negócio: páginas, contas de anúncio, pixels, catálogos, públicos, equipe. Diferentes pessoas podem ter acesso a diferentes ativos com permissões granulares — sem compartilhar senha.</p>

<h3>Configuração em 8 Passos</h3>
<ol>
  <li>Acesse business.facebook.com e crie o negócio</li>
  <li>Adicione sua Página do Facebook (ou crie uma)</li>
  <li>Crie uma Conta de Anúncios (nunca use a pessoal)</li>
  <li>Adicione um método de pagamento à conta de anúncios</li>
  <li>Crie e instale o Pixel no site (via código ou integração)</li>
  <li>Verifique o domínio do seu site (crucial para rastreamento pós-iOS 14)</li>
  <li>Configure os eventos de conversão prioritários no gerenciador de eventos</li>
  <li>Ative a API de Conversões (CAPI) — essencial para rastreamento server-side</li>
</ol>

<h3>O Pixel: Seu Ativo Mais Valioso</h3>
<p>O Pixel é um código JavaScript que você instala no site. Ele rastreia o comportamento dos visitantes e envia esses dados para o Meta — permitindo que o algoritmo encontre pessoas parecidas com quem já comprou de você.</p>

<p>Eventos essenciais para configurar:</p>
<ul>
  <li><strong>PageView:</strong> disparado em todas as páginas — mínimo obrigatório</li>
  <li><strong>ViewContent:</strong> visita à página de vendas</li>
  <li><strong>InitiateCheckout:</strong> início do processo de compra</li>
  <li><strong>Purchase:</strong> compra concluída — com Value e Currency</li>
  <li><strong>Lead:</strong> cadastro de email ou WhatsApp</li>
</ul>

<h3>CAPI: A Solução para o Mundo Pós-iOS 14</h3>
<p>Com as restrições de privacidade do iOS 14+, o Pixel de navegador perdeu capacidade de rastreamento. A API de Conversões (CAPI) envia eventos diretamente do servidor — sem depender de cookies ou navegador.</p>
<p>Com CAPI configurado corretamente, a taxa de rastreamento sobe de 50-60% (só pixel) para 85-95%. Isso não é detalhe — é a diferença entre um algoritmo cego e um algoritmo preciso.</p>

<h3>Verificação de Domínio</h3>
<p>Após o iOS 14, a Meta exige que você verifique a propriedade do domínio antes de rastrear eventos. Sem isso, o Facebook pode restringir os eventos que aparecem nos seus relatórios.</p>
<p>Processo: Gerenciador de Negócios → Configurações → Domínios → Adicionar domínio → inserir meta-tag no cabeçalho do site ou arquivo DNS.</p>`
          },
          {
            id: "meta-estrutura",
            title: "Estrutura de Campanha: CBO, ABO e Objetivos",
            duration: "25 min",
            type: "text",
            keyPoints: ["Hierarquia: campanha → conjunto → anúncio", "CBO vs. ABO: quando usar cada um", "Objetivos corretos por fase do funil", "Como estruturar a primeira campanha"],
            content: `<h2>Estrutura de Campanha: A Hierarquia que Define Resultados</h2>
<p>O Meta Ads tem 3 níveis: Campanha (objetivo e orçamento global), Conjunto de Anúncios (público, placement, horário) e Anúncio (criativo, copy, CTA). Entender o papel de cada nível evita 90% dos erros de configuração.</p>

<h3>CBO: Orçamento ao Nível de Campanha</h3>
<p>No CBO (Campaign Budget Optimization), você define um orçamento total e o algoritmo distribui automaticamente entre os conjuntos — colocando mais verba em quem está performando melhor.</p>

<p><strong>Quando usar CBO:</strong></p>
<ul>
  <li>Quando você já tem dados históricos (pixel com pelo menos 50 conversões/semana)</li>
  <li>Quando quer escalar — o algoritmo tem mais liberdade para otimizar</li>
  <li>Quando os conjuntos dentro da campanha são competitivos entre si</li>
</ul>

<h3>ABO: Orçamento ao Nível de Conjunto</h3>
<p>No ABO (Ad Set Budget Optimization), você controla quanto cada conjunto recebe. Mais controle, menos otimização automática.</p>

<p><strong>Quando usar ABO:</strong></p>
<ul>
  <li>Fase de testes — você precisa de dados iguais por conjunto para comparação justa</li>
  <li>Quando um conjunto específico precisa de verba garantida (retargeting, por exemplo)</li>
  <li>Testes de público no início, antes de escalar</li>
</ul>

<h3>Objetivos de Campanha por Fase do Funil</h3>

<p><strong>Topo de Funil (descoberta):</strong></p>
<ul>
  <li>Awareness: alcance máximo, ótimo para branding e lançamento de novo produto</li>
  <li>Tráfego: leva pessoas ao site, bom para aquecer pixel com pouco investimento inicial</li>
  <li>Engajamento: otimiza para interações — útil para crescimento de página e testes de copy</li>
</ul>

<p><strong>Meio de Funil (consideração):</strong></p>
<ul>
  <li>Geração de Leads: formulário nativo do Meta — zero fricção, alta quantidade, qualidade variável</li>
  <li>Visualizações de Vídeo: ótimo para aquecimento de audiência para listas de retargeting</li>
</ul>

<p><strong>Fundo de Funil (conversão):</strong></p>
<ul>
  <li>Vendas / Conversões: o objetivo principal para quem quer compras — exige pixel configurado com evento de Purchase</li>
  <li>Mensagens: leva para WhatsApp ou Messenger — altíssima taxa de fechamento para high ticket</li>
</ul>

<h3>A Estrutura da Primeira Campanha</h3>
<p>Para quem está começando com pixel sem histórico:</p>
<pre>Campanha: Conversões (Lead) | ABO | R$50/dia total
├── Conjunto 1: Público Amplo (só segmentação por interesse 1) | R$20/dia
├── Conjunto 2: Lookalike 1% (de lista de clientes ou visitantes) | R$20/dia
└── Conjunto 3: Interesses específicos do nicho | R$10/dia</pre>
<p>Rode por 7 dias sem mexer. Deixe o algoritmo aprender. Analise CPL (custo por lead) e tome decisão com dados.</p>`
          },
          {
            id: "meta-publicos",
            title: "Públicos: Frio, Morno e Quente",
            duration: "25 min",
            type: "text",
            keyPoints: ["Público frio: interesses, lookalike e amplo", "Público morno: engajamento e visualizações de vídeo", "Público quente: retargeting de visitantes e lista", "Lookalike: a ferramenta mais poderosa do Meta Ads"],
            content: `<h2>Públicos: A Arte de Falar com a Pessoa Certa na Hora Certa</h2>
<p>O maior erro em Meta Ads não é o criativo ruim nem o copy fraco — é falar com a pessoa errada. Um anúncio perfeito para o público errado gera zero resultado. Um anúncio mediano para o público certo converte.</p>

<h3>A Temperatura dos Públicos</h3>

<h3>Público Frio: Quem Não Conhece Você</h3>
<p>São pessoas que nunca interagiram com seu negócio. O maior volume — e o maior custo por conversão.</p>

<p><strong>Tipos de público frio:</strong></p>
<ul>
  <li><strong>Segmentação por Interesse:</strong> pessoas que a Meta classifica como interessadas em temas relacionados ao seu nicho. Boa para início, mas saturada e imprecisa para escala.</li>
  <li><strong>Público Amplo:</strong> sem segmentação de interesse — deixa o algoritmo decidir quem ver o anúncio. Contraintuitivo, mas frequentemente supera interesses quando o pixel tem dados suficientes.</li>
  <li><strong>Lookalike (semelhante):</strong> o algoritmo encontra pessoas parecidas com seus melhores clientes. O mais poderoso tipo de público frio.</li>
</ul>

<h3>Construindo Lookalikes de Qualidade</h3>
<p>A qualidade do Lookalike depende da qualidade da fonte. Hierarquia de fontes (melhor para pior):</p>
<ol>
  <li>Lista de compradores (clientes que já pagaram)</li>
  <li>Lista de leads qualificados (quem comprou webinar, quiz, etc.)</li>
  <li>Visitantes da página de vendas (30 dias)</li>
  <li>Engajadores no Instagram/Facebook (60 dias)</li>
  <li>Seguidores da página (pior — muito genérico)</li>
</ol>

<p>Porcentagens do Lookalike:</p>
<ul>
  <li>1%: mais parecido com a fonte, menor volume</li>
  <li>2-5%: equilíbrio entre precisão e volume</li>
  <li>5-10%: muito volume, menos precisão — use só na escala</li>
</ul>

<h3>Público Morno: Quem Já Interagiu</h3>
<p>Pessoas que já tiveram algum contato com você — mais fáceis de converter que o público frio, mas menos volumosas.</p>
<ul>
  <li>Pessoas que engajaram com sua página do Facebook (30/60/90/180 dias)</li>
  <li>Pessoas que interagiram com seu perfil do Instagram</li>
  <li>Pessoas que assistiram pelo menos 50% de um vídeo específico</li>
  <li>Pessoas que abriram um formulário de lead</li>
</ul>

<h3>Público Quente: Retargeting</h3>
<p>Os públicos de maior conversão — e menor volume. Use para fechamento de vendas.</p>
<ul>
  <li>Visitantes da página de vendas (últimos 30 dias) que não compraram</li>
  <li>Pessoas que iniciaram o checkout mas não finalizaram</li>
  <li>Lista de leads (email ou telefone) que ainda não converteu</li>
  <li>Compradores — para ofertas de upsell</li>
</ul>

<blockquote>Uma campanha de retargeting bem configurada pode ter ROAS de 8-15x — muito superior aos 2-4x típicos do público frio. O motivo é simples: essas pessoas já sabem quem você é. O trabalho de aquecimento já foi feito.</blockquote>`
          },
          {
            id: "meta-criativos",
            title: "Criativos que Convertem: Vídeo, Imagem e Copy",
            duration: "30 min",
            type: "text",
            keyPoints: ["Os 3 segundos que decidem o resultado", "Estrutura de vídeo de anúncio que vende", "Copy de anúncio: primary text, headline e descrição", "Testes A/B de criativo", "UGC vs. produção profissional"],
            content: `<h2>Criativos: O Elemento que Mais Impacta o Resultado</h2>
<p>Dentro do Meta Ads, o criativo (imagem/vídeo + copy) é o fator que mais influencia a performance — muito mais do que público ou estrutura de campanha. Porque o criativo é o que determina quem clica e quem ignora.</p>

<h3>O Hook: Os 3 Primeiros Segundos</h3>
<p>Em um feed onde o usuário faz scroll em 1,7 segundo por post, você tem 3 segundos para parar o polegar. O hook do vídeo é o ativo mais valioso de todo o anúncio.</p>

<p><strong>Tipos de hook que funcionam:</strong></p>
<ul>
  <li><strong>Visual disruptivo:</strong> algo fora do padrão que forçe o olhar (contraste de cor, movimento, texto grande)</li>
  <li><strong>Pergunta de dor:</strong> "Você já tentou vender um produto digital e não vendeu nada?" — ativa o self-recognition</li>
  <li><strong>Resultado específico:</strong> "Como faturei R$87.420 em 7 dias com uma lista de 800 pessoas"</li>
  <li><strong>Contraintuitivo:</strong> "Pare de criar conteúdo todo dia" — vai contra o que a pessoa espera ouvir</li>
  <li><strong>Demonstração imediata:</strong> mostre o produto/resultado funcionando nos primeiros 2 segundos</li>
</ul>

<h3>Estrutura do Vídeo de Anúncio</h3>
<p>Para vídeos de 30-90 segundos (os mais eficazes em 2025):</p>
<ol>
  <li><strong>0-3s: Hook</strong> — para o scroll</li>
  <li><strong>3-10s: Problema</strong> — aprofunda a dor ou o desejo</li>
  <li><strong>10-40s: Solução</strong> — como você resolve (sem revelar tudo)</li>
  <li><strong>40-60s: Prova</strong> — resultado específico, depoimento, screenshot</li>
  <li><strong>60-90s: CTA</strong> — instrução clara do que fazer agora</li>
</ol>

<h3>UGC vs. Produção Profissional</h3>
<p>UGC (User Generated Content) — vídeos gravados de forma "caseira", geralmente na câmera frontal do celular — frequentemente superam produções profissionais em Meta Ads. Por quê?</p>
<ul>
  <li>Parece conteúdo orgânico, não anúncio — menos resistência do usuário</li>
  <li>Transmite autenticidade — mais confiança</li>
  <li>Menor custo de produção — permite mais testes</li>
</ul>
<p>Para produtos de alto ticket ou com forte componente aspiracional, produção profissional ainda tem seu lugar. Para o dia a dia, teste UGC primeiro.</p>

<h3>Copy de Anúncio: Cada Campo Tem uma Função</h3>

<p><strong>Primary Text (texto principal):</strong> O que aparece acima da imagem/vídeo. Primeiras 3 linhas são o mais importante — é o que aparece antes do "Ver mais". Estrutura: Hook de texto → Problema → Solução → CTA.</p>

<p><strong>Headline (título):</strong> Aparece abaixo da mídia, em negrito. Deve ser a maior promessa em menos de 40 caracteres. Ex: "De R$0 a R$10k: o método completo"</p>

<p><strong>Descrição:</strong> Aparece abaixo do título. Reforce o benefício ou adicione urgência. Ex: "Mais de 2.000 alunos já aplicaram"</p>

<h3>Quantos Criativos Testar?</h3>
<p>Para um conjunto de anúncios ativo, mantenha 3-5 criativos rodando simultaneamente. Quando um criativo começa a perder performance (CPM subindo, CTR caindo), substitua por novo — não pause o vencedor até que o novo prove ser melhor.</p>

<blockquote>O criativo é o único elemento do Meta Ads que você pode mudar sem reiniciar a fase de aprendizado. Mude público → campanha reinicia. Mude criativo → mantém o aprendizado. Por isso, o criativo deve ser seu principal laboratório de otimização.</blockquote>`
          },
          {
            id: "meta-otimizacao",
            title: "Otimização e Escala: Do R$50 ao R$5.000/dia",
            duration: "30 min",
            type: "text",
            keyPoints: ["Métricas que importam: CPM, CPC, CTR, CPL, ROAS", "Fase de aprendizado: o erro de mexer cedo", "Escala horizontal vs. vertical", "Regras de automatização e alertas", "Diagnóstico de campanha por problema"],
            content: `<h2>Otimização e Escala: Quando e Como Crescer</h2>
<p>A maioria das pessoas perde dinheiro no Meta Ads não porque as campanhas são ruins — mas porque mexem nelas cedo demais. Entender a fase de aprendizado e os sinais corretos para otimizar é o que separa quem escala de quem desperdiça verba.</p>

<h3>Métricas Essenciais e o que Significam</h3>
<ul>
  <li><strong>CPM (Custo por Mil Impressões):</strong> o preço que você paga pela atenção. Alto CPM não é problema se a conversão compensar. CPM médio Brasil por nicho: educação R$15-R$35, finanças R$40-R$80, fitness R$12-R$25.</li>
  <li><strong>CTR (Taxa de Cliques):</strong> % de quem viu o anúncio e clicou. Benchmarks: CTR no link &gt;1% é bom, &gt;2% é excelente. CTR baixo = criativo ou público errado.</li>
  <li><strong>CPC (Custo por Clique):</strong> quanto custa cada clique. Relevante mas não isoladamente — um CPC alto com alta conversão é melhor que CPC baixo com zero conversão.</li>
  <li><strong>CPL (Custo por Lead):</strong> o que realmente importa em campanhas de captura. Compare com o LTV do seu cliente.</li>
  <li><strong>ROAS (Retorno sobre Gasto em Anúncio):</strong> receita ÷ gasto em ads. ROAS de 3x significa que cada R$1 investido gerou R$3. Ponto de equilíbrio depende da margem do produto.</li>
</ul>

<h3>A Fase de Aprendizado: Não Mexa</h3>
<p>Quando você cria ou faz mudanças significativas em um conjunto de anúncios, o algoritmo entra em "fase de aprendizado". Precisa de 50 eventos de otimização para sair dessa fase. Mexer antes reinicia o contador.</p>
<p>O que fazer durante a fase de aprendizado: absolutamente nada. Observe. Anote. Não ajuste orçamento, não troque criativos, não mude o público. Aguarde pelo menos 7 dias ou 50 conversões.</p>

<h3>Escala Vertical: Aumentar o Orçamento</h3>
<p>Regra de ouro: aumento máximo de 20-30% do orçamento a cada 3-4 dias. Aumentos maiores reiniciam o aprendizado e desestabilizam o algoritmo.</p>
<p>Se você está em R$100/dia e quer chegar a R$500/dia:</p>
<ul>
  <li>Dia 1: R$100 → R$130</li>
  <li>Dia 4: R$130 → R$169</li>
  <li>Dia 8: R$169 → R$220</li>
  <li>Dia 12: R$220 → R$286</li>
  <li>Dia 16: R$286 → R$372</li>
  <li>Dia 20: R$372 → R$483</li>
</ul>

<h3>Escala Horizontal: Duplicar o que Funciona</h3>
<p>Em vez de aumentar o orçamento de um conjunto, duplique-o e aumente o orçamento na cópia. O conjunto original mantém seu histórico de aprendizado enquanto o novo busca novos bolsões de audiência.</p>

<h3>Diagnóstico por Problema</h3>
<ul>
  <li><strong>CPM alto + CTR baixo → Público muito restrito ou saturado:</strong> expanda o público ou troque de segmento</li>
  <li><strong>CTR bom + CPL alto → Problema na landing page:</strong> a pessoa clica mas não converte — revise a página</li>
  <li><strong>CPL bom + nenhuma venda → Problema na qualidade do lead:</strong> revise a segmentação ou a oferta</li>
  <li><strong>Performance boa depois deteriorando → Saturação:</strong> freqüência acima de 3 para público frio — renove criativos ou expanda público</li>
</ul>

<blockquote>O maior inimigo do Meta Ads não é o algoritmo — é a impaciência. Campanhas que seriam vencedoras são pausadas antes de completar a aprendizagem. Dados sem paciência são apenas ruído.</blockquote>`
          }
        ],
        locked: true
      },
      {
        id: "meta-avancado",
        number: 12,
        title: "Meta Ads Avançado: Lançamentos e Funis",
        subtitle: "Estrutura de campanha para lançamentos, retargeting em cascata e remarketing de lista",
        icon: "🚀",
        color: "from-indigo-600 to-violet-600",
        duration: "1h 30min",
        summary: "Aplicar Meta Ads em um lançamento tem dinâmica própria — diferentes fases exigem objetivos, públicos e criativos diferentes. Este capítulo cobre a estratégia completa de mídia paga para um lançamento de 7 dígitos.",
        lessons: [
          {
            id: "meta-lancamento",
            title: "Estrutura Completa de Mídia para um Lançamento",
            duration: "30 min",
            type: "text",
            keyPoints: ["As 4 fases da campanha de lançamento", "Orçamento por fase", "Objetivo por fase", "Retargeting em cascata"],
            content: `<h2>Mídia Paga no Lançamento: Uma Estratégia por Fase</h2>
<p>Um lançamento não é uma campanha — é um sistema de múltiplas campanhas com objetivos diferentes, rodando em paralelo e em sequência. A maioria perde dinheiro porque usa a mesma campanha do início ao fim.</p>

<h3>Fase 1: Aquecimento (D-21 a D-8)</h3>
<p><strong>Objetivo:</strong> construir audiência de remarketing barata antes de precisar dela</p>
<p><strong>Campanhas:</strong></p>
<ul>
  <li>Engajamento de vídeo (objetivo: visualizações de vídeo) — cria lista de quem assistiu 50%+</li>
  <li>Tráfego para artigos/conteúdo (objetivo: tráfego) — cria lista de visitantes do site</li>
</ul>
<p><strong>Orçamento:</strong> 15-20% do total de mídia do lançamento</p>
<p><strong>Meta:</strong> construir uma audiência de 10.000-50.000 pessoas aquecidas para o momento da abertura</p>

<h3>Fase 2: Captura / Pré-lançamento (D-7 a D-1)</h3>
<p><strong>Objetivo:</strong> capturar leads para a lista de espera / webinar de abertura</p>
<p><strong>Campanhas:</strong></p>
<ul>
  <li>Geração de leads para público frio (lookalike de compradores + interesses)</li>
  <li>Retargeting dos aquecidos da fase 1 com oferta de inscrição</li>
</ul>
<p><strong>Orçamento:</strong> 35-40% do total</p>
<p><strong>Meta:</strong> CPL inferior a 10% do ticket do produto. Para produto de R$997, CPL máximo aceitável: R$99</p>

<h3>Fase 3: Carrinho Aberto (D0 a D5)</h3>
<p><strong>Objetivo:</strong> conversão — vendas diretas</p>
<p><strong>Campanhas:</strong></p>
<ul>
  <li>Conversão (Purchase/Lead) para público frio — escala pesada aqui</li>
  <li>Retargeting de visitantes da página de vendas que não compraram</li>
  <li>Retargeting de quem iniciou checkout — os mais quentes</li>
  <li>Retargeting de leads da lista de espera que não compraram</li>
</ul>
<p><strong>Orçamento:</strong> 35-40% do total</p>

<h3>Fase 4: Fechamento (Últimas 24-48h)</h3>
<p><strong>Objetivo:</strong> urgência e recuperação de indecisos</p>
<p><strong>Campanhas:</strong></p>
<ul>
  <li>Retargeting pesado de visitantes recentes com copy de fechamento</li>
  <li>Mensagens (WhatsApp/Messenger) para leads quentes</li>
</ul>
<p><strong>Orçamento:</strong> 10% do total — menor volume, maior intensidade</p>
<p><strong>Frequência alvo:</strong> 5-8x para público de retargeting quente nas últimas 48h</p>

<h3>O Retargeting em Cascata</h3>
<p>Estruture os públicos de retargeting por temperatura decrescente, com diferentes criativos por nível:</p>
<ol>
  <li>Quem abandonou o checkout → Copy de objeção + urgência máxima</li>
  <li>Quem visitou a página de vendas 3+ vezes → Prova social + garantia em destaque</li>
  <li>Quem visitou a página 1 vez → Reapresentação da oferta com ângulo diferente</li>
  <li>Leads da lista que não visitaram a página → Copy de convite para a página de vendas</li>
</ol>`
          },
          {
            id: "meta-mensuração",
            title: "Mensuração Real: Attribution e o Relatório que Importa",
            duration: "25 min",
            type: "text",
            keyPoints: ["Modelos de atribuição: o que o Meta mostra vs. a realidade", "UTM tracking e Google Analytics como validação", "O relatório semanal de mídia paga", "Como apresentar ROAS real"],
            content: `<h2>Mensuração: Separando Dados Reais de Vanity Metrics</h2>
<p>O Meta Ads é um mestre em mostrar números que parecem ótimos mas escondem a verdade. Entender como funciona a atribuição é a diferença entre saber se você está lucrando ou iludindo a si mesmo.</p>

<h3>O Problema da Atribuição</h3>
<p>Atribuição é: quando há uma venda, qual anúncio/canal recebe o crédito? O Meta usa por padrão "7 dias após clique + 1 dia após visualização". Isso significa:</p>
<ul>
  <li>Se alguém viu seu anúncio (sem clicar) e comprou 23 horas depois — o Meta atribui a venda ao anúncio</li>
  <li>Se alguém clicou há 6 dias e comprou hoje — o Meta atribui a venda ao anúncio</li>
  <li>Se o mesmo comprador viu anúncios de 3 campanhas — todas as 3 podem contar a venda</li>
</ul>
<p>Resultado: o Meta frequentemente exibe ROAS 2-3x maior que o real. Não é fraude — é o modelo de atribuição.</p>

<h3>Como Medir o ROAS Real</h3>
<p>Três métodos complementares:</p>
<ol>
  <li><strong>UTM + Google Analytics:</strong> adicione parâmetros UTM em todos os anúncios (utm_source=facebook&utm_medium=paid&utm_campaign=nome). No GA4, veja receita atribuída por canal de forma independente.</li>
  <li><strong>Receita na plataforma de venda:</strong> compare total de receita no período com total gasto em ads. ROAS = receita total ÷ gasto em ads. Simples, mas real.</li>
  <li><strong>Pesquisa de origem:</strong> no obrigado da compra, pergunte "Como você nos encontrou?" — dados qualitativos complementam o quantitativo</li>
</ol>

<h3>Métricas por Nível de Campanha</h3>
<p>Não analise tudo no mesmo nível:</p>
<ul>
  <li><strong>Nível de campanha:</strong> ROAS total, custo por compra</li>
  <li><strong>Nível de conjunto:</strong> CPM, frequência, CTR — sinais de saúde do público</li>
  <li><strong>Nível de anúncio:</strong> CTR do link, custo por clique, hook rate (% que assistiu 3s do vídeo)</li>
</ul>

<h3>O Relatório Semanal de Mídia</h3>
<p>Toda semana, registre em planilha:</p>
<ul>
  <li>Gasto total por campanha</li>
  <li>Número de leads gerados e CPL</li>
  <li>Número de vendas atribuídas e ROAS do Meta</li>
  <li>Receita total da semana na plataforma de venda</li>
  <li>ROAS real (receita ÷ gasto)</li>
  <li>Top 3 criativos por CTR e top 3 por conversão</li>
</ul>
<p>Com 4 semanas de dados, você começa a ver padrões e a tomar decisões com confiança.</p>

<blockquote>Tratar o dashboard do Meta como verdade absoluta é o erro mais caro do tráfego pago. O Meta mede o que é conveniente para ele medir. Sua planilha, com dados da plataforma de venda + UTMs, é a fonte de verdade.</blockquote>`
          }
        ],
        locked: true
      }
    ]
  },
  {
    id: "nexos-ferramenta",
    number: 6,
    title: "NexOS AI — A Ferramenta Definitiva",
    description: "Você aprendeu a metodologia. Agora conheça a plataforma que executa tudo isso com inteligência artificial — do briefing ao carrinho aberto, de forma automática e auditável.",
    badge: "NexOS AI",
    chapters: [
      {
        id: "nexos-apresentacao",
        number: 13,
        title: "Por que o NexOS Existe",
        subtitle: "O problema que nenhuma ferramenta resolvia — até agora",
        icon: "⚡",
        color: "from-purple-600 to-indigo-700",
        duration: "45 min",
        summary: "Você estudou cada peça do lançamento: tráfego, copy, sequências, análise de métricas, tipos de lançamento, Meta Ads. Agora entenda por que executar tudo isso manualmente cria um teto invisível de receita — e como o NexOS quebra esse teto.",
        lessons: [
          {
            id: "nexos-problema",
            title: "O Teto Invisível do Produtor Digital",
            duration: "20 min",
            type: "text",
            keyPoints: ["Por que produtores de 6 dígitos travam antes dos 7", "O custo real de uma equipe de marketing completa", "O problema de coordenação entre especialistas", "A solução: inteligência de orquestração"],
            content: `<h2>O Teto Invisível: Por que Produtores Grandes Travam</h2>
<p>Você estudou tudo neste portal. Sabe como funciona o algoritmo do TikTok, como estruturar uma campanha de Meta Ads, como escrever copy que converte, como montar uma sequência de email de fechamento.</p>

<p>Agora imagine executar tudo isso simultaneamente, em um lançamento de 21 dias, com 5 plataformas de conteúdo, 3 campanhas de ads rodando em paralelo, uma sequência de 12 emails, 8 mensagens de WhatsApp por segmento, e tomar decisões de otimização com dados em tempo real.</p>

<p>Isso não é um trabalho de uma pessoa. Isso é um time.</p>

<h3>O Custo Real de um Time de Marketing Completo</h3>
<ul>
  <li>Estrategista de lançamento: R$8.000-R$15.000/mês</li>
  <li>Copywriter sênior: R$5.000-R$10.000/mês</li>
  <li>Gestor de tráfego: R$4.000-R$8.000/mês</li>
  <li>Social media manager: R$3.000-R$5.000/mês</li>
  <li>Analista de métricas: R$4.000-R$7.000/mês</li>
  <li>Designer de criativos: R$3.000-R$6.000/mês</li>
</ul>
<p><strong>Total: R$27.000-R$51.000/mês</strong> — antes de incluir ferramentas, plataformas e ads.</p>

<p>Para um produtor faturando R$50.000-R$100.000/mês, esse custo é proibitivo. Para quem está escalando do 6 para o 7 dígito, é o principal gargalo.</p>

<h3>O Problema de Coordenação</h3>
<p>Mesmo quem consegue montar o time enfrenta o problema de coordenação: o copywriter não sabe o que o gestor de tráfego descobriu nos criativos. O estrategista não está acompanhando as métricas em tempo real. O social media está postando sem saber que a taxa de cliques do email caiu.</p>

<p>Cada especialista trabalha em silos. As decisões de otimização chegam tarde. O lançamento acaba antes das melhorias serem implementadas.</p>

<h3>A Solução: Orquestração por Inteligência Artificial</h3>
<p>O NexOS AI foi construído para resolver exatamente este problema. É uma plataforma de orquestração de lançamentos onde múltiplos agentes de inteligência artificial trabalham em conjunto — cada um especializado em um domínio, todos sincronizados em tempo real.</p>

<p>Não é uma ferramenta que sugere copy. Não é um dashborad de métricas. É um sistema completo que pensa, cria, analisa, alerta e otimiza — enquanto você aprova as decisões estratégicas.</p>`
          },
          {
            id: "nexos-como-funciona",
            title: "Como o NexOS Funciona: Do Briefing ao Carrinho",
            duration: "25 min",
            type: "text",
            keyPoints: ["O intake conversacional com IA", "Geração automática de estratégia completa", "Produção de conteúdo multi-plataforma", "O monitor de lançamento em tempo real"],
            content: `<h2>Do Briefing ao Lançamento: O Fluxo Completo do NexOS</h2>

<h3>Etapa 1: Intake Inteligente</h3>
<p>Você começa descrevendo seu produto e objetivos em uma conversa com o agente de intake. Ele faz perguntas estruturadas — produto, audiência, histórico de lançamentos, metas de receita, recursos disponíveis — e ao final gera um <strong>Score de Prontidão</strong> que identifica gaps antes de avançar.</p>
<p>É como uma sessão com um estrategista sênior, mas disponível 24/7 e que nunca esquece nenhuma informação.</p>

<h3>Etapa 2: Geração de Estratégia</h3>
<p>Com base no intake, o NexOS gera automaticamente:</p>
<ul>
  <li>Posicionamento e ângulo principal do produto</li>
  <li>Mapa de público-alvo (primário, secundário, anti-público)</li>
  <li>Timeline de lançamento personalizada (7 a 21 dias)</li>
  <li>Track de receita recomendado baseado no seu histórico</li>
  <li>KPIs-alvo com benchmarks do mercado PT-BR</li>
  <li>Cronograma de conteúdo orgânico por plataforma</li>
</ul>
<p>Você revisa e aprova — ou pede ajustes. A estratégia é modificada em tempo real.</p>

<h3>Etapa 3: Produção de Conteúdo</h3>
<p>Aprovada a estratégia, o NexOS produz automaticamente:</p>
<ul>
  <li>Sequência completa de emails (pré-lançamento + carrinho + fechamento)</li>
  <li>Roteiros de Reels para cada fase do lançamento</li>
  <li>Roteiro completo de VSL</li>
  <li>Textos de WhatsApp segmentados por temperatura (hot/warm/cold)</li>
  <li>Copys de anúncios com variações por objetivo e fase</li>
  <li>Captions de Instagram/Facebook/TikTok com hashtags otimizadas</li>
</ul>
<p>Cada peça de conteúdo passa por você antes de ser publicada ou agendada.</p>

<h3>Etapa 4: Ativação e Automação</h3>
<p>Com um clique, a sequência é ativada. O NexOS agenda e dispara automaticamente emails e mensagens de WhatsApp nos dias e horários otimizados para cada segmento da lista.</p>

<h3>Etapa 5: Monitoramento em Tempo Real</h3>
<p>Durante o carrinho aberto, o painel de lançamento exibe em tempo real:</p>
<ul>
  <li>Receita acumulada e projeção para o fechamento</li>
  <li>Taxa de abertura e clique de cada email</li>
  <li>Engajamento por segmento (hot/warm/cold)</li>
  <li>Alertas automáticos quando métricas caem abaixo do threshold</li>
  <li>Sugestões de otimização geradas por IA quando detecta queda</li>
</ul>

<h3>Etapa 6: Pós-Lançamento e Memória</h3>
<p>Após o fechamento, o NexOS gera um relatório completo de performance e <em>armazena os aprendizados</em>. O próximo lançamento começa com todo o histórico do anterior — o sistema fica mais inteligente a cada campanha.</p>`
          }
        ]
      },
      {
        id: "nexos-diferenciais",
        number: 14,
        title: "NexOS na Prática: Funcionalidades e Diferenciais",
        subtitle: "Tudo que o NexOS faz que nenhuma outra ferramenta do mercado faz",
        icon: "🧠",
        color: "from-cyan-600 to-blue-600",
        duration: "1h",
        summary: "Conheça em detalhe as funcionalidades do NexOS que transformam a forma de operar um negócio digital: da detecção de fadiga criativa ao sistema de afiliados inteligente, cada recurso foi desenhado para remover gargalos reais.",
        lessons: [
          {
            id: "nexos-agentes",
            title: "Os 44 Agentes de IA: Especialistas Disponíveis 24/7",
            duration: "25 min",
            type: "text",
            keyPoints: ["6 categorias de agentes especializados", "Claude para estratégia, GPT-4o para copy, Gemini para analytics", "Como os agentes colaboram entre si", "O trail de auditoria de cada decisão de IA"],
            content: `<h2>44 Agentes Especializados: O Time que Trabalha Enquanto Você Dorme</h2>
<p>O NexOS é construído sobre uma arquitetura de múltiplos agentes de IA — cada um especializado em um domínio, usando o modelo de linguagem mais adequado para aquela tarefa.</p>

<h3>Por que Múltiplos Modelos?</h3>
<p>Nenhum modelo de IA é o melhor em tudo. O NexOS usa cada modelo onde ele brilha:</p>
<ul>
  <li><strong>Claude (Anthropic):</strong> raciocínio estratégico, análise de mercado, compliance, decisões complexas com múltiplas variáveis</li>
  <li><strong>GPT-4o (OpenAI):</strong> criatividade, copy persuasivo, roteiros, nuances linguísticas do PT-BR</li>
  <li><strong>Gemini (Google):</strong> análise de dados, otimização de métricas, padrões em grandes volumes de informação</li>
</ul>

<h3>As 6 Categorias de Agentes</h3>

<p><strong>Estratégia (8 agentes):</strong> Estrategista de Lançamento, Analista de Mercado, Arquiteto de Funil, Builder de Perfil, Agente de Compliance, Scoring de Prontidão, Otimizador de Posicionamento, Agente de Track</p>

<p><strong>Conteúdo (10 agentes):</strong> Copywriter Master, Criador de VSL, Roteirista de Reels, Redator de Email, Escritor de WhatsApp, Criador de Anúncios, Escritor de Carrossel, Gerador de Headlines, Criador de Sequência, Editor de Copy</p>

<p><strong>Audiência (7 agentes):</strong> Segmentador de Temperatura, Analista de Comportamento, Construtor de Lista, Otimizador de Conversão, Detector de Padrões, Agente de Referral, Analista de UTM</p>

<p><strong>Vídeo e Criativo (5 agentes):</strong> Diretor de Conceito, Roteirista de VSL, Criador de Script para Reels, Analista de Criativo, Gerador de Brief para Design</p>

<p><strong>Analytics (8 agentes):</strong> Monitor de Métricas, Detector de Fadiga Criativa, Analista de ROAS, Otimizador de Budget, Gerador de Alertas, Analista de Coorte, Calculador de LTV, Gerador de Relatório Semanal</p>

<p><strong>Automação (6 agentes):</strong> Dispatcher de Email, Respondedor de WhatsApp, Scheduler de Conteúdo, Monitor de Sequência, Integrador de Plataformas, Agente de Pós-Venda</p>

<h3>Auditoria Total: Toda Decisão de IA é Rastreável</h3>
<p>Cada ação dos agentes — cada email gerado, cada análise produzida, cada alerta disparado — fica registrada no log de auditoria com timestamp, modelo usado, tokens consumidos e resultado.</p>
<p>Você sempre sabe o que a IA fez, por que fez e quanto custou. Não há caixa preta.</p>`
          },
          {
            id: "nexos-recursos",
            title: "Recursos Exclusivos: Do que Nenhuma Outra Ferramenta Tem",
            duration: "30 min",
            type: "text",
            keyPoints: ["Score de prontidão pré-lançamento", "Detecção automática de fadiga criativa", "Sequência de automação com dispatch inteligente", "Painel de lançamento ao vivo", "Sistema de afiliados com tracking server-side"],
            content: `<h2>Funcionalidades que Definem uma Categoria Própria</h2>

<h3>1. Score de Prontidão para Lançamento</h3>
<p>Antes de qualquer campanha começar, o NexOS analisa 27 variáveis do seu negócio e produto — lista, autoridade, prova social, infraestrutura técnica, histórico de lançamentos — e gera um Score de 0 a 100.</p>
<p>Abaixo de 60 pontos, o sistema identifica os gaps específicos e sugere ações para fechar antes de avançar. É o checkup pré-lançamento que evita lançamentos falhos por problemas evitáveis.</p>

<h3>2. Detecção de Fadiga Criativa</h3>
<p>O sistema monitora automaticamente o histórico de CTR dos criativos ao longo do tempo. Quando o CTR atual cai abaixo de 70% do pico histórico, um alerta é gerado: "Fadiga criativa detectada — CTR caiu X% do pico. Recomendação: renovar ângulo do criativo com foco em [sugestão específica]."</p>
<p>Isso vale tanto para ads de Meta quanto para taxa de abertura de emails e Reels de orgânico.</p>

<h3>3. Dispatch Inteligente por Segmento de Temperatura</h3>
<p>A sequência de automação do NexOS não trata todos os contatos igual. Com base no comportamento (aberturas, cliques, respostas, compras), cada contato é classificado automaticamente como <em>hot</em>, <em>warm</em> ou <em>cold</em>.</p>
<p>Nos momentos críticos do carrinho (abertura, meio, fechamento), o sistema despacha automaticamente copy diferente para cada segmento:</p>
<ul>
  <li><strong>Hot:</strong> angle de insider e VIP — "você já provou que age"</li>
  <li><strong>Warm:</strong> urgência padrão com reforço de benefício principal</li>
  <li><strong>Cold:</strong> reativação com curiosidade e nova perspectiva</li>
</ul>

<h3>4. Painel de Lançamento ao Vivo</h3>
<p>Durante o carrinho aberto, um painel em tempo real exibe: receita acumulada x meta, cadência de vendas por hora, performance de cada email da sequência, engajamento de WhatsApp por segmento e saúde geral do lançamento em um score de 0 a 100.</p>
<p>O painel é atualizado a cada 60 segundos e emite alertas sonoros quando métricas críticas ficam abaixo do threshold definido na estratégia.</p>

<h3>5. Viragem Automática de Sequência (Afiliado → Comprador)</h3>
<p>Integrado com as principais plataformas (Hotmart, Kiwify, Eduzz), o NexOS detecta automaticamente quando um contato da sequência realiza uma compra. Imediatamente:</p>
<ul>
  <li>O contato é removido da sequência de venda (para de receber copy de conversão)</li>
  <li>É adicionado à sequência de onboarding</li>
  <li>Score de engajamento atualizado para 100</li>
  <li>Evento de conversão disparado para Meta CAPI e TikTok Events API</li>
</ul>

<h3>6. Relatório Semanal Automático</h3>
<p>Todo domingo às 20h, o NexOS envia automaticamente um relatório de performance para o email do proprietário da workspace: receita da semana, vendas, saúde da lista, score de engajamento das sequências, créditos de IA usados e insights gerados pela análise de coorte.</p>

<h3>7. Rastreamento Server-Side (Meta CAPI + TikTok Events)</h3>
<p>Toda captura de lead e compra rastreada pelo NexOS é automaticamente enviada para Meta CAPI e TikTok Events API via servidor — independente de bloqueadores de anúncio, iOS 14 e cookies de terceiros. Taxa de rastreamento de 90-95% vs. 50-60% do pixel de navegador isolado.</p>`
          },
          {
            id: "nexos-planos",
            title: "Planos, Créditos e Como Começar",
            duration: "15 min",
            type: "text",
            keyPoints: ["Plano Solo vs. Agency", "Como funcionam os créditos de IA", "Primeiros passos: de zero a primeiro lançamento", "Suporte e comunidade"],
            content: `<h2>Como Começar no NexOS</h2>

<h3>Os Planos</h3>

<h3>Solo — R$297/mês</h3>
<p>Para produtores independentes e pequenas operações:</p>
<ul>
  <li>3 campanhas simultâneas</li>
  <li>1.500 créditos de IA por mês</li>
  <li>Acesso ao track de 6 dígitos (R$100k-R$999k)</li>
  <li>Todos os 44 agentes de IA</li>
  <li>Automação de sequências email + WhatsApp</li>
  <li>Painel de métricas e relatório semanal</li>
  <li>Suporte por email em 24h</li>
</ul>

<h3>Agency — R$1.497/mês</h3>
<p>Para agências, lançadores profissionais e operações de escala:</p>
<ul>
  <li>10 campanhas simultâneas</li>
  <li>5.000 créditos de IA por mês</li>
  <li>Todos os tracks (6, 8 e 10 dígitos)</li>
  <li>White-label — sua marca na plataforma</li>
  <li>Gestão de clientes (sub-workspaces)</li>
  <li>Acesso prioritário a novas funcionalidades</li>
  <li>Suporte por WhatsApp em 4h</li>
</ul>

<h3>Como Funcionam os Créditos</h3>
<p>Créditos de IA representam o custo de processamento dos modelos de linguagem. Cada ação consome créditos proporcionais ao seu custo real:</p>
<ul>
  <li>Geração de estratégia completa: ~80 créditos</li>
  <li>Email completo gerado: ~5 créditos</li>
  <li>Roteiro de Reel: ~3 créditos</li>
  <li>Análise de métricas semanal: ~15 créditos</li>
  <li>Resposta automática de WhatsApp: ~2 créditos</li>
</ul>
<p>O plano Solo de 1.500 créditos suporta confortavelmente 3 lançamentos completos por mês.</p>

<h3>Primeiros Passos: Protocolo de Onboarding</h3>
<ol>
  <li><strong>Dia 1:</strong> Configure a workspace — nome do negócio, logo, dados fiscais, integração com email e WhatsApp</li>
  <li><strong>Dia 2:</strong> Conecte as integrações — Meta Ads, plataforma de venda (Hotmart/Kiwify), RD Station ou ActiveCampaign</li>
  <li><strong>Dia 3:</strong> Faça o intake do seu primeiro produto — 15-20 minutos de conversa com o agente</li>
  <li><strong>Dia 4:</strong> Revise e aprove a estratégia gerada. Solicite ajustes se necessário</li>
  <li><strong>Dia 5:</strong> Aprove o primeiro lote de conteúdo gerado</li>
  <li><strong>Dia 6:</strong> Ative a sequência e veja o primeiro disparo automático</li>
  <li><strong>Dia 7:</strong> Seu lançamento está rodando</li>
</ol>

<blockquote>O NexOS não é uma promessa de resultado — é uma alavanca de execução. Quanto mais você domina a metodologia que aprendeu neste portal, mais inteligentemente você usa a plataforma. Você é o estrategista; o NexOS é o time de execução.</blockquote>`
          }
        ],
        locked: true
      }
    ]
  }
];

export const PRODUCTS = [
  {
    id: "mini-guide",
    name: "Mini-Guia: Primeiros R$10k Online",
    price: 10,
    type: "isca" as const,
    description: "O caminho mais rápido para sua primeira renda digital. 47 páginas direto ao ponto.",
    features: [
      "47 páginas de conteúdo denso",
      "Checklist de lançamento em 7 dias",
      "Planilha de projeção de receita",
      "3 estudos de caso reais"
    ],
    badge: "Isca Digital"
  },
  {
    id: "complete-bundle",
    name: "Metodologia NexOS — Edição Completa",
    price: 2500,
    type: "premium" as const,
    description: "O ebook mais completo sobre lançamentos digitais do Brasil + slides profissionais + acesso ao portal de treinamento.",
    features: [
      "Ebook de 380+ páginas (PDF + ePub)",
      "192 slides em 8 módulos (PowerPoint + Keynote)",
      "Acesso vitalício ao portal de treinamento",
      "Atualizações por 2 anos",
      "Comunidade exclusiva no WhatsApp",
      "3 templates de VSL prontos",
      "Swipe file com 200+ exemplos",
      "Suporte prioritário por email"
    ],
    badge: "Mais Completo"
  }
];
