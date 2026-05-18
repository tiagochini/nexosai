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
    id: "automacoes",
    number: 3,
    title: "Automações e NexOS na Prática",
    description: "Como o NexOS automatiza cada etapa da sua campanha. Do intake ao pós-venda, veja os agentes de IA trabalhando em tempo real.",
    badge: "NexOS",
    chapters: [
      {
        id: "nexos-visao",
        number: 7,
        title: "NexOS: A Visão do Sistema",
        subtitle: "Como a IA orquestra uma campanha inteira em minutos",
        icon: "⚡",
        color: "from-purple-600 to-indigo-600",
        duration: "50 min",
        summary: "Entenda a arquitetura do NexOS: como 29 agentes de IA trabalham em conjunto para planejar, executar e otimizar campanhas sem intervenção manual.",
        lessons: [
          {
            id: "nexos-1",
            title: "Os 29 Agentes NexOS e Seus Papéis",
            duration: "20 min",
            type: "text",
            keyPoints: ["Arquitetura multi-agente", "Claude para estratégia, GPT-4o para copy, Gemini para analytics", "O fluxo de execução automático"],
            content: `<h2>A Máquina de Lançamento Autônoma</h2>
<p>O NexOS foi construído com uma premissa única: e se fosse possível ter um time de especialistas trabalhando 24/7 na sua campanha, sem custos fixos, sem inconsistências?</p>

<h3>A Arquitetura de 3 Camadas</h3>

<h3>Camada 1: Estratégia (Claude Sonnet)</h3>
<p>O Claude da Anthropic processa o briefing do produto e gera a estratégia completa do lançamento: posicionamento, ângulo, público, cronograma e metas. É o "CMO artificial" da plataforma.</p>

<h3>Camada 2: Execução de Conteúdo (GPT-4o)</h3>
<p>O GPT-4o da OpenAI gera todo o copy: emails da sequência, captions de Reels, roteiro de VSL, textos de anúncios. Especializado em criatividade e nuances linguísticas.</p>

<h3>Camada 3: Analytics e Otimização (Gemini)</h3>
<p>O Gemini do Google monitora métricas em tempo real e gera recomendações de otimização: aumento de verba em criativos vencedores, pausa de audiences que estão performando mal, ajustes de copy.</p>

<h3>Os 29 Agentes Especializados</h3>

<h3>Estratégia (5 agentes)</h3>
<ul>
  <li>Estrategista de Lançamento</li>
  <li>Analista de Mercado</li>
  <li>Arquiteto de Funil</li>
  <li>Construtor de Perfil de Cliente</li>
  <li>Agente de Compliance</li>
</ul>

<h3>Conteúdo (7 agentes)</h3>
<ul>
  <li>Copywriter Master</li>
  <li>Criador de VSL</li>
  <li>Roteirista de Reels</li>
  <li>Redator de Email</li>
  <li>Criador de WhatsApp</li>
  <li>Escritor de Anúncios</li>
  <li>Criador de Sequência de Nurturing</li>
</ul>

<h3>Audiência (4 agentes)</h3>
<ul>
  <li>Segmentador de Audiência</li>
  <li>Analista de Comportamento</li>
  <li>Gerenciador de Lista</li>
  <li>Otimizador de Conversão</li>
</ul>

<h3>Vídeo (3 agentes)</h3>
<ul>
  <li>Diretor de Criativo</li>
  <li>Editor de VSL</li>
  <li>Produtor de Thumbnail</li>
</ul>

<h3>Analytics (5 agentes)</h3>
<ul>
  <li>Monitor de Métricas</li>
  <li>Detector de Fadiga Criativa</li>
  <li>Analista de ROAS</li>
  <li>Otimizador de Budget</li>
  <li>Gerador de Relatórios</li>
</ul>

<h3>Automação (5 agentes)</h3>
<ul>
  <li>Dispatcher de Email</li>
  <li>Respondedor de WhatsApp</li>
  <li>Scheduler de Conteúdo</li>
  <li>Integrador de Plataformas</li>
  <li>Monitor de Lançamento</li>
</ul>

<blockquote>Cada agente é um prompt engenheirado com centenas de horas de refinamento, conectado à base de conhecimento de mais de 500 lançamentos brasileiros bem-sucedidos.</blockquote>`
          },
          {
            id: "nexos-2",
            title: "Walkthrough: Do Briefing ao Lançamento",
            duration: "30 min",
            type: "text",
            keyPoints: ["O processo de intake conversacional", "Geração automática de estratégia", "Aprovação e execução", "Automação do carrinho"],
            content: `<h2>De Zero ao Lançamento em 7 Passos</h2>
<p>Veja como um lançamento completo é executado dentro do NexOS, do primeiro briefing à campanha ao vivo.</p>

<h3>Passo 1: Intake Conversacional (10-15 min)</h3>
<p>O agente de intake faz perguntas estruturadas sobre seu produto, audiência, histórico e metas. É como uma sessão com um estrategista sênior — ele extrai exatamente o que precisa saber.</p>
<p>Ao final, você tem um Score de Prontidão que identifica gaps antes de avançar.</p>

<h3>Passo 2: Geração de Estratégia (2-5 min)</h3>
<p>Com base no intake, o Estrategista de Lançamento gera:</p>
<ul>
  <li>Posicionamento e ângulo principal</li>
  <li>Público-alvo primário e secundário</li>
  <li>Track de lançamento recomendado (6, 8 ou 10 dígitos)</li>
  <li>Timeline de 7-21 dias</li>
  <li>KPIs-alvo com benchmarks</li>
</ul>

<h3>Passo 3: Geração de Conteúdo (5-10 min)</h3>
<p>Após aprovação da estratégia, o sistema gera automaticamente:</p>
<ul>
  <li>Sequência completa de emails (7-14 emails)</li>
  <li>Calendário de Reels (21 roteiros)</li>
  <li>Roteiro de VSL</li>
  <li>Captions para Instagram/Facebook</li>
  <li>Textos para WhatsApp (por segmento: hot/warm/cold)</li>
  <li>Copys de anúncios (5 variações por fase)</li>
</ul>

<h3>Passo 4: Aprovação Humana</h3>
<p>Tudo passa por você antes de ir ao ar. Você pode aprovar, rejeitar ou pedir reescrita. O NexOS aprende com seus feedbacks.</p>

<h3>Passo 5: Ativação da Sequência</h3>
<p>Com um clique, a sequência é ativada. O scheduler automaticamente dispara emails e mensagens de WhatsApp nos dias e horários calculados pelo algoritmo de otimização de envio.</p>

<h3>Passo 6: Lançamento ao Vivo</h3>
<p>Durante o carrinho aberto, o Monitor de Lançamento rastreia métricas em tempo real. Se uma métrica cai abaixo do threshold, alertas são gerados e sugestões de correção aparecem automaticamente.</p>

<h3>Passo 7: Análise e Memória</h3>
<p>Após o fechamento, o NexOS gera um relatório completo e armazena os aprendizados na memória da workspace. O próximo lançamento começa com essa base.</p>`
          }
        ],
        locked: true
      },
      {
        id: "escassez-automacao",
        number: 8,
        title: "Escassez Inteligente e Automação de Carrinho",
        subtitle: "Como os sistemas automatizados maximizam receita nos dias finais",
        icon: "⏱",
        color: "from-orange-600 to-red-600",
        duration: "40 min",
        summary: "Os últimos 48h de um lançamento podem representar 50-70% da receita total. Aprenda a automatizar escassez real, urgência e retargeting.",
        lessons: [
          {
            id: "escassez-1",
            title: "A Psicologia do Deadline",
            duration: "20 min",
            type: "text",
            keyPoints: ["Por que 60-70% das vendas são nas últimas 24h", "Escassez real vs. falsa", "Sequência de emails de fechamento"],
            content: `<h2>O Paradoxo da Urgência</h2>
<p>Dan Ariely, em "Previsivelmente Irracional", documentou que a maioria das pessoas procrastina indefinidamente até que a pressão externa force uma decisão. Um lançamento sem deadline é uma campanha sem resultado.</p>

<h3>A Distribuição de Vendas num Lançamento Típico</h3>
<ul>
  <li>Dia 1 (abertura): 25-35% das vendas</li>
  <li>Dias 2-4 (meio): 15-20% das vendas</li>
  <li>Dia 5 (pré-fechamento): 10-15% das vendas</li>
  <li>Último dia: 35-45% das vendas</li>
</ul>

<p>Esta distribuição é previsível e universal. Significa que você <em>precisa</em> de uma campanha de fechamento tão forte quanto a de abertura.</p>

<h3>Escassez Real: Os 3 Tipos que Funcionam</h3>
<ol>
  <li><strong>Escassez de vagas:</strong> Turmas com número limitado têm razão real (suporte, comunidade, atenção do professor)</li>
  <li><strong>Escassez de bônus:</strong> "Os primeiros 50 recebem acesso ao grupo VIP com calls mensais"</li>
  <li><strong>Escassez de preço:</strong> "Preço de lançamento válido apenas para esta turma" — desde que seja real</li>
</ol>

<h3>A Sequência de Fechamento de 7 Mensagens</h3>
<p>Nas últimas 48h, automatize estas mensagens:</p>
<ul>
  <li>H-48: "Amanhã é o último dia"</li>
  <li>H-24: "Hoje é o último dia"</li>
  <li>H-12: "12 horas para encerrar"</li>
  <li>H-6: "6 horas restantes"</li>
  <li>H-3: "3 horas — última chance"</li>
  <li>H-1: "1 hora para fechar"</li>
  <li>H-0: "Carrinho fechado / obrigado"</li>
</ul>

<blockquote>Cada mensagem de fechamento deve ter um ângulo diferente: benefício, medo de perda, prova social recente, objeção destruída. Nunca repita o mesmo copy nas 7 mensagens.</blockquote>`
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
