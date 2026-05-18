export interface Lesson {
  id: string;
  title: string;
  duration: string;
  type: "text" | "video" | "exercise" | "quiz";
  content: string;
  keyPoints: string[];
  glossaryTerms?: string[];
  exercise?: string;
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
            glossaryTerms: ["algoritmo-de-recomendacao", "hook-rate", "completion-rate"],
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
            glossaryTerms: ["algoritmo-de-recomendacao", "completion-rate", "rewatch-rate", "saves", "shadow-ban"],
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
  },
  {
    id: "algoritmos",
    number: 7,
    title: "Algoritmos: A Ciência de Ser Visto",
    description: "Entenda como cada algoritmo pensa, o que ele quer maximizar e como você pode usá-lo como alavanca — não lutar contra ele. TikTok, Instagram, YouTube, Facebook, Google e os padrões universais que governam todos eles.",
    badge: "Algoritmos",
    chapters: [
      {
        id: "algoritmos-fundamentos",
        number: 15,
        title: "A Lógica Universal dos Algoritmos",
        subtitle: "O que todo algoritmo de recomendação tem em comum — e como usar isso",
        icon: "🧮",
        color: "from-slate-600 to-gray-700",
        duration: "1h 20min",
        summary: "Antes de entender cada plataforma individualmente, existe uma lógica comum que governa todos os algoritmos de recomendação. Quem entende essa lógica consegue adaptar qualquer plataforma nova em dias — não meses.",
        lessons: [
          {
            id: "algo-o-que-e",
            title: "O que é um Algoritmo de Recomendação e o que ele Quer",
            duration: "22 min",
            type: "text",
            keyPoints: ["O objetivo real de todo algoritmo: maximizar tempo na plataforma", "Sinal implícito vs. sinal explícito", "O loop de feedback que alimenta o algoritmo", "Por que o algoritmo não é seu inimigo — é um espelho"],
            content: `<h2>O Algoritmo não é Mágica — é Otimização</h2>
<p>Todo algoritmo de recomendação de plataforma digital tem um único objetivo central: <strong>maximizar o tempo que o usuário passa na plataforma</strong>. Não é para ajudar o criador, não é para entregar o melhor conteúdo do mundo — é para manter as pessoas rolando, assistindo e interagindo o máximo possível.</p>

<p>Entender isso muda completamente a perspectiva. Você não precisa "enganar" o algoritmo. Você precisa <em>criar conteúdo que faz as pessoas ficarem</em> — e o algoritmo distribui automaticamente.</p>

<h3>A Equação Fundamental</h3>
<p>Todo algoritmo de recomendação, em qualquer plataforma, resolve uma variante da mesma equação:</p>
<pre>Score do Conteúdo = f(Engajamento, Retenção, Relevância, Frescor)</pre>

<ul>
  <li><strong>Engajamento:</strong> curtidas, comentários, compartilhamentos, saves, cliques — interações que sinalizam que o conteúdo provocou uma reação</li>
  <li><strong>Retenção:</strong> quanto tempo a pessoa passou consumindo aquele conteúdo — o sinal mais honesto de valor</li>
  <li><strong>Relevância:</strong> o quão bem o conteúdo combina com o histórico e os interesses daquele usuário específico</li>
  <li><strong>Frescor:</strong> conteúdo recente tem vantagem inicial, mas perde para conteúdo com mais sinais acumulados com o tempo</li>
</ul>

<h3>Sinais Implícitos vs. Explícitos</h3>
<p>Os algoritmos aprenderam a confiar mais em sinais <em>implícitos</em> — comportamento do usuário que revela preferência real — do que em sinais <em>explícitos</em> como curtidas.</p>

<p><strong>Sinais implícitos (mais pesados no algoritmo):</strong></p>
<ul>
  <li>Tempo de visualização do vídeo (retenção)</li>
  <li>Rolar de volta para reler uma parte</li>
  <li>Assistir ao vídeo mais de uma vez (rewatch)</li>
  <li>Parar o scroll e ficar na tela por mais de 3 segundos</li>
  <li>Abrir o perfil depois de ver o conteúdo</li>
  <li>Salvar o post para ver depois</li>
</ul>

<p><strong>Sinais explícitos (menos peso, mais fáceis de manipular):</strong></p>
<ul>
  <li>Curtidas</li>
  <li>Comentários</li>
  <li>Cliques no "não me mostrar mais"</li>
</ul>

<blockquote>O algoritmo aprende com o que as pessoas <em>fazem</em>, não com o que dizem que gostam. Um usuário pode curtir todo conteúdo de fitness que aparece, mas se ele não assiste até o final, o algoritmo entende que fitness não retém esse usuário — e distribui menos.</blockquote>

<h3>O Loop de Feedback</h3>
<p>Todo algoritmo funciona em loop:</p>
<ol>
  <li>Conteúdo novo é publicado</li>
  <li>Algoritmo testa com grupo pequeno de usuários potencialmente interessados</li>
  <li>Mede sinais de engajamento e retenção</li>
  <li>Se sinais são positivos → expande distribuição para grupo maior</li>
  <li>Repete até saturar ou o conteúdo perder performance</li>
</ol>

<p>Cada plataforma tem parâmetros diferentes para "positivo" neste loop — mas a estrutura é universal.</p>

<h3>O Algoritmo como Espelho</h3>
<p>Se seu conteúdo não está sendo distribuído, há duas possibilidades: ou o algoritmo está com problema (raro) ou seu conteúdo não está gerando retenção suficiente (quase sempre). O algoritmo não te pune — ele simplesmente reflete o comportamento real da audiência. Culpar o algoritmo é evitar a pergunta certa: <em>por que as pessoas não estão ficando?</em></p>`
          },
          {
            id: "algo-psicologia",
            title: "A Psicologia por Trás dos Sinais de Engajamento",
            duration: "25 min",
            type: "text",
            keyPoints: ["Por que o cérebro para o scroll", "O papel da dopamina na distribuição de conteúdo", "Curiosity gap: a lacuna que força a continuação", "Pattern interrupt: quebrando o piloto automático", "Como emocionar em 3 segundos"],
            content: `<h2>A Neurociência do Scroll: Por Que Paramos</h2>
<p>Para usar o algoritmo a seu favor, você precisa entender o que está do outro lado: um cérebro humano em modo de piloto automático, tomando micro-decisões a cada 1,7 segundo. O algoritmo distribui para quem sabe interromper esse piloto automático.</p>

<h3>O Cérebro no Scroll: O Estado Default</h3>
<p>Quando alguém está fazendo scroll no feed, o córtex pré-frontal — a parte do cérebro responsável por decisões conscientes — está parcialmente desativado. É um estado quase meditativo de processamento baixo de informação. Nesse estado, o conteúdo é processado de forma rápida e superficial.</p>

<p>Para parar esse estado, o conteúdo precisa ativar uma das respostas do sistema límbico — a parte emocional e primitiva do cérebro que processa ameaças, oportunidades e novidades.</p>

<h3>Os 5 Gatilhos que Param o Scroll</h3>

<h3>1. Curiosidade (Curiosity Gap)</h3>
<p>O cérebro humano tem aversão a lacunas de conhecimento. Quando percebe que sabe apenas parte de algo, sente desconforto e busca completar a informação.</p>
<p>Como usar: crie uma promessa no início que só se completa no final. "O erro que 99% dos produtores cometem no dia de abertura do carrinho" — a pessoa <em>precisa</em> saber qual é o erro.</p>
<p>O Curiosity Gap é a base do copywriting de alto engajamento e do clickbait legítimo (quando entrega o que promete).</p>

<h3>2. Reconhecimento de Si Mesmo (Self-Reference Effect)</h3>
<p>O cérebro processa mais rapidamente informações que parecem relevantes para si mesmo. Quando alguém lê "Você ainda faz isso ao lançar seu produto?", o "você" ativa uma resposta de atenção involuntária.</p>
<p>Como usar: personalize o hook para a identidade específica do seu público. "Se você vende cursos online e está travado no mesmo patamar há 3 meses..." — quem se encaixa não consegue ignorar.</p>

<h3>3. Dissonância Cognitiva (Pattern Interrupt)</h3>
<p>O cérebro automaticamente filtra o que já conhece. Algo que contraria uma crença estabelecida força atenção consciente — o sistema ativa para resolver o conflito.</p>
<p>Como usar: comece com uma afirmação contraintuitiva. "Postar todo dia no Instagram está destruindo seu alcance" — vai contra o que a maioria acredita, forçando atenção para resolver a dissonância.</p>

<h3>4. Ameaça e FOMO (Fear of Missing Out)</h3>
<p>O cérebro primitivo prioriza ameaças. FOMO é uma ameaça social — a sensação de ficar para trás enquanto outros avançam.</p>
<p>Como usar: "Enquanto você lê isso, produtores menores que você estão faturando 3x mais com esse método". Não é manipulação — é ativação de urgência real quando o conteúdo entrega valor genuíno.</p>

<h3>5. Dopamina Antecipada</h3>
<p>A dopamina é liberada não apenas quando recebemos uma recompensa, mas quando <em>antecipamos</em> recebê-la. Isso é o mecanismo central do scroll infinito — cada novo card pode ser a recompensa.</p>
<p>Como usar: crie loops abertos dentro do conteúdo. Em um vídeo de 5 minutos, abra uma nova pergunta no minuto 2 que só será respondida no minuto 4. A antecipação mantém a retenção.</p>

<h3>O Princípio do Menor Esforço Cognitivo</h3>
<p>O cérebro sempre escolhe o caminho de menor resistência cognitiva. Conteúdo complexo, denso ou difícil de processar é abandonado — não porque seja ruim, mas porque exige esforço demais no estado de scroll.</p>
<p>Regra prática: <strong>uma ideia por frase</strong>. Uma cena por segundo de vídeo. Um conceito por slide de carrossel. Cada unidade deve ser imediatamente compreensível sem esforço.</p>`
          },
          {
            id: "algo-metricas-universais",
            title: "As 7 Métricas que Todo Algoritmo Mede",
            duration: "18 min",
            type: "text",
            keyPoints: ["Hook Rate: a taxa de parada do scroll", "Completion Rate: a métrica mais honesta", "Rewatch Rate: o sinal de conteúdo excepcional", "Share Rate: o multiplicador orgânico", "Save Rate: o indicador de valor percebido", "Comment Quality: interação profunda vs. superficial", "Profile Visit Rate: o sinal de conversão de audiência"],
            content: `<h2>As 7 Métricas Universais que Definem Distribuição</h2>
<p>Cada plataforma tem sua nomenclatura e ênfase diferente, mas estas 7 métricas aparecem, de alguma forma, em todos os algoritmos de recomendação. Otimize para elas e qualquer plataforma distribui seu conteúdo.</p>

<h3>1. Hook Rate (Taxa de Parada)</h3>
<p><strong>O que mede:</strong> % das pessoas que para o scroll e começa a consumir o conteúdo<br/>
<strong>Janela de medição:</strong> primeiros 1-3 segundos de vídeo, primeira linha visível de texto<br/>
<strong>Benchmark alvo:</strong> &gt;30% para vídeo, &gt;5% CTR para imagem<br/>
<strong>Como melhorar:</strong> teste múltiplos hooks para o mesmo conteúdo; o primeiro frame/palavra decide tudo</p>

<h3>2. Completion Rate (Taxa de Conclusão)</h3>
<p><strong>O que mede:</strong> % das pessoas que consome o conteúdo até o final<br/>
<strong>Por que importa:</strong> é o sinal mais difícil de manipular — reflete valor real entregue<br/>
<strong>Benchmark alvo:</strong> &gt;70% para vídeos curtos (&lt;30s), &gt;50% para vídeos médios (30-90s), &gt;40% para longos<br/>
<strong>Como melhorar:</strong> elimine qualquer segundo "vazio" no vídeo; ritmo constante do primeiro ao último segundo</p>

<h3>3. Rewatch Rate (Taxa de Revisita)</h3>
<p><strong>O que mede:</strong> % das pessoas que assiste o conteúdo mais de uma vez<br/>
<strong>Por que importa:</strong> é o sinal mais raro e mais valorizado — significa que o conteúdo tem densidade de informação suficiente para justificar rever<br/>
<strong>Como gerar:</strong> inclua informações muito densas (lista longa, número específico, revelação surpresa no final)</p>

<h3>4. Share Rate (Taxa de Compartilhamento)</h3>
<p><strong>O que mede:</strong> % das pessoas que compartilha o conteúdo com outro usuário ou em story<br/>
<strong>Por que importa:</strong> compartilhamento é endosso social — o algoritmo trata como sinal de qualidade excepcionalmente alta<br/>
<strong>Como gerar:</strong> conteúdo que as pessoas querem mandar para alguém específico: "isso é exatamente o que meu amigo X precisa ver"</p>

<h3>5. Save Rate (Taxa de Salvamento)</h3>
<p><strong>O que mede:</strong> % das pessoas que salva para ver depois<br/>
<strong>Por que importa:</strong> sinaliza utilidade prática — "vou precisar disso depois"<br/>
<strong>Como gerar:</strong> conteúdo de referência (checklists, templates, listas, guias passo-a-passo)</p>

<h3>6. Comment Quality Score</h3>
<p><strong>O que mede:</strong> profundidade dos comentários (alguns algoritmos analisam sentimento e comprimento)<br/>
<strong>Por que importa:</strong> comentários longos e debates sinalizam conteúdo que provocou reflexão genuína<br/>
<strong>Como gerar:</strong> termine com uma pergunta aberta que provoca divisão de opiniões ou auto-reflexão</p>

<h3>7. Profile Visit Rate</h3>
<p><strong>O que mede:</strong> % das pessoas que visita seu perfil após o conteúdo<br/>
<strong>Por que importa:</strong> sinaliza interesse em saber mais sobre quem criou — intenção de seguir<br/>
<strong>Como melhorar:</strong> construa suspense sobre quem você é; o conteúdo isolado deve gerar curiosidade sobre o criador</p>`
          }
        ]
      },
      {
        id: "algoritmo-tiktok-profundo",
        number: 16,
        title: "TikTok Algorithm: Dissecção Completa",
        subtitle: "O sistema de distribuição mais sofisticado da história das redes sociais",
        icon: "🎵",
        color: "from-black to-gray-800",
        duration: "1h 30min",
        summary: "O TikTok construiu o algoritmo de recomendação mais avançado já disponibilizado para o público geral. Entender sua mecânica em profundidade é uma vantagem competitiva de 2-3 anos sobre quem não entende.",
        lessons: [
          {
            id: "tiktok-deep-1",
            title: "O Sistema de Pontuação do TikTok: O que o ByteDance Realmente Mede",
            duration: "28 min",
            type: "text",
            glossaryTerms: ["fyp", "completion-rate", "rewatch-rate", "hook-rate", "ctr", "algoritmo-de-recomendacao"],
            keyPoints: ["O modelo de distribuição progressiva em detalhe", "Os pesos reais de cada sinal (baseado em patentes e estudos)", "Como o TikTok classifica conteúdo por tópico", "O papel da velocidade de engajamento nas primeiras horas", "Por que vídeos antigos ainda viralizam"],
            content: `<h2>O Sistema de Distribuição Progressiva do TikTok em Profundidade</h2>
<p>O TikTok é uma empresa de tecnologia chinesa com raízes no processamento de dados em escala. O algoritmo deles não é uma lista de regras — é um modelo de machine learning que decide, a cada milissegundo, qual vídeo mostrar para qual usuário para maximizar o tempo total na plataforma.</p>

<h3>A Arquitetura Técnica (Simplificada)</h3>
<p>O sistema do TikTok tem dois componentes principais:</p>
<ul>
  <li><strong>Modelo de Candidatos:</strong> seleciona um pool de vídeos potencialmente relevantes para aquele usuário específico, com base em histórico, localização, idioma e tópicos de interesse</li>
  <li><strong>Modelo de Ranking:</strong> ordena esses candidatos por probabilidade de engajamento — combinando sinais do vídeo + perfil do usuário + contexto (hora, dispositivo, velocidade de internet)</li>
</ul>

<h3>Os Fatores de Ranking em Ordem de Peso</h3>
<p>Com base em documentos internos vazados e pesquisas independentes, estes são os fatores aproximados e seus pesos relativos:</p>

<ol>
  <li><strong>Completion Rate (peso: ~35%):</strong> de longe o fator mais importante. Um vídeo de 15s com 90% de conclusão supera um vídeo de 3min com 30% de conclusão na maioria dos casos.</li>
  <li><strong>Rewatch Rate (peso: ~25%):</strong> assistir mais de uma vez é sinal de conteúdo excepcional. O TikTok prioriza fortemente vídeos que as pessoas assistem em loop.</li>
  <li><strong>Compartilhamento (peso: ~20%):</strong> o TikTok valoriza shares para fora da plataforma (WhatsApp, Instagram Stories) como sinal de que o conteúdo tem vida além do app.</li>
  <li><strong>Comentários (peso: ~12%):</strong> especialmente comentários que geram respostas — cria atividade no vídeo por mais tempo.</li>
  <li><strong>Curtidas (peso: ~8%):</strong> o sinal mais fácil de dar e por isso tem menos peso relativo.</li>
</ol>

<h3>O Conceito de "Velocidade de Engajamento"</h3>
<p>Não é apenas a quantidade de engajamento — é a velocidade com que chega. Um vídeo que recebe 100 curtidas nas primeiras 2 horas de publicação tem score maior que um que recebe 100 curtidas ao longo de 24 horas.</p>
<p>Implicação prática: o momento de publicação importa. Publique quando sua audiência está ativa para acelerar a velocidade inicial.</p>

<h3>O Sistema de Tópicos e Clusters</h3>
<p>O TikTok classifica todo conteúdo em uma taxonomia de tópicos com centenas de subcategorias. Quando você publica, o sistema analisa:</p>
<ul>
  <li>Transcrição do áudio (o que você fala)</li>
  <li>Texto sobreposto no vídeo</li>
  <li>Hashtags e caption</li>
  <li>Descrição do som usado</li>
  <li>Análise visual (objetos, cenário, faces reconhecidas)</li>
</ul>
<p>Com base nisso, classifica o vídeo em tópicos e distribui para usuários com histórico de interesse naqueles tópicos. <strong>A consistência de tópico na conta acelera a classificação</strong> — uma conta que sempre faz conteúdo sobre finanças pessoais tem distribuição mais eficiente que uma conta que mistura finanças, culinária e humor.</p>

<h3>Por que Vídeos Antigos Ainda Viralizam</h3>
<p>O TikTok não tem "feed cronológico" — tem feed de relevância. Um vídeo de 6 meses pode viralizar hoje se um usuário de alta influência (com muitos seguidores) compartilhar ou se o algoritmo encontrar um novo cluster de usuários com perfil compatível.</p>
<p>Isso significa que todo conteúdo publicado tem potencial de longa vida — diferente do Instagram, onde posts ficam relevantes por 24-48h no máximo.</p>`
          },
          {
            id: "tiktok-deep-2",
            title: "Estratégia de Conta: Como Construir Autoridade de Nicho no TikTok",
            duration: "25 min",
            type: "text",
            keyPoints: ["Por que o algoritmo prefere contas especializadas", "A estratégia dos 30 primeiros vídeos", "Como usar o TikTok Search a seu favor", "Duets, Stitches e colaborações como alavanca de alcance", "TikTok LIVE: o algoritmo separado que expande a conta"],
            content: `<h2>Construindo uma Conta com Autoridade de Nicho</h2>

<h3>Por que Especialização Bate Generalização no TikTok</h3>
<p>O algoritmo do TikTok funciona melhor quando consegue classificar sua conta com clareza. Uma conta sobre "como vender online" tem distribuição mais eficiente que uma conta sobre "empreendedorismo, viagens e saúde". Não porque o algoritmo pune generalistas — mas porque as listas de usuários potencialmente interessados são muito menores quando o tópico é amplo demais.</p>

<p>Conta especializada → classificação clara → pool de usuários maior dentro daquele nicho → mais probabilidade de chegar no FYP certo.</p>

<h3>Os 30 Primeiros Vídeos: A Fase de Calibração</h3>
<p>Nos primeiros 30 vídeos de uma conta nova (ou reposicionada), o algoritmo está aprendendo quem é você. Nessa fase:</p>
<ul>
  <li>Mantenha o <strong>mesmo nicho</strong> sem exceções — cada vídeo reforça a classificação</li>
  <li>Use <strong>formatos variados</strong> (vídeo falado, texto na tela, demonstração, história) para descobrir o que mais ressoa com a audiência</li>
  <li>Publique com <strong>frequência consistente</strong> (pelo menos 3-5x por semana) — consistência acelera a calibração</li>
  <li>Analise os primeiros 100 seguidores que ganhar — eles revelam quem o algoritmo classificou como sua audiência ideal</li>
</ul>

<h3>TikTok Search: O Canal Subaproveitado</h3>
<p>O TikTok virou um buscador. Uma pesquisa da Adobe em 2023 revelou que 40% dos usuários da Geração Z preferem buscar no TikTok antes do Google para descobrir novos produtos, restaurantes e serviços.</p>

<p>Como aproveitar:</p>
<ul>
  <li>Use o TikTok Search Insights (nativo) para descobrir o que as pessoas buscam no seu nicho</li>
  <li>Crie vídeos cujo título é literalmente a pergunta que as pessoas fazem: "Como vender um infoproduto sem audiência" — isso aparece tanto no FYP quanto nas buscas</li>
  <li>Inclua palavras-chave faladas no vídeo (o TikTok transcreve o áudio) e escritas no caption</li>
</ul>

<h3>Duets e Stitches: Alcance Emprestado</h3>
<p>Quando você cria um Duet ou Stitch com um vídeo popular, seu conteúdo herdas parte do alcance do vídeo original — porque o algoritmo mostra seu vídeo para quem interagiu com o original.</p>

<p>Estratégia: identifique os 10 vídeos mais virais do seu nicho dos últimos 30 dias. Crie Stitches com comentário analítico ou contra-argumento respeitoso. Opiniões divergentes sobre conteúdo viral geram debate nos comentários — o algoritmo ama.</p>

<h3>TikTok LIVE: O Algoritmo Diferente</h3>
<p>O LIVE no TikTok tem um algoritmo próprio, separado dos vídeos gravados. As lives são distribuídas com base em: duração da live (quanto mais longa, mais distribuição), presentes recebidos (sinal de valor percebido) e usuários simultâneos.</p>

<p>Para criadores de conteúdo educacional, a live é poderosa porque:</p>
<ul>
  <li>Aparece numa tab separada no feed, com maior visibilidade</li>
  <li>Usuários que estavam dormindo para o seu conteúdo gravado podem redescobrir sua conta via live</li>
  <li>Gera notificação push para seguidores — contato proativo</li>
</ul>`
          },
          {
            id: "tiktok-deep-3",
            title: "Conteúdo de Conversão no TikTok: Do Scroll à Venda",
            duration: "22 min",
            type: "text",
            keyPoints: ["TikTok não é plataforma de venda direta — e como usar isso a seu favor", "A sequência de conteúdo que aquece e converte", "TikTok Shop e Link in Bio: a jornada do comprador", "O funil TikTok → Instagram → WhatsApp → Venda"],
            content: `<h2>Transformando Alcance em Receita no TikTok</h2>
<p>O TikTok tem o maior alcance orgânico de qualquer plataforma — mas também a menor intenção de compra imediata. As pessoas estão no TikTok para se entreter e descobrir, não para comprar. Entender isso define a estratégia certa.</p>

<h3>O Papel do TikTok no Funil</h3>
<p>O TikTok funciona melhor como <strong>topo de funil</strong> — gerador de consciência e audiência — do que como canal de conversão direta. A jornada mais eficiente é:</p>

<pre>
TikTok (descoberta + interesse)
    ↓
Instagram (aprofundamento + relacionamento)
    ↓
WhatsApp ou Email (confiança + conversão)
    ↓
Venda
</pre>

<p>Tente vender direto do TikTok para produtos de alto ticket e a conversão vai ser baixa. Use o TikTok para trazer a pessoa para o Instagram (onde você tem mais profundidade) ou diretamente para o WhatsApp (onde o contato é 1:1).</p>

<h3>O Conteúdo que Migra a Audiência</h3>
<p>Para que alguém siga de uma plataforma para outra, você precisa de um motivo forte. Três estratégias que funcionam:</p>

<ol>
  <li><strong>Continuação exclusiva:</strong> "Mostrei o passo 1 aqui. Os passos 2, 3 e 4 com template estão no link da bio" — cria razão de sair do TikTok</li>
  <li><strong>Lead magnet:</strong> "Tenho uma planilha gratuita que calcula automaticamente o que mostrei nesse vídeo — link na bio" — troca de valor por contato</li>
  <li><strong>Comunidade exclusiva:</strong> "Quem quiser acesso ao grupo onde posto os bastidores, link na bio" — apelo de pertencimento</li>
</ol>

<h3>A Sequência de Conteúdo de 10 Vídeos</h3>
<p>Para um lançamento, uma sequência de 10 vídeos pré-lançamento no TikTok pode gerar centenas de leads qualificados:</p>
<ul>
  <li>Vídeos 1-3: Problema (mostre a dor com especificidade)</li>
  <li>Vídeos 4-6: Educação (ensine parte da solução — gere resultado rápido)</li>
  <li>Vídeos 7-8: Prova social (mostre resultados de outros com o método)</li>
  <li>Vídeo 9: Teaser da oferta ("semana que vem abrindo as vagas")</li>
  <li>Vídeo 10: CTA direto com link na bio</li>
</ul>`
          }
        ],
        locked: true
      },
      {
        id: "algoritmo-instagram-profundo",
        number: 17,
        title: "Instagram Algorithm: Os 4 Sistemas Separados",
        subtitle: "Feed, Explore, Reels e Stories têm algoritmos distintos — dominar todos multiplica o alcance",
        icon: "📸",
        color: "from-pink-600 to-purple-700",
        duration: "1h 15min",
        summary: "O Instagram não tem um algoritmo — tem quatro. Cada superfície (Feed, Explore, Reels, Stories) usa sinais diferentes e tem objetivos diferentes. Quem trata todos igual deixa 70% do alcance potencial na mesa.",
        lessons: [
          {
            id: "ig-quatro-sistemas",
            title: "Os 4 Algoritmos do Instagram e seus Sinais Específicos",
            duration: "28 min",
            type: "text",
            glossaryTerms: ["saves", "collab-post", "completion-rate", "shadow-ban", "rewatch-rate"],
            keyPoints: ["Feed: o algoritmo de relacionamento", "Explore: o algoritmo de descoberta", "Reels: o algoritmo de retenção de vídeo", "Stories: o algoritmo de frequência e proximidade", "Como otimizar para cada superfície separadamente"],
            content: `<h2>Instagram: Quatro Superfícies, Quatro Lógicas</h2>
<p>Adam Mosseri, chefe do Instagram, confirmou publicamente que cada superfície do app usa sistemas diferentes. Isso não é detalhe técnico — é a diferença entre uma estratégia que funciona em todas as partes do app e uma que funciona apenas em uma.</p>

<h3>O Feed: Algoritmo de Relacionamento</h3>
<p>O Feed mostra conteúdo de quem você já segue. O algoritmo ordena com base em:</p>
<ul>
  <li><strong>Probabilidade de interação:</strong> com base no histórico de interação entre você e aquela conta específica</li>
  <li><strong>Tempo de visualização:</strong> quanto tempo a pessoa costuma passar em posts daquele formato (imagem vs. carrossel vs. vídeo)</li>
  <li><strong>Frescor:</strong> posts mais recentes têm vantagem, mas não exclusividade — um post viral de 3 dias atrás ainda aparece</li>
  <li><strong>Uso do app:</strong> o Instagram tenta garantir que posts importantes não sejam perdidos — se você não abriu o app por 2 dias, ele prioriza o que você teria mais probabilidade de ver</li>
</ul>

<p><strong>O que isso significa na prática:</strong> para crescer no Feed, você precisa de <em>frequência de interação alta</em> com seus seguidores. Responda todos os comentários (especialmente nas primeiras horas), responda DMs, use curtidas nos comentários. Cada interação aumenta o score de relacionamento e garante mais visibilidade futura.</p>

<h3>O Explore: Algoritmo de Descoberta</h3>
<p>A aba Explore é o único lugar onde usuários que não te seguem podem te descobrir. O algoritmo aqui funciona diferente do Feed:</p>
<ul>
  <li>Analisa os posts com que um usuário interagiu recentemente</li>
  <li>Busca posts com sinais similares (temática, estética, engajamento) que tiveram alta performance nas últimas horas</li>
  <li>Prioriza conteúdo com alta taxa de salvamento e compartilhamento para stories</li>
</ul>

<p><strong>Para chegar no Explore:</strong> seu post precisa ter performance acima da média <em>entre seus seguidores primeiro</em>. O Explore distribui para não-seguidores conteúdo que já provou ser bom com quem já te conhece.</p>

<h3>Reels: Algoritmo de Retenção</h3>
<p>O Reels é a tentativa do Instagram de competir com o TikTok, e o algoritmo reflete isso:</p>
<ul>
  <li><strong>Completion Rate:</strong> principal métrica — % de pessoas que assiste o Reel até o final</li>
  <li><strong>Rewatch:</strong> Reels assistidos mais de uma vez recebem boost significativo</li>
  <li><strong>Shares para Stories:</strong> quando alguém compartilha um Reel nos próprios Stories, é sinal poderoso de que o conteúdo foi impactante</li>
  <li><strong>Audio original vs. trending:</strong> Reels com áudio original que viraliza recebem distribuição extra retroativa — o Instagram promove a conta que criou o som original</li>
</ul>

<p><strong>Diferença do TikTok:</strong> o Instagram Reels prioriza mais os seguidores existentes nos primeiros estágios de distribuição. No TikTok, até contas com zero seguidores chegam ao FYP. No Reels, a prova social com seguidores existentes é mais importante antes da expansão.</p>

<h3>Stories: Algoritmo de Frequência e Proximidade</h3>
<p>Stories têm o algoritmo mais simples dos quatro — é basicamente uma medida de quão próximo o algoritmo acha que você e aquela conta são:</p>
<ul>
  <li>Com que frequência você visualiza os Stories daquela conta</li>
  <li>Com que frequência você interage (responde, reage, vota em enquetes)</li>
  <li>Se vocês já trocaram DMs</li>
</ul>

<p>Contas que você ignora por semanas desaparecem da frente da lista. Contas com quem você interage diariamente aparecem primeiro — sempre.</p>

<p><strong>Implicação para criadores:</strong> engajar ativamente com seus seguidores nos Stories deles (visitar os Stories de quem comenta) sobe sua conta na lista deles. É recíproco.</p>`
          },
          {
            id: "ig-crescimento-estrategia",
            title: "Estratégia de Crescimento Acelerado no Instagram",
            duration: "28 min",
            type: "text",
            keyPoints: ["O método de 90 dias para crescimento orgânico", "Hashtags em 2025: mortas ou vivas?", "O papel dos primeiros 60 minutos após publicação", "Collab Posts: alcance dobrado instantâneo", "Como usar o Instagram Broadcast Channel para retenção"],
            content: `<h2>Crescimento Orgânico no Instagram: O que Funciona em 2025</h2>

<h3>Os Primeiros 60 Minutos: A Janela de Ouro</h3>
<p>O algoritmo do Instagram avalia a performance do post nas primeiras horas e usa isso para decidir o alcance futuro. Os primeiros 60 minutos são desproporcionalmente importantes — o engajamento nessa janela sinaliza se o conteúdo vai ser expandido ou não.</p>

<p>Como maximizar os primeiros 60 minutos:</p>
<ul>
  <li>Publique quando sua audiência está mais ativa (use "Insights" → "Audiência" → "Dias e horários mais ativos")</li>
  <li>Responda cada comentário nos primeiros 60 min — cada resposta é um sinal adicional de engajamento</li>
  <li>Adicione o post nos seus próprios Stories logo após publicar — direciona seguidores ao post imediatamente</li>
  <li>Mande por DM para 5-10 pessoas que você sabe que vão genuinamente se importar com aquele conteúdo</li>
</ul>

<h3>Hashtags em 2025: A Verdade</h3>
<p>As hashtags perderam muito de seu poder de descoberta no Instagram ao longo dos anos. Em 2025, a posição oficial do Instagram (confirmada por Mosseri) é que hashtags são <em>classificadoras de conteúdo</em>, não amplificadoras de alcance.</p>

<p>O que isso significa: hashtags ajudam o algoritmo a <em>classificar</em> seu post, não a distribuí-lo para mais pessoas. Use hashtags descritivas e específicas do nicho — não hashtags massivas como #motivação ou #vida.</p>

<p>Regra prática: 3-5 hashtags muito específicas superam 30 hashtags genéricas. Qualidade de classificação &gt; quantidade.</p>

<h3>Collab Posts: Alcance Dobrado sem Trabalho Extra</h3>
<p>O Collab Post é uma funcionalidade nativa do Instagram onde dois criadores publicam o mesmo post — e ele aparece no feed dos seguidores de ambos, com os dois nomes no cabeçalho.</p>

<p>Para um lançamento, o Collab Post com um parceiro JV no momento de abertura do carrinho pode dobrar o alcance orgânico instantaneamente. Nenhuma outra funcionalidade nativa oferece essa alavancagem de alcance sem custo.</p>

<h3>Broadcast Channel: Retenção de Audiência Quente</h3>
<p>O Broadcast Channel é um canal de transmissão unidirecional dentro do Instagram onde você manda mensagens para quem optou por entrar. Características:</p>
<ul>
  <li>Notificação push para membros (taxa de abertura &gt;60% — muito superior ao email)</li>
  <li>Membros não podem responder publicamente (sem ruído)</li>
  <li>Perfeito para avisos de lançamento, conteúdo exclusivo, bastidores</li>
</ul>

<p>Use o Broadcast Channel para a "lista de espera" do lançamento dentro do Instagram. É o equivalente do grupo de WhatsApp, mas sem o caos das respostas em grupo.</p>

<h3>O Método de 90 Dias para Crescimento Real</h3>
<p>Crescimento orgânico consistente não acontece com posts virais isolados — acontece com sistema:</p>
<ul>
  <li><strong>Semanas 1-4:</strong> Publique 1 Reel + 2 Carrosséis por semana. Foco absoluto em um nicho. Sem vender.</li>
  <li><strong>Semanas 5-8:</strong> Adicione Stories diários (enquetes, perguntas, bastidores). Responda 100% dos comentários e DMs.</li>
  <li><strong>Semanas 9-12:</strong> 1 Collab Post com conta do mesmo tamanho. Primeiro Broadcast Channel. Início do aquecimento para lançamento.</li>
</ul>
<p>Com esse sistema e conteúdo de qualidade, crescimento de 500-2.000 seguidores por mês no nicho certo é consistentemente alcançável.</p>`
          }
        ],
        locked: true
      },
      {
        id: "algoritmo-youtube-profundo",
        number: 18,
        title: "YouTube Algorithm: O Motor de Busca de Vídeo",
        subtitle: "Como o maior buscador de vídeo do mundo decide o que mostrar — e como aparecer nele",
        icon: "▶",
        color: "from-red-600 to-red-800",
        duration: "1h",
        summary: "O YouTube é único: metade mecanismo de busca, metade rede social de vídeo. Isso cria duas estratégias de crescimento paralelas — SEO de vídeo e otimização para o sistema de recomendação — que, usadas juntas, criam crescimento composto.",
        lessons: [
          {
            id: "yt-dois-motores",
            title: "Os Dois Motores do YouTube: Busca e Recomendação",
            duration: "28 min",
            type: "text",
            glossaryTerms: ["avd", "watch-time", "ctr", "seo", "keyword", "backlinks"],
            keyPoints: ["Tráfego de busca vs. tráfego de sugeridos: diferenças fundamentais", "CTR de thumbnail: o fator mais subestimado", "Watch Time e AVD (Average View Duration)", "Como o YouTube decide o que sugerir depois", "Playlists como alavanca de watch time"],
            content: `<h2>YouTube: Dois Sistemas de Distribuição em Um</h2>
<p>O YouTube é a única grande plataforma que tem dois sistemas de descoberta completamente distintos operando simultaneamente: o motor de busca (como o Google, mas para vídeo) e o sistema de recomendação (que decide o que aparece na home e nos "vídeos sugeridos").</p>

<p>Criadores que entendem os dois e otimizam para ambos crescem muito mais rápido — porque cada vídeo pode trazer tráfego via busca E via sugestão, multiplicando o alcance.</p>

<h3>Motor 1: Busca</h3>
<p>Quando alguém busca "como criar um lançamento semente", o YouTube ranqueia os resultados com base em:</p>

<ul>
  <li><strong>Relevância do título e descrição:</strong> a keyword precisa estar no título (preferencialmente no início) e nos primeiros 200 caracteres da descrição</li>
  <li><strong>CTR (Click-Through Rate):</strong> % das pessoas que veem o resultado e clicam na thumbnail. Um CTR alto sinaliza que o título + thumbnail são relevantes para aquela busca</li>
  <li><strong>Watch Time da busca:</strong> após clicar, quantos minutos assistem? Alguém que clicou e saiu em 30 segundos sinaliza que o vídeo não entregou o que prometeu</li>
  <li><strong>Satisfação da busca:</strong> após assistir, a pessoa fez outra busca relacionada ou foi embora? Se foi embora satisfeita, o YouTube interpreta isso positivamente</li>
</ul>

<h3>Motor 2: Recomendação (Home + Sugeridos)</h3>
<p>O sistema de sugestão decide quais vídeos aparecem na home do usuário e na coluna lateral "próximos vídeos". Aqui os fatores são diferentes:</p>

<ul>
  <li><strong>Histórico de consumo do usuário:</strong> o algoritmo modela um "perfil de interesse" de cada usuário e recomenda vídeos que se encaixam</li>
  <li><strong>Performance do vídeo com audiências similares:</strong> se pessoas com perfil parecido assistiram e gostaram, você vai receber recomendação</li>
  <li><strong>AVD (Average View Duration):</strong> a duração média de visualização — não apenas a porcentagem. Um vídeo de 20 minutos com AVD de 12 minutos supera um vídeo de 3 minutos com AVD de 2 minutos no sistema de sugestão</li>
</ul>

<h3>CTR de Thumbnail: O Fator Mais Subestimado</h3>
<p>O CTR de thumbnail (% de impressões que viram o vídeo e clicaram) é o fator que mais impacta a distribuição inicial no YouTube. Um CTR baixo mata a distribuição antes que o watch time seja medido.</p>

<p>Benchmarks por tipo de canal:</p>
<ul>
  <li>Canal novo sem audiência estabelecida: 2-4% é normal</li>
  <li>Canal crescendo com audiência engajada: 4-8%</li>
  <li>Canal com audiência muito fiel (nicho específico): 8-15%</li>
</ul>

<p>Elementos da thumbnail de alto CTR:</p>
<ul>
  <li>Rosto humano com expressão emocional clara (surpresa, curiosidade, alegria)</li>
  <li>Texto de no máximo 5 palavras com promessa ou pergunta</li>
  <li>Contraste alto (fundo que se destaca no feed predominantemente branco do YouTube)</li>
  <li>Elemento visual inesperado (algo fora do padrão do nicho chama atenção por contraste)</li>
</ul>

<h3>Playlists: A Alavanca de Watch Time Ignorada</h3>
<p>Vídeos organizados em playlists têm watch time significativamente maior porque o YouTube reproduz automaticamente o próximo vídeo da playlist. Isso eleva o watch time total da sessão — um dos sinais mais importantes para o algoritmo de recomendação.</p>

<p>Estratégia: organize seus vídeos em playlists temáticas. Um visitante que assiste 3 vídeos em sequência de uma playlist gera 3x mais watch time que 3 visitas independentes — e o algoritmo atribui esse engagement ao canal como um todo.</p>`
          },
          {
            id: "yt-seo",
            title: "YouTube SEO Avançado: Apareça em Buscas por Anos",
            duration: "22 min",
            type: "text",
            keyPoints: ["Pesquisa de keywords para YouTube", "Títulos que ranqueiam e têm CTR alto simultaneamente", "Descrição otimizada: estrutura dos 5 blocos", "Tags e chapters: impacto real vs. mito", "Como aparecer no Google com vídeos do YouTube"],
            content: `<h2>YouTube SEO: A Estratégia de Longo Prazo</h2>
<p>Um vídeo bem otimizado para busca pode gerar leads orgânicos por 3-5 anos. Um Reel do Instagram dura 48 horas de pico. O YouTube SEO é o único canal de conteúdo com esse horizonte temporal — e poucos produtores levam a sério.</p>

<h3>Pesquisa de Keywords para YouTube</h3>
<p>Ferramentas para encontrar o que as pessoas buscam no YouTube:</p>
<ul>
  <li><strong>YouTube Search Suggest:</strong> comece a digitar no buscador do YouTube — as sugestões automáticas são as buscas mais frequentes</li>
  <li><strong>TubeBuddy / VidIQ:</strong> mostram volume de busca estimado, dificuldade de ranqueamento e score de oportunidade por keyword</li>
  <li><strong>Google Keyword Planner:</strong> keywords que ranqueiam no Google frequentemente também ranqueiam no YouTube</li>
  <li><strong>Aba "Pesquisa" no YouTube Studio:</strong> mostra as buscas que trouxeram pessoas ao seu canal — ouro para descobrir oportunidades</li>
</ul>

<p>Critério de keyword ideal: volume médio (não as mais competitivas), alta intenção de aprendizado (palavras como "como", "tutorial", "passo a passo") e baixa competição de canais grandes.</p>

<h3>Títulos que Ranqueiam E Têm CTR Alto</h3>
<p>Existe tensão entre título de SEO (keyword no início) e título de CTR (promessa emocional). A solução é combinar os dois:</p>

<p>Fórmula: [Keyword Principal]: [Promessa ou Curiosidade]</p>
<ul>
  <li>"Lançamento Semente: Como Vendi R$47k Antes de Criar o Produto"</li>
  <li>"Meta Ads para Iniciantes: A Estrutura Que Ninguém Explica"</li>
  <li>"Funil Perpétuo: Por Que o Meu Fatura R$30k/mês no Piloto Automático"</li>
</ul>

<h3>Estrutura da Descrição Otimizada</h3>
<p>Os primeiros 200 caracteres são os mais importantes (aparecem antes do "ver mais" no mobile e são os mais indexados pelo algoritmo).</p>

<p>Estrutura dos 5 blocos:</p>
<ol>
  <li><strong>Resumo + keyword (0-200 chars):</strong> primeira frase com keyword principal + o que o vídeo entrega</li>
  <li><strong>Recursos mencionados no vídeo:</strong> links de ferramentas, templates, livros citados</li>
  <li><strong>Timestamps / Chapters:</strong> facilita navegação + aparece como mini-sumário no Google</li>
  <li><strong>Links de outros vídeos relacionados:</strong> cria navegação interna, melhora watch time de sessão</li>
  <li><strong>Keywords secundárias:</strong> parágrafo natural mencionando termos relacionados ao tema principal</li>
</ol>

<h3>Como Aparecer no Google com Vídeos</h3>
<p>O Google mostra vídeos do YouTube para queries de "como fazer", "tutorial" e comparações. Para aparecer no Google:</p>
<ul>
  <li>Adicione timestamps/chapters (o Google usa esses como "key moments" no resultado de busca)</li>
  <li>Use a mesma keyword do título do vídeo como keyword-alvo no Google Search Console do seu site (o Google correlaciona)</li>
  <li>Embedde o vídeo em um post do blog com o mesmo tema — o Google favorece páginas que combinam texto e vídeo relevante</li>
</ul>`
          }
        ],
        locked: true
      },
      {
        id: "algoritmo-facebook-google",
        number: 19,
        title: "Facebook Orgânico e Google: Os Algoritmos de Intenção",
        subtitle: "Facebook Groups, o feed orgânico e o algoritmo de busca do Google",
        icon: "🔵",
        color: "from-blue-700 to-blue-900",
        duration: "1h",
        summary: "O alcance orgânico do Facebook para páginas caiu 90% desde 2012 — mas os Grupos continuam com alcance excepcional. O Google Search é o canal com maior intenção de compra do marketing digital. Entenda a lógica de cada um.",
        lessons: [
          {
            id: "fb-groups-algoritmo",
            title: "Facebook Groups: O Algoritmo que Ainda Entrega Alcance",
            duration: "25 min",
            type: "text",
            keyPoints: ["Por que grupos têm alcance orgânico que páginas não têm", "Os sinais que o algoritmo do grupo usa", "Estratégia de grupo de lançamento passo-a-passo", "Facebook Feed para páginas: o que ainda funciona", "Events do Facebook como canal de notificação"],
            content: `<h2>Facebook em 2025: Grupos São o Ativo Real</h2>

<h3>Por que o Alcance de Páginas Morreu</h3>
<p>O declínio do alcance orgânico de páginas no Facebook não foi acidente — foi política deliberada. O Facebook precisa monetizar o espaço no feed. Quanto menos conteúdo de páginas aparece organicamente, mais essas páginas precisam pagar para aparecer.</p>

<p>O alcance médio de uma postagem de página para seus seguidores em 2025: <strong>1,5-3%</strong>. Uma página com 10.000 seguidores alcança 150-300 pessoas por post organicamente.</p>

<h3>Por que Grupos Sobreviveram ao Declínio</h3>
<p>Grupos têm um status especial no Facebook: são considerados "espaços de comunidade", não "espaços de mídia". O algoritmo ainda distribui conteúdo de grupos para membros com muito mais liberalidade — especialmente quando o engajamento dentro do grupo é alto.</p>

<p>Taxa de alcance orgânico em grupos bem gerenciados: <strong>15-40% dos membros</strong>. Uma diferença de 10-20x em relação às páginas.</p>

<h3>Os Sinais do Algoritmo de Grupos</h3>
<p>Para um post receber boa distribuição dentro de um grupo, o algoritmo mede:</p>
<ul>
  <li><strong>Comentários e threads:</strong> posts que geram discussão aparecem para mais membros — o Facebook prioriza conteúdo que mantém as pessoas no app</li>
  <li><strong>Reações diversas:</strong> mistura de reações (💙❤️😲) sinaliza conteúdo que provoca emoção — mais valioso que só curtidas</li>
  <li><strong>Velocidade de engajamento:</strong> posts que recebem 5+ comentários nos primeiros 30 minutos disparam o algoritmo de distribuição</li>
  <li><strong>Histórico do criador no grupo:</strong> membros que consistentemente postam conteúdo bem recebido têm seus posts distribuídos mais amplamente</li>
</ul>

<h3>Estratégia de Grupo de Lançamento</h3>
<p>A estratégia mais poderosa de Facebook orgânico para produtores digitais é o grupo de lançamento — criado especificamente para um lançamento, fechado após o fechamento do carrinho.</p>

<p>Cronograma típico:</p>
<ul>
  <li><strong>D-21:</strong> Cria o grupo com nome baseado no resultado ("Desafio: Primeira Venda Online em 7 Dias")</li>
  <li><strong>D-21 a D-8:</strong> Conteúdo de valor diário — vídeos curtos, PDFs, enquetes, perguntas. Sem venda.</li>
  <li><strong>D-7 a D-1:</strong> Pré-lançamento — estudos de caso, AMA (Ask Me Anything) ao vivo, countdown</li>
  <li><strong>D0:</strong> Abertura do carrinho — post de lançamento com link, live de 30-60min tirando dúvidas</li>
  <li><strong>D1-D5:</strong> Posts de prova social (capturas de novos alunos), respostas a objeções, posts de urgência crescente</li>
  <li><strong>D6:</strong> Fechamento — "últimas horas" posts a cada 3-4h</li>
</ul>

<h3>Facebook Events: Notificação Gratuita</h3>
<p>Quando você cria um evento e as pessoas marcam "Interessado" ou "Vou", o Facebook manda notificações automáticas nos dias antes do evento. Para um webinar de lançamento, isso é um canal de lembrete gratuito com taxa de abertura alta.</p>`
          },
          {
            id: "google-seo-intencao",
            title: "Google Search: O Algoritmo de Maior Intenção de Compra",
            duration: "25 min",
            type: "text",
            keyPoints: ["Por que quem busca no Google converte melhor que quem descobre no TikTok", "Intenção de busca: informacional, navegacional, transacional", "Os 200+ fatores de ranqueamento simplificados", "E-E-A-T: o framework de autoridade do Google", "SEO para landing pages de produto"],
            content: `<h2>Google Search: O Canal com Maior Intenção de Compra</h2>
<p>Uma pessoa que busca "curso de lançamento digital" no Google está ativamente procurando por uma solução — ela já identificou o problema e está em modo de pesquisa de compra. Isso é radicalmente diferente de alguém que encontrou um conteúdo no TikTok passivamente.</p>

<p>Essa diferença de intenção explica por que tráfego orgânico do Google converte em média 2-5x melhor que tráfego de redes sociais para a maioria dos produtos digitais.</p>

<h3>Os 3 Tipos de Intenção de Busca</h3>

<p><strong>1. Intenção Informacional</strong> (60-70% das buscas)<br/>
A pessoa quer aprender: "como fazer lançamento semente", "o que é funil perpétuo".<br/>
<em>Como aproveitar:</em> posts de blog, vídeos YouTube embedados, guias completos. Objetivo é capturar o lead em troca do conteúdo.</p>

<p><strong>2. Intenção Comparativa / de Consideração</strong><br/>
A pessoa está avaliando opções: "melhor curso de marketing digital", "NexOS vs. ClickFunnels".<br/>
<em>Como aproveitar:</em> conteúdo de comparação, cases de resultado, reviews. Objetivo é aparecer quando a pessoa está decidindo.</p>

<p><strong>3. Intenção Transacional</strong> (alta conversão)<br/>
A pessoa quer agir: "comprar curso de lançamento digital", "assinar plataforma de automação de marketing".<br/>
<em>Como aproveitar:</em> landing pages de produto otimizadas, Google Ads para capturar quem está pronto para comprar.</p>

<h3>E-E-A-T: O Framework de Autoridade do Google</h3>
<p>O Google avalia conteúdo com base em E-E-A-T: Experience (Experiência), Expertise (Especialidade), Authoritativeness (Autoridade) e Trustworthiness (Confiabilidade).</p>

<ul>
  <li><strong>Experience:</strong> o criador tem experiência direta com o assunto? Mencione casos reais, números específicos, datas. Primeira pessoa ("na minha primeira campanha...") sinaliza experiência.</li>
  <li><strong>Expertise:</strong> a profundidade do conteúdo demonstra conhecimento real? O Google consegue diferenciar conteúdo superficial de conteúdo de especialista.</li>
  <li><strong>Authoritativeness:</strong> outros sites relevantes linkam para você? Backlinks de sites de autoridade são o principal sinal externo de autoridade.</li>
  <li><strong>Trustworthiness:</strong> o site tem HTTPS? Política de privacidade? Informações de contato? Esses sinais básicos afetam a confiabilidade percebida.</li>
</ul>

<h3>SEO para Landing Pages de Produto Digital</h3>
<p>Muitos produtores ignoram SEO para páginas de venda — mas ranquear organicamente para termos transacionais é uma das aquisições de cliente mais baratas possíveis.</p>

<p>Otimizações essenciais para landing pages:</p>
<ul>
  <li>Title tag (aparece na aba do navegador e no resultado do Google): keyword principal + diferencial único</li>
  <li>Meta description (o texto que aparece no resultado de busca): 155 caracteres com CTA</li>
  <li>H1 único com keyword principal</li>
  <li>Schema markup de produto (ajuda o Google a entender que é uma página de produto)</li>
  <li>Velocidade de carregamento abaixo de 2.5s no mobile (Core Web Vitals é fator de ranking)</li>
</ul>`
          }
        ],
        locked: true
      },
      {
        id: "algoritmo-dominio-total",
        number: 20,
        title: "Domínio Total: Estratégia Multi-Plataforma e Omnichannel",
        subtitle: "Como criar uma presença algorítmica que se reforça em todas as plataformas simultaneamente",
        icon: "🌐",
        color: "from-emerald-600 to-cyan-600",
        duration: "1h",
        summary: "Quem domina uma plataforma tem alcance. Quem domina a interseção entre plataformas tem audiência própria — independente de qualquer algoritmo. Este capítulo final mostra como construir esse ativo.",
        lessons: [
          {
            id: "omnichannel-estrategia",
            title: "A Estratégia de Conteúdo Multi-Plataforma que Multiplica Alcance",
            duration: "25 min",
            type: "text",
            keyPoints: ["O modelo Hub & Spoke de distribuição de conteúdo", "Repurposing inteligente: um conteúdo, 7 formatos", "Como as plataformas se alimentam mutuamente", "A audiência própria: o ativo que os algoritmos não controlam"],
            content: `<h2>Multi-Plataforma: Quando 1+1+1 = 10</h2>
<p>Presença em múltiplas plataformas não significa criar conteúdo diferente para cada uma — significa criar um conteúdo central e distribuí-lo em formatos adaptados para cada plataforma. Isso é o modelo Hub & Spoke.</p>

<h3>O Modelo Hub & Spoke</h3>
<p><strong>Hub (conteúdo central):</strong> um vídeo longo do YouTube, um podcast, um artigo aprofundado — conteúdo denso que você produziu uma vez.</p>

<p><strong>Spokes (derivados):</strong> a partir do hub, você cria:</p>
<ul>
  <li>3-5 Shorts/Reels/TikToks dos melhores momentos (ferramenta: Opus Clip faz isso automaticamente)</li>
  <li>1 Carrossel do Instagram com os pontos principais</li>
  <li>1 Thread para LinkedIn/Twitter com os insights</li>
  <li>1 Email para a lista com o link + resumo dos pontos principais</li>
  <li>3-5 Stories com enquete ou pergunta derivada do tema</li>
</ul>

<p>Um vídeo de 20 minutos vira 12 peças de conteúdo distribuídas em 6 plataformas. Custo de produção de uma, alcance de doze.</p>

<h3>Como as Plataformas se Alimentam Mutuamente</h3>
<p>Cada plataforma tem um papel específico no funil e deve alimentar as outras:</p>

<p><strong>TikTok → Instagram:</strong> TikTok tem o maior alcance orgânico para novos públicos. Instagram tem maior profundidade de relacionamento. Use TikTok para descoberta, Instagram para conversão de seguidores em leads.</p>

<p><strong>YouTube → Google:</strong> Vídeos do YouTube aparecem no Google para buscas de "como fazer". O YouTube ranqueado traz tráfego do Google sem custo adicional.</p>

<p><strong>Instagram/TikTok → WhatsApp/Email:</strong> Redes sociais para descoberta, WhatsApp e email para conversão. Alguém que está no seu WhatsApp tem 8x mais probabilidade de comprar que alguém que só te segue no Instagram.</p>

<p><strong>Facebook Group → Email:</strong> Grupos geram engajamento e confiança. Use para converter membros em assinantes da lista — o ativo que você controla completamente.</p>

<h3>A Audiência Própria: O Ativo que os Algoritmos Não Controlam</h3>
<p>Seguidores nas redes sociais não são seus — são do Instagram, do TikTok, do YouTube. Quando uma plataforma muda o algoritmo, seu alcance pode cair 70% da noite para o dia.</p>

<p>Audiência própria é aquela que você controla:</p>
<ul>
  <li><strong>Lista de email:</strong> você tem o endereço. Pode enviar quando e como quiser.</li>
  <li><strong>Lista de WhatsApp:</strong> taxa de abertura de 90%+. Contato direto.</li>
  <li><strong>Membros de comunidade paga:</strong> pagaram para estar com você — maior engajamento possível.</li>
</ul>

<p>A métrica mais importante de qualquer estratégia de conteúdo não é seguidores — é o crescimento semanal da lista própria.</p>

<blockquote>Um algoritmo muda. Duas plataformas fecham por ano. A única proteção real é ter uma audiência que você pode contatar diretamente, independente de qualquer plataforma. Construa o email e o WhatsApp primeiro. Use as redes sociais como motores de alimentação dessa lista — nunca como destino final.</blockquote>`
          },
          {
            id: "algoritmo-acompanhar",
            title: "Como Acompanhar as Mudanças de Algoritmo sem Enlouquecer",
            duration: "20 min",
            type: "text",
            keyPoints: ["Fontes confiáveis para atualizações de algoritmo", "O que realmente muda vs. o que é ruído", "Como testar hipóteses de algoritmo sistematicamente", "Construindo um sistema de aprendizado contínuo"],
            content: `<h2>Algoritmos Mudam — Seu Sistema de Aprendizado não Pode Parar</h2>
<p>O maior erro de quem aprende sobre algoritmos é pensar que o conhecimento é fixo. TikTok, Instagram e Google atualizam seus algoritmos centenas de vezes por ano. A maioria das mudanças é pequena e incremental — mas algumas mudam radicalmente as regras do jogo.</p>

<h3>Fontes Confiáveis por Plataforma</h3>

<p><strong>Instagram:</strong></p>
<ul>
  <li>Blog oficial do Instagram (@creators no Instagram) — updates diretos de Adam Mosseri</li>
  <li>@socialmediaexaminer — análise de tendências com dados reais</li>
</ul>

<p><strong>TikTok:</strong></p>
<ul>
  <li>TikTok Newsroom — comunicados oficiais</li>
  <li>TikTok Creator Academy — guias oficiais de boas práticas</li>
</ul>

<p><strong>YouTube:</strong></p>
<ul>
  <li>YouTube Creator Blog — único canal oficial confiável</li>
  <li>@TeamYouTube no X/Twitter — updates rápidos</li>
</ul>

<p><strong>Google:</strong></p>
<ul>
  <li>Google Search Central Blog — onde todas as updates de algoritmo são documentadas</li>
  <li>@searchliaison no X/Twitter — porta-voz oficial do Google Search</li>
</ul>

<h3>O que Realmente Muda vs. Ruído</h3>
<p>A internet de marketing digital gera pânico a cada boato de mudança de algoritmo. Regra simples para filtrar:</p>

<p><strong>Ignore:</strong> afirmações sem fonte oficial, "estratégias secretas reveladas", qualquer conteúdo que diz "o algoritmo foi completamente mudado" sem link para comunicado oficial.</p>

<p><strong>Preste atenção:</strong> comunicados de blog oficial das plataformas, mudanças confirmadas por múltiplas fontes independentes com dados, estudos com metodologia clara (não "eu percebi que...").</p>

<h3>Sistema de Teste de Hipóteses</h3>
<p>Ao invés de acreditar em tudo que lê sobre algoritmos, teste você mesmo:</p>
<ol>
  <li>Formule uma hipótese: "Posts publicados às 19h têm mais alcance que às 9h para minha audiência"</li>
  <li>Crie um teste controlado: publique conteúdo similar em horários diferentes por 4 semanas</li>
  <li>Meça a variável certa: não curtidas — alcance orgânico e salvamentos</li>
  <li>Tome conclusão baseada em dados: não em 2 posts, mas em pelo menos 8-10</li>
</ol>

<p>Essa abordagem científica tem dois benefícios: gera conhecimento real sobre seu nicho específico (algoritmos se comportam diferente por nicho) e imuniza contra o ruído do "guru descobriu novo hack do algoritmo".</p>

<blockquote>O algoritmo muda. A psicologia humana não. Conteúdo que retém atenção, gera emoção genuína e entrega valor real sempre vai ser distribuído — independente das mudanças. Domine a psicologia e você estará sempre à frente das mudanças de algoritmo.</blockquote>`
          },
          {
            id: "algoritmo-exercicio-final",
            title: "Exercício Final: Auditoria Algorítmica do Seu Negócio",
            duration: "15 min",
            type: "exercise",
            glossaryTerms: ["roas", "ctr", "completion-rate", "hook-rate", "retargeting"],
            keyPoints: ["Mapeamento atual de plataformas e performance", "Identificação de gaps algorítmicos", "Plano de 30 dias para otimização"],
            content: `<h2>Exercício: Auditoria Algorítmica Completa</h2>
<p>Este exercício leva 30-45 minutos e vai revelar onde estão os maiores gaps algorítmicos no seu negócio hoje — e as oportunidades de maior impacto com menor esforço.</p>

<h3>Parte 1: Mapeamento (15 min)</h3>
<p>Para cada plataforma que você usa, preencha:</p>

<table>
<tr><th>Plataforma</th><th>Seguidores/Assinantes</th><th>Alcance médio por post</th><th>Taxa de engajamento</th><th>Conversões/mês para sua lista</th></tr>
<tr><td>TikTok</td><td>___</td><td>___</td><td>___</td><td>___</td></tr>
<tr><td>Instagram</td><td>___</td><td>___</td><td>___</td><td>___</td></tr>
<tr><td>YouTube</td><td>___</td><td>___</td><td>___</td><td>___</td></tr>
<tr><td>Facebook</td><td>___</td><td>___</td><td>___</td><td>___</td></tr>
<tr><td>Email/WhatsApp</td><td>___</td><td>___</td><td>___</td><td>___</td></tr>
</table>

<h3>Parte 2: Análise de Gaps (10 min)</h3>
<p>Responda:</p>
<ul>
  <li>Em qual plataforma você tem o maior alcance mas a menor conversão para lista própria?</li>
  <li>Em qual plataforma você está completamente ausente mas sua audiência-alvo está presente?</li>
  <li>Qual é a sua taxa de crescimento semanal da lista de email + WhatsApp combinados?</li>
  <li>Qual plataforma você usa mais por hábito mas que tem menor ROI de tempo investido?</li>
</ul>

<h3>Parte 3: Plano de 30 Dias (15 min)</h3>
<p>Com base na análise, defina:</p>
<ul>
  <li><strong>Plataforma principal:</strong> onde você vai investir 70% do esforço de criação</li>
  <li><strong>Plataformas de distribuição (2 no máximo):</strong> onde você vai repurposar o conteúdo principal</li>
  <li><strong>Meta de crescimento de lista:</strong> quantos novos contatos de email/WhatsApp por semana</li>
  <li><strong>Uma mudança no hook</strong> que você vai testar nas próximas 2 semanas</li>
  <li><strong>Uma métrica nova</strong> que você vai começar a acompanhar que nunca acompanhou antes</li>
</ul>

<blockquote>O produtor que vence algoritmicamente não é o que sabe tudo sobre os algoritmos — é o que tem um sistema de aprendizado contínuo, testa hipóteses com dados e otimiza consistentemente. Você acabou de adquirir o mapa. O caminho é construído com execução.</blockquote>`
          }
        ],
        locked: true
      },
      {
        id: "segredo-redes-sociais",
        number: 21,
        title: "O Segredo das Redes Sociais",
        subtitle: "A revelação que gestores de tráfego e plataformas nunca vão te contar",
        icon: "🔐",
        color: "from-red-950 to-gray-900",
        duration: "2h",
        summary: "Você passou o módulo inteiro aprendendo a usar algoritmos. Agora vai descobrir o que está por trás deles — o modelo de negócio que nenhuma plataforma quer que você entenda. Esta é a virada de chave que separa os criadores que constroem impérios dos que ficam eternamente dependentes de alcance alugado.",
        lessons: [
          {
            id: "segredo-1-ilusao",
            title: "A Grande Ilusão: O que Você Acredita vs. a Realidade",
            duration: "22 min",
            type: "text",
            glossaryTerms: ["algoritmo-de-recomendacao", "shadow-ban", "frequencia"],
            keyPoints: ["O que você acredita que está fazendo nas redes sociais", "O que você está realmente fazendo", "Por que essa distinção muda tudo", "A ilusão do criador independente"],
            content: `<h2>Antes de Revelar o Segredo: Uma Pergunta</h2>
<p>Para que você usa as redes sociais no seu negócio? Pense na sua resposta antes de continuar.</p>

<p>A maioria das pessoas responde algo como: <em>"Para crescer minha audiência", "Para vender meus produtos", "Para construir minha marca".</em></p>

<p>Essas respostas são verdadeiras do seu ponto de vista. Mas não são verdadeiras do ponto de vista das plataformas. E essa discrepância é o segredo que muda tudo.</p>

<h2>O Modelo de Negócio que Ninguém Explica</h2>
<p>Vamos começar com um fato que quase ninguém processa de verdade:</p>

<p><strong>Meta (Facebook + Instagram) tem receita de ~$135 bilhões por ano. 98,5% dessa receita vem de publicidade.</strong></p>

<p>Isso significa que o cliente real da Meta não é você — criador de conteúdo. O cliente real são as marcas que pagam bilhões por anúncios. Você é o fornecedor de matéria-prima, não o cliente.</p>

<h3>Os 4 Papéis no Ecossistema das Plataformas</h3>

<p><strong>1. As Plataformas (Meta, TikTok, YouTube)</strong><br/>
São empresas de tecnologia cujo produto real é <em>atenção quantificada e vendável</em>. Elas não distribuem conteúdo — elas vendem atenção de audiência para anunciantes.</p>

<p><strong>2. Os Criadores (você)</strong><br/>
São fornecedores de conteúdo não-remunerado que atraem e retêm usuários na plataforma. Cada post seu mantém pessoas na plataforma por mais tempo — o que aumenta o inventário de anúncios disponível.</p>

<p><strong>3. Os Usuários (sua audiência)</strong><br/>
São o produto. Sua atenção, comportamento e dados demográficos são o que os anunciantes estão comprando. Cada segundo que passam na plataforma é monetizado.</p>

<p><strong>4. Os Anunciantes</strong><br/>
São os clientes reais. Pagam para ter acesso à atenção dos usuários, segmentada com precisão cirúrgica graças aos dados coletados do comportamento de todos os usuários — incluindo você.</p>

<h2>A Implicação Que Ninguém Quer Admitir</h2>
<p>Quando você cria um conteúdo viral que mantém 50.000 pessoas no TikTok por 3 minutos, você acabou de gerar 150.000 minutos de inventário de anúncios para o TikTok.</p>

<p>Você foi pago por isso? Não, a menos que você esteja no programa de criadores do TikTok, que paga uma fração de centavo por visualização. O TikTok monetizou seu trabalho exponencialmente mais do que te pagou.</p>

<p>Isso não é conspiração — é o modelo de negócio declarado de todas as plataformas. É o que consta nos relatórios anuais para os investidores. A maioria dos criadores simplesmente nunca para para ler esses documentos.</p>

<h2>Mas Espera — Isso Não Significa que as Redes Sociais São Inúteis</h2>
<p>Absolutamente não. As plataformas são ferramentas poderosas. O ponto não é evitá-las — é usá-las com os olhos abertos, entendendo quem é o cliente de quem.</p>

<p>O criador ingênuo pensa: <em>"Vou crescer no Instagram e depois monetizar minha audiência."</em></p>

<p>O criador estratégico pensa: <em>"Vou usar o alcance do Instagram para construir uma audiência que EU controlo — e depois monetizá-la com ou sem o Instagram."</em></p>

<p>A diferença entre essas duas perspectivas vale milhões. Literalmente.</p>

<blockquote>A ilusão mais cara do marketing digital é acreditar que seguidores são ativos seus. Eles não são. São dados no banco de dados de uma empresa de capital aberto que pode mudar as regras amanhã — e muda, consistentemente, sempre que é financeiramente conveniente.</blockquote>`
          },
          {
            id: "segredo-2-supressao",
            title: "A Supressão Programada: O Ciclo que Toda Plataforma Repete",
            duration: "28 min",
            type: "text",
            glossaryTerms: ["shadow-ban", "frequencia", "algoritmo-de-recomendacao", "cpm"],
            keyPoints: ["Os dados documentados de declínio de alcance orgânico", "O ciclo de 4 fases que toda plataforma repete", "Por que o alcance vai continuar caindo", "O que gestores de tráfego nunca admitem sobre isso"],
            content: `<h2>Os Números Que Nenhuma Plataforma Quer que Você Veja</h2>
<p>Vamos falar em dados. Não em teorias — em números documentados e verificáveis:</p>

<h3>Facebook: O Caso de Estudo Definitivo</h3>
<table>
<tr><th>Ano</th><th>Alcance orgânico médio de páginas</th></tr>
<tr><td>2012</td><td>~16% dos seguidores</td></tr>
<tr><td>2014</td><td>~6% dos seguidores</td></tr>
<tr><td>2016</td><td>~2,6% dos seguidores</td></tr>
<tr><td>2018</td><td>~1,8% dos seguidores</td></tr>
<tr><td>2024</td><td>~1,2-1,5% dos seguidores</td></tr>
</table>

<p>Uma página com 100.000 seguidores que em 2012 alcançava 16.000 pessoas organicamente por post, hoje alcança 1.200-1.500. Uma redução de 90% em 12 anos.</p>

<p>Isso não é coincidência ou "o algoritmo ficou mais inteligente". É política de negócios deliberada, documentada internamente e revelada em inúmeros vazamentos de documentos internos do Facebook.</p>

<h3>O Ciclo de 4 Fases que Toda Plataforma Repete</h3>
<p>Este padrão se repete em TODA plataforma que atinge escala:</p>

<p><strong>Fase 1 — Abertura (crescimento da plataforma)</strong><br/>
Plataforma precisa de criadores para atrair usuários. Alcance orgânico é generoso — às vezes absurdamente generoso. O TikTok em 2020, o Instagram Reels em 2022 nessa fase. A plataforma precisa de você mais do que você precisa dela.</p>

<p><strong>Fase 2 — Crescimento Mútuo</strong><br/>
Criadores crescem. Usuários crescem. A plataforma começa a ter valor de inventário de anúncios. Os primeiros formatos de monetização de anúncios aparecem.</p>

<p><strong>Fase 3 — Monetização do Alcance</strong><br/>
A plataforma tem escala suficiente para vender alcance para anunciantes. O alcance orgânico começa a declinar gradualmente — nunca de uma vez, sempre suavemente. Surgem as primeiras ferramentas de anúncio. Criadores "percebem" que pagando têm mais alcance.</p>

<p><strong>Fase 4 — Dependência e Extração</strong><br/>
Alcance orgânico está tão baixo que é economicamente inviável depender dele. Criadores que construíram negócios na plataforma precisam pagar para ter acesso à própria audiência. Novos criadores entram no ecossistema direto para a fase 4.</p>

<h3>Onde Cada Plataforma Está Hoje</h3>
<ul>
  <li><strong>Facebook:</strong> Fase 4 há anos. Alcance orgânico de página: morto.</li>
  <li><strong>Instagram:</strong> Fase 3-4. Reels ainda têm alcance razoável, Feed e Stories em declínio.</li>
  <li><strong>YouTube:</strong> Fase 3. Canal orgânico ainda viável via SEO, mas recomendação cada vez mais paga.</li>
  <li><strong>TikTok:</strong> Fase 2-3. Ainda tem o melhor alcance orgânico — mas os dados mostram declínio consistente desde 2022.</li>
  <li><strong>LinkedIn:</strong> Fase 2-3. Ainda excelente para B2B orgânico — aproveite agora.</li>
</ul>

<h3>O que Gestores de Tráfego Nunca Vão te Dizer</h3>
<p>Gestores de tráfego sobrevivem da dependência. O modelo de negócio deles é cobrar para gerenciar seus anúncios — o que pressupõe que você PRECISA de anúncios. Um gestor que te dissesse "construa uma lista de email e fique menos dependente de anúncios" estaria cortando seu próprio faturamento.</p>

<p>Isso não é acusação — é incentivo econômico. Entenda o incentivo de quem te dá conselho.</p>

<p>Da mesma forma: plataformas têm times inteiros de "evangelist relations" cujo trabalho é convencer criadores de que alcance orgânico ainda funciona e que o futuro é brilhante. Esses profissionais são pagos para manter você criando conteúdo gratuitamente enquanto a plataforma vende sua audiência.</p>

<blockquote>Toda plataforma faz a mesma promessa: "crie bom conteúdo e vamos distribuir". Toda plataforma quebra essa promessa da mesma forma: gradualmente, suavemente, de forma que nunca dá para identificar um momento específico em que mudou — mas você olha para trás e percebe que o jogo é completamente diferente do que era quando começou.</blockquote>`
          },
          {
            id: "segredo-3-predicao-comportamental",
            title: "O Motor de Predição Comportamental: Por que Qualidade Não é o Critério",
            duration: "25 min",
            type: "text",
            glossaryTerms: ["algoritmo-de-recomendacao", "completion-rate", "hook-rate", "rewatch-rate", "ctr"],
            keyPoints: ["O algoritmo não mede qualidade — mede previsibilidade comportamental", "Por que conteúdo manipulativo supera conteúdo genuíno nas métricas", "O que os criadores de 8 dígitos fazem diferente", "A linha entre engajamento legítimo e exploração do algoritmo"],
            content: `<h2>O que o Algoritmo Realmente Otimiza</h2>
<p>Aqui está uma afirmação que vai soar errada mas é matematicamente correta:</p>

<p><strong>O algoritmo não distribui o melhor conteúdo. Distribui o conteúdo com comportamento mais previsível.</strong></p>

<p>Deixa eu explicar com precisão o que isso significa.</p>

<h3>A Função Objetivo do Algoritmo</h3>
<p>Todo modelo de machine learning tem uma "função objetivo" — a variável que ele está tentando maximizar. Para algoritmos de recomendação de plataformas sociais, a função objetivo é:</p>

<p><strong>Maximizar o tempo total que todos os usuários passam na plataforma por dia.</strong></p>

<p>Não é "distribuir conteúdo de qualidade". Não é "ajudar criadores a crescer". É tempo total de sessão — porque isso é o que se converte em impressões de anúncio, que se converte em receita.</p>

<h3>O Problema com Qualidade</h3>
<p>"Qualidade" é subjetiva e difícil de medir. "Comportamento observável" é objetivo e mensurável em tempo real.</p>

<p>O algoritmo não pergunta "esse conteúdo é bom?". Ele pergunta "esse conteúdo gera o comportamento que maximiza o tempo de sessão?" — e mede isso com milissegundos de precisão.</p>

<p>Comportamentos que maximizam tempo de sessão:</p>
<ul>
  <li>Assistir até o final (completion) → o usuário ficou na plataforma X segundos</li>
  <li>Assistir mais de uma vez (rewatch) → ficou X×2 segundos</li>
  <li>Ir para o próximo vídeo imediatamente após (session continuation) → ficou na plataforma mais tempo</li>
  <li>Comentar → interação que gera notificação → traz o usuário de volta depois</li>
  <li>Compartilhar → traz novos usuários para a plataforma</li>
</ul>

<h3>O Paradoxo do Conteúdo "Ruim" que Performa Bem</h3>
<p>Conteúdo que gera indignação, controvérsia ou debate acirrado tem completion rate altíssimo. As pessoas assistem até o final porque querem "ver onde isso vai chegar". Compartilham porque querem "mostrar o absurdo". Comentam porque precisam "rebater".</p>

<p>Do ponto de vista do algoritmo, esse conteúdo é excelente — gerou todos os comportamentos desejados. Do ponto de vista de quem quer construir autoridade e gerar receita sustentável, é um desastre.</p>

<h3>O que Criadores de Alto Nível Fazem Diferente</h3>
<p>Os criadores que consistentemente vendem cursos de R$5k-R$50k não são necessariamente os que têm mais seguidores ou mais viral. São os que desenvolveram a habilidade de criar conteúdo que:</p>

<ol>
  <li><strong>Gera os sinais de comportamento que o algoritmo valoriza</strong> (completion, rewatch, shares) — para receber distribuição</li>
  <li><strong>Ao mesmo tempo atrai especificamente quem tem capacidade e intenção de comprar</strong> — não qualquer audiência, mas a audiência certa</li>
  <li><strong>E move essa audiência para canais próprios</strong> (email, WhatsApp) — para não depender do algoritmo para a próxima venda</li>
</ol>

<p>Esse equilíbrio — servir o algoritmo sem se tornar escravo dele — é a habilidade mais valiosa do marketing digital contemporâneo.</p>

<blockquote>O algoritmo é uma ferramenta de distribuição com um viés embutido: favorece comportamento previsível, não valor genuíno. Seu trabalho como criador estratégico é criar conteúdo que engana o algoritmo de uma forma ética — que parece comportamentalmente previsível para o sistema, mas entrega valor real para humanos. Essa é a arte do criador de alto nível.</blockquote>`
          },
          {
            id: "segredo-4-dois-jogos",
            title: "A Virada de Chave: O Framework dos Dois Jogos",
            duration: "30 min",
            type: "text",
            glossaryTerms: ["lead-magnet", "opt-in", "nurturing", "ltv", "churn-rate", "mrr"],
            keyPoints: ["Jogo 1: a plataforma quer que você jogue", "Jogo 2: o jogo que te dá liberdade real", "Por que 1.000 emails valem mais que 100.000 seguidores", "A matemática do alcance alugado vs. alcance próprio", "Como construir os dois simultaneamente"],
            content: `<h2>A Revelação Central: Existem Dois Jogos</h2>
<p>Tudo que você aprendeu neste módulo sobre algoritmos — TikTok, Instagram, YouTube, Facebook, Google — é sobre como jogar o Jogo 1. Este capítulo é sobre o Jogo 2. E o Jogo 2 é onde a liberdade financeira real está.</p>

<h3>Jogo 1: O Jogo da Plataforma</h3>
<p>Objetivo: crescer seguidores, aumentar alcance, viralizar.<br/>
Métricas: seguidores, visualizações, impressões, curtidas.<br/>
Controlado por: algoritmos da plataforma.<br/>
Ativo gerado: seguidores em uma conta que não é sua.<br/>
Risco: conta banida, algoritmo mudado, plataforma fechada = zero.</p>

<p>O Jogo 1 é necessário — é o motor de aquisição. Mas é eternamente instável. Você está construindo em terreno alugado.</p>

<h3>Jogo 2: O Jogo da Independência</h3>
<p>Objetivo: converter audiência de plataforma em audiência própria.<br/>
Métricas: tamanho e engajamento da lista de email, contatos de WhatsApp, membros de comunidade.<br/>
Controlado por: você.<br/>
Ativo gerado: banco de dados de pessoas que você pode contatar diretamente, para sempre.<br/>
Risco: quase zero — você tem os dados, independente de qualquer plataforma.</p>

<h3>A Matemática Que Ninguém Mostra</h3>
<p>Vamos colocar números reais nisso:</p>

<p><strong>Cenário A: 100.000 seguidores no Instagram, zero lista própria</strong><br/>
Alcance médio por post: 2.500 pessoas (2,5%)<br/>
Taxa de clique para oferta: 1% = 25 pessoas<br/>
Taxa de conversão da oferta: 3% = 0,75 vendas por post<br/>
Produto de R$2.000: R$1.500 por campanha de posts<br/>
Risco: se o Instagram mudar o algoritmo ou banir a conta, receita = R$0</p>

<p><strong>Cenário B: 10.000 seguidores, 3.000 emails e 1.500 no WhatsApp</strong><br/>
Email: 3.000 × 30% abertura = 900 leitores × 5% clique = 45 visitas<br/>
WhatsApp: 1.500 × 90% leitura = 1.350 × 10% clique = 135 visitas<br/>
Total: 180 visitas à oferta × 3% conversão = 5,4 vendas<br/>
Produto de R$2.000: R$10.800 por campanha<br/>
Risco: se o Instagram sumisse amanhã, 90% da receita ainda acontece</p>

<p><strong>O Cenário B gera 7x mais receita com 10x menos seguidores.</strong></p>

<h3>Por que 1.000 Emails Valem Mais que 100.000 Seguidores</h3>
<p>Esta afirmação parece absurda até você ver os dados:</p>

<table>
<tr><th>Canal</th><th>Taxa de Alcance</th><th>Taxa de Clique</th><th>Controle</th></tr>
<tr><td>Instagram Feed</td><td>2-5%</td><td>0,5-2%</td><td>Plataforma</td></tr>
<tr><td>Instagram Stories</td><td>5-10%</td><td>1-3%</td><td>Plataforma</td></tr>
<tr><td>Email Marketing</td><td>25-40%</td><td>2-8%</td><td>Você</td></tr>
<tr><td>WhatsApp Broadcast</td><td>85-95%</td><td>15-30%</td><td>Você</td></tr>
</table>

<p>Um email com 30% de abertura e 5% de clique alcança 150 pessoas de 1.000 contatos. Instagram com 3% de alcance e 1% de CTR alcança 30 pessoas de 1.000 seguidores. O email entrega 5x mais alcance efetivo — e você paga centavos por envio, não uma taxa de engajamento ao algoritmo.</p>

<h3>Como Jogar os Dois Jogos Simultaneamente</h3>
<p>A estratégia não é abandonar as plataformas. É usá-las com propósito diferente:</p>

<p><strong>Plataformas = Motor de Aquisição de Leads</strong><br/>
Todo conteúdo tem um segundo objetivo além do engajamento: mover a pessoa para sua lista própria. Lead magnet na bio, CTA no final de cada vídeo, ManyChat capturando quem comenta.</p>

<p><strong>Email + WhatsApp = Motor de Conversão</strong><br/>
Quando você tem algo para vender, vai para a lista própria. Taxa de conversão 3-5x maior. Independência total de algoritmos.</p>

<p><strong>A Métrica que realmente importa</strong><br/>
Substitua "quantos seguidores ganhei essa semana" por "quantos contatos próprios (email + WhatsApp) adquiri essa semana". Esse número determina sua receita em 6 meses, não o número de seguidores.</p>

<blockquote>O segredo mais guardado do marketing digital não está em qual plataforma usar ou qual hack de algoritmo funciona hoje. Está em entender que plataformas são minas de ouro temporárias — você extrai o máximo enquanto pode e guarda o ouro em cofre próprio (sua lista). Os criadores que dependem do ouro ainda estar na mina quando precisarem são os que ficam sem renda quando o algoritmo muda. Os que já transferiram para o cofre próprio são os que têm negócios reais.</blockquote>`
          },
          {
            id: "segredo-5-framework-independencia",
            title: "O Framework de Independência: Construindo um Negócio à Prova de Algoritmo",
            duration: "28 min",
            type: "text",
            glossaryTerms: ["ltv", "cac", "mrr", "churn-rate", "membership", "escada-de-valor"],
            keyPoints: ["Os 5 ativos de um negócio digital antifrágil", "O sistema de conversão de seguidor para comprador", "A estrutura de receita que não depende de nenhuma plataforma", "Por que o timing de construção desses ativos importa mais que tudo"],
            content: `<h2>O Negócio Digital Antifrágil</h2>
<p>Antifrágil é o conceito de Nassim Taleb: sistemas que não apenas sobrevivem ao caos — mas ficam mais fortes com ele. Um negócio digital antifrágil não apenas sobrevive a mudanças de algoritmo — usa essas mudanças como vantagem competitiva (enquanto concorrentes dependentes panicamente perdem receita, você continua vendendo normalmente).</p>

<h3>Os 5 Ativos do Negócio Digital Antifrágil</h3>

<p><strong>Ativo 1: Lista de Email Qualificada (Não Apenas Grande)</strong><br/>
Uma lista de 3.000 compradores anteriores é mais valiosa que 30.000 leads frios. A qualidade da segmentação importa mais que o volume. Como construir: cada produto vendido, cada lead magnet baixado, cada webinar assistido vira um contato segmentado por comportamento e interesse.</p>

<p><strong>Ativo 2: Lista de WhatsApp Segmentada</strong><br/>
O canal de maior alcance e menor custo disponível. 90%+ de leitura, contato pessoal e direto. Requer construção cuidadosa (ninguém quer spam no WhatsApp pessoal) — mas quem tem 1.000 contatos qualificados no WhatsApp tem um ativo de valor incalculável.</p>

<p><strong>Ativo 3: Comunidade Própria Paga</strong><br/>
Membros pagantes têm o maior engajamento e o menor custo de manutenção de relacionamento. Um membership de R$97/mês com 200 membros (R$19.400/mês de receita recorrente) é uma base que funciona independente de qualquer plataforma.</p>

<p><strong>Ativo 4: Biblioteca de Conteúdo com SEO</strong><br/>
Artigos e vídeos bem posicionados no Google e YouTube continuam gerando tráfego por anos. Um vídeo do YouTube que ranqueia para "como fazer lançamento semente" pode trazer 500 visitas por mês durante 3 anos sem nenhum trabalho adicional. É o único ativo de conteúdo com retorno composto real.</p>

<p><strong>Ativo 5: Produto com Alto LTV e Baixo Churn</strong><br/>
Um produto tão bom que clientes ficam, indicam e voltam. LTV alto significa que você pode gastar mais na aquisição — vantagem competitiva direta em anúncios. Com LTV de R$5.000, você pode pagar R$1.500 de CAC e ainda ter margens de 70%.</p>

<h3>O Sistema de Conversão: Do Seguidor ao Comprador</h3>

<pre>
PLATAFORMA (qualquer uma)
   ↓ [conteúdo de valor com CTA]
LEAD MAGNET (isca gratuita específica)
   ↓ [captura email + WhatsApp]
SEQUÊNCIA DE NURTURING (3-7 dias)
   ↓ [entrega valor, constrói confiança]
OFERTA DE ENTRADA (produto de R$97-R$297)
   ↓ [primeira compra — cliente ativado]
SEQUÊNCIA DE UPSELL
   ↓ [produto core R$997-R$2.997]
MEMBERSHIP OU HIGH TICKET
   ↓ [receita recorrente + indicações]
LTV COMPOSTO
</pre>

<p>Cada pessoa que entra nesse sistema tem valor muito maior que um seguidor que nunca foi capturado. A diferença é o opt-in — o momento em que a pessoa diz "sim, quero receber mais de você".</p>

<h3>Por que o Timing Importa Mais que Tudo</h3>
<p>Você poderia ter começado a construir esse sistema em 2015, no pico do alcance orgânico do Facebook — e teria uma lista de 100.000 emails construída quase de graça, e hoje venderia para essa lista com custo zero de aquisição.</p>

<p>Você não pode voltar a 2015. Mas em 10 anos, alguém vai olhar para 2025 e pensar: "queria ter começado a construir minha lista quando o TikTok ainda tinha alcance orgânico alto".</p>

<p>O melhor momento para construir sua lista foi há 5 anos. O segundo melhor momento é hoje.</p>

<blockquote>Algoritmos mudam. Plataformas fecham. Tendências passam. O único ativo do marketing digital que aprecia com o tempo e não depende de nenhuma empresa de tecnologia é a sua lista de pessoas que confiam em você o suficiente para dar o contato pessoal delas. Tudo que aprendeu neste curso serve a um único propósito superior: construir essa lista. O dia que você entender isso de verdade, você para de trabalhar para o algoritmo — e o algoritmo começa a trabalhar para você.</blockquote>`
          },
          {
            id: "segredo-exercicio-auditoria",
            title: "Exercício Final: Auditoria de Independência Algorítmica",
            duration: "20 min",
            type: "exercise",
            glossaryTerms: ["ltv", "cac", "mrr", "churn-rate", "opt-in", "lead-magnet"],
            keyPoints: ["Calcular seu score de dependência atual", "Identificar o maior risco ao seu negócio", "Criar plano de independência de 90 dias"],
            content: `<h2>Auditoria de Independência Algorítmica</h2>
<p>Este exercício revela sua vulnerabilidade real — e o caminho para a independência. Reserve 30-40 minutos, seja honesto nos números e não julgue onde você está. Só o diagnóstico honesto permite a prescrição certa.</p>

<h3>Parte 1: Inventário de Audiência (10 min)</h3>
<p>Preencha seu inventário atual:</p>

<p><strong>Audiência Alugada (não controlada por você):</strong></p>
<ul>
  <li>Seguidores no Instagram: ____</li>
  <li>Inscritos no YouTube: ____</li>
  <li>Seguidores no TikTok: ____</li>
  <li>Curtidas na página do Facebook: ____</li>
  <li>Seguidores no LinkedIn: ____</li>
  <li><strong>Total de audiência alugada: ____</strong></li>
</ul>

<p><strong>Audiência Própria (controlada por você):</strong></p>
<ul>
  <li>Contatos de email: ____</li>
  <li>Contatos no WhatsApp (broadcast/grupo): ____</li>
  <li>Membros de comunidade paga: ____</li>
  <li><strong>Total de audiência própria: ____</strong></li>
</ul>

<p><strong>Índice de Independência = Audiência Própria ÷ Total × 100 = ____%</strong></p>
<ul>
  <li>Abaixo de 5%: Dependência crítica — você está um update de algoritmo longe de perder o negócio</li>
  <li>5-20%: Dependência alta — vulnerável, mas com base para construir</li>
  <li>20-50%: Dependência moderada — bom progresso, continue construindo</li>
  <li>Acima de 50%: Baixa dependência — negócio antifrágil em construção</li>
</ul>

<h3>Parte 2: Auditoria de Receita (10 min)</h3>
<p>Para cada fonte de receita dos últimos 3 meses, identifique:</p>
<table>
<tr><th>Fonte</th><th>Receita (R$)</th><th>Depende de algoritmo?</th><th>Sobrevive sem redes sociais?</th></tr>
<tr><td>Lançamentos via Instagram/TikTok</td><td>R$____</td><td>Sim / Parcial / Não</td><td>Sim / Não</td></tr>
<tr><td>Email marketing</td><td>R$____</td><td>Sim / Parcial / Não</td><td>Sim / Não</td></tr>
<tr><td>WhatsApp marketing</td><td>R$____</td><td>Sim / Parcial / Não</td><td>Sim / Não</td></tr>
<tr><td>Indicações / boca a boca</td><td>R$____</td><td>Sim / Parcial / Não</td><td>Sim / Não</td></tr>
<tr><td>Membership / recorrência</td><td>R$____</td><td>Sim / Parcial / Não</td><td>Sim / Não</td></tr>
</table>

<p><strong>Pergunta crítica:</strong> Se sua conta principal do Instagram fosse banida amanhã sem aviso, qual % da sua receita sobreviveria? ____%</p>

<h3>Parte 3: Plano de 90 Dias (10 min)</h3>
<p>Com base na auditoria, defina 3 ações concretas para aumentar sua independência algorítmica:</p>

<p><strong>Ação 1 (Semanas 1-4):</strong> Criar ou otimizar seu lead magnet principal<br/>
Meta específica: capturar ____ novos emails por semana<br/>
Canal: ____</p>

<p><strong>Ação 2 (Semanas 5-8):</strong> Estruturar canal de WhatsApp Broadcast<br/>
Meta: ____ contatos no WhatsApp até o fim do período<br/>
Estratégia de captura: ____</p>

<p><strong>Ação 3 (Semanas 9-12):</strong> Lançar ou melhorar produto de entrada<br/>
Preço: R$____<br/>
Meta de MRR ao final de 90 dias: R$____</p>

<p><strong>Declaração de Comprometimento:</strong><br/>
Escreva em uma frase o que vai mudar na sua estratégia depois deste curso:</p>
<p><em>"A partir de hoje, cada conteúdo que criar vai ter o objetivo duplo de _________________ (métrica da plataforma) E _________________ (crescimento de audiência própria)."</em></p>

<blockquote>Você chegou ao final do portal. Dos fundamentos à psicologia do algoritmo, dos lançamentos à estrutura de monetização, das ferramentas ao segredo que poucos admitem: o jogo real não é de alcance — é de propriedade. Não de seguidores — de relacionamentos. Não de virais — de confiança construída ao longo do tempo. Esse é o segredo das redes sociais. Agora é sua vez de usá-lo.</blockquote>`,
            exercise: `<h3>Tarefa Imediata (faça hoje)</h3>
<p>Antes de fechar o portal, execute estas 3 ações em menos de 30 minutos:</p>
<ol>
  <li><strong>Calcule seu Índice de Independência</strong> com os números reais da Parte 1 da auditoria acima</li>
  <li><strong>Defina uma meta de email para os próximos 30 dias</strong> (ex: "vou de 500 para 750 emails") e coloque no calendário as ações semanais para chegar lá</li>
  <li><strong>Escreva o copy do seu próximo lead magnet</strong> — título, subtítulo e os 5 benefícios principais. Não precisa criar hoje, mas o copy precisa existir para você agir</li>
</ol>
<p>O conhecimento sem ação é apenas entretenimento. A ação começa agora.</p>`
          }
        ],
        locked: false
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
