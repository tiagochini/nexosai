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
            keyPoints: ["A fórmula prática do gancho em 3 segundos", "5 gatilhos de atenção com copy real pronto", "Como testar se seu hook vai parar o scroll antes de postar"],
            exercise: "Pegue seu último post ou reel. Leia apenas a primeira frase ou assista apenas os primeiros 3 segundos. Se você não soubesse que fez esse conteúdo, scrollaria? Se a resposta for 'talvez', reescreva o gancho usando um dos 5 modelos desta aula antes de publicar o próximo.",
            content: `<h2>Atenção: A Habilidade Que Decide Tudo Antes Mesmo de Você Falar</h2>

<p>Você pode ter o melhor produto do mercado, o método mais transformador, a oferta mais irresistível — e nenhum desses fatores vai importar se a pessoa rolar o dedo antes de chegar até eles.</p>

<p>O span médio de atenção em redes sociais é <strong>1,7 segundos</strong> antes da decisão de parar ou continuar. Não 8 segundos — 1,7. Esse é o tempo real que você tem para fazer alguém parar.</p>

<h2>A Fórmula Prática: Atenção = Curiosidade × Relevância ÷ Custo Cognitivo</h2>

<p>Vamos tornar isso acionável:</p>
<ul>
  <li><strong>Curiosidade:</strong> o cérebro percebe uma lacuna de informação e quer fechar</li>
  <li><strong>Relevância:</strong> a pessoa se enxerga no conteúdo ("isso é pra mim")</li>
  <li><strong>Custo Cognitivo:</strong> quanto esforço mental precisa para consumir</li>
</ul>

<p>O objetivo é maximizar os dois primeiros e minimizar o terceiro. Na prática: hook direto, linguagem simples, contexto imediato.</p>

<h2>Os 5 Gatilhos de Atenção — Com Copy Real</h2>

<p>Cada um desses padrões foi validado com milhões de impressões. Use-os como base, não como fórmula rígida.</p>

<h3>Gatilho 1: Curiosidade por Gap de Informação</h3>
<p>Revela que existe uma informação que a pessoa não tem — e que muda algo importante.</p>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">COPY DE EXEMPLO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Tem uma coisa que os maiores lançamentos do Brasil fazem que ninguém fala publicamente. Não é tráfego, não é lista, não é copy. É isso aqui →"</p>
</div>
<p><strong>Por que funciona:</strong> cria suspense + invalida as respostas óbvias que a pessoa já tinha (tráfego, lista, copy), forçando-a a continuar para descobrir a real.</p>

<h3>Gatilho 2: Identificação com Dor</h3>
<p>A pessoa se vê no que está sendo descrito e sente que você a entende.</p>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">COPY DE EXEMPLO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Você passa semanas criando conteúdo, investe em tráfego, tem um produto bom — e na abertura do carrinho vende menos de 10 unidades. Não é falta de esforço. É isso que está errado →"</p>
</div>
<p><strong>Por que funciona:</strong> valida o esforço da pessoa (não é culpa dela), cria cumplicidade e promete a razão real — que ela vai querer saber.</p>

<h3>Gatilho 3: Resultado Específico e Incomum</h3>
<p>Números específicos são mais críveis e mais intrigantes do que generalizações.</p>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">COPY DE EXEMPLO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"R$847.000 em 6 dias com uma lista de 2.300 pessoas. Sem afiliados, sem parceria. O que foi diferente nesse lançamento:"</p>
</div>
<p><strong>Por que funciona:</strong> R$847k é mais crível que "quase R$1M". Lista de 2.300 é verificável e surpreende (expectativa seria lista maior). "O que foi diferente" abre a curiosidade.</p>

<h3>Gatilho 4: Controvérsia Contra Crença Comum</h3>
<p>Contradiz algo que o público acredita ser verdade.</p>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">COPY DE EXEMPLO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Parei de postar todo dia e meu perfil cresceu 3x mais rápido. Não é intuição — é dado. Aqui o que aconteceu:"</p>
</div>
<p><strong>Por que funciona:</strong> viola a expectativa ("postar todo dia é obrigatório"). O cérebro quer resolver a contradição — então continua lendo.</p>

<h3>Gatilho 5: Urgência ou Tempo Definido</h3>
<p>Define janela de relevância — cria senso de que perder esse conteúdo tem custo.</p>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">COPY DE EXEMPLO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Tem uma janela de 6 meses no TikTok que vai fechar. Quem entrar agora vai ter uma vantagem que não vai mais existir. Explico:"</p>
</div>
<p><strong>Por que funciona:</strong> ativa FOMO imediato + dá razão concreta para parar agora (não depois).</p>

<h2>O Teste dos 3 Segundos</h2>

<p>Antes de publicar qualquer conteúdo, aplique este filtro:</p>

<table>
  <thead>
    <tr><th>Pergunta</th><th>Resposta necessária</th></tr>
  </thead>
  <tbody>
    <tr><td>Se eu não conhecesse quem fez isso, scrollaria?</td><td>Sim</td></tr>
    <tr><td>Existe uma razão clara para continuar assistindo/lendo?</td><td>Sim</td></tr>
    <tr><td>A primeira frase/frame cria alguma emoção (curiosidade, identificação, surpresa)?</td><td>Sim</td></tr>
    <tr><td>Dá para entender em 2 segundos do que se trata?</td><td>Sim</td></tr>
  </tbody>
</table>

<p>Se qualquer resposta for "não" — reescreva o gancho. Conteúdo com gancho fraco nunca alcança a parte boa, por melhor que ela seja.`
          },
          {
            id: "atencao-2",
            title: "Algoritmos: Como Plataformas Distribuem Conteúdo",
            duration: "18 min",
            type: "text",
            glossaryTerms: ["algoritmo-de-recomendacao", "completion-rate", "rewatch-rate", "saves", "shadow-ban"],
            keyPoints: ["Os sinais que cada plataforma realmente pesa — com benchmarks numéricos", "Como criar conteúdo que ativa saves e shares organicamente", "Checklist de otimização pré-publicação por plataforma"],
            exercise: "Audite seus últimos 5 posts. Para cada um, anote: taxa de conclusão (vídeo) ou tempo de leitura (texto), número de saves, número de compartilhamentos. Compare com os benchmarks desta aula. Identifique qual sinal está mais abaixo do benchmark e crie um conteúdo especificamente para melhorar esse número.",
            content: `<h2>Algoritmos: O que Realmente Acontece Depois que Você Posta</h2>

<p>Algoritmos não são caixas pretas. Cada plataforma documentou — em maior ou menor grau — o que seus sistemas medem. O problema não é falta de informação, é que a maioria aplica a estratégia errada para a plataforma errada.</p>

<h2>O Princípio Universal: Toda Plataforma Quer o Mesmo</h2>

<p>Instagram, TikTok, YouTube, Facebook — todas têm o mesmo objetivo: <strong>maximizar o tempo que o usuário passa na plataforma</strong>. O algoritmo distribui conteúdo que atinge esse objetivo. Ponto.</p>

<p>Consequência prática: conteúdo que faz pessoas ficarem mais tempo (watch time, scroll time, retorno ao app) é distribuído. Conteúdo que faz pessoas saírem (cliques que levam para fora, baixo tempo de permanência) é penalizado.</p>

<h2>Os 5 Sinais por Peso — Com Benchmarks Reais</h2>

<table>
  <thead>
    <tr><th>Sinal</th><th>Peso</th><th>Benchmark Bom</th><th>O que cria esse sinal</th></tr>
  </thead>
  <tbody>
    <tr><td>Watch Time / Retenção</td><td>★★★★★</td><td>&gt;60% do vídeo</td><td>Hook forte + entrega de valor ao longo do vídeo</td></tr>
    <tr><td>Saves / Bookmarks</td><td>★★★★★</td><td>&gt;3% dos alcançados</td><td>Conteúdo que a pessoa quer rever ou aplicar depois</td></tr>
    <tr><td>Compartilhamentos</td><td>★★★★☆</td><td>&gt;2% dos alcançados</td><td>Conteúdo que a pessoa quer que outros vejam</td></tr>
    <tr><td>Comentários com texto</td><td>★★★☆☆</td><td>&gt;1% dos alcançados</td><td>Pergunta no final, controvérsia, pedido de opinião</td></tr>
    <tr><td>Curtidas</td><td>★★☆☆☆</td><td>Qualquer número</td><td>Conteúdo agradável — mas peso baixo</td></tr>
  </tbody>
</table>

<p><strong>Insight crítico:</strong> curtidas são o sinal que a maioria otimiza, mas têm o menor peso. Saves são o sinal que poucos otimizam, mas têm o maior peso no Instagram. Mude o que você mede.</p>

<h2>Como Criar Conteúdo que Gera Saves</h2>

<p>Saves acontecem quando a pessoa pensa: "vou querer usar isso depois". Tipos de conteúdo que disparam saves:</p>

<ul>
  <li><strong>Checklists e passo a passos:</strong> "7 etapas para configurar sua campanha no Meta" — pessoa salva para executar</li>
  <li><strong>Templates e modelos:</strong> "Copy de email de abertura pronto para usar" — salva para copiar</li>
  <li><strong>Informações técnicas densas:</strong> Dados, benchmarks, fórmulas — salva para consultar</li>
  <li><strong>Calendários e timelines:</strong> Qualquer estrutura temporal — salva para planejar</li>
</ul>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">EXEMPLO: Copy que gera save</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Salva esse carrossel — os benchmarks de Meta Ads que uso para saber se uma campanha está funcionando:<br/>CPM bom: &lt;R$12 | Excelente: &lt;R$7<br/>CTR bom: &gt;2% | Excelente: &gt;4%<br/>CPL (produto R$2k+): até R$30<br/>ROAS mínimo para escalar: 3x<br/>Taxa de conversão LP: &gt;25%"</p>
</div>

<p>Perceba: o post pede explicitamente para salvar (reduz o custo de ação) e entrega algo que a pessoa vai querer rever quando for configurar uma campanha.</p>

<h2>Como Criar Conteúdo que Gera Compartilhamentos</h2>

<p>Compartilhamentos acontecem quando a pessoa pensa: "fulano precisa ver isso". Isso acontece quando o conteúdo:</p>
<ul>
  <li>Resume algo que ela já sabia mas nunca viu explicado assim</li>
  <li>Contradiz uma crença comum de forma surpreendente</li>
  <li>Faz a pessoa parecer inteligente ao compartilhar</li>
  <li>É tão específico para um grupo que parece "feito para eles"</li>
</ul>

<h2>Checklist de Otimização Pré-Publicação</h2>

<table>
  <thead>
    <tr><th>Item</th><th>Instagram</th><th>TikTok</th><th>YouTube</th></tr>
  </thead>
  <tbody>
    <tr><td>Hook nos primeiros 1-3s</td><td>✅ Obrigatório</td><td>✅ Crítico</td><td>✅ Obrigatório</td></tr>
    <tr><td>Palavra-chave no texto</td><td>✅ Nome + legenda</td><td>✅ Caption</td><td>✅ Título + descrição</td></tr>
    <tr><td>CTA para save/share</td><td>✅ Explicitar</td><td>✅ Pedir duet/stitch</td><td>✅ Pedir like/save</td></tr>
    <tr><td>Primeiro comentário</td><td>✅ Engaja algoritmo</td><td>✅ Responder todos</td><td>✅ Pinado como recurso</td></tr>
    <tr><td>Thumbnail/capa</td><td>✅ Frame 1 importa</td><td>✅ Cover image</td><td>✅ Decisivo para CTR</td></tr>
  </tbody>
</table>

<h2>O Erro Mais Caro: Postar e Ignorar</h2>

<p>Nas primeiras 2 horas após publicar, o algoritmo está em fase de teste: distribui para uma amostra dos seus seguidores e mede os sinais. Se o engajamento da amostra for bom, amplia a distribuição. Se for ruim, enterra o post.</p>

<p><strong>O que fazer nas primeiras 2h:</strong> responda todos os comentários (mesmo com emoji), responda DMs relacionados, interaja com posts do mesmo nicho. Isso sinaliza que você é um perfil ativo e empurra o post na distribuição da amostra.</p>`
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
            keyPoints: ["A matriz de conteúdo com exemplos reais de copy para cada tipo", "Calendário de 4 semanas pré-lançamento — post por post", "Como transformar qualquer ideia em um dos 4 tipos que vende"],
            exercise: "Abra seu perfil e classifique seus últimos 12 posts em um dos 4 tipos. Calcule a porcentagem de cada tipo. Se você tem mais de 30% em vendas diretas e menos de 25% em prova social — esse é o diagnóstico do problema. Monte seu calendário das próximas 2 semanas usando as proporções desta aula.",
            content: `<h2>A Matriz de Conteúdo: O Que Postar, Quando e Por Quê</h2>

<p>A maioria das pessoas posta por instinto — o que parece certo no momento. O problema é que instinto não tem distribuição planejada. Você acaba com ou muito conteúdo educacional (que educa mas não vende) ou muito conteúdo de venda (que afasta quem ainda não está pronto para comprar).</p>

<p>A Matriz NexOS distribui conteúdo em 4 tipos com funções específicas na jornada do comprador. Cada tipo move a pessoa para o próximo estágio.</p>

<h2>Tipo 1: Conteúdo Educacional — 40% do volume</h2>
<p><strong>Função:</strong> posiciona autoridade, gera saves, constrói confiança</p>
<p><strong>Sinal de que está funcionando:</strong> saves acima de 3%, perguntas nos comentários, DMs pedindo mais</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">EXEMPLO DE LEGENDA — EDUCACIONAL</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Os 5 motivos pelos quais 90% dos lançamentos não passam de R$50k:<br/><br/>1. Carrinho abriu cedo demais — audiência fria<br/>2. Bônus genéricos que ninguém valorizou<br/>3. Sequência de email de urgência sem escassez real<br/>4. Nenhum live de abertura — vendas concentradas demais nas últimas horas<br/>5. Copy da página de vendas copiado de concorrente<br/><br/>Salva esse post. Na semana que vem faço um breakdown completo de cada ponto.<br/><br/>#lancamento #marketingdigital #produtodigital</p>
</div>

<p><strong>Por que funciona:</strong> entrega valor real, pede o save (ativa o sinal), cria expectativa do próximo conteúdo (aumenta watch time do perfil).</p>

<h2>Tipo 2: Conteúdo de Prova Social — 25% do volume</h2>
<p><strong>Função:</strong> elimina ceticismo, demonstra resultado possível, ativa gatilho de manada</p>
<p><strong>Sinal de que está funcionando:</strong> compartilhamentos, DMs "você acha que funciona pra mim?", novos seguidores do nicho</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">EXEMPLO DE LEGENDA — PROVA SOCIAL</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">A Camila entrou no método em outubro. Antes: 3 anos tentando lançar, 2 produtos que não venderam nada, R$0 de receita digital.<br/><br/>Na primeira semana de aplicar o framework de pré-lançamento: R$23.400 em 4 dias com uma lista de apenas 890 pessoas.<br/><br/>Ela não tem 100k seguidores. Não tem parceria de afiliados. Não fez live. Fez o que está aqui no método — sistematicamente.<br/><br/>O que mudou: a ordem das ações, não a quantidade de esforço.</p>
</div>

<p><strong>Nota técnica:</strong> Nome real + resultado específico (R$23.400, não "muito dinheiro") + contexto antes (3 anos, R$0) + por que foi diferente = prova social que converte. Depoimento vago não converte.</p>

<h2>Tipo 3: Conteúdo de Identidade — 20% do volume</h2>
<p><strong>Função:</strong> cria conexão humana, constrói personagem, gera "quero comprar dessa pessoa"</p>
<p><strong>Sinal de que está funcionando:</strong> comentários pessoais, DMs espontâneos, seguidores que mencionam detalhes da sua vida</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">EXEMPLO — BASTIDORES DE IDENTIDADE</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Tem 2 anos eu estava do outro lado. Cliente de um curso de marketing, tentando entender por que não conseguia aplicar o que ensinava.<br/><br/>Hoje estou aqui preparando o que vai ser a maior aula que já gravei sobre sequência de lançamento.<br/><br/>A diferença entre quem estava lá e quem está aqui não foi talento. Foi uma decisão sobre qual informação seguir — e execução obsessiva.<br/><br/>Se você está no início, isso é para você.</p>
</div>

<h2>Tipo 4: Conteúdo de Venda Direta — 15% do volume</h2>
<p><strong>Função:</strong> converter a audiência aquecida em compradores</p>
<p><strong>Regra de ouro:</strong> só funciona depois dos tipos 1, 2 e 3 criarem o contexto. Venda sem contexto é spam.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">EXEMPLO — VENDA COM CONTEXTO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Nas últimas 3 semanas mostrei aqui o framework completo de pré-lançamento, os cases de alunos e a história de como cheguei nesse método.<br/><br/>Amanhã às 8h abre o [produto]. Para quem está na lista VIP, há um bônus que não vai estar disponível depois da primeira hora.<br/><br/>Link na bio → Lista VIP.</p>
</div>

<h2>Calendário de 4 Semanas Pré-Lançamento</h2>

<table>
  <thead>
    <tr><th>Semana</th><th>Seg</th><th>Qua</th><th>Sex</th><th>Stories diários</th></tr>
  </thead>
  <tbody>
    <tr><td>Semana 1 (D-28)</td><td>Educacional</td><td>Educacional</td><td>Identidade</td><td>Bastidores leves</td></tr>
    <tr><td>Semana 2 (D-21)</td><td>Educacional</td><td>Prova Social</td><td>Educacional</td><td>Enquetes + caixinha</td></tr>
    <tr><td>Semana 3 (D-14)</td><td>Prova Social</td><td>Educacional</td><td>Identidade</td><td>Antecipação vaga</td></tr>
    <tr><td>Semana 4 (D-7)</td><td>Educacional</td><td>Prova Social</td><td>Venda (lista VIP)</td><td>Countdown + bastidores</td></tr>
  </tbody>
</table>

<p><strong>Volume ideal:</strong> 3 posts/semana no feed + stories diários. Menos que isso, a audiência esfria. Mais que isso sem qualidade, o algoritmo penaliza.`
          },
          {
            id: "organico-2",
            title: "Reels & Shorts: Roteiros Prontos Para Gravar Hoje",
            duration: "25 min",
            type: "text",
            keyPoints: ["3 roteiros completos de Reel prontos para adaptar ao seu nicho", "A estrutura segundo a segundo dos primeiros 3s que decidem tudo", "Métricas de referência: o que é um Reel bom vs. fraco"],
            exercise: "Escolha um dos 3 roteiros desta aula. Adapte para o seu nicho preenchendo as lacunas em [colchetes]. Grave hoje mesmo — mesmo que imperfeito. Um Reel gravado supera infinitos roteiros perfeitos não gravados. Poste e observe as métricas 48h depois.",
            content: `<h2>Reels: A Única Aula de Que Você Precisa Para Começar Hoje</h2>

<p>Você não precisa de equipamento profissional, equipe de edição ou 10k seguidores para um Reel gerar leads. Você precisa de estrutura + assunto relevante + constância.</p>

<p>Esta aula dá os roteiros prontos. Seu trabalho é adaptar ao seu nicho e gravar.</p>

<h2>A Estrutura dos 3 Atos — Com Tempo Exato</h2>

<table>
  <thead>
    <tr><th>Ato</th><th>Tempo</th><th>Função</th><th>Erro comum</th></tr>
  </thead>
  <tbody>
    <tr><td>Hook</td><td>0-3s</td><td>Parar o scroll</td><td>Começar com "Olá, tudo bem?" — mortal</td></tr>
    <tr><td>Promessa</td><td>3-7s</td><td>Dar razão para continuar</td><td>Não dizer o que a pessoa vai ganhar</td></tr>
    <tr><td>Conteúdo</td><td>7s até fim-5s</td><td>Entregar o prometido</td><td>Conteúdo longo demais ou vago demais</td></tr>
    <tr><td>CTA</td><td>Últimos 5s</td><td>Um único comando</td><td>Dois CTAs — pessoa não faz nenhum</td></tr>
  </tbody>
</table>

<h2>Roteiro 1 — Lista Numerada (melhor formato para saves)</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">ROTEIRO COMPLETO — 45-60 segundos</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>[HOOK — fala olhando para câmera, texto na tela]</strong><br/>
"[Número] erros que fazem [perfil do avatar] perder [resultado doloroso]."<br/><br/>

<strong>[PROMESSA — 3s]</strong><br/>
"Se você faz qualquer um desses, para com tudo e assiste até o final."<br/><br/>

<strong>[ERRO 1 — 8s]</strong><br/>
"Erro 1: [nome do erro]. [Uma frase explicando por que é errado]. O certo: [solução em uma frase]."<br/><br/>

<strong>[ERRO 2 — 8s]</strong><br/>
"Erro 2: [nome]. [Explicação]. O certo: [solução]."<br/><br/>

<strong>[ERRO 3 — 8s — o mais impactante]</strong><br/>
"Erro 3 — esse é o que mais mata resultado: [nome]. [Explicação com dado ou exemplo específico]. O certo: [solução]."<br/><br/>

<strong>[CTA — últimos 5s]</strong><br/>
"Salva esse vídeo pra não esquecer. E me conta nos comentários qual erro você estava cometendo."
</p>
</div>

<p><strong>Exemplo adaptado para marketing digital:</strong><br/>
Hook: "3 erros que fazem lançamentos não passarem de R$30k."<br/>
Erro 3: "Abrir o carrinho sem uma sequência de urgência real. 70% das vendas acontecem nas últimas 24h. Se você não tem emails e WhatsApp programados para essa janela, está deixando a maioria do dinheiro na mesa."</p>

<h2>Roteiro 2 — Before/After (melhor formato para prova social)</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">ROTEIRO COMPLETO — 30-45 segundos</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>[HOOK — resultado chocante primeiro]</strong><br/>
"[Nome] fez R$[valor] em [tempo] com [recurso limitado surpreendente]."<br/><br/>

<strong>[CONTEXTO BEFORE — 10s]</strong><br/>
"Antes de entrar no método: [situação específica ruim]. Tentou [o que tentou]. Resultado: [fracasso específico]."<br/><br/>

<strong>[A VIRADA — 10s]</strong><br/>
"O que mudou: [detalhe específico do método/produto]. Não foi mais esforço — foi [o que foi]."<br/><br/>

<strong>[RESULTADO AFTER — 5s]</strong><br/>
"[Resultado numérico específico] em [tempo]."<br/><br/>

<strong>[CTA — 5s]</strong><br/>
"Comenta [palavra-chave] aqui em baixo que te mando o método gratuito."
</p>
</div>

<h2>Roteiro 3 — Mito vs. Verdade (melhor formato para compartilhamentos)</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">ROTEIRO COMPLETO — 40-55 segundos</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>[HOOK — controvérsia imediata]</strong><br/>
"Vou contrariar o que você aprendeu sobre [tema]. E vou provar com dados."<br/><br/>

<strong>[MITO 1 — 10s]</strong><br/>
"Mito: [crença comum]. Realidade: [dado ou caso contrário específico]."<br/><br/>

<strong>[MITO 2 — 10s]</strong><br/>
"Mito: [crença 2]. Realidade: [dado 2]."<br/><br/>

<strong>[MITO 3 — 10s — o mais chocante]</strong><br/>
"E o maior mito de todos: [crença central do nicho]. Dados mostram que [realidade surpreendente]. Isso explica por que [consequência que impacta o avatar]."<br/><br/>

<strong>[CTA — 5s]</strong><br/>
"Manda esse vídeo para alguém que ainda acredita nesses mitos."
</p>
</div>

<h2>Métricas de Referência: Como Saber Se Está Funcionando</h2>

<table>
  <thead>
    <tr><th>Métrica</th><th>Ruim</th><th>Bom</th><th>Excelente</th></tr>
  </thead>
  <tbody>
    <tr><td>Taxa de conclusão (watch %)</td><td>&lt;30%</td><td>40-60%</td><td>&gt;70%</td></tr>
    <tr><td>Saves / alcance</td><td>&lt;1%</td><td>2-4%</td><td>&gt;5%</td></tr>
    <tr><td>Compartilhamentos / alcance</td><td>&lt;0.5%</td><td>1-3%</td><td>&gt;4%</td></tr>
    <tr><td>Comentários com texto</td><td>&lt;0.3%</td><td>0.5-1%</td><td>&gt;2%</td></tr>
    <tr><td>Cliques no perfil / alcance</td><td>&lt;1%</td><td>2-4%</td><td>&gt;5%</td></tr>
  </tbody>
</table>

<p><strong>Se watch time está abaixo de 30%:</strong> o problema é o hook — reescreva os primeiros 3 segundos.<br/>
<strong>Se saves estão baixos mas watch time é bom:</strong> o conteúdo entretém mas não é útil o suficiente para guardar.<br/>
<strong>Se compartilhamentos estão baixos:</strong> falta elemento de identidade ou controvérsia que faça a pessoa querer mostrar para alguém.`
          },
          {
            id: "organico-3",
            title: "SEO no Instagram e YouTube: Processo Passo a Passo",
            duration: "20 min",
            type: "text",
            keyPoints: ["O processo completo de pesquisa de palavras-chave para redes sociais — com ferramentas e exemplos", "Como otimizar perfil de Instagram e canal de YouTube para buscas", "A estratégia de hashtags com exemplos reais de nicho"],
            exercise: "Abra o Instagram agora e pesquise sua palavra-chave principal. Anote as 5 primeiras sugestões de completar que aparecem — essas são as buscas reais que seu público faz. Escolha 2 dessas sugestões como palavras-chave secundárias do seu perfil. Reescreva seu nome e bio usando essas palavras hoje.",
            content: `<h2>SEO Social: Como Ser Encontrado por Quem Já Quer o Que Você Oferece</h2>

<p>Em 2024, o Instagram é o segundo maior motor de busca do Brasil para conteúdo de marketing e negócios — à frente do Bing e do YouTube para o público de 18-34 anos. Isso significa que há pessoas buscando ativamente pelo que você ensina. A questão é: elas te encontram?</p>

<h2>Passo 1: Pesquisa de Palavras-Chave Social — Processo Completo</h2>

<p><strong>Objetivo:</strong> encontrar os termos exatos que seu público usa para buscar o conteúdo que você produz.</p>

<table>
  <thead>
    <tr><th>Ferramenta</th><th>Como usar</th><th>O que você encontra</th></tr>
  </thead>
  <tbody>
    <tr><td>Instagram Busca</td><td>Digite sua palavra-chave — anote as sugestões de completar</td><td>Termos que usuários reais buscam no Instagram</td></tr>
    <tr><td>YouTube Search Predictions</td><td>Digite no YouTube — anote sugestões + concorrência</td><td>Volume e intenção de busca para vídeos longos</td></tr>
    <tr><td>TikTok Creative Center</td><td>Keyword Insights → pesquise seu nicho</td><td>Tendências de busca + volume + CTR estimado</td></tr>
    <tr><td>Google Trends</td><td>Compare 3-5 variações do seu tema</td><td>Sazonalidade e qual variação tem mais volume</td></tr>
    <tr><td>Ubersuggest / SEMrush (grátis)</td><td>Coloque sua palavra-chave e veja sugestões "People also ask"</td><td>Dúvidas reais que sua audiência tem</td></tr>
  </tbody>
</table>

<h3>Exemplo Prático: Pesquisa para o Nicho de Marketing Digital</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">PROCESSO APLICADO — NICHO MARKETING</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
Digite "lançamento digital" no Instagram → sugestões: "lançamento digital como fazer", "lançamento digital gratuito", "lançamento digital para iniciantes"<br/><br/>
Conclusão: seu público busca "como fazer" e "para iniciantes" — isso indica conteúdo de execução, não de estratégia avançada.<br/><br/>
Palavra-chave principal: <strong>lançamento digital</strong><br/>
Secundárias: <strong>como fazer um lançamento</strong>, <strong>lançamento para iniciantes</strong>, <strong>produto digital</strong>
</p>
</div>

<h2>Passo 2: Otimização de Perfil no Instagram</h2>

<p>O Instagram indexa 3 campos para buscas: <strong>Nome de usuário</strong>, <strong>Nome na bio</strong> e <strong>Texto da bio</strong>. Os outros campos (site, link) não são indexados.</p>

<h3>Template de Perfil Otimizado</h3>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">PERFIL OTIMIZADO — EXEMPLO REAL</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>@nome_de_usuario:</strong> inclua a palavra-chave se possível (ex: @joaolancamentos)<br/>
<strong>Nome na bio:</strong> "João Silva | Lançamento Digital" — palavra-chave logo no início<br/>
<strong>Bio (150 caracteres):</strong> "Ajudo produtores digitais a lançar R$100k+ | Método PLF adaptado para PT-BR | 2.400 alunos | ↓ Método gratuito"<br/><br/>
<strong>O que esse perfil faz:</strong><br/>
✓ Aparece em buscas de "lançamento digital"<br/>
✓ Deixa claro quem é para (produtores digitais)<br/>
✓ Prova social (2.400 alunos)<br/>
✓ CTA com ação clara (↓ Método gratuito)
</p>
</div>

<h2>Passo 3: Otimização de Canal no YouTube</h2>

<p>No YouTube, SEO é mais determinístico que no Instagram. Há 5 campos que o algoritmo de busca usa:</p>

<table>
  <thead>
    <tr><th>Campo</th><th>Peso no SEO</th><th>Como otimizar</th></tr>
  </thead>
  <tbody>
    <tr><td>Título do vídeo</td><td>★★★★★</td><td>Palavra-chave exata nos primeiros 60 caracteres</td></tr>
    <tr><td>Descrição (primeiras 2 linhas)</td><td>★★★★☆</td><td>Palavra-chave na primeira frase + sinônimos</td></tr>
    <tr><td>Tags</td><td>★★★☆☆</td><td>10-15 tags: palavra-chave exata + variações</td></tr>
    <tr><td>Thumbnail (CTR)</td><td>★★★★★</td><td>CTR alto melhora posição — use rosto + texto em destaque</td></tr>
    <tr><td>Capítulos / timestamps</td><td>★★★☆☆</td><td>Aparecem nas buscas do Google — palavras-chave nos títulos</td></tr>
  </tbody>
</table>

<h3>Fórmula de Título de YouTube</h3>
<p><strong>[Keyword Principal]: [Promessa ou Curiosidade]</strong></p>
<p>Exemplo: "Lançamento Digital: Como Vender R$100k em 7 Dias Mesmo Sem Lista" (72 chars — dentro do limite de exibição)</p>

<h2>Passo 4: Estratégia de Hashtags</h2>

<p>Hashtags no Instagram em 2024 funcionam como amplificadores — não como fonte primária de tráfego. Use a pirâmide:</p>

<table>
  <thead>
    <tr><th>Tipo</th><th>Volume</th><th>Quantidade</th><th>Função</th><th>Exemplo (marketing)</th></tr>
  </thead>
  <tbody>
    <tr><td>Grande</td><td>+1M posts</td><td>3 hashtags</td><td>Visibilidade ampla</td><td>#marketingdigital, #empreendedorismo</td></tr>
    <tr><td>Médio</td><td>100k-1M</td><td>4 hashtags</td><td>Competição moderada</td><td>#lancamentodigital, #infoproduto</td></tr>
    <tr><td>Pequeno / Nicho</td><td>-100k</td><td>3 hashtags</td><td>Chance de rankear na página 1</td><td>#lancamentoPLF, #produtodigitalBR</td></tr>
  </tbody>
</table>

<p><strong>Regra prática:</strong> com menos de 5.000 seguidores, foque 60% das suas hashtags nas categorias médio e nicho. Com audiências maiores você pode competir nas grandes. Hashtag com 500M posts com perfil de 1.000 seguidores não gera nenhuma descoberta.`
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
            keyPoints: ["A estrutura exata de campanhas por fase — com budgets, objetivos e públicos", "Os KPIs com benchmarks numéricos para saber se está ou não funcionando", "Diagnóstico: como identificar qual campanha está sangrando budget"],
            exercise: "Monte agora a estrutura de campanhas do seu próximo lançamento. Use a tabela desta aula como template. Defina: fase, objetivo, público, budget por dia, KPI de sucesso. Isso deve tomar 30 minutos — mas vai economizar semanas de erro.",
            content: `<h2>Meta Ads para Lançamentos: A Estrutura Que Funciona</h2>

<p>A maioria das pessoas cria uma campanha de conversão, bota R$50/dia e espera vender. Isso não é estratégia de anúncio — é esperança patrocinada.</p>

<p>Um lançamento de produto digital exige uma <strong>estrutura de funil em 3 fases</strong> com campanhas, objetivos, públicos e budgets diferentes para cada momento da jornada. Veja abaixo a estrutura completa.</p>

<h2>Fase 1 — Pré-Pré-Lançamento (D-30 a D-14): Construção de Audiência</h2>

<table>
  <thead>
    <tr><th>Configuração</th><th>Valor</th></tr>
  </thead>
  <tbody>
    <tr><td>Objetivo da campanha</td><td>Visualizações de Vídeo ou Engajamento</td></tr>
    <tr><td>Público</td><td>Interesses amplos relacionados ao nicho (tamanho: 1-5M)</td></tr>
    <tr><td>Budget</td><td>15-20% do orçamento total do lançamento / dia</td></tr>
    <tr><td>Criativo</td><td>Vídeo de 60-90s com conteúdo educacional de valor</td></tr>
    <tr><td>Objetivo real</td><td>Popular o pixel e criar público de remarketing para fases 2 e 3</td></tr>
    <tr><td>KPI de sucesso</td><td>CPV &lt;R$0.05 | Watch 50%+ &gt;20% dos espectadores</td></tr>
  </tbody>
</table>

<div style="background:#1a1a2e;border-left:3px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">CONFIGURAÇÃO DO PÚBLICO — Fase 1</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Ad Set 1: Interesses [Nicho A] + [Nicho B] — Excluir: compradores (pixel)<br/>Ad Set 2: Lookalike 2-5% da sua lista de email<br/>Ad Set 3: Interesses de comportamento (ex: "Negócios online", "Empreendedorismo")<br/><br/>⚠️ NÃO use CBO nessa fase. Use ABO com R$20-50/dia por ad set para controlar onde o budget vai.</p>
</div>

<h2>Fase 2 — Pré-Lançamento (D-14 a D-1): Aquecimento e Captura</h2>

<table>
  <thead>
    <tr><th>Configuração</th><th>Valor</th></tr>
  </thead>
  <tbody>
    <tr><td>Objetivo da campanha</td><td>Leads (formulário nativo ou tráfego para LP)</td></tr>
    <tr><td>Público quente</td><td>Quem assistiu 50%+ dos vídeos da Fase 1 (últimos 30d)</td></tr>
    <tr><td>Público morno</td><td>Engajamento no perfil últimos 60d + Lookalike 1% da lista</td></tr>
    <tr><td>Budget</td><td>35-40% do orçamento total / dia</td></tr>
    <tr><td>Criativo</td><td>PLCs adaptados como anúncio ou teaser com link para PLC completo</td></tr>
    <tr><td>KPI de sucesso</td><td>CPL &lt;R$25 (produto R$2k+) | Taxa opt-in LP &gt;35%</td></tr>
  </tbody>
</table>

<h2>Fase 3 — Carrinho Aberto (D+0 a D+5): Conversão</h2>

<table>
  <thead>
    <tr><th>Configuração</th><th>Valor</th></tr>
  </thead>
  <tbody>
    <tr><td>Objetivo da campanha</td><td>Conversão (Compras) — pixel obrigatório</td></tr>
    <tr><td>Público 1 — mais quente</td><td>Visitantes da página de vendas últimos 7d sem compra</td></tr>
    <tr><td>Público 2</td><td>Lista VIP (upload de lista de email)</td></tr>
    <tr><td>Público 3</td><td>Engajamento últimos 30d (excluindo compradores)</td></tr>
    <tr><td>Budget</td><td>40-50% do orçamento total / dia — escalar nos últimos 2 dias</td></tr>
    <tr><td>CBO ou ABO</td><td>CBO acima de R$500/dia. ABO abaixo.</td></tr>
    <tr><td>KPI de sucesso</td><td>ROAS &gt;3x | CPA &lt;30% do ticket</td></tr>
  </tbody>
</table>

<h2>Distribuição de Budget por Fase — Exemplo Prático</h2>

<p>Para um lançamento com orçamento total de R$10.000 em 30 dias:</p>

<table>
  <thead>
    <tr><th>Fase</th><th>Dias</th><th>% do Budget</th><th>Total</th><th>Por dia</th></tr>
  </thead>
  <tbody>
    <tr><td>Construção (Fase 1)</td><td>D-30 a D-14 (16d)</td><td>20%</td><td>R$2.000</td><td>R$125/dia</td></tr>
    <tr><td>Aquecimento (Fase 2)</td><td>D-14 a D-1 (13d)</td><td>35%</td><td>R$3.500</td><td>R$270/dia</td></tr>
    <tr><td>Conversão (Fase 3)</td><td>D+0 a D+5 (6d)</td><td>45%</td><td>R$4.500</td><td>R$750/dia</td></tr>
  </tbody>
</table>

<h2>Diagnóstico: O Que Fazer Quando os KPIs Estão Ruins</h2>

<table>
  <thead>
    <tr><th>Sintoma</th><th>Diagnóstico provável</th><th>Ação</th></tr>
  </thead>
  <tbody>
    <tr><td>CPM alto (&gt;R$20)</td><td>Público muito pequeno ou criativo com baixo relevance score</td><td>Ampliar público ou trocar criativo</td></tr>
    <tr><td>CTR baixo (&lt;1%)</td><td>Hook do criativo fraco</td><td>Testar 3 hooks diferentes — mesma mensagem</td></tr>
    <tr><td>CPL alto (&gt;R$50)</td><td>LP com baixa conversão ou público frio demais</td><td>Testar LP first, depois público</td></tr>
    <tr><td>ROAS &lt;2x</td><td>Oferta com objeções não resolvidas ou público frio na fase de conversão</td><td>Adicionar remarketing + revisar página de vendas</td></tr>
  </tbody>
</table>`
          },
          {
            id: "pago-2",
            title: "Criativos que Param o Scroll",
            duration: "25 min",
            type: "text",
            keyPoints: ["Brief completo de criativo por fase do lançamento — copy de gancho pronto", "A ordem de teste A/B que economiza budget", "Como analisar um criativo ruim e saber exatamente o que consertar"],
            exercise: "Escolha uma fase do seu lançamento (pré-lançamento, abertura ou fechamento). Use o brief desta aula para essa fase. Escreva o copy do gancho + headline + CTA. Mande para um designer ou produza você mesmo. Teste com R$30/dia por 3 dias antes de escalar.",
            content: `<h2>Criativos de Alta Performance: Do Brief à Arte Final</h2>

<p>Um criativo ruim desperdiça todo o restante da estratégia. Público certo, oferta certa, landing page certa — mas criativo fraco: o dinheiro vai pro lixo antes de alguém clicar.</p>

<p>A anatomia de um criativo de alta performance tem 3 camadas:</p>
<ol>
  <li><strong>Gancho visual:</strong> o que para o scroll antes da pessoa ler qualquer coisa (0-1s)</li>
  <li><strong>Gancho textual/verbal:</strong> o que mantém a atenção nos próximos 3-5s</li>
  <li><strong>Promessa + CTA:</strong> o que converte a atenção em clique</li>
</ol>

<h2>Brief por Fase — Com Copy de Gancho Pronto</h2>

<h3>Fase 1 — Pré-Pré-Lançamento (D-30 a D-14): Curiosity Ads</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">BRIEF — CURIOSITY AD</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Formato:</strong> Vídeo 9:16 (Stories/Reels) — 30-45 segundos<br/>
<strong>Gancho visual:</strong> Você falando direto para câmera — sem vinheta, sem intro<br/>
<strong>Gancho textual (texto na tela nos primeiros 3s):</strong> "O erro que faz lançamentos falharem antes de começar"<br/>
<strong>Fala de abertura:</strong> "Se você está planejando um lançamento, tem uma coisa que ninguém te conta — e que vai determinar se você vai vender ou não no dia de abertura."<br/>
<strong>Corpo:</strong> Conteúdo educacional de 20-30s — entregue valor real<br/>
<strong>CTA:</strong> "Link na bio — entra na lista VIP pra ser avisado primeiro quando abrir"
</p>
</div>

<h3>Fase 2 — Pré-Lançamento (D-14 a D-1): Social Proof Ads</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">BRIEF — SOCIAL PROOF AD</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Formato:</strong> Imagem estática (melhor CPM para social proof) ou vídeo depoimento<br/>
<strong>Gancho visual:</strong> Print de resultado (WhatsApp, área de membros, número de vendas)<br/>
<strong>Headline:</strong> "[Nome] conseguiu [resultado específico] em [tempo]. Aqui está o que fez diferente."<br/>
<strong>Corpo:</strong> 2-3 frases do before/after + o insight que mudou<br/>
<strong>CTA:</strong> "Entre na lista VIP — abre [data]"<br/>
<strong>Atenção:</strong> Inclua consentimento escrito do aluno antes de usar o case
</p>
</div>

<h3>Fase 3 — Carrinho Aberto (D+0 a D+3): Direct Response Ads</h3>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">BRIEF — DIRECT RESPONSE AD (carrinho aberto)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Formato:</strong> Vídeo 1:1 (feed) + Story 9:16 — 60-90s<br/>
<strong>Gancho visual:</strong> Contador regressivo OU "ABERTO AGORA" em destaque<br/>
<strong>Gancho verbal:</strong> "[Produto] está aberto. Fecha [data/hora]. Aqui está o que você recebe:"<br/>
<strong>Corpo:</strong> Lista de 3-5 benefícios principais + bônus de tempo limitado<br/>
<strong>Objection crusher (20s):</strong> "Se você está pensando em [objeção 1] — [resposta direta de 1 frase]"<br/>
<strong>CTA:</strong> "Link abaixo. Fecha [dia] às [hora]. Depois, fecha e não reabre."
</p>
</div>

<h3>Fase 4 — Fechamento (Últimas 24h): Urgency Ads</h3>

<div style="background:#1a1a2e;border-left:3px solid #ef4444;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#f87171;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">BRIEF — URGENCY AD (últimas 24h)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Formato:</strong> Vídeo Story 9:16 — 15-30s (curto e urgente)<br/>
<strong>Gancho:</strong> "[X horas] para fechar. Depois não tem como entrar."<br/>
<strong>Corpo:</strong> Recapitulação rápida do que está dentro + o bônus que vai desaparecer<br/>
<strong>CTA:</strong> "Link na bio. Agora."<br/>
<strong>⚠️ Regra:</strong> Use escassez real (vagas reais, deadline real). Escassez falsa detectada = credibilidade destruída permanentemente.
</p>
</div>

<h2>A Ordem Correta de Teste A/B</h2>

<p>Teste uma variável por vez. Nunca duas. Orçamento mínimo para conclusão estatística: R$30/variação/dia por 3-5 dias.</p>

<table>
  <thead>
    <tr><th>Ordem</th><th>O que testar</th><th>Impacto no CTR</th><th>Sinal de vitória</th></tr>
  </thead>
  <tbody>
    <tr><td>1º</td><td>Gancho (primeiros 3s do vídeo ou headline da imagem)</td><td>Alto (30-60%)</td><td>CTR &gt;2x do perdedor</td></tr>
    <tr><td>2º</td><td>Formato (vídeo vs. imagem vs. carrossel)</td><td>Médio (20-40%)</td><td>CPL &lt;70% do perdedor</td></tr>
    <tr><td>3º</td><td>Ângulo da mensagem (dor vs. desejo vs. resultado)</td><td>Médio (20-35%)</td><td>Taxa de conversão pós-clique maior</td></tr>
    <tr><td>4º</td><td>CTA (texto do botão, link na bio, mensagem)</td><td>Baixo (&lt;15%)</td><td>CTR marginalmente melhor</td></tr>
  </tbody>
</table>

<h2>Diagnóstico: O Que Está Matando Seu Criativo</h2>

<table>
  <thead>
    <tr><th>Sintoma</th><th>Causa</th><th>Solução</th></tr>
  </thead>
  <tbody>
    <tr><td>CTR &lt;1%</td><td>Gancho fraco — a pessoa não clicou</td><td>Reescreva apenas os primeiros 3s. Não refilme tudo.</td></tr>
    <tr><td>CTR bom mas CPL alto</td><td>Landing page fraca ou público errado</td><td>Teste a LP. Se LP está OK, refine o público.</td></tr>
    <tr><td>Frequência &gt;3 com performance caindo</td><td>Fadiga criativa — audiência viu demais</td><td>Crie 2-3 criativos novos com ângulos diferentes</td></tr>
    <tr><td>Bom no início, piora em 5 dias</td><td>Esgotou o melhor da audiência</td><td>Expandir público ou criar Lookalike 2-3%</td></tr>
  </tbody>
</table>`
          },
          {
            id: "pago-3",
            title: "Google Ads: Search + Display para Lançamentos",
            duration: "20 min",
            type: "text",
            keyPoints: ["Copy de anúncio de Search pronto para adaptar", "Como montar a campanha de retargeting Display em 30 minutos", "YouTube Ads: o script de 5 segundos que não é pulado"],
            exercise: "Monte agora sua lista de palavras-chave de Search. Comece por 3 colunas: branded ([seu nome] + curso/método), problema ([problema que você resolve] + solução) e comparação ([seu nome] vs [concorrente principal]). Escreva 2 variações de copy de anúncio para a palavra-chave de maior intenção. Isso pode ser feito em 45 minutos.",
            content: `<h2>Google Ads para Lançamentos: O Que a Maioria Ignora</h2>

<p>No Brasil, 80-90% dos lançamentos de produtos digitais concentram budget 100% no Meta Ads. Isso cria uma oportunidade: no Google, você captura as pessoas que já estão procurando pelo que você oferece — intenção de compra alta, competição baixa de outros lançadores.</p>

<h2>Search Ads: Capturando Intenção de Compra</h2>

<p>Quem digita no Google está em modo ativo de busca — a temperatura de lead é 3x maior que no Meta. A estratégia é organizar keywords em 3 grupos por intenção:</p>

<table>
  <thead>
    <tr><th>Grupo</th><th>Tipo de keyword</th><th>Exemplo</th><th>Intenção</th></tr>
  </thead>
  <tbody>
    <tr><td>Branded</td><td>[Seu nome] + verbo</td><td>"João Silva curso", "João Silva método"</td><td>Quem já te conhece — mais alta</td></tr>
    <tr><td>Problema</td><td>Como + problema/solução</td><td>"como fazer um lançamento digital", "como vender produto online"</td><td>Pesquisa ativa de solução</td></tr>
    <tr><td>Comparação</td><td>[Tema] + melhor/top/comparação</td><td>"melhor curso de lançamento digital", "curso lançamento digital vale a pena"</td><td>Avaliando opções — próximo de comprar</td></tr>
  </tbody>
</table>

<h3>Copy de Anúncio de Search — Template Pronto</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">COPY SEARCH AD — 3 VARIAÇÕES</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Headline 1 (30 chars):</strong> [Keyword exata] — Método [ano]<br/>
<strong>Headline 2 (30 chars):</strong> [Resultado específico] em [tempo]<br/>
<strong>Headline 3 (30 chars):</strong> Turma Aberta | Acesso Imediato<br/>
<strong>Descrição 1 (90 chars):</strong> "[Número] alunos já [resultado]. Método validado em [N] lançamentos reais. Vagas limitadas."<br/>
<strong>Descrição 2 (90 chars):</strong> "Aprenda a [resultado principal] com quem gerou R$[X] em lançamentos. Veja como →"<br/><br/>
<em style="color:#a0aec0">Dica: ative assets de sitelinks com links para: Depoimentos, O que está incluso, Garantia, FAQ</em>
</p>
</div>

<h2>YouTube Ads: O Pré-Aquecimento Que Multiplica o Meta</h2>

<p>YouTube Ads para lançamentos funcionam como "aquecedor silencioso" — a pessoa vê seu conteúdo no YouTube antes mesmo de te seguir no Instagram. Quando vê seus anúncios no Meta, já tem familiaridade (efeito "eu conheço esse cara").</p>

<h3>TrueView In-Stream: Os 5 Segundos Que Decidem Tudo</h3>
<p>O anúncio In-Stream pode ser pulado após 5 segundos. Você paga apenas se a pessoa assistir 30s+. Portanto: os primeiros 5s devem criar curiosidade ou identificação tão forte que a pessoa não pule.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">SCRIPT — 5 PRIMEIROS SEGUNDOS (não puláveis)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Opção 1 — Resultado chocante:</strong> "Em [mês], fiz R$[valor] em [dias] dias com uma lista de [N] pessoas. Vou te mostrar exatamente como."<br/><br/>
<strong>Opção 2 — Identificação com dor:</strong> "Se você já tentou lançar e não vendeu o suficiente — o problema não foi seu produto."<br/><br/>
<strong>Opção 3 — Pergunta polarizadora:</strong> "Quanto do seu budget de anúncio está sendo desperdiçado agora mesmo? A maioria não sabe. Você vai querer ver isso."
</p>
</div>

<h3>Bumper Ads (6s não puláveis): Para Retargeting de Carrinho</h3>

<div style="background:#1a1a2e;border-left:3px solid #ef4444;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#f87171;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">SCRIPT — BUMPER AD FECHAMENTO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"[Produto] fecha hoje à meia-noite. [Nome] → clica agora."<br/><br/>
<em style="color:#a0aec0;font-size:13px">Público: remarketing de quem visitou a página de vendas nos últimos 7 dias sem converter</em>
</p>
</div>

<h2>Display: Perseguição Estratégica de 7 Dias</h2>

<p>A campanha de Display é simples mas poderosa: mostrar banner/imagem para quem visitou sua página de vendas mas não comprou.</p>

<table>
  <thead>
    <tr><th>Configuração</th><th>Valor</th></tr>
  </thead>
  <tbody>
    <tr><td>Público</td><td>Visitantes da página de vendas (últimos 7 dias) excluindo compradores</td></tr>
    <tr><td>Duração da perseguição</td><td>7 dias após a visita — depois excluir</td></tr>
    <tr><td>Frequência máxima</td><td>3-5 impressões/dia por usuário</td></tr>
    <tr><td>Tamanhos de banner</td><td>300x250, 728x90, 160x600, 320x50 (cobre 90% dos placements)</td></tr>
    <tr><td>Mensagem ideal</td><td>Urgência + prova social + garantia — os 3 em um banner</td></tr>
  </tbody>
</table>

<div style="background:#1a1a2e;border-left:3px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">COPY DO BANNER DISPLAY</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Headline:</strong> "[Produto] fecha [dia]"<br/>
<strong>Subheadline:</strong> "[N] alunos já entraram"<br/>
<strong>Badge:</strong> "Garantia 30 dias"<br/>
<strong>CTA button:</strong> "Entrar agora →"
</p>
</div>

<h2>Budget e Alocação</h2>

<table>
  <thead>
    <tr><th>Canal</th><th>% do budget Google</th><th>Melhor fase</th><th>KPI de sucesso</th></tr>
  </thead>
  <tbody>
    <tr><td>Search (branded)</td><td>30%</td><td>Carrinho aberto</td><td>CPC &lt;R$2 | Conversão &gt;5%</td></tr>
    <tr><td>Search (problema)</td><td>25%</td><td>Pré-lançamento</td><td>CPL &lt;R$30</td></tr>
    <tr><td>YouTube In-Stream</td><td>30%</td><td>D-14 a D-1</td><td>CPV &lt;R$0.10 | VTR &gt;25%</td></tr>
    <tr><td>Display Remarketing</td><td>15%</td><td>Carrinho + fechamento</td><td>CPC &lt;R$1.50</td></tr>
  </tbody>
</table>`
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
            keyPoints: ["O calendário exato de 21 dias com ação por dia", "O que postar/enviar em cada fase — com copy real", "A anatomia de um PLC que converte 3-8% da lista", "Por que 60-70% das vendas ocorrem nas últimas 24h e como usar isso"],
            exercise: "Preencha seu calendário PLF: Escolha uma data de abertura de carrinho. Conte 21 dias para trás — esse é seu D-21. Abra uma planilha e preencha cada linha com: Data | Fase | Canal | Ação | Copy (use os modelos desta aula). Até o fim desta aula você terá seu plano de lançamento completo.",
            content: `<h2>A PLF na Prática: 21 Dias, Ação por Ação</h2>

<p>A maioria das pessoas aprende que a PLF tem "4 fases" e fica nisso. O problema? Fase não é ação. Este módulo vai te dar o roteiro executável — o que fazer em cada dia, com o copy real que vai ao ar.</p>

<blockquote>O segredo da PLF não é o roteiro. É o <strong>estado emocional</strong> que você cria na audiência ao longo das semanas. Cada mensagem é uma peça de uma história que termina com a compra como ato natural.</blockquote>

<h2>Os 4 Estados Emocionais da Jornada</h2>

<p>Antes de ver o calendário, entenda o que você está construindo na cabeça da audiência:</p>

<ol>
  <li><strong>Curiosidade</strong> (D-21 a D-14) — "O que está acontecendo?"</li>
  <li><strong>Esperança</strong> (D-14 a D-3) — "Isso pode funcionar pra mim?"</li>
  <li><strong>Desejo</strong> (D-3 a D-0) — "Eu quero. Quando abre?"</li>
  <li><strong>Urgência</strong> (Carrinho aberto) — "Preciso decidir agora."</li>
</ol>

<p>Cada post, email e mensagem tem exatamente uma função: mover a audiência de um estado para o próximo.</p>

<hr/>

<h2>FASE 1 — Pré-Pré-Lançamento (D-21 a D-14)</h2>
<h3>Objetivo: despertar o problema sem revelar o produto</h3>

<p>Você não fala em produto nenhum ainda. Fala sobre a dor, o problema, o paradoxo. A audiência começa a se identificar e a perceber que você entende o que ela vive.</p>

<h3>O que fazer em cada dia:</h3>

<table>
  <thead>
    <tr><th>Dia</th><th>Canal</th><th>Tipo de Conteúdo</th><th>Objetivo</th></tr>
  </thead>
  <tbody>
    <tr><td>D-21</td><td>Feed + Stories</td><td>Pergunta provocativa</td><td>Identificação com o problema</td></tr>
    <tr><td>D-19</td><td>Feed</td><td>Post de dor — "por que a maioria falha"</td><td>Construir autoridade sobre o problema</td></tr>
    <tr><td>D-17</td><td>Stories</td><td>Enquete / caixinha de perguntas</td><td>Engajamento + levantamento de objeções</td></tr>
    <tr><td>D-15</td><td>Feed + Email</td><td>Bastidores vagos — "estou preparando algo"</td><td>Criar antecipação sem revelar</td></tr>
    <tr><td>D-14</td><td>Stories + WhatsApp</td><td>Anúncio da lista VIP</td><td>Captação para lista de espera</td></tr>
  </tbody>
</table>

<h3>Copy Real — Post de D-21 (Pergunta Provocativa)</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0">
<p style="color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 8px">📱 FEED — D-21</p>
<p style="color:#e2e8f0;margin:0"><strong>Por que a maioria das pessoas que tenta lançar um produto digital desiste antes do primeiro resultado?</strong></p>
<br/>
<p style="color:#e2e8f0;margin:0">Não é falta de esforço. Vi pessoas trabalhar 14h por dia durante meses sem faturar R$1.</p>
<p style="color:#e2e8f0;margin:0">Não é falta de produto. Vi produtos excelentes que não venderam nada.</p>
<p style="color:#e2e8f0;margin:0">A resposta que encontrei me surpreendeu.</p>
<br/>
<p style="color:#e2e8f0;margin:0">Me conta nos comentários: qual foi o maior obstáculo que você enfrentou (ou imagina enfrentar) no seu primeiro lançamento?</p>
<br/>
<p style="color:#a0aec0;font-size:13px;margin:0">#lancamento #produtodigital #marketingdigital #empreendedorismo</p>
</div>

<h3>Por que esse copy funciona?</h3>
<ul>
  <li><strong>Paradoxo inicial:</strong> "desiste antes do primeiro resultado" cria dissonância — a pessoa quer saber por quê</li>
  <li><strong>Duas falsas respostas primeiro:</strong> derruba objeções que a audiência teria ("mas eu me esforço...") antes de apresentar a real</li>
  <li><strong>CTA de engajamento:</strong> a pergunta nos comentários alimenta o algoritmo E coleta dados de objeção reais para usar no PLC</li>
</ul>

<h3>Copy Real — Stories D-17 (Caixinha)</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0">
<p style="color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 8px">📲 STORIES — D-17</p>
<p style="color:#e2e8f0;margin:0"><strong>Slide 1:</strong> Estou pesquisando algo importante e preciso da sua honestidade.</p>
<br/>
<p style="color:#e2e8f0;margin:0"><strong>Slide 2 (caixinha):</strong> "Se você pudesse resolver UMA coisa no seu negócio online hoje, o que seria?"</p>
<br/>
<p style="color:#e2e8f0;margin:0"><strong>Slide 3 (após respostas):</strong> Obrigado pelas respostas. Percebi um padrão que me deixou impressionado. Semana que vem vou compartilhar o que encontrei — e acho que vai mudar sua perspectiva.</p>
</div>

<p><strong>O que fazer com as respostas:</strong> leia todas. As objeções que aparecem mais vão direto nos seus PLCs. Se 40 pessoas disseram "não sei como atrair clientes", esse é o tema do PLC 1.</p>

<hr/>

<h2>FASE 2 — Pré-Lançamento (D-14 a D-1): Os 3 PLCs</h2>
<h3>Objetivo: educar, criar desejo, eliminar objeções</h3>

<p>PLC = Pre-Launch Content. São 3 peças de conteúdo longo (vídeo de 20-40min ou texto longo) que ensinam algo de valor real — e ao mesmo tempo pré-vendem o produto sem aparecer com uma oferta explícita.</p>

<h3>Estrutura dos 3 PLCs</h3>

<table>
  <thead>
    <tr><th>PLC</th><th>Dia</th><th>Tema</th><th>Objeção que elimina</th><th>Gancho para o próximo</th></tr>
  </thead>
  <tbody>
    <tr><td>PLC 1</td><td>D-14</td><td>A Oportunidade</td><td>"Isso funciona?"</td><td>"No próximo vou mostrar quem já fez"</td></tr>
    <tr><td>PLC 2</td><td>D-9</td><td>A Transformação</td><td>"Funciona pra mim especificamente?"</td><td>"No próximo revelarei o mecanismo secreto"</td></tr>
    <tr><td>PLC 3</td><td>D-5</td><td>O Mecanismo</td><td>"Eu consigo implementar?"</td><td>"Na próxima semana abre — avise um amigo"</td></tr>
  </tbody>
</table>

<h3>Anatomia do PLC 1 — Roteiro Completo (Vídeo de 25 min)</h3>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0">
<p style="color:#34d399;font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 8px">🎬 PLC 1 — ROTEIRO (adapte para seu nicho)</p>

<p style="color:#e2e8f0;margin:0"><strong>[0:00 - 0:30] GANCHO</strong><br/>
"Nos próximos 25 minutos vou te mostrar por que a maioria das pessoas que tenta lançar online está cometendo um erro que eu mesmo cometi — e que me custou [X meses / R$ Y]. Fica até o final porque vou te dar [entregável concreto]."</p>
<br/>
<p style="color:#e2e8f0;margin:0"><strong>[0:30 - 3:00] PROBLEMA AMPLIFICADO</strong><br/>
"Sabe aquela sensação de trabalhar muito, gerar conteúdo todo dia, ter seguidores... e mesmo assim não conseguir converter em renda consistente? Isso tem um nome: é o Paradoxo do Esforço Sem Sistema."</p>
<br/>
<p style="color:#e2e8f0;margin:0"><strong>[3:00 - 8:00] A OPORTUNIDADE (Virada)</strong><br/>
"Mas existe uma janela de oportunidade que a maioria ignora. Em [nicho], [dado específico que valida a oportunidade]. Quem aprender a acessar essa janela primeiro, vai [resultado desejado]."</p>
<br/>
<p style="color:#e2e8f0;margin:0"><strong>[8:00 - 20:00] CONTEÚDO DE VALOR REAL</strong><br/>
Ensine 3-5 conceitos/táticas genuinamente úteis. Não retenha o melhor — entregue valor real. Quanto mais a pessoa aprender aqui, mais ela vai querer o produto completo.</p>
<br/>
<p style="color:#e2e8f0;margin:0"><strong>[20:00 - 23:00] PROVA SOCIAL + AUTORIDADE</strong><br/>
"[Nome do aluno] aplicou exatamente isso e em [tempo] conseguiu [resultado específico]. Vou mostrar exatamente o que ele fez diferente."</p>
<br/>
<p style="color:#e2e8f0;margin:0"><strong>[23:00 - 25:00] GANCHO PARA PLC 2</strong><br/>
"Semana que vem vou publicar o PLC 2 onde vou mostrar [transformação específica de alunos reais]. Se você quer ser avisado primeiro, entre na lista VIP no link abaixo."</p>
</div>

<h3>Email de Lançamento do PLC 1</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0">
<p style="color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 8px">📧 EMAIL — D-14 (lançamento PLC 1)</p>
<p style="color:#e2e8f0;margin:0"><strong>Assunto:</strong> Você está cometendo esse erro? (vídeo novo)</p>
<br/>
<p style="color:#e2e8f0;margin:0">Olá, [Nome].</p>
<br/>
<p style="color:#e2e8f0;margin:0">Publiquei hoje um vídeo que levei semanas para preparar.</p>
<br/>
<p style="color:#e2e8f0;margin:0">Nele, revelo o motivo pelo qual [resultado que a audiência quer] é muito mais simples do que parece — e por que a maioria das pessoas está procurando no lugar errado.</p>
<br/>
<p style="color:#e2e8f0;margin:0">São 25 minutos. Sem enrolação. Com exemplos reais.</p>
<br/>
<p style="color:#e2e8f0;margin:0">→ [LINK DO VÍDEO]</p>
<br/>
<p style="color:#e2e8f0;margin:0">Esse é o primeiro de três vídeos que vou publicar nas próximas semanas. O segundo, que sai em 5 dias, vai ser ainda mais impactante.</p>
<br/>
<p style="color:#e2e8f0;margin:0">Assista e me conta o que achou.</p>
<br/>
<p style="color:#e2e8f0;margin:0">— [Seu nome]</p>
</div>

<hr/>

<h2>FASE 3 — Abertura do Carrinho (D-1 a D+3)</h2>
<h3>Objetivo: converter o desejo construído em ação imediata</h3>

<h3>O roteiro das primeiras 24 horas — hora a hora</h3>

<table>
  <thead>
    <tr><th>Horário</th><th>Canal</th><th>Ação</th></tr>
  </thead>
  <tbody>
    <tr><td>08h00</td><td>Email</td><td>Email de abertura — "Abriu! Acesso aqui"</td></tr>
    <tr><td>08h05</td><td>WhatsApp</td><td>Broadcast — link direto para a página</td></tr>
    <tr><td>08h30</td><td>Stories</td><td>Story ao vivo mostrando a abertura + primeiras confirmações</td></tr>
    <tr><td>10h00</td><td>Feed</td><td>Post de abertura com print das primeiras vendas</td></tr>
    <tr><td>19h00</td><td>Stories</td><td>"X pessoas já entraram. Bônus exclusivo para quem entrar hoje ainda"</td></tr>
    <tr><td>21h00</td><td>Email</td><td>Email de follow-up — "Ainda dá tempo hoje"</td></tr>
    <tr><td>22h00</td><td>WhatsApp</td><td>Mensagem de escassez — "Encerra o bônus à meia-noite"</td></tr>
  </tbody>
</table>

<h3>Email de Abertura do Carrinho (D+0, 8h00)</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0">
<p style="color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 8px">📧 EMAIL DE ABERTURA</p>
<p style="color:#e2e8f0;margin:0"><strong>Assunto:</strong> Abriu ✅ — [Nome do Produto] está disponível</p>
<br/>
<p style="color:#e2e8f0;margin:0">Chegou o dia, [Nome].</p>
<br/>
<p style="color:#e2e8f0;margin:0">A partir de agora, o [Nome do Produto] está aberto para os alunos que estiveram aqui durante as últimas semanas.</p>
<br/>
<p style="color:#e2e8f0;margin:0">Você vai aprender exatamente como [promessa principal do produto].</p>
<br/>
<p style="color:#e2e8f0;margin:0">Mas atenção: o carrinho fecha na [data/hora]. E os primeiros [X] alunos a entrarem hoje ganham [bônus exclusivo de abertura].</p>
<br/>
<p style="color:#e2e8f0;margin:0">→ [BOTÃO: QUERO ENTRAR AGORA]</p>
<br/>
<p style="color:#e2e8f0;margin:0">Qualquer dúvida, responde esse email. Lerei pessoalmente.</p>
<br/>
<p style="color:#e2e8f0;margin:0">— [Seu nome]</p>
</div>

<hr/>

<h2>FASE 4 — Urgência e Fechamento (Últimas 24h)</h2>
<h3>Por que 60-70% das vendas acontecem nas últimas 24 horas</h3>

<p>Kahneman provou: o medo de perda pesa 2,5x mais que o desejo de ganho. A urgência real ativa o sistema límbico — a parte do cérebro que toma decisões. Sem deadline, a decisão fica para "depois". E depois nunca chega.</p>

<h3>A Sequência dos Últimos 90 minutos</h3>

<table>
  <thead>
    <tr><th>Horário</th><th>Canal</th><th>Mensagem</th></tr>
  </thead>
  <tbody>
    <tr><td>Meia-noite - 4h</td><td>Email</td><td>"Encerra em 4 horas" — tom calmo, factual</td></tr>
    <tr><td>Meia-noite - 1h</td><td>WhatsApp</td><td>"Última hora. [Link]"</td></tr>
    <tr><td>Meia-noite - 30min</td><td>Stories</td><td>Contador ao vivo no stories</td></tr>
    <tr><td>Meia-noite</td><td>Todos</td><td>"Carrinho fechado. Lista para próxima turma: [link]"</td></tr>
  </tbody>
</table>

<h3>WhatsApp de Fechamento (Últimas 2 horas)</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0">
<p style="color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 8px">📱 WHATSAPP — ÚLTIMAS 2H</p>
<p style="color:#e2e8f0;margin:0">[Nome], o carrinho do [Produto] fecha em 2 horas.</p>
<br/>
<p style="color:#e2e8f0;margin:0">Se você está em dúvida, me responde aqui — a gente conversa.</p>
<br/>
<p style="color:#e2e8f0;margin:0">Se você já decidiu que não é pra você, tudo bem — só me faz saber pra eu não te incomodar mais com isso.</p>
<br/>
<p style="color:#e2e8f0;margin:0">Mas se você realmente quer [resultado principal] e está só esperando... o que está te travando?</p>
<br/>
<p style="color:#e2e8f0;margin:0">→ [LINK DE COMPRA]</p>
</div>

<p><strong>Por que esse copy de fechamento funciona:</strong> Ele não empurra — faz uma pergunta. Abre diálogo. Pessoas que respondem com objeções são a oportunidade de venda mais quente que existe. Cada resposta é uma conversa de vendas 1:1.</p>

<hr/>

<h2>Calendário Resumido: Os 21 Dias em Uma Tabela</h2>

<table>
  <thead>
    <tr><th>Semana</th><th>Fase</th><th>Foco Principal</th><th>KPI para acompanhar</th></tr>
  </thead>
  <tbody>
    <tr><td>Semana 1 (D-21 a D-14)</td><td>PPL</td><td>Despertar o problema</td><td>Comentários, respostas de stories, DMs</td></tr>
    <tr><td>Semana 2 (D-14 a D-7)</td><td>PL — PLCs 1 e 2</td><td>Educação + prova social</td><td>Views de vídeo, opt-ins na lista VIP</td></tr>
    <tr><td>Semana 3 (D-7 a D-0)</td><td>PL — PLC 3</td><td>Mecanismo + antecipação</td><td>Perguntas sobre o produto, "quando abre?"</td></tr>
    <tr><td>Dias 1-3</td><td>Abertura</td><td>Converter desejo em compra</td><td>Vendas, taxa de conversão da lista</td></tr>
    <tr><td>Dias 4-5</td><td>Fechamento</td><td>Urgência real</td><td>60-70% do total de vendas aqui</td></tr>
  </tbody>
</table>

<h2>O Erro Mais Comum: Encurtar a Fase de PPL</h2>

<p>A maioria das pessoas pula direto para o PLC 1. O problema? A audiência ainda não está no estado emocional certo para receber o conteúdo. A fase PPL não é "perda de tempo" — é o aquecimento que determina a temperatura do carrinho.</p>

<p><strong>Referência real:</strong> Lançamentos que pulam a PPL têm, em média, 40% menos conversão na fase de abertura do que lançamentos que respeitam as 3 semanas completas. (Benchmark PLF Brasil, 2023)</p>`
          },
          {
            id: "plf-2",
            title: "Construindo Sua Lista de Espera",
            duration: "20 min",
            type: "text",
            keyPoints: ["A copy completa de uma landing page de lista VIP — pronta para adaptar", "Os 7 emails da sequência pré-lançamento com assuntos e corpo real", "Como escolher o lead magnet certo para seu nicho (com exemplos)", "WhatsApp + Instagram: scripts de captação para cada canal"],
            exercise: "Escreva hoje o copy da sua landing page de lista VIP usando o template desta aula. Preencha as lacunas com informações do seu produto e nicho. Meta: página no ar em 48h. Copie a estrutura exatamente — não tente inventar agora. Melhore depois, com dados.",
            content: `<h2>A Lista é Seu Ativo Mais Valioso — E Essa Página é a Porta de Entrada</h2>

<p>Redes sociais emprestam audiência. Lista é propriedade. Um post pode não ser visto por 90% dos seus seguidores. Um email vai direto para a caixa de entrada de 100% da sua lista.</p>

<p>Para um lançamento PLF, você precisa de dois tipos de lista:</p>
<ol>
  <li><strong>Lista de leads frios</strong> — capturada pelo lead magnet, aquecida pela sequência</li>
  <li><strong>Lista VIP de pré-lançamento</strong> — pessoas que pediram explicitamente para ser avisadas quando o produto abrir</li>
</ol>

<p>A lista VIP converte 3-7x mais do que leads frios. Priorize construí-la.</p>

<hr/>

<h2>A Landing Page de Lista VIP — Copy Completo Pronto para Adaptar</h2>

<p>Use esta estrutura exatamente. Cada seção tem uma função específica:</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0">
<p style="color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 8px">📄 TEMPLATE — LANDING PAGE VIP</p>

<p style="color:#e2e8f0;margin:0 0 4px"><strong>[HEADLINE — Promessa em 1 linha]</strong></p>
<p style="color:#a0aec0;font-size:13px;margin:0 0 16px">Exemplo: "Em breve: o método que gerou R$100k em 7 dias para 340 produtores digitais"</p>

<p style="color:#e2e8f0;margin:0 0 4px"><strong>[SUBHEADLINE — Quem é para]</strong></p>
<p style="color:#a0aec0;font-size:13px;margin:0 0 16px">Exemplo: "Para coaches, consultores e criadores de conteúdo que querem lançar seu primeiro produto digital sem precisar de uma audiência grande"</p>

<p style="color:#e2e8f0;margin:0 0 4px"><strong>[3 BULLETS — O que a pessoa vai aprender/conseguir]</strong></p>
<p style="color:#a0aec0;font-size:13px;margin:0 0 4px">✓ Como [resultado 1] mesmo que [objeção 1]</p>
<p style="color:#a0aec0;font-size:13px;margin:0 0 4px">✓ O método de [resultado 2] que [diferenciador]</p>
<p style="color:#a0aec0;font-size:13px;margin:0 0 16px">✓ Por que [crença limitante] é falso — e o que funciona de verdade</p>

<p style="color:#e2e8f0;margin:0 0 4px"><strong>[FORMULÁRIO — Só email e nome]</strong></p>
<p style="color:#a0aec0;font-size:13px;margin:0 0 16px">Campo: Nome | Campo: Email | Botão: "Quero ser avisado(a) primeiro"</p>

<p style="color:#e2e8f0;margin:0 0 4px"><strong>[PROVA SOCIAL ABAIXO DO FORM]</strong></p>
<p style="color:#a0aec0;font-size:13px;margin:0 0 16px">Exemplo: "Mais de 2.400 pessoas já estão na lista. Sem spam. Cancele quando quiser."</p>

<p style="color:#e2e8f0;margin:0 0 4px"><strong>[AUTORIDADE — 2-3 linhas sobre quem você é]</strong></p>
<p style="color:#a0aec0;font-size:13px;margin:0">Foco no resultado que você gerou para outros, não em diplomas. "Já ajudei X pessoas a conseguirem Y" converte mais que "Sou formado em Z".</p>
</div>

<h3>Taxas de conversão por tipo de página</h3>
<table>
  <thead>
    <tr><th>Tipo de Landing Page</th><th>Conversão Típica</th><th>Quando usar</th></tr>
  </thead>
  <tbody>
    <tr><td>Genérica sem lead magnet</td><td>10-20%</td><td>Nunca — não use</td></tr>
    <tr><td>Com lead magnet fraco</td><td>20-35%</td><td>Início de carreira</td></tr>
    <tr><td>Lista VIP com contexto claro</td><td>40-60%</td><td>Lançamento PLF</td></tr>
    <tr><td>Lead magnet forte + urgência</td><td>55-75%</td><td>Lançamentos avançados</td></tr>
  </tbody>
</table>

<hr/>

<h2>Escolhendo o Lead Magnet Certo</h2>

<p>Um lead magnet funciona quando: <strong>percepção de valor &gt; custo percebido (fornecer email/telefone)</strong>.</p>

<p>Regra de ouro: o lead magnet resolve 1 problema específico em 15 minutos ou menos, e é o primeiro passo natural para o produto principal.</p>

<table>
  <thead>
    <tr><th>Formato</th><th>Conversão</th><th>Melhor para</th><th>Exemplo</th></tr>
  </thead>
  <tbody>
    <tr><td>Mini-curso em vídeo (3-5 aulas)</td><td>★★★★★</td><td>Qualquer nicho educacional</td><td>"5 aulas: Como criar seu primeiro produto em 7 dias"</td></tr>
    <tr><td>Checklist preenchível</td><td>★★★★☆</td><td>Processos e produtividade</td><td>"Checklist de 47 pontos para lançar sem erro"</td></tr>
    <tr><td>Template / Swipe file</td><td>★★★★☆</td><td>Copy, design, gestão</td><td>"11 emails de lançamento prontos para usar"</td></tr>
    <tr><td>Calculadora ou ferramenta</td><td>★★★★☆</td><td>Finanças, métricas</td><td>"Calculadora: quanto você pode faturar no lançamento"</td></tr>
    <tr><td>Ebook / PDF</td><td>★★★☆☆</td><td>Conteúdo denso e técnico</td><td>"O Guia de 30 páginas sobre [tema]"</td></tr>
    <tr><td>Webinar gravado</td><td>★★★☆☆</td><td>Audiência morna/fria</td><td>"Masterclass: Como fazer seu primeiro R$10k online"</td></tr>
  </tbody>
</table>

<hr/>

<h2>A Sequência de 7 Emails Pré-Lançamento — Copy Completo</h2>

<p>Após o opt-in, essa sequência roda automaticamente. Cada email tem uma função única. Não pule nem junte — a cadência importa.</p>

<h3>Email 1 — Imediato (Entrega + Apresentação)</h3>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">ASSUNTO: Seu [lead magnet] chegou + uma coisa importante</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Olá, [Nome]! Aqui está o que você pediu: [LINK]<br/><br/>Mas antes de mergulhar nisso, quero que você saiba que nas próximas semanas vou compartilhar [X] coisas que aprendi sobre [tema] que mudaram completamente os resultados de quem aplica.<br/><br/>Você está na lista certa. Fique de olho na caixa de entrada.<br/><br/>— [Seu nome]</p>
</div>

<h3>Email 2 — Dia 2 (História de Transformação)</h3>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">ASSUNTO: O dia que tudo mudou (minha história)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Conta a história de como você chegou onde está. Inclua: o momento de dificuldade (relatable), a virada (o insight que mudou tudo), o resultado depois da virada. Termine com: "Nos próximos dias vou te mostrar exatamente o que aprendi nesse processo."</p>
</div>

<h3>Email 3 — Dia 4 (Conteúdo de Valor Puro)</h3>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">ASSUNTO: [Número] coisas que ninguém te conta sobre [tema]</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Entregue 3-5 insights genuínos e aplicáveis. Sem venda. Sem CTA para produto. O objetivo aqui é construir credibilidade através do valor real. A reciprocidade gerada aqui converte no dia de abertura.</p>
</div>

<h3>Email 4 — Dia 6 (Prova Social)</h3>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">ASSUNTO: O que [nome do aluno] conseguiu em [tempo]</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Compartilhe 1-2 casos de alunos com resultado específico e verificável. Se não tem alunos ainda: use seu próprio resultado ou faça um beta com 3-5 pessoas e use o resultado deles. Resultados sem especificidade não convencem. "Conseguiu resultados incríveis" não vale nada. "Faturou R$18.700 em 6 dias" converte.</p>
</div>

<h3>Email 5 — Dia 9 (Derrubando a Maior Objeção)</h3>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">ASSUNTO: "Mas eu não tenho audiência..." (a resposta honesta)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Identifique a objeção número 1 que apareceu nos comentários e stories da fase PPL. Escreva o assunto com ela. Destrua a objeção com lógica + exemplo real + reframe. Estrutura: "Eu entendo por que você pensa isso. Mas o que você não sabe é que... [revelação]. Prova disso é que... [caso]. Então o que bloqueia não é [objeção] — é [real problema que seu produto resolve]."</p>
</div>

<h3>Email 6 — Dia 12 (Antecipação)</h3>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">ASSUNTO: Tenho algo importante para te contar</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Em [X dias], vou abrir o [nome do produto] para um grupo restrito. Como você está na lista VIP, vai ter acesso antes de todo mundo — e ao bônus exclusivo que só quem está aqui vai receber.<br/><br/>Não vou revelar tudo ainda. Mas posso dizer que vai incluir [preview do conteúdo mais valioso].<br/><br/>Fique de olho na sua caixa de entrada.</p>
</div>

<h3>Email 7 — Dia 14 (Véspera de Abertura)</h3>
<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">ASSUNTO: Abre amanhã às 8h ✅</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Amanhã às 8h você vai receber um email com o link de acesso ao [produto].<br/><br/>Para você que está aqui desde o começo: as primeiras [X] pessoas a entrarem receberão [bônus]. Depois disso, o bônus não estará mais disponível.<br/><br/>Prepare-se para amanhã.<br/><br/>— [Seu nome]<br/><br/>P.S. Se tiver alguma dúvida sobre o programa, responde esse email. Estou aqui.</p>
</div>

<hr/>

<h2>Scripts de Captação por Canal</h2>

<h3>Instagram Stories — Sequência de 3 slides</h3>
<div style="background:#1a1a2e;border-left:3px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">📲 STORIES — CAPTAÇÃO VIP</p>
<p style="color:#e2e8f0;font-size:14px;margin:0"><strong>Slide 1:</strong> "Estou preparando algo que não consigo parar de pensar."<br/><br/><strong>Slide 2:</strong> "Em [X semanas] vou abrir [nome do produto] para um grupo pequeno. Quem entrar na lista VIP terá acesso antes de todo mundo + bônus que não vou oferecer em nenhum outro lugar."<br/><br/><strong>Slide 3 (link sticker):</strong> "Entre na lista ↑ São só nome e email. Sem spam." [Link para landing page VIP]</p>
</div>

<h3>WhatsApp — Mensagem de captação para contatos quentes</h3>
<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:16px 20px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">📱 WHATSAPP — CONTATOS QUENTES</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Oi [Nome]! Tô finalizando um projeto novo sobre [tema] e pensei em você especificamente. Antes de abrir pro público, vou avisar uma lista pequena de pessoas em quem confio. Posso te colocar? Se sim, me manda seu email que coloco na lista VIP. Sem compromisso nenhum."</p>
</div>

<hr/>

<h2>Benchmark: O Que é Uma Lista Boa Antes de Abrir?</h2>

<table>
  <thead>
    <tr><th>Tamanho da lista VIP</th><th>Expectativa de vendas (2-4% conversão)</th><th>O que fazer</th></tr>
  </thead>
  <tbody>
    <tr><td>Menos de 200 pessoas</td><td>4-8 vendas</td><td>Semente ou beta fechado — não PLF completo</td></tr>
    <tr><td>200-500 pessoas</td><td>8-20 vendas</td><td>PLF simplificado — 2 PLCs em vez de 3</td></tr>
    <tr><td>500-2.000 pessoas</td><td>20-80 vendas</td><td>PLF completo com tráfego pago modesto</td></tr>
    <tr><td>2.000+ pessoas</td><td>80+ vendas</td><td>PLF completo com investimento em ads</td></tr>
  </tbody>
</table>

<p><strong>Insight crítico:</strong> Qualidade supera quantidade. Uma lista de 300 pessoas que passou pela sequência de 7 emails completa converte mais do que uma lista de 3.000 pessoas frias. Não abra o carrinho antes de completar a sequência — por mais impaciente que você esteja.</p>`
          }
        ]
      },
      {
        id: "mental-triggers",
        number: 5,
        title: "Engenharia Comportamental: Os 12 Gatilhos",
        subtitle: "A mecânica psicológica profunda de cada decisão de compra",
        icon: "🧠",
        color: "from-rose-600 to-pink-600",
        duration: "2h 40min",
        summary: "Gatilhos mentais não são técnicas — são a linguagem que o cérebro já usa. Esta sequência de 4 aulas desmonta a engenharia psicológica de cada um dos 12 padrões: conceito profundo, como construir na mente da audiência, copy anotado e o erro fatal que destrói credibilidade.",
        lessons: [
          {
            id: "triggers-1",
            title: "Credibilidade: Autoridade, Prova Social e Escassez",
            duration: "40 min",
            type: "text",
            keyPoints: [
              "Autoridade não é título — é a equação Domínio Prático + Método Próprio + Números Incontestáveis",
              "Prova Social funciona pela especificidade numérica + segmentação do sucesso + identificação horizontal",
              "Escassez sem justificativa logística real destrói credibilidade de forma irreversível"
            ],
            exercise: "Escreva 3 versões do seu parágrafo de apresentação: uma usando apenas títulos acadêmicos, uma usando resultados numéricos específicos, e uma usando método próprio + números. Mostre as 3 para alguém do seu nicho e pergunte qual parece mais confiável. A resposta vai reconfigurar como você se apresenta.",
            content: `<h2>Engenharia Comportamental — Bloco 1: Credibilidade</h2>

<p>Este bloco cobre os três gatilhos que constroem a base de qualquer relação comercial: <strong>Autoridade</strong>, <strong>Prova Social</strong> e <strong>Escassez</strong>. São os pilares que fazem alguém parar de questionar "será que funciona?" e começar a perguntar "como eu entro?". Sem esses três operando em conjunto, os outros 9 gatilhos não têm onde se apoiar.</p>

<div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px 18px;margin:16px 0">
<p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px">Diretriz metodológica</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Cada gatilho é desmontado em três camadas: <strong>(A) o mecanismo psicológico profundo</strong> — por que funciona no cérebro, <strong>(B) como construir esse estado na mente da audiência</strong> — a engenharia em passos, e <strong>(C) a anatomia do copy em ação</strong> — cada frase com função anotada. Mais o erro fatal que anula tudo.</p>
</div>

<h2>🏛️ 1. Autoridade: A Âncora da Referência Decisiva</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>Autoridade não é um título que você reivindica — é uma <strong>percepção construída</strong> que alinha a visão da sua audiência com a certeza de que você representa a referência máxima naquele território. Quando estabelecida, ela altera a física da relação comercial: você deixa de empurrar um produto e passa a atrair um seguidor.</p>

<p>A autoridade atua diretamente como o <strong>solvente universal das objeções preexistentes</strong>: ceticismo, desconfiança, medo do erro. O cérebro humano suspende o julgamento crítico diante de quem ele reconhece como topo da hierarquia de conhecimento — não porque seja irracional, mas porque é eficiente. Avaliar cada fonte do zero consumiria energia que o sistema cognitivo não tem disponível. Quem prova autoridade recebe um atalho de confiança.</p>

<p>A consequência prática: sem autoridade estabelecida, cada afirmação que você faz exige prova independente. Com autoridade consolidada, suas afirmações chegam pré-validadas.</p>

<h3>B) Como Construir Autoridade na Mente da Audiência</h3>

<p>A construção de autoridade opera em três camadas que precisam coexistir:</p>

<p><strong>1. Demonstração de Domínio Prático ("Tempo de Tela")</strong><br/>
A audiência precisa perceber que você habita o campo de batalha — não que você estudou sobre ele. Isso é feito pela análise detalhada de cenários que só alguém com experiência real consegue descrever (os bastidores, os erros invisíveis, os padrões que não aparecem em livros), pelo uso de dados de resultado com contexto específico, e pela decodificação de problemas que o mercado convencional não consegue explicar.</p>

<p><strong>2. Apresentação do Método (A Propriedade Intelectual)</strong><br/>
Quem tem autoridade não apenas executa — criou uma metodologia própria para executar. Quando você nomeia e estrutura seus passos, você prova que o resultado não foi sorte, mas engenharia replicável. "Os 6 Padrões de Alta Conversão" comunica domínio de uma forma que "eu sei muito sobre conversão" nunca alcançaria.</p>

<p><strong>3. Resultados Numéricos Incontestáveis</strong><br/>
Substitua validação acadêmica por validação de mercado. O número específico atua como argumento lógico irrefutável para o hemisfério esquerdo — enquanto a narrativa em torno dele fala ao limbico. "R$50M em verba de anúncio" é irrefutável. "Muita experiência em marketing" não é nada.</p>

<div style="background:#0f172a;border:1px solid #1e293b;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Audiência Desconfiada] → (Domínio Prático + Método Próprio + Números) → [Alinhamento de Visão] → (Suspensão do Ceticismo) → [AUTORIDADE CONSOLIDADA]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"Em 7 anos gerenciando campanhas para produtos digitais, já vi mais de R$50M em verba de anúncio passar pelas minhas mãos. Ao analisar esses bastidores, isolei seis padrões específicos que se repetem em 100% dos lançamentos que ultrapassam R$1M. Eu não estou aqui para te mostrar teorias de livros — vou abrir a engenharia exata que desenhou esses números."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"7 anos / R$50M"</strong> → Domínio prático incontestável<br/>
<strong style="color:#6d4aff">"isolei seis padrões"</strong> → Propriedade intelectual (método próprio com nome)<br/>
<strong style="color:#6d4aff">"se repetem em 100%"</strong> → Universalidade do método (não foi sorte de um caso)<br/>
<strong style="color:#6d4aff">"a engenharia exata"</strong> → Promete bastidores, não teoria — ativa curiosidade junto com autoridade
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0 24px">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Listar credenciais acadêmicas ou burocráticas: <em>"Sou formado em marketing pela FGV, pós-graduado em gestão digital, certificado pelo Google..."</em>. No ambiente de alta conversão, a audiência busca o mentor que resolve o problema agora — não o profissional mais titulado. Títulos sem resultado de mercado são um sinal de ausência de experiência real, não de expertise.</p>
</div>

<h2>👥 2. Prova Social: A Validação Coletiva e Mitigação do Risco</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>A Prova Social opera no circuito de tomada de decisão mais antigo do cérebro: <strong>segurança por associação tribal</strong>. O ser humano é biologicamente programado para economizar energia cognitiva e evitar riscos. Se um grupo de semelhantes trilhou um caminho e prosperou, a barreira do "medo do desconhecido" colapsa — não porque a pessoa deixou de pensar, mas porque o raciocínio social é mais eficiente que a avaliação individual em muitos contextos.</p>

<p>O mecanismo não se ativa com popularidade genérica. Ele se ativa com <strong>identificação específica</strong>: a audiência precisa enxergar alguém parecido com ela (mesmo ponto de partida, mesma dor, mesma dúvida) que avançou. Se o depoimento mostra alguém em condições muito superiores às suas, ele não converte — cria distância. Se mostra alguém em situação idêntica, ele elimina a última objeção racional: "mas será que funciona pra mim?".</p>

<h3>B) Como Construir Prova Social Eficaz</h3>

<p><strong>1. Especificidade Numérica</strong><br/>
Números redondos parecem inventados porque provavelmente são. "Centenas de alunos" não ativa nada. "487 alunos" ativa a percepção de controle e registro real — alguém contou, alguém acompanhou. O cérebro lê especificidade como evidência de rigor.</p>

<p><strong>2. Segmentação do Sucesso (o Contexto que Converte)</strong><br/>
Mostrar taxa de sucesso dentro de um cenário controlado ("Dos que completaram os 21 dias, 78%...") faz algo contraintuitivo: ao limitar o sucesso a quem fez a parte deles, você aumenta a conversão. O leitor pensa: <em>"Se eu fizer minha parte, estarei no grupo que venceu."</em> Honestidade intelectual converte mais que promessa inflada.</p>

<p><strong>3. Identificação Horizontal</strong><br/>
O depoimento mais poderoso não destaca o resultado final — destaca o ponto de partida. "Antes de entrar no método, eu não tinha lista, não tinha verba, não sabia nada de tráfego" faz a audiência se reconhecer. O resultado vem depois, mas a conexão acontece na dor compartilhada.</p>

<div style="background:#0f172a;border:1px dashed #334155;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Medo de Ser o Único que Não Consegue] → (Número Específico + Contexto Controlado + Ponto de Partida Parecido) → [Identificação com a Jornada] → (Eliminação do Risco Percebido) → [DECISÃO DESBLOQUEADA]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"Exatamente 487 alunos já validaram essa mesma engrenagem. Ao mapearmos a consistência deles, identificamos que dos que completaram o protocolo de 21 dias, 78% geraram um resultado mensurável antes mesmo da primeira campanha oficial ir ao ar. Não são todos que compram que vencem — são aqueles que executam o método."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"Exatamente 487"</strong> → Especificidade que comunica rigor de registro<br/>
<strong style="color:#6d4aff">"ao mapearmos a consistência"</strong> → Prova que há acompanhamento ativo, não alegação vazia<br/>
<strong style="color:#6d4aff">"dos que completaram... 78%"</strong> → Honestidade intelectual que aumenta conversão<br/>
<strong style="color:#6d4aff">"antes mesmo da campanha ir ao ar"</strong> → Resultado que chega antes do esperado — supera expectativa<br/>
<strong style="color:#6d4aff">"não são todos... são os que executam"</strong> → Transfere responsabilidade pro leitor de forma positiva
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0 24px">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Usar frases infladas e vagas: <em>"O curso que está mudando o Brasil"</em>, <em>"Milhares de vidas transformadas"</em>, <em>"O método que mais cresce no país"</em>. O cérebro moderno desenvolveu cegueira total para clichês de escala. Ele exige dados contextualizados. Quanto mais vaga a afirmação, menos crível ela é — e quanto menos crível, mais a audiência assume que você está mentindo.</p>
</div>

<h2>💎 3. Escassez: O Princípio da Raridade e a Disputa por Status</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>A Escassez não funciona porque cria urgência — ela funciona porque ativa um circuito muito mais primitivo: <strong>a aversão à perda de oportunidade de status</strong>. Na evolução humana, o que era escasso (comida, recursos, acesso a líderes) determinava hierarquia e sobrevivência. Quando você limita o acesso a algo valioso, o valor percebido daquele objeto ou serviço escala exponencialmente — não de forma linear, mas exponencial, porque o cérebro passou milênios sendo treinado para lutar pelo que é raro.</p>

<p>O efeito secundário é igualmente poderoso: ao perceber que outros estão competindo pelo mesmo recurso, o indivíduo ativa um modo de comparação social que suspende a análise racional. "Não é se eu preciso — é se posso perder para outros." Esse é o motor real da escassez quando bem construída.</p>

<p>O problema: esse é também o mecanismo mais fácil de detectar quando é falso, e o que causa o dano mais permanente à credibilidade quando detectado.</p>

<h3>B) Como Construir e Sustentar Escassez Real</h3>

<p><strong>1. Justificativa Logística Plausível e Específica</strong><br/>
Você não pode limitar vagas "porque quer". É preciso apresentar um gargalo técnico real e específico. "Estou limitando a 80 porque ofereço revisão individual de cada plano de tráfego" é crível porque apresenta o custo operacional. "Vagas limitadas" sem justificativa é percebido como manipulação.</p>

<p><strong>2. Atualização em Tempo Real</strong><br/>
Mostrar o dreno das vagas cria o efeito de urgência social — ver outros consumindo o que você ainda não consumiu. "No momento em que escrevo isso: 47 vagas preenchidas" é mais poderoso que "apenas 33 restantes" porque implica movimento em andamento.</p>

<p><strong>3. Escassez de Acesso, Não Só de Vagas</strong><br/>
A escassez mais crível raramente é sobre número de vagas — é sobre condições de acesso que genuinamente não se repetem. Bônus com data de expiração real, preço válido por período específico com motivo explicado, ou acesso a contexto único (ao vivo, com Q&A direto) são formas de escassez que naturalmente se justificam.</p>

<div style="background:#0f172a;border:1px dashed #334155;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Valor Percebido Normal] → (Limitação + Justificativa Técnica + Prova de Movimento) → [Ativação do Circuito de Raridade] → (Suspensão da Análise Racional) → [AÇÃO ACELERADA]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"Estou limitando rigorosamente esta mentoria a 80 assentos. O motivo é puramente técnico: eu faço a revisão individual de cada plano de tráfego dos alunos. Acima desse volume, a qualidade da entrega cai — e a minha reputação junto. Neste exato momento, 47 vagas já foram preenchidas. Restam 33."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"rigorosamente"</strong> → Sinaliza que não é arbitrário — há controle e intenção<br/>
<strong style="color:#6d4aff">"motivo é puramente técnico"</strong> → Coloca o ônus na realidade operacional, não na estratégia de venda<br/>
<strong style="color:#6d4aff">"a qualidade cai... e a minha reputação"</strong> → Skin in the game — você perde algo real se não cumprir<br/>
<strong style="color:#6d4aff">"47 já foram preenchidas"</strong> → Prova de movimento. Implica que outros já decidiram enquanto você ainda lê<br/>
<strong style="color:#6d4aff">"Restam 33"</strong> → A conclusão lógica — a decisão sobre as últimas vagas está com o leitor agora
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0 24px">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">A "escassez perpétua": avisar que são as últimas vagas hoje, amanhã, e na semana que vem. Uma fração da audiência sempre testa — clica no link depois do prazo, verifica se o contador resetou, volta no dia seguinte. Uma vez que detectam a mentira, o gatilho de Autoridade colapsa junto. A pessoa não apenas deixa de comprar — ela adverte outros. Escassez falsa é o erro de credibilidade mais difícil de reverter.</p>
</div>`
          },
          {
            id: "triggers-2",
            title: "Relacionamento: Urgência, Reciprocidade e Comunidade",
            duration: "40 min",
            type: "text",
            keyPoints: [
              "Urgência sem deadline específico e justificado é invisível — o cérebro ignora o vago",
              "Reciprocidade exige entrega genuína anterior: o débito emocional precisa ser real para funcionar",
              "Comunidade vende identidade e status, não conteúdo — quem compra quer pertencer a um grupo específico de pessoas"
            ],
            exercise: "Mapeie os últimos 30 dias de conteúdo que você publicou. Quanto do que você entregou gratuitamente tem valor real de mercado (algo que você poderia cobrar)? Agora escreva um parágrafo de reciprocidade que referencia especificamente esse conteúdo — não 'tenho dado muito' mas 'no vídeo de terça entreguei X que resolvia Y'. A especificidade é o que converte débito em decisão.",
            content: `<h2>Engenharia Comportamental — Bloco 2: Relacionamento</h2>

<p>Os três gatilhos deste bloco operam na dimensão do <strong>vínculo entre você e a audiência</strong>: Urgência força o momento da decisão, Reciprocidade cria o débito emocional que motiva a retribuição, e Comunidade vende o pertencimento que nenhuma feature ou bônus consegue substituir. São os gatilhos que transformam interesse em compromisso.</p>

<h2>⏱️ 4. Urgência: A Engenharia do Momento Decisivo</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>A inércia é o estado natural do cérebro humano. "Vou pensar" não é uma decisão — é o sistema de defesa padrão diante de qualquer escolha que envolve risco percebido. O problema do "pensar mais tarde" é que o contexto emocional que criou o interesse se dissipa. Horas depois, a mesma oferta parece menos urgente porque o estado de ativação que a tornou atraente não está mais presente.</p>

<p>Urgência funciona porque cria uma <strong>janela temporal que encerra o ciclo de adiamento</strong>. Mas há uma diferença fundamental entre urgência sentida e urgência artificial: o cérebro tem um detector altamente calibrado para prazos que não têm consequência real. Se a oferta existe idêntica amanhã, o prazo de hoje não ativa nada — é ruído.</p>

<p>A urgência que converte é aquela em que algo genuinamente diferente acontece no prazo: um bônus sai, um preço muda, um acesso fecha. A justificativa precisa ser plausível — ligada a um custo real que o criador teria em manter aquelas condições além do prazo.</p>

<h3>B) Como Construir Urgência que Converte</h3>

<p><strong>1. Deadline Específico com Horário (Não Só Data)</strong><br/>
"Até sexta-feira" é vago. "Até sexta-feira às 23:59" é específico. A especificidade de horário comunica que há uma equipe, um sistema, um processo real que vai executar a mudança. Sem horário, o prazo parece editável.</p>

<p><strong>2. Consequência Concreta e Diferente (Não Só "Acaba")</strong><br/>
A urgência mais forte não diz que a oferta acaba — diz o que especificamente muda. "O bônus X sai do pacote" é mais ativador que "o preço sobe". Porque o preço pode mudar de volta, mas um bônus que sai é uma perda definitiva de algo específico que a pessoa já valorizou.</p>

<p><strong>3. Justificativa de Custo Real</strong><br/>
"Não é truque — é porque tenho uma equipe que custa caro e não consigo manter essas condições indefinidamente" dá ao prazo uma razão econômica plausível. Tira o deadline da categoria de estratégia de venda e coloca na categoria de realidade operacional.</p>

<div style="background:#0f172a;border:1px dashed #334155;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Interesse Presente mas Adiamento Natural] → (Deadline + Consequência Específica + Justificativa de Custo) → [Fim da Janela de Procrastinação] → [DECISÃO FORÇADA PARA AGORA]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"O preço de R$2.500 com os 3 bônus é válido até sexta-feira às 23:59. Sábado, o bônus de Strategy Call sai do pacote — permanentemente. O preço base não muda. Não estou criando urgência artificial: tenho um time que dedica 2 horas por aluno nessa call e o volume de sábado em diante inviabiliza manter esse acesso."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"até sexta-feira às 23:59"</strong> → Deadline com horário = processo real acontecerá naquele momento<br/>
<strong style="color:#6d4aff">"o bônus de Strategy Call sai — permanentemente"</strong> → Perda específica e definitiva, não vaga<br/>
<strong style="color:#6d4aff">"O preço base não muda"</strong> → Remove a esperança de que amanhã terá preço diferente<br/>
<strong style="color:#6d4aff">"Não estou criando urgência artificial"</strong> → Antecipa a objeção de ceticismo e a descarta antes que ela se forme<br/>
<strong style="color:#6d4aff">"2 horas por aluno... inviabiliza"</strong> → Custo operacional real = justificativa crível
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0 24px">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Usar urgência sem consequência real: <em>"Última chance! Oferta expira em breve!"</em> A vagueza do prazo sinaliza ao leitor que não há consequência real. O pior cenário: a pessoa aguarda para ver se o prazo é real, constata que não é, e agora não apenas deixou de comprar — perdeu a confiança no todo. Uma urgência que não se cumpre destrói qualquer prova social que você tenha construído antes.</p>
</div>

<h2>🤝 5. Reciprocidade: A Engenharia do Débito Emocional</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>A reciprocidade é o sistema de troca social que sustenta a cooperação humana há dezenas de milhares de anos. O cérebro registra cada recebimento de valor como uma <strong>dívida emocional não resolvida</strong>. Enquanto não retribui, o indivíduo carrega um estado de desequilíbrio que o sistema cognitivo quer resolver.</p>

<p>O que torna a reciprocidade poderosa no marketing não é o tamanho do que foi entregue — é a <strong>percepção de generosidade genuína</strong>. Se o conteúdo gratuito que você entregou tem valor real de mercado, o débito emocional é real. Se é conteúdo de isca sem substância, o cérebro detecta e não registra débito — registra manipulação.</p>

<p>A implicação direta: reciprocidade só funciona quando a entrega gratuita anterior é real. O gatilho não pode ser simulado. Você precisa ter genuinamente dado algo valioso antes de acioná-lo.</p>

<h3>B) Como Construir Reciprocidade Eficaz</h3>

<p><strong>1. Entrega com Valor Mensurável (O que você poderia cobrar)</strong><br/>
A reciprocidade é proporcional à percepção de valor entregue. "Nas últimas 3 semanas entreguei o framework completo gratuitamente" converte mais quando o receptor sabe que aquele framework tem um valor de mercado — porque alguém que pagaria R$500 por aquela informação e recebeu de graça sente um débito de R$500.</p>

<p><strong>2. Referência Específica ao que Foi Entregue</strong><br/>
"Tenho dado muito conteúdo" é vago e não ativa débito. "No vídeo de terça, entreguei o protocolo completo de otimização de criativos que meus clientes pagam R$3.000 para ter" é específico e ativa. A especificidade prova que a entrega foi real e intencional — não genérica.</p>

<p><strong>3. Pedido Explícito de Retribuição (com Framing Genuíno)</strong><br/>
A reciprocidade pode e deve ser explícita. "Se isso ajudou você, a melhor forma de retribuir é..." não é manipulação — é honestidade sobre o que você quer. O que torna isso legítimo é que o pedido vem depois de uma entrega real, não antes.</p>

<div style="background:#0f172a;border:1px dashed #334155;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Entrega Gratuita de Valor Real] → (Registro de Débito Emocional) → [Estado de Desequilíbrio Cognitivo] → (Pedido Explícito de Retribuição) → [RESOLUÇÃO VIA COMPRA]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"Nas últimas 3 semanas entreguei o framework completo de sequência de lançamento gratuitamente — o mesmo material que meus alunos pagam para aprender dentro do programa. Mais de 40 horas de produção. Se alguma parte disso ajudou você a tomar uma decisão melhor ou a ver o seu próximo lançamento de um ângulo diferente, a forma mais direta de retribuir é entrar e aplicar o método completo."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"o mesmo material que meus alunos pagam"</strong> → Ancora o valor de mercado do que foi dado gratuitamente<br/>
<strong style="color:#6d4aff">"Mais de 40 horas de produção"</strong> → Demonstra custo real — não foi descuido dar isso de graça<br/>
<strong style="color:#6d4aff">"Se alguma parte disso ajudou"</strong> → Pressuposto suave — assume que ajudou sem forçar concordância<br/>
<strong style="color:#6d4aff">"a forma mais direta"</strong> → Apresenta a compra como resolução natural do débito, não como venda
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0 24px">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Criar conteúdo de isca disfarçado de conteúdo real — onde o "gratuito" entrega apenas a superfície para forçar a necessidade de comprar o que está dentro. A audiência detecta rapidamente. O resultado é o inverso do débito: ressentimento. Você não cria a sensação de "recebi muito" — cria a sensação de "fui manipulado a querer algo que não foi realmente entregue".</p>
</div>

<h2>🏘️ 6. Comunidade: A Venda de Identidade e Pertencimento</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>Comunidade é o gatilho mais profundo porque não vende um produto — vende uma resposta à pergunta mais fundamental do ser humano: <em>quem sou eu e onde eu pertenço?</em> O cérebro humano consome cerca de 20% da energia total do corpo. Pertencer a um grupo reduz esse custo cognitivo de forma dramática: em vez de reconstruir o mundo do zero, o indivíduo adota o mapa de referência do grupo.</p>

<p>Quando você vende comunidade, não está vendendo acesso a pessoas — está vendendo uma <strong>identidade nova ou confirmada</strong>. "Sou do grupo dos X" é uma declaração de quem a pessoa quer ser, não apenas do que ela quer aprender. Isso explica por que alunos frequentemente citam a comunidade como o elemento mais valioso, mesmo quando o conteúdo é excelente: o conteúdo resolve um problema, mas a comunidade resolve a solidão de tentar resolver esse problema.</p>

<h3>B) Como Construir Comunidade como Gatilho de Venda</h3>

<p><strong>1. Definição da Identidade (Quem É o Membro)</strong><br/>
O grupo precisa ter uma definição clara de quem faz parte e quem não faz. "Empreendedores digitais sérios" é mais poderoso que "pessoas que querem aprender marketing" porque a seriedade é uma identidade — implica que quem está de fora não tem esse comprometimento.</p>

<p><strong>2. Acesso que Não Existe em Nenhum Lugar Público</strong><br/>
A comunidade precisa ser genuinamente fechada e genuinamente diferente do que está disponível gratuitamente. Se a conversa dentro é igual à conversa no Instagram público, não há gatilho. O que existe lá dentro que só existe lá dentro?</p>

<p><strong>3. Relato de Alunos sobre a Comunidade (Não Sobre o Conteúdo)</strong><br/>
Os depoimentos mais poderosos para comunidade não são sobre o que a pessoa aprendeu — são sobre como ela se sentiu ao entrar, com quem ela falou, como o grupo mudou sua perspectiva. "O que meus alunos relatam com mais frequência não é o método" é uma virada de expectativa que comunica autenticidade.</p>

<div style="background:#0f172a;border:1px dashed #334155;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Solidão do Empreendedor Individual] → (Identidade Definida + Acesso Exclusivo + Relatos de Pertencimento) → [Desejo de Integrar o Grupo] → (Compra como Entrada na Tribo) → [IDENTIDADE ADQUIRIDA]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"O que os alunos relatam com mais frequência não é o método — é o grupo. Um ambiente fechado com 487 pessoas que estão, cada uma, construindo um negócio digital com seriedade. Gente que não precisa explicar o básico, que entende o que é uma sequência de pré-lançamento, que debate otimização de criativos às 23h porque é quando sobra tempo. Esse nível de acesso não existe em nenhum lugar público."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"não é o método — é o grupo"</strong> → Inversão de expectativa que comunica autenticidade; ninguém diria isso se fosse marketing<br/>
<strong style="color:#6d4aff">"que não precisa explicar o básico"</strong> → Define a identidade do membro: avançado, sério, não iniciante<br/>
<strong style="color:#6d4aff">"debate otimização de criativos às 23h"</strong> → Detalhe específico que só alguém que conhece o grupo de dentro saberia<br/>
<strong style="color:#6d4aff">"não existe em nenhum lugar público"</strong> → Exclusividade que não pode ser replicada sem entrar
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Vender "acesso a uma comunidade" sem definir quem são as pessoas que estão lá. "Uma comunidade incrível de pessoas incríveis" não ativa pertencimento — ativa ceticismo. A pessoa precisa conseguir visualizar quem ela vai encontrar lá dentro. Se a definição for genérica, ela assume que é uma comunidade de iniciantes aleatórios, o que é o oposto do pertencimento de status que você quer ativar.</p>
</div>`
          },
          {
            id: "triggers-3",
            title: "Desejo: Antecipação, Transformação e Medo de Perda",
            duration: "40 min",
            type: "text",
            keyPoints: [
              "Antecipação gera dopamina antes da venda — o prazer da expectativa é neurologicamente mais forte que o prazer da posse",
              "Transformação vende a identidade futura, não o produto presente — o cliente não compra o curso, compra quem vai se tornar",
              "Medo de Perda (Kahneman): a perda pesa 2,5x mais que o ganho equivalente — mostrar o custo de NÃO comprar converte mais que mostrar o benefício de comprar"
            ],
            exercise: "Escreva dois parágrafos sobre o seu produto: no primeiro, descreva o que o aluno vai aprender (benefícios diretos). No segundo, descreva quem o aluno vai se tornar depois de 90 dias usando o método. Compare os dois em termos de apelo emocional. O segundo parágrafo é o gatilho de Transformação — use-o como abertura da sua página de vendas e o primeiro como detalhe de módulos.",
            content: `<h2>Engenharia Comportamental — Bloco 3: Desejo</h2>

<p>Este bloco opera na dimensão mais profunda do processo de compra: o <strong>desejo que antecede e supera a análise racional</strong>. Antecipação cria o estado de querer antes mesmo do produto estar disponível. Transformação conecta a compra à identidade que a pessoa quer habitar. Medo de Perda transforma a inação em custo percebido. Juntos, esses três gatilhos tornam a não-compra psicologicamente desconfortável.</p>

<h2>⚡ 7. Antecipação: A Engenharia do Prazer da Expectativa</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>Neurociência estabeleceu um fato contraintuitivo: o pico de dopamina não ocorre no momento da recompensa — ocorre <strong>no momento da antecipação da recompensa</strong>. O prazer de esperar algo que você quer é, em muitos casos, maior que o prazer de receber. Isso explica por que o período de pré-lançamento frequentemente gera mais engajamento que o lançamento em si: a audiência está no pico do ciclo de dopamina.</p>

<p>A implicação para o copy é poderosa: você pode criar desejo antes de ter o que vender. Um D-21 bem construído com antecipação gera uma audiência aquecida que já está comprometida emocionalmente quando o carrinho abre. Não porque viram a oferta — porque viveram o prazer da espera por ela.</p>

<p>O segundo efeito da antecipação é o <strong>investimento de atenção</strong>: quando alguém investe tempo acompanhando um pré-lançamento, o viés de consistência os motiva a completar a jornada com a compra. Sair antes de comprar seria admitir que o tempo investido foi desperdiçado.</p>

<h3>B) Como Construir Antecipação Eficaz</h3>

<p><strong>1. Revelação Parcial com Loop Aberto</strong><br/>
A antecipação vive do loop aberto — a informação que foi suficientemente revelada para criar curiosidade mas insuficientemente revelada para satisfazê-la. "Em 3 dias abre. Tem um bônus que não está em nenhum material de divulgação" abre um loop que o cérebro vai querer fechar. O leitor vai voltar.</p>

<p><strong>2. Contagem Regressiva com Marcos</strong><br/>
Cada marco da contagem regressiva (D-7, D-3, D-1) deve entregar algo novo e real — um trecho do material, um depoimento, uma revelação sobre o que está por vir. A antecipação se constrói em camadas, não em um único anúncio.</p>

<p><strong>3. O Segredo Protegido</strong><br/>
O elemento mais poderoso de antecipação é algo que genuinamente só será revelado no momento da abertura. "Você vai entender por que guarda quando ver" cria um mistério que o leitor não pode resolver sem entrar. Funciona apenas quando o segredo é real e, de fato, vale a pena.</p>

<div style="background:#0f172a;border:1px dashed #334155;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Audiência Neutra] → (Loop Aberto + Revelação Parcial + Investimento de Atenção) → [Pico de Dopamina da Antecipação] → (Abertura do Carrinho) → [AUDIÊNCIA COMPRADA EMOCIONALMENTE ANTES DA OFERTA]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance — D-3</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"Em 72 horas abre. Posso adiantar que tem um bônus que não está em nenhum material de divulgação — de propósito. Não é uma surpresa genérica: é algo que vai mudar como você estrutura os próximos lançamentos, independente de entrar ou não. Você vai entender por que guardei quando ver. Confirma seu email no link abaixo para receber primeiro."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"72 horas"</strong> → Mais específico que "3 dias" — implica precisão de quem está acompanhando<br/>
<strong style="color:#6d4aff">"de propósito"</strong> → Intencionalidade: o segredo não é esquecimento, é decisão estratégica<br/>
<strong style="color:#6d4aff">"independente de entrar ou não"</strong> → Remove o frame de venda — cria generosidade percebida e aumenta a credibilidade<br/>
<strong style="color:#6d4aff">"por que guardei"</strong> → Reforça que há um motivo para o segredo — não é vazio<br/>
<strong style="color:#6d4aff">"Confirma seu email para receber primeiro"</strong> → Micro-compromisso que aumenta probabilidade de compra
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0 24px">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Construir antecipação sem entregar o prometido. Se você criou expectativa para um bônus "que vai mudar tudo" e ele se revela como um PDF genérico, o colapso emocional é proporcional à antecipação criada. A audiência não apenas se decepciona com o bônus — revisita mentalmente tudo que você disse antes e reclassifica como exagero. A antecipação amplifica tanto o prazer quanto a decepção.</p>
</div>

<h2>🔄 8. Transformação: Vendendo a Identidade Futura</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>Ninguém compra um produto — compra a versão de si mesmo que esse produto promete criar. O cérebro não avalia a oferta perguntando "o que eu vou aprender?" — ele pergunta "quem eu vou me tornar?". A distância entre quem a pessoa é hoje e quem ela quer ser é o espaço onde a decisão de compra acontece.</p>

<p>Transformação é o gatilho que torna essa distância visível, desejável e aparentemente acessível. Ele opera pelo princípio da <strong>identidade projetada</strong>: ao descrever com precisão quem o comprador vai se tornar, você faz o cérebro simular essa realidade — e uma realidade simulada com suficiente nitidez gera o mesmo estado emocional que a realidade real. Nesse estado, a decisão de compra parece menos um gasto e mais um investimento em algo já começado.</p>

<h3>B) Como Construir o Gatilho de Transformação</h3>

<p><strong>1. Descreva a Identidade Futura, Não o Conteúdo</strong><br/>
"Você vai aprender sequências de email" descreve conteúdo. "Você vai se tornar o tipo de profissional que sabe exatamente o que enviar para cada segmento de audiência em cada fase do lançamento — e o resultado é previsível" descreve identidade. A segunda frase vende.</p>

<p><strong>2. Contraste Identidade Atual vs. Identidade Futura</strong><br/>
A transformação se materializa quando você torna visível de onde a pessoa parte e para onde vai. "Hoje você passa semanas planejando um lançamento e não tem certeza se vai funcionar. Depois de 90 dias com o método, você entra em cada lançamento com um protocolo validado e uma expectativa de resultado baseada em dados — não em esperança."</p>

<p><strong>3. A Transformação Não é o Curso — é o Tipo de Pessoa</strong><br/>
O frame mais poderoso é separar o produto da identidade: "Isso não é um curso sobre como fazer um lançamento — é sobre se tornar o tipo de pessoa que consegue gerar receita digital de forma consistente, independente de pico sazonal."</p>

<div style="background:#0f172a;border:1px dashed #334155;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Identidade Atual com Dor Presente] → (Descrição Nítida da Identidade Futura) → [Simulação Mental do Novo Self] → (Estado Emocional da Identidade Futura Sentida como Real) → [COMPRA COMO CONFIRMAÇÃO DE QUEM JÁ ESTOU ME TORNANDO]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"Este não é um programa sobre como fazer um lançamento. É sobre se tornar o tipo de profissional que sabe exatamente o que acontece em cada dia dos 21 dias anteriores à abertura — e por quê. Que entra num lançamento com uma expectativa de resultado baseada em dados históricos, não em esperança. Que não depende de um único pico anual para gerar receita. Esse é o perfil que sai daqui."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"Não é um programa sobre como fazer"</strong> → Rejeita a categoria produto e eleva para categoria identidade<br/>
<strong style="color:#6d4aff">"sabe exatamente o que acontece em cada dia"</strong> → Nitidez da competência futura — o leitor consegue visualizar<br/>
<strong style="color:#6d4aff">"baseada em dados históricos, não em esperança"</strong> → Contraste entre o estado atual (esperança) e o futuro (certeza)<br/>
<strong style="color:#6d4aff">"Esse é o perfil que sai daqui"</strong> → Declaração de identidade específica — não "você vai aprender", mas "você vai ser"
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0 24px">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Prometer uma transformação que não é crível dada a evidência que você apresentou. Se sua prova social mostra apenas casos excepcionais (o aluno que faturou R$10M no primeiro lançamento) e sua promessa de transformação é para o resultado mediano, há uma dissonância que o cérebro detecta. A transformação precisa ser crível para o comprador típico — não para o caso mais extremo.</p>
</div>

<h2>😰 9. Medo de Perda (FOMO): A Assimetria da Perda e do Ganho</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>Daniel Kahneman e Amos Tversky demonstraram empiricamente: <strong>a perda pesa aproximadamente 2,5 vezes mais que o ganho equivalente</strong>. Perder R$100 é sentido com muito mais intensidade que ganhar R$100. Isso não é irracionalidade — é o sistema de sobrevivência calibrado para evitar perdas (que eram potencialmente fatais) mais do que perseguir ganhos.</p>

<p>A implicação para copywriting é profunda: mostrar o que a pessoa perde por não comprar converte mais que mostrar o que ela ganha ao comprar. A dor de não agir precisa ser tornada visível, específica e calculável. Não "você vai perder uma oportunidade" — mas "enquanto você avalia, o mercado está sendo ocupado por quem já decidiu".</p>

<p>O FOMO mais poderoso não é sobre o produto que não foi comprado — é sobre a <strong>posição competitiva que foi perdida</strong> para outros que agiram. Status relativo ao grupo de referência pesa mais que ganho absoluto.</p>

<h3>B) Como Construir Medo de Perda Eficaz</h3>

<p><strong>1. Torne a Perda Concreta e Temporalmente Específica</strong><br/>
"Em 18 meses, o custo de adquirir um lead nesse nicho vai ser 40% mais alto" é mais ativador que "o mercado está crescendo e vai ficar mais competitivo". O futuro específico com número faz o cérebro simular a perda como se já estivesse acontecendo.</p>

<p><strong>2. Mostre o Custo da Inação (Não da Não-Compra)</strong><br/>
Enquanto você avalia, o tempo passa. Audiência que poderia ser sua está sendo conquistada por outros. Posicionamento que poderia ser ocupado está sendo estabelecido por concorrentes. O FOMO mais eficaz fala sobre o que acontece enquanto a pessoa adia — não sobre o que ela perde por não comprar especificamente.</p>

<p><strong>3. Use Números de Mercado, Não Estimativas Pessoais</strong><br/>
"O mercado de produtos digitais no Brasil cresce 40% ao ano" é um dado externo verificável — não uma afirmação sua. Dados externos têm autoridade independente da sua credibilidade. Use-os como base para o custo de oportunidade.</p>

<div style="background:#0f172a;border:1px dashed #334155;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Consideração Neutra da Oferta] → (Perda Concreta Tornada Visível + Custo da Inação + Posição Competitiva em Risco) → [Ativação do Sistema de Aversão à Perda] → (Perda Sente 2.5x Mais que Ganho) → [DECISÃO ACELERADA PARA PRESERVAR POSIÇÃO]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"Enquanto você avalia, outros estão acessando a mesma audiência que você quer acessar. O mercado de produtos digitais no Brasil cresce 40% ao ano — o que significa que cada mês de atraso na entrada qualificada é um mês de vantagem concedida a quem entrou antes. Em 18 meses, o CPL médio nesse segmento vai ser 60% mais alto. A vantagem de pioneiro desaparece conforme o nicho satura. A janela é agora — não no próximo lançamento."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"Enquanto você avalia"</strong> → O tempo de análise já tem custo — a inação é cara<br/>
<strong style="color:#6d4aff">"outros estão acessando a mesma audiência"</strong> → Perda relativa de posição, não só perda de benefício<br/>
<strong style="color:#6d4aff">"40% ao ano" / "60% mais alto"</strong> → Dados de mercado que o leitor não pode contestar como "sua opinião"<br/>
<strong style="color:#6d4aff">"vantagem de pioneiro desaparece"</strong> → A janela é temporária e a perda é definitiva<br/>
<strong style="color:#6d4aff">"A janela é agora — não no próximo lançamento"</strong> → Fecha o loop de procrastinação com certeza, não com pressão
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Usar FOMO abstrato sem ancoragem específica: <em>"O mercado está mudando e quem não acompanhar vai ficar para trás."</em> Isso não ativa o sistema de aversão à perda — ativa o sistema de ceticismo, porque a ameaça não é concreta o suficiente para ser sentida. FOMO precisa de números, prazos e perdas específicas para funcionar. Vago é invisível.</p>
</div>`
          },
          {
            id: "triggers-4",
            title: "Ação: Curiosidade, Evento, Contraste + Mapa de Uso",
            duration: "40 min",
            type: "text",
            keyPoints: [
              "Curiosidade cria tensão cognitiva que só se resolve com ação — o cérebro é programado para fechar loops abertos",
              "Evento transforma o lançamento de 'produto à venda' para 'acontecimento com janela única' — muda a categoria mental",
              "Contraste funciona pela âncora de referência: qualquer preço parece razoável quando comparado ao custo da alternativa real"
            ],
            exercise: "Escolha um elemento do seu lançamento (bônus, live, sessão de Q&A) e reescreva sua descrição usando o frame de Evento em vez de feature: adicione data e horário específico, o que só acontece nesse momento, e o que a pessoa perde se não estiver presente. Compare com a versão original. O delta de urgência que você vai sentir na leitura é exatamente o que sua audiência vai sentir.",
            content: `<h2>Engenharia Comportamental — Bloco 4: Ação</h2>

<p>Este é o bloco que fecha a jornada: após construir credibilidade, relacionamento e desejo, esses três gatilhos finais <strong>precipitam a decisão</strong>. Curiosidade cria a tensão que a ação resolve. Evento transforma o lançamento em acontecimento único. Contraste faz o preço parecer pequeno diante da âncora certa. Ao final deste bloco, o mapa completo de uso dos 12 gatilhos por fase de lançamento.</p>

<h2>🔍 10. Curiosidade: A Engenharia da Tensão Cognitiva</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>George Loewenstein, economista comportamental de Carnegie Mellon, identificou o mecanismo da curiosidade como um estado de <strong>tensão cognitiva gerada por lacunas de informação percebidas</strong>. Quando o cérebro detecta que existe uma informação que ele não tem — e que essa informação é relevante — ele entra em estado de desconforto que só se resolve com o preenchimento da lacuna.</p>

<p>A consequência prática: o cérebro humano é literalmente incapaz de deixar um loop aberto sem tentar fechá-lo. Isso explica o poder do cliffhanger, da pergunta sem resposta, do "mas há um detalhe que a maioria não vê". A curiosidade não é uma técnica de vendas — é um exploit de um mecanismo cognitivo fundamental.</p>

<p>O que diferencia curiosidade que converte de curiosidade vazia: a promessa precisa ser específica o suficiente para criar a tensão, mas incompleta o suficiente para não resolver sozinha. "Tem uma coisa" não ativa nada. "Tem uma configuração de campanha que 98% dos gestores nunca usam — e que triplicou o ROAS" ativa, porque a lacuna é específica e a resolução promete resultado concreto.</p>

<h3>B) Como Construir Curiosidade Eficaz</h3>

<p><strong>1. Invalide as Respostas Óbvias Primeiro</strong><br/>
"Não é tráfego, não é lista, não é copy — é isso aqui" é mais poderoso que simplesmente revelar o que é. Ao invalidar as respostas que a audiência já tinha, você prova que a lacuna é real: o leitor não sabia que não sabia.</p>

<p><strong>2. Quantifique a Especificidade da Lacuna</strong><br/>
"98% dos gestores nunca usam" comunica que existe um grupo minoritário que tem acesso a algo que a maioria não tem. Isso transforma a curiosidade em curiosidade de status: não só "quero saber o que é" mas "quero estar no grupo que sabe".</p>

<p><strong>3. Conecte a Resolução a um Resultado Concreto</strong><br/>
A lacuna de informação precisa ter uma consequência mensurável para ativar o sistema de recompensa junto com a curiosidade. "Triplicou o ROAS" transforma a informação desconhecida em algo que vale o esforço de descobrir.</p>

<div style="background:#0f172a;border:1px dashed #334155;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Estado Informado mas Incompleto] → (Lacuna Específica Tornada Visível + Invalidação das Respostas Óbvias) → [Tensão Cognitiva Insuportável] → (Única Resolução: Continuar/Comprar) → [AÇÃO COMO ALÍVIO DA TENSÃO]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"Tem uma configuração de campanha que 98% dos gestores de tráfego nunca usam. Não é nova — foi esquecida porque parece contraintuitiva quando você a vê pela primeira vez. Nos dois lançamentos que acompanhei esse ano onde apliquei, o ROAS triplicou em comparação com o período anterior ao ajuste. Não vou deixar aqui porque o contexto importa — explico com a estrutura completa no Módulo 5."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"98% dos gestores nunca usam"</strong> → Posiciona o leitor potencialmente no grupo minoritário privilegiado<br/>
<strong style="color:#6d4aff">"foi esquecida porque parece contraintuitiva"</strong> → Valida por que a lacuna existe — não é obscura, é contra-senso<br/>
<strong style="color:#6d4aff">"ROAS triplicou em comparação com período anterior"</strong> → Resultado específico e verificável — não "melhorou muito"<br/>
<strong style="color:#6d4aff">"o contexto importa"</strong> → Justifica por que não revela — e cria ainda mais desejo de saber o contexto<br/>
<strong style="color:#6d4aff">"explico no Módulo 5"</strong> → Converte curiosidade em motivação de progressão (ou compra)
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0 24px">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Criar loops que nunca fecham ou que fecham com decepção. Se o "segredo" revelado no Módulo 5 é uma informação genérica disponível em qualquer artigo de blog, o leitor não apenas se decepciona — reconsidera toda a sua credibilidade. Curiosidade que não cumpre a promessa é pior que não criar curiosidade: é uma promessa quebrada com o nível de expectativa elevado.</p>
</div>

<h2>🎪 11. Evento: A Transformação do Lançamento em Acontecimento</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>O cérebro humano processa "produto disponível para compra" e "acontecimento único que vai acontecer em um momento específico" em categorias mentais completamente diferentes. O produto pode ser comprado depois. O acontecimento não — ele ocorre uma vez, em um janela específica, e quem não estiver lá perde algo irrecuperável.</p>

<p>O gatilho de Evento transforma o frame mental do lançamento: você não está vendendo acesso permanente a um produto — você está convidando a audiência a <strong>participar de um acontecimento que vai moldar o que acontece depois</strong>. As pessoas que estiverem na live de abertura vão ter acesso a algo que os que compraram depois não terão. Quem estiver no Q&A ao vivo vai poder fazer a pergunta que molda sua estratégia específica.</p>

<p>A consequência é que o lançamento deixa de ser avaliado pela pergunta "eu preciso disso?" e passa a ser avaliado por "posso perder esse momento?".</p>

<h3>B) Como Construir o Frame de Evento</h3>

<p><strong>1. Data e Horário Específicos são Obrigatórios</strong><br/>
Sem data e horário, não há evento — há uma intenção vaga. "Live de abertura no dia 15 às 20h" cria um acontecimento com coordenadas temporais que o cérebro pode marcar e antecipar.</p>

<p><strong>2. O Que Só Existe Naquele Momento</strong><br/>
Cada evento precisa de um elemento genuinamente exclusivo: uma sessão de Q&A ao vivo, um bônus dado apenas para quem comprar durante a live, um conteúdo que não será gravado. Se tudo que acontece no evento estará disponível depois, não é evento — é aula com data marcada.</p>

<p><strong>3. O Risco de Não Estar Presente</strong><br/>
Implique a perda de quem não participar: "quem comprar durante a live ganha X que normalmente não está no pacote" cria o risco de estar ausente como custo real e específico.</p>

<div style="background:#0f172a;border:1px dashed #334155;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Frame de Produto Avaliável] → (Data + Horário + Exclusivo do Momento + Custo de Ausência) → [Frame de Acontecimento Único] → (Pergunta Muda de "Preciso?" para "Posso Perder?") → [PRESENÇA COMO NECESSIDADE]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"No dia 15 às 20h tem a live de abertura — ao vivo, sem gravação liberada depois. Vamos entrar na plataforma juntos, eu mostro o que você faz nas primeiras 48 horas, e quem comprar durante a live ganha uma sessão individual de Strategy Call que normalmente não está no pacote — e que não será oferecida depois. Confirma presença no link abaixo."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"ao vivo, sem gravação liberada depois"</strong> → Cria irrecuperabilidade — o único acesso é estar presente<br/>
<strong style="color:#6d4aff">"vamos entrar na plataforma juntos"</strong> → Coloca a audiência como participante ativa, não espectadora<br/>
<strong style="color:#6d4aff">"primeiras 48 horas"</strong> → Específico — não "como começar" mas o protocolo exato das horas iniciais<br/>
<strong style="color:#6d4aff">"que não será oferecida depois"</strong> → Exclusividade do momento é real e declarada explicitamente<br/>
<strong style="color:#6d4aff">"Confirma presença"</strong> → Micro-compromisso que aumenta comparecimento e probabilidade de compra
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0 24px">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Criar evento sem elemento genuinamente exclusivo. Se a gravação da live é liberada depois com todos os bônus intactos, você não criou um evento — apenas gerou trabalho extra para quem foi ao vivo sem recompensa adicional. E pior: quem foi ao vivo percebe que a exclusividade era falsa e não aparece no próximo evento. O frame de evento exige que o que acontece no momento seja genuinamente irrecuperável.</p>
</div>

<h2>⚖️ 12. Contraste: A Engenharia da Âncora de Valor</h2>

<h3>A) O Mecanismo Psicológico Profundo</h3>

<p>O cérebro humano não avalia valor em termos absolutos — avalia em termos relativos. Qualquer número parece grande ou pequeno dependendo do referencial com que é comparado. R$2.500 é muito ou pouco? Depende do que você usa como âncora.</p>

<p>O efeito de contraste foi documentado por Kahneman e Tversky como um dos princípios mais robustos da cognição humana: a percepção de qualquer estímulo é moldada pelos estímulos precedentes. Um preço sempre será avaliado em comparação com outro número que apareceu antes. Quem controla a âncora, controla a percepção de valor.</p>

<p>O erro mais comum: usar uma âncora de preço que não é relevante para o problema real. Comparar R$2.500 com "horas de consultoria" é razoável. Mas a âncora mais poderosa não é o custo da alternativa — é o <strong>custo do problema não resolvido</strong>: quanto custa fazer um lançamento mal-feito? Quanto custa outro mês sem resultado?</p>

<h3>B) Como Construir Contraste Eficaz</h3>

<p><strong>1. A Âncora Mais Alta Vem Primeiro</strong><br/>
Apresente o referencial de valor antes de revelar o preço. "Uma consultoria de 2h com um especialista sênior custa R$800-1.200" estabelece a régua antes de você revelar o que cobra. Depois que a régua está no lugar, qualquer número abaixo dela parece razoável.</p>

<p><strong>2. Use o Custo do Problema, Não Só o Custo da Alternativa</strong><br/>
"Um lançamento mal-feito com R$10.000 em tráfego que converte 0,3%" é uma âncora mais poderosa que qualquer consultoria, porque é o custo real de não resolver o problema. O leitor já viveu isso ou consegue imaginar vividamente — e o número é aterrorizante.</p>

<p><strong>3. Múltiplas Âncoras Criam Contexto de Valor</strong><br/>
Duas ou três perspectivas de contraste (custo da alternativa + custo do problema + custo do tempo perdido) criam um contexto de valor que o preço real atravessa facilmente. Cada âncora adicional diminui a resistência ao preço principal.</p>

<div style="background:#0f172a;border:1px dashed #334155;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:12px;color:#64748b;line-height:1.8">
[Preço sem Contexto = Grande ou Pequeno?] → (Âncora Alta Apresentada Primeiro) → [Régua de Referência Estabelecida] → (Preço Real Apresentado Abaixo da Âncora) → [Preço Percebido como Razoável ou Barato]
</div>

<h3>C) Anatomia de Ativação — O Copy em Ação</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0 6px">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">Copy de Alta Performance</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.7">"Uma consultoria individual de 2h com um especialista de lançamentos sênior custa R$800 a R$1.200. Este programa tem o equivalente a 20 horas de consultoria estruturada — por R$2.500. Mas a comparação que realmente importa não é essa. É o custo de um lançamento mal executado: R$15.000 em tráfego, 3 meses de produção de conteúdo, equipe mobilizada — e 0,3% de conversão. Esse número, quem já viveu, nunca esquece."</p>
</div>
<div style="background:#0f172a;border:1px dashed #334155;border-radius:0 0 8px 8px;padding:10px 16px;margin:0 0 16px">
<p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
<strong style="color:#6d4aff">"R$800 a R$1.200"</strong> → Âncora inicial — estabelece a régua de valor do mercado<br/>
<strong style="color:#6d4aff">"equivalente a 20 horas"</strong> → Traduz o programa em unidade de valor que o leitor já conhece<br/>
<strong style="color:#6d4aff">"a comparação que realmente importa não é essa"</strong> → Move para uma âncora ainda mais poderosa — o custo do problema<br/>
<strong style="color:#6d4aff">"quem já viveu, nunca esquece"</strong> → Ativa memória emocional — quem passou por isso sente isso no corpo
</p>
</div>

<div style="background:#1c0a0a;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0 24px">
<p style="color:#fca5a5;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 4px">❌ O Erro Fatal de Posicionamento</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">Usar âncoras que a audiência não consegue validar ou com as quais não se identifica. Se você compara seu produto com um serviço que sua audiência nunca contrataria ou sequer considera, a âncora não funciona — ela parece fabricada. A âncora precisa ser um referencial real que o leitor reconhece como válido para o contexto dele.</p>
</div>

<h2>🗺️ Mapa Estratégico: Qual Gatilho em Qual Fase do Lançamento</h2>

<p>Os 12 gatilhos não operam de forma isolada — cada fase do lançamento tem um perfil psicológico específico da audiência, e o gatilho certo no momento errado não apenas não funciona: pode inverter o efeito desejado. Este mapa mapeia a cadência estratégica.</p>

<div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px 18px;margin:16px 0">
<p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">Lógica do mapa</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.6">PPL (D-21 a D-14) = audiência fria, construção de autoridade e curiosidade. Pré-Lançamento (D-14 a D-1) = audiência morna, aquecimento e antecipação. Abertura (D+0) = audiência quente, transformação e evento. Fechamento (últimas 48h) = audiência decidida mas adiando, FOMO e escassez real.</p>
</div>

<table>
  <thead>
    <tr><th>Gatilho</th><th>PPL (D-21 a D-14)</th><th>Pré-Lançamento (D-14 a D-1)</th><th>Abertura (D+0)</th><th>Fechamento</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>Autoridade</strong></td><td>✅ Principal</td><td>✅</td><td>✅</td><td>—</td></tr>
    <tr><td><strong>Reciprocidade</strong></td><td>✅ Principal</td><td>✅</td><td>—</td><td>—</td></tr>
    <tr><td><strong>Curiosidade</strong></td><td>✅ Principal</td><td>✅ Principal</td><td>—</td><td>—</td></tr>
    <tr><td><strong>Antecipação</strong></td><td>✅</td><td>✅ Principal</td><td>—</td><td>—</td></tr>
    <tr><td><strong>Prova Social</strong></td><td>—</td><td>✅ Principal</td><td>✅</td><td>✅</td></tr>
    <tr><td><strong>Evento</strong></td><td>—</td><td>✅</td><td>✅ Principal</td><td>—</td></tr>
    <tr><td><strong>Transformação</strong></td><td>—</td><td>✅</td><td>✅ Principal</td><td>✅</td></tr>
    <tr><td><strong>Contraste</strong></td><td>—</td><td>—</td><td>✅ Principal</td><td>✅</td></tr>
    <tr><td><strong>Comunidade</strong></td><td>—</td><td>—</td><td>✅ Principal</td><td>✅</td></tr>
    <tr><td><strong>Escassez</strong></td><td>—</td><td>—</td><td>✅</td><td>✅ Principal</td></tr>
    <tr><td><strong>Urgência</strong></td><td>—</td><td>—</td><td>✅</td><td>✅ Principal</td></tr>
    <tr><td><strong>Medo de Perda</strong></td><td>—</td><td>—</td><td>—</td><td>✅ Principal</td></tr>
  </tbody>
</table>

<div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px 18px;margin:20px 0 8px">
<p style="color:#6d4aff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px">Princípio de uso combinado</p>
<p style="color:#e2e8f0;font-size:13px;margin:0;line-height:1.7">Nenhum lançamento de alta conversão usa um gatilho de cada vez. A sequência clássica que funciona: <strong>Autoridade + Reciprocidade + Curiosidade</strong> no PPL constroem o crédito que vai ser resgatado depois. <strong>Prova Social + Antecipação</strong> no pré-lançamento aquecem a audiência. <strong>Transformação + Evento + Contraste</strong> na abertura fecham quem estava pronto. <strong>Escassez + Urgência + FOMO</strong> no fechamento convertem quem estava adiando. Esse é o arco completo.</p>
</div>`
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
            keyPoints: ["AIDA, PAS e PASTOR aplicados com exemplos reais — não só a teoria", "8 fórmulas de headline com variações prontas para cada nicho", "O exercício de reescrita que treina o olho para copy que converte"],
            exercise: "Pegue um post ou email que você escreveu recentemente. Identifique qual fórmula (AIDA, PAS ou PASTOR) ele usa — ou se não usa nenhuma. Reescreva o mesmo conteúdo usando PAS. Compare os dois: qual tem mais urgência? Qual faz a dor parecer mais real? Esse exercício, feito 30 vezes, forma o olho de copywriter.",
            content: `<h2>Copy Perfeito: As Fórmulas com Exemplos Reais</h2>

<p>Fórmulas de copy não são receitas que você segue cegamente — são esqueletos sobre os quais você coloca sua voz, seus dados e suas histórias. Mas sem o esqueleto, o copy desmorona.</p>

<h2>Fórmula 1 — AIDA: O Clássico Que Ainda Domina</h2>

<p><strong>Use quando:</strong> post de redes sociais, email, anúncio, qualquer copy que precisa capturar e conduzir em sequência</p>

<table>
  <thead>
    <tr><th>Letra</th><th>Função</th><th>Pergunta que responde</th></tr>
  </thead>
  <tbody>
    <tr><td>A — Atenção</td><td>Parar o scroll / abrir o email</td><td>"Por que devo prestar atenção?"</td></tr>
    <tr><td>I — Interesse</td><td>Manter lendo</td><td>"Isso é relevante para mim?"</td></tr>
    <tr><td>D — Desejo</td><td>Criar querer</td><td>"Eu quero esse resultado?"</td></tr>
    <tr><td>A — Ação</td><td>Converter</td><td>"O que eu faço agora?"</td></tr>
  </tbody>
</table>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">AIDA APLICADO — EMAIL DE LANÇAMENTO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>[A] Atenção — Assunto do email:</strong><br/>
"O lançamento que ninguém acreditou que funcionaria (e os números)"<br/><br/>

<strong>[I] Interesse — Abertura:</strong><br/>
"Em março eu anunciei que faria um lançamento com uma lista de 900 pessoas e orçamento de R$3.000 em anúncios. A maioria das pessoas me disse que era ambição demais. Resultado final: R$214.000 em 6 dias."<br/><br/>

<strong>[D] Desejo — Corpo:</strong><br/>
"O que fez diferença não foi verba, não foi lista grande, não foi afiliado. Foi a sequência de pré-aquecimento que fiz nos 21 dias antes. Cada step está documentado no [produto]. Qualquer pessoa com uma audiência de nicho pode replicar."<br/><br/>

<strong>[A] Ação — CTA:</strong><br/>
"→ O [produto] abre amanhã às 8h. Você está na lista VIP — então tem acesso antes de todo mundo e com o bônus exclusivo de fundador."
</p>
</div>

<h2>Fórmula 2 — PAS: Para Produtos de Solução de Dor</h2>

<p><strong>Use quando:</strong> a audiência já tem consciência do problema mas não da solução. Funciona muito bem para produtos que resolvem uma frustração crônica.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">PAS APLICADO — LEGENDA DE FEED</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>[P] Problema:</strong><br/>
"Você passa meses construindo audiência, cria um produto excelente, investe em tráfego pago — e no dia de abertura vende 8 unidades."<br/><br/>

<strong>[A] Agitação:</strong><br/>
"O pior não é a receita baixa. É perceber que você não tem como saber onde errou. Foi o produto? O tráfego? O copy da página? A sequência de email? Sem dados, você vai repetir o mesmo lançamento e ter o mesmo resultado."<br/><br/>

<strong>[S] Solução:</strong><br/>
"O [produto] mapeia exatamente onde o funil quebrou — e entrega o protocolo de correção por fase. Não genérico: específico para o que aconteceu no seu lançamento."
</p>
</div>

<p><strong>Por que a Agitação é a parte mais importante do PAS:</strong> a maioria das pessoas vai direto da dor para a solução. Mas sem ampliar as consequências da dor, a pessoa não sente urgência suficiente para agir. A agitação é o que faz a solução parecer necessária, não apenas desejável.</p>

<h2>Fórmula 3 — PASTOR: Para Copy Longo</h2>

<p><strong>Use quando:</strong> página de vendas, VSL, email longo, apresentação de produto de alto ticket (R$2k+)</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">PASTOR APLICADO — ESTRUTURA DE PÁGINA DE VENDAS</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>[P] Problema:</strong> "Para quem tenta lançar um produto digital pela primeira vez..."<br/><br/>
<strong>[A] Amplify:</strong> "O custo de um lançamento mal executado não é só a receita perdida — é o tempo desperdiçado, a audiência que esfria e a confiança que você perde em si mesmo."<br/><br/>
<strong>[S] Story:</strong> "Três anos atrás eu estava exatamente nesse lugar. Tinha feito tudo certo 'no papel' — e vendido 4 unidades. Foi quando entendi o que estava faltando..."<br/><br/>
<strong>[T] Transformation:</strong> "Hoje, o mesmo método gerou mais de R$2,4M em lançamentos para mim e para meus alunos. A diferença não foi mais esforço — foi uma sequência diferente."<br/><br/>
<strong>[O] Offer:</strong> "O [produto] é o método completo, documentado, passo a passo. [Detalhes do que está incluído]."<br/><br/>
<strong>[R] Response:</strong> "Clique abaixo. Abre só até [data]."
</p>
</div>

<h2>8 Fórmulas de Headline — Com Exemplos Prontos</h2>

<table>
  <thead>
    <tr><th>Fórmula</th><th>Estrutura</th><th>Exemplo aplicado</th></tr>
  </thead>
  <tbody>
    <tr><td>Como + Sem</td><td>"Como [resultado] sem [objeção]"</td><td>"Como lançar R$100k sem lista de email"</td></tr>
    <tr><td>Número + Resultado</td><td>"[N] [adjetivo] formas de [resultado] em [tempo]"</td><td>"7 ajustes que triplicaram o ROAS em 48h"</td></tr>
    <tr><td>Controvérsia + Prova</td><td>"Por que [crença] está errado — e os dados que provam"</td><td>"Por que postar todo dia prejudica lançamentos — e os dados que provam"</td></tr>
    <tr><td>Resultado Chocante</td><td>"[Número específico] em [tempo surpreendente]"</td><td>"R$847k em 6 dias com uma lista de 2.300 pessoas"</td></tr>
    <tr><td>Condição + Alerta</td><td>"Se você [condição], leia isso antes de [ação]"</td><td>"Se você vai abrir seu primeiro carrinho, leia isso antes"</td></tr>
    <tr><td>Erro + Custo</td><td>"O erro de [contexto] que custa [custo real]"</td><td>"O erro de configuração de pixel que custou R$40k em leads desperdiçados"</td></tr>
    <tr><td>Segredo Revelado</td><td>"O que [referência de autoridade] faz que ninguém ensina"</td><td>"O que os maiores lançamentos do Brasil fazem na semana antes de abrir"</td></tr>
    <tr><td>Pergunta de Dor</td><td>"[Situação dolorosa específica]?"</td><td>"Sua campanha gasta R$200/dia e não gera uma venda sequer?"</td></tr>
  </tbody>
</table>

<h2>O Teste do "E daí?" — Para Fortalecer Qualquer Copy</h2>

<p>Depois de escrever qualquer afirmação de benefício, pergunte "e daí?" até não ter mais resposta. Cada nível revela um benefício mais profundo — e mais persuasivo.</p>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">EXEMPLO — TESTE DO "E DAÍ?"</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
"Você vai aprender a configurar campanhas de Meta Ads."<br/>
E daí? → "Você vai gerar leads mais baratos."<br/>
E daí? → "Você vai ter mais verba disponível para escalar."<br/>
E daí? → "Você vai poder faturar mais sem aumentar o orçamento."<br/>
E daí? → "Você vai ter previsibilidade de receita que não depende de um único lançamento anual."<br/><br/>
<strong>O copy correto usa a última resposta — não a primeira.</strong> Não venda "configurar campanhas" — venda "previsibilidade de receita".
</p>
</div>`
          },
          {
            id: "copy-2",
            title: "VSL: Roteiro Completo Pronto para Adaptar",
            duration: "35 min",
            type: "text",
            keyPoints: ["Os primeiros 5 minutos de VSL escritos — adapte ao seu produto", "A transição exata do conteúdo para o pitch sem parecer forçado", "Erros que fazem visitantes abandonar antes da oferta"],
            exercise: "Use o roteiro desta aula para escrever os primeiros 3 minutos da sua VSL. Não grave ainda — só escreva. Leia em voz alta e cronometre. Se demorar mais de 3:30 para chegar na 'promessa de resultado', corte. O visitante não espera. Grave o hook (primeiros 30s) e assista. Você scrollaria?",
            content: `<h2>VSL: O Roteiro Que Converte de 3% a 15% dos Visitantes</h2>

<p>Uma VSL (Video Sales Letter) é o elemento mais importante de qualquer funil de produto digital acima de R$800. A diferença entre uma VSL que converte e uma que não converte não é produção — é roteiro.</p>

<p>Esta aula entrega o roteiro completo com o copy real dos primeiros 5 minutos — a parte mais crítica — e a estrutura para os próximos 35-55 minutos.</p>

<h2>Os Primeiros 5 Minutos: Roteiro Pronto para Adaptar</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">BLOCO 1 — HOOK (0:00 - 0:30)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Se você está assistindo esse vídeo, provavelmente já tentou [resultado desejado pelo avatar] pelo menos uma vez. E provavelmente não chegou onde queria. Nos próximos [X] minutos, vou te mostrar exatamente por que — e o que você pode fazer diferente a partir de hoje."<br/><br/>
<em style="color:#a0aec0;font-size:13px">⚠️ Adapte: substitua [resultado desejado] pelo objetivo específico do seu avatar. Seja cirúrgico — "escalar seu negócio" é vago. "Faturar R$10k/mês consistentemente" é específico.</em></p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">BLOCO 2 — PROMESSA DE RESULTADO (0:30 - 1:00)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Nesse vídeo você vai descobrir: [benefício 1 específico], [benefício 2 específico] e [benefício 3 — o mais chocante ou contraintuitivo]. E ao final, vou te apresentar algo que vai mudar completamente como você [ação do avatar]."<br/><br/>
<em style="color:#a0aec0;font-size:13px">Exemplo: "Você vai descobrir por que 80% do budget de anúncios é desperdiçado nas primeiras 48h, como identificar isso em 10 minutos, e a configuração que dobrou o ROAS de 12 campanhas que acompanhei."</em></p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">BLOCO 3 — CREDENCIAIS RÁPIDAS (1:00 - 1:45)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Meu nome é [nome]. Nos últimos [X] anos, [resultado específico que você gerou para outros]. Já [prova de autoridade — número, case, mídia]. Mas mais importante: [por que você está ensinando isso — motivação genuína]."<br/><br/>
<em style="color:#a0aec0;font-size:13px">Regra: credenciais máximo 45s. Mais do que isso, o visitante desliga. Foco em resultado gerado para outros, não em diplomas.</em></p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">BLOCO 4 — IDENTIFICAÇÃO COM A DOR (1:45 - 3:00)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Deixa eu adivinhar. Você [descreva a situação dolorosa em detalhes — cena específica]. Você já tentou [solução 1 que não funcionou] e [solução 2]. E o resultado foi [frustração específica]. Você começa a se perguntar se o problema é você."<br/><br/>
<em style="color:#a0aec0;font-size:13px">Quanto mais específica a cena, mais a pessoa se reconhece. "Você fica frustrado com resultados" não funciona. "Você publica conteúdo todo dia, gasta R$500 em anúncio e abre o painel de vendas de manhã esperando uma notificação — e não tem nenhuma" funciona.</em></p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">BLOCO 5 — A VIRADA (3:00 - 5:00)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Eu sei exatamente como isso sente porque [sua história de dor — breve e honesto]. Mas há [X anos/meses] eu descobri algo que mudou tudo. Não foi uma técnica nova. Foi entender [o insight central do seu método]. A partir daí, [o que mudou especificamente]. E foi isso que me levou a criar [o produto]."<br/><br/>
<em style="color:#a0aec0;font-size:13px">A virada deve ser um insight genuíno — não "descobri um método secreto". O que você aprendeu que era contraintuitivo ou que a maioria ignora?</em></p>
</div>

<h2>A Estrutura dos 15 Blocos — Com Timing</h2>

<table>
  <thead>
    <tr><th>Bloco</th><th>Timing</th><th>Função</th><th>Duração recomendada</th></tr>
  </thead>
  <tbody>
    <tr><td>1. Hook</td><td>0:00</td><td>Parar o visitante</td><td>30s</td></tr>
    <tr><td>2. Promessa de resultado</td><td>0:30</td><td>Dar razão para continuar</td><td>30s</td></tr>
    <tr><td>3. Credenciais</td><td>1:00</td><td>Construir confiança</td><td>45s</td></tr>
    <tr><td>4. Identificação com a dor</td><td>1:45</td><td>Criar conexão emocional</td><td>75s</td></tr>
    <tr><td>5. Agitação da dor</td><td>3:00</td><td>Ampliar urgência</td><td>60s</td></tr>
    <tr><td>6. A virada / Insight</td><td>4:00</td><td>Introduzir o método</td><td>60-90s</td></tr>
    <tr><td>7. Conteúdo de valor</td><td>5:30</td><td>Provar expertise + reciprocidade</td><td>10-20 min</td></tr>
    <tr><td>8. História de transformação</td><td>~20:00</td><td>Prova social narrativa</td><td>3-5 min</td></tr>
    <tr><td>9. Apresentação do produto</td><td>~25:00</td><td>Revelar a solução</td><td>3-5 min</td></tr>
    <tr><td>10. Stack de valor</td><td>~30:00</td><td>Ancoragem de preço</td><td>2-3 min</td></tr>
    <tr><td>11. Depoimentos</td><td>~33:00</td><td>Validação social</td><td>3-5 min</td></tr>
    <tr><td>12. Destruição de objeções</td><td>~38:00</td><td>Eliminar resistência</td><td>3-4 min</td></tr>
    <tr><td>13. Oferta + preço</td><td>~42:00</td><td>Apresentar o investimento</td><td>2-3 min</td></tr>
    <tr><td>14. Garantia</td><td>~45:00</td><td>Remover risco</td><td>60s</td></tr>
    <tr><td>15. Urgência + CTA final</td><td>~46:00</td><td>Mover para ação</td><td>60-90s</td></tr>
  </tbody>
</table>

<h2>A Transição do Conteúdo para o Pitch — A Mais Difícil</h2>

<p>A maioria das VSLs converte mal não pelo pitch — mas pela transição. Se o visitante sentir que você "virou a chave" de educar para vender, ele desconfia.</p>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">TRANSIÇÃO QUE FUNCIONA</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">"Você acabou de ver [resumo de 2 linhas do que ensinou]. Isso é o suficiente para [resultado parcial]. Mas a realidade é que isso é só uma parte do framework completo. Para quem quiser ir mais fundo — e aplicar o sistema inteiro — criei o [produto]. Deixa eu te mostrar o que tem dentro..."<br/><br/>
<em style="color:#a0aec0;font-size:13px">O segredo: a transição não "corta" o conteúdo — ela o estende. O produto não é vendido como algo separado do que você ensinou: é a continuação natural.</em></p>
</div>

<h2>Duração Ideal por Ticket</h2>
<table>
  <thead>
    <tr><th>Ticket</th><th>Duração</th><th>Foco principal</th></tr>
  </thead>
  <tbody>
    <tr><td>R$97-R$497</td><td>15-25 min</td><td>Hook forte + oferta direta — menos conteúdo</td></tr>
    <tr><td>R$500-R$1.500</td><td>25-40 min</td><td>Conteúdo de valor + prova social densa</td></tr>
    <tr><td>R$1.500-R$5.000</td><td>40-60 min</td><td>Storytelling longo + destruição de objeções</td></tr>
    <tr><td>R$5.000+</td><td>60-90 min ou webinar</td><td>Alta transformação + case studies detalhados</td></tr>
  </tbody>
</table>`
          }
        ],
        locked: false
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
            keyPoints: ["Copy completo de oferta de fundador — email + WhatsApp prontos para adaptar", "A fórmula de precificação do semente: como calcular o preço de fundador certo", "Timeline de 60 dias do semente ao lançamento completo"],
            exercise: "Defina agora a ideia do seu semente em 3 frases: (1) Para quem é, (2) Qual resultado entrega, (3) Em quanto tempo. Depois calcule: qual seria o preço cheio? Multiplique por 0,5 — esse é seu preço de fundador inicial. Com essas 4 informações, você consegue escrever o email de oferta usando o template desta aula.",
            content: `<h2>Lançamento Semente: Venda Antes de Criar — Com os Scripts Prontos</h2>

<p>A lógica é simples e poderosa: <em>você vende primeiro, cria depois</em>. Isso elimina o maior risco do empreendedorismo digital — criar algo que ninguém quer comprar.</p>

<p>O número mínimo viável é <strong>entre 10 e 30 compradores</strong>. Esse volume valida a demanda, gera receita para cobrir a produção e cria um grupo de "co-criadores" que darão feedback que melhora o produto.</p>

<h2>A Fórmula de Precificação do Semente</h2>

<table>
  <thead>
    <tr><th>Preço final planejado</th><th>Preço de fundador</th><th>Número mínimo de vendas</th><th>Receita mínima de validação</th></tr>
  </thead>
  <tbody>
    <tr><td>R$497</td><td>R$247 (50%)</td><td>15 fundadores</td><td>R$3.705</td></tr>
    <tr><td>R$997</td><td>R$497 (50%)</td><td>10 fundadores</td><td>R$4.970</td></tr>
    <tr><td>R$1.997</td><td>R$997 (50%)</td><td>10 fundadores</td><td>R$9.970</td></tr>
    <tr><td>R$2.500</td><td>R$1.200 (48%)</td><td>8 fundadores</td><td>R$9.600</td></tr>
  </tbody>
</table>

<p><strong>Regra:</strong> o desconto de fundador deve ser real e justificado — não um truque. A justificativa é: o comprador entra com o produto em construção, participa do processo, e sua opinião molda o produto final. Isso tem valor — para você e para ele.</p>

<h2>O Email de Oferta de Fundador — Template Completo</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">EMAIL DE OFERTA DE FUNDADOR — ADAPTE AO SEU CONTEXTO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> Uma pergunta direta (com resposta honesta)<br/><br/>
Oi [nome],<br/><br/>
Tenho trabalhado em algo há [X meses/semanas]. Antes de concluir, quero saber se faz sentido para você.<br/><br/>
Estou criando [nome do produto/método] — um [formato: programa, curso, método] para [avatar] que quer [resultado principal] sem [obstáculo principal].<br/><br/>
A estrutura é [X módulos / X semanas]. Entregas incluem [elemento 1], [elemento 2] e [elemento 3].<br/><br/>
Estou abrindo para um grupo pequeno de fundadores — pessoas que entram agora, com o produto ainda em construção, por [preço de fundador] (o preço final será [preço cheio]).<br/><br/>
Em troca do desconto, peço que:<br/>
- Participe ativamente e me dê feedback real<br/>
- Se tiver resultado, compartilhe comigo (para usar como depoimento)<br/><br/>
Estou abrindo apenas [N] vagas. Fecha [data/dia] à meia-noite.<br/><br/>
Se quiser entrar: [link de pagamento]<br/><br/>
Qualquer dúvida, responde esse email.<br/><br/>
[Assinatura]
</p>
</div>

<h2>O WhatsApp de Oferta de Fundador — Template</h2>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">MENSAGEM WHATSAPP — OFERTA DE FUNDADOR (200 palavras)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
"Oi [nome]! Tenho algo diferente pra te contar.<br/><br/>
Estou lançando o [produto] — um método para [resultado] em [tempo] para quem [perfil do avatar].<br/><br/>
Antes de abrir pra todo mundo, estou escolhendo [N] pessoas para entrar como fundadores. O que muda pra quem entra agora: preço de R$[cheio] por R$[fundador] + participação direta na construção do método.<br/><br/>
Fecha em 48h.<br/><br/>
Você topa? Se sim, te mando o link agora."
</p>
</div>

<h2>A Estrutura em 4 Etapas — Com Timing</h2>

<table>
  <thead>
    <tr><th>Etapa</th><th>Dias</th><th>O que fazer</th><th>Ferramenta</th></tr>
  </thead>
  <tbody>
    <tr><td>Pré-anúncio</td><td>D-5 a D-3</td><td>Testar a ideia informalmente ("Estou pensando em criar X — faz sentido pra você?")</td><td>DM, WhatsApp, stories com caixinha</td></tr>
    <tr><td>Oferta de Fundador</td><td>D-2 a D+0</td><td>Email + WhatsApp de oferta com link de pagamento. Deadline real de 48-72h</td><td>Hotmart/Kiwify + email</td></tr>
    <tr><td>Criação com Feedback</td><td>D+1 a D+45</td><td>Entregar módulos semanalmente. Pesquisa de feedback a cada entrega.</td><td>Área de membros + grupo fechado</td></tr>
    <tr><td>Relançamento Completo</td><td>D+60</td><td>Produto pronto, depoimentos coletados, relança para audiência ampla a preço cheio</td><td>Lançamento PLF ou perpétuo</td></tr>
  </tbody>
</table>

<h2>Erros Que Matam o Semente</h2>

<table>
  <thead>
    <tr><th>Erro</th><th>Consequência</th><th>Como evitar</th></tr>
  </thead>
  <tbody>
    <tr><td>Prometer mais do que pode entregar</td><td>Refund + reputação destruída</td><td>Seja honesto sobre o que está pronto e o que está sendo construído</td></tr>
    <tr><td>Sem deadline na oferta de fundador</td><td>Nenhuma venda — "vou pensar" vira nunca</td><td>48-72h de janela — não mais que isso</td></tr>
    <tr><td>Preço muito barato</td><td>Comprador não valoriza + você perde margem</td><td>Mínimo 40-50% do preço final — não abaixo</td></tr>
    <tr><td>Ignorar o feedback dos fundadores</td><td>Produto que não resolve o problema real</td><td>Check-in semanal + pesquisa formal após cada módulo</td></tr>
    <tr><td>Entregar tudo de uma vez</td><td>Perde o feedback ao longo do processo</td><td>Entregar em partes — 1 módulo/semana</td></tr>
  </tbody>
</table>`
          },
          {
            id: "perpetuo",
            title: "Lançamento Perpétuo: A Máquina de Vendas 24/7",
            duration: "25 min",
            type: "text",
            keyPoints: ["A sequência de 7 emails do funil perpétuo — assuntos e copy pronto", "As métricas que indicam se o funil está saudável ou sangrando budget", "Como montar o webinar evergreen que converte: estrutura minuto a minuto"],
            exercise: "Escreva o assunto + primeiras 3 linhas dos 7 emails do seu funil perpétuo usando os templates desta aula. Não precisa ser perfeito — escreva uma versão rascunho de cada um. O objetivo é ter a estrutura da sequência antes de qualquer configuração técnica. Isso deve tomar 90 minutos.",
            content: `<h2>Funil Perpétuo: A Receita Que Cresce Enquanto Você Dorme</h2>

<p>O lançamento perpétuo (evergreen) é um sistema de vendas automatizado que roda continuamente — sem janelas de abertura e fechamento, sem pico de estresse, sem dependência de você estar online. É receita previsível.</p>

<p><strong>Mas atenção:</strong> um funil perpétuo mal construído é uma máquina de queimar dinheiro. A sequência correta antes de construir o perpétuo: semente → 1-2 lançamentos pontuais → perpétuo. Escale o que funciona — não pule etapas.</p>

<h2>A Estrutura do Funil Perpétuo em 4 Pilares</h2>

<table>
  <thead>
    <tr><th>Pilar</th><th>O que é</th><th>Métrica de sucesso</th></tr>
  </thead>
  <tbody>
    <tr><td>Lead Magnet (Isca)</td><td>Material gratuito que resolve um problema específico do avatar</td><td>Taxa opt-in LP &gt;35%</td></tr>
    <tr><td>Webinar Evergreen</td><td>60-90 min gravado — conteúdo de valor + oferta</td><td>Comparecimento &gt;25%, Conversão 5-15%</td></tr>
    <tr><td>Sequência de Email</td><td>7 emails em 7 dias — nutrir, convencer, converter</td><td>Taxa abertura &gt;25%, Conversão sequência &gt;3%</td></tr>
    <tr><td>Deadline Individual</td><td>Contador único por usuário — 48-72h após o webinar</td><td>60%+ das vendas acontecem nos últimos 12h</td></tr>
  </tbody>
</table>

<h2>A Sequência de 7 Emails — Assuntos + Estrutura Prontos</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">EMAIL 1 — ENTREGA + EXPECTATIVA (imediato após opt-in)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> "Seu [lead magnet] está aqui + o que vem depois"<br/>
<strong>Estrutura:</strong> Entrega o link do lead magnet → Agradece pelo interesse → Anuncia o que a sequência vai entregar nos próximos dias (cria expectativa) → CTA: "Assiste o webinar — te enviei o link separado"
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">EMAIL 2 — CONTEÚDO DE VALOR (D+1)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> "O erro que [avatar] comete antes de [ação principal]"<br/>
<strong>Estrutura:</strong> Conteúdo educacional direto — sem vender nada. O objetivo é demonstrar expertise e criar reciprocidade. Finaliza com: "Amanhã vou te falar sobre [próximo conteúdo]" — cria abertura do próximo email.
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">EMAIL 3 — HISTÓRIA DE TRANSFORMAÇÃO (D+2)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> "Como eu [resultado chocante] depois de [situação difícil]"<br/>
<strong>Estrutura:</strong> Sua história real de antes/depois → O insight que mudou tudo → Como esse insight virou o método que você usa hoje. Sem vender — apenas contar a história. CTA: "Amanhã compartilho o caso de um aluno que aplicou e [resultado específico]"
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">EMAIL 4 — PROVA SOCIAL (D+3)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> "[Nome do aluno] foi de [situação antes] para [resultado] em [tempo]"<br/>
<strong>Estrutura:</strong> Case detalhado de um aluno — situação antes, o que aplicou, resultado específico. Termina: "O mesmo método que o [Nome] usou está disponível para você. Mas é para um perfil específico — no email de amanhã conto quem é esse perfil."
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">EMAIL 5 — DESTRUIÇÃO DE OBJEÇÃO (D+4)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> "Mas e se [objeção principal]?"<br/>
<strong>Estrutura:</strong> Enfrenta diretamente a principal objeção do avatar ("não tenho tempo", "não tenho audiência", "já tentei antes") → Resposta honesta + prova de que não é obstáculo real → Transição: "Então o [produto] é para você. Deixa eu explicar o que está incluso."
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">EMAIL 6 — OFERTA DIRETA (D+5)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> "[Produto] — o que está incluso e o investimento"<br/>
<strong>Estrutura:</strong> Apresenta o produto com todos os módulos e bônus → Stack de valor (quanto cada parte valeria separado) → Preço real + formas de pagamento → Garantia → Deadline individual (48h) → CTA direto com link<br/><br/>
<strong>Este é o email mais importante da sequência.</strong> Se as conversões estão baixas, geralmente é aqui que está o problema — ou o preço, ou a oferta, ou a garantia.
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #ef4444;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#f87171;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">EMAIL 7 — ÚLTIMA CHANCE (D+6 — última hora antes do deadline)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> "Fecha em [X horas] — última chance"<br/>
<strong>Estrutura:</strong> Recapitulação rápida (3 frases) → O que acontece quando fechar (sem rodeios — o desconto/bônus sai) → 1 CTA final → P.S. com resposta à última objeção<br/><br/>
<strong>Nota:</strong> 40-60% das vendas de um funil perpétuo acontecem neste email. Não pule — e mande no horário exato do deadline.
</p>
</div>

<h2>Métricas do Funil Perpétuo Saudável</h2>

<table>
  <thead>
    <tr><th>Métrica</th><th>Ruim</th><th>Bom</th><th>Excelente</th><th>O que fazer se ruim</th></tr>
  </thead>
  <tbody>
    <tr><td>Taxa opt-in LP</td><td>&lt;20%</td><td>30-45%</td><td>&gt;50%</td><td>Reescrever headline + CTA da LP</td></tr>
    <tr><td>Comparecimento webinar</td><td>&lt;15%</td><td>25-35%</td><td>&gt;40%</td><td>Melhorar email/reminder pré-webinar</td></tr>
    <tr><td>Conversão no webinar</td><td>&lt;3%</td><td>5-10%</td><td>&gt;12%</td><td>Revisar transição conteúdo→pitch</td></tr>
    <tr><td>Taxa abertura email</td><td>&lt;15%</td><td>25-35%</td><td>&gt;40%</td><td>Reescrever assuntos dos emails</td></tr>
    <tr><td>Conversão sequência</td><td>&lt;1%</td><td>2-4%</td><td>&gt;5%</td><td>Revisar email 5 (objeção) e 6 (oferta)</td></tr>
    <tr><td>ROAS (para escalar)</td><td>&lt;2x</td><td>3-5x</td><td>&gt;6x</td><td>Não escale abaixo de 3x — otimize primeiro</td></tr>
  </tbody>
</table>`
          },
          {
            id: "interno-externo",
            title: "Lançamento Interno e Externo",
            duration: "18 min",
            type: "text",
            keyPoints: ["Template de proposta de JV — o email que abre parceria sem constrangimento", "Como calcular e apresentar os números de um lançamento para convencer parceiros", "Os critérios para escolher parceiros de JV que multiplicam (e os que prejudicam)"],
            exercise: "Faça uma lista de 5 nomes que têm a audiência que você quer alcançar — produtores do seu nicho ou nichos complementares. Para cada um, anote: tamanho estimado da audiência, nível de alinhamento com seu produto (1-5), e se você já tem algum relacionamento com eles. Classifique por prioridade e planeje o primeiro contato nos próximos 30 dias.",
            content: `<h2>Interno vs. Externo: Como Multiplicar Receita Sem Mais Budget</h2>

<h2>Lançamento Interno: Sua Base, Seu Controle</h2>

<p>O lançamento interno usa exclusivamente sua própria audiência — lista de email, seguidores, grupos de WhatsApp/Telegram. Você controla tudo: timing, mensagem, frequência, posicionamento.</p>

<table>
  <thead>
    <tr><th>Variável</th><th>Interno</th><th>Externo (JV)</th></tr>
  </thead>
  <tbody>
    <tr><td>Margem</td><td>100% sua</td><td>50-70% sua (após comissão)</td></tr>
    <tr><td>Controle</td><td>Total</td><td>Compartilhado</td></tr>
    <tr><td>Dependência</td><td>Do tamanho da sua lista</td><td>Da qualidade da lista do parceiro</td></tr>
    <tr><td>Velocidade</td><td>Você decide</td><td>Depende da agenda do parceiro</td></tr>
    <tr><td>Teto de receita</td><td>Limitado pela sua audiência</td><td>Escala com o número de parceiros</td></tr>
    <tr><td>Risco</td><td>Baixo</td><td>Reputação ligada ao parceiro</td></tr>
  </tbody>
</table>

<h2>Lançamento Externo (JV): A Alavanca de Crescimento</h2>

<p>No JV, você apresenta seu produto para a audiência de outro produtor. O parceiro promove para a lista dele — em troca de comissão sobre cada venda. Sem lista grande, sem budget extra: a audiência já existe, só precisa ser ativada.</p>

<h3>Como Estruturar a Comissão de JV</h3>

<table>
  <thead>
    <tr><th>Ticket do produto</th><th>Comissão padrão</th><th>O que é negociável</th></tr>
  </thead>
  <tbody>
    <tr><td>R$97-R$497</td><td>40-50%</td><td>Bônus de performance (acima de X vendas)</td></tr>
    <tr><td>R$500-R$1.500</td><td>30-40%</td><td>Reciprocidade futura + % do upsell</td></tr>
    <tr><td>R$1.500-R$5.000</td><td>25-35%</td><td>Comissão em 2 camadas (JV + sub-afiliados)</td></tr>
    <tr><td>R$5.000+</td><td>20-30%</td><td>Revenue share + acesso exclusivo ao produto</td></tr>
  </tbody>
</table>

<h2>O Email de Proposta de JV — Template Que Funciona</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">EMAIL DE PROPOSTA JV — ADAPTE AO SEU CONTEXTO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> Proposta de parceria — [seu nome] + [nome do parceiro]<br/><br/>
Oi [nome],<br/><br/>
Sou [seu nome]. [Uma linha de credencial relevante — o que você já fez que o parceiro reconheceria].<br/><br/>
Tenho acompanhado seu trabalho há algum tempo, especificamente [algo genuinamente específico sobre o trabalho dele — não genérico].<br/><br/>
Tenho um produto, [nome], voltado para [avatar]. Em lançamentos anteriores, tive uma taxa de conversão de [X]% com tickets de R$[valor]. A minha estimativa é que para a sua audiência o CPL seria em torno de R$[X] com conversão de [X]% — o que geraria uma comissão de aproximadamente R$[estimativa] para você.<br/><br/>
A proposta é simples:<br/>
- Você cede [X disparos] para sua lista durante [período]<br/>
- Eu forneço todos os materiais de divulgação e suporte completo ao aluno<br/>
- Comissão de [X]% de cada venda rastreada pelo seu link<br/><br/>
Se fizer sentido, podemos agendar uma call de 30 minutos para alinhar detalhes.<br/><br/>
[Assinatura]
</p>
</div>

<p><strong>Por que esse email funciona:</strong> ele é específico (não é copy genérico de proposta), apresenta os números antes de pedir o sim, e reduz o risco do parceiro ao mostrar projeção realista.</p>

<h2>Como Encontrar e Qualificar Parceiros de JV</h2>

<table>
  <thead>
    <tr><th>Critério</th><th>Por que importa</th><th>Como avaliar</th></tr>
  </thead>
  <tbody>
    <tr><td>Alinhamento de audiência</td><td>Lista desalinhada = baixa conversão</td><td>Conteúdo dele resolve dores complementares ao seu produto?</td></tr>
    <tr><td>Engajamento da lista</td><td>Lista grande e fria é pior que lista pequena e quente</td><td>Taxa abertura dos emails dele (peça — ou observe os posts)</td></tr>
    <tr><td>Reputação no mercado</td><td>Sua credibilidade está atrelada à dele</td><td>Pesquise reclamações, verifique entrega do produto, converse com alunos</td></tr>
    <tr><td>Histórico de JVs anteriores</td><td>Parceiros experientes têm processos — iniciantes criam problemas</td><td>Pergunte diretamente se já fez parcerias e como foi</td></tr>
    <tr><td>Relacionamento prévio</td><td>Proposta fria tem 5% de resposta. Com relação prévia: 60%+</td><td>Interagiu com o conteúdo dele antes? Trocou mensagens?</td></tr>
  </tbody>
</table>

<h2>Co-lançamento: O Modelo Mais Poderoso (e Mais Complexo)</h2>

<p>No co-lançamento, dois produtores unem audiências <em>e</em> criam o produto juntos. Cada um traz expertise diferente + audiência diferente. A receita é dividida (50/50 ou conforme acordo) — mas o potencial é muito maior.</p>

<div style="background:#1a1a2e;border-left:3px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">AVISO IMPORTANTE — CO-LANÇAMENTO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Co-lançamento sem contrato escrito é co-conflito agendado. Formalize antes: quem decide o preço, quem controla os acessos, como é dividido o suporte, o que acontece em caso de discordância sobre direção do produto, e o que acontece se um dos parceiros quiser sair. Mesmo (especialmente) entre amigos.</p>
</div>`
          },
          {
            id: "afiliado",
            title: "Lançamento de Afiliado: Lucro Sem Produto Próprio",
            duration: "20 min",
            type: "text",
            keyPoints: ["O post de afiliado avançado — com bônus exclusivo — copy pronto para adaptar", "Scorecard para escolher produto certo: 5 critérios com peso", "Como fazer R$10k+ em comissões com uma lista de menos de 1.000 pessoas"],
            exercise: "Escolha agora 1 produto do seu nicho que você genuinamente acredita — um que você usaria ou já usou. Calcule: se você vender 10 unidades, qual é sua comissão total? O que você poderia criar como bônus exclusivo (template, checklist, sessão, mini-curso) que diferenciaria sua promoção? Escreva o primeiro rascunho do post de promoção usando o template desta aula.",
            content: `<h2>Afiliado Avançado: A Diferença Entre Promover e Converter</h2>

<p>O afiliado mediano compartilha o link. O afiliado avançado cria contexto, constrói desejo e oferece algo que não existe em nenhum outro lugar. A diferença na comissão pode ser 10x.</p>

<h2>Scorecard: Como Escolher o Produto Certo Para Promover</h2>

<table>
  <thead>
    <tr><th>Critério</th><th>Peso</th><th>Como avaliar</th><th>Nota mínima para promover</th></tr>
  </thead>
  <tbody>
    <tr><td>Alinhamento com sua audiência</td><td>30%</td><td>Sua audiência tem a dor que esse produto resolve?</td><td>8/10</td></tr>
    <tr><td>Reputação do produtor</td><td>25%</td><td>Pesquise reclamações, entregou o que prometeu, suporte funcionou?</td><td>7/10</td></tr>
    <tr><td>Comissão (math viável)</td><td>20%</td><td>Com sua taxa de conversão estimada, o CPL compensa? Mín: 30%</td><td>6/10</td></tr>
    <tr><td>Qualidade do produto</td><td>15%</td><td>Você usou ou testou? Ou tem depoimentos verificáveis?</td><td>8/10</td></tr>
    <tr><td>Materiais de divulgação</td><td>10%</td><td>Página de vendas, copy, banners prontos facilitam muito</td><td>5/10</td></tr>
  </tbody>
</table>

<p><strong>Regra prática:</strong> se o critério de alinhamento ou reputação estiver abaixo de 7, não promova independente dos outros fatores. Sua credibilidade é mais valiosa que qualquer comissão.</p>

<h2>A Estratégia do Bônus Exclusivo — O Que Diferencia</h2>

<p>A pergunta que qualquer comprador faz antes de usar um link de afiliado: "Por que comprar pelo link de X em vez de comprar direto ou pelo link de Y?" Sem uma resposta clara, a maioria vai comprar pela rota mais óbvia — sem o seu link.</p>

<p>O bônus exclusivo responde essa pergunta.</p>

<table>
  <thead>
    <tr><th>Tipo de bônus</th><th>Valor percebido</th><th>Custo para você</th><th>Melhor para</th></tr>
  </thead>
  <tbody>
    <tr><td>Sessão 1:1 (1h)</td><td>Muito alto</td><td>Seu tempo (1h por venda)</td><td>Produtos de alto ticket</td></tr>
    <tr><td>Template / ferramenta</td><td>Alto</td><td>Baixo (cria uma vez, distribui sempre)</td><td>Qualquer ticket</td></tr>
    <tr><td>Mini-curso de implementação</td><td>Alto</td><td>Médio (gravar uma vez)</td><td>Produtos com curva de aprendizado</td></tr>
    <tr><td>Acesso a grupo fechado</td><td>Médio-alto</td><td>Moderado (moderação)</td><td>Comunidades, nichos específicos</td></tr>
    <tr><td>Checklist exclusivo</td><td>Médio</td><td>Muito baixo</td><td>Primeiros bônus — nível iniciante</td></tr>
  </tbody>
</table>

<h2>O Post de Afiliado Avançado — Template de Copy</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">POST DE AFILIADO — ESTRUTURA QUE CONVERTE</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>[HOOK — resultado ou controvérsia]</strong><br/>
"Recomendo poucas coisas. Quando recomendo, é porque testei ou acompanhei de perto o resultado."<br/><br/>

<strong>[CONTEXTO — por que você está falando disso]</strong><br/>
"Nos últimos [X meses] acompanhei [N] pessoas usando o [produto do nicho]. Os resultados que vi foram [resultado específico]. Um caso específico: [case real de 2 frases]."<br/><br/>

<strong>[O QUE É — sem jargão]</strong><br/>
"O [produto] é um [formato] para [avatar] que quer [resultado] em [tempo]. Ele cobre [módulos/tópicos principais]."<br/><br/>

<strong>[POR QUE COMPRAR PELO SEU LINK]</strong><br/>
"Quem entrar pelo meu link leva de bônus: [bônus específico]. Isso não está disponível em nenhum outro lugar — só pelo meu link porque [justificativa curta]."<br/><br/>

<strong>[CTA]</strong><br/>
"Link na bio. Fecha [data]. Qualquer dúvida me manda uma mensagem."
</p>
</div>

<h2>O Posicionamento Certo: Curador vs. Usuário</h2>

<table>
  <thead>
    <tr><th>Posicionamento</th><th>Quando usar</th><th>Copy de abertura</th><th>Conversão relativa</th></tr>
  </thead>
  <tbody>
    <tr><td>Curador</td><td>Quando você testou ou avaliou múltiplas opções</td><td>"Avaliei [N] opções de [tema] e esse é o único que recomendo porque..."</td><td>Alta — autoridade de filtro</td></tr>
    <tr><td>Usuário</td><td>Quando você comprou e teve resultado</td><td>"Usei o [produto] e [resultado específico]. O que funcionou foi..."</td><td>Muito alta — prova viva</td></tr>
    <tr><td>Observador</td><td>Quando você acompanhou alunos usando</td><td>"Acompanhei [N] pessoas usando e vi [resultado]. O que me convenceu foi..."</td><td>Média — prova indireta</td></tr>
  </tbody>
</table>

<h2>Como Fazer R$10k+ com Lista Pequena</h2>

<p>Com uma lista de 800 pessoas e taxa de abertura de 30% = 240 pessoas lendo. Taxa de clique de 10% = 24 pessoas na página. Conversão de 15% = 3-4 vendas. Com produto de R$2.500 e 40% de comissão = R$3.000-4.000 por lançamento de afiliado.</p>

<p>Para chegar a R$10k: ou mais lançamentos de afiliado por ano, ou produto de ticket maior, ou aumentar a lista. As três alavancas são independentes — você pode trabalhar qualquer uma.</p>

<div style="background:#1a1a2e;border-left:3px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">REGRA DE OURO DO AFILIADO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Você não está vendendo o produto de alguém. Você está curadorizando opções para sua audiência e assumindo responsabilidade pela qualidade do que recomenda. Se o produto for ruim, sua audiência vai saber que foi você que recomendou — e vai lembrar. A comissão passa, a reputação fica.</p>
</div>`
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
            title: "Escada de Valor: Mapeando Sua Jornada de Produtos",
            duration: "25 min",
            type: "text",
            keyPoints: ["Planilha de mapeamento da escada de valor — preencha durante a aula", "Como calcular o LTV de cada degrau e usar para definir budget de aquisição", "Os 3 erros mais comuns na escada que fazem a maioria dos produtores parar no degrau 2"],
            exercise: "Preencha agora os 5 degraus da sua escada de valor. Para cada degrau: (1) qual é o produto ou oferta, (2) qual é o preço, (3) qual problema específico ele resolve. Se algum degrau está vazio, esse é seu próximo produto a criar. Não é necessário ter todos os 5 — mas você precisa ter pelo menos os degraus 1, 2 e 3 mapeados.",
            content: `<h2>Escada de Valor: A Arquitetura de Receita de Todo Negócio Digital Escalável</h2>

<p>A ideia é simples mas poderosa: em vez de ter um produto, você tem uma jornada de produtos — cada um entregando mais valor a um preço mais alto, para quem está pronto para o próximo degrau. O custo de vender para quem já comprou é 5-7x menor do que adquirir um novo cliente. A escada aproveita isso sistematicamente.</p>

<h2>Os 5 Degraus: Estrutura + Exemplos Reais</h2>

<table>
  <thead>
    <tr><th>Degrau</th><th>Faixa de preço</th><th>Objetivo estratégico</th><th>Exemplo de produto</th></tr>
  </thead>
  <tbody>
    <tr><td>1 — Isca Digital</td><td>Grátis a R$47</td><td>Gerar cadastro + primeira experiência positiva</td><td>Ebook, checklist, mini-curso, calculadora</td></tr>
    <tr><td>2 — Produto de Entrada</td><td>R$47-R$297</td><td>Primeira compra real + financiar o CAC</td><td>Workshop gravado, guia completo, curso curto</td></tr>
    <tr><td>3 — Produto Core</td><td>R$297-R$1.997</td><td>Solução completa — principal fonte de receita</td><td>Curso completo, mentoria em grupo, programa</td></tr>
    <tr><td>4 — High Ticket</td><td>R$2.000-R$20.000</td><td>Personalização e resultado garantido</td><td>Mentoria 1:1, consultoria, mastermind</td></tr>
    <tr><td>5 — Continuidade</td><td>R$10.000+/ano</td><td>Parceria estratégica, fee por resultado</td><td>Revenue share, participação societária</td></tr>
  </tbody>
</table>

<h2>Como Calcular o LTV de Cada Degrau</h2>

<p>LTV (Lifetime Value) é a receita total que um cliente gera ao longo do tempo. A escada de valor serve exatamente para maximizá-lo.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">EXEMPLO DE CÁLCULO DE LTV</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
Suponha que você tenha:<br/>
- Isca: gratuita (lead magnet)<br/>
- Produto de entrada: R$197<br/>
- Produto core: R$997<br/>
- High ticket: R$5.000<br/><br/>
Se 100% compra o produto de entrada, 40% sobe para o core e 10% vai para o high ticket:<br/>
LTV médio = R$197 + (40% × R$997) + (10% × R$5.000)<br/>
LTV médio = R$197 + R$399 + R$500 = <strong>R$1.096 por cliente</strong><br/><br/>
Isso significa que você pode gastar até ~R$350-400 para adquirir cada cliente e ainda ter margem saudável.
</p>
</div>

<h2>Os 3 Erros Que Travam a Maioria dos Produtores no Degrau 2</h2>

<table>
  <thead>
    <tr><th>Erro</th><th>O que acontece</th><th>Como resolver</th></tr>
  </thead>
  <tbody>
    <tr><td>Não existe degrau 1 gratuito</td><td>Leads frios precisam comprar de primeira — resistência alta, CPL alto</td><td>Crie uma isca que resolve um problema real em 30 minutos</td></tr>
    <tr><td>Pulo de degrau: da isca direto para o core</td><td>Lead não aquecido o suficiente para ticket alto — baixa conversão</td><td>Produto de entrada de R$97-197 que "qualifica" antes do core</td></tr>
    <tr><td>Degrau 3 sem oferta clara de degrau 4</td><td>Clientes do core não sabem que existe próximo nível — você perde receita</td><td>Após onboarding do degrau 3, apresente a oferta do degrau 4</td></tr>
  </tbody>
</table>

<h2>Como Mapear Sua Escada Agora</h2>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">PLANILHA DE MAPEAMENTO — PREENCHA AGORA</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
Para cada linha, responda:<br/><br/>
<strong>Degrau 1 (Isca):</strong> Produto: ___ | Preço: ___ | Problema que resolve: ___<br/>
<strong>Degrau 2 (Entrada):</strong> Produto: ___ | Preço: ___ | Quem é o comprador ideal: ___<br/>
<strong>Degrau 3 (Core):</strong> Produto: ___ | Preço: ___ | Resultado que entrega: ___<br/>
<strong>Degrau 4 (HT):</strong> Produto: ___ | Preço: ___ | O que torna exclusivo: ___<br/>
<strong>Degrau 5 (Continuidade):</strong> Modelo: ___ | Fee/termos: ___<br/><br/>
Identifique o degrau que está faltando ou vazio — esse é seu próximo produto a criar.
</p>
</div>

<p><strong>Nota importante:</strong> cada degrau deve ser completo em si mesmo. Um cliente que compra o degrau 2 e nunca sobe deve ter tido uma experiência excelente e resultado real. A escada não é uma armadilha — é uma jornada. Forçar a subida sem resultado no degrau atual aumenta churn e prejudica reputação.</p>`
          },
          {
            id: "upsell-downsell",
            title: "Upsell, Downsell e Order Bump: Copy e Estrutura",
            duration: "20 min",
            type: "text",
            keyPoints: ["Copy de order bump pronto para usar no checkout — com taxa de aceitação esperada", "A regra dos 3 segundos do upsell: o que dizer logo depois da confirmação de compra", "Como calcular o impacto de cada elemento no seu faturamento total"],
            exercise: "Calcule o impacto do order bump no seu próximo lançamento. Se você tem meta de 50 vendas a R$997, e adicionar um order bump de R$197 com 30% de aceitação: isso adiciona R$2.955 sem um único novo cliente. Descreva em 3 linhas qual seria o produto de order bump ideal para o seu produto principal — algo que complementa e entrega resultado rápido.",
            content: `<h2>Upsell, Downsell e Order Bump: Mais Receita Sem Mais Clientes</h2>

<p>A maioria dos produtores para de otimizar quando o cliente decide comprar. É exatamente nesse momento que a receita pode crescer 40-80% sem nenhum cliente adicional — com a sequência certa de ofertas.</p>

<h2>Order Bump: A Oferta Mais Simples e Mais Lucrativa</h2>

<p>O order bump é uma oferta adicional apresentada dentro do checkout, antes da confirmação. Um checkbox. O cliente marca para adicionar. Taxa de aceitação de mercado: 20-40%.</p>

<h3>O que faz um order bump bom vs. um que ninguém clica</h3>

<table>
  <thead>
    <tr><th>Característica</th><th>Order Bump Bom</th><th>Order Bump Que Não Funciona</th></tr>
  </thead>
  <tbody>
    <tr><td>Preço</td><td>10-30% do valor do produto principal</td><td>Mais de 40% — parece outro produto</td></tr>
    <tr><td>Relação com o produto</td><td>Complementa diretamente o que foi comprado</td><td>Produto separado sem conexão óbvia</td></tr>
    <tr><td>Entrega</td><td>Resultado rápido (template, checklist, bônus prático)</td><td>Curso longo — parece mais trabalho</td></tr>
    <tr><td>Descrição</td><td>2-3 linhas — sem precisar sair do checkout para entender</td><td>Longo demais — pessoa pulou sem ler</td></tr>
  </tbody>
</table>

<h3>Copy de Order Bump — Template</h3>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">ORDER BUMP — COPY PRONTO PARA ADAPTAR</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>☑ SIM! Adicionar [Nome do Order Bump] por apenas R$[X]</strong><br/><br/>
[2 linhas descrevendo o que é + resultado que entrega]<br/>
Normalmente R$[preço cheio]. Por ser complemento do [produto principal], disponível aqui por apenas R$[preço de bump].<br/><br/>
<em style="color:#a0aec0;font-size:13px">Exemplo real: "☑ SIM! Adicionar a Biblioteca de 40 Criativos Prontos por apenas R$97. Templates de anúncio já formatados para o Meta Ads — você só substitui as informações do seu produto. Normalmente R$197. Disponível aqui por R$97."</em>
</p>
</div>

<h2>Upsell de 1 Clique: O Momento Mais Precioso da Jornada</h2>

<p>Apresentado imediatamente após a confirmação de pagamento, o upsell é a oferta de maior valor que o cliente aceita com um único clique — sem preencher cartão novamente.</p>

<p><strong>Por que funciona:</strong> o cliente acabou de tomar uma decisão de compra e está no pico de excitação. O "modo compra" está ativado. A resistência é 3-5x menor nesse momento do que em qualquer outro ponto do funil.</p>

<h3>A Regra dos 3 Primeiros Segundos do Upsell</h3>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">COPY DE ABERTURA DO UPSELL</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
"Parabéns — sua compra está confirmada. Antes de você acessar o [produto], tenho uma oferta única disponível <em>apenas neste momento</em>."<br/><br/>
[Apresente o upsell em 2-3 linhas]<br/><br/>
"Normalmente vendido por R$[preço cheio], você pode adicionar agora por R$[preço de upsell] — sem precisar inserir os dados do cartão novamente. Se você fechar essa página, essa oferta não estará disponível."
</p>
</div>

<h3>Regra de Ouro do Upsell</h3>
<p>O upsell deve ser uma versão superior ou mais completa do que foi comprado — nunca algo completamente diferente.</p>

<table>
  <thead>
    <tr><th>Produto principal</th><th>Upsell que funciona</th><th>Upsell que não funciona</th></tr>
  </thead>
  <tbody>
    <tr><td>Curso de tráfego pago (R$997)</td><td>Mentoria mensal de tráfego (R$497/mês)</td><td>Curso de copywriting (sem conexão direta)</td></tr>
    <tr><td>Método de lançamento (R$1.997)</td><td>Implementação 1:1 — 3 sessões (R$2.500)</td><td>Qualquer produto de nicho diferente</td></tr>
    <tr><td>Programa de emagrecimento (R$497)</td><td>Kit de suplementos ou plano premium (R$297)</td><td>Curso de finanças pessoais</td></tr>
  </tbody>
</table>

<h2>Downsell: Recuperando Quem Disse Não</h2>

<p>Quando o cliente recusa o upsell, você apresenta uma versão menor e mais barata. O cliente disse não ao R$500; ofereça o núcleo daquilo por R$197.</p>

<p>Taxa de aceitação de downsell: 10-20% dos que recusaram o upsell. Sem essa oferta, essa receita é simplesmente perdida.</p>

<h2>A Sequência Completa e o Impacto Calculado</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">CÁLCULO DE IMPACTO — 50 VENDAS DE R$997</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
Receita base: 50 × R$997 = R$49.850<br/><br/>
+ Order Bump (R$197 | 30% de aceitação): 15 × R$197 = R$2.955<br/>
+ Upsell (R$997 | 15% de aceitação): 7 × R$997 = R$6.979<br/>
+ Downsell (R$397 | 15% de quem recusou o upsell): 6 × R$397 = R$2.382<br/><br/>
<strong>Receita total com sequência: R$62.166 (+25%)</strong><br/>
Sem mais um novo cliente — apenas com a sequência de ofertas.
</p>
</div>

<p><strong>Limite da sequência:</strong> não mais de 2 níveis de upsell. Acima disso, a experiência se torna frustrante e queima confiança — e a segunda venda ao mesmo cliente é mais valiosa que qualquer upsell agressivo agora.</p>`
          },
          {
            id: "recorrencia",
            title: "Modelos de Recorrência: A Receita Previsível",
            duration: "22 min",
            type: "text",
            keyPoints: ["Tabela comparativa dos 4 modelos de recorrência: ticket, escala, churn típico e melhor nicho para cada", "Fórmula de LTV e o cálculo de quanto você pode gastar para adquirir um assinante", "Os 4 redutores de churn com o impacto esperado de cada um — em números"],
            exercise: "Calcule agora o potencial de recorrência do seu negócio: qual dos 4 modelos se encaixa melhor com seu produto e audiência? Defina o ticket (R$___/mês), o número de membros-alvo em 12 meses (___), o churn esperado (___%). Com esses números, calcule: qual seria o MRR ao final de 12 meses? Esse número muda sua estratégia de lançamento?",
            content: `<h2>Recorrência: O Chão que Sustenta Toda a Operação</h2>

<p>Receita recorrente não é apenas "renda passiva" — é previsibilidade. Com R$50k de MRR, você toma decisões de investimento completamente diferentes do que com zero recorrência e lançamentos esporádicos. É a diferença entre empreender no modo ofensivo e no modo defensivo.</p>

<h2>Os 4 Modelos de Recorrência: Tabela Comparativa</h2>

<table>
  <thead>
    <tr><th>Modelo</th><th>Ticket típico</th><th>Escala</th><th>Churn típico</th><th>Melhor para</th></tr>
  </thead>
  <tbody>
    <tr><td>Membership / Comunidade Paga</td><td>R$47-R$297/mês</td><td>Alta — sem limite de vagas</td><td>5-12%/mês</td><td>Nichos com transformação contínua (marketing, saúde, desenvolvimento pessoal)</td></tr>
    <tr><td>Content Club (atualização)</td><td>R$37-R$197/mês</td><td>Muito alta — automático</td><td>8-15%/mês</td><td>Nichos que mudam rápido: marketing digital, tech, finanças</td></tr>
    <tr><td>Mentoria Recorrente em Grupo</td><td>R$297-R$997/mês</td><td>Média — limitado pelas calls</td><td>3-8%/mês</td><td>Nichos de negócios, alta renda, alto engajamento necessário</td></tr>
    <tr><td>Retainer de Resultado</td><td>R$2.000-R$10.000/mês</td><td>Baixa — seu tempo é o limite</td><td>2-5%/mês</td><td>Agências, consultores, gestores de tráfego</td></tr>
  </tbody>
</table>

<h2>A Fórmula do LTV e o Teto de CAC</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">CÁLCULO DE LTV E CAC MÁXIMO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>LTV = Ticket Mensal × Tempo Médio de Permanência (meses)</strong><br/><br/>
Exemplo: R$197/mês × 8 meses = LTV de R$1.576<br/><br/>
<strong>CAC máximo saudável = LTV ÷ 3</strong><br/>
R$1.576 ÷ 3 = R$525 de CAC máximo com margem de 66%<br/><br/>
Isso significa: você pode gastar R$525 em ads para adquirir 1 assinante de R$197/mês e ainda ter negócio lucrativo. Compare com uma venda única de R$297: CAC máximo de R$99.<br/><br/>
<strong>A recorrência não apenas gera MRR — ela eleva o teto de quanto você pode investir em aquisição.</strong>
</p>
</div>

<h2>Churn: O Inimigo Silencioso — Com Números</h2>

<p>Churn de 10%/mês: você perde metade da base em 7 meses. Crescer se torna uma corrida sem fim. O objetivo é churn abaixo de 5% ao mês — que significa LTV médio acima de 20 meses de permanência.</p>

<table>
  <thead>
    <tr><th>Redutor de churn</th><th>Como implementar</th><th>Impacto esperado</th></tr>
  </thead>
  <tbody>
    <tr><td>Onboarding de 7 dias</td><td>Sequência de 5 emails + quick win no dia 2</td><td>Redução de 30-40% do churn do primeiro mês</td></tr>
    <tr><td>Comunidade ativa</td><td>Grupo com moderador + desafios semanais</td><td>Cancelar = perder as relações; churn 40% menor que sem comunidade</td></tr>
    <tr><td>Plano anual com desconto</td><td>Desconto de 2 meses grátis (= 17% off)</td><td>Quem paga anual cancela 80% menos nos primeiros 6 meses</td></tr>
    <tr><td>Check-in de risco</td><td>Email de Dia 5: "Como está indo?" + alerta para quem não abriu</td><td>Identifica em risco antes do cancelamento — 25% de resgate com suporte proativo</td></tr>
  </tbody>
</table>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:12px 16px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">PROJEÇÃO DE MRR — SIMULAÇÃO REAL</p>
<p style="color:#e2e8f0;font-size:13px;margin:0">
Membership R$297/mês | Aquisição: 20 membros/mês | Churn: 5%/mês<br/>
Mês 3: ~57 membros × R$297 = R$16.929<br/>
Mês 6: ~90 membros × R$297 = R$26.730<br/>
Mês 12: ~136 membros × R$297 = <strong>R$40.392/mês</strong><br/><br/>
Sem aumentar o preço, sem novos lançamentos — só mantendo o churn baixo.
</p>
</div>`
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
        locked: false
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
            keyPoints: ["A sequência de 5 emails de boas-vindas — copy pronto para adaptar", "Como identificar o quick win certo para o seu produto específico", "O check-in de Dia 5: como identificar alunos em risco antes que cancelem"],
            exercise: "Escreva agora o email de Dia 1 do seu onboarding usando o template desta aula. Foque em: confirmar a decisão de compra, criar expectativa clara para os próximos 7 dias, e dar um passo imediato que o aluno pode fazer em 5 minutos. Esse email costuma ter a taxa de abertura mais alta de toda a sequência — vale dedicar 45 minutos para acertar.",
            content: `<h2>Onboarding: A Arquitetura da Primeira Experiência</h2>

<p>70% dos cancelamentos e abandonos acontecem nos primeiros 7 dias. O comprador que não vê valor rápido racionaliza a compra como erro — e desengaja. O onboarding não é burocracia de acesso. É a sequência que separa clientes que completam e indicam de clientes que reembolsam e reclamam.</p>

<h2>A Sequência de 5 Emails de Boas-Vindas — Copy Pronto</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">DIA 1 — BOAS-VINDAS (enviar imediatamente após compra)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> Bem-vindo(a) — seus próximos passos (leia agora)<br/><br/>
Oi [nome],<br/><br/>
Você acabou de tomar uma das melhores decisões para [resultado do produto]. Sério.<br/><br/>
Seu acesso está ativo em: [link]<br/><br/>
Nos próximos 7 dias você vai receber alguns emails meus com o que você precisa para [resultado rápido]. Leia todos — são curtos e diretos.<br/><br/>
Para começar ainda hoje: [ação específica de 5 minutos — ex: "Baixe o mapa do método na área de membros e leia a primeira página"]<br/><br/>
[Seu nome]<br/><br/>
P.S. Qualquer dúvida, responde este email. Eu (ou alguém do meu time) responde em até 24h.
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">DIA 2 — O QUICK WIN</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> Em 30 minutos você consegue [resultado específico]<br/><br/>
Oi [nome],<br/><br/>
Antes de entrar em qualquer módulo, vou te dar uma vitória rápida.<br/><br/>
Faça isso agora: [instrução passo a passo que leva 20-30 minutos e gera um resultado mensurável].<br/><br/>
Quando terminar, [o que eles vão ter / ver / conseguir].<br/><br/>
Isso é a base de tudo que você vai aprender. E você já vai ter na prática.<br/><br/>
[Seu nome]
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">DIA 3 — COMUNIDADE + PERTENCIMENTO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> Você não está sozinho(a) nessa jornada<br/><br/>
Oi [nome],<br/><br/>
Além do método, você entrou em algo mais importante: um grupo de pessoas que estão no mesmo caminho que você.<br/><br/>
Nosso grupo [WhatsApp/Telegram/Comunidade] está em: [link]<br/><br/>
Quando entrar, faz uma coisa só: se apresenta com seu nome + onde você está agora + onde quer chegar. Demora 2 minutos e já vai gerar as primeiras conexões.<br/><br/>
[Seu nome]
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">DIA 5 — CHECK-IN (identificação de risco de churn)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> Como está indo? (pergunta genuína)<br/><br/>
Oi [nome],<br/><br/>
Já se passaram 5 dias desde que você começou. Queria saber: você conseguiu acessar o conteúdo? Fez o exercício do Dia 2?<br/><br/>
Se sim: ótimo — o que você achou? Manda uma mensagem, gosto de saber.<br/>
Se não: sem problema — o que está travando? Responde aqui e a gente resolve.<br/><br/>
[Seu nome]<br/><br/>
<em style="color:#a0aec0;font-size:13px">Por que isso é importante: quem não responde este email tem 3x mais chance de cancelar. Configure uma automação: se não abriu o email do Dia 2, marque como "at risk" e acione suporte proativo.</em>
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">DIA 7 — CELEBRAÇÃO DO PRIMEIRO MARCO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> 1 semana. Você chegou até aqui — isso já é mais que a maioria.<br/><br/>
Oi [nome],<br/><br/>
Primeira semana concluída. Pode parecer pouco, mas as estatísticas mostram que quem passa da primeira semana completa o programa em 70% dos casos.<br/><br/>
Você está no caminho certo.<br/><br/>
Nos próximos dias, [o que está por vir — crie expectativa para o próximo módulo].<br/><br/>
[Seu nome]
</p>
</div>

<h2>Como Identificar o Quick Win Certo Para Seu Produto</h2>

<p>O quick win ideal tem 3 características:</p>

<table>
  <thead>
    <tr><th>Característica</th><th>Critério</th><th>Exemplo por nicho</th></tr>
  </thead>
  <tbody>
    <tr><td>Tempo de execução</td><td>Menos de 30 minutos</td><td>Marketing: configurar o pixel no site; Fitness: fazer a primeira avaliação de medidas; Finanças: listar todas as dívidas em uma planilha</td></tr>
    <tr><td>Resultado visível</td><td>Gera um número, um screenshot ou uma mudança mensurável</td><td>"Você vai ter sua lista de dívidas ordenada por taxa de juros"</td></tr>
    <tr><td>Conexão com o resultado final</td><td>É o primeiro passo real — não um exercício artificial</td><td>"Sem essa lista, você não pode aplicar o Módulo 3"</td></tr>
  </tbody>
</table>

<p><strong>O aluno que implementa algo na primeira semana tem 5x mais chance de completar o curso e 8x mais chance de indicar para alguém.</strong> O investimento de 3 horas para escrever uma sequência de onboarding gera o maior ROI de toda a operação de pós-venda.</p>`
          },
          {
            id: "indicacoes",
            title: "Programa de Indicação: Crescimento Orgânico pelo Boca a Boca",
            duration: "20 min",
            type: "text",
            keyPoints: ["Os 3 modelos de programa de indicação: qual usar para cada estágio do produto e audiência", "NPS: como interpretar e o que fazer com cada segmento (promotor, passivo, detrator)", "O email de convite para embaixadores — copy pronto para adaptar"],
            exercise: "Hoje mesmo: envie o NPS para seus últimos 20-30 clientes (formulário Google Forms de 1 pergunta: 'de 0 a 10, qual a probabilidade de você recomendar [produto] a um amigo?'). Quando receber as respostas: contate todos os 9-10 individualmente com o email de convite para embaixadores desta aula. Nem que seja 3 pessoas — um embaixador ativo vale 10 afiliados passivos.",
            content: `<h2>Indicação: O Canal com Maior Taxa de Conversão e Menor CAC</h2>

<p>Um lead vindo de indicação converte em média <strong>3-5x mais</strong> que um lead de anúncio pago — com CAC próximo de zero. A razão: chega com prova social embutida de alguém de confiança. Apesar disso, a maioria dos produtores deixa as indicações acontecerem ao acaso. Criar um programa formal pode dobrar esse volume.</p>

<h2>Os 3 Modelos de Programa de Indicação</h2>

<table>
  <thead>
    <tr><th>Modelo</th><th>Quem pode participar</th><th>Incentivo</th><th>Melhor para</th></tr>
  </thead>
  <tbody>
    <tr><td>Afiliados de alunos</td><td>Alunos que completaram + tiveram resultado documentado</td><td>Comissão de 20-40% por venda — só paga no resultado</td><td>Produtos de R$500+ com audiência de alunos engajados</td></tr>
    <tr><td>Give to Get</td><td>Qualquer aluno atual</td><td>Bônus por indicação que se cadastra (não necessariamente compra)</td><td>Gerar leads qualificados com lista pequena</td></tr>
    <tr><td>Embaixadores</td><td>Grupo seleto dos melhores alunos (10-20 pessoas)</td><td>Acesso privilegiado (calls exclusivas, conteúdo antecipado, créditos)</td><td>Construir autoridade de marca + evangelização contínua</td></tr>
  </tbody>
</table>

<h2>O Email de Convite para Embaixadores — Copy Pronto</h2>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">EMAIL DE CONVITE PARA EMBAIXADORES — ADAPTE E USE</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Assunto:</strong> [Nome], eu quero te oferecer algo especial<br/><br/>
Oi [nome],<br/><br/>
Você foi um dos alunos que mais me impressionou no [produto]. [Mencione algo específico — resultado, participação, transformação].<br/><br/>
Estou montando um grupo seleto de 15 embaixadores — pessoas que acreditam no método e querem fazer parte de algo maior.<br/><br/>
O que você ganha:<br/>
→ Acesso a todas as atualizações antes de todo mundo<br/>
→ Call mensal exclusiva comigo (30 min com o grupo)<br/>
→ [Bônus específico — ex: créditos, desconto em futuros produtos]<br/><br/>
O que eu peço:<br/>
→ Quando alguém perguntar sobre [produto] na sua rede, compartilhe sua experiência real<br/>
→ Nada de script — só a sua verdade<br/><br/>
Você topa?<br/>
[Seu nome]
</p>
</div>

<h2>NPS: Como Medir e Como Agir</h2>

<p>Uma única pergunta: "Em uma escala de 0 a 10, qual a probabilidade de você recomendar [produto] a um amigo?"</p>

<table>
  <thead>
    <tr><th>Pontuação</th><th>Classificação</th><th>O que fazer</th><th>Objetivo</th></tr>
  </thead>
  <tbody>
    <tr><td>9-10</td><td>Promotores</td><td>Convide para o programa de embaixadores + peça um depoimento em vídeo</td><td>Transformar satisfação em ativo de vendas</td></tr>
    <tr><td>7-8</td><td>Passivos</td><td>Pergunta de follow-up: "O que faria virar 10?"</td><td>Identificar o gap entre satisfeito e entusiasmado</td></tr>
    <tr><td>0-6</td><td>Detratores</td><td>Ligue ou mande DM — não email. Entenda o problema real. Resolva.</td><td>Resgate + evitar review negativo</td></tr>
  </tbody>
</table>

<p><strong>NPS = % Promotores - % Detratores.</strong> Acima de 50 é excelente. Abaixo de 30, o produto tem problema de entrega que nenhuma estratégia de marketing resolve.</p>

<p>Aplique o NPS no Dia 30 após a compra (quando o entusiasmo inicial passou mas o resultado ainda está sendo construído) e no Dia 90 (quando você tem o feedback de quem realmente aplicou).</p>`
          }
        ],
        locked: false
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
            title: "TikTok: Como Funciona e Como Crescer Sistematicamente",
            duration: "25 min",
            type: "text",
            keyPoints: ["Os 3 estágios de distribuição — e o que você precisa fazer para passar de cada um", "10 hooks de abertura prontos com variações por nicho", "O framework de criação de 1 vídeo/dia em 45 minutos"],
            exercise: "Grave hoje um vídeo de 30 segundos usando um dos 10 hooks desta aula. Não precisa ser perfeito — precisa ter: (1) hook nos primeiros 3s, (2) conteúdo acionável de 20s, (3) CTA de 5s. Publique e anote a taxa de retenção nos primeiros 30 minutos. Se estiver abaixo de 50%, experimente um hook diferente amanhã.",
            content: `<h2>TikTok: A Plataforma Que Quebrou as Regras do Jogo — E Como Jogar</h2>

<p>O TikTok é a única plataforma onde uma conta com zero seguidores pode viralizar no primeiro vídeo. Isso não é acidente — é a arquitetura do algoritmo. Entender isso muda completamente a estratégia.</p>

<h2>Os 3 Estágios de Distribuição — O Que Acontece Com Cada Vídeo</h2>

<table>
  <thead>
    <tr><th>Estágio</th><th>Visualizações</th><th>O que o algoritmo mede</th><th>Threshold para avançar</th></tr>
  </thead>
  <tbody>
    <tr><td>1 — Grupo de teste</td><td>100-500 views</td><td>Retenção, likes, comments, shares, rewatches</td><td>Retenção &gt;65% (vídeos curtos) ou &gt;40% (longos)</td></tr>
    <tr><td>2 — Expansão moderada</td><td>1k-50k views</td><td>Mesmas métricas + consistência vs. conteúdo anterior</td><td>Engajamento acima da média do nicho</td></tr>
    <tr><td>3 — FYP global</td><td>100k+</td><td>Taxa de compartilhamento + saves + completion rate</td><td>Shares e saves acima de 5% dos views</td></tr>
  </tbody>
</table>

<p><strong>O que a maioria não sabe:</strong> um vídeo pode sair do Estágio 1 para o Estágio 3 dias ou semanas depois de publicado. O TikTok não tem janela de tempo — ele continua testando conteúdo antigo se as métricas eram boas.</p>

<h2>A Métrica-Rainha: Taxa de Retenção</h2>

<table>
  <thead>
    <tr><th>Duração do vídeo</th><th>Retenção ruim</th><th>Retenção boa</th><th>Retenção excelente</th></tr>
  </thead>
  <tbody>
    <tr><td>15-30 segundos</td><td>&lt;50%</td><td>65-80%</td><td>&gt;85%</td></tr>
    <tr><td>1-2 minutos</td><td>&lt;35%</td><td>50-65%</td><td>&gt;70%</td></tr>
    <tr><td>3-5 minutos</td><td>&lt;25%</td><td>40-55%</td><td>&gt;60%</td></tr>
  </tbody>
</table>

<p><strong>Retenção baixa = queda de alcance.</strong> Se a maioria das pessoas sai nos primeiros 3 segundos, o algoritmo para de distribuir. O hook decide a retenção — e a retenção decide tudo.</p>

<h2>10 Hooks de Abertura Prontos — Variações por Nicho</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">HOOKS PRONTOS — ADAPTE O [CONTEXTO] PARA SEU NICHO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
1. "Em 60 segundos vou te mostrar [resultado específico] que levou [tempo] para descobrir"<br/>
2. "Pare de [ação comum do nicho] — você está desperdiçando [recurso]"<br/>
3. "Por que [resultado desejado] é mais simples do que todo mundo pensa"<br/>
4. "[Número] coisas que [referência de autoridade] faz e ninguém fala"<br/>
5. "Se você tem [condição do avatar], assiste isso até o final"<br/>
6. "Fiz [resultado chocante específico] com [recurso mínimo]. Deixa eu mostrar como"<br/>
7. "O erro que [profissão/nicho] comete todo dia sem perceber"<br/>
8. "Me diz nos comentários se você já passou por isso: [situação dolorosa específica]"<br/>
9. "Confia em mim — fica até o final. Tem uma virada que [contexto]"<br/>
10. "[Afirmação contraintuitiva]. Sim, é sério. E vou te explicar por quê"
</p>
</div>

<h2>O Framework de 1 Vídeo/Dia em 45 Minutos</h2>

<table>
  <thead>
    <tr><th>Etapa</th><th>Tempo</th><th>O que fazer</th></tr>
  </thead>
  <tbody>
    <tr><td>Escolher o tema</td><td>5 min</td><td>TikTok Creator Search Insights → sua palavra-chave de nicho → escolha 1 busca trending</td></tr>
    <tr><td>Escrever o roteiro</td><td>10 min</td><td>Hook (3s) + conteúdo acionável (20s) + CTA (5s) = 30s total. Escreva 3-4 frases.</td></tr>
    <tr><td>Gravar</td><td>10 min</td><td>3-5 takes. Não busque perfeição — busque naturalidade. Olhe na câmera.</td></tr>
    <tr><td>Editar no CapCut</td><td>15 min</td><td>Cortar pausas longas, adicionar legendas automáticas, música de fundo (-5dB), captions no hook.</td></tr>
    <tr><td>Publicar</td><td>5 min</td><td>Título = hook do vídeo. 3-5 hashtags (mix de nicho + tendência). Horário: 18h-21h.</td></tr>
  </tbody>
</table>

<h2>Estratégia de Nicho: Por que Você Não Deve Postar Sobre Tudo</h2>

<p>O TikTok aprende com o tempo quem é sua audiência. Quanto mais consistente o nicho do seu conteúdo, mais eficiente a distribuição — porque o algoritmo sabe para quem enviar.</p>

<p><strong>Regra prática:</strong> defina 1 problema central + 1 avatar específico. Fique nesse eixo por pelo menos 30 vídeos antes de diversificar. Essa consistência cria o "efeito de acumulação" — cada vídeo novo beneficia os anteriores porque o algoritmo já sabe quem te segue.</p>

<div style="background:#1a1a2e;border-left:3px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">AVISO: ERRO MAIS COMUM</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">Postar 1 vídeo sobre marketing, depois 1 sobre viagens, depois 1 sobre fitness confunde o algoritmo. Ele não sabe para quem te distribuir — então distribui para ninguém. Nichos específicos crescem mais rápido que nichos genéricos, sempre.</p>
</div>`
          },
          {
            id: "instagram-estrategia",
            title: "Instagram: Reels, Carrosséis e a Estratégia de Conversão",
            duration: "28 min",
            type: "text",
            keyPoints: ["Os 4 formatos do Instagram e o papel de cada um no funil — com duração ideal e benchmark de conclusão", "Estrutura de carrossel de 9 slides que maximiza save rate — com exemplo de cada slide", "Bio como mini landing page: template de 3 linhas + critérios de link na bio"],
            exercise: "Audite sua bio agora: ela diz claramente quem você ajuda, com qual resultado, e tem um CTA? Se não, reescreva usando o template de 3 linhas desta aula. Depois, olhe seus últimos 5 Carrosséis: o Slide 1 tem uma promessa irresistível? O slide final tem um CTA claro? Se não, refaça esses dois slides antes de publicar o próximo.",
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
            keyPoints: ["Cronograma de grupo de lançamento no Facebook: o que postar do D-21 ao D0", "YouTube: Shorts vs. vídeos longos — qual gera assinante vs. qual gera lead", "Stack de ferramentas de análise do YouTube Studio que 90% dos criadores nunca abre"],
            exercise: "Se você não tem canal no YouTube: pesquise as 5 keywords mais buscadas do seu nicho usando YouTube Search Suggest e escolha o tema do seu primeiro vídeo com potencial de SEO. Se já tem canal: abra o YouTube Studio → Analytics → Audience Retention e identifique em qual segundo exato as pessoas saem dos seus vídeos. Esse segundo é onde você vai melhorar o próximo hook.",
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
            keyPoints: ["Stack completo por nível: Nível 1 (grátis), Nível 2 (R$100-500/mês), Nível 3 (escala) — com função de cada ferramenta", "As 5 ferramentas de IA que cortam 60% do tempo de produção de conteúdo", "A regra do stack mínimo viável: por que a maioria começa com ferramentas demais"],
            exercise: "Faça o inventário do seu stack atual: liste todas as ferramentas que você paga hoje. Para cada uma, responda: uso isso pelo menos 3x por semana? Se não, cancele ou downgrade. A meta é ter no máximo 7 ferramentas pagas — uma por função. Foco, não acumulação.",
            content: `<h2>O Stack de Ferramentas do Produtor Digital Profissional</h2>
<p>A maioria dos iniciantes erra na ordem: compra ferramentas antes de saber o que fazer com elas. Este guia organiza o stack por estágio — começando pelo essencial gratuito e progredindo para ferramentas pagas conforme o negócio cresce. A regra de ouro: uma ferramenta por função. Redundância é custo.</p>

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
        locked: false
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
            keyPoints: ["Checklist completo de configuração do BM — passo a passo verificável", "Como testar se o pixel está disparando corretamente antes de gastar R$1", "CAPI: por que sem isso você está deixando 30-40% das conversões invisíveis"],
            exercise: "Se você ainda não tem BM configurado: siga o checklist desta aula e configure tudo hoje — leva 45-90 minutos. Se já tem: abra o Gerenciador de Eventos e verifique se todos os 5 eventos padrão estão disparando. Se 'Purchase' não aparecer, você está otimizando às cegas.",
            content: `<h2>Business Manager: A Infraestrutura que Protege seus Anúncios</h2>

<p>O erro mais comum de quem começa no Meta Ads é anunciar pelo perfil pessoal ou pela página sem o Business Manager. Resultado: qualquer problema na conta pessoal derruba tudo. BM é infraestrutura empresarial — separada do pessoal, com controle granular por ativo.</p>

<h2>Checklist Completo de Configuração — Siga na Ordem</h2>

<table>
  <thead>
    <tr><th>#</th><th>Passo</th><th>Onde</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>Criar o Business Manager</td><td>business.facebook.com</td><td>☐</td></tr>
    <tr><td>2</td><td>Adicionar Página do Facebook (ou criar uma)</td><td>BM → Ativos → Páginas</td><td>☐</td></tr>
    <tr><td>3</td><td>Criar Conta de Anúncios separada (nunca use a pessoal)</td><td>BM → Ativos → Contas de Anúncio</td><td>☐</td></tr>
    <tr><td>4</td><td>Adicionar método de pagamento</td><td>Conta de Anúncios → Configurações</td><td>☐</td></tr>
    <tr><td>5</td><td>Criar o Pixel e instalar no site</td><td>Gerenciador de Eventos → Adicionar Fonte</td><td>☐</td></tr>
    <tr><td>6</td><td>Verificar o domínio</td><td>BM → Configurações → Domínios</td><td>☐</td></tr>
    <tr><td>7</td><td>Configurar os 5 eventos padrão</td><td>Gerenciador de Eventos</td><td>☐</td></tr>
    <tr><td>8</td><td>Ativar API de Conversões (CAPI)</td><td>Gerenciador de Eventos → Configurações</td><td>☐</td></tr>
    <tr><td>9</td><td>Testar pixel com Meta Pixel Helper</td><td>Extensão Chrome</td><td>☐</td></tr>
    <tr><td>10</td><td>Adicionar conta do Instagram ao BM</td><td>BM → Ativos → Contas do Instagram</td><td>☐</td></tr>
  </tbody>
</table>

<h2>Os 5 Eventos de Pixel que Você Precisa Ter Configurados</h2>

<table>
  <thead>
    <tr><th>Evento</th><th>Quando dispara</th><th>Por que é essencial</th></tr>
  </thead>
  <tbody>
    <tr><td>PageView</td><td>Em qualquer página carregada</td><td>Rastreamento mínimo — sem isso você não tem dados</td></tr>
    <tr><td>ViewContent</td><td>Visita à página de vendas</td><td>Cria público de remarketing de página de vendas</td></tr>
    <tr><td>Lead</td><td>Cadastro de email ou WhatsApp</td><td>Permite otimizar para geração de leads</td></tr>
    <tr><td>InitiateCheckout</td><td>Início do processo de compra</td><td>Público de abandono de checkout — conversão altíssima</td></tr>
    <tr><td>Purchase</td><td>Compra concluída (com Value + Currency)</td><td>Permite calcular ROAS — sem isso você não sabe se está lucrando</td></tr>
  </tbody>
</table>

<h2>Como Testar se o Pixel Está Disparando</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">PROTOCOLO DE TESTE — 5 MINUTOS</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
1. Instale a extensão "Meta Pixel Helper" no Chrome<br/>
2. Abra sua página de vendas — o ícone deve mostrar "PageView" + "ViewContent" disparando<br/>
3. Clique em "comprar" e inicie o checkout — deve mostrar "InitiateCheckout"<br/>
4. Complete uma compra teste — deve mostrar "Purchase" com o valor correto<br/>
5. No Gerenciador de Eventos, verifique em "Testar Eventos" que os eventos chegaram<br/><br/>
<strong>Se algum evento não aparece: pare tudo e resolva antes de gastar qualquer verba.</strong>
</p>
</div>

<h2>CAPI: Por Que Sem Isso Você Perde 30-40% das Conversões</h2>

<p>Com as restrições de privacidade do iOS 14+, o Pixel de navegador perdeu capacidade de rastreamento. Usuários com bloqueadores de anúncio, navegação privada ou dispositivos iOS com "Não rastrear" ativo ficam invisíveis para o pixel.</p>

<p>A API de Conversões (CAPI) envia eventos diretamente do servidor — sem depender de cookies ou navegador. É uma segunda linha de rastreamento.</p>

<table>
  <thead>
    <tr><th>Configuração</th><th>Taxa de rastreamento</th><th>Qualidade do algoritmo</th></tr>
  </thead>
  <tbody>
    <tr><td>Só Pixel (sem CAPI)</td><td>50-60% das conversões</td><td>Algoritmo otimiza com dados incompletos</td></tr>
    <tr><td>Pixel + CAPI</td><td>85-95% das conversões</td><td>Algoritmo tem visão completa — otimiza melhor</td></tr>
  </tbody>
</table>

<p><strong>Como ativar:</strong> Gerenciador de Eventos → sua fonte de dados → Configurações → API de Conversões → Configurar manualmente (ou via integração com Hotmart/Kiwify/WordPress).</p>

<h2>Verificação de Domínio: Por Que é Obrigatório</h2>

<p>Após o iOS 14, a Meta exige que você verifique a propriedade do domínio antes de rastrear eventos. Sem isso, o Facebook pode restringir os eventos nos relatórios — e você perde controle sobre quais eventos são priorizados para otimização.</p>

<div style="background:#1a1a2e;border-left:3px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">COMO VERIFICAR O DOMÍNIO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
BM → Configurações → Domínios → Adicionar domínio → Escolha o método:<br/>
• Meta-tag: cole no &lt;head&gt; do site<br/>
• DNS: adicione registro TXT no painel do seu domínio (GoDaddy, Cloudflare, etc.)<br/><br/>
Tempo: 5 minutos para o DNS propagar. Depois clique "Verificar".
</p>
</div>`
          },
          {
            id: "meta-estrutura",
            title: "Estrutura de Campanha: CBO, ABO e Objetivos",
            duration: "25 min",
            type: "text",
            keyPoints: ["A primeira campanha estruturada para quem começa com pixel zerado — copy da estrutura pronta", "CBO vs. ABO: a tabela de decisão com exemplos reais", "Os 3 erros de configuração que queimam budget antes de gerar dados"],
            exercise: "Monte a estrutura da sua primeira campanha de teste agora: 1 campanha ABO, 3 conjuntos de R$20/dia cada, 2 anúncios por conjunto. Defina: objetivo, público por conjunto (amplo, lookalike, interesse), e o evento de otimização. Não precise rodar hoje — mas ter a estrutura desenhada elimina os erros de configuração na hora de criar.",
            content: `<h2>Estrutura de Campanha: A Hierarquia que Define Resultados</h2>

<p>O Meta Ads tem 3 níveis: Campanha (objetivo e orçamento global), Conjunto de Anúncios (público, placement, horário) e Anúncio (criativo, copy, CTA). Cada nível tem responsabilidades específicas — misturá-las é um dos erros mais caros.</p>

<h2>CBO vs. ABO: Tabela de Decisão</h2>

<table>
  <thead>
    <tr><th>Situação</th><th>Use ABO</th><th>Use CBO</th></tr>
  </thead>
  <tbody>
    <tr><td>Pixel com histórico</td><td>Menos de 50 conversões/semana</td><td>50+ conversões/semana</td></tr>
    <tr><td>Objetivo do momento</td><td>Fase de testes — dados iguais por conjunto</td><td>Fase de escala — algoritmo distribui livremente</td></tr>
    <tr><td>Controle necessário</td><td>Retargeting com verba garantida</td><td>Múltiplos públicos competindo</td></tr>
    <tr><td>Tamanho da conta</td><td>Budget total &lt;R$200/dia</td><td>Budget total &gt;R$300/dia</td></tr>
  </tbody>
</table>

<h2>Objetivos de Campanha: Qual Usar em Cada Fase</h2>

<table>
  <thead>
    <tr><th>Fase do funil</th><th>Objetivo</th><th>Quando usar</th><th>KPI de sucesso</th></tr>
  </thead>
  <tbody>
    <tr><td>Aquecimento</td><td>Visualizações de Vídeo</td><td>D-21 a D-8 do lançamento</td><td>CPV &lt;R$0,10 | VTR &gt;25%</td></tr>
    <tr><td>Captura de leads</td><td>Geração de Leads (formulário)</td><td>Quando LP converte menos de 30%</td><td>CPL &lt;10% do ticket</td></tr>
    <tr><td>Captura via LP</td><td>Conversões → Lead</td><td>Quando LP tem bom histórico de conversão</td><td>CPL &lt;10% do ticket</td></tr>
    <tr><td>Carrinho aberto</td><td>Conversões → Purchase</td><td>Dias de carrinho aberto</td><td>ROAS &gt;3x (fundo)</td></tr>
    <tr><td>High ticket</td><td>Mensagens (WhatsApp)</td><td>Produtos acima de R$3.000</td><td>Custo por conversa &lt;R$50</td></tr>
  </tbody>
</table>

<h2>A Primeira Campanha: Estrutura Pronta para Copiar</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">ESTRUTURA DE CAMPANHA — PIXEL SEM HISTÓRICO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Campanha:</strong> Conversões (Lead) | ABO | R$60/dia total<br/><br/>
├── <strong>Conjunto 1: Público Amplo</strong> | R$20/dia<br/>
│   Segmentação: só faixa etária + localização. Sem interesses.<br/>
│   2 anúncios: variação A (abordagem dor) e B (abordagem resultado)<br/><br/>
├── <strong>Conjunto 2: Lookalike 1%</strong> | R$20/dia<br/>
│   Fonte: lista de compradores anteriores ou visitantes da LP (mín. 300 pessoas)<br/>
│   2 anúncios: mesmos A e B do Conjunto 1<br/><br/>
└── <strong>Conjunto 3: Interesses Específicos</strong> | R$20/dia<br/>
    Interesses: 3-4 interesses do nicho, empilhados em um único conjunto<br/>
    2 anúncios: mesmos A e B<br/><br/>
<strong>Duração do teste:</strong> 7 dias sem mexer. Não pause, não altere. Deixe o algoritmo aprender.<br/>
<strong>Decisão com dados:</strong> após 7 dias, compare CPL dos 3 conjuntos. Pause o pior, escale os melhores.
</p>
</div>

<h2>Os 3 Erros Que Queimam Budget Antes de Gerar Dados</h2>

<table>
  <thead>
    <tr><th>Erro</th><th>Por que acontece</th><th>Consequência</th><th>Como evitar</th></tr>
  </thead>
  <tbody>
    <tr><td>Mexer na campanha antes de 7 dias</td><td>Impaciência — resultados ruins no dia 2-3</td><td>Reinicia a fase de aprendizado</td><td>Só analise depois de 7 dias com R$50+/dia gastos</td></tr>
    <tr><td>Orçamento muito baixo por conjunto</td><td>Tentativa de economizar</td><td>Sem dados suficientes para otimizar — algoritmo fica cego</td><td>Mínimo R$20/dia por conjunto de anúncios</td></tr>
    <tr><td>Muitos conjuntos competindo</td><td>Querer testar tudo de uma vez</td><td>Budget diluído — nenhum conjunto aprende</td><td>Máximo 3-4 conjuntos por campanha no início</td></tr>
  </tbody>
</table>

<h2>Fase de Aprendizado: O Que É e Por Que Importa</h2>

<p>O Meta precisa de pelo menos 50 eventos de otimização por semana por conjunto para sair da fase de aprendizado. Abaixo disso, o algoritmo está "tentando" — não otimizando de verdade.</p>

<p><strong>Sinais de que está na fase de aprendizado:</strong> tag "Aprendendo" no gerenciador, CPL muito variável dia a dia, nenhuma consistência de performance.</p>

<p><strong>Como sair mais rápido:</strong> use evento de otimização mais amplo (Lead em vez de Purchase), aumente o budget diário, ou consolide conjuntos similares em um só para concentrar os dados.</p>`
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
            title: "Criativos que Convertem: Copy e Estrutura Prontos",
            duration: "30 min",
            type: "text",
            keyPoints: ["Primary text completo de 5 variações por ângulo — copie e adapte", "A estrutura do vídeo de anúncio minuto a minuto", "O sistema de teste que descobre o criativo vencedor em 48h"],
            exercise: "Escreva 3 variações de primary text para o seu produto usando os templates desta aula: uma usando ângulo de dor, outra de resultado e uma de prova social. Escreva também 3 headlines de 40 caracteres. Esse banco de copy é o que você vai rodar na sua próxima campanha.",
            content: `<h2>Criativos que Convertem: O Copy e a Estrutura</h2>

<p>O criativo (vídeo/imagem + copy) é o fator que mais impacta a performance do Meta Ads — mais do que público ou estrutura. E é o único elemento que você pode trocar sem reiniciar a fase de aprendizado. Isso faz do criativo o principal laboratório de otimização.</p>

<h2>Primary Text: 5 Variações por Ângulo</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">ÂNGULO 1 — DOR (primeiras 3 linhas visíveis)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
"Você passa meses construindo audiência, cria um produto excelente — e no dia de abertura vende 8 unidades.<br/><br/>
O pior não é a receita baixa. É não saber onde foi que errou.<br/><br/>
O [produto] resolve isso: mapeia onde o funil quebrou e entrega o protocolo de correção. → Saiba mais no link"
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">ÂNGULO 2 — RESULTADO CHOCANTE</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
"R$[X] em [Y] dias com uma lista de [Z] pessoas.<br/><br/>
Não foi sorte, não foi lista grande, não foi afiliado. Foi uma sequência de [N] passos que qualquer pessoa de nicho pode replicar.<br/><br/>
O método completo está no [produto]. Vagas abertas até [data]. → Clique para ver"
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">ÂNGULO 3 — PROVA SOCIAL</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
"[Nome] aplicou o método em março. Resultado: R$[X].<br/><br/>
[Nome 2] começou do zero em [nicho]. Primeiro lançamento: R$[Y].<br/><br/>
São [N] histórias como essas. O que elas têm em comum? O mesmo método. → Veja como"
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">ÂNGULO 4 — CONTRAINTUITIVO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
"O erro que destrói 90% dos lançamentos não é falta de tráfego.<br/><br/>
É uma coisa específica que acontece entre o lead entrar na lista e o carrinho abrir. E quase ninguém corrige.<br/><br/>
No [produto], mostro exatamente o que é e como resolver em 48h. → Saiba mais"
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">ÂNGULO 5 — URGÊNCIA + ESCASSEZ</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
"Fechamos para [N] novos alunos nessa turma.<br/><br/>
[X vagas] foram preenchidas nas primeiras [Y]h.<br/><br/>
Restam [Z]. Fecha [data/hora]. → Garantir minha vaga agora"
</p>
</div>

<h2>Headlines: 3 Fórmulas com Exemplos</h2>

<table>
  <thead>
    <tr><th>Fórmula</th><th>Exemplo</th><th>Caracteres</th></tr>
  </thead>
  <tbody>
    <tr><td>Promessa direta</td><td>"De R$0 a R$10k: o método completo"</td><td>36</td></tr>
    <tr><td>Resultado + Objeção</td><td>"Fature mais sem lista grande"</td><td>29</td></tr>
    <tr><td>Urgência</td><td>"Último dia | Vagas abertas até meia-noite"</td><td>41</td></tr>
  </tbody>
</table>

<h2>Estrutura do Vídeo de Anúncio (30-90s)</h2>

<table>
  <thead>
    <tr><th>Bloco</th><th>Timing</th><th>Objetivo</th><th>Duração</th></tr>
  </thead>
  <tbody>
    <tr><td>Hook visual + verbal</td><td>0-3s</td><td>Parar o scroll</td><td>3s máximo</td></tr>
    <tr><td>Problema / Dor</td><td>3-10s</td><td>Criar identificação</td><td>7s</td></tr>
    <tr><td>Solução (sem entregar tudo)</td><td>10-40s</td><td>Criar desejo pela solução completa</td><td>30s</td></tr>
    <tr><td>Prova</td><td>40-60s</td><td>Validar a promessa</td><td>20s</td></tr>
    <tr><td>CTA claro</td><td>60-90s</td><td>Instruir a ação</td><td>10-30s</td></tr>
  </tbody>
</table>

<h2>UGC vs. Produção Profissional: Quando Usar Cada Um</h2>

<table>
  <thead>
    <tr><th>Tipo</th><th>Quando converte melhor</th><th>Por quê</th></tr>
  </thead>
  <tbody>
    <tr><td>UGC (câmera frontal, "caseiro")</td><td>Topo de funil, público frio, fase de teste</td><td>Parece conteúdo orgânico — menos resistência, mais confiança</td></tr>
    <tr><td>Produção profissional</td><td>Retargeting, produtos aspiracionais, alto ticket</td><td>Reforça credibilidade e posicionamento premium</td></tr>
    <tr><td>Screen recording / tutorial</td><td>Produtos de tecnologia, ferramentas, software</td><td>Demonstração direta — remove dúvida sobre "como funciona"</td></tr>
  </tbody>
</table>

<h2>O Sistema de Teste que Descobre o Vencedor em 48h</h2>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">PROTOCOLO DE TESTE DE CRIATIVO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
1. Mesmo conjunto de anúncios → 4-6 variações de criativo<br/>
2. Budget igual por criativo → dados comparáveis<br/>
3. Rodar 48h → analisar Hook Rate (% assistiu 3s) e CTR<br/>
4. Pausar os 2-3 com pior performance<br/>
5. Criar 2-3 variações dos vencedores — iterar<br/><br/>
<strong>Métricas que decidem o vencedor:</strong><br/>
Hook Rate &gt;30% (% assistiu primeiros 3s) + CTR &gt;1% + CPL abaixo da meta
</p>
</div>`
          },
          {
            id: "meta-otimizacao",
            title: "Otimização e Escala: Do R$50 ao R$5.000/dia",
            duration: "30 min",
            type: "text",
            keyPoints: ["Tabela de diagnóstico: problema → causa → solução para as 5 falhas mais comuns", "Benchmarks reais de CPM, CTR, CPL e ROAS por nicho no Brasil", "A regra de 20% para escala sem resetar o aprendizado"],
            exercise: "Abra sua campanha ativa agora e preencha esta checklist: CPM está dentro do benchmark do seu nicho? CTR do link está acima de 1%? CPL está abaixo de 10% do ticket? Se algum está fora, use a tabela de diagnóstico desta aula para identificar a causa raiz antes de fazer qualquer mudança.",
            content: `<h2>Otimização e Escala: O Que Fazer e Em Que Ordem</h2>

<p>A maioria das pessoas perde dinheiro no Meta Ads não porque as campanhas são ruins — mas porque mexem nelas cedo demais. A fase de aprendizado deve ser respeitada. Depois dela, você otimiza com dados — não com intuição.</p>

<h2>Benchmarks Reais por Nicho — Brasil 2025</h2>

<table>
  <thead>
    <tr><th>Nicho</th><th>CPM médio</th><th>CTR link alvo</th><th>CPL aceitável</th><th>ROAS mín. para escalar</th></tr>
  </thead>
  <tbody>
    <tr><td>Educação / Infoprodutos</td><td>R$15-35</td><td>&gt;1,5%</td><td>&lt;8% do ticket</td><td>&gt;3x</td></tr>
    <tr><td>Finanças / Investimentos</td><td>R$40-80</td><td>&gt;1%</td><td>&lt;10% do ticket</td><td>&gt;3,5x</td></tr>
    <tr><td>Saúde / Fitness</td><td>R$12-25</td><td>&gt;2%</td><td>&lt;7% do ticket</td><td>&gt;3x</td></tr>
    <tr><td>Marketing / Negócios</td><td>R$20-45</td><td>&gt;1,2%</td><td>&lt;10% do ticket</td><td>&gt;3x</td></tr>
    <tr><td>Relacionamentos / Coaching</td><td>R$18-38</td><td>&gt;1,8%</td><td>&lt;8% do ticket</td><td>&gt;3x</td></tr>
  </tbody>
</table>

<h2>Diagnóstico de Campanha: Problema → Causa → Solução</h2>

<table>
  <thead>
    <tr><th>Sintoma</th><th>Causa mais provável</th><th>Ação corretiva</th></tr>
  </thead>
  <tbody>
    <tr><td>CPM alto + alcance baixo</td><td>Público muito restrito ou CPM alto do nicho</td><td>Expanda o público ou teste horários de menor leilão (madrugada)</td></tr>
    <tr><td>CTR baixo (&lt;0,8%)</td><td>Criativo ou hook não está parando o scroll</td><td>Troque o hook — teste 4-6 variações nos próximos 48h</td></tr>
    <tr><td>CTR bom + CPL alto</td><td>Problema na landing page (copy, velocidade, oferta)</td><td>Revise a LP: headline, benefícios, CTA. Teste Hotjar para ver onde saem</td></tr>
    <tr><td>CPL bom + sem vendas</td><td>Lead mal qualificado ou funil pós-lead fraco</td><td>Revise a segmentação do público e o copy da sequência de nutrição</td></tr>
    <tr><td>Performance boa → deteriora rápido</td><td>Saturação — frequência acima de 3x para público frio</td><td>Renove criativos ou expanda o público. Frequência ideal frio: 1,5-2,5x</td></tr>
  </tbody>
</table>

<h2>A Regra dos 20% para Escalar Sem Resetar</h2>

<p>Quando uma campanha está performando bem e você quer escalar, não duplique o budget de uma vez. O algoritmo leva a campanha de volta para a fase de aprendizado se o aumento for muito brusco.</p>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">PROTOCOLO DE ESCALA</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Regra:</strong> aumente máximo 20% do budget a cada 3-4 dias<br/><br/>
Exemplo: R$100/dia → R$120/dia (3 dias) → R$144/dia (3 dias) → R$172/dia...<br/><br/>
<strong>Escala horizontal</strong> (mais segura): duplique o conjunto vencedor em uma nova campanha ABO separada. O original continua rodando sem interferência.<br/><br/>
<strong>Escala vertical</strong> (mais arriscada): aumenta budget no conjunto existente. Maior chance de resetar aprendizado.
</p>
</div>

<h2>Quando NÃO Mexer na Campanha</h2>

<table>
  <thead>
    <tr><th>Situação</th><th>O que fazer</th></tr>
  </thead>
  <tbody>
    <tr><td>Menos de 7 dias rodando</td><td>Não mexa em nada — fase de aprendizado</td></tr>
    <tr><td>Dia de fim de semana com performance baixa</td><td>Normal — comportamento de audiência muda no fim de semana</td></tr>
    <tr><td>CPL variou 30% vs. ontem</td><td>Variação diária é normal — analise tendência de 7 dias</td></tr>
    <tr><td>Frequência abaixo de 2x para público frio</td><td>Ainda não saturou — deixe rodar</td></tr>
  </tbody>
</table>

<h2>Regras de Automação: Proteja o Budget com Alerts</h2>

<p>Configure regras automáticas no gerenciador para agir enquanto você dorme:</p>

<table>
  <thead>
    <tr><th>Regra</th><th>Condição</th><th>Ação</th></tr>
  </thead>
  <tbody>
    <tr><td>Proteção de CTR</td><td>CTR &lt; 0,5% após 48h</td><td>Pausar o anúncio</td></tr>
    <tr><td>Alerta de CPL</td><td>CPL &gt; 150% da meta</td><td>Notificar por email</td></tr>
    <tr><td>Frequência</td><td>Frequência &gt; 4x para frio</td><td>Pausar o conjunto</td></tr>
    <tr><td>Gasto diário</td><td>Gasto &gt; 110% do orçamento diário</td><td>Pausar campanha</td></tr>
  </tbody>
</table>

<h3>Diagnóstico por Problema</h3>
<ul>
  <li><strong>CPM alto + CTR baixo → Público muito restrito ou saturado:</strong> expanda o público ou troque de segmento</li>
  <li><strong>CTR bom + CPL alto → Problema na landing page:</strong> a pessoa clica mas não converte — revise a página</li>
  <li><strong>CPL bom + nenhuma venda → Problema na qualidade do lead:</strong> revise a segmentação ou a oferta</li>
  <li><strong>Performance boa depois deteriorando → Saturação:</strong> freqüência acima de 3 para público frio — renove criativos ou expanda público</li>
</ul>

<blockquote>O maior inimigo do Meta Ads não é o algoritmo — é a impaciência. Campanhas que seriam vencedoras são pausadas antes de completar a aprendizagem. Dados sem paciência são apenas ruído.</blockquote>

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
        locked: false
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
        locked: false
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
        locked: false
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
            keyPoints: ["A equação que determina distribuição em qualquer plataforma — com benchmarks por sinal", "Sinais implícitos vs. explícitos: qual peso cada um tem no algoritmo", "Como auditar seu próprio conteúdo e identificar onde o algoritmo está parando de distribuir"],
            exercise: "Abra os analytics de um post seu que teve alcance baixo. Responda: qual foi o tempo médio de visualização? A taxa de conclusão estava abaixo do benchmark? Identifique o sinal mais fraco — e proponha um ajuste específico de conteúdo que melhoraria esse sinal no próximo post.",
            content: `<h2>Algoritmos de Recomendação: A Lógica Que Governa Toda Distribuição</h2>

<p>Todo algoritmo de recomendação de plataforma digital tem um único objetivo central: maximizar o tempo que o usuário passa na plataforma. Não é para ajudar o criador — é para manter as pessoas consumindo. Entender isso muda a perspectiva: você não precisa enganar o algoritmo. Você precisa criar conteúdo que faz pessoas ficarem — e o algoritmo distribui automaticamente.</p>

<h2>A Equação Universal dos Algoritmos</h2>

<table>
  <thead>
    <tr><th>Fator</th><th>O que é</th><th>Peso relativo</th><th>Como melhorar</th></tr>
  </thead>
  <tbody>
    <tr><td>Retenção</td><td>% do conteúdo que a pessoa consumiu</td><td>Muito alto — sinal mais difícil de manipular</td><td>Hooks mais fortes, ritmo sem pausas, CTAs internos</td></tr>
    <tr><td>Engajamento</td><td>Curtidas, saves, compartilhamentos, comentários</td><td>Alto — especialmente saves e shares</td><td>Peça ação específica no final do conteúdo</td></tr>
    <tr><td>Relevância</td><td>Match entre conteúdo e interesses do usuário</td><td>Alto — decide para quem distribui</td><td>Nicho consistente, keywords certas, hashtags específicas</td></tr>
    <tr><td>Velocidade de engajamento</td><td>Rapidez com que chegam os primeiros sinais</td><td>Médio-alto — influencia expansão inicial</td><td>Publique quando a audiência está ativa</td></tr>
    <tr><td>Frescor</td><td>Quão recente é o conteúdo</td><td>Médio — varia por plataforma</td><td>Frequência consistente de publicação</td></tr>
  </tbody>
</table>

<h2>Sinais Implícitos vs. Explícitos: Os Pesos Que Importam</h2>

<p>Os algoritmos evoluíram para confiar mais em comportamento do que em declarações. Um usuário pode curtir todo conteúdo de fitness que aparece, mas se não assiste até o final, o algoritmo entende que fitness não retém — e distribui menos.</p>

<table>
  <thead>
    <tr><th>Sinal</th><th>Tipo</th><th>Peso no algoritmo</th><th>O que revela</th></tr>
  </thead>
  <tbody>
    <tr><td>Taxa de conclusão do vídeo</td><td>Implícito</td><td>⭐⭐⭐⭐⭐</td><td>Valor real do conteúdo — difícil de fingir</td></tr>
    <tr><td>Rewatch (assistiu 2x+)</td><td>Implícito</td><td>⭐⭐⭐⭐⭐</td><td>Conteúdo com densidade alta — excepcional</td></tr>
    <tr><td>Tempo parado na tela (3s+)</td><td>Implícito</td><td>⭐⭐⭐⭐</td><td>Capturou atenção visual — para scroll</td></tr>
    <tr><td>Save / Favoritar</td><td>Explícito/implícito</td><td>⭐⭐⭐⭐</td><td>Intenção de revisitar — utilidade percebida</td></tr>
    <tr><td>Compartilhamento</td><td>Explícito</td><td>⭐⭐⭐⭐</td><td>Aprovação social — endosso a outro usuário</td></tr>
    <tr><td>Comentário longo</td><td>Explícito</td><td>⭐⭐⭐</td><td>Engajamento profundo — provocou reflexão</td></tr>
    <tr><td>Curtida</td><td>Explícito</td><td>⭐⭐</td><td>Menor peso — muito fácil de dar sem consumir</td></tr>
  </tbody>
</table>

<h2>O Loop de Feedback: Como um Post Chega (ou Não) ao Alcance Alto</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">O CICLO DE DISTRIBUIÇÃO — UNIVERSAL EM TODAS AS PLATAFORMAS</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
1. Conteúdo publicado → distribuído para grupo pequeno de usuários potencialmente interessados<br/>
2. Algoritmo mede: retenção, engajamento, velocidade dos sinais<br/>
3. Se sinais acima do threshold do nicho → expande para grupo maior<br/>
4. Se sinais abaixo → para distribuição (não pune, apenas não expande)<br/>
5. Repete até saturar ou o conteúdo perder performance<br/><br/>
<strong>Implicação prática:</strong> se seu post não performou, ele não foi punido. Ele simplesmente não passou do grupo de teste. Publique o próximo com hook mais forte.
</p>
</div>

<h2>Como Auditar um Post com Baixo Alcance</h2>

<table>
  <thead>
    <tr><th>Pergunta</th><th>Sinal problemático</th><th>Correção</th></tr>
  </thead>
  <tbody>
    <tr><td>Qual foi o tempo médio de visualização?</td><td>Abaixo de 50% da duração</td><td>Hook mais forte — os primeiros 3s estão falhando</td></tr>
    <tr><td>Qual foi a taxa de save?</td><td>Abaixo de 2% dos alcançados</td><td>Adicione lista, checklist ou template — algo para salvar depois</td></tr>
    <tr><td>Qual foi a taxa de compartilhamento?</td><td>Abaixo de 1%</td><td>O conteúdo não é "envio para um amigo" — mude o ângulo para mais específico ou contraintuitivo</td></tr>
    <tr><td>Havia CTA explícito?</td><td>Não</td><td>Sempre peça uma ação específica no final — "salva esse post", "manda para quem precisa ver"</td></tr>
  </tbody>
</table>`
          },
          {
            id: "algo-psicologia",
            title: "A Psicologia por Trás dos Sinais de Engajamento",
            duration: "25 min",
            type: "text",
            keyPoints: ["5 templates de hook baseados em cada gatilho psicológico — com exemplos por nicho", "Como criar loops abertos dentro do conteúdo para manter retenção", "O princípio do menor esforço cognitivo: como estruturar cada frase e cena"],
            exercise: "Escreva 5 hooks diferentes para o mesmo conteúdo — um usando cada gatilho desta aula: curiosidade, reconhecimento de identidade, dissonância, FOMO e antecipação de recompensa. Publique o que parecer mais forte e anote qual métrica mede o sucesso desse gatilho específico (ex: hook de FOMO → mede completion rate).",
            content: `<h2>A Psicologia do Scroll: O Que Para o Polegar</h2>

<p>Para usar o algoritmo a seu favor, você precisa entender o que está do outro lado: um cérebro em piloto automático, tomando micro-decisões a cada 1,7 segundo. O algoritmo distribui para quem sabe interromper esse piloto automático — e os 5 gatilhos abaixo são os mecanismos exatos.</p>

<h2>Os 5 Gatilhos Psicológicos — Templates Prontos</h2>

<h3>1. Curiosity Gap (Lacuna de Curiosidade)</h3>
<p>O cérebro tem aversão a lacunas de conhecimento. Quando percebe que sabe apenas parte de algo, sente desconforto e busca completar. A pessoa precisa chegar ao final.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:12px 16px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">TEMPLATE — CURIOSITY GAP</p>
<p style="color:#e2e8f0;font-size:13px;margin:0">
"O erro que [autoridade/99% das pessoas] comete[m] no [momento crítico do nicho]"<br/>
"A razão por que [resultado desejado] é mais difícil do que parece — e a solução que ninguém fala"<br/><br/>
<em style="color:#a0aec0">Exemplo: "O erro que 99% dos produtores cometem no dia de abertura do carrinho" → a pessoa precisa saber qual é o erro. Completion rate: alto.</em>
</p>
</div>

<h3>2. Self-Reference Effect (Reconhecimento de Identidade)</h3>
<p>O cérebro processa mais rapidamente informações que parecem relevantes para si mesmo. "Você" ativa atenção involuntária. Identidade específica funciona melhor que público amplo.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:12px 16px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">TEMPLATE — IDENTIDADE ESPECÍFICA</p>
<p style="color:#e2e8f0;font-size:13px;margin:0">
"Se você [ação específica do avatar] e [situação atual específica]..."<br/><br/>
<em style="color:#a0aec0">Exemplo: "Se você vende cursos online e está travado no mesmo faturamento há 3 meses, isso é para você." Quem se encaixa não consegue ignorar — quem não se encaixa sai (e isso é ok — filtra audiência certa).</em>
</p>
</div>

<h3>3. Dissonância Cognitiva (Pattern Interrupt)</h3>
<p>O cérebro filtra automaticamente o que já conhece. Uma afirmação que contraria crença estabelecida força atenção consciente — o sistema precisa "resolver" o conflito.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:12px 16px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">TEMPLATE — CONTRAINTUITIVO</p>
<p style="color:#e2e8f0;font-size:13px;margin:0">
"[Ação comum que todos acreditam que é certa] está [consequência negativa oposta ao esperado]"<br/><br/>
<em style="color:#a0aec0">Exemplo: "Postar todo dia no Instagram está destruindo seu alcance." — vai contra o que a maioria acredita. O cérebro para para "resolver" essa afirmação.</em>
</p>
</div>

<h3>4. FOMO (Fear of Missing Out — Ameaça Social)</h3>
<p>O cérebro primitivo prioriza ameaças. FOMO é uma ameaça social — a sensação de ficar para trás enquanto outros avançam.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:12px 16px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">TEMPLATE — FOMO</p>
<p style="color:#e2e8f0;font-size:13px;margin:0">
"Enquanto você [ação que o avatar está fazendo], [pessoas similares] estão [resultado superior]"<br/><br/>
<em style="color:#a0aec0">Exemplo: "Enquanto você otimiza seu funil pelo 15º mês, produtores com metade da sua audiência estão faturando o dobro com essa estratégia."</em>
</p>
</div>

<h3>5. Dopamina Antecipada (Loop Aberto)</h3>
<p>A dopamina é liberada não quando recebemos a recompensa — mas quando antecipamos recebê-la. Crie loops abertos que forçam a pessoa a ficar até o final para "fechar" o loop.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:12px 16px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">TEMPLATE — LOOP ABERTO</p>
<p style="color:#e2e8f0;font-size:13px;margin:0">
"Fique até o final porque vou revelar [algo específico] que [consequência]"<br/>
Em vídeo de 5 min: abra uma nova pergunta no minuto 2 que só responde no minuto 4.<br/><br/>
<em style="color:#a0aec0">Exemplo: "Antes de ir embora — no final desse vídeo vou te mostrar a planilha que uso para calcular isso automaticamente." A antecipação mantém 20-30% a mais de conclusão.</em>
</p>
</div>

<h2>O Princípio do Menor Esforço Cognitivo</h2>

<p>No estado de scroll, o cérebro escolhe sempre o caminho de menor resistência cognitiva. Conteúdo complexo é abandonado — não porque seja ruim, mas porque exige esforço demais.</p>

<table>
  <thead>
    <tr><th>Regra</th><th>Aplicação em vídeo</th><th>Aplicação em texto</th></tr>
  </thead>
  <tbody>
    <tr><td>Uma ideia por unidade</td><td>Uma cena por segundo de vídeo</td><td>Uma ideia por parágrafo, máximo 3 linhas</td></tr>
    <tr><td>Linguagem imediata</td><td>Fale para uma pessoa, não para uma plateia</td><td>Frases curtas. Sem jargão. Direto ao ponto.</td></tr>
    <tr><td>Progressão lógica</td><td>Cada segundo deve justificar o próximo</td><td>Cada frase deve fazer o leitor querer ler a próxima</td></tr>
  </tbody>
</table>`
          },
          {
            id: "algo-metricas-universais",
            title: "As 7 Métricas que Todo Algoritmo Mede",
            duration: "18 min",
            type: "text",
            keyPoints: ["Tabela de benchmarks: metas numéricas específicas para cada métrica em cada tipo de conteúdo", "Como melhorar cada uma das 7 métricas com técnicas concretas", "O diagnóstico de conteúdo: um framework para identificar qual métrica está te travando"],
            exercise: "Escolha seu último post com menor alcance. Abra os analytics e anote as métricas que a plataforma mostra. Compare com os benchmarks desta aula. Identifique a 1 métrica mais fraca. Escreva 3 ações concretas que melhorariam especificamente essa métrica no próximo conteúdo.",
            content: `<h2>As 7 Métricas Que Definem Distribuição em Qualquer Plataforma</h2>

<p>Cada plataforma tem nomenclatura diferente, mas estas 7 métricas aparecem em todos os algoritmos de recomendação. Conheça os benchmarks e você consegue diagnosticar qualquer problema de alcance.</p>

<h2>Benchmarks por Métrica e Tipo de Conteúdo</h2>

<table>
  <thead>
    <tr><th>Métrica</th><th>Vídeo curto (&lt;30s)</th><th>Vídeo médio (30s-3min)</th><th>Carrossel/Post</th><th>Como melhorar</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>Hook Rate</strong> (% que para e assiste 3s)</td><td>&gt;30%</td><td>&gt;25%</td><td>CTR &gt;3%</td><td>Teste 5 hooks diferentes no mesmo conteúdo</td></tr>
    <tr><td><strong>Completion Rate</strong> (% que assiste até o fim)</td><td>&gt;75%</td><td>&gt;50%</td><td>&gt;70% swipe through</td><td>Corte pausas, adicione CTAs internos no meio</td></tr>
    <tr><td><strong>Rewatch Rate</strong> (% que viu 2x+)</td><td>&gt;15%</td><td>&gt;8%</td><td>N/A</td><td>Informação muito densa, lista no final, revelação surpresa</td></tr>
    <tr><td><strong>Share Rate</strong> (% que compartilhou)</td><td>&gt;3%</td><td>&gt;2%</td><td>&gt;2%</td><td>Crie conteúdo "enviaria para um amigo específico"</td></tr>
    <tr><td><strong>Save Rate</strong> (% que salvou)</td><td>&gt;2%</td><td>&gt;3%</td><td>&gt;5%</td><td>Checklist, template, guia referência — algo para "usar depois"</td></tr>
    <tr><td><strong>Comment Quality</strong> (comentários &gt;10 palavras)</td><td>&gt;20% dos comments</td><td>&gt;30%</td><td>&gt;25%</td><td>Termine com pergunta de divisão de opinião</td></tr>
    <tr><td><strong>Profile Visit Rate</strong></td><td>&gt;3%</td><td>&gt;4%</td><td>&gt;2%</td><td>O conteúdo deve gerar curiosidade sobre quem o criou</td></tr>
  </tbody>
</table>

<h2>Cada Métrica em Detalhe — Como Gerar na Prática</h2>

<h3>1. Hook Rate — A Taxa de Parada</h3>
<p>Janela crítica: primeiros 1-3 segundos de vídeo ou primeira linha visível de texto. Determine o hook antes de qualquer outra decisão de criação.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:12px 16px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">HOOKS QUE PARAM O SCROLL</p>
<p style="color:#e2e8f0;font-size:13px;margin:0">
• Número chocante específico: "R$87k em 7 dias com 800 pessoas"<br/>
• Contraintuitivo: "Quanto mais você posta, menos te veem"<br/>
• Identidade: "Se você vende infoproduto e está travado no R$10k..."<br/>
• Curiosity gap: "O erro que destrói 90% dos lançamentos (não é o que você pensa)"
</p>
</div>

<h3>2. Completion Rate — O Sinal Mais Honesto</h3>
<p>Cada segundo "vazio" no vídeo custa pontos de completion rate. Regras práticas: corte qualquer introdução que não é o hook. Corte qualquer pausa acima de 1 segundo. Adicione um CTA interno no meio do vídeo ("continua porque tem uma virada no final").</p>

<h3>3. Rewatch Rate — O Multiplicador</h3>
<p>Vídeos que as pessoas assistem em loop geram o maior boost algorítmico. Para gerar rewatch: inclua uma informação muito densa que requer ver duas vezes, ou faça uma revelação impactante nos últimos 5 segundos que motiva ver desde o início.</p>

<h3>4. Share Rate — Endosso Social</h3>
<p>As pessoas compartilham conteúdo quando pensam "isso é exatamente o que [pessoa específica] precisa ver". Para gerar shares: seja muito específico com o avatar. "Isso aqui é para quem..." — quanto mais específico, mais as pessoas que se encaixam vão querer enviar.</p>

<h3>5. Save Rate — Utilidade Percebida</h3>
<p>As pessoas salvam conteúdo quando vão precisar de novo. Tipos de conteúdo com save rate alto: listas numeradas, checklists de ação, templates para preencher, benchmarks e números de referência, guias passo-a-passo.</p>

<h3>6. Comment Quality — Profundidade de Engajamento</h3>
<p>Alguns algoritmos analisam o comprimento e sentimento dos comentários — não apenas a quantidade. Para gerar comentários longos: termine com uma pergunta que não tem resposta óbvia, ou que provoca discordância saudável. "Você concorda com isso? Me conta nos comentários" gera mais resposta que "O que você achou?".</p>

<h3>7. Profile Visit Rate — Intenção de Seguir</h3>
<p>Quando alguém visita seu perfil após ver um conteúdo, o algoritmo interpreta que o criador gerou curiosidade além de um post isolado. Para aumentar: dê indicações de que tem mais conteúdo valioso no perfil. "Tenho mais 3 posts sobre isso aqui no perfil" — direcionamento explícito.</p>

<h2>Framework de Diagnóstico de Conteúdo</h2>

<div style="background:#1a1a2e;border-left:3px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">DIAGNÓSTICO EM 3 PASSOS</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
1. Meça: hook rate, completion rate, save, share (disponíveis nos insights nativos de cada plataforma)<br/>
2. Compare com benchmarks desta aula — identifique a métrica mais abaixo do esperado<br/>
3. Aplique a correção específica daquela métrica no próximo conteúdo — uma métrica por vez<br/><br/>
<strong>Regra:</strong> não tente melhorar tudo de uma vez. Uma variável por post permite saber o que funcionou.
</p>
</div>`
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
            keyPoints: ["Tabela de pesos dos sinais com benchmarks por tipo de vídeo", "Como o TikTok classifica o tópico do seu vídeo — e como fazer isso a seu favor", "O protocolo de publicação para maximizar velocidade de engajamento nas primeiras 2h"],
            exercise: "Abra o TikTok Studio e olhe os analytics dos seus últimos 10 vídeos. Identifique: qual tinha a maior completion rate? Qual era o assunto e o formato? Esse é o seu 'template vencedor' do algoritmo. Crie 3 variações do próximo vídeo usando o mesmo formato e anote qual completion rate você vai bater.",
            content: `<h2>O Sistema de Pontuação do TikTok: O Que Realmente Mede</h2>

<p>O algoritmo do TikTok não é uma lista de regras — é um modelo de machine learning que decide, a cada milissegundo, qual vídeo mostrar para qual usuário para maximizar o tempo na plataforma. Entender os fatores de ranking muda o que você prioriza ao criar.</p>

<h2>Os Fatores de Ranking e Seus Pesos</h2>

<table>
  <thead>
    <tr><th>Fator</th><th>Peso estimado</th><th>Benchmark para passar ao próximo estágio</th><th>Como otimizar</th></tr>
  </thead>
  <tbody>
    <tr><td>Completion Rate</td><td>~35%</td><td>&gt;70% (vídeos &lt;30s); &gt;45% (vídeos 30-90s)</td><td>Corte introduções, mantenha ritmo, CTA interno no meio</td></tr>
    <tr><td>Rewatch Rate</td><td>~25%</td><td>&gt;10% (vídeos &lt;30s)</td><td>Informação muito densa, revelação surpresa no final 5s</td></tr>
    <tr><td>Shares (especialmente fora do app)</td><td>~20%</td><td>&gt;2% dos views</td><td>Conteúdo "envio para alguém específico" — problema identificável</td></tr>
    <tr><td>Comentários (threads longas)</td><td>~12%</td><td>&gt;1% dos views</td><td>Pergunta polarizante no final — opinião dividida</td></tr>
    <tr><td>Curtidas</td><td>~8%</td><td>&gt;5% dos views</td><td>Menor peso — não otimize só para curtidas</td></tr>
  </tbody>
</table>

<h2>Velocidade de Engajamento: A Janela das Primeiras 2h</h2>

<p>O algoritmo não apenas mede a quantidade de engajamento — mede a velocidade com que chega. Um vídeo com 100 curtidas nas primeiras 2 horas tem score maior que um que recebe 100 curtidas ao longo de 24 horas.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">PROTOCOLO DE PUBLICAÇÃO — MÁXIMA VELOCIDADE DE ENGAJAMENTO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
1. Publique quando sua audiência está ativa (use Analytics → Seguidores → Horários ativos)<br/>
2. Nos primeiros 30 min: responda cada comentário que chegar (multiplica engajamento por 1,5-2x)<br/>
3. Cole o link nos seus outros Stories (Instagram) para tráfego cruzado<br/>
4. Fixe o vídeo no perfil temporariamente — novos visitantes assistem um vídeo fixado com mais frequência<br/>
5. Interaja em conteúdos do mesmo nicho ANTES de publicar — o algoritmo associa sua conta ao cluster
</p>
</div>

<h2>Como o TikTok Classifica o Tópico do Seu Vídeo</h2>

<p>O TikTok analisa 5 fontes para classificar o tópico:</p>

<table>
  <thead>
    <tr><th>Fonte</th><th>O que o algoritmo lê</th><th>Como otimizar</th></tr>
  </thead>
  <tbody>
    <tr><td>Transcrição do áudio</td><td>Palavras-chave faladas</td><td>Fale a keyword do nicho nos primeiros 10s do vídeo</td></tr>
    <tr><td>Texto sobreposto</td><td>Captions no vídeo</td><td>Primeira caption deve conter a keyword principal</td></tr>
    <tr><td>Título e caption</td><td>Texto descritivo do post</td><td>Título = pergunta que o avatar digitaria no buscador</td></tr>
    <tr><td>Hashtags</td><td>Categorização manual</td><td>3-5 hashtags: 1 muito específica + 1 médio + 1 ampla</td></tr>
    <tr><td>Análise visual</td><td>Objetos, cenário, faces (IA de visão)</td><td>Background consistente por nicho ajuda a classificação</td></tr>
  </tbody>
</table>

<h2>Por Que Vídeos Antigos Ainda Viralizam — E Como Usar Isso</h2>

<p>O TikTok não tem feed cronológico — tem feed de relevância. Um vídeo de 6 meses pode viralizar hoje se um usuário de alta influência compartilhar ou se o algoritmo encontrar um novo cluster compatível.</p>

<p><strong>Implicação prática:</strong> todo conteúdo publicado tem potencial de longa vida. Não apague vídeos com baixa performance inicial — eles podem ainda alcançar o estágio 2-3 semanas depois. Crie conteúdo "evergreen" (não date-specific) sempre que possível.</p>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">DICA: REPOSTING DE CONTEÚDO ANTIGO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
Se um vídeo teve 2.000-5.000 views mas baixo engajamento: edite nos primeiros 3 segundos (hook diferente), reposte. O algoritmo trata como conteúdo novo. Muitos criadores duplicam o alcance do mesmo conteúdo com um hook revisado — sem recriar tudo do zero.
</p>
</div>`
          },
          {
            id: "tiktok-deep-2",
            title: "Estratégia de Conta: Como Construir Autoridade de Nicho no TikTok",
            duration: "25 min",
            type: "text",
            keyPoints: ["O plano dos 30 primeiros vídeos — com tipos de conteúdo por semana", "TikTok Search: como encontrar keywords de nicho e criar vídeos que aparecem em buscas", "Duets e Stitches: script pronto para alcance emprestado sem parecer oportunista"],
            exercise: "Abra o TikTok Creator Search Insights agora e pesquise 3 palavras-chave do seu nicho. Anote os volumes de busca e as perguntas relacionadas. Escolha a pergunta com maior volume e menor competição — esse é o roteiro do próximo vídeo. Título do vídeo = a pergunta exata.",
            content: `<h2>Construindo Autoridade de Nicho no TikTok: Estratégia Completa</h2>

<h2>Por Que Especialização Bate Generalização — Com Dados</h2>

<p>O algoritmo aprende quem é sua audiência com base nos vídeos anteriores. Quanto mais consistente o nicho, mais preciso o modelo — e mais eficiente a distribuição para novos usuários.</p>

<table>
  <thead>
    <tr><th>Tipo de conta</th><th>Resultado típico nos 30 primeiros vídeos</th></tr>
  </thead>
  <tbody>
    <tr><td>Conta generalista (mistura de tópicos)</td><td>Algoritmo não consegue classificar → distribuição fragmentada → crescimento lento</td></tr>
    <tr><td>Conta de nicho específico (1 tema)</td><td>Classificação clara → pool de usuários maior dentro do nicho → crescimento composto</td></tr>
  </tbody>
</table>

<h2>O Plano dos 30 Primeiros Vídeos</h2>

<table>
  <thead>
    <tr><th>Semana</th><th>Tipos de conteúdo</th><th>Objetivo</th></tr>
  </thead>
  <tbody>
    <tr><td>1-2 (vídeos 1-10)</td><td>3 formatos diferentes: vídeo falado, texto na tela, demonstração/tutorial</td><td>Descobrir qual formato tem maior completion rate para o seu nicho</td></tr>
    <tr><td>3-4 (vídeos 11-20)</td><td>Dobrar o formato vencedor. 1 vídeo de busca (responde pergunta específica do nicho)</td><td>Calibrar o algoritmo com o formato que retém melhor</td></tr>
    <tr><td>5-6 (vídeos 21-30)</td><td>1 Stitch por semana, 1 vídeo de pergunta para audiência, 3 vídeos no formato principal</td><td>Crescimento via alcance emprestado + feedbacks da audiência para refinar</td></tr>
  </tbody>
</table>

<h2>TikTok Search: O Canal Subaproveitado que Gera Views Consistentes</h2>

<p>40% dos usuários da Geração Z preferem buscar no TikTok antes do Google. Vídeos otimizados para busca geram tráfego por meses — não apenas nas primeiras 48h.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">PROTOCOLO DE SEO PARA TIKTOK</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
1. Abra TikTok Creator Search Insights (disponível no TikTok Studio)<br/>
2. Pesquise sua palavra-chave de nicho → veja perguntas relacionadas com volume<br/>
3. Escolha a pergunta com volume médio-alto e baixa quantidade de vídeos respondendo<br/>
4. Título do vídeo = a pergunta exata que as pessoas digitam<br/>
5. Fale a keyword nos primeiros 10s do vídeo (transcrição de áudio)<br/>
6. Caption: "[Keyword] | resposta completa em 60 segundos"<br/><br/>
Exemplo: busca "como fazer lançamento digital" → keyword em baixa competição → "lançamento semente para iniciantes"
</p>
</div>

<h2>Duets e Stitches: Alcance Emprestado</h2>

<p>Quando você cria um Stitch com um vídeo popular, seu conteúdo herda parte do alcance do original — o algoritmo mostra para quem interagiu com o vídeo original.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">SCRIPT DE STITCH — TEMPLATE PRONTO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
"[Reproduz 3-5s do vídeo original]<br/><br/>
Esse ponto que [nome] trouxe é real — [confirme com experiência ou dado próprio].<br/>
O que eu adicionaria é: [complemento com insight único seu].<br/><br/>
E tem um detalhe que muda tudo: [virada contraintuitiva ou dado específico]."<br/><br/>
<em style="color:#a0aec0;font-size:12px">Nunca Stitch apenas para discordar de forma negativa. A estratégia mais eficaz é complementar e adicionar — você herda a audiência positiva do original.</em>
</p>
</div>

<h2>TikTok LIVE: O Algoritmo Separado que Expande a Conta</h2>

<p>O LIVE tem algoritmo próprio. Distribuído com base em: duração (quanto mais longa, mais alcance), presentes recebidos (sinaliza valor) e usuários simultâneos.</p>

<table>
  <thead>
    <tr><th>Duração da LIVE</th><th>Alcance típico</th><th>Notificação para seguidores</th></tr>
  </thead>
  <tbody>
    <tr><td>Menos de 15 min</td><td>Baixo — algoritmo não prioriza lives curtas</td><td>Sim, mas notificação apaga com a live</td></tr>
    <tr><td>30-60 min</td><td>Médio — aparece na tab de lives</td><td>Sim + aparece no Explore de não-seguidores</td></tr>
    <tr><td>60-90 min</td><td>Alto — algoritmo distribui ativamente</td><td>Notificação push + posição de destaque</td></tr>
  </tbody>
</table>

<p><strong>Estratégia para lançamento:</strong> 3 dias antes do carrinho abrir, faça uma LIVE de 45-60 min com conteúdo educacional do nicho. Anuncie o lançamento ao vivo. Gera urgência e audiência quente em tempo real.</p>`
          },
          {
            id: "tiktok-deep-3",
            title: "Conteúdo de Conversão no TikTok: Do Scroll à Venda",
            duration: "22 min",
            type: "text",
            keyPoints: ["O script exato dos 3 tipos de CTA para link na bio que convertem no TikTok", "A sequência de 10 vídeos de pré-lançamento — dia a dia, tema por tema", "Como calcular quantos leads o TikTok pode gerar para seu próximo lançamento"],
            exercise: "Planeje agora os 10 vídeos de pré-lançamento do seu próximo produto usando o calendário desta aula. Para cada vídeo: defina o tema, o hook de abertura (máx. 10 palavras) e o CTA para o link na bio. Isso é a campanha TikTok do lançamento — montada em 30 minutos.",
            content: `<h2>Conteúdo de Conversão no TikTok: Do Scroll à Venda</h2>

<p>O TikTok tem o maior alcance orgânico de qualquer plataforma — mas também a menor intenção de compra imediata. Quem tenta vender direto do TikTok (especialmente produtos acima de R$500) colide com esse comportamento. A estratégia certa usa o TikTok como gerador de audiência quente que vai para outros canais.</p>

<h2>O Funil TikTok → Conversão</h2>

<table>
  <thead>
    <tr><th>Faixa de ticket</th><th>Rota recomendada</th><th>Taxa de conversão esperada</th></tr>
  </thead>
  <tbody>
    <tr><td>Até R$297</td><td>TikTok → Link na bio → Checkout direto</td><td>0,5-2% dos views do vídeo</td></tr>
    <tr><td>R$297-R$997</td><td>TikTok → Link na bio → LP de captura → Email/WhatsApp → Venda</td><td>3-8% dos leads gerados</td></tr>
    <tr><td>Acima de R$997</td><td>TikTok → Instagram → WhatsApp (1:1) → Venda</td><td>10-25% das conversas iniciadas</td></tr>
  </tbody>
</table>

<h2>Os 3 CTAs para Link na Bio que Realmente Convertem</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">TIPO 1 — CONTINUAÇÃO EXCLUSIVA (conversão mais alta)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
Diga no vídeo: "Esse foi o Passo 1. Os passos 2, 3 e 4 com o template completo estão no link da bio — deixa lá por enquanto."<br/>
Por que funciona: cria lacuna de informação. A pessoa precisa completar o que você começou.
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">TIPO 2 — LEAD MAGNET (maior volume de leads)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
Diga no vídeo: "Tenho uma planilha que faz o cálculo que mostrei automaticamente. De graça. Link na bio."<br/>
Por que funciona: troca de valor imediata. Baixo atrito — sem precisar vender nada.
</p>
</div>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:10px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">TIPO 3 — LISTA DE ESPERA (para lançamentos)</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
Diga no vídeo: "Semana que vem abro as vagas do [produto]. Tem uma lista de espera no link da bio — quem entrar recebe 24h antes de todo mundo."<br/>
Por que funciona: urgência + exclusividade. Quem se inscreve na lista de espera tem taxa de conversão 3-4x maior que lead frio.
</p>
</div>

<h2>A Sequência de 10 Vídeos de Pré-Lançamento — Calendário</h2>

<table>
  <thead>
    <tr><th>Vídeo</th><th>Tema</th><th>CTA</th><th>Objetivo</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>O problema central — com dado específico</td><td>"Comenta aqui se você já passou por isso"</td><td>Criar identificação + comentários</td></tr>
    <tr><td>2</td><td>O erro mais comum que perpetua o problema</td><td>"Link na bio para o guia completo"</td><td>Lead magnet</td></tr>
    <tr><td>3</td><td>Por que soluções convencionais não funcionam</td><td>Nenhum — só conteúdo puro</td><td>Conteúdo viral (alto share rate)</td></tr>
    <tr><td>4</td><td>Resultado de alguém que resolveu o problema (prova)</td><td>"Segue para ver o método completo"</td><td>Prova social + seguidores</td></tr>
    <tr><td>5</td><td>Passo 1 da solução (ensinável em 60s)</td><td>"Passo 2 no link da bio"</td><td>Continuação exclusiva</td></tr>
    <tr><td>6</td><td>Bastidores / making of / processo</td><td>"Vem no grupo — link na bio"</td><td>Comunidade + WhatsApp</td></tr>
    <tr><td>7</td><td>Outro resultado / prova social diferente</td><td>"Lista de espera no link da bio"</td><td>Aquecimento para abertura</td></tr>
    <tr><td>8</td><td>O método resumido em 60s</td><td>"Vagas abertas [data] — lista de espera no link"</td><td>Teaser da abertura</td></tr>
    <tr><td>9</td><td>FAQ / objeção mais comum respondida</td><td>"Inscreva-se na lista de espera — 24h antes"</td><td>Conversão de lista</td></tr>
    <tr><td>10</td><td>Carrinho aberto — CTA direto</td><td>"Link na bio — vagas por [X]h"</td><td>Conversão direta</td></tr>
  </tbody>
</table>

<h2>Como Calcular o Potencial de Leads do TikTok</h2>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">CÁLCULO DE ESTIMATIVA DE LEADS</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
10 vídeos × 5.000 views médios = 50.000 views totais<br/>
Taxa de clique no link da bio: ~2%<br/>
Taxa de cadastro na LP: ~40%<br/><br/>
<strong>Leads estimados = 50.000 × 0,02 × 0,40 = 400 leads</strong><br/><br/>
Se seu produto converte 3% da lista → 12 vendas.<br/>
Se seu ticket é R$997 → R$11.964 de TikTok orgânico.<br/><br/>
Isso com 10 vídeos e zero reais em tráfego pago.
</p>
</div>`
          }
        ],
        locked: false
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
            keyPoints: ["Tabela completa de sinais e benchmarks por superfície (Feed, Explore, Reels, Stories)", "Como a performance no Feed alimenta o Explore — e o que isso significa para a ordem de publicação", "O protocolo de 60 minutos pós-publicação que maximiza o alcance em todas as superfícies"],
            exercise: "Nos próximos 7 dias, publique o mesmo conteúdo adaptado para 2 superfícies do Instagram: um Reel (para alcance novo) e um Carrossel (para Feed/seguidores). Compare: qual gerou mais saves? Qual gerou mais alcance? Qual gerou mais cliques no link da bio? Essa análise mostra onde sua audiência atual está e de onde vem audiência nova.",
            content: `<h2>Instagram: Quatro Superfícies, Quatro Lógicas — e Como Usar Cada Uma</h2>

<p>Adam Mosseri confirmou publicamente que cada superfície do Instagram usa sistemas diferentes. Isso não é detalhe técnico — é a diferença entre uma estratégia que funciona em todo o app e uma que só funciona numa parte.</p>

<h2>Tabela Completa: Sinais e Benchmarks por Superfície</h2>

<table>
  <thead>
    <tr><th>Superfície</th><th>Para quem mostra</th><th>Principal sinal</th><th>Benchmark alvo</th><th>Como otimizar</th></tr>
  </thead>
  <tbody>
    <tr><td>Feed</td><td>Seus seguidores</td><td>Histórico de interação com a conta</td><td>Taxa de saves &gt;3% + comentários nas 1as horas</td><td>Responda cada comentário nas primeiras horas</td></tr>
    <tr><td>Explore</td><td>Não-seguidores com perfil similar aos seus seguidores</td><td>Alta performance no Feed primeiro</td><td>Save rate &gt;5% + shares para Stories</td><td>Seu post no Explore só depois de performar bem no Feed</td></tr>
    <tr><td>Reels</td><td>Seguidores + expansão para não-seguidores</td><td>Completion rate + rewatch + shares</td><td>Completion &gt;65% (Reels curtos)</td><td>Hook nos primeiros 2s, sem introdução, ritmo constante</td></tr>
    <tr><td>Stories</td><td>Seguidores que interagem com você</td><td>Frequência de visualização + DMs trocados</td><td>Taxa de resposta às enquetes &gt;5%</td><td>Use enquetes e perguntas — interação recíproca</td></tr>
  </tbody>
</table>

<h2>O Fluxo Entre Superfícies: Como Elas se Alimentam</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">COMO O ALCANCE SE PROPAGA</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Passo 1:</strong> Você publica um post. Vai para o Feed dos seguidores primeiro.<br/>
<strong>Passo 2:</strong> Se a performance é boa entre seguidores (saves, comentários rápidos) → algoritmo expande para Explore.<br/>
<strong>Passo 3:</strong> Explore entrega para usuários com perfil similar aos seus seguidores que interagiram com posts similares.<br/>
<strong>Passo 4:</strong> Novo alcance gera novos seguidores → próximo post começa com base maior de seguidores → ciclo composto.<br/><br/>
<strong>Implicação:</strong> o Feed é a prova social interna que libera o Explore. Priorize performance com seguidores existentes antes de focar em alcance novo.
</p>
</div>

<h2>O Protocolo de 60 Minutos Pós-Publicação</h2>

<table>
  <thead>
    <tr><th>Tempo após publicação</th><th>Ação</th><th>Por que importa</th></tr>
  </thead>
  <tbody>
    <tr><td>0-5 min</td><td>Compartilhe o post nos seus Stories com sticker de link ou "novo post"</td><td>Direciona seguidores ativos ao post imediatamente</td></tr>
    <tr><td>0-30 min</td><td>Responda cada comentário que chegar</td><td>Cada resposta é um sinal adicional de engajamento — multiplica</td></tr>
    <tr><td>0-60 min</td><td>Mande por DM para 5-8 pessoas que genuinamente vão se importar com aquele conteúdo</td><td>Acelera os primeiros saves e comentários — vitrine para o algoritmo</td></tr>
    <tr><td>1-3h</td><td>Engaje nos Stories e posts de quem comentou no seu</td><td>Interação recíproca sobe sua conta na lista de Stories deles</td></tr>
  </tbody>
</table>

<h2>Diferenças Reels vs. TikTok: O Que Muda na Estratégia</h2>

<table>
  <thead>
    <tr><th>Aspecto</th><th>Instagram Reels</th><th>TikTok</th></tr>
  </thead>
  <tbody>
    <tr><td>Distribuição inicial</td><td>Prioriza seguidores existentes primeiro</td><td>Distribui para desconhecidos imediatamente</td></tr>
    <tr><td>Conta nova / zero seguidores</td><td>Alcance muito limitado no início</td><td>Pode viralizar no primeiro vídeo</td></tr>
    <tr><td>Audio trending</td><td>Moderado — áudio trending ajuda no Explore</td><td>Alto impacto — áudio trending multiplica alcance</td></tr>
    <tr><td>Duração ideal</td><td>7-30 segundos (Reels curtos convertem mais)</td><td>15-60 segundos para topo, 3-5 min para educação</td></tr>
  </tbody>
</table>`
          },
          {
            id: "ig-crescimento-estrategia",
            title: "Estratégia de Crescimento Acelerado no Instagram",
            duration: "28 min",
            type: "text",
            keyPoints: ["Plano de 90 dias: semana por semana — tipos de post, frequência e objetivo", "Como usar Collab Posts para dobrar o alcance de lançamento sem custo", "Broadcast Channel: taxa de abertura 60%+ e como usar para lista de espera de lançamento"],
            exercise: "Identifique agora 3 contas do seu nicho com audiência similar à sua que seriam ótimos parceiros de Collab Post. Mande uma DM hoje para pelo menos uma delas propondo um Collab Post — o pitch: 'Tenho uma ideia de conteúdo que beneficia a audiência de nós dois. 5 minutos de chamada?' Collab Posts bem executados geram 100-500 novos seguidores em 24h.",
            content: `<h2>Crescimento Orgânico Acelerado no Instagram: O Sistema de 90 Dias</h2>

<h2>O Plano de 90 Dias — Semana por Semana</h2>

<table>
  <thead>
    <tr><th>Semana</th><th>Formatos</th><th>Frequência</th><th>Objetivo</th><th>Proibido</th></tr>
  </thead>
  <tbody>
    <tr><td>1-4</td><td>1 Reel + 2 Carrosséis</td><td>3x/semana</td><td>Descobrir qual formato tem maior save rate para o nicho</td><td>Não venda nada — só entregue valor</td></tr>
    <tr><td>5-8</td><td>Formato vencedor + Stories diários</td><td>5x/semana</td><td>Engajamento com seguidores, feed de relacionamento</td><td>Não pule nenhum dia de Stories</td></tr>
    <tr><td>9-12</td><td>1 Collab Post/semana + Broadcast Channel + Aquecimento</td><td>5x/semana</td><td>Crescimento via alcance emprestado + construção de lista de espera</td><td>Não faça Collab Post com conta muito maior que a sua — audiência incompatível</td></tr>
  </tbody>
</table>

<p><strong>Meta de crescimento alcançável:</strong> 500-2.000 seguidores por mês no nicho certo com esse sistema e conteúdo de qualidade. Não é viral — é consistente e composto.</p>

<h2>Collab Posts: A Ferramenta de Alcance Mais Subestimada</h2>

<p>O Collab Post é uma funcionalidade nativa onde dois criadores publicam o mesmo post. Ele aparece no feed dos seguidores de AMBAS as contas — com os dois nomes no cabeçalho.</p>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">COMO USAR COLLAB POST PARA LANÇAMENTO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
1. Identifique 3-5 parceiros do mesmo nicho com audiência similar à sua<br/>
2. Proponha 1 post colaborativo de valor (não de venda) — ensine algo que beneficia a audiência de ambos<br/>
3. No dia de abertura do carrinho: Collab Post com CTA para o lançamento<br/>
4. Resultado: seu post alcança a audiência do parceiro + a sua = alcance dobrado sem custo<br/><br/>
<strong>Critério de parceiro ideal:</strong> mesma faixa de seguidores (±30%), mesmo nicho ou complementar, público que pode comprar seu produto
</p>
</div>

<h2>Hashtags em 2025: A Posição Oficial</h2>

<p>Adam Mosseri confirmou: hashtags em 2025 são <em>classificadoras de conteúdo</em>, não amplificadoras de alcance. Elas ajudam o algoritmo a entender o tema — não distribuem para mais pessoas.</p>

<table>
  <thead>
    <tr><th>Estratégia</th><th>Resultado esperado</th></tr>
  </thead>
  <tbody>
    <tr><td>30 hashtags genéricas (#motivação #vida #empreendedorismo)</td><td>Classificação confusa → pouco impacto</td></tr>
    <tr><td>5 hashtags muito específicas do nicho</td><td>Classificação precisa → melhor distribuição para audiência certa</td></tr>
    <tr><td>Mistura: 1 ampla + 2 médias + 2 específicas</td><td>Boa prática — equilibra alcance e precisão</td></tr>
  </tbody>
</table>

<h2>Broadcast Channel: Taxa de Abertura de 60%+ Para Lançamentos</h2>

<p>O Broadcast Channel é um canal unidirecional dentro do Instagram — você manda mensagens, membros leem (e podem reagir, mas não respondem publicamente).</p>

<table>
  <thead>
    <tr><th>Aspecto</th><th>Broadcast Channel</th><th>Comparação</th></tr>
  </thead>
  <tbody>
    <tr><td>Taxa de abertura</td><td>60-80%</td><td>Email: 20-35% | WhatsApp Group: 40-60%</td></tr>
    <tr><td>Notificação</td><td>Push notification automática</td><td>Mais proativo que posts do feed</td></tr>
    <tr><td>Ruído</td><td>Zero — membros não respondem publicamente</td><td>Muito mais limpo que grupos de WhatsApp</td></tr>
    <tr><td>Uso ideal</td><td>Lista de espera de lançamento, conteúdo exclusivo, bastidores</td><td>Equivalente premium ao grupo de WhatsApp</td></tr>
  </tbody>
</table>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">SEQUÊNCIA DE BROADCAST PARA LANÇAMENTO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
D-14: "Vou revelar algo importante aqui antes do que em qualquer outro lugar. Fica de olho."<br/>
D-7: Revele parte do que está vindo — teaser de conteúdo ou produto<br/>
D-3: "Abertura em 72h — aqui você vai saber 24h antes de todo mundo"<br/>
D-1: "Amanhã. Prepara."<br/>
D0 (abertura): Link direto + desconto ou bônus exclusivo para membros do Channel
</p>
</div>`
          }
        ],
        locked: false
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
            keyPoints: ["Benchmarks de CTR de thumbnail por tipo de canal — e o checklist dos 4 elementos", "AVD vs. % de conclusão: qual o YouTube realmente prioriza em cada sistema", "Como organizar playlists para multiplicar o watch time de sessão"],
            exercise: "Abra o YouTube Studio e olhe o CTR de thumbnail dos seus últimos 5 vídeos. Compare com os benchmarks desta aula. Se algum está abaixo de 2%, redesenhe a thumbnail: rosto + texto de 5 palavras + contraste alto. Teste a thumbnail nova no vídeo com menor CTR e anote a diferença em 7 dias.",
            content: `<h2>YouTube: Dois Sistemas de Distribuição em Um</h2>

<p>O YouTube é a única grande plataforma com dois sistemas de descoberta distintos operando simultaneamente: motor de busca (como o Google, mas para vídeo) e sistema de recomendação (home e sugeridos). Criadores que otimizam para ambos crescem 2-3x mais rápido.</p>

<h2>Motor 1: Busca — Como Ranquear por Anos</h2>

<table>
  <thead>
    <tr><th>Fator de ranqueamento</th><th>Onde otimizar</th><th>Impacto</th></tr>
  </thead>
  <tbody>
    <tr><td>Keyword no título (início)</td><td>Título do vídeo — primeiras 40 chars</td><td>Alto — principal sinal de relevância</td></tr>
    <tr><td>Keyword na descrição</td><td>Primeiros 200 chars antes do "ver mais"</td><td>Alto — indexado pelo algoritmo de busca</td></tr>
    <tr><td>CTR da thumbnail</td><td>Design da miniatura + força do título</td><td>Muito alto — baixo CTR mata distribuição</td></tr>
    <tr><td>Watch time pós-clique</td><td>Hook dos primeiros 30s</td><td>Alto — quem sai em 30s sinaliza desalinhamento</td></tr>
    <tr><td>Capítulos (timestamps)</td><td>Descrição — formato "0:00 Introdução"</td><td>Médio — aparece como key moments no Google</td></tr>
  </tbody>
</table>

<h2>Motor 2: Recomendação (Home + Sugeridos)</h2>

<p>O sistema de sugestão usa métricas diferentes do motor de busca:</p>

<table>
  <thead>
    <tr><th>Métrica</th><th>O que mede</th><th>Benchmark alvo</th></tr>
  </thead>
  <tbody>
    <tr><td>AVD (Average View Duration)</td><td>Minutos médios assistidos por visita</td><td>Acima de 40% da duração total</td></tr>
    <tr><td>Click-Through Rate (CTR)</td><td>% de impressões que clicaram</td><td>Canal novo: &gt;2%; Canal estabelecido: &gt;5%</td></tr>
    <tr><td>Watch time de sessão</td><td>Minutos que o usuário ficou no YouTube após o vídeo</td><td>Quanto mais alto, mais o vídeo é sugerido depois</td></tr>
    <tr><td>Satisfação pós-visualização</td><td>O usuário foi embora ou fez outra busca</td><td>Usuário satisfeito = sinal positivo</td></tr>
  </tbody>
</table>

<p><strong>AVD vs. % de conclusão:</strong> o sistema de sugestão prioriza AVD absoluto (minutos). Um vídeo de 20 min com AVD de 12 min (60%) supera um vídeo de 3 min com AVD de 2,5 min (83%) — porque gerou mais tempo no YouTube.</p>

<h2>CTR de Thumbnail: O Checklist dos 4 Elementos</h2>

<table>
  <thead>
    <tr><th>Elemento</th><th>Regra</th><th>Exemplo prático</th></tr>
  </thead>
  <tbody>
    <tr><td>Rosto humano</td><td>Expressão emocional clara (surpresa, curiosidade)</td><td>Foto com boca aberta, sobrancelhas levantadas</td></tr>
    <tr><td>Texto</td><td>Máximo 5 palavras — promessa ou pergunta</td><td>"Faturei R$100k sem lista" ou "Isso destruiu meu lançamento"</td></tr>
    <tr><td>Contraste</td><td>Fundo que se destaca no feed branco do YouTube</td><td>Fundo vermelho, laranja, amarelo — evite branco e cinza</td></tr>
    <tr><td>Elemento inesperado</td><td>Algo visualmente incomum no nicho</td><td>Seta apontando, antes/depois lado a lado, número grande</td></tr>
  </tbody>
</table>

<h2>Playlists: A Alavanca de Watch Time Ignorada</h2>

<p>Vídeos em playlists têm watch time de sessão significativamente maior porque o YouTube reproduz o próximo automaticamente. Um visitante que assiste 3 vídeos em sequência gera 3x mais watch time — e o algoritmo atribui ao canal inteiro.</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">ESTRUTURA DE PLAYLISTS PARA PRODUTORES</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
Organize por resultado desejado, não por módulo de conteúdo:<br/>
• "Como fazer seu primeiro lançamento" (vídeos sequenciais para iniciantes)<br/>
• "Meta Ads: do zero ao R$50k" (jornada de aprendizado)<br/>
• "Estudos de caso reais" (prova social agrupada)<br/><br/>
<strong>Dica:</strong> o último vídeo de cada playlist deve ter uma recomendação explícita de qual playlist assistir em seguida — mantendo o usuário no YouTube e acumulando watch time de sessão para o seu canal.
</p>
</div>

<h2>Benchmarks de CTR por Tipo de Canal</h2>

<table>
  <thead>
    <tr><th>Estágio do canal</th><th>CTR esperado</th><th>Se estiver abaixo disso</th></tr>
  </thead>
  <tbody>
    <tr><td>Canal novo (0-1.000 inscritos)</td><td>2-4%</td><td>Thumbnail fraca — revise os 4 elementos</td></tr>
    <tr><td>Canal crescendo (1k-50k)</td><td>4-8%</td><td>Título fraco — keyword não está forte o suficiente</td></tr>
    <tr><td>Canal estabelecido (50k+)</td><td>8-15%</td><td>Nicho perdendo relevância — diversifique temas</td></tr>
  </tbody>
</table>`
          },
          {
            id: "yt-seo",
            title: "YouTube SEO Avançado: Apareça em Buscas por Anos",
            duration: "22 min",
            type: "text",
            keyPoints: ["O protocolo de pesquisa de keyword em 4 ferramentas — com critérios de seleção", "Fórmula de título que ranqueia E tem CTR alto (com 5 exemplos reais)", "Template completo de descrição com os 5 blocos"],
            exercise: "Pesquise agora sua keyword principal de nicho no YouTube Search Suggest e no TubeBuddy/VidIQ. Encontre 3 keywords com volume médio e baixa competição. Escreva o título do próximo vídeo usando a fórmula [Keyword]: [Promessa] desta aula. Copie o template de descrição e preencha todos os 5 blocos.",
            content: `<h2>YouTube SEO: A Estratégia de Longo Prazo Que Ninguém Faz</h2>

<p>Um vídeo bem otimizado para busca pode gerar leads orgânicos por 3-5 anos. Um Reel do Instagram dura 48h de pico. O YouTube SEO é o único canal de conteúdo com esse horizonte temporal — e é o mais subestimado.</p>

<h2>Pesquisa de Keywords: 4 Ferramentas e Como Usar</h2>

<table>
  <thead>
    <tr><th>Ferramenta</th><th>Como usar</th><th>O que revela</th><th>Custo</th></tr>
  </thead>
  <tbody>
    <tr><td>YouTube Search Suggest</td><td>Digite a keyword + pare antes de confirmar — veja as sugestões</td><td>Buscas mais frequentes do YouTube em tempo real</td><td>Grátis</td></tr>
    <tr><td>TubeBuddy</td><td>Instale a extensão → aparece no gerenciador de vídeos</td><td>Volume estimado, dificuldade, oportunidade de keyword</td><td>Freemium</td></tr>
    <tr><td>VidIQ</td><td>Extensão Chrome — aparece ao lado dos vídeos do YouTube</td><td>Velocidade de crescimento dos concorrentes, keywords usadas</td><td>Freemium</td></tr>
    <tr><td>YouTube Studio → Pesquisa</td><td>Analytics → Pesquisa</td><td>Termos que já trouxeram pessoas ao seu canal — ouro para oportunidades</td><td>Grátis</td></tr>
  </tbody>
</table>

<p><strong>Critérios da keyword ideal:</strong> intenção de aprendizado ("como", "tutorial", "passo a passo") + volume médio-baixo (menos competição) + canais grandes sem responder especificamente aquela query.</p>

<h2>Títulos que Ranqueiam E Têm CTR Alto</h2>

<p>Existe tensão entre título de SEO (keyword no início) e título de CTR (promessa emocional). A solução é a fórmula que combina os dois:</p>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">FÓRMULA: [KEYWORD PRINCIPAL]: [PROMESSA OU CURIOSIDADE]</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
✓ "Lançamento Semente: Como Vendi R$47k Antes de Criar o Produto"<br/>
✓ "Meta Ads para Iniciantes: A Estrutura Que Ninguém Explica"<br/>
✓ "Funil Perpétuo: Por Que o Meu Fatura R$30k/mês Sozinho"<br/>
✓ "Copywriting de Lançamento: Os 5 Emails que Fizeram R$210k"<br/>
✓ "TikTok para Infoprodutos: Do Zero a 50k Seguidores em 90 Dias"<br/><br/>
<strong>Regra:</strong> keyword nos primeiros 40 caracteres (antes do corte no resultado de busca). Promessa depois — quanto mais específica, maior o CTR.
</p>
</div>

<h2>Template de Descrição com os 5 Blocos</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">TEMPLATE COMPLETO DE DESCRIÇÃO — COPIE E PREENCHA</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>BLOCO 1 (0-200 chars) — Resumo indexável:</strong><br/>
"Nesse vídeo eu mostro [o que o vídeo entrega] para [avatar] que quer [resultado]. [Keyword principal] de forma [diferencial]."<br/><br/>

<strong>BLOCO 2 — Recursos mencionados:</strong><br/>
"Ferramentas citadas nesse vídeo:<br/>
→ [Ferramenta 1]: [link]<br/>
→ [Template gratuito]: [link]<br/>
→ [Livro/recurso citado]: [link]"<br/><br/>

<strong>BLOCO 3 — Capítulos (timestamps):</strong><br/>
"0:00 Introdução<br/>
2:15 [Tópico 1]<br/>
8:30 [Tópico 2]<br/>
15:45 [Resultado final / conclusão]"<br/><br/>

<strong>BLOCO 4 — Outros vídeos relacionados:</strong><br/>
"Se gostou desse vídeo, assista também:<br/>
→ [Link vídeo relacionado 1]<br/>
→ [Link vídeo relacionado 2]"<br/><br/>

<strong>BLOCO 5 — Keywords secundárias (parágrafo natural):</strong><br/>
"[3-4 linhas mencionando naturalmente termos relacionados ao tema — variações da keyword, sinônimos, tópicos adjacentes]"
</p>
</div>

<h2>Como Aparecer no Google com Vídeos do YouTube</h2>

<p>O Google mostra vídeos para queries de "como fazer", "tutorial" e comparações. Para aparecer:</p>

<table>
  <thead>
    <tr><th>Ação</th><th>Por que funciona</th></tr>
  </thead>
  <tbody>
    <tr><td>Adicione capítulos (timestamps) à descrição</td><td>Google usa como "key moments" no resultado — aparece como mini-menu abaixo do vídeo</td></tr>
    <tr><td>Embedde o vídeo em um post do blog com o mesmo tema</td><td>Google favorece páginas com texto + vídeo relevante — dupla exposição</td></tr>
    <tr><td>Use a keyword do título como meta title da página de blog</td><td>Google correlaciona video + página — reforça relevância para a keyword</td></tr>
  </tbody>
</table>`
          }
        ],
        locked: false
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
            keyPoints: ["Por que grupos alcançam 15-40% dos membros enquanto páginas alcançam 1,5% — e o que fazer com isso", "Cronograma de grupo de lançamento: 21 dias de conteúdo planejado dia a dia", "Os 3 tipos de post que disparam o algoritmo do grupo nas primeiras horas"],
            exercise: "Se você vai fazer um lançamento nos próximos 60 dias, planeje agora o grupo de lançamento: defina o nome (baseado no resultado do produto, não no produto), a data de criação (D-21), e liste 7 temas de conteúdo para a primeira semana. O grupo criado agora, antes do lançamento começar, é um dos ativações mais impactantes da pré-abertura.",
            content: `<h2>Facebook Groups: O Algoritmo Que Ainda Entrega</h2>

<h2>Páginas vs. Grupos: A Diferença de Alcance em Números</h2>

<table>
  <thead>
    <tr><th>Tipo de ativo</th><th>Alcance orgânico médio</th><th>Para uma base de 5.000 pessoas</th></tr>
  </thead>
  <tbody>
    <tr><td>Página do Facebook</td><td>1,5-3% dos seguidores</td><td>75-150 pessoas por post</td></tr>
    <tr><td>Grupo bem gerenciado</td><td>15-40% dos membros</td><td>750-2.000 pessoas por post</td></tr>
    <tr><td>Diferença</td><td colspan="2">10-20x mais alcance orgânico — mesma plataforma, ativo diferente</td></tr>
  </tbody>
</table>

<p>Grupos têm status de "espaço de comunidade" no algoritmo do Facebook — não "espaço de mídia". O resultado é que o algoritmo ainda distribui posts de grupos para membros com muito mais liberalidade.</p>

<h2>Os 3 Tipos de Post que Disparam o Algoritmo do Grupo</h2>

<table>
  <thead>
    <tr><th>Tipo de post</th><th>Por que funciona</th><th>Exemplo</th></tr>
  </thead>
  <tbody>
    <tr><td>Pergunta polarizante</td><td>Gera comentários divergentes — algoritmo vê atividade e amplia</td><td>"Você prefere lançamento semente ou perpétuo? Por quê?" — sem resposta errada</td></tr>
    <tr><td>Vitória de membro</td><td>Cria narrativa de progresso + celebração coletiva</td><td>"[Nome] acabou de me mandar isso 👇" + screenshot de resultado</td></tr>
    <tr><td>Conteúdo de referência</td><td>Alto save rate — algoritmo vê como valioso</td><td>Checklist ou template que o membro vai usar — "Salva esse post"</td></tr>
  </tbody>
</table>

<h2>Cronograma de Grupo de Lançamento — 21 Dias</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">D-21 a D-0 — CALENDÁRIO COMPLETO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>D-21:</strong> Cria o grupo. Nome = resultado ("Desafio: Primeira Venda em 7 Dias"), não o produto.<br/>
<strong>D-21 a D-15:</strong> Conteúdo de aquecimento — vídeo curto/dia, PDF gratuito, enquete de diagnóstico. Zero menção ao produto.<br/>
<strong>D-14 a D-8:</strong> Educação profunda — respostas a perguntas do grupo, mini-treinamentos, apresentação de método. Cria dependência de conteúdo.<br/>
<strong>D-7 a D-2:</strong> Pré-lançamento — estudos de caso, AMA (Ask Me Anything) ao vivo, anúncio da data de abertura. Cria antecipação.<br/>
<strong>D-1:</strong> "Amanhã abrimos. Última chance de entrar na lista VIP dentro do grupo."<br/>
<strong>D0 (abertura):</strong> Post de lançamento com link + Live de 45-60min respondendo dúvidas ao vivo.<br/>
<strong>D+1 a D+5:</strong> Prova social diária (capturas de novos alunos), respostas a objeções, urgência crescente.<br/>
<strong>D+6 (fechamento):</strong> Posts a cada 3h — "faltam 6h", "faltam 3h", "faltam 1h", "carrinho fechado".
</p>
</div>

<h2>Facebook Events: Canal de Notificação Gratuito</h2>

<p>Crie um Event do Facebook para o webinar de abertura. Quando as pessoas marcam "Interessado" ou "Vou", o Facebook manda notificações automáticas nos dias anteriores.</p>

<table>
  <thead>
    <tr><th>Notificação automática do Facebook Events</th><th>Quando dispara</th></tr>
  </thead>
  <tbody>
    <tr><td>Lembrete de evento próximo</td><td>7 dias antes</td></tr>
    <tr><td>Lembrete de evento amanhã</td><td>1 dia antes</td></tr>
    <tr><td>Lembrete de evento hoje</td><td>Manhã do evento</td></tr>
    <tr><td>Lembrete "está começando"</td><td>15 min antes</td></tr>
  </tbody>
</table>

<p>Para um webinar de lançamento com 500 "Vou", isso são 2.000 notificações push sem custo adicional. Taxa de abertura de notificação do Facebook: 60-80%.</p>`
          },
          {
            id: "google-seo-intencao",
            title: "Google Search: O Algoritmo de Maior Intenção de Compra",
            duration: "25 min",
            type: "text",
            keyPoints: ["Os 3 tipos de intenção de busca: tabela com exemplos, estratégia de conteúdo e objetivo para cada um", "E-E-A-T: como sinalizar Experience, Expertise, Authority e Trust para o Google com exemplos práticos", "Checklist de 5 otimizações de landing page que afetam ranqueamento — com onde configurar cada uma"],
            exercise: "Pesquise agora no Google as 3 keywords mais relevantes para o seu produto (use a barra de busca do Google + seção 'Pessoas também perguntam'). Para cada keyword: qual é o tipo de intenção? Existe conteúdo seu ranqueando? Se não, escreva o título do artigo ou da landing page que você criaria para capturar essa busca nos próximos 30 dias.",
            content: `<h2>Google Search: O Canal com Maior Intenção de Compra do Marketing Digital</h2>

<p>Uma pessoa que busca "curso de lançamento digital" no Google já identificou o problema e está em modo de pesquisa ativa de solução. Isso é radicalmente diferente de alguém que encontrou um conteúdo no TikTok passivamente. Essa diferença de intenção explica por que tráfego orgânico do Google converte 2-5x melhor que redes sociais para produtos digitais.</p>

<h2>Os 3 Tipos de Intenção de Busca</h2>

<table>
  <thead>
    <tr><th>Tipo</th><th>% das buscas</th><th>Exemplo real</th><th>Estratégia de conteúdo</th><th>Objetivo</th></tr>
  </thead>
  <tbody>
    <tr><td>Informacional</td><td>60-70%</td><td>"como fazer lançamento semente", "o que é funil perpétuo"</td><td>Artigo 1.500+ palavras, guia completo, vídeo YouTube embedado</td><td>Capturar lead em troca do conteúdo</td></tr>
    <tr><td>Comparativa</td><td>20-25%</td><td>"melhor curso de marketing digital", "Hotmart vs Kiwify"</td><td>Posts de comparação, reviews, cases de resultado</td><td>Aparecer quando a pessoa está decidindo</td></tr>
    <tr><td>Transacional</td><td>5-10%</td><td>"comprar curso lançamento digital", "[seu produto] preço"</td><td>Landing page otimizada + Google Ads</td><td>Conversão imediata — menor volume, maior intenção</td></tr>
  </tbody>
</table>

<h2>E-E-A-T: Como Sinalizar Autoridade para o Google</h2>

<p>O Google avalia conteúdo com base em E-E-A-T. Cada letra tem sinais práticos que você pode implementar:</p>

<table>
  <thead>
    <tr><th>Letra</th><th>Significa</th><th>Como sinalizar</th><th>Exemplo prático</th></tr>
  </thead>
  <tbody>
    <tr><td>E — Experience</td><td>Experiência direta com o assunto</td><td>Mencione casos reais, números, datas específicas. Use primeira pessoa.</td><td>"Na minha primeira campanha, gastei R$3.400 e faturei R$47k. Aqui está o que funcionou."</td></tr>
    <tr><td>E — Expertise</td><td>Profundidade de conhecimento real</td><td>Vá além do óbvio. O Google distingue conteúdo superficial de especialista.</td><td>Inclua benchmarks, nuances, erros comuns, edge cases</td></tr>
    <tr><td>A — Authoritativeness</td><td>Autoridade percebida por outros</td><td>Backlinks de sites relevantes do nicho + menções em mídias</td><td>Guest posts, podcasts como convidado, menções no nicho</td></tr>
    <tr><td>T — Trustworthiness</td><td>Sinais de confiabilidade do site</td><td>HTTPS, política de privacidade, página de contato, sobre o autor</td><td>Adicione "Sobre o autor" com credenciais no final de cada artigo</td></tr>
  </tbody>
</table>

<h2>Checklist de Otimização de Landing Page para SEO</h2>

<table>
  <thead>
    <tr><th>Elemento</th><th>Regra</th><th>Onde configurar</th><th>Impacto</th></tr>
  </thead>
  <tbody>
    <tr><td>Title tag</td><td>Keyword principal nos primeiros 60 chars + diferencial único</td><td>Rank Math / Yoast (WordPress) | Page Settings (Webflow)</td><td>Alto — aparece no resultado do Google e determina CTR</td></tr>
    <tr><td>Meta description</td><td>155 chars — keyword + promessa clara + CTA</td><td>Mesmo plugin — afeta CTR, não diretamente o ranking</td><td>Médio — CTA forte aumenta cliques</td></tr>
    <tr><td>H1 único</td><td>Um por página, contém keyword principal</td><td>Primeiro heading da página</td><td>Alto — sinal de relevância do tema</td></tr>
    <tr><td>Schema de produto</td><td>Markup JSON-LD de Product/Course</td><td>Plugin Schema Pro ou direto no &lt;head&gt;</td><td>Médio — habilita rich results (preço, avaliações no Google)</td></tr>
    <tr><td>Core Web Vitals</td><td>LCP &lt;2.5s no mobile, CLS &lt;0.1</td><td>PageSpeed Insights → identifica problemas específicos</td><td>Alto — fator direto de ranking desde 2021</td></tr>
  </tbody>
</table>`
          }
        ],
        locked: false
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
            keyPoints: ["O modelo Hub & Spoke: como um vídeo de 20 minutos vira 12 peças de conteúdo — com ferramentas específicas", "A tabela de papel de cada plataforma no funil — quem alimenta quem", "O KPI que importa mais que seguidores: crescimento semanal da lista própria"],
            exercise: "Pegue o seu próximo conteúdo planejado (vídeo YouTube, podcast ou artigo longo). Antes de produzi-lo, liste todos os formatos derivados que vai criar a partir dele usando o modelo Hub & Spoke desta aula. Mínimo 5 derivados em 3 plataformas diferentes. Produza todos essa semana — o hub uma vez, os spokes na sequência.",
            content: `<h2>Multi-Plataforma: Um Conteúdo, 12 Peças, 6 Plataformas</h2>

<p>Presença multi-plataforma não significa criar conteúdo diferente para cada uma — significa criar um conteúdo central e distribuí-lo em formatos adaptados. Isso é o modelo Hub & Spoke: produção única, distribuição máxima.</p>

<h2>O Modelo Hub & Spoke: Como Funciona</h2>

<div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">UM VÍDEO DE 20 MIN = 12 PEÇAS DE CONTEÚDO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Hub:</strong> Vídeo longo YouTube (20-40 min) — produzido uma vez<br/><br/>
<strong>Spokes (derivados automáticos):</strong><br/>
→ 3-5 Shorts/Reels/TikToks dos melhores 60s (ferramenta: Opus Clip faz automaticamente)<br/>
→ 1 Carrossel Instagram com os 5-7 pontos principais<br/>
→ 1 Thread LinkedIn/Twitter com insights extraídos<br/>
→ 1 Email para lista: link do vídeo + resumo dos 3 pontos mais importantes<br/>
→ 3 Stories: enquete derivada do tema + bastidores de gravação + CTA<br/>
→ 1 Post no grupo Facebook com "o que você achou dessa estratégia?"<br/><br/>
<strong>Custo:</strong> produção de 1 conteúdo. <strong>Alcance:</strong> 6 plataformas × 40h de presença.
</p>
</div>

<h2>O Papel de Cada Plataforma no Funil</h2>

<table>
  <thead>
    <tr><th>Plataforma</th><th>Papel no funil</th><th>Alimenta</th><th>Métrica-chave</th></tr>
  </thead>
  <tbody>
    <tr><td>TikTok</td><td>Descoberta — novo público frio</td><td>Instagram, WhatsApp, Email</td><td>Leads gerados via link na bio</td></tr>
    <tr><td>Instagram Reels</td><td>Descoberta + aquecimento</td><td>WhatsApp, Email, Feed seguidor</td><td>Seguidores convertidos em lista</td></tr>
    <tr><td>YouTube</td><td>Autoridade + SEO longo prazo</td><td>Google, Email, WhatsApp</td><td>Leads por vídeo (30/60/90 dias)</td></tr>
    <tr><td>Facebook Group</td><td>Comunidade + conversão</td><td>Email, vendas diretas</td><td>Membros ativos + membros convertidos</td></tr>
    <tr><td>WhatsApp/Telegram</td><td>Conversão — contato direto</td><td>Vendas</td><td>Taxa de abertura de disparo</td></tr>
    <tr><td>Email</td><td>Conversão + relacionamento</td><td>Vendas recorrentes</td><td>Taxa de abertura + clique</td></tr>
  </tbody>
</table>

<h2>A Audiência Própria: O Ativo que os Algoritmos Não Controlam</h2>

<p>Seguidores nas redes sociais não são seus — são do Instagram, do TikTok, do YouTube. Quando uma plataforma muda o algoritmo, seu alcance pode cair 70% da noite para o dia. Isso já aconteceu: algoritmo do Facebook em 2012, Instagram em 2019, TikTok com regulações.</p>

<table>
  <thead>
    <tr><th>Ativo</th><th>Você controla?</th><th>Taxa de abertura</th><th>Valor por contato</th></tr>
  </thead>
  <tbody>
    <tr><td>Seguidores (Instagram/TikTok/YouTube)</td><td>Não — plataforma controla</td><td>2-15% (alcance algorítmico)</td><td>Baixo — intermediado por algoritmo</td></tr>
    <tr><td>Lista de email</td><td>Sim — você tem o endereço</td><td>20-45%</td><td>Médio-alto — contato direto</td></tr>
    <tr><td>Lista de WhatsApp</td><td>Sim</td><td>70-90%</td><td>Alto — maior taxa de conversão</td></tr>
    <tr><td>Comunidade paga</td><td>Sim</td><td>N/A — acesso por escolha</td><td>Muito alto — pagaram para estar lá</td></tr>
  </tbody>
</table>

<p><strong>O KPI mais importante:</strong> não é o número de seguidores — é o crescimento semanal da lista própria (email + WhatsApp). Construa isso primeiro. Use as redes sociais como motores de alimentação dessa lista — nunca como destino final.</p>

<div style="background:#1a1a2e;border-left:3px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 6px">META SEMANAL DE LISTA — CÁLCULO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
Se você adiciona 100 novos contatos/semana à lista de email + 50 ao WhatsApp, em 12 meses você tem:<br/>
Email: 5.200 contatos | WhatsApp: 2.600 contatos<br/><br/>
Para um produto de R$997 com 3% de conversão na lista de email:<br/>
5.200 × 3% = 156 vendas × R$997 = <strong>R$155.532</strong> — de um único lançamento.<br/><br/>
Essa é a lista que você construiu organicamente. O custo: R$0 em tráfego pago.
</p>
</div>`
          },
          {
            id: "algoritmo-acompanhar",
            title: "Como Acompanhar as Mudanças de Algoritmo sem Enlouquecer",
            duration: "20 min",
            type: "text",
            keyPoints: ["Tabela de fontes confiáveis por plataforma — o que seguir, o que ignorar", "O protocolo de 4 passos para testar hipóteses de algoritmo com seus próprios dados", "O que realmente muda vs. o que é ruído: a regra do comunicado oficial"],
            exercise: "Escolha uma hipótese sobre o algoritmo da sua plataforma principal que você quer testar. Escreva: a hipótese em 1 frase, o que você vai mudar (variável independente), o que vai medir (variável dependente), quantos posts vai testar e por quantas semanas. Execute o teste antes de acreditar em qualquer 'hack de algoritmo' que ler no próximo mês.",
            content: `<h2>Acompanhando Mudanças de Algoritmo: Fontes Confiáveis e Sistema de Teste</h2>

<p>O maior erro de quem aprende sobre algoritmos é pensar que o conhecimento é fixo. TikTok, Instagram e Google atualizam seus sistemas centenas de vezes por ano. A maioria das mudanças é incremental — mas algumas mudam radicalmente as regras. Saber o que seguir e o que ignorar vale meses de esforço desperdiçado.</p>

<h2>Fontes Confiáveis por Plataforma</h2>

<table>
  <thead>
    <tr><th>Plataforma</th><th>Fonte oficial</th><th>Fonte de análise confiável</th><th>Ignore</th></tr>
  </thead>
  <tbody>
    <tr><td>Instagram</td><td>@creators (Instagram) — updates de Adam Mosseri</td><td>Social Media Examiner — com dados reais</td><td>Qualquer "guru" que não cita fonte oficial</td></tr>
    <tr><td>TikTok</td><td>TikTok Newsroom + Creator Academy</td><td>TikTok Studio → Your Analytics (seus próprios dados)</td><td>"Hack secreto do FYP" sem link de fonte</td></tr>
    <tr><td>YouTube</td><td>YouTube Creator Blog — único oficial</td><td>@TeamYouTube no X/Twitter</td><td>Qualquer afirmação sobre "morte do YouTube SEO"</td></tr>
    <tr><td>Google</td><td>Google Search Central Blog</td><td>@searchliaison no X/Twitter</td><td>Listas de "200 fatores de ranking" sem fonte</td></tr>
    <tr><td>Meta Ads</td><td>Meta Business Blog</td><td>Jon Loomer Digital — dados verificados</td><td>Capturas de tela de "hacks de campanha" sem contexto</td></tr>
  </tbody>
</table>

<h2>A Regra do Comunicado Oficial</h2>

<div style="background:#1a1a2e;border-left:3px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0">
<p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;margin:0 0 8px">FILTRO DE RUÍDO</p>
<p style="color:#e2e8f0;font-size:14px;margin:0">
<strong>Ignore se:</strong> afirmação sem link para comunicado oficial, "o algoritmo mudou completamente" sem data específica, estratégia revelada por "ex-funcionário", "teste este hack antes que removam"<br/><br/>
<strong>Preste atenção se:</strong> comunicado de blog oficial com data, mudança confirmada por múltiplas fontes independentes com dados, estudo com metodologia clara (tamanho de amostra + período de teste)
</p>
</div>

<h2>O Protocolo de Teste de Hipóteses — 4 Passos</h2>

<p>Ao invés de acreditar em tudo que lê, teste você mesmo. Seus dados valem mais que a opinião de qualquer guru — porque seu nicho e audiência são únicos.</p>

<table>
  <thead>
    <tr><th>Passo</th><th>Ação</th><th>Exemplo</th></tr>
  </thead>
  <tbody>
    <tr><td>1. Hipótese</td><td>1 frase clara: "Se eu [mudança], então [resultado esperado]"</td><td>"Se eu publicar às 19h em vez de 9h, o alcance vai aumentar"</td></tr>
    <tr><td>2. Variável única</td><td>Mude apenas 1 coisa — múltiplas mudanças impossibilitam análise</td><td>Mude só o horário. Mantenha formato, nicho e copy iguais.</td></tr>
    <tr><td>3. Tamanho de amostra</td><td>Mínimo 8-10 posts por condição — nunca 2-3</td><td>10 posts às 19h vs. 10 posts às 9h ao longo de 4 semanas</td></tr>
    <tr><td>4. Métrica correta</td><td>Não curtidas — alcance orgânico, saves e CPL se for tráfego</td><td>Compare alcance orgânico médio das duas condições</td></tr>
  </tbody>
</table>

<p><strong>Por que isso importa:</strong> algoritmos se comportam diferente por nicho. Um horário que funciona para saúde pode ser irrelevante para finanças. Suas hipóteses testadas geram conhecimento real sobre seu negócio específico — mais valioso que qualquer regra genérica.</p>

<p>O algoritmo muda. A psicologia humana não. Conteúdo que retém atenção, gera emoção genuína e entrega valor real sempre vai ser distribuído — independente das mudanças. Domine a psicologia e você estará à frente das mudanças, sempre.</p>`
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
        locked: false
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
  },

  // ══════════════════════════════════════════════════════════════════
  // MÓDULO 8 — INTEGRAÇÕES E AUTOMAÇÕES: A MÁQUINA CONECTADA
  // ══════════════════════════════════════════════════════════════════
  {
    id: "integracoes-automacoes",
    number: 8,
    title: "Integrações e Automações: A Máquina Conectada",
    description: "A teoria sem execução técnica não gera receita. Este módulo preenche a lacuna entre aprender e operar: configura o Meta Business Manager profissional, instala CAPI server-side, conecta Hotmart/Kiwify ao pixel, monta automações de email e WhatsApp, cria webhooks entre plataformas e constrói o cronograma operacional completo de um lançamento. Ao final, sua máquina de lançamentos roda automaticamente — da captura ao pós-venda.",
    badge: "Automação",
    chapters: [

      // ── CAPÍTULO 22: META PIXEL, CAPI E BUSINESS MANAGER PROFISSIONAL ──
      {
        id: "meta-pixel-capi",
        number: 22,
        title: "Meta: Pixel Avançado, CAPI e Business Manager Profissional",
        subtitle: "A base técnica que determina a qualidade de todo o seu tráfego pago",
        icon: "🎯",
        color: "from-blue-800 to-indigo-900",
        duration: "2h 30min",
        summary: "O Pixel e o Business Manager são a fundação de qualquer operação séria de tráfego. Sem configuração correta, você paga por dados ruins e perde otimização. Com CAPI (Conversions API), você rastreia eventos que o iOS14+ bloqueou e recupera 20-40% de receita 'invisível'. Este capítulo não deixa nada de fora.",
        lessons: [
          {
            id: "meta-bm-profissional",
            title: "Arquitetura do Business Manager: Contas, Ativos e Permissões",
            duration: "25 min",
            type: "text",
            keyPoints: ["Estrutura correta: BM → Ad Account → Página → Pixel", "System Users vs. usuários pessoais — qual usar para cada função", "Permissões granulares: o que um gestor de tráfego pode e não pode acessar", "Domínio verificado: por que é obrigatório e como configurar", "Múltiplas contas de anúncio: quando e como usar"],
            content: `<h2>Por que 80% dos Produtores Têm o Business Manager Configurado Errado</h2>
<p>Um Business Manager mal configurado é como construir uma casa sobre areia. Pixels desassociados, permissões excessivas a parceiros, domínio não verificado — cada um desses erros reduz a qualidade dos seus dados e aumenta o risco de bloqueio da conta.</p>

<h3>A Hierarquia Correta de Ativos</h3>
<p>O BM tem uma estrutura hierárquica que precisa ser entendida antes de qualquer configuração:</p>
<pre>
Business Manager (seu CNPJ ou CPF)
├── Conta de Anúncios (1 por negócio/cliente)
│   ├── Campanhas
│   ├── Conjuntos de Anúncios
│   └── Anúncios
├── Página do Facebook (1 por marca)
├── Conta do Instagram (vinculada à Página)
├── Pixel do Meta (1 por domínio de conversão)
├── Catálogo de Produtos (se tiver e-commerce)
└── Usuários e Parceiros (gestores, agências)
</pre>

<h3>System Users: A Configuração que a Maioria Ignora</h3>
<p>System Users são usuários automáticos — não vinculados a nenhuma conta pessoal — usados para integrações API e automações. São essenciais para:</p>
<ul>
  <li>Integrar Conversions API sem depender do token de um funcionário que pode sair</li>
  <li>Dar acesso a ferramentas de automação (ManyChat, Zapier) sem compartilhar login pessoal</li>
  <li>Rotacionar tokens de acesso sem interromper campanhas</li>
</ul>
<p>Como criar: <strong>Business Manager → Configurações → Usuários do Sistema → Adicionar</strong>. Escolha nível "Administrador" para integrações CAPI e "Funcionário" para ferramentas de leitura.</p>

<h3>Verificação de Domínio: Obrigatório Pós-iOS14</h3>
<p>Sem domínio verificado, a Meta não processa conversões de forma confiável. É o pré-requisito para eventos de conversão e CAPI.</p>
<ol>
  <li>Business Manager → Brand Safety → Domínios → Adicionar</li>
  <li>Escolha método: DNS TXT record (recomendado), Meta-tag HTML ou upload de arquivo</li>
  <li>DNS: acesse o painel do seu domínio (GoDaddy, Cloudflare, HostGator) e adicione o registro TXT fornecido</li>
  <li>Aguarde propagação (2-24h) e clique em "Verificar"</li>
</ol>

<h3>Permissões para Parceiros: O que Dar e o que Nunca Dar</h3>
<table>
<tr><th>Parceiro</th><th>Permissão correta</th><th>Nunca dar</th></tr>
<tr><td>Gestor de tráfego</td><td>Gerenciar campanhas na conta de anúncios</td><td>Acesso admin ao BM</td></tr>
<tr><td>Agência</td><td>Acesso a conta de anúncios específica</td><td>Acesso ao Pixel ou Catálogo</td></tr>
<tr><td>Desenvolvedor</td><td>System User com permissão de eventos</td><td>Admin do BM</td></tr>
</table>

<blockquote>Nunca compartilhe acesso de Administrador ao Business Manager com parceiros externos. Use a função "Parceiro" para vincular o BM deles ao seu — assim eles trabalham com os ativos sem ter controle sobre a conta raiz.</blockquote>`
          },
          {
            id: "meta-pixel-avancado",
            title: "Pixel Avançado: Eventos Padrão, Customizados e Parâmetros",
            duration: "30 min",
            type: "text",
            keyPoints: ["Os 17 eventos padrão e quando usar cada um", "Eventos customizados: quando os padrão não são suficientes", "Parâmetros de evento: value, currency, content_ids", "Verificação com Pixel Helper e Events Manager", "Priorização de eventos pós-iOS14 (máximo 8 eventos por domínio)"],
            content: `<h2>O Pixel Não é Só Código — É uma Estratégia de Dados</h2>
<p>A maioria das pessoas instala o código base do Pixel e acha que terminou. Mas o Pixel sem eventos configurados é como uma câmera de segurança desligada: está lá mas não registra nada útil.</p>

<h3>Os 5 Eventos Essenciais para Lançamentos</h3>
<p>Dos 17 eventos padrão, estes são os que mais importam para um produtor digital:</p>

<p><strong>1. PageView</strong> — Disparado em qualquer página visitada. Base para retargeting de visitantes. Instale no <code>&lt;head&gt;</code> de todas as páginas.</p>
<p><strong>2. ViewContent</strong> — Visitou uma página específica de produto. Use na página de vendas, página de webinar, página de checkout. Parâmetros importantes: <code>content_name</code>, <code>content_type</code>.</p>
<p><strong>3. Lead</strong> — Cadastro/opt-in realizado. Dispare na confirmação de cadastro da lista de espera ou lead magnet. Parâmetros: <code>value</code> (valor estimado do lead), <code>currency: "BRL"</code>.</p>
<p><strong>4. InitiateCheckout</strong> — Acessou a página de checkout. Crítico para recuperação de carrinho abandonado.</p>
<p><strong>5. Purchase</strong> — Compra realizada. O evento mais importante. <strong>Obrigatório ter <code>value</code> e <code>currency</code></strong> para otimização de campanhas de valor.</p>

<h3>Instalação via Google Tag Manager (Recomendado)</h3>
<p>GTM é o método mais profissional — permite gerenciar todos os eventos sem mexer no código do site.</p>
<ol>
  <li>Crie uma conta no GTM e instale o contêiner no site</li>
  <li>No GTM: <strong>Tags → Nova → Tag de Pixel do Facebook</strong></li>
  <li>Adicione o Pixel ID (disponível no Events Manager)</li>
  <li>Gatilho: "Todas as Páginas" para PageView, gatilhos específicos para outros eventos</li>
  <li>Para Purchase: Gatilho = "Página de Agradecimento" com variáveis de valor da transação</li>
</ol>

<h3>Priorização de Eventos Pós-iOS14</h3>
<p>Desde iOS14, você pode rastrear no máximo 8 eventos por domínio de forma confiável. Priorize na seguinte ordem:</p>
<ol>
  <li>Purchase (prioridade 1 — nunca deve ficar de fora)</li>
  <li>Lead</li>
  <li>InitiateCheckout</li>
  <li>ViewContent (página de vendas)</li>
  <li>CompleteRegistration</li>
  <li>PageView</li>
</ol>

<h3>Verificando a Instalação</h3>
<p>Instale a extensão <strong>Meta Pixel Helper</strong> no Chrome. Acesse seu site e verifique:</p>
<ul>
  <li>Verde: Pixel carregou corretamente</li>
  <li>Laranja: Pixel carregou com alertas (geralmente eventos duplicados)</li>
  <li>Vermelho: Pixel com erros (geralmente ID errado ou bloqueio de script)</li>
</ul>

<blockquote>Nunca dispare o mesmo evento duas vezes na mesma página (ex: PageView no código + via GTM). Eventos duplicados inflam suas métricas e prejudicam a otimização algorítmica do Meta.</blockquote>`
          },
          {
            id: "meta-capi",
            title: "Conversions API (CAPI): Rastreamento Server-Side para o Mundo Pós-Cookie",
            duration: "32 min",
            type: "text",
            keyPoints: ["Por que iOS14+ destruiu o tracking client-side", "CAPI vs Pixel: complementares, não substitutas", "Event Match Quality (EMQ): o número que determina tudo", "Configurando CAPI via parceiros (Hotmart, Kiwify) e direto", "Desduplicação de eventos: como evitar contagem dupla"],
            content: `<h2>O Problema que Custou Bilhões ao Mercado</h2>
<p>Em abril de 2021, a Apple lançou o App Tracking Transparency (ATT) no iOS14. Com isso, ~65% dos usuários iOS passaram a bloquear o rastreamento client-side (cookies de terceiros). O resultado: o Pixel do Meta passou a "ver" apenas 40-60% das conversões reais.</p>

<p>Consequência prática: campanhas otimizando com dados incompletos, ROAS aparentemente baixo, decisões ruins de escala/corte. Produtores que não implementaram CAPI estão gerenciando mídia essencialmente com metade dos dados.</p>

<h3>Como a Conversions API Funciona</h3>
<p>O Pixel dispara do navegador do usuário (client-side) e pode ser bloqueado por ad blockers, iOS14+, browsers que bloqueiam cookies de terceiros.</p>
<p>A CAPI dispara do <strong>seu servidor</strong> (server-side) — não pode ser bloqueada pelo navegador do usuário. A Meta recebe os eventos diretamente da sua infraestrutura.</p>

<pre>
PIXEL (client-side):
Usuário → Navegador → [pode ser bloqueado] → Meta

CAPI (server-side):
Usuário → Seu servidor → [nunca bloqueado] → Meta
</pre>

<p>Usar <strong>ambos</strong> (Pixel + CAPI) com desduplicação é o ideal — cobertura máxima com dados limpos.</p>

<h3>Event Match Quality (EMQ)</h3>
<p>EMQ é o score de 0-10 que o Meta atribui à qualidade dos dados que você envia. Quanto maior, melhor a correspondência do evento com um usuário real na base do Meta — melhor a otimização.</p>
<table>
<tr><th>EMQ</th><th>Status</th><th>O que melhorar</th></tr>
<tr><td>7-10</td><td>Excelente</td><td>Manter — envie email hash e phone hash</td></tr>
<tr><td>5-6</td><td>Bom</td><td>Adicionar fbp/fbc (cookies), nome e sobrenome</td></tr>
<tr><td>3-4</td><td>Baixo</td><td>Revisar o que está sendo enviado, adicionar email</td></tr>
<tr><td>0-2</td><td>Crítico</td><td>Nada útil sendo enviado, reconfigurar</td></tr>
</table>

<h3>Opção 1: CAPI via Plataformas Parceiras (Hotmart, Kiwify)</h3>
<p>A forma mais simples — sem código. Hotmart e Kiwify têm integração nativa com a CAPI da Meta.</p>
<p><strong>Hotmart:</strong> Ferramentas → Pixels → Adicionar Pixel → Escolha "Meta Pixel + CAPI" → Cole o Pixel ID e o Access Token do System User.</p>
<p><strong>Kiwify:</strong> Configurações → Integrações → Meta Conversions API → Cole Pixel ID e Token.</p>
<p>O Access Token de CAPI é gerado em: <strong>Events Manager → Configurações → Conversions API → Gerar Token de Acesso</strong>. Use um System User para gerar um token estável (não vinculado a pessoa).</p>

<h3>Opção 2: CAPI via GTM Server-Side</h3>
<p>Nível avançado — requer um servidor GTM (custo ~$5-15/mês no Google Cloud). Permite rastrear eventos customizados com alta precisão e controle total dos dados.</p>
<ol>
  <li>Crie um contêiner Server no GTM</li>
  <li>Provisione um servidor no Google Cloud Run</li>
  <li>Instale o template "Facebook Conversions API" no servidor GTM</li>
  <li>Configure o routing: eventos do GTM client → GTM server → Meta</li>
</ol>

<h3>Desduplicação: Garantindo Dados Limpos</h3>
<p>Quando Pixel e CAPI disparam para o mesmo evento, o Meta recebe dois sinais. Sem desduplicação, conta duas compras. Com desduplicação, usa apenas o melhor dado.</p>
<p>Como implementar: envie o mesmo <code>event_id</code> no Pixel e na CAPI para o mesmo evento. A Meta usa esse ID para identificar duplicatas e manter apenas um registro.</p>

<blockquote>A CAPI não é configuração avançada opcional — é infraestrutura básica em 2025. Quem não tem CAPI está pagando mais por leads e vendas que já aconteceram mas o Meta não viu. Configure hoje.</blockquote>`
          },
          {
            id: "meta-attribution",
            title: "Attribution e Mensuração Real: Descobrindo o que Realmente Vendeu",
            duration: "22 min",
            type: "text",
            keyPoints: ["Modelos de atribuição: primeiro clique, último clique, data-driven", "Por que o ROAS do Meta Ads Manager está errado", "UTMs: a camada de dados que o pixel não captura", "Triple counting: quando sua campanha parece vender 3x mais do que vende", "O relatório de mensuração correto para lançamentos"],
            content: `<h2>O Número que Está Enganando Você</h2>
<p>O ROAS exibido no Ads Manager do Meta é provavelmente 30-60% maior do que o ROAS real. Isso não é bug — é como o modelo de atribuição padrão funciona, e entendê-lo é a diferença entre escalar campanhas lucrativas e escalar prejuízo.</p>

<h3>Modelos de Atribuição do Meta</h3>
<p>O Meta usa por padrão atribuição de "1 dia após clique + 7 dias após visualização". Isso significa:</p>
<ul>
  <li>Se alguém clicou no seu anúncio e comprou em até 24h: atribuído ao anúncio ✓</li>
  <li>Se alguém <strong>viu</strong> o seu anúncio (sem clicar) e comprou em até 7 dias: também atribuído ao anúncio 🚨</li>
</ul>
<p>Resultado: pessoas que comprariam de qualquer jeito (via email, pesquisa orgânica, indicação) são contadas como resultado da campanha de anúncio.</p>

<h3>UTMs: A Camada de Dados Independente</h3>
<p>UTM Parameters são tags adicionadas às URLs dos anúncios que permitem rastrear a origem da visita no Google Analytics, independente do tracking do Meta.</p>
<p>Exemplo de URL com UTM:</p>
<pre>https://seusite.com/vendas?utm_source=meta&utm_medium=paid&utm_campaign=lancamento-junho&utm_content=video-depoimento-1</pre>

<p>No Ads Manager: edite o anúncio → URL do site → Parâmetros de URL → adicione os UTMs. Use o mesmo formato em todos os anúncios para padronizar relatórios.</p>

<h3>O Relatório Correto: Triangulação de Dados</h3>
<p>Para mensuração precisa, use três fontes de dados simultaneamente:</p>
<table>
<tr><th>Fonte</th><th>O que mede</th><th>Limitação</th></tr>
<tr><td>Meta Ads Manager</td><td>Cliques, impressões, conversões atribuídas</td><td>Sobre-atribuição via view-through</td></tr>
<tr><td>Google Analytics 4</td><td>Sessões, origem real do tráfego, UTMs</td><td>Sub-atribui sem-cookie (iOS)</td></tr>
<tr><td>Plataforma de checkout (Hotmart)</td><td>Vendas reais com dados do comprador</td><td>Não sabe de onde veio o tráfego sem UTM</td></tr>
</table>

<p>A atribuição real = intersecção dos dados das 3 fontes. Quando GA4 e Hotmart confirmam o que o Meta Ads Manager reporta, você pode confiar no número.</p>

<h3>Attribution Window Recomendada para Lançamentos</h3>
<p>Para lançamentos com janela de 5-7 dias de carrinho aberto, configure:</p>
<ul>
  <li><strong>Clique:</strong> 7 dias (janela do lançamento)</li>
  <li><strong>Visualização:</strong> Desligar ou 1 dia (reduz sobre-atribuição)</li>
</ul>
<p>Isso dá uma visão mais honesta do que os anúncios realmente geraram durante o período do carrinho.</p>`
          },
          {
            id: "meta-system-user",
            title: "System Users, Tokens de API e Automação de Anúncios",
            duration: "20 min",
            type: "text",
            keyPoints: ["Gerando tokens de acesso de longa duração via System User", "Permissões necessárias para cada tipo de integração", "Marketing API: criando anúncios programaticamente (conceitos)", "Catalog API: sincronizando produtos automaticamente", "Alertas automáticos: como ser notificado quando campanhas param"],
            content: `<h2>A Camada de API que Profissionais Usam</h2>
<p>A maioria dos produtores usa o Meta Ads Manager via interface web. Profissionais de alto nível usam a Marketing API — o que permite automações, relatórios customizados e integrações que a interface não oferece.</p>

<h3>Criando um System User para Integrações</h3>
<ol>
  <li>Business Manager → Configurações → Usuários → Usuários do Sistema</li>
  <li>Adicionar Usuário do Sistema → Nível: Administrador (para CAPI e API)</li>
  <li>Atribuir Ativos: selecione Pixel, Conta de Anúncios, Página e Catálogo</li>
  <li>Gerar Token de Acesso → Selecione os escopos necessários</li>
  <li>Copie e armazene o token em local seguro (não expira automaticamente)</li>
</ol>

<h3>Escopos de Token por Caso de Uso</h3>
<table>
<tr><th>Integração</th><th>Escopos necessários</th></tr>
<tr><td>CAPI (enviar eventos)</td><td>ads_management, business_management</td></tr>
<tr><td>Relatórios (ler dados)</td><td>ads_read, business_management</td></tr>
<tr><td>Criar/editar anúncios</td><td>ads_management</td></tr>
<tr><td>Catálogo de produtos</td><td>catalog_management</td></tr>
<tr><td>Leads/formulários</td><td>leads_retrieval</td></tr>
</table>

<h3>Alertas Automáticos de Campanha</h3>
<p>Configure alertas para nunca perder quando campanhas pausam ou têm problemas:</p>
<ul>
  <li>Ads Manager → Alertas Automatizados → Criar alerta</li>
  <li>Condição: "Campanha pausada por alto CPR" → Notificação: email + WhatsApp via webhook</li>
  <li>Condição: "Gasto diário zerado por mais de 6h" → Notificação imediata</li>
  <li>Condição: "ROAS abaixo de X" → Pausa automática + alerta</li>
</ul>

<blockquote>System Users com tokens de API têm vida útil de 60 dias para tokens de usuário e indefinida para tokens de sistema com permissão admin. Para integrações de produção, sempre use System User — nunca seu token pessoal de usuário.</blockquote>`,
            exercise: `<h3>Exercício: Auditoria e Configuração Meta</h3>
<p>Execute este checklist completo no seu Business Manager:</p>
<ol>
  <li>✓ Domínio principal verificado no BM</li>
  <li>✓ Pixel instalado via GTM com eventos Purchase, Lead e ViewContent</li>
  <li>✓ Verificar com Pixel Helper: nenhum erro, zero duplicação</li>
  <li>✓ CAPI configurado na plataforma de checkout (Hotmart/Kiwify) com o token do System User</li>
  <li>✓ EMQ ≥ 6 no Events Manager para o evento Purchase</li>
  <li>✓ Attribution window ajustada: 7d clique / 1d visualização</li>
  <li>✓ UTMs configurados em todos os anúncios ativos</li>
  <li>✓ Alerta criado para campanhas com ROAS abaixo da meta</li>
</ol>
<p>Itens com ✗: documente e resolva um por semana até zerar a lista.</p>`
          }
        ],
        locked: false
      },

      // ── CAPÍTULO 23: PLATAFORMAS DE PAGAMENTO ──
      {
        id: "plataformas-pagamento",
        number: 23,
        title: "Plataformas de Pagamento: Hotmart, Kiwify e Eduzz",
        subtitle: "Configuração técnica completa e integração com todo o ecossistema de marketing",
        icon: "💳",
        color: "from-green-800 to-emerald-900",
        duration: "2h",
        summary: "Hotmart, Kiwify e Eduzz são mais do que processadores de pagamento — são sistemas completos de gestão de produtos digitais, afiliados, webhooks e integrações. Configurar corretamente cada um determina a qualidade do tracking, a automação do pós-venda e a eficiência dos afiliados.",
        lessons: [
          {
            id: "hotmart-setup-completo",
            title: "Hotmart: Configuração Completa do Produto ao Webhook",
            duration: "28 min",
            type: "text",
            keyPoints: ["Criando produto: tipo, preço, checkout customizado", "Order Bump e Upsell One-Click no Hotmart", "Pixels no Hotmart: Meta, Google e TikTok via painel", "Webhooks Hotmart: configurando notificações de compra/reembolso", "Programa de afiliados: aprovação, comissão e materiais"],
            content: `<h2>Hotmart: O Mais Completo para Infoprodutos PT-BR</h2>
<p>O Hotmart domina o mercado de infoprodutos no Brasil com razão: tem checkout nativo, afiliados, área de membros, streaming de vídeo e integrações que nenhum concorrente conseguiu replicar na totalidade.</p>

<h3>Criando o Produto Corretamente</h3>
<p><strong>Tipo de produto:</strong> Curso Online (para conteúdo com área de membros), E-book (para PDFs), Membership (para recorrências), Evento (para lives pontuais).</p>
<p><strong>Configurações críticas:</strong></p>
<ul>
  <li>Nomenclatura: use o nome que aparecerá na fatura do cartão do cliente (máx. 22 caracteres)</li>
  <li>Moeda: BRL para vendas nacionais. Para vender em dólares, crie produto separado em USD</li>
  <li>Garantia: 7 dias (mínimo legal), 30 dias (converte melhor), 60 dias (para tickets altos)</li>
  <li>Período de disponibilidade: Vitalício vs. por prazo (cuidado: vitalício pode ser problema de suporte futuro)</li>
</ul>

<h3>Order Bump e Upsell: Configuração que Aumenta Ticket em 30-50%</h3>
<p><strong>Order Bump:</strong> oferta dentro do checkout, antes da compra. Taxa de aceitação: 20-40%.</p>
<ol>
  <li>Produto principal → Upsell → Adicionar Order Bump</li>
  <li>Selecione o produto do Order Bump (deve ter preço menor: 10-30% do produto principal)</li>
  <li>Escreva o copy do Order Bump: máx. 100 palavras, foco no complemento imediato</li>
</ol>
<p><strong>Upsell One-Click:</strong> oferta após a compra, sem precisar digitar dados do cartão novamente. Taxa: 10-20%.</p>

<h3>Pixels e Tracking no Hotmart</h3>
<p>Hotmart → Ferramentas → Pixels → Adicionar Pixel</p>
<ul>
  <li><strong>Meta (Pixel + CAPI):</strong> Cole Pixel ID e token de acesso do System User. Escolha "Com API de Conversões" para máxima precisão.</li>
  <li><strong>Google Ads:</strong> Cole Conversion ID e Conversion Label (disponíveis no Google Ads → Metas → Conversões)</li>
  <li><strong>TikTok Ads:</strong> Cole o Pixel ID do TikTok Events Manager</li>
</ul>
<p>O Hotmart disparará os eventos de compra (e outros) automaticamente para todos os pixels configurados.</p>

<h3>Webhooks: Automatizando o Pós-Venda</h3>
<p>Webhooks são notificações automáticas que o Hotmart envia para sistemas externos quando algo acontece (compra, reembolso, cancelamento).</p>
<p>Hotmart → Ferramentas → Webhooks → Criar Webhook:</p>
<ul>
  <li>URL: o endpoint do sistema que receberá a notificação (ActiveCampaign, RD Station, seu servidor)</li>
  <li>Eventos: PURCHASE_COMPLETE, PURCHASE_REFUNDED, SUBSCRIPTION_CANCELLATION</li>
  <li>Versão API: sempre use a mais recente (V2)</li>
</ul>
<p>Com webhook configurado, cada compra dispara automaticamente: tag no email, mensagem de boas-vindas no WhatsApp, acesso liberado no produto.</p>

<h3>Afiliados: Configuração do Programa</h3>
<ul>
  <li>Comissão por produto: defina um valor ou % (30-50% é padrão de mercado para infoprodutos)</li>
  <li>Aprovação: manual (controla quem promove) ou automática (escala rápido)</li>
  <li>Materiais: suba criativos prontos (banners, vídeos, copies) na área de afiliados</li>
  <li>Cookie: duração padrão de 90 dias — afiliado recebe comissão se o cliente comprar em até 90 dias do primeiro clique</li>
</ul>`
          },
          {
            id: "kiwify-setup-completo",
            title: "Kiwify: Checkout de Alta Conversão e Integrações Nativas",
            duration: "25 min",
            type: "text",
            keyPoints: ["Por que o checkout do Kiwify converte mais que o padrão", "Configuração de produto e checkout personalizado", "Order Bump, Upsell e bump de pós-compra", "Integrações nativas: Meta CAPI, Google, ActiveCampaign, RD Station", "Recuperação de boleto e PIX abandonados"],
            content: `<h2>Kiwify: O Checkout que Prioriza Conversão</h2>
<p>A Kiwify cresceu rapidamente por uma razão simples: o checkout deles converte 15-25% melhor que o Hotmart em muitos nichos, graças a um design mais limpo, carregamento mais rápido e menos campos obrigatórios.</p>

<h3>Diferenças-Chave vs. Hotmart</h3>
<table>
<tr><th>Feature</th><th>Hotmart</th><th>Kiwify</th></tr>
<tr><td>Checkout</td><td>Completo, muitos campos</td><td>Simplificado, 1-step</td></tr>
<tr><td>Área de membros</td><td>Nativa e robusta</td><td>Básica (muitos usam plataformas externas)</td></tr>
<tr><td>Afiliados</td><td>Ecossistema maduro</td><td>Crescendo</td></tr>
<tr><td>CAPI Meta</td><td>Nativo</td><td>Nativo</td></tr>
<tr><td>Recuperação de abandonados</td><td>Básica</td><td>Avançada com WhatsApp</td></tr>
<tr><td>Taxa</td><td>9,9% + R$1 por venda</td><td>9,99% por venda</td></tr>
</table>

<h3>Configuração de Produto na Kiwify</h3>
<ol>
  <li>Produtos → Criar produto → Escolha tipo (Curso, E-book, Serviço, Recorrência)</li>
  <li>Configure checkout: personalize cores, adicione depoimentos, ative garantia</li>
  <li>Ative "Checkout inteligente" — detecta dispositivo e exibe layout otimizado</li>
  <li>Configure bumps: Order Bump (antes da compra) e 2 níveis de Upsell (após)</li>
</ol>

<h3>Recuperação de Abandonados (Diferencial Kiwify)</h3>
<p>A Kiwify tem sistema nativo de recuperação de boleto e PIX abandonados:</p>
<ul>
  <li>Configurações → Recuperação → Ativar recuperação automática</li>
  <li>Configure sequência: Email 1h após abandono → WhatsApp 4h → Email 24h</li>
  <li>Templates prontos de copy disponíveis no painel</li>
  <li>Resultado típico: 8-15% de recuperação de boletos abandonados</li>
</ul>

<h3>Integrações Nativas</h3>
<p>Kiwify → Configurações → Integrações:</p>
<ul>
  <li><strong>Meta Pixel + CAPI:</strong> Cole Pixel ID e Access Token. A Kiwify envia Purchase, Lead (cadastro no checkout) e InitiateCheckout.</li>
  <li><strong>ActiveCampaign:</strong> Cole URL da conta e API Key. Configure qual lista recebe compradores e qual tag é aplicada.</li>
  <li><strong>RD Station:</strong> Cole o Token da API. Configure campo de conversão e lead scoring automático.</li>
  <li><strong>Webhook genérico:</strong> Para qualquer sistema não listado — envia JSON com todos os dados da compra.</li>
</ul>

<blockquote>Para lançamentos de carrinho de 5-7 dias com volume alto, use Kiwify pelo checkout mais simples e menor atrito. Para produtos com área de membros robusta, afiliados maduros e produto com download, Hotmart tem mais infraestrutura nativa.</blockquote>`
          },
          {
            id: "eduzz-setup",
            title: "Eduzz: Estrutura, Checkout e Programa de Afiliados",
            duration: "20 min",
            type: "text",
            keyPoints: ["Arquitetura Eduzz: produtos, planos e subdivisões", "Checkout Eduzz: personalização e otimização", "Afiliados Eduzz: aprovação e materiais", "Integrações de pixel e rastreamento", "Quando usar Eduzz vs. Hotmart vs. Kiwify"],
            content: `<h2>Eduzz: A Terceira Opção que Tem Seus Nichos</h2>
<p>Eduzz é menos popular que Hotmart e Kiwify entre criadores de conteúdo, mas dominante em alguns nichos específicos — especialmente cursos profissionais, concursos e educação corporativa.</p>

<h3>Arquitetura de Produto Eduzz</h3>
<p>A Eduzz usa uma hierarquia diferente:</p>
<pre>
Conta Eduzz
└── Produtor
    ├── Produto (o curso/ebook)
    │   ├── Planos (preços e acessos diferentes)
    │   └── Módulos (divisão de conteúdo)
    └── Funil de vendas (checkout com bump/upsell)
</pre>

<h3>Configuração do Checkout</h3>
<ol>
  <li>Criar Produto → Definir tipo (curso, ebook, assinatura)</li>
  <li>Criar Plano: nome, preço, periodicidade, acesso</li>
  <li>Personalizar Checkout: logo, cores, campos customizados, depoimentos</li>
  <li>Ativar Bump de Produto e Upsell de Pós-Compra</li>
</ol>

<h3>Afiliados na Eduzz</h3>
<p>O programa de afiliados Eduzz tem características únicas:</p>
<ul>
  <li>Comissões por "funil" — afiliado pode receber % de toda a jornada de compra, não só do produto inicial</li>
  <li>Divulgação por "conteúdo gerado" — afiliado cria conteúdo e recebe comissão de quem comprar via link do conteúdo</li>
  <li>Multi-level: possibilidade de sub-afiliados (verifique compliance jurídico)</li>
</ul>

<h3>Quando Escolher Cada Plataforma</h3>
<table>
<tr><th>Critério</th><th>Use Hotmart</th><th>Use Kiwify</th><th>Use Eduzz</th></tr>
<tr><td>Área de membros robusta</td><td>✓ Melhor opção</td><td>Básica</td><td>Intermediária</td></tr>
<tr><td>Conversão de checkout</td><td>Boa</td><td>✓ Melhor</td><td>Boa</td></tr>
<tr><td>Afiliados ecossistema</td><td>✓ Maior</td><td>Crescendo</td><td>Nicho</td></tr>
<tr><td>Recuperação abandonado</td><td>Básica</td><td>✓ Melhor</td><td>Básica</td></tr>
<tr><td>Ticket alto (+R$2k)</td><td>✓ Funciona</td><td>✓ Funciona</td><td>Funciona</td></tr>
</table>`
          },
          {
            id: "asaas-configuracao",
            title: "Asaas: Gateway Financeiro Completo para Negócios Digitais",
            duration: "25 min",
            type: "text",
            keyPoints: ["Asaas vs. Hotmart/Kiwify: quando usar cada um", "PIX, boleto, cartão e recorrência no Asaas", "Criando cobranças e links de pagamento", "Asaas como plataforma de gestão financeira do negócio", "API Asaas: automatizando cobranças e liberação de acesso"],
            content: `<h2>Asaas: O Gateway que Vai Além do Infoproduto</h2>
<p>Enquanto Hotmart e Kiwify são plataformas de infoprodutos (marketplace + processamento), o Asaas é um gateway financeiro completo — desenvolvido para negócios que precisam de mais controle sobre recebimentos, faturamento e gestão financeira.</p>

<h3>Quando Usar Asaas (vs. Hotmart/Kiwify)</h3>
<table>
<tr><th>Cenário</th><th>Use Asaas</th><th>Use Hotmart/Kiwify</th></tr>
<tr><td>Venda de serviços + produtos juntos</td><td>✓ Ideal</td><td>Limitado a produtos digitais</td></tr>
<tr><td>Assinatura/recorrência com controle total</td><td>✓ Ideal</td><td>Funciona, mas menos flexível</td></tr>
<tr><td>Marketplace com afiliados</td><td>Não tem</td><td>✓ Ideal</td></tr>
<tr><td>Área de membros nativa</td><td>Não tem</td><td>✓ Hotmart tem</td></tr>
<tr><td>PIX sem taxa por transação</td><td>✓ PIX gratuito em planos pagos</td><td>Taxa por transação</td></tr>
<tr><td>Gestão financeira completa (DRE, fluxo de caixa)</td><td>✓ Nativo</td><td>Não tem</td></tr>
<tr><td>Cobrança de clientes B2B</td><td>✓ Ideal</td><td>Não é o foco</td></tr>
<tr><td>Split de pagamentos (parceria/co-autoria)</td><td>✓ Tem</td><td>Via afiliados</td></tr>
</table>

<h3>Estrutura de Taxas Asaas</h3>
<p>O Asaas opera em 3 planos:</p>
<ul>
  <li><strong>Gratuito:</strong> PIX 1,99%, Boleto R$1,99/unidade, Cartão 3,49% + R$0,49</li>
  <li><strong>Standard (R$49,90/mês):</strong> PIX 0,99%, Boleto R$1,49, Cartão 2,99% + R$0,49</li>
  <li><strong>Business (R$199,90/mês):</strong> PIX 0%, Boleto R$0,99, Cartão 2,49% + R$0,49</li>
</ul>
<p>Comparando com Hotmart (9,9% + R$1): para produtos acima de R$200 com volume consistente, o Asaas no plano Business é significativamente mais barato.</p>

<h3>Criando um Link de Pagamento no Asaas</h3>
<ol>
  <li>Asaas → Cobranças → Criar Cobrança → Link de Pagamento</li>
  <li>Configure: nome do produto, valor, formas de pagamento aceitas</li>
  <li>Recorrência: ative se for assinatura, defina ciclo (mensal/trimestral/anual) e número de parcelas</li>
  <li>Copie o link gerado e use em anúncios, WhatsApp ou email</li>
  <li>Personalize a página de pagamento: logo, cores, texto de confirmação</li>
</ol>

<h3>Automação via API Asaas</h3>
<p>O Asaas tem API REST completa que permite:</p>
<ul>
  <li>Criar cobranças automaticamente quando um lead converte (via Zapier/Make)</li>
  <li>Liberar acesso a conteúdo quando pagamento é confirmado (webhook de confirmação)</li>
  <li>Cancelar acesso quando assinatura cancela (webhook de cancelamento)</li>
  <li>Enviar boleto por WhatsApp automaticamente via integração com Z-API</li>
</ul>
<p>Webhook Asaas: configure em Configurações → Notificações → Webhook. Eventos principais: <code>PAYMENT_CONFIRMED</code>, <code>PAYMENT_OVERDUE</code>, <code>SUBSCRIPTION_INACTIVATED</code>.</p>

<h3>Asaas + Área de Membros Externa</h3>
<p>Como o Asaas não tem área de membros, você precisa integrar com plataformas externas:</p>
<ul>
  <li>Memberkit, Ead Plataforma, Hotmart Sparkle (só área de membros): recebem o evento de pagamento via webhook e liberam acesso automaticamente</li>
  <li>Via Zapier: Asaas Webhook → ferramenta de membros → liberar acesso + enviar credenciais por email</li>
</ul>

<blockquote>Use Asaas como gateway principal quando você vende serviços + produtos, quando quer controle total da gestão financeira, ou quando o volume de vendas torna as taxas das plataformas de infoproduto proibitivas. Para um negócio fazendo R$100k/mês, a diferença de taxa pode ser R$5.000-8.000/mês em favor do Asaas.</blockquote>`
          },
          {
            id: "checkout-email-whatsapp-flow",
            title: "O Fluxo Automático Completo: Compra → Email → WhatsApp → Área de Membros",
            duration: "28 min",
            type: "text",
            glossaryTerms: ["nurturing", "opt-in", "lead-magnet", "mrr"],
            keyPoints: ["Mapeando todos os eventos de uma jornada de compra", "Webhook → ActiveCampaign/RD Station: configuração passo a passo", "WhatsApp de boas-vindas automático via Z-API", "Liberação de acesso e onboarding automático", "Tratamento de reembolsos e cancelamentos"],
            content: `<h2>O Fluxo que Todo Negócio Digital Precisa Ter</h2>
<p>Um cliente compra seu curso. O que acontece a seguir precisa ser automático, rápido e perfeito. Esse fluxo define a primeira impressão e o LTV do cliente.</p>

<h3>Mapa Completo do Fluxo Pós-Compra</h3>
<pre>
COMPRA CONFIRMADA (Hotmart/Kiwify)
         ↓
    Webhook disparado
    ↙              ↘
Email marketing    WhatsApp
(ActiveCampaign)   (Z-API)
    ↓                ↓
Tag "comprador"   Mensagem boas-vindas
aplicada          em até 5 minutos
    ↓
Sequência onboarding
(7 emails em 14 dias)
    ↓
Acesso liberado na
área de membros
</pre>

<h3>Configurando o Webhook Hotmart → ActiveCampaign</h3>
<p>ActiveCampaign não tem URL de webhook nativa — você precisa de um intermediário (Zapier, Make ou endpoint customizado).</p>
<p><strong>Via Zapier (sem código):</strong></p>
<ol>
  <li>Zapier → Create Zap → Trigger: "Webhooks by Zapier" → Catch Hook</li>
  <li>Copie a URL gerada pelo Zapier</li>
  <li>Cole essa URL no Hotmart como URL de Webhook</li>
  <li>Action: ActiveCampaign → "Add/Update Contact" → aplique tag "comprador-[nome-produto]"</li>
  <li>Action 2: ActiveCampaign → "Add to Automation" → sequência de onboarding</li>
</ol>

<h3>WhatsApp Automático de Boas-Vindas</h3>
<p>Via Z-API (uma das opções de WhatsApp Business API):</p>
<ol>
  <li>Adicione outro Action no Zapier: "Webhooks by Zapier" → POST</li>
  <li>URL: <code>https://api.z-api.io/instances/SEU_ID/token/SEU_TOKEN/send-text</code></li>
  <li>Body (JSON): <code>{"phone": "55{{phone}}", "message": "Olá {{first_name}}! Sua compra foi confirmada..."}</code></li>
  <li>O número do comprador vem do webhook do Hotmart no campo <code>buyer.phone</code></li>
</ol>

<h3>Template de Mensagem de Boas-Vindas (WhatsApp)</h3>
<blockquote>
Olá [NOME]! 🎉

Sua compra de [PRODUTO] foi confirmada com sucesso!

Seus próximos passos:
1️⃣ Acesse a área de membros: [LINK]
2️⃣ Complete seu perfil para personalizar a experiência
3️⃣ Comece pelo Módulo 1 — ele muda tudo

Qualquer dúvida, responda aqui neste chat.

Bem-vindo(a) à família [MARCA]! 🚀
</blockquote>

<h3>Tratamento de Reembolsos</h3>
<p>Configure webhook para evento PURCHASE_REFUNDED:</p>
<ul>
  <li>Remover tag "comprador" e adicionar tag "reembolsado" no ActiveCampaign</li>
  <li>Pausar sequência de onboarding</li>
  <li>Disparar sequência de recuperação (3 emails em 7 dias tentando reconverter)</li>
  <li>Revogar acesso na área de membros após processamento (geralmente automático no Hotmart/Kiwify)</li>
</ul>`
          },
          {
            id: "payment-exercise",
            title: "Exercício: Checklist Completo de Produto e Integrações",
            duration: "15 min",
            type: "exercise",
            keyPoints: ["Verificação de produto no Hotmart/Kiwify", "Teste de compra e fluxo completo", "Validação de todos os pixels e webhooks"],
            content: `<h2>Checklist de Lançamento de Produto</h2>
<p>Antes de abrir qualquer carrinho, execute este checklist completo. Um item faltando pode custar R$10k em vendas perdidas.</p>`,
            exercise: `<h3>Execute o Teste Completo</h3>
<p><strong>Produto:</strong></p>
<ul>
  <li>[ ] Nome do produto correto no checkout</li>
  <li>[ ] Preço correto (incluindo centavos)</li>
  <li>[ ] Imagem do produto adicionada</li>
  <li>[ ] Garantia configurada (7/30/60 dias)</li>
  <li>[ ] Order Bump ativo e com copy correto</li>
  <li>[ ] Upsell configurado e testado</li>
</ul>
<p><strong>Pixels e Rastreamento:</strong></p>
<ul>
  <li>[ ] Meta Pixel disparando Purchase após compra de teste</li>
  <li>[ ] CAPI configurado e EMQ ≥ 6</li>
  <li>[ ] Google Ads Conversion disparando corretamente</li>
  <li>[ ] UTMs configurados na URL de afiliado/anúncio</li>
</ul>
<p><strong>Automações:</strong></p>
<ul>
  <li>[ ] Webhook configurado e testado (use ngrok ou ferramenta de teste de webhook)</li>
  <li>[ ] Email de boas-vindas chega em menos de 5 minutos</li>
  <li>[ ] WhatsApp de boas-vindas chega em menos de 5 minutos</li>
  <li>[ ] Acesso liberado na área de membros</li>
  <li>[ ] Sequência de onboarding iniciada corretamente</li>
</ul>
<p><strong>Pós-venda:</strong></p>
<ul>
  <li>[ ] Teste de reembolso: acesso revogado e sequência de recuperação disparada</li>
  <li>[ ] Página de agradecimento personalizada e com próximos passos claros</li>
</ul>
<p><em>Realize uma compra de teste de R$1 (crie um cupom de 99% de desconto) e percorra todo o fluxo como comprador. O que você experimentar é o que seu cliente experimentará.</em></p>`
          }
        ],
        locked: false
      },

      // ── CAPÍTULO 24: EMAIL MARKETING AUTOMATION ──
      {
        id: "email-automation",
        number: 24,
        title: "Email Marketing: Automação Profissional de Lançamentos",
        subtitle: "RD Station, ActiveCampaign e as sequências que vendem automaticamente",
        icon: "📧",
        color: "from-violet-800 to-purple-900",
        duration: "2h 30min",
        summary: "Email marketing com taxa de 25-40% de abertura e 3-8% de clique é o canal com maior ROI do marketing digital. Mas o poder real está na automação: sequências que nutrem leads, abrem carrinhos, criam urgência e fazem onboarding — sem você precisar escrever um email na hora.",
        lessons: [
          {
            id: "rdstation-configuracao",
            title: "RD Station: Configuração, Lead Scoring e Fluxos para Lançamentos",
            duration: "30 min",
            type: "text",
            keyPoints: ["Configuração inicial: domínio, SPF/DKIM, listas", "Lead Scoring: pontuando leads por comportamento", "Automações de lançamento: captura → nutrição → venda → pós-venda", "Segmentação por comportamento (abriu email, clicou, visitou página)", "Integração RD Station + Hotmart via webhook"],
            content: `<h2>RD Station: A Plataforma Número 1 em PT-BR</h2>
<p>RD Station domina o mercado brasileiro de marketing automation com razão: suporte em português, preços em BRL, integrações com todas as plataformas nacionais e uma interface que qualquer produtor consegue operar sem developer.</p>

<h3>Configuração Essencial (Fazer Antes de Qualquer Coisa)</h3>
<p><strong>1. Domínio de envio:</strong> Configure o domínio de envio para o seu domínio (ex: marketing@seudominio.com.br), não o domínio genérico do RD Station. Isso aumenta deliverability em 30-40%.</p>
<p><strong>2. SPF e DKIM:</strong> São registros DNS que provam que seus emails são legítimos. Sem eles, 20-40% dos emails vão para spam.</p>
<ul>
  <li>RD Station → Configurações → Email → Domínio Personalizado</li>
  <li>Siga as instruções para adicionar registros TXT no seu DNS</li>
  <li>Aguarde propagação (2-24h) e valide</li>
</ul>
<p><strong>3. Segmentos base:</strong> Crie imediatamente: "Leads Ativos", "Compradores", "Leads Inativos 90d", "Cancelamentos". Você vai precisar desses segmentos em todas as automações.</p>

<h3>Lead Scoring: Identificando Quem Vai Comprar</h3>
<p>Lead Scoring atribui pontos aos leads com base em comportamentos. Leads com score alto recebem abordagem mais direta de venda.</p>
<p><strong>Configuração recomendada:</strong></p>
<table>
<tr><th>Comportamento</th><th>Pontos</th></tr>
<tr><td>Abrindo email</td><td>+1</td></tr>
<tr><td>Clicando em link</td><td>+3</td></tr>
<tr><td>Visitando página de vendas</td><td>+5</td></tr>
<tr><td>Assistindo webinar</td><td>+10</td></tr>
<tr><td>Iniciando checkout</td><td>+20</td></tr>
<tr><td>30 dias sem abrir email</td><td>-5</td></tr>
</table>

<h3>Automações Essenciais para Lançamentos</h3>
<p><strong>Automação 1: Entrada de Lead</strong></p>
<pre>
Gatilho: Lead entra na lista
→ Aguarda 0 min
→ Envia Email de Boas-Vindas
→ Aguarda 2 dias
→ Envia Email de Valor 1
→ Aguarda 3 dias  
→ Envia Email de Valor 2
→ Aguarda 2 dias
→ Envia Email de Abertura de Carrinho (se lançamento ativo)
</pre>

<p><strong>Automação 2: Visitou Página de Vendas (Sem Comprar)</strong></p>
<pre>
Gatilho: Tag "visitou-pv" aplicada
→ Aguarda 2 horas
→ Envia Email de Objeções
→ Aguarda 24 horas
→ Envia Email de Bônus/Urgência
→ Aguarda 24 horas
→ Remove da automação se comprou,
  ou envia Email de Último Dia
</pre>

<h3>Integração RD Station + Hotmart</h3>
<p>No RD Station, cada "conversão" pode ser uma origem de lead. Configure:</p>
<ul>
  <li>Hotmart → Webhooks → URL de webhook do RD Station (disponível em Integrações → API)</li>
  <li>Mapeie campos: email do comprador → email RD Station, nome → nome, produto → tag</li>
  <li>Configure conversão "Comprou [nome-produto]" para tracking de receita no RD</li>
</ul>`
          },
          {
            id: "activecampaign-avancado",
            title: "ActiveCampaign: Lead Scoring, Tagging Avançado e Automações",
            duration: "28 min",
            type: "text",
            keyPoints: ["ActiveCampaign vs. RD Station: quando usar cada um", "Sistema de tags: a lógica de segmentação mais poderosa do mercado", "Deals e CRM: transformando leads quentes em vendas", "Automações condicionais: caminhos diferentes para comportamentos diferentes", "Score de contato e segmentação dinâmica"],
            content: `<h2>ActiveCampaign: O Poder das Tags e Automações Condicionais</h2>
<p>Se o RD Station é o melhor para quem quer simplicidade e suporte PT-BR, o ActiveCampaign é a escolha de quem quer poder máximo de segmentação e automações complexas.</p>

<h3>A Lógica de Tags no ActiveCampaign</h3>
<p>Tags são etiquetas aplicadas a contatos que descrevem comportamentos, interesses e estágio no funil. A diferença entre usar tags bem e mal pode dobrar sua taxa de conversão.</p>
<p><strong>Sistema de tags recomendado para lançamentos:</strong></p>
<pre>
Origem:       lead-instagram, lead-tiktok, lead-google, lead-afiliado
Produto:      interessado-[produto], comprou-[produto], reembolso-[produto]
Engajamento:  abriu-email, clicou-email, visitou-pv, iniciou-checkout
Lançamento:   ll-jun25-inscrito, ll-jun25-assistiu-aula1, ll-jun25-comprou
Ciclo:        novo-lead, lead-engajado, lead-quente, comprador, embaixador
</pre>

<h3>Automações Condicionais: O Diferencial do ActiveCampaign</h3>
<p>Automações condicionais permitem criar caminhos diferentes baseados no comportamento do contato:</p>
<pre>
Contato entra na automação
    ↓
[Condição: tem tag "comprou-produto-x"?]
   Sim ↓                    Não ↓
Skip para               Envia Email de
"Upsell"                Apresentação
automação                   ↓
                    [Condição: score > 50?]
                   Alta ↓          Baixa ↓
               Email de         Sequência de
               Oferta Direta    Nutrição (7 dias)
</pre>

<h3>CRM e Deals: Gerenciando Vendas de Alto Ticket</h3>
<p>Para produtos acima de R$1.000, use os Deals do ActiveCampaign como CRM simplificado:</p>
<ul>
  <li>Crie pipeline de vendas: Novo Lead → Qualificado → Proposta → Negociação → Fechado</li>
  <li>Automação: quando score > 80, cria um Deal automaticamente e alerta vendedor</li>
  <li>Integra com email, WhatsApp e chamada telefônica no mesmo histórico de contato</li>
</ul>

<h3>Métricas que Importam no ActiveCampaign</h3>
<table>
<tr><th>Métrica</th><th>Benchmark bom</th><th>Ação se abaixo</th></tr>
<tr><td>Taxa de abertura</td><td>&gt;25%</td><td>Testar subject lines, enviar nos horários de pico</td></tr>
<tr><td>Taxa de clique</td><td>&gt;3%</td><td>Melhorar o copy e o CTA do email</td></tr>
<tr><td>Taxa de descadastro</td><td>&lt;0,5%</td><td>Segmentar melhor, não enviar para lista toda</td></tr>
<tr><td>Taxa de spam</td><td>&lt;0,1%</td><td>Revisar origem dos leads, higienizar lista</td></tr>
</table>`
          },
          {
            id: "sequencia-prelancamento",
            title: "A Sequência dos 7 Emails de Pré-Lançamento (Com Copy Pronto)",
            duration: "28 min",
            type: "text",
            keyPoints: ["A lógica de cada email na sequência PLF", "Email 1: A Grande Promessa e a Virada de Chave", "Emails 2-3: Conteúdo de valor + estabelecendo autoridade", "Email 4: A Grande Revelação / Prova Social", "Email 5: Abertura de carrinho com bônus", "Emails 6-7: Urgência e fechamento"],
            content: `<h2>A Sequência que Aquece sua Lista para Comprar</h2>
<p>Jeff Walker popularizou a PLF (Product Launch Formula) com uma sequência de pré-lançamento de 4 vídeos. No modelo PT-BR adaptado, os emails desempenham esse papel — e quando bem escritos, fazem a lista chegar no dia de abertura do carrinho pronta para comprar.</p>

<h3>Email 1: A Grande Promessa (D-14)</h3>
<p><strong>Objetivo:</strong> Criar expectativa e dar contexto do que vai acontecer nos próximos dias.</p>
<p><strong>Assunto:</strong> "O que estou prestes a te revelar vai mudar como você [resultado desejado]"</p>
<p><strong>Estrutura:</strong></p>
<pre>
- Abertura com história pessoal de transformação (3-5 parágrafos)
- O problema que você vai resolver (1 parágrafo)
- Preview do que vem nos próximos dias (bullets)
- CTA: "Responda esse email com sua maior dúvida sobre [tema]"
</pre>

<h3>Email 2: Conteúdo de Valor + Gatilho de Autoridade (D-11)</h3>
<p><strong>Objetivo:</strong> Entregar conteúdo prático. Mostrar que você sabe o que está ensinando.</p>
<p><strong>Assunto:</strong> "[Número] [resultado] que [público] está usando para [meta]"</p>
<p><strong>Estrutura:</strong> Lista de dicas práticas com profundidade real. Termine revelando que existe "uma camada mais funda" que será revelada na próxima aula.</p>

<h3>Email 3: Quebra de Objeção Principal (D-8)</h3>
<p><strong>Objetivo:</strong> Destruir a maior crença limitante do público.</p>
<p><strong>Assunto:</strong> "A mentira que te impede de [resultado] (não é o que você pensa)"</p>
<p><strong>Estrutura:</strong> Reenquadre a crença limitante com prova (dados, estudos, casos reais). Mostre que o problema real é outro — e que você tem a solução.</p>

<h3>Email 4: Prova Social Massiva (D-5)</h3>
<p><strong>Objetivo:</strong> Social proof que vence o ceticismo.</p>
<p><strong>Assunto:</strong> "O que [NOME REAL] fez em [tempo] usando [método]"</p>
<p><strong>Estrutura:</strong> 3-5 casos de alunos com resultados específicos (não "mudou minha vida" — use números: "faturou R$23.400 no primeiro lançamento").</p>

<h3>Email 5: Abertura de Carrinho (D-0, Manhã)</h3>
<p><strong>Objetivo:</strong> Converter a expectativa criada em compra.</p>
<p><strong>Assunto:</strong> "ABERTO: [Nome do Produto] + [Bônus por tempo limitado]"</p>
<p><strong>Estrutura:</strong></p>
<pre>
- Uma linha de abertura que confirma: chegou o dia
- Bullets dos benefícios principais (máx. 7)
- Os bônus exclusivos de early bird
- O preço + condições (parcelamento)
- CTA principal + urgência real (vagas/tempo)
- P.S. com o que eles perdem se não agirem
</pre>

<h3>Email 6: Urgência de Meio de Carrinho (D+3)</h3>
<p><strong>Assunto:</strong> "Só X horas restantes para o bônus [NOME_BONUS]"</p>
<p><strong>Objetivo:</strong> Reativar quem abriu mas não comprou. Remove bônus que expiram.</p>

<h3>Email 7: Fechamento (Último Dia, 3 Emails)</h3>
<p><strong>Manhã:</strong> "Último dia — o que você vai perder amanhã"<br/>
<strong>Tarde (16h):</strong> "Só X horas — o carrinho fecha à meia-noite"<br/>
<strong>Noite (22h):</strong> "Última chamada — carrinho fecha em 2 horas"</p>
<p>O dia de fechamento do carrinho gera 30-40% de toda a receita de um lançamento. Não envie apenas um email — envie três.</p>`
          },
          {
            id: "sequencia-carrinho",
            title: "Sequências de Carrinho: Abertura, Urgência e Fechamento",
            duration: "22 min",
            type: "text",
            keyPoints: ["A matemática do carrinho: quando cada email vai", "Email de abandono de checkout: 20-30% de recuperação", "Segmentação por comportamento dentro do carrinho", "Urgência real vs. urgência falsa: o impacto na credibilidade", "Emails de última hora que triplicam a receita do fechamento"],
            content: `<h2>A Estrutura Completa de Emails de Carrinho</h2>
<p>O período de carrinho aberto de 5-7 dias tem uma curva de vendas previsível: pico no D+0, queda nos dias intermediários, pico maior no último dia. A sequência de emails deve amplificar esses picos e minimizar a queda intermediária.</p>

<h3>Cronograma Completo de Emails no Carrinho</h3>
<table>
<tr><th>Dia</th><th>Email</th><th>Assunto</th><th>Objetivo</th></tr>
<tr><td>D+0 (manhã)</td><td>Abertura</td><td>ABERTO: [Produto] + bônus early bird</td><td>Converter lista aquecida</td></tr>
<tr><td>D+0 (tarde)</td><td>2ª chamada</td><td>Você viu a novidade de hoje?</td><td>Capturar quem perdeu o primeiro</td></tr>
<tr><td>D+2</td><td>Objeções</td><td>Você ainda está em dúvida porque...</td><td>Quebrar as 3 principais objeções</td></tr>
<tr><td>D+3</td><td>Prova social</td><td>O resultado de [aluno] em [tempo]</td><td>Social proof de último momento</td></tr>
<tr><td>D+4</td><td>Bônus expirando</td><td>Só 24h: bônus [X] sai amanhã</td><td>Urgência de bônus</td></tr>
<tr><td>Último dia 9h</td><td>Último dia</td><td>O carrinho fecha hoje — o que você perde</td><td>Ativar decisão</td></tr>
<tr><td>Último dia 16h</td><td>Contagem</td><td>Só 8 horas. [Ticker de contagem]</td><td>Urgência máxima</td></tr>
<tr><td>Último dia 22h</td><td>Última chamada</td><td>2 horas para a decisão</td><td>Last minute converter</td></tr>
</table>

<h3>Email de Abandono de Checkout</h3>
<p>Quem iniciou o checkout mas não completou está a 90% de comprar — ativado o gatilho de posse, precisa apenas de um empurrão.</p>
<p>Configure no Hotmart/Kiwify a "Recuperação de Abandono" ou use webhook (evento InitiateCheckout → sem Purchase em 2h) para disparar:</p>
<ul>
  <li>1h após abandono: "Algo deu errado? Seu acesso está esperando"</li>
  <li>6h após: "Ainda está pensando? Aqui estão as respostas para suas dúvidas"</li>
  <li>24h após: "Última oportunidade antes do preço mudar"</li>
</ul>
<p>Taxa de recuperação típica: 20-35% dos que abandonaram o checkout.</p>`
          },
          {
            id: "sequencia-pos-compra",
            title: "Sequência Pós-Compra: Onboarding que Retém e Upsell que Converte",
            duration: "22 min",
            type: "text",
            keyPoints: ["Os primeiros 7 dias determinam o LTV do cliente", "Email de boas-vindas: o mais importante que você vai escrever", "Sequência de ativação: levando ao primeiro resultado rápido", "Upsell pós-compra: quando e como oferecer sem parecer agressivo", "Programa de indicação: transformando compradores em promotores"],
            content: `<h2>O Onboarding que Transforma Comprador em Fã</h2>
<p>80% do churn acontece nas primeiras 2 semanas. Um comprador que não conclui a primeira aula em 72h tem 3x mais chance de pedir reembolso. O onboarding não é pós-venda — é parte da venda em si.</p>

<h3>Sequência de Onboarding: 14 Dias</h3>
<p><strong>Email 1 (D+0, imediato):</strong> Boas-vindas. Link de acesso. O que fazer primeiro. 200 palavras máximo. Assunto: "Bem-vindo(a), [NOME] — seu acesso está pronto".</p>
<p><strong>Email 2 (D+1):</strong> Orientação de navegação. "Por onde começar". Identifique o nível do aluno e recomende a trilha correta.</p>
<p><strong>Email 3 (D+3):</strong> Quick win. Algo que o aluno consegue implementar em 30 minutos e sentir resultado imediato. Peça que responda o email com o resultado.</p>
<p><strong>Email 4 (D+5):</strong> Comunidade. Convite para grupo fechado (WhatsApp/Telegram). Apresentação de membros ativos como prova de que outros estão progredindo.</p>
<p><strong>Email 5 (D+7):</strong> Check-in. "Como está sendo sua experiência?" + mini-pesquisa (1 pergunta). Leads com NPS alto são candidatos a programa de indicação.</p>
<p><strong>Email 6 (D+10):</strong> Upsell suave. "Alunos que chegaram a este ponto geralmente avançam mais rápido com [produto complementar]". Preço de alumni (10-20% de desconto).</p>
<p><strong>Email 7 (D+14):</strong> Programa de indicação. "Você já foi transformado — agora pode transformar alguém". Link de afiliado com comissão ou benefícios exclusivos.</p>

<h3>Automação de Engajamento: Detectando Alunos em Risco</h3>
<p>Configure na plataforma de membros (Hotmart Sparkle, Memberkit, etc.) para enviar evento de "último login" para o ActiveCampaign:</p>
<ul>
  <li>Não logou em 5 dias → tag "inativo-5d" → email de reengajamento</li>
  <li>Não logou em 14 dias → tag "risco-churn" → ligação pessoal ou mensagem WhatsApp</li>
  <li>Completou 100% → tag "concluiu" → convite para depoimento + upsell</li>
</ul>`
          }
        ],
        locked: false
      },

      // ── CAPÍTULO 25: WHATSAPP AUTOMATION ──
      {
        id: "whatsapp-automation",
        number: 25,
        title: "WhatsApp Automation: ManyChat, WABA e Disparos de Lançamento",
        subtitle: "O canal com 90% de leitura — configurado para trabalhar automaticamente",
        icon: "💬",
        color: "from-green-700 to-teal-800",
        duration: "2h",
        summary: "WhatsApp tem 90%+ de taxa de leitura vs 25% do email. Para lançamentos PT-BR, é o canal com maior impacto imediato. Mas exige configuração cuidadosa: LGPD, opt-in correto e timing estratégico são a diferença entre campanhas que convertem e número banido.",
        lessons: [
          {
            id: "manychat-configuracao",
            title: "ManyChat: Fluxos, Comentários → DM e Captura de Leads via Instagram",
            duration: "28 min",
            type: "text",
            keyPoints: ["ManyChat: o que é e por que é a ferramenta mais importante para orgânico", "Gatilho de comentário → DM automático: configuração completa", "Capturando email e telefone via DM automático", "Fluxos de nutrição via Instagram DM", "Integrando ManyChat com ActiveCampaign e Hotmart"],
            content: `<h2>ManyChat: A Ferramenta que Transformou o Orgânico</h2>
<p>ManyChat permite automatizar conversas no Instagram DM, Facebook Messenger e, em alguns países, WhatsApp. Para o mercado BR, o Instagram DM é o principal caso de uso — e a funcionalidade de comentário → DM automático é revolucionária.</p>

<h3>O Gatilho de Comentário → DM: Como Funciona</h3>
<p>Você posta um Reels dizendo: "Comente PLANILHA aqui que eu te mando grátis". Quando alguém comenta "PLANILHA", o ManyChat envia automaticamente uma DM com o link do material. Resultado: captura de email com taxa de conversão de 60-80% (vs. 20-40% de landing page tradicional).</p>

<h3>Configuração do Fluxo de Comentário</h3>
<ol>
  <li>ManyChat → Automation → New Flow</li>
  <li>Trigger: Instagram Comment → escolha "Keyword" → adicione palavra-chave (ex: "PLANILHA")</li>
  <li>Action 1: Send DM → Mensagem de boas-vindas com o link do material</li>
  <li>Action 2: Ask for email → "Para enviar no seu email também, qual o seu endereço?"</li>
  <li>Action 3: Save email → Campo {email} do contato</li>
  <li>Action 4: Send to ActiveCampaign/RD Station via Zapier/Make</li>
  <li>Action 5: Apply tag "lead-manychat-[nome-post]"</li>
</ol>

<h3>Fluxo de Nutrição via DM (Sequência de 3 dias)</h3>
<pre>
D+0: Lead capturado → Material enviado + email coletado
D+1 (24h): DM de follow-up: "Como foi o material? Tenho mais conteúdo sobre [tema]"
D+2 (48h): DM com link para próximo conteúdo ou oferta de entrada
D+3 (72h): DM de conversão: "Tenho algo especial para quem está levando [tema] a sério"
</pre>

<h3>Integração ManyChat → Email Marketing</h3>
<p>Via Zapier:</p>
<ol>
  <li>ManyChat → Configurações → Integrations → Zapier</li>
  <li>Zapier: ManyChat New Subscriber → ActiveCampaign Create/Update Contact</li>
  <li>Mapeie: email ManyChat → email AC, first name → first name, tag → tag AC</li>
</ol>

<h3>Métricas de ManyChat para Acompanhar</h3>
<table>
<tr><th>Métrica</th><th>Benchmark</th></tr>
<tr><td>Taxa de opt-in de comentário</td><td>60-80%</td></tr>
<tr><td>Taxa de entrega de DM</td><td>&gt;95%</td></tr>
<tr><td>Taxa de clique no link da DM</td><td>40-60%</td></tr>
<tr><td>Taxa de captura de email via DM</td><td>30-50%</td></tr>
</table>`
          },
          {
            id: "waba-zapi-configuracao",
            title: "WhatsApp Business API: Opções, Configuração e Casos de Uso",
            duration: "25 min",
            type: "text",
            keyPoints: ["WhatsApp Business App vs. API: qual usar quando", "Z-API, WPPConnect e a API Oficial Meta: comparativo honesto", "Configurando Z-API para disparos de lançamento", "Templates de mensagem: aprovação e melhores práticas", "Limites de envio e como escalar com segurança"],
            content: `<h2>O Ecossistema de WhatsApp para Marketing</h2>
<p>Existem três categorias de acesso ao WhatsApp para negócios. Cada uma tem limitações, custos e casos de uso diferentes.</p>

<h3>Comparativo das Opções</h3>
<table>
<tr><th>Opção</th><th>Limite de envio</th><th>Custo/mês</th><th>Risco de ban</th><th>Melhor para</th></tr>
<tr><td>WhatsApp Business App</td><td>~500 contatos/dia</td><td>Grátis</td><td>Médio</td><td>Negócios pequenos</td></tr>
<tr><td>Z-API / WPPConnect</td><td>Variável (depende da conta)</td><td>R$80-300</td><td>Médio-alto</td><td>Lançamentos médios</td></tr>
<tr><td>API Oficial Meta (WABA)</td><td>Ilimitado (com templates aprovados)</td><td>Por mensagem (R$0,05-0,40)</td><td>Baixo</td><td>Operações grandes</td></tr>
</table>

<h3>Z-API: Configuração para Lançamentos</h3>
<p>Z-API é uma API não-oficial que conecta ao WhatsApp Web. Funciona bem para volume moderado (até 1.000 contatos/dia) com os cuidados certos.</p>
<ol>
  <li>Crie conta em z-api.io → escolha plano (Starter para até 500/dia, Pro para mais)</li>
  <li>Crie uma Instance → escaneie o QR Code com o número de WhatsApp dedicado ao lançamento</li>
  <li><strong>IMPORTANTE:</strong> Use sempre um número dedicado, nunca seu número pessoal</li>
  <li>Teste o endpoint: POST https://api.z-api.io/instances/{id}/token/{token}/send-text</li>
  <li>Body: {"phone": "5511999999999", "message": "Texto da mensagem"}</li>
</ol>

<h3>Boas Práticas Anti-Ban</h3>
<ul>
  <li>Envie para números que te deram opt-in explícito (nunca compre listas)</li>
  <li>Respeite intervalo entre mensagens: mínimo 3-5 segundos entre envios</li>
  <li>Limite diário: máximo 500 mensagens/número/dia para contas novas</li>
  <li>Textos longos: divida em múltiplas mensagens menores (mais natural)</li>
  <li>Personalize sempre: pelo menos o nome no início da mensagem</li>
  <li>Tenha um link de opt-out claro: "Para sair da lista, responda PARAR"</li>
</ul>

<h3>API Oficial Meta (WABA): Para Operações Grandes</h3>
<p>Para +10.000 contatos ou operações críticas de negócio, use a API Oficial via provedores homologados:</p>
<ul>
  <li>Provedores BR recomendados: Zenvia, Take Blip, Twilio, MessageBird</li>
  <li>Exige templates de mensagem aprovados pela Meta (prazo: 24-48h)</li>
  <li>Custo variável: entre R$0,05 e R$0,40 por mensagem dependendo do tipo</li>
  <li>Sem risco de ban quando usado dentro dos termos</li>
</ul>`
          },
          {
            id: "whatsapp-sequencias-lancamento",
            title: "Sequências de WhatsApp para Cada Fase do Lançamento",
            duration: "25 min",
            type: "text",
            keyPoints: ["Pré-lançamento: aquecendo a lista de WhatsApp", "Abertura de carrinho: mensagem de alto impacto", "Meio de carrinho: manter engajamento sem parecer spam", "Fechamento: as mensagens que geram o pico de vendas", "Copy pronto para cada fase"],
            content: `<h2>O WhatsApp Muda o Jogo do Lançamento</h2>
<p>Em lançamentos PT-BR, WhatsApp é o canal que converte mais no último dia. Produtores que integram email + WhatsApp têm 40-70% mais receita no fechamento do que os que usam apenas email.</p>

<h3>Fase 1: Pré-Lançamento (D-14 a D-1)</h3>
<p>Objetivo: criar expectativa sem queimar. Máximo 2-3 mensagens neste período.</p>
<p><strong>Mensagem de aquecimento (D-7):</strong></p>
<blockquote>
Olá [NOME]!

Estou preparando algo que vai mudar como você [resultado]. 

Na próxima semana vou revelar tudo.

Enquanto isso, me responde: qual é a sua maior dificuldade com [tema]?

[NOME]
</blockquote>
<p>Essa mensagem gera respostas — e cada resposta sobe a relevância do seu número no WhatsApp do contato (evita cair em spam).</p>

<h3>Fase 2: Abertura de Carrinho (D+0)</h3>
<p><strong>Mensagem de abertura (enviar às 08h):</strong></p>
<blockquote>
[NOME]! Hoje é o dia.

O [NOME DO PRODUTO] está com as portas abertas — e com um bônus especial para quem entrar até hoje: [DESCRICAO_BONUS].

Acesse agora: [LINK]

São apenas [VAGAS] vagas. Primeiro a chegar, primeiro atendido.

Alguma dúvida? Me responde aqui 🙋
</blockquote>

<h3>Fase 3: Meio de Carrinho (D+2, D+3)</h3>
<p>Não envie mensagem de venda todos os dias — desgasta. Envie conteúdo de valor com menção da oportunidade:</p>
<blockquote>
[NOME], vi que você ainda não entrou para o [PRODUTO].

Tá com dúvida? Isso aqui pode ajudar:

🔴 "Mas eu não tenho tempo" → O método é pensado para quem tem 1h/dia
🔴 "Mas eu não sei se funciona pra mim" → [CASE com número]

Ainda dá tempo: [LINK]
</blockquote>

<h3>Fase 4: Fechamento (Último Dia)</h3>
<p><strong>Manhã (08h):</strong></p>
<blockquote>
⚠️ [NOME] — hoje é o ÚLTIMO DIA.

O carrinho fecha às 23h59. Depois disso, não tem como entrar.

O que você perde se não entrar hoje:
— [BENEFÍCIO 1]
— [BENEFÍCIO 2]  
— [BÔNUS que expira]

Não deixa pra última hora: [LINK]
</blockquote>

<p><strong>Tarde (17h) — somente para quem não comprou:</strong></p>
<blockquote>
6 horas, [NOME].

Às 23h59 o carrinho fecha automaticamente.

Última chamada: [LINK]
</blockquote>`
          },
          {
            id: "whatsapp-lgpd-compliance",
            title: "LGPD no WhatsApp: Opt-in, Opt-out e Como Não Ser Banido",
            duration: "20 min",
            type: "text",
            glossaryTerms: ["opt-in"],
            keyPoints: ["O que a LGPD exige para mensagens de marketing via WhatsApp", "Double opt-in para WhatsApp: como implementar", "Gestão de opt-out: quando e como respeitar pedidos de saída", "Armazenamento de consentimento: o que guardar para se proteger", "Consequências jurídicas e como o mercado está se adaptando"],
            content: `<h2>LGPD e WhatsApp: O que Você Precisa Saber para Não Ter Problema</h2>
<p>A Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018) exige consentimento explícito para uso de dados pessoais para marketing. No WhatsApp, isso significa: você só pode enviar mensagens de marketing para quem te deu permissão explícita para isso.</p>

<h3>O que Configura Opt-in Válido para WhatsApp</h3>
<p>Opt-in válido = a pessoa forneceu o número E concordou expressamente em receber mensagens de marketing por WhatsApp. Não basta ter o número — precisa do consentimento para o canal.</p>
<p><strong>Formas válidas de opt-in:</strong></p>
<ul>
  <li>Formulário com checkbox: "Concordo em receber mensagens via WhatsApp" (desmarcado por padrão)</li>
  <li>Double opt-in: lead envia "SIM" para um número após receber solicitação</li>
  <li>Grupo de WhatsApp: entrada voluntária já configura consentimento implícito</li>
  <li>Compra realizada: comprador aceitou termos que incluem contato pós-venda (guarde os termos)</li>
</ul>

<h3>Armazenamento de Consentimento</h3>
<p>Guarde sempre: data/hora do opt-in, origem (qual formulário/página), texto exato apresentado ao usuário, IP do dispositivo. Esses dados são sua prova em caso de reclamação à ANPD.</p>

<h3>Gestão de Opt-out: Seja Eficiente</h3>
<p>Quando alguém responde "PARAR", "SAIR", "REMOVER" ou similar:</p>
<ul>
  <li>Confirme o opt-out imediatamente na mesma conversa</li>
  <li>Remova das listas de disparo em no máximo 48h (recomendado: imediatamente)</li>
  <li>Aplique tag "optout-whatsapp" no CRM</li>
  <li>Nunca reenvie para esse número sem novo opt-in explícito</li>
</ul>

<h3>Risco de Ban: Prevenção Prática</h3>
<p>O WhatsApp tem sistema automatizado de detecção de spam. Gatilhos de ban:</p>
<ul>
  <li>Muitos reports de "Bloquear e reportar" (limite desconhecido mas baixo)</li>
  <li>Taxa de resposta muito baixa em volume alto (indica lista comprada)</li>
  <li>Envio muito rápido (parece bot)</li>
  <li>Mesmo template copiado e colado centenas de vezes</li>
</ul>
<p><strong>Proteção:</strong> Use sempre número dedicado (nunca pessoal), personalize as mensagens (nome no mínimo), construa a lista somente com opt-in real, respeite os opt-outs imediatamente.</p>`
          },
          {
            id: "whatsapp-exercise",
            title: "Exercício: Monte Sua Primeira Sequência Automática de WhatsApp",
            duration: "20 min",
            type: "exercise",
            keyPoints: ["Definindo os 3 momentos de contato do seu lançamento", "Escrevendo os templates de mensagem", "Testando o fluxo completo"],
            content: `<h2>Exercício: Sequência de WhatsApp para Seu Próximo Lançamento</h2>`,
            exercise: `<h3>Monte Sua Sequência em 3 Passos</h3>
<p><strong>Passo 1: Defina os momentos de contato</strong><br/>
Escreva para seu lançamento específico:</p>
<ul>
  <li>Data de abertura de carrinho: ____</li>
  <li>Data de fechamento: ____</li>
  <li>Mensagem de aquecimento (D-7): data ____ horário ____</li>
  <li>Abertura de carrinho (D+0): data ____ horário ____</li>
  <li>Meio de carrinho: data ____ horário ____</li>
  <li>Fechamento manhã: data ____ horário ____</li>
  <li>Fechamento tarde: data ____ horário ____</li>
</ul>
<p><strong>Passo 2: Escreva os templates</strong><br/>
Use as estruturas da aula anterior e adapte para seu produto, público e voz. Escreva os 5 templates antes de abrir qualquer ferramenta de envio.</p>
<p><strong>Passo 3: Configure e teste</strong><br/>
Configure a sequência na sua ferramenta de escolha (Z-API, ManyChat ou outra). Envie uma mensagem de teste para o seu próprio número. Verifique: chegou rápido? Personalização correta? Links funcionando? Opt-out configurado?</p>
<p><em>Regra de ouro: se você recebesse essa mensagem de alguém, responderia? Se a resposta for não — reescreva antes de enviar para a lista.</em></p>`
          }
        ],
        locked: false
      },

      // ── CAPÍTULO 26: WEBHOOKS, ZAPIER E INTEGRAÇÕES ──
      {
        id: "webhooks-integracoes",
        number: 26,
        title: "Webhooks, Zapier e Make: A Cola Entre Todos os Sistemas",
        subtitle: "Automatize o que nenhuma plataforma faz nativamente — sem programar",
        icon: "🔗",
        color: "from-orange-800 to-red-900",
        duration: "1h 45min",
        summary: "Cada plataforma que você usa é uma ilha. Webhooks e ferramentas de automação sem código (Zapier, Make) são a ponte que conecta essas ilhas — criando fluxos automatizados que nenhuma plataforma oferece nativamente. Quando um cliente compra, ele é marcado no CRM, adicionado ao WhatsApp, recebe o email de boas-vindas e tem acesso liberado — tudo sem intervenção humana.",
        lessons: [
          {
            id: "webhooks-fundamentos",
            title: "O que é um Webhook e como Ele Conecta Tudo",
            duration: "22 min",
            type: "text",
            keyPoints: ["Webhook vs. API: qual a diferença real", "Eventos comuns: purchase, lead, subscription, cancellation", "Como testar webhooks com ferramentas gratuitas", "JSON: entendendo o formato de dados dos webhooks", "Segurança: validando que o webhook é legítimo"],
            content: `<h2>Webhooks: A Tecnologia que Todos Usam mas Poucos Entendem</h2>
<p>Um webhook é uma notificação automática que um sistema envia para outro quando algo acontece. É o oposto de uma API — em vez de você ir buscar informação ("o que aconteceu?"), o sistema te avisa proativamente ("aconteceu algo!").</p>

<h3>A Analogia do Correio</h3>
<p><strong>API (polling):</strong> É como ir ao correio toda hora verificar se chegou carta. Você faz o esforço, independente de ter carta ou não.</p>
<p><strong>Webhook:</strong> É como ter entrega em domicílio com aviso sonoro. Quando chega, você é notificado imediatamente — sem esforço contínuo.</p>

<h3>Como um Webhook Funciona na Prática</h3>
<pre>
1. Você cadastra uma URL no sistema (ex: Hotmart)
2. Um evento acontece (compra confirmada)
3. Hotmart faz um POST para a URL que você cadastrou
4. O sistema que recebe a URL processa os dados
5. Dispara ação: adiciona contato, envia email, etc.

Tudo isso em menos de 1 segundo.
</pre>

<h3>O Formato JSON: Lendo os Dados do Webhook</h3>
<p>Todo webhook envia dados em formato JSON. Você não precisa saber programar para entender JSON — é basicamente um dicionário de pares chave:valor.</p>
<pre>
{
  "event": "PURCHASE_COMPLETE",
  "buyer": {
    "name": "Maria Silva",
    "email": "maria@email.com",
    "phone": "11999999999"
  },
  "product": {
    "name": "Curso de Lançamentos",
    "price": 2970.00,
    "currency": "BRL"
  },
  "purchase": {
    "approved_date": "2025-06-15T14:30:00Z",
    "payment_method": "credit_card"
  }
}
</pre>
<p>Cada ferramenta de automação (Zapier, Make) lê esse JSON e permite usar qualquer campo como dado na automação seguinte.</p>

<h3>Testando Webhooks com Webhook.site</h3>
<ol>
  <li>Acesse webhook.site — recebe um URL único gratuito</li>
  <li>Cole esse URL como URL de webhook na plataforma (ex: Hotmart)</li>
  <li>Simule um evento (compra de teste)</li>
  <li>O webhook.site mostra o JSON exato que a plataforma enviou</li>
  <li>Use esses dados para configurar sua automação no Zapier/Make</li>
</ol>`
          },
          {
            id: "zapier-make-automacoes",
            title: "Zapier e Make: Automações Sem Código Para Não-Técnicos",
            duration: "28 min",
            type: "text",
            keyPoints: ["Zapier vs. Make: qual escolher para cada caso de uso", "Criando seu primeiro Zap: Hotmart → ActiveCampaign", "Filtros e condicionais: executar ação apenas em casos específicos", "Multi-step automations: múltiplas ações em sequência", "Monitoramento: como saber quando uma automação falha"],
            content: `<h2>Zapier vs. Make: A Escolha Certa para Cada Caso</h2>
<table>
<tr><th>Critério</th><th>Zapier</th><th>Make (ex-Integromat)</th></tr>
<tr><td>Facilidade</td><td>Muito fácil (passo a passo)</td><td>Médio (visual, mas curva maior)</td></tr>
<tr><td>Integrações</td><td>6.000+ apps</td><td>1.500+ apps</td></tr>
<tr><td>Custo para 1.000 tarefas/mês</td><td>Grátis (limite 100) / $20</td><td>Grátis (1.000) / $9</td></tr>
<tr><td>Lógica complexa</td><td>Limitada (plano pago)</td><td>Excelente (roteamento, iteradores)</td></tr>
<tr><td>Recomendado para</td><td>Iniciantes, automações simples</td><td>Avançados, volume alto</td></tr>
</table>
<p><strong>Recomendação:</strong> Comece com Zapier pela simplicidade. Migre para Make quando precisar de lógica mais complexa ou reduzir custo.</p>

<h3>Criando seu Primeiro Zap: Hotmart → ActiveCampaign</h3>
<ol>
  <li>Zapier → Create Zap</li>
  <li><strong>Trigger:</strong> Webhooks by Zapier → Catch Hook → Copie a URL</li>
  <li>Cole a URL no Hotmart como webhook URL</li>
  <li>Faça uma compra de teste para o Zapier capturar o JSON</li>
  <li><strong>Action 1:</strong> ActiveCampaign → Create/Update Contact → mapeie email, nome, telefone</li>
  <li><strong>Action 2:</strong> ActiveCampaign → Add Tag → "comprou-[produto]"</li>
  <li><strong>Action 3:</strong> ActiveCampaign → Add to Automation → sequência de onboarding</li>
  <li>Teste e ative</li>
</ol>

<h3>Filtros: Executando Apenas para Casos Específicos</h3>
<p>Filtros permitem que a automação só continue se certas condições forem atendidas.</p>
<p>Exemplos:</p>
<ul>
  <li>Só executar se evento = "PURCHASE_COMPLETE" (não para PURCHASE_EXPIRED)</li>
  <li>Só executar se produto = "Curso Premium" (ignorar outros produtos)</li>
  <li>Só executar se email não contém "@test.com" (ignorar compras de teste)</li>
</ul>
<p>No Zapier: após o trigger, adicione um Filter Step. No Make: use um Router com condição.</p>

<h3>Monitoramento de Automações</h3>
<p>Uma automação que falha silenciosamente é pior que não ter automação — você pensa que está funcionando mas leads estão se perdendo.</p>
<ul>
  <li>Zapier: Zap History → veja todas as execuções, sucessos e falhas</li>
  <li>Configure alertas de email quando um Zap falha (Zapier → Settings → Notifications)</li>
  <li>Crie um Zap de monitoramento: se ActiveCampaign não recebeu contato novo em 24h (durante lançamento ativo), envie alerta no Slack/email</li>
</ul>`
          },
          {
            id: "fluxo-mestre-integracao",
            title: "O Fluxo Mestre: Conectando Hotmart + Email + WhatsApp + CRM",
            duration: "30 min",
            type: "text",
            glossaryTerms: ["nurturing", "ltv", "mrr"],
            keyPoints: ["Mapeando o fluxo completo de um lançamento", "Decisões de roteamento: compradores, não-compradores, reembolsados", "Sincronizando dados entre plataformas sem duplicação", "O fluxo de um afiliado: rastreando comissões e nutrição", "Documentando suas automações para manutenção futura"],
            content: `<h2>O Fluxo Completo de um Lançamento Automatizado</h2>
<p>Um lançamento profissional tem dezenas de eventos e ramificações. Este é o mapa completo — do primeiro lead ao cliente recorrente.</p>

<h3>Fase 1: Captura de Lead</h3>
<pre>
Anúncio ou post orgânico
    ↓
Landing Page de captura
    ↓
Lead cadastrado → Hotmart (ou formulário próprio)
    ↓ (webhook)
Zapier/Make recebe evento
    ↙              ↓              ↘
ActiveCampaign   RD Station     Planilha Google
(tag: lead-novo) (conversão)    (backup de leads)
    ↓
Sequência de nutrição inicia
(7 emails em 14 dias)
</pre>

<h3>Fase 2: Abertura de Carrinho</h3>
<pre>
Email 1: Abertura + bônus
    ↓ 2h depois
WhatsApp (Z-API): mensagem de abertura
    ↓ Monitorar
[Lead visitou página de vendas?]
  Sim ↓                   Não ↓
Tag "visitou-pv"    Continua sequência
    ↓               padrão de nutrição
Email "viu mas
não comprou"
</pre>

<h3>Fase 3: Pós-Compra</h3>
<pre>
Compra confirmada (PURCHASE_COMPLETE)
    ↓ webhook imediato
Zapier: 4 ações em paralelo:
├── 1. ActiveCampaign: tag "comprador", remove sequência de nutrição, inicia onboarding
├── 2. Z-API: WhatsApp de boas-vindas em &lt;5 minutos
├── 3. Planilha Google: registra compra com valor + produto + data
└── 4. Slack/Email interno: notificação "Nova venda: R$X"
</pre>

<h3>Tratamento de Exceções</h3>
<pre>
REEMBOLSO (PURCHASE_REFUNDED):
├── Remove tag "comprador"
├── Adiciona tag "reembolsado"  
├── Pausa sequência de onboarding
├── Inicia sequência de recuperação (3 emails em 7 dias)
└── Revoga acesso na área de membros

BOLETO EXPIRADO (PURCHASE_EXPIRED):
├── Tag "boleto-expirado"
├── Email: "Seu boleto expirou — gere um novo aqui" + link
├── WhatsApp: mensagem de reativação
└── Remove da sequência após 3 tentativas sem retorno
</pre>

<h3>Documentando Suas Automações</h3>
<p>Toda automação que você cria, documente em uma planilha simples:</p>
<table>
<tr><th>Nome da automação</th><th>Gatilho</th><th>Ação</th><th>Data criação</th><th>Status</th></tr>
<tr><td>Compra → AC</td><td>PURCHASE_COMPLETE Hotmart</td><td>Tag AC + OnboardingFlow</td><td>01/06/25</td><td>✓ Ativo</td></tr>
<tr><td>Compra → WhatsApp</td><td>PURCHASE_COMPLETE Hotmart</td><td>Z-API boas-vindas</td><td>01/06/25</td><td>✓ Ativo</td></tr>
</table>
<p>Esta documentação salva horas quando algo quebra às 23h no dia de fechamento do carrinho.</p>`
          },
          {
            id: "monitoramento-alertas",
            title: "Monitoramento, Alertas e Resolução de Problemas em Produção",
            duration: "18 min",
            type: "text",
            keyPoints: ["O que pode dar errado em um lançamento (e o que fazer)", "Dashboard de monitoramento em tempo real", "Alertas automáticos para falhas críticas", "Procedimento de emergência: o que fazer quando algo quebra"],
            content: `<h2>Quando Algo Quebra às 23h no Fechamento do Carrinho</h2>
<p>Todo lançamento tem algum problema técnico. A diferença entre o profissional e o amador não é não ter problemas — é detectá-los rápido e ter protocolo de resposta.</p>

<h3>O que Pode Quebrar (em ordem de frequência)</h3>
<ol>
  <li><strong>Webhook parou de funcionar</strong> — Causa: token expirou, URL mudou, serviço fora do ar. Detecção: nenhum contato novo no ActiveCampaign apesar de vendas. Solução: verificar Zapier History, reconfigurar webhook.</li>
  <li><strong>Email indo para spam</strong> — Causa: volume muito alto, blacklist, SPF/DKIM desconfigurado. Detecção: taxa de abertura cai para &lt;5%. Solução: verificar blacklists, reduzir volume, warmup de IP.</li>
  <li><strong>Z-API desconectou</strong> — Causa: WhatsApp Web deslogou. Detecção: mensagens não sendo entregues. Solução: reescanear QR Code.</li>
  <li><strong>Pixel não disparando</strong> — Causa: GTM publicou versão com erro, script bloqueado. Detecção: Pixel Helper mostra erro. Solução: publicar versão anterior do GTM.</li>
  <li><strong>Checkout fora do ar</strong> — Causa: Hotmart/Kiwify com instabilidade. Detecção: carrinho não abrindo. Solução: backup em outra plataforma (sempre tenha).</li>
</ol>

<h3>Dashboard de Monitoramento em Tempo Real</h3>
<p>Durante os dias de lançamento, monitore a cada 2h:</p>
<ul>
  <li>Vendas no painel Hotmart/Kiwify (número absoluto + ritmo vs. projeção)</li>
  <li>Zapier History: último Zap executado há menos de 1h?</li>
  <li>ActiveCampaign: novos contatos chegando?</li>
  <li>Pixel Helper: testando uma página antes de escalar anúncios</li>
</ul>

<blockquote>Tenha sempre um plano B para os elementos críticos. Se o Hotmart estiver fora, Kiwify recebe. Se Z-API desconectar, manda manual para os top 100. Se email estiver no spam, acelera o WhatsApp. Flexibilidade em tempo real é o que separa lançamentos de R$50k de lançamentos de R$500k.</blockquote>`
          }
        ],
        locked: false
      },

      // ── CAPÍTULO 27: CALENDÁRIO EDITORIAL E CRONOGRAMA OPERACIONAL ──
      {
        id: "calendario-operacional",
        number: 27,
        title: "Calendário Editorial e Cronograma Operacional de Lançamento",
        subtitle: "O mapa completo de 30 dias que transforma a teoria em execução perfeita",
        icon: "📅",
        color: "from-indigo-800 to-blue-900",
        duration: "2h",
        summary: "Um lançamento sem cronograma é um lançamento que vai improvisar — e improviso custa receita. Este capítulo entrega o cronograma operacional completo de 30 dias: o que publicar, quando disparar, quanto gastar em anúncios em cada fase e como coordenar orgânico + pago + email + WhatsApp para máxima sinergia.",
        lessons: [
          {
            id: "timing-sequencias-plf",
            title: "A Lógica de Timing das Sequências PLF (Semana a Semana)",
            duration: "25 min",
            type: "text",
            keyPoints: ["Os 4 períodos de um lançamento e o que deve acontecer em cada um", "Pré-aquecimento (D-30 a D-14): construindo audiência e lista", "Pré-lançamento (D-14 a D-0): aquecendo a lista para comprar", "Carrinho (D+0 a D+7): maximizando conversões", "Pós-lançamento (D+8 a D+30): retendo e upselling"],
            content: `<h2>A Anatomia de um Lançamento de 30 Dias</h2>
<p>Um lançamento não começa quando o carrinho abre — começa 30 dias antes. E não termina quando o carrinho fecha — o pós-lançamento é onde se constrói o próximo lançamento.</p>

<h3>Os 4 Períodos e seus Objetivos</h3>

<h4>Período 1: Pré-Aquecimento (D-30 a D-14)</h4>
<p><strong>Objetivo:</strong> Construir audiência e lista. Ainda não fale no produto — fale no problema.</p>
<ul>
  <li>Conteúdo: 100% educacional sobre o tema do produto</li>
  <li>Anúncios: campanhas de tráfego para conteúdo (não de conversão)</li>
  <li>Email: se você tem lista, envie 1-2 emails de valor puro</li>
  <li>Lead magnet: lance ou reative um lead magnet forte para crescer a lista</li>
</ul>

<h4>Período 2: Pré-Lançamento (D-14 a D-0)</h4>
<p><strong>Objetivo:</strong> Aquecer a lista para comprar. Crie expectativa sem revelar o preço.</p>
<ul>
  <li>Semana 1 (D-14 a D-7): Conteúdo PLF — aula 1 (oportunidade), aula 2 (transformação)</li>
  <li>Semana 2 (D-7 a D-0): Conteúdo PLF — aula 3 (mecanismo único), sequência de email de aquecimento</li>
  <li>Anúncios: remarketing para lista de email + engajados no conteúdo</li>
  <li>WhatsApp: 1 mensagem de aquecimento em D-7</li>
</ul>

<h4>Período 3: Carrinho Aberto (D+0 a D+7)</h4>
<p><strong>Objetivo:</strong> Maximizar vendas. Todos os canais em alta frequência.</p>
<ul>
  <li>D+0: Email de abertura (manhã) + WhatsApp (manhã) + Reels anunciando abertura</li>
  <li>D+1-D+4: Emails diários + anúncios de conversão + conteúdo orgânico de prova social</li>
  <li>D+5-D+6: Início da urgência — emails de bônus expirando</li>
  <li>D+7 (fechamento): 3 emails + 2 WhatsApp + post de "últimas horas"</li>
</ul>

<h4>Período 4: Pós-Lançamento (D+8 a D+30)</h4>
<p><strong>Objetivo:</strong> Reter compradores e plantar semente do próximo lançamento.</p>
<ul>
  <li>Semana 1 pós-lançamento: Onboarding intensivo de novos alunos</li>
  <li>Semana 2: Primeiro check-in de resultado + convite para comunidade</li>
  <li>Semana 3: Case study de aluno + upsell de próximo produto</li>
  <li>Semana 4: Pesquisa NPS + programa de indicação</li>
</ul>

<blockquote>A regra de ouro do timing: nunca improvise durante o carrinho aberto. Cada email, cada post, cada WhatsApp deve estar escrito e agendado antes do carrinho abrir. Improviso no meio do lançamento é o caminho mais rápido para erros, inconsistências e receita abaixo do potencial.</blockquote>`
          },
          {
            id: "ferramentas-agendamento-conteudo",
            title: "Ferramentas de Agendamento: Metricool, Buffer e Agendamento Nativo",
            duration: "22 min",
            type: "text",
            keyPoints: ["Metricool: o melhor custo-benefício para o mercado BR", "Buffer: simplificidade para quem usa poucos canais", "Agendamento nativo (Instagram, Facebook, YouTube): quando usar", "Agendamento de anúncios: day-parting por fase do lançamento", "O fluxo de aprovação: como trabalhar com equipe sem caos"],
            content: `<h2>Agendando Tudo com Antecedência: A Operação Que Não Improvisa</h2>
<p>Uma das habilidades mais subestimadas do marketing digital é a capacidade de produzir e agendar com antecedência. Quem improvisa perde o ritmo no momento que mais importa — o carrinho aberto.</p>

<h3>Metricool: Recomendado para o Mercado BR</h3>
<p><strong>Por que Metricool:</strong> Interface em PT-BR, integração com todas as redes relevantes (Instagram, TikTok, Facebook, YouTube, LinkedIn, Twitter/X, Google My Business, Pinterest), plano gratuito generoso, plano pago em BRL.</p>
<p><strong>Funcionalidades que fazem diferença:</strong></p>
<ul>
  <li>Best Time to Post: analisa seu histórico e sugere horários com maior engajamento</li>
  <li>Smart Links: página de bio com links rastreados</li>
  <li>AutoList: reposta automática de conteúdo evergreen</li>
  <li>Reports: relatórios de performance em PDF para clientes/equipe</li>
</ul>

<h3>Agendamento por Rede Social</h3>
<table>
<tr><th>Rede</th><th>Ferramenta recomendada</th><th>Obs.</th></tr>
<tr><td>Instagram Feed/Reels</td><td>Metricool ou nativo</td><td>Reels: nativo tem limitações</td></tr>
<tr><td>Instagram Stories</td><td>Metricool (via notificação)</td><td>Stories com stickers interativos: só manual</td></tr>
<tr><td>TikTok</td><td>Metricool ou nativo</td><td>TikTok Studio nativo funciona bem</td></tr>
<tr><td>YouTube</td><td>YouTube Studio nativo</td><td>Melhor controle de thumbnail e cards</td></tr>
<tr><td>Facebook</td><td>Meta Business Suite nativo</td><td>Gratuito e completo para páginas</td></tr>
<tr><td>LinkedIn</td><td>LinkedIn nativo ou Buffer</td><td>Evite terceiros para artigos longos</td></tr>
</table>

<h3>Agendamento de Anúncios: Day-Parting por Fase</h3>
<p>Day-parting = configurar anúncios para rodar apenas em determinadas horas do dia.</p>
<p><strong>Pré-lançamento:</strong> 24/7 (tráfego de aquecimento, sem urgência de hora)</p>
<p><strong>Abertura de carrinho (D+0):</strong> Concentre budget entre 8h-23h. Dobre o budget das 19h às 23h (maior intenção de compra).</p>
<p><strong>Fechamento (último dia):</strong> Budget máximo das 14h até o fechamento às 23h59. Crie urgência real com copy de contagem regressiva.</p>

<h3>Fluxo de Aprovação para Equipes</h3>
<pre>
Criador produz conteúdo
    ↓
Designer formata / edita
    ↓
Revisor aprova (copy + visual)
    ↓
Gestor de lançamento agenda
    ↓
Notificação automática: "Conteúdo agendado para [data/hora]"
</pre>`
          },
          {
            id: "cronograma-definitivo-30-dias",
            title: "O Cronograma Definitivo: Dia a Dia dos 30 Dias de Lançamento",
            duration: "32 min",
            type: "text",
            keyPoints: ["Cada dia dos 30 dias: o que publicar, quando disparar", "Sinergia orgânico + pago: como amplificar o que funciona com verba", "Checklist de verificação diária durante o carrinho", "Adaptações em tempo real: como reagir ao que os dados mostram", "O cronograma adaptado para times de 1, 3 e 10+ pessoas"],
            content: `<h2>O Cronograma de 30 Dias: Nada Deixado ao Acaso</h2>

<h3>SEMANA 1 (D-30 a D-23): CONSTRUÇÃO DE AUDIÊNCIA</h3>
<table>
<tr><th>Dia</th><th>Orgânico</th><th>Email</th><th>WhatsApp</th><th>Ads</th></tr>
<tr><td>D-30</td><td>Reels: problema do público</td><td>—</td><td>—</td><td>Tráfego para Reels</td></tr>
<tr><td>D-28</td><td>Carrossel: dados sobre o problema</td><td>—</td><td>—</td><td>Tráfego para LP lead magnet</td></tr>
<tr><td>D-26</td><td>Stories: bastidores + enquete</td><td>—</td><td>—</td><td>—</td></tr>
<tr><td>D-24</td><td>Reels: história pessoal de transformação</td><td>Email de valor 1 (lista atual)</td><td>—</td><td>Remarketing engajados</td></tr>
</table>

<h3>SEMANA 2 (D-22 a D-15): AQUECIMENTO</h3>
<table>
<tr><th>Dia</th><th>Orgânico</th><th>Email</th><th>WhatsApp</th><th>Ads</th></tr>
<tr><td>D-21</td><td>Reels: dica 1 do conteúdo</td><td>—</td><td>—</td><td>Tráfego para conteúdo</td></tr>
<tr><td>D-19</td><td>Carrossel: framework básico</td><td>Email de valor 2</td><td>—</td><td>—</td></tr>
<tr><td>D-17</td><td>Stories: prova social (alunos)</td><td>—</td><td>—</td><td>Remarketing lista email</td></tr>
<tr><td>D-15</td><td>Reels: "semana que vem vou revelar..."</td><td>Email de anticipation</td><td>—</td><td>Lookalike compradores</td></tr>
</table>

<h3>SEMANA 3 (D-14 a D-7): PRÉ-LANÇAMENTO PLF</h3>
<table>
<tr><th>Dia</th><th>Orgânico</th><th>Email</th><th>WhatsApp</th><th>Ads</th></tr>
<tr><td>D-14</td><td>Aula 1 PLF (oportunidade)</td><td>Email 1 PLF</td><td>—</td><td>Tráfego para Aula 1</td></tr>
<tr><td>D-11</td><td>Stories: reações à Aula 1</td><td>Email follow-up Aula 1</td><td>—</td><td>Remarketing assistiu aula 1</td></tr>
<tr><td>D-9</td><td>Aula 2 PLF (transformação)</td><td>Email 2 PLF</td><td>Mensagem aquecimento</td><td>Tráfego para Aula 2</td></tr>
<tr><td>D-7</td><td>Reels: "Em 7 dias..."</td><td>Email 3 PLF</td><td>—</td><td>Escalar Lookalike</td></tr>
</table>

<h3>SEMANA 4 (D-6 a D+0): INTENSIFICAÇÃO</h3>
<table>
<tr><th>Dia</th><th>Orgânico</th><th>Email</th><th>WhatsApp</th><th>Ads</th></tr>
<tr><td>D-5</td><td>Aula 3 PLF (mecanismo único)</td><td>Email 4: prova social</td><td>—</td><td>Remarketing lista + Lookalike</td></tr>
<tr><td>D-3</td><td>Carrossel: perguntas frequentes</td><td>Email 5: quebra de objeção</td><td>—</td><td>Máximo em lista quente</td></tr>
<tr><td>D-1</td><td>Stories: "amanhã abre"</td><td>Email 6: "amanhã é o dia"</td><td>—</td><td>—</td></tr>
<tr><td>D+0 (8h)</td><td>Post de abertura</td><td>Email 7: ABERTURA</td><td>WhatsApp abertura</td><td>Conversão: máximo budget</td></tr>
</table>

<h3>CARRINHO ABERTO (D+0 a D+7)</h3>
<p>Durante o carrinho, monitore as métricas a cada 2-4h e ajuste. Se a taxa de abertura de email cair, aumente frequência de WhatsApp. Se os anúncios travarem, teste novos criativos imediatamente.</p>

<h3>Adaptações por Tamanho de Time</h3>
<p><strong>Solo (1 pessoa):</strong> Foque em email + WhatsApp + orgânico no Instagram. Ads opcionais. Pré-produza tudo na semana anterior ao lançamento.</p>
<p><strong>Time pequeno (2-3 pessoas):</strong> Divida: 1 pessoa em conteúdo + orgânico, 1 em ads + tracking, 1 em email + WhatsApp + suporte.</p>
<p><strong>Time médio (5+):</strong> Adicione especialista de cada canal. Reunião diária de 15min durante o carrinho para sync.</p>`
          },
          {
            id: "budget-distribution-fases",
            title: "Budget Distribution: Como Alocar Verba de Anúncios por Fase",
            duration: "22 min",
            type: "text",
            glossaryTerms: ["roas", "cac", "cpm", "ctr"],
            keyPoints: ["A distribuição de budget que maximiza ROAS no lançamento", "Quanto gastar em cada fase: pré, durante e fechamento", "Ramp-up de budget: como escalar sem quebrar a otimização", "Distribuição por público: frio, morno e quente", "O modelo de Excel para calcular budget ideal por receita meta"],
            content: `<h2>A Matemática do Budget em um Lançamento</h2>
<p>A maioria dos produtores erra no budget de duas formas: ou gasta demais no tráfego frio antes de aquecer, ou segura o investimento quando a máquina está quente. A distribuição correta pode aumentar o ROAS em 30-50%.</p>

<h3>Modelo de Distribuição de Budget por Fase</h3>
<table>
<tr><th>Fase</th><th>% do Budget Total</th><th>Foco</th></tr>
<tr><td>Pré-aquecimento (D-30 a D-14)</td><td>10-15%</td><td>Tráfego frio + crescimento de lista</td></tr>
<tr><td>Pré-lançamento (D-14 a D-0)</td><td>20-25%</td><td>Aquecimento de lista + remarketing</td></tr>
<tr><td>Abertura + primeiros 3 dias</td><td>30-35%</td><td>Conversão: quente + morno</td></tr>
<tr><td>Últimos 2 dias (fechamento)</td><td>25-30%</td><td>Conversão máxima: urgência + scarcity</td></tr>
</table>

<h3>Calculando o Budget Ideal por Meta de Receita</h3>
<pre>
Meta de receita bruta: R$100.000
Ticket médio: R$2.000
Vendas necessárias: 50 vendas

Taxa de conversão histórica checkout: 3%
Visitantes necessários na PV: 50 ÷ 0,03 = 1.667 visitantes

CPC médio dos anúncios: R$2,50
Budget necessário em anúncios: 1.667 × R$2,50 = R$4.167

ROAS esperado: R$100.000 ÷ R$4.167 = 24x
</pre>
<p>Esse cálculo é a base. Na prática, adicione 20% de margem de segurança e separe verba para testes de criativo (15-20% do total).</p>

<h3>Distribuição por Tipo de Público</h3>
<p>Para um budget de R$10.000 no carrinho de 7 dias:</p>
<ul>
  <li><strong>50%: Lista quente</strong> (email list custom audience, visitantes PV, seguidores IG) — maior ROAS, menor escala</li>
  <li><strong>30%: Lookalike 1%</strong> (similar a compradores anteriores) — bom equilíbrio</li>
  <li><strong>15%: Interesse frio</strong> (expansão de audiência) — menor ROAS mas maior alcance</li>
  <li><strong>5%: Teste de novos criativos</strong> — sempre testando para o próximo lançamento</li>
</ul>

<h3>Ramp-up Sem Quebrar a Otimização</h3>
<p>Aumentar budget muito rápido "quebra" a fase de aprendizagem do Meta — o algoritmo precisa recalcular o targeting com o novo volume. Regra prática:</p>
<ul>
  <li>Aumento máximo de 20-30% do budget a cada 24h</li>
  <li>Se ROAS cair &gt;30% após aumento → volte o budget anterior por 24h</li>
  <li>Pico de budget no último dia: pode dobrar de uma vez se o ROAS estiver estável</li>
</ul>`
          },
          {
            id: "cronograma-exercise",
            title: "Exercício Final: Monte o Cronograma do Seu Próximo Lançamento",
            duration: "25 min",
            type: "exercise",
            glossaryTerms: ["lead-magnet", "opt-in", "mrr"],
            keyPoints: ["Definindo as datas do seu lançamento", "Mapeando todos os conteúdos necessários", "Calculando o budget por fase"],
            content: `<h2>Exercício: Seu Cronograma Personalizado</h2>
<p>Usando tudo que aprendeu neste módulo, construa o cronograma completo do seu próximo lançamento. Este exercício é o produto final de todo o Módulo 8.</p>`,
            exercise: `<h3>Passo 1: Defina as Datas (15 min)</h3>
<p>Preencha as datas do seu próximo lançamento:</p>
<ul>
  <li>Data de início do pré-aquecimento: ____</li>
  <li>Data de início do pré-lançamento (D-14): ____</li>
  <li>Data de abertura do carrinho (D+0): ____</li>
  <li>Data de fechamento do carrinho: ____</li>
  <li>Ticket do produto: R$____</li>
  <li>Meta de receita: R$____</li>
  <li>Budget total de anúncios: R$____</li>
</ul>

<h3>Passo 2: Liste os Conteúdos Necessários</h3>
<p>Para cada semana, liste o que você precisa produzir:</p>
<p><strong>Semana 1 (pré-aquecimento):</strong> ____ posts, ____ stories, ____ Reels</p>
<p><strong>Semana 2 (aquecimento):</strong> ____ posts, ____ Reels, ____ emails</p>
<p><strong>Semana 3 (pré-lançamento):</strong> ____ aulas PLF, ____ emails, ____ WhatsApps</p>
<p><strong>Carrinho:</strong> ____ emails, ____ WhatsApps, ____ posts urgência</p>

<h3>Passo 3: Calcule o Budget por Fase</h3>
<p>Usando o modelo da última aula, calcule:</p>
<ul>
  <li>Budget pré-aquecimento (10-15%): R$____</li>
  <li>Budget pré-lançamento (20-25%): R$____</li>
  <li>Budget abertura + dias 1-4 (30-35%): R$____</li>
  <li>Budget dias finais + fechamento (25-30%): R$____</li>
</ul>

<h3>Passo 4: Monte o Checklist de Infraestrutura</h3>
<p>Antes de abrir o carrinho, confirme que tem:</p>
<ul>
  <li>[ ] Pixel + CAPI configurado e testado</li>
  <li>[ ] Webhooks Hotmart/Kiwify → Email marketing funcionando</li>
  <li>[ ] Sequência de emails completa e agendada</li>
  <li>[ ] Templates de WhatsApp escritos</li>
  <li>[ ] Automação de boas-vindas pós-compra funcionando</li>
  <li>[ ] Cronograma de conteúdo 100% pré-produzido</li>
  <li>[ ] Budget distribuído nas campanhas corretas</li>
  <li>[ ] Alertas de monitoramento configurados</li>
</ul>

<p><em>Este cronograma completo, com todos os itens do checklist marcados, é o que separa um lançamento profissional de um lançamento amador. O trabalho que você faz antes do carrinho abrir determina quanto você vai faturar quando ele abrir.</em></p>`
          }
        ],
        locked: false
      }
    ]
  },

  // ══════════════════════════════════════════════════════════════════
  // MÓDULO 9 — COPYWRITING E PERSUASÃO: A CIÊNCIA DE CONVERTER PALAVRAS EM VENDAS
  // ══════════════════════════════════════════════════════════════════
  {
    id: "copywriting-persuasao",
    number: 9,
    title: "Copywriting e Persuasão: A Ciência de Converter Palavras em Vendas",
    description: "A habilidade que multiplica o resultado de tudo que você já aprendeu. Copy não é dom — é estrutura, psicologia e técnica testável. Aqui você aprende as fórmulas, os gatilhos e os casos reais internacionais que documentaram o poder das palavras certas no momento certo.",
    badge: "Copy",
    chapters: [

      // ── CAPÍTULO 28: GATILHOS MENTAIS APLICADOS ──
      {
        id: "gatilhos-aplicados",
        number: 28,
        title: "Gatilhos Mentais Aplicados: Do Conceito ao Copy Real",
        subtitle: "Os 12 gatilhos do NexOS em profundidade — com exemplos reais e templates prontos",
        icon: "🧠",
        color: "from-purple-800 to-pink-900",
        duration: "2h",
        summary: "Listar gatilhos mentais é fácil. Saber usá-los no copy certo, no momento certo, para o público certo — isso é o que separa um copy de R$10k de um copy de R$1M. Este capítulo vai fundo em cada gatilho com exemplos reais e templates aplicáveis imediatamente.",
        lessons: [
          {
            id: "autoridade-prova-social-aplicados",
            title: "Autoridade e Prova Social: Os Dois Gatilhos que Vencem o Ceticismo",
            duration: "28 min",
            type: "text",
            keyPoints: ["Por que o cérebro obedece à autoridade sem questionar", "Tipos de autoridade: credencial, resultados, terceiros, mídia", "Prova social: números, depoimentos, casos e o efeito manada", "Como usar sem mentir: a linha entre persuasão e manipulação", "Templates prontos para 5 formatos de prova social"],
            content: `<h2>A Hierarquia da Confiança no Mercado Digital</h2>
<p>Robert Cialdini documentou no livro "Influence" (1984) um experimento que mudou o marketing: quando médicos prescreviam, as enfermeiras obedeciam automaticamente — mesmo quando a prescrição estava errada. O título de "Dr." ativava um bypass no sistema crítico do cérebro.</p>
<p>No marketing digital, funciona da mesma forma. O consumidor está sobrecarregado de informação e usa atalhos cognitivos para decidir em quem confiar. Autoridade e Prova Social são os dois atalhos mais poderosos.</p>

<h3>Os 4 Tipos de Autoridade que Funcionam no Mercado PT-BR</h3>
<p><strong>1. Autoridade de Credencial:</strong> Formação, certificações, histórico profissional.<br/>
Template: <em>"Depois de 12 anos como [profissão] e [número] de clientes atendidos..."</em></p>
<p><strong>2. Autoridade de Resultado Próprio:</strong> Você mesmo alcançou o resultado que ensina.<br/>
Template: <em>"Eu fui de R$3.200/mês de salário para R$87.000/mês no primeiro ano usando exatamente este método."</em></p>
<p><strong>3. Autoridade de Terceiros (Social Proof de Especialistas):</strong> Quem você conhece, quem validou seu trabalho.<br/>
Template: <em>"Método validado por [autoridade reconhecida] como 'o sistema mais completo disponível'"</em></p>
<p><strong>4. Autoridade de Mídia:</strong> Onde você apareceu — mas use com honestidade.<br/>
Template: <em>"Como visto em [veículo] — [o que foi dito sobre você/seu método]"</em></p>

<h3>Prova Social: Os 5 Formatos por Força Persuasiva</h3>
<table>
<tr><th>Formato</th><th>Força</th><th>Quando usar</th></tr>
<tr><td>Depoimento em vídeo com nome, foto e resultado específico</td><td>★★★★★</td><td>Página de vendas, VSL</td></tr>
<tr><td>Resultado documentado (print de receita, de ranking)</td><td>★★★★☆</td><td>Redes sociais, anúncios</td></tr>
<tr><td>Depoimento escrito com nome completo e foto</td><td>★★★☆☆</td><td>Email, landing page</td></tr>
<tr><td>Número de clientes/alunos ("mais de X pessoas")</td><td>★★☆☆☆</td><td>Headline, bio</td></tr>
<tr><td>Depoimento anônimo</td><td>★☆☆☆☆</td><td>Evitar — mata credibilidade</td></tr>
</table>

<h3>Template: Como Pedir um Depoimento que Converte</h3>
<p>O depoimento ruim: "Adorei o curso, recomendo a todos! — Maria S."</p>
<p>O depoimento que vende: "Antes do [produto], eu tentava faturar R$10k por mês há 2 anos e nunca chegava. Três semanas depois de aplicar o método do módulo 3, fechei R$34.800 em um único lançamento. O que mudou foi [detalhe específico]. — Maria Silva, 34 anos, [cidade], coach de carreira"</p>
<p>Peça ao aluno que responda 3 perguntas:</p>
<ol>
  <li>Qual era sua situação ANTES do [produto]?</li>
  <li>Qual foi o resultado específico que você alcançou DEPOIS?</li>
  <li>O que mais te surpreendeu no processo?</li>
</ol>`
          },
          {
            id: "escassez-urgencia-aplicados",
            title: "Escassez e Urgência: O Gatilho que Quebra a Procrastinação",
            duration: "25 min",
            type: "text",
            keyPoints: ["A neurociência da procrastinação e como a escassez a vence", "Escassez real vs. falsa: o custo de mentir para sua lista", "Urgência de tempo: como criar deadlines que o mercado acredita", "Escassez de vagas vs. bônus vs. preço: quando usar cada uma", "O script de fechamento de carrinho com 3 camadas de urgência"],
            content: `<h2>Por que as Pessoas Compram nos Últimos 2 Dias (e o que Fazer a Respeito)</h2>
<p>Análise de dados de 100+ lançamentos no mercado PT-BR mostra consistentemente: 30-40% da receita total de um lançamento acontece no último dia de carrinho. A maioria dessas vendas ocorre nas últimas 2 horas.</p>
<p>Isso não é acidente — é neurociência. O cérebro humano adia decisões enquanto existir a opção de decidir depois. Quando essa opção desaparece, ele age. A escassez e a urgência são os gatilhos que removem a opção de "decidir depois".</p>

<h3>A Regra de Ouro: Escassez Só Funciona Quando é Real</h3>
<p>Mercado PT-BR já está educado. "Só 10 vagas" em página com tráfego de 50.000 visitantes, para um produto digital que não tem limite físico — ninguém acredita. E quando não acredita no gatilho, não acredita em nada mais que você diz.</p>
<p><strong>Escassez real que funciona:</strong></p>
<ul>
  <li>Bônus com limitação real: "As primeiras 50 compras ganham uma sessão 1:1 comigo" (você tem 50 horas disponíveis — é real)</li>
  <li>Preço com data de expiração: "R$997 até sexta. Depois volta para R$1.497" (mude o preço de fato)</li>
  <li>Turma fechada: "A próxima turma abre em 6 meses" (se for verdade)</li>
  <li>Acesso antecipado: "Primeiros 100 ganham acesso a [módulo bônus]" (se existir o módulo)</li>
</ul>

<h3>O Script de 3 Camadas para Fechamento de Carrinho</h3>
<p><strong>Camada 1 — Urgência de Bônus (D-2):</strong><br/>
"Os bônus [X], [Y] e [Z] saem amanhã à meia-noite. Quem entrar depois paga o mesmo preço mas não tem acesso a essas três adições — no total R$847 em bônus que vão embora em 36 horas."</p>
<p><strong>Camada 2 — Urgência de Preço (D-1):</strong><br/>
"Amanhã é o último dia com este preço. Na segunda-feira [produto] volta para R$1.997 — o mesmo que nossos alunos antigos pagaram. Você está a 24 horas de economizar R$1.000."</p>
<p><strong>Camada 3 — Urgência de Acesso (Último Dia, às 22h):</strong><br/>
"Em 2 horas o carrinho fecha automaticamente. Não tem prorrogação, não tem extensão — o sistema bloqueia a compra à meia-noite. Esta é a última vez que envio esta mensagem."</p>
<p>E feche de verdade. Quem tenta comprar às 00:05 e não consegue aprende que você é confiável. Na próxima abertura, age mais cedo.</p>`
          },
          {
            id: "reciprocidade-antecipacao-aplicados",
            title: "Reciprocidade, Antecipação e Curiosidade: Os Gatilhos de Aquecimento",
            duration: "22 min",
            type: "text",
            keyPoints: ["Reciprocidade: o princípio de Dale Carnegie aplicado ao marketing", "Como entregar valor antes de pedir a venda", "Antecipação: criando expectativa que vende antes do carrinho abrir", "Curiosidade: o loop aberto que mantém a lista engajada", "Contraste: comparando para justificar o preço"],
            content: `<h2>Os Gatilhos que Vendem Antes do Carrinho Abrir</h2>
<p>Um lançamento bem executado começa a vender antes do carrinho abrir. O gatilho de reciprocidade, quando ativado corretamente, faz a lista sentir que "deve" uma chance ao produto antes de ver qualquer argumento de venda.</p>

<h3>Reciprocidade: A Dívida que Vende</h3>
<p>Robert Cialdini documentou em "Influence": voluntários que receberam uma Coca-Cola "por acidente" compraram 2x mais rifas do que os que não receberam. O valor da Coca-Cola era R$2 equivalente. As rifas custavam R$15. A proporção não importou — o gatilho de dívida sim.</p>
<p>No marketing digital: entregue conteúdo genuinamente útil gratuitamente — um tutorial completo, uma planilha real, um framework que funciona — antes de qualquer venda. A lista que recebeu valor sem pagar sente a dívida cognitiva de reciprocidade.</p>
<p><strong>Template de sequência de reciprocidade:</strong></p>
<pre>
D-14: Tutorial completo (valor real, não isca vazia)
D-11: Planilha ou template pronto para usar
D-8: Webinar gratuito com conteúdo de verdade
D-5: Mini-guia PDF com insights exclusivos
D+0: Oferta de venda
</pre>

<h3>Antecipação: O Loop que Não Fecha</h3>
<p>O cérebro humano tem dificuldade com loops abertos — ele busca completar padrões. Use isso:</p>
<ul>
  <li>"Na próxima semana vou revelar o método que uso para [resultado] — e que nunca ensinei antes"</li>
  <li>"Parte 1 de 3: [conteúdo incompleto que gera pergunta sobre o que vem a seguir]"</li>
  <li>"Você vai entender o porquê disso quando eu revelar o passo 2 — fique de olho no próximo email"</li>
</ul>

<h3>Contraste: Fazendo o Preço Parecer Pequeno</h3>
<p>Nenhum preço existe no vácuo — todo preço é avaliado em comparação a algo. Controle a comparação:</p>
<ul>
  <li>"Uma consultoria comigo de 1h custa R$3.000. Você tem acesso a 60 horas por R$997."</li>
  <li>"Um MBA custa R$40.000 e 2 anos. Este método entrega os resultados práticos em 30 dias por R$1.497."</li>
  <li>"Se aplicar o método uma única vez e faturar R$10k, o investimento de R$997 retorna em 30 dias."</li>
</ul>`
          },
          {
            id: "medo-perda-transformacao-aplicados",
            title: "Medo de Perda e Transformação: Os Gatilhos que Movem a Decisão Final",
            duration: "22 min",
            type: "text",
            keyPoints: ["Loss aversion: por que perder dói mais do que ganhar satisfaz", "Transformação: vendendo o antes/depois, não o produto", "Identidade: quando o produto se torna parte de quem a pessoa quer ser", "Como combinar medo de perda + transformação em um mesmo copy", "O parágrafo de fechamento que combina todos os gatilhos"],
            content: `<h2>Loss Aversion: A Descoberta que Mudou o Marketing</h2>
<p>Daniel Kahneman e Amos Tversky documentaram em 1979 (Prospect Theory — Prêmio Nobel de Economia 2002): perder R$100 gera o dobro do impacto psicológico que ganhar R$100. Não é 1:1 — é 2:1. Perder dói duas vezes mais do que ganhar satisfaz.</p>
<p>Implicação direta: copy que foca no que o lead perde ao não comprar converte melhor que copy que foca no que ganha ao comprar.</p>

<h3>Reescrevendo Benefícios como Perdas</h3>
<table>
<tr><th>Copy orientado a ganho (fraco)</th><th>Copy orientado a perda (forte)</th></tr>
<tr><td>"Você vai faturar R$10k por mês"</td><td>"Cada mês que passa sem sistema é R$10k que ficou na mesa"</td></tr>
<tr><td>"Aprenda a criar anúncios que convertem"</td><td>"Sem esse conhecimento, você continuará pagando 3x mais por lead do que deveria"</td></tr>
<tr><td>"Ganhe mais tempo com automação"</td><td>"Você está perdendo 15 horas/semana em tarefas que poderiam ser automáticas"</td></tr>
</table>

<h3>Transformação: Não Venda o Produto — Venda o Depois</h3>
<p>Ninguém compra um curso. Ninguém compra uma ferramenta. As pessoas compram quem elas vão se tornar ao usar o produto.</p>
<p>Steve Jobs não vendia MP3 players — vendia "1.000 músicas no seu bolso".<br/>
Nike não vende tênis — vende a identidade do atleta que vence.<br/>
Você não vende um curso de copywriting — vende a capacidade de nunca mais precisar de ninguém para escrever copy que converte.</p>
<p><strong>Template de parágrafo de transformação:</strong><br/>
"Imagina [resultado concreto em cenário detalhado]. Imagina [segundo resultado que descreve o estilo de vida]. Essa é a realidade de quem domina [o que o produto ensina]. É onde [aluno X] chegou depois de [tempo]. É onde você pode estar em [tempo realista] — se você agir hoje."</p>

<h3>O Parágrafo de Fechamento Definitivo</h3>
<p>Combine todos os gatilhos no parágrafo final da VSL ou email de fechamento:</p>
<blockquote>
"Você chegou até aqui porque algo nessa história ressoou com você [autoridade/empatia]. Mais de [X] pessoas já fizeram essa escolha e estão colhendo resultados [prova social]. O carrinho fecha em [tempo] — depois disso, volta para R$[preço maior] [urgência real]. Cada dia que passa é [perda concreta] [loss aversion]. Você merece ver como é do outro lado [transformação]. A decisão é sua — e você já sabe o que quer fazer."
</blockquote>`
          }
        ],
        locked: false
      },

      // ── CAPÍTULO 29: ESTRUTURAS DE COPY ──
      {
        id: "estruturas-copy",
        number: 29,
        title: "Estruturas de Copy: Fórmulas, Headlines e CTAs para Cada Canal",
        subtitle: "O arsenal completo de copy — da bio do Instagram à página de vendas de R$1M",
        icon: "✍️",
        color: "from-indigo-800 to-violet-900",
        duration: "2h 20min",
        summary: "Copy não é criatividade — é estrutura. As mesmas fórmulas que David Ogilvy usou em 1955 funcionam no Instagram de 2025 porque a psicologia humana não mudou. Aqui você aprende a estrutura por trás de cada formato de copy e como adaptar para cada canal.",
        lessons: [
          {
            id: "copy-landing-page",
            title: "Copy de Landing Page e Página de Vendas: Do Headline ao Fechamento",
            duration: "32 min",
            type: "text",
            keyPoints: ["A hierarquia de atenção em uma página de vendas", "O headline que para o scroll: 8 fórmulas testadas", "Seção de benefícios vs. features: a diferença que dobra a conversão", "A seção de objeções: antecipe e destrua antes que apareçam", "O CTA perfeito: texto, cor, posição e repetição"],
            content: `<h2>A Estrutura da Página de Vendas que Converte</h2>
<p>David Ogilvy escreveu para a Rolls-Royce em 1958: "At 60 miles an hour the loudest noise in the new Rolls-Royce comes from the electric clock." Esse anúncio de uma linha vendeu mais Rolls-Royces do que qualquer campanha anterior. Por quê? Porque o headline era tão específico, tão credível e tão orientado ao benefício do comprador que passou imediatamente pelo filtro do ceticismo.</p>
<p>A estrutura de uma boa página de vendas segue essa mesma lógica: cada elemento passa pelo filtro "por que o leitor se importaria com isso?"</p>

<h3>A Hierarquia de uma Página de Vendas</h3>
<pre>
1. HEADLINE (a promessa principal — único elemento que determina se leem o resto)
2. SUBHEADLINE (expande e especifica a promessa)
3. VÍDEO DE VSL ou ABERTURA DE COPY (história + identificação com a dor)
4. AGITAÇÃO DO PROBLEMA (consequências de não resolver)
5. APRESENTAÇÃO DA SOLUÇÃO (o produto como transformação)
6. O QUE ESTÁ DENTRO (módulos, lições, bônus)
7. PROVA SOCIAL (depoimentos com resultados específicos)
8. SOBRE O CRIADOR (credenciais que importam para ESTE público)
9. OFERTA + PREÇO (com stack de valor e âncora de preço)
10. GARANTIA (remove o risco da decisão)
11. URGÊNCIA E ESCASSEZ (razão para agir agora)
12. FAQ (destrói as 5 principais objeções)
13. CTA FINAL (instrução clara)
</pre>

<h3>Headlines: As 8 Fórmulas de Alto Impacto</h3>
<ol>
  <li><strong>Benefício + Especificidade:</strong> "Como Gerar R$23.400 em 7 Dias Usando Apenas o Celular e Sem Investir em Anúncios"</li>
  <li><strong>Segredo/Revelação:</strong> "O Método que 347 Produtores Usam em Silêncio para Lançar R$500k Enquanto a Maioria Lança R$50k"</li>
  <li><strong>Pergunta com Dor:</strong> "Você Cria Conteúdo Todo Dia e Ainda Assim Não Consegue Vender? Aqui Está o Motivo Real"</li>
  <li><strong>Aviso:</strong> "AVISO: Se Você Está Usando Copywriting Tradicional em 2025, Está Perdendo 60% das Suas Vendas"</li>
  <li><strong>Quem Mais Quer:</strong> "Quem Mais Quer Lançar um Produto Digital e Faturar R$10k no Primeiro Mês?"</li>
  <li><strong>Prova pelo Número:</strong> "2.847 Alunos Faturaram Mais de R$100k Usando Esta Fórmula em 12 Meses"</li>
  <li><strong>Como + Sem:</strong> "Como Dobrar Suas Vendas Sem Aumentar o Orçamento de Anúncios"</li>
  <li><strong>Antes/Depois:</strong> "De Professora Municipal de R$2.800/mês a R$87.000 no Primeiro Lançamento"</li>
</ol>

<h3>Benefícios vs. Features: A Diferença que Dobra Conversão</h3>
<table>
<tr><th>Feature (fraco)</th><th>Benefício (forte)</th></tr>
<tr><td>"15 horas de vídeo-aulas"</td><td>"Você implementa o método em 2 semanas sem precisar pausar a vida"</td></tr>
<tr><td>"6 módulos de copywriting"</td><td>"Você nunca mais paga R$3k para um copywriter escrever sua página de vendas"</td></tr>
<tr><td>"Planilha de métricas"</td><td>"Você vê em 5 minutos se sua campanha vai lucrar ou sangrar — sem precisar calcular nada"</td></tr>
</table>

<h3>CTAs que Funcionam</h3>
<p>Evite: "Comprar", "Clique Aqui", "Saiba Mais"</p>
<p>Use: verbos que descrevem o resultado ou a ação positiva:</p>
<ul>
  <li>"Quero [resultado]" → "Quero Dobrar Meu Faturamento"</li>
  <li>"Começar [o resultado]" → "Começar Meu Primeiro Lançamento"</li>
  <li>"Me inscrever em [transformação]" → "Me inscrever no Método"</li>
  <li>"Garantir minha vaga" (escassez implícita)</li>
  <li>"Acessar agora" (imediatismo)</li>
</ul>`
          },
          {
            id: "copy-anuncio-avancado",
            title: "Copy de Anúncio Avançado: Meta Ads, Google e TikTok",
            duration: "28 min",
            type: "text",
            keyPoints: ["A estrutura do anúncio de texto (primary text, headline, descrição)", "Hook de vídeo: os primeiros 3 segundos que determinam tudo", "Copy de anúncio para cada temperatura de público (frio, morno, quente)", "Testes A/B de copy: o que testar e como interpretar", "Os formatos de anúncio que mais vendem por objetivo"],
            content: `<h2>Copy de Anúncio: Menos é Mais, Mas Precisa Ser Certo</h2>
<p>Um anúncio tem 1,7 segundo para capturar atenção no feed (dado da Meta, 2023). Nesse tempo, o usuário decide subconscientemente: "isso me interessa ou rolo para o próximo?"</p>
<p>Copy de anúncio não é sobre criatividade literária — é sobre interromper o padrão e gerar relevância em menos de 2 segundos.</p>

<h3>Estrutura do Anúncio de Texto no Meta Ads</h3>
<p><strong>Primary Text (o corpo):</strong> 125 caracteres antes do "ver mais" em mobile. Os primeiros 125 caracteres são tudo — se não capturar ali, o restante não será lido.</p>
<p>Fórmulas para os primeiros 125 caracteres:</p>
<ul>
  <li><strong>Pergunta de dor:</strong> "Você está investindo em anúncios mas suas vendas ainda não decolaram? Aqui está o erro invisível que 90% dos produtores cometem."</li>
  <li><strong>Declaração ousada:</strong> "Eu fui de R$1.800/mês em emprego fixo para R$64.000 no primeiro lançamento. Sem audiência prévia. Sem lista. Aqui está o método."</li>
  <li><strong>Revelação:</strong> "A razão pela qual seu produto digital não vende não é o preço, não é a copy e não é o produto. É algo que a maioria nunca percebe."</li>
</ul>

<h3>Hook de Vídeo: Os 3 Segundos que Decidem Tudo</h3>
<p>Para anúncios em vídeo, o hook (primeira fala ou texto na tela) é mais importante do que todo o resto combinado. Se não retém em 3 segundos, o algoritmo para de entregar.</p>
<p><strong>Tipos de hook de alta retenção:</strong></p>
<ul>
  <li><strong>Declaração contraintuitiva:</strong> "Para de criar conteúdo. Sério."</li>
  <li><strong>Número específico:</strong> "Esse método me deu R$127.400 em 11 dias"</li>
  <li><strong>Pergunta direcionada:</strong> "Se você está tentando vender curso online, precisa ver isso"</li>
  <li><strong>Objeção virada:</strong> "Não, você não precisa de audiência para lançar"</li>
  <li><strong>Promessa rápida:</strong> "Em 90 segundos vou te mostrar o sistema que mudou meu negócio"</li>
</ul>

<h3>Copy por Temperatura de Público</h3>
<table>
<tr><th>Público</th><th>Copy focus</th><th>Duração</th></tr>
<tr><td>Frio (não te conhece)</td><td>Dor/problema + prova social rápida</td><td>Curto — máximo impacto em 3 seg</td></tr>
<tr><td>Morno (engajou mas não comprou)</td><td>Objeções + prova social + urgência</td><td>Médio — já conhece o problema</td></tr>
<tr><td>Quente (visitou PV/checkout)</td><td>Urgência + benefício específico + garantia</td><td>Curto — já conhece a oferta</td></tr>
</table>`
          },
          {
            id: "copy-redes-sociais",
            title: "Copy para Redes Sociais: Legendas, Bio e Carrossel que Convertem",
            duration: "25 min",
            type: "text",
            keyPoints: ["A legenda de Instagram que vende sem parecer vender", "Bio: os 150 caracteres que convertem visitantes em seguidores", "Estrutura de carrossel que mantém swipe até o último slide", "Copy de Stories: sequência de engajamento e CTA", "O post de \"só para quem\" que hipersegmenta a audiência"],
            content: `<h2>Copy Orgânico: Vendendo sem o Filtro de "É Anúncio"</h2>
<p>Conteúdo orgânico tem um poder que anúncio não tem: ausência de ceticismo inicial. O usuário no feed orgânico não está em modo defensivo — está em modo de consumo. Copy orgânico que tenta "anunciar" perde esse privilégio imediatamente. O segredo é vender enquanto parece educar.</p>

<h3>A Legenda que Educavende (Educa + Vende Simultaneamente)</h3>
<p>Estrutura de legenda de alto engajamento e conversão:</p>
<pre>
Linha 1-2: Hook (parar o scroll — declaração ousada ou pergunta)
Linha 3-5: O problema/situação que a audiência reconhece
Linha 6-10: O insight/ensinamento real (valor genuíno)
Linha 11-14: Aplicação prática (como usar)
Linha 15-17: Soft CTA (não "compre" — "salve isso", "me responde", "se você quer X, comenta abaixo")
</pre>

<h3>Bio de Instagram que Converte</h3>
<p>150 caracteres. Você tem 4 linhas. Use assim:</p>
<pre>
Linha 1: Quem você ajuda + resultado
Linha 2: Como/método (credencial ou diferenciador)
Linha 3: Prova social em número
Linha 4: CTA para o link na bio
</pre>
<p>Exemplo ruim: "Coach | Mentora | Apaixonada por café ☕ | DM aberto"</p>
<p>Exemplo bom: "Ajudo produtores digitais a lançar R$100k+ em 7 dias | Método da PLF Brasileira | 2.400 alunos | ↓ Acesse o método gratuito"</p>

<h3>Estrutura de Carrossel que Completa</h3>
<pre>
Slide 1: Hook (a promessa que força o swipe)
Slide 2: O problema (identificação)
Slide 3-6: O conteúdo real (cada slide = 1 insight)
Slide 7: A síntese (o mais importante dos slides)
Slide 8: Prova social (resultado de quem aplicou)
Slide 9: CTA (salvar + comentar + seguir)
</pre>
<p>Regra: cada slide deve ter motivo para avançar. Se o slide não cria curiosidade pelo próximo, você perdeu a atenção ali.</p>

<h3>Copy de "Só Para Quem"</h3>
<p>O post mais poderoso para qualificar audiência é a hipersegmentação por identidade:</p>
<blockquote>
"Este post é só para quem:
→ Tem um produto digital ou está criando um
→ Já tentou lançar e não chegou a R$30k
→ Tem audiência mas ela não compra
Se isso é você, leia com atenção o que vou compartilhar..."
</blockquote>
<p>Quem não está nesse público vai embora. Quem está lê tudo. Você perde alcance e ganha conversão.</p>`
          },
          {
            id: "copy-email-whatsapp",
            title: "Copy de Email e WhatsApp: A Voz que Chega no Mais Íntimo do Contato",
            duration: "22 min",
            type: "text",
            keyPoints: ["Subject line: os 50 caracteres que determinam se o email é aberto", "Copy de email: tom de conversa, não de panfleto", "A estrutura P.S. que funciona melhor que o corpo do email", "Copy de WhatsApp: pessoal sem ser invasivo", "Segmentação de copy: como mensagem diferente para hot/warm/cold"],
            content: `<h2>Email e WhatsApp: Onde a Voz Importa Mais do que a Formatação</h2>
<p>Email e WhatsApp têm uma característica única: chegam em espaços íntimos (inbox pessoal, celular). O usuário espera uma comunicação pessoal — não um banner de loja. Copy que ignora isso soa como spam, mesmo que tecnicamente não seja.</p>

<h3>Subject Lines: A Taxa de Abertura é Determinada Aqui</h3>
<p>Benchmark do mercado PT-BR: 25-35% de abertura é bom, acima de 40% é excelente, abaixo de 15% é problema de entregabilidade ou relevância.</p>
<p><strong>Fórmulas de subject line de alta abertura:</strong></p>
<ul>
  <li><strong>Curiosidade simples:</strong> "isso me surpreendeu ontem"</li>
  <li><strong>Urgência específica:</strong> "só hoje: bônus [X] sai à meia-noite"</li>
  <li><strong>Personalização:</strong> "[NOME], você viu o resultado do [aluno]?"</li>
  <li><strong>Pergunta de dor:</strong> "ainda não está funcionando?"</li>
  <li><strong>Contradição:</strong> "por que você não deveria comprar [produto]"</li>
  <li><strong>Número específico:</strong> "R$34.800 em 72 horas — aqui está como"</li>
</ul>
<p>Evite: CAPS LOCK excessivo, "!" em excesso, palavras de spam ("grátis", "urgente", "oferta"), subject lines acima de 50 caracteres (cortadas em mobile).</p>

<h3>A Estrutura do Email que Lêem até o Final</h3>
<pre>
Linha 1: Abertura pessoal (nome ou referência ao dia/momento)
Parágrafos 1-2: História ou contexto que conecta com a dor
Parágrafo 3: O insight ou a revelação
Parágrafo 4: Como isso se aplica ao leitor
CTA: Claro e único (um único link, não vários)
P.S.: A segunda parte mais lida de qualquer email
</pre>
<p>O P.S. (post-scriptum) é lido por 79% dos leitores (dado histórico de copy direto). Use para o argumento mais forte, não para algo secundário:</p>
<p><em>"P.S. — Se você só ler uma coisa nesse email, que seja esta: o carrinho fecha às 23h59 de sexta. Depois disso, não tem como entrar no preço de hoje. [LINK]"</em></p>

<h3>Copy de WhatsApp: Tom de Amigo, Substância de Vendedor</h3>
<p>WhatsApp é o canal mais íntimo. Copy que soa como broadcast corporativo é deletado. Copy que soa como mensagem pessoal é lido.</p>
<p>Regras:</p>
<ul>
  <li>Sempre comece com o nome (personalização mínima)</li>
  <li>Parágrafos curtos — máximo 3 linhas por bloco</li>
  <li>Uma mensagem = uma ideia</li>
  <li>CTA na penúltima linha, não na última (a última cria espaço para resposta)</li>
  <li>Sempre abra possibilidade de resposta: "me fala o que achou"</li>
</ul>`
          }
        ],
        locked: false
      },

      // ── CAPÍTULO 30: STORYTELLING COMO ARMA DE VENDA ──
      {
        id: "storytelling-vendas",
        number: 30,
        title: "Storytelling como Arma de Venda",
        subtitle: "Por que histórias vendem mais do que argumentos — e como estruturar a sua",
        icon: "📖",
        color: "from-amber-800 to-orange-900",
        duration: "1h 40min",
        summary: "Números convençem mentes lógicas. Histórias convencem a mente emocional — que é quem de fato toma a decisão de compra. Toda VSL, todo email de abertura, toda live de lançamento que converte tem uma estrutura narrativa. Aqui você aprende essa estrutura.",
        lessons: [
          {
            id: "jornada-heroi-marketing",
            title: "A Jornada do Herói no Marketing: A Estrutura que Todo Copy de Conversão Usa",
            duration: "28 min",
            type: "text",
            keyPoints: ["Por que histórias ativam espelhos neurais (neurociência do storytelling)", "A Jornada do Herói de Joseph Campbell adaptada para VSL e copy", "Como posicionar o CLIENTE como herói (não você)", "O mentor como papel: você facilita, não resolve", "Estrutura da história de 8 atos para lançamentos"],
            content: `<h2>Por que o Cérebro Compra Histórias, Não Produtos</h2>
<p>Paul Zak (neurocientista, Claremont Graduate University) documentou em 2014: quando pessoas ouvem histórias com estrutura narrativa, o cérebro libera oxitocina — o hormônio da confiança e conexão. Quando ouvem listas de benefícios e dados, essa resposta não ocorre.</p>
<p>Conclusão: histórias criam confiança neurologicamente. Argumentos lógicos não.</p>

<h3>A Estrutura de Jornada do Herói no Copy de Lançamento</h3>
<p>Joseph Campbell identificou em "O Herói de Mil Faces" (1949) que toda grande história segue a mesma estrutura. George Lucas a usou conscientemente em Star Wars. Todo marketer de elite a usa inconscientemente — ou conscientemente, quando aprende o padrão.</p>

<p><strong>Adaptação para o copy de produto digital:</strong></p>
<ol>
  <li><strong>O Mundo Ordinário:</strong> A vida do herói (seu cliente) antes — o status quo que ele aceita mas não gosta. <em>"Você trabalha 60 horas por semana, ganha bem, mas sente que o teto chegou..."</em></li>
  <li><strong>O Chamado à Aventura:</strong> O momento que muda tudo — quando o herói descobre que é possível mais. <em>"Então você descobriu que [pessoa similar] fez R$200k em 30 dias — e essa história não saiu da sua cabeça..."</em></li>
  <li><strong>A Recusa do Chamado:</strong> O herói hesita. Como seus clientes hesitam. <em>"Você pensou 'isso não é pra mim', 'meu nicho é diferente', 'não tenho audiência'..."</em></li>
  <li><strong>O Mentor:</strong> Alguém (você) aparece com o método. <em>"Foi quando eu encontrei [método/pessoa] que entendi o que estava faltando..."</em></li>
  <li><strong>A Travessia do Portal:</strong> O herói toma a decisão de mudar. <em>"Decidi que ia tentar de verdade — e apliquei o método exatamente como aprendi..."</em></li>
  <li><strong>Testes, Aliados, Inimigos:</strong> Os obstáculos reais. <em>"Não foi perfeito. O primeiro lançamento deu R$12k — longe da meta. Mas o segundo..."</em></li>
  <li><strong>A Provação:</strong> O momento mais difícil antes da virada. <em>"Estava prestes a desistir quando..."</em></li>
  <li><strong>A Recompensa:</strong> O resultado — que é o resultado que seu cliente quer alcançar. <em>"R$287.000 em 7 dias. Mais do que eu ganhava em 2 anos."</em></li>
</ol>

<h3>O Erro Fatal: Você Não é o Herói — Seu Cliente É</h3>
<p>O erro mais comum em copy de lançamento: o criador se posiciona como herói ("olha o que eu fiz, olha meu resultado"). O cliente não se identifica com o herói — se identifica com quem ele era antes de se tornar herói.</p>
<p>Posicione-se como Gandalf, não como Frodo. Como Yoda, não como Luke. Você é o mentor que equipa o herói para a jornada — e o herói é seu cliente.</p>`
          },
          {
            id: "historia-origem-fundadora",
            title: "A História de Origem: Como Contar Sua Jornada de Forma que Vende",
            duration: "25 min",
            type: "text",
            keyPoints: ["Por que sua história pessoal é seu ativo mais valioso", "Os 4 elementos que tornam uma história de origem irresistível", "Como ser vulnerável sem perder autoridade", "A história de \"antes e depois\" que conecta com diferentes avatares", "Template: escreva sua história de origem em 500 palavras"],
            content: `<h2>Sua História É a Prova Mais Poderosa de Que o Método Funciona</h2>
<p>Nenhum depoimento de aluno é mais persuasivo do que a história autêntica do criador — porque ela responde à objeção mais fundamental: "se isso funciona, por que você precisou aprender?"</p>

<h3>Os 4 Elementos da História de Origem que Vende</h3>
<p><strong>1. O Vale (o fundo do poço):</strong> Onde você estava antes. Quanto mais específico e reconhecível pelo seu avatar, melhor. Não "estava passando por dificuldades" — "estava com R$400 na conta, contas em atraso e com vergonha de encontrar conhecidos".</p>
<p><strong>2. O Catalisador (o momento de virada):</strong> O evento específico que forçou a mudança. Uma demissão, uma conta que venceu, uma conversa que abriu os olhos. Dê data, local, detalhes sensoriais.</p>
<p><strong>3. A Descoberta (o método):</strong> Como você encontrou a solução. Não foi fácil — enfatize o custo (tempo, dinheiro, tentativas) antes de chegar no método que funcionou.</p>
<p><strong>4. A Transformação (o resultado):</strong> O depois com números específicos e mudança de identidade. Não só "faturei mais" — "pela primeira vez em 5 anos, tirei férias sem trabalhar".</p>

<h3>Template: Sua História de Origem em 500 Palavras</h3>
<pre>
PARÁGRAFO 1 (O Vale): "Em [data/período], eu estava [situação específica com detalhes]."
PARÁGRAFO 2 (A Dor): "A sensação era [emoção honesta]. Eu tentei [o que você tentou antes] mas [por que não funcionou]."
PARÁGRAFO 3 (O Catalisador): "Foi quando [evento específico] que eu percebi que precisava mudar."
PARÁGRAFO 4 (A Descoberta): "Comecei a [a jornada de descoberta]. Falhei em [tentativas anteriores]. Então encontrei [o insight/método]."
PARÁGRAFO 5 (A Aplicação): "Implementei [o que você fez]. Os primeiros resultados foram [resultado inicial honesto]."
PARÁGRAFO 6 (A Transformação): "Hoje, [o resultado completo com números]. Mas mais do que isso: [a mudança de identidade/estilo de vida]."
PARÁGRAFO 7 (A Conexão): "Se você está onde eu estava em [data], eu sei exatamente como você se sente. E eu sei que [o que é possível] — porque eu passei pelo mesmo caminho."
</pre>

<blockquote>Vulnerabilidade calculada é a forma mais poderosa de autoridade. Mostrar que você passou pelo fracasso — e sobreviveu — é mais persuasivo do que qualquer credencial acadêmica.</blockquote>`
          }
        ],
        locked: false
      },

      // ── CAPÍTULO 31: PROVA SOCIAL — CASOS INTERNACIONAIS DOCUMENTADOS ──
      {
        id: "prova-social-internacional",
        number: 31,
        title: "Prova Social Internacional: Casos Reais Documentados e Como Replicar",
        subtitle: "Os estudos de caso que provam — com dados — que copy e persuasão são ciência",
        icon: "🌎",
        color: "from-teal-800 to-cyan-900",
        duration: "2h",
        summary: "Estes não são casos inventados ou generalizações. São campanhas documentadas com dados reais, publicados em livros, artigos acadêmicos, relatórios públicos e declarações das próprias empresas. Estudar o que funcionou — e por quê — é a forma mais eficiente de aprender copy.",
        lessons: [
          {
            id: "casos-ogilvy-halbert",
            title: "David Ogilvy e Gary Halbert: Os Fundadores do Copy Moderno",
            duration: "30 min",
            type: "text",
            keyPoints: ["O anúncio de Rolls-Royce de Ogilvy (1958) e por que funcionou", "O Princípio da Especificidade: dados são mais persuasivos do que adjetivos", "A Carta do Colar de Gary Halbert: o copy direto mais estudado da história", "A-pile vs. B-pile: a estratégia de personalização que nenhum digital faz", "Como aplicar esses princípios em anúncios digitais de 2025"],
            content: `<h2>Os Homens que Transformaram Copy em Ciência</h2>

<h3>David Ogilvy e o Anúncio de Rolls-Royce (1958)</h3>
<p>Em 1958, David Ogilvy escreveu o anúncio mais estudado da história da publicidade para a Rolls-Royce. O headline: <em>"At 60 miles an hour the loudest noise in the new Rolls-Royce comes from the electric clock."</em></p>
<p>Resultado: A Rolls-Royce relatou aumento de 50% nas vendas nos EUA no ano seguinte ao anúncio.</p>
<p><strong>Por que funcionou:</strong></p>
<ul>
  <li><strong>Especificidade extrema:</strong> "60 miles an hour" e "electric clock" — não "silencioso" ou "luxuoso". O específico cria credibilidade que o genérico não cria.</li>
  <li><strong>Prova por implicação:</strong> Se o barulho mais alto é o relógio elétrico, a engenharia deve ser extraordinária. A conclusão é tirada pelo leitor — não empurrada por ele.</li>
  <li><strong>Zero hipérbole:</strong> Ogilvy disse sobre esse anúncio: "Quando não tenho nada a dizer, não digo nada. Quando tenho algo a dizer, digo com fatos."</li>
</ul>
<p><strong>Aplicação digital:</strong> Troque adjetivos por dados. Em vez de "produto de alta qualidade", use "97,3% dos alunos completam o módulo 1 na primeira semana". Específico bate genérico em todas as métricas de conversão.</p>

<h3>Gary Halbert e a Carta de Colar (1971)</h3>
<p>Gary Halbert, considerado por muitos o maior copywriter de mala direta da história, criou em 1971 a "Coat of Arms Letter" — uma carta enviada a famílias americanas com o brasão do sobrenome delas personalizado no envelope.</p>
<p><strong>Resultado documentado:</strong> Taxa de resposta de 2-3% em mala direta massiva (benchmark da época era 0,5-1%). Gerou mais de $1M em vendas no primeiro ano.</p>
<p><strong>O Princípio A-pile vs. B-pile de Halbert:</strong></p>
<blockquote>
"Quando você abre seu correio, você faz dois montes. O A-pile tem cartas que você vai ler com certeza — de pessoas que você conhece, contas, coisas que parecem pessoais. O B-pile é lixo corporativo que vai direto para o lixo. A missão do copywriter é fazer o marketing entrar no A-pile."
</blockquote>
<p>No digital: email que parece pessoal (texto simples, sem banner, assunto conversacional) vai para o "A-pile" mental. Email que parece newsletter corporativa vai para spam — mental ou literal.</p>

<h3>Claude Hopkins e a Cerveja Schlitz (1919)</h3>
<p>Em "Scientific Advertising" (1923, domínio público), Hopkins descreveu como transformou a Schlitz de 8ª para 1ª cerveja nos EUA. O método: visitar a fábrica, descobrir como a cerveja era feita, e contar essa história no anúncio.</p>
<p>A Schlitz usava vapor para esterilizar as garrafas — mas todas as marcas faziam isso. Ninguém tinha contado essa história ainda. Hopkins contou. Resultado: a percepção de "pureza" foi associada exclusivamente à Schlitz.</p>
<p><strong>Lição aplicada:</strong> O que é óbvio para você sobre o seu produto pode ser fascinante para o seu cliente. Conte o que está por trás — o processo, a decisão, o detalhe técnico. "Óbvio" para o criador é frequentemente "surpreendente" para o comprador.</p>`
          },
          {
            id: "casos-digitais-documentados",
            title: "Dollar Shave Club, Dropbox e ConvertKit: Copy Digital que Mudou Mercados",
            duration: "30 min",
            type: "text",
            keyPoints: ["Dollar Shave Club 2012: o vídeo de $4.500 que gerou $100M/ano em receita", "Dropbox referral: copy de convite que gerou 3.900% de crescimento em 15 meses", "ConvertKit: a proposta de valor que triplicou receita em 12 meses", "O que esses casos têm em comum que você pode replicar", "Como analisar campanhas internacionais para extrair princípios aplicáveis"],
            content: `<h2>Três Campanhas Documentadas que Transformaram Indústrias</h2>

<h3>Dollar Shave Club: O Vídeo de $4.500 que Vendeu Uma Empresa por $1 Bilhão</h3>
<p>Em março de 2012, o Dollar Shave Club lançou um vídeo de 93 segundos produzido por $4.500. Michael Dubin, o CEO, escreveu o roteiro e protagonizou o vídeo.</p>
<p><strong>Resultados documentados (relatório público da empresa):</strong></p>
<ul>
  <li>12.000 pedidos nas primeiras 48 horas após o lançamento</li>
  <li>O site travou por horas com o volume</li>
  <li>4,75 milhões de visualizações na primeira semana</li>
  <li>Receita anual cresceu para $100M em 3 anos</li>
  <li>Vendida para Unilever em 2016 por $1 bilhão</li>
</ul>
<p><strong>Por que o roteiro funcionou:</strong></p>
<ul>
  <li>Headline direto: "Our Blades Are F***ing Great" — sem eufemismo, sem corporativismo</li>
  <li>Atacou o "vilão" explicitamente: "Do you think your razor needs a vibrating handle, a flashlight, a backscratcher, and 10 blades? Your handsome-ass grandfather had one blade... and polio."</li>
  <li>Proposta única de valor em uma frase: "$1 a month. No commitment. Blades shipped to your door."</li>
  <li>Humor que humanizou uma categoria completamente sem carisma</li>
</ul>
<p><strong>Lição replicável:</strong> Identifique o "absurdo" da indústria que seu cliente está aceitando sem questionar. Nomeie-o explicitamente. Posicione seu produto como a alternativa racional.</p>

<h3>Dropbox Referral: O Copy de Convite que Gerou 3.900% de Crescimento</h3>
<p>Em 2008, o Dropbox tinha 100.000 usuários. Em 15 meses, chegou a 4 milhões. Drew Houston (CEO) documentou publicamente em apresentações (incluindo no Y Combinator) como o crescimento aconteceu.</p>
<p><strong>O mecanismo:</strong> Um sistema de indicação onde o remetente recebia 500MB de espaço extra e o indicado também. Mas o que impulsionou foi o copy da mensagem de convite:</p>
<blockquote>
"[NOME] quer compartilhar arquivos com você usando Dropbox. O Dropbox deixa você trazer seus arquivos a qualquer lugar e compartilhá-los facilmente. Você ganhará espaço extra de graça ao se registrar com este convite."
</blockquote>
<p>Simples. Pessoal. Benefício imediato claro. Sem jargão técnico.</p>
<p><strong>Resultado:</strong> 35% dos usuários novos vieram de referral durante o período de crescimento de 3.900% (documentado pelo próprio Drew Houston em apresentação de 2010).</p>
<p><strong>Lição replicável:</strong> Copy de indicação funciona quando o benefício para o remetente e para o indicado é claro, imediato e específico. Vague is broke. Specific converts.</p>

<h3>ConvertKit: A Proposta de Valor que Triplicou Receita</h3>
<p>Em 2014, Nathan Barry (fundador do ConvertKit) documentou publicamente em seu blog a estratégia que passou de $1.500/mês para $5.000/mês em MRR em 6 meses.</p>
<p>A proposta de valor original (que não funcionava): "Email marketing para bloggers"</p>
<p>A proposta reformulada (que triplicou a receita): <em>"Email marketing para criadores de conteúdo profissionais. Tudo o que você precisa de uma ferramenta de email — e nada do que você não precisa."</em></p>
<p>Adicionou um elemento de serviço de migração: "Se você tem menos de 5.000 assinantes, eu pessoalmente faço a migração para o ConvertKit de graça." Nathan Barry fez isso manualmente por meses.</p>
<p><strong>Resultado:</strong> O copy pessoal e a oferta de serviço humano geraram tração viral no nicho de blogueiros. O MRR chegou a $100k em 2015 e o ConvertKit ultrapassou $30M ARR em 2021 (dado público do próprio Nathan Barry).</p>
<p><strong>Lição replicável:</strong> Uma oferta pessoal, com custo alto de tempo para o criador, mas que resolve especificamente o maior atrito da migração, pode ser o catalisador de crescimento. "Eu farei isso por você pessoalmente" é o copy mais poderoso que existe.</p>`
          },
          {
            id: "casos-brasileiros-documentados",
            title: "Casos Brasileiros Documentados: PLF, Hotmart e Lançamentos de Referência",
            duration: "28 min",
            type: "text",
            keyPoints: ["Jeff Walker e a PLF: o caso que criou o mercado de lançamentos", "Como o copy de lançamento brasileiro evoluiu da PLF americana", "Os princípios documentados dos maiores lançamentos PT-BR", "O que funciona diferente no mercado brasileiro vs. americano", "Como adaptar qualquer framework internacional para o contexto PT-BR"],
            content: `<h2>A Genealogia do Copy de Lançamento Brasileiro</h2>

<h3>Jeff Walker e a Product Launch Formula (1996-2005)</h3>
<p>Jeff Walker documentou em detalhes no livro "Launch" (2014) como criou e testou a PLF ao longo de 9 anos. O ponto de partida: em 1996, ele enviou uma newsletter de investimentos para 19 pessoas. Em 2005, lançou um produto por $1M usando a mesma estrutura de sequência de pré-lançamento — agora chamada PLF.</p>
<p><strong>O insight central documentado por Walker:</strong></p>
<blockquote>
"A revelação foi que eu poderia vender antes de ter o produto pronto — e as pessoas que compravam antecipadamente me diziam exatamente o que queriam aprender. Eu criava o produto baseado no que o mercado já havia demonstrado que compraria."
</blockquote>
<p>Este é o fundamento do Lançamento Semente — testado e documentado por Walker antes de ter nome.</p>

<h3>As Diferenças Críticas: Mercado Americano vs. PT-BR</h3>
<table>
<tr><th>Aspecto</th><th>Mercado Americano</th><th>Mercado PT-BR</th></tr>
<tr><td>Canal primário</td><td>Email dominante</td><td>WhatsApp + Instagram + Email</td></tr>
<tr><td>Desconfiança</td><td>Moderada</td><td>Alta (histórico de pirâmides e promessas vazias)</td></tr>
<tr><td>Storytelling</td><td>Mais racional/estrutural</td><td>Mais emocional/relacional</td></tr>
<tr><td>Urgência</td><td>Timer funciona bem</td><td>Timer sozinho não basta — precisa de WhatsApp e relação</td></tr>
<tr><td>Garantia</td><td>30 dias padrão</td><td>30-60 dias funciona melhor pela desconfiança maior</td></tr>
<tr><td>Prova social</td><td>Nomes reconhecidos</td><td>Pessoas "como eu" superam celebridades</td></tr>
</table>

<h3>Princípios que Transcendem Mercados</h3>
<p>Independente do país, esses princípios se confirmaram em todos os mercados documentados:</p>
<ol>
  <li><strong>Específico supera genérico</strong> sempre em taxas de conversão</li>
  <li><strong>Relacionamento supera oferta</strong> — a lista que te conhece compra mais do que a lista fria com desconto maior</li>
  <li><strong>Consistência de mensagem</strong> entre canais (o que você diz no email precisa ser o que você diz no WhatsApp e no anúncio)</li>
  <li><strong>Reciprocidade antes de pedido</strong> — sempre entregue antes de pedir</li>
  <li><strong>Fechamento não é opcional</strong> — quem não fecha, não vende. A maioria dos produtores perde 30-40% da receita por não fazer follow-up de fechamento</li>
</ol>`
          },
          {
            id: "como-coletar-prova-social",
            title: "Como Coletar, Formatar e Usar Prova Social que Converte",
            duration: "25 min",
            type: "text",
            keyPoints: ["O sistema de coleta de depoimentos que gera prova social automaticamente", "Formatos de depoimento por canal (vídeo, texto, print)", "Como pedir sem parecer desesperado: o template que funciona", "Usando dados agregados como prova social quando não tem depoimentos", "Ética na prova social: o que pode e o que não pode"],
            content: `<h2>O Sistema de Coleta de Prova Social</h2>
<p>Produtores que têm prova social não é porque têm mais alunos — é porque têm um sistema para coletá-la. Sem sistema, mesmo com 1.000 alunos satisfeitos, você não terá depoimentos quando precisar.</p>

<h3>O Sistema Automático de Coleta de Depoimentos</h3>
<p>Configure na sequência de onboarding:</p>
<pre>
D+3: Email "Quick win — me conta o seu resultado"
D+14: Email "Resultado de 2 semanas — posso compartilhar?"
D+30: Email formal de pedido de depoimento com formulário
D+90: Pedido de depoimento em vídeo para os melhores resultados
</pre>

<h3>O Formulário de Depoimento que Gera Copy Pronto</h3>
<p>Nunca peça "escreva um depoimento". Peça respostas para perguntas específicas:</p>
<ol>
  <li>Qual era sua situação/desafio ANTES de [produto]? (seja específico)</li>
  <li>Qual foi o resultado ou mudança mais significativa DEPOIS? (com números se possível)</li>
  <li>Qual foi o momento em que você percebeu que valeu a pena?</li>
  <li>O que você diria para alguém que está em dúvida sobre [produto]?</li>
  <li>Posso usar seu nome, cidade e foto? (sempre peça permissão explícita)</li>
</ol>

<h3>Quando Não Tem Depoimentos: Dados Agregados como Prova Social</h3>
<p>Se você está começando e não tem depoimentos ainda:</p>
<ul>
  <li><strong>Número de downloads:</strong> "Mais de 2.400 downloads do guia gratuito em 30 dias"</li>
  <li><strong>Resultados da pesquisa de mercado:</strong> "87% dos respondentes relataram [problema que você resolve]"</li>
  <li><strong>Validação de pares/especialistas:</strong> "Revisado por [nome com credencial]"</li>
  <li><strong>Resultado próprio documentado:</strong> Você é a prova mais honesta de que o método funciona</li>
</ul>

<h3>Ética na Prova Social: Linhas que Não Cruzar</h3>
<ul>
  <li>✗ Nunca invente ou exagere resultados</li>
  <li>✗ Nunca use resultados excepcionais sem deixar claro que são excepcionais</li>
  <li>✗ Nunca use nome de pessoa sem permissão explícita por escrito</li>
  <li>✓ Sempre adicione: "Resultados variam. Estes são resultados de alunos dedicados e não são típicos."</li>
  <li>✓ Use resultados reais — eles sempre são mais persuasivos do que os inventados, porque têm detalhes e imperfeições que criam credibilidade</li>
</ul>

<blockquote>A prova social mais poderosa é a que você não controlou. Um aluno que você não pediu que falasse e que publicou por conta própria — esse é o depoimento que converte mais. Crie os resultados, não os depoimentos. Os depoimentos aparecem naturalmente quando os resultados são reais.</blockquote>`
          }
        ],
        locked: false
      }
    ]
  },

  // ══════════════════════════════════════════════════════════════════
  // MÓDULO 10 — PRODUTO DIGITAL: AUDIÊNCIA, CRIAÇÃO E ENTREGA
  // ══════════════════════════════════════════════════════════════════
  {
    id: "produto-digital",
    number: 10,
    title: "Produto Digital: Audiência, Criação e Entrega",
    description: "O produto certo para o público certo muda tudo. Este módulo cobre o processo completo: como entender profundamente sua audiência, transformar esse entendimento em um produto que o mercado já quer comprar, validar antes de criar, escolher a plataforma correta e entregar uma experiência que retém e gera indicações.",
    badge: "Produto",
    chapters: [

      // ── CAPÍTULO 32: ENTENDENDO SUA AUDIÊNCIA ──
      {
        id: "entendendo-audiencia",
        number: 32,
        title: "Entendendo Sua Audiência: Do Seguidor ao Cliente",
        subtitle: "A pesquisa de mercado que revela o que seu público realmente quer comprar",
        icon: "🎯",
        color: "from-blue-800 to-cyan-900",
        duration: "2h",
        summary: "A diferença entre um produto que vende R$10k e um que vende R$1M não está no produto — está em como profundamente o criador entende o que o cliente realmente quer. Não o que diz querer, não o que pensa que quer, mas o que o comportamento revela que ele comprará.",
        lessons: [
          {
            id: "jobs-to-be-done",
            title: "Jobs to Be Done: O Framework que Explica Por que as Pessoas Realmente Compram",
            duration: "28 min",
            type: "text",
            keyPoints: ["Por que o avatar tradicional não é suficiente", "Jobs to Be Done (JTBD): o trabalho que o produto faz para o cliente", "Dimensões funcionais, emocionais e sociais de uma compra", "Como usar JTBD para criar copy que ressoa profundamente", "Entrevistas de JTBD: as 5 perguntas que revelam tudo"],
            content: `<h2>O Problema com o Avatar de Marketing Tradicional</h2>
<p>O avatar tradicional diz: "Maria, 34 anos, casada, 2 filhos, renda R$5k/mês, gosta de receitas saudáveis e yoga." Isso é útil para targeting de anúncio. Não é útil para entender por que ela compraria seu produto.</p>
<p>Clayton Christensen (Harvard Business School) desenvolveu o framework Jobs to Be Done: as pessoas não compram produtos — elas "contratam" produtos para fazer um trabalho (job) específico em suas vidas.</p>

<h3>O Experimento da Milkshake (JTBD na prática)</h3>
<p>Christensen documentou em "Competing Against Luck" (2016): uma rede de fast food queria aumentar vendas de milkshake. Pesquisa tradicional mostrou que clientes queriam sabores mais intensos e preços menores. Implementaram — vendas não mudaram.</p>
<p>A equipe de JTBD observou quem comprava milkshake e quando. Descoberta: 40% das vendas eram de manhã cedo, para clientes sozinhos, em viagem de carro para o trabalho. Eles "contratavam" o milkshake para: matar a fome, ter algo para fazer durante a viagem e ter energia para chegar no escritório.</p>
<p>O milkshake estava competindo com banana e bagel — não com outros milkshakes. E perdia para ambos em alguns jobs, mas ganhava em outros (não suja as mãos, dura a viagem inteira, não cai).</p>

<h3>Os 3 Jobs de Toda Compra</h3>
<p><strong>Job Funcional:</strong> O que o produto literalmente faz. "Me ajuda a criar anúncios que convertem."</p>
<p><strong>Job Emocional:</strong> Como faz a pessoa se sentir. "Me sinto confiante e no controle do meu negócio."</p>
<p><strong>Job Social:</strong> Como muda como os outros a veem. "Minha família vê que eu sei o que faço. Meus amigos me pedem conselho."</p>
<p>A maioria do copy foca no job funcional. Os melhores copywriters focam no job emocional e social — porque é onde a decisão real de compra é tomada.</p>

<h3>As 5 Perguntas de Entrevista JTBD</h3>
<p>Entreviste 5-10 clientes reais com essas perguntas:</p>
<ol>
  <li>"Me conta sobre o momento em que você decidiu comprar [produto/buscar solução]. O que estava acontecendo na sua vida naquela época?"</li>
  <li>"O que você tinha tentado antes? Por que não funcionou?"</li>
  <li>"Quando você comprou, o que você esperava que mudasse na sua vida?"</li>
  <li>"O que te fez hesitar antes de comprar?"</li>
  <li>"O que mudou depois que você começou a usar?"</li>
</ol>
<p>Grave com permissão. Transcreva. As frases literais dos clientes — não o que você interpreta — são o copy mais poderoso que existe.</p>`
          },
          {
            id: "pesquisa-mercado-pratica",
            title: "Pesquisa de Mercado Prática: 5 Métodos para Descobrir o que Sua Audiência Comprará",
            duration: "25 min",
            type: "text",
            keyPoints: ["Mining de comentários: encontrando dores onde ninguém procura", "Pesquisa de lançamento: o formulário de intenção de compra", "Análise de concorrentes: o que o mercado já está comprando", "Grupos e comunidades: a mineração de dor em tempo real", "A pesquisa de produto: as 7 perguntas que revelam tudo"],
            content: `<h2>5 Métodos de Pesquisa que Custam R$0 e Revelam Tudo</h2>

<h3>Método 1: Mining de Comentários (Amazon, YouTube, Grupos)</h3>
<p>Os comentários de produtos relacionados no seu nicho são um tesouro de linguagem do cliente e dores reais.</p>
<p>Amazon: procure livros no seu nicho com muitas avaliações. Leia as avaliações de 3 estrelas — elas mostram o que o mercado queria e não recebeu. Essa é exatamente a oportunidade do seu produto.</p>
<p>YouTube: nos vídeos de concorrentes, leia os comentários mais curtidos. As perguntas mais curtidas revelam as maiores dúvidas não respondidas do público.</p>
<p>Grupos do Facebook no nicho: pesquise palavras de dor ("não consigo", "alguém sabe como", "preciso de ajuda com"). Catalogue as perguntas mais recorrentes — elas são os módulos do seu produto.</p>

<h3>Método 2: A Pesquisa de Intenção de Compra</h3>
<p>Antes de criar qualquer produto, envie para sua lista:</p>
<blockquote>
"Estou pensando em criar [produto sobre X]. Antes de começar, quero entender se faz sentido para você. Você pagaria por um produto que [promessa central]?
☐ Sim — pagaria até R$[faixa 1]
☐ Sim — pagaria até R$[faixa 2]
☐ Talvez, dependendo do que inclui
☐ Não, porque: [campo aberto]"
</blockquote>
<p>Taxa de "sim" acima de 15% da lista: produto viável. Abaixo: ajuste a proposta ou o público antes de criar.</p>

<h3>Método 3: Análise de Concorrentes com Dados</h3>
<ul>
  <li><strong>Hotmart/Kiwify:</strong> Pesquise produtos no seu nicho pelo volume de vendas (indicado pelo número de avaliações). Leia as avaliações negativas — são as melhorias que o mercado já pagou para ter mas não recebeu.</li>
  <li><strong>Google Trends:</strong> Veja a curva de interesse do seu tema nos últimos 5 anos. Subindo = mercado em crescimento. Estável = mercado maduro. Caindo = cuidado.</li>
  <li><strong>SEMrush/Ubersuggest (grátis):</strong> Volume de busca das palavras do seu nicho. 1.000+ buscas/mês: existe demanda. Abaixo de 100: nicho muito pequeno ou muito novo.</li>
</ul>

<h3>Método 4: Comunidades e Grupos como Radar de Dor</h3>
<p>Configure alerta no Google Alerts para palavras-chave do seu nicho. Monitore semanalmente:</p>
<ul>
  <li>Grupos no Facebook (entre nos maiores do seu nicho)</li>
  <li>Reddit em inglês (subreddits do seu tema têm discussões detalhadas)</li>
  <li>Quora: perguntas mais seguidas no seu tema</li>
  <li>Comentários dos posts de concorrentes no Instagram</li>
</ul>`
          },
          {
            id: "avatar-real-versus-imaginado",
            title: "Avatar Real vs. Avatar Imaginado: Como Validar Quem É Seu Cliente de Verdade",
            duration: "20 min",
            type: "text",
            keyPoints: ["A diferença entre quem você acha que é seu cliente e quem realmente é", "Analisando os dados reais: seus compradores são quem você pensa?", "Segmentação real: os 3 tipos de cliente que todo negócio tem", "Expandindo e contraindo o avatar com dados", "O erro de criar produto para o cliente que você quer ter, não o que você tem"],
            content: `<h2>O Avatar que Você Imagina vs. Quem Realmente Compra</h2>
<p>Um produtor de um grande curso de marketing digital imaginava que seu cliente principal era o empreendedor jovem de 22-28 anos, digital nativo, que queria escalar um negócio online. Ao analisar os dados reais de compradores: 60% eram entre 35-50 anos, profissionais empregados que queriam transição de carreira ou renda extra. A linguagem, os exemplos, o horário de disparo de emails — tudo mudou. O faturamento dobrou em 6 meses.</p>

<h3>Como Analisar Quem São Seus Compradores Reais</h3>
<ol>
  <li>Hotmart/Kiwify → Relatórios → dados demográficos dos compradores</li>
  <li>Email marketing → segmentação por comportamento (quem abriu, quem clicou, quem comprou)</li>
  <li>Meta Ads Manager → Audience Insights para custom audience de compradores</li>
  <li>Formulário pós-compra: "Conte-nos sobre você" com 3 perguntas abertas</li>
</ol>

<h3>Os 3 Tipos de Cliente de Todo Negócio</h3>
<p><strong>Cliente Ideal (20%):</strong> Compra tudo, implementa tudo, dá resultados, faz indicações, vira embaixador. Seus esforços de retenção e upsell devem focar 80% aqui.</p>
<p><strong>Cliente Médio (60%):</strong> Compra o produto principal, implementa parcialmente, pode comprar novamente com nutrição. É a maioria — e a maioria do copy é para converter esse perfil.</p>
<p><strong>Cliente Problemático (20%):</strong> Pede reembolso, não implementa, reclamam sem agir. Aprenda a identificar sinais antes da venda e ajuste o copy para atrair menos deste perfil — mais seletividade de audiência resulta em maior LTV médio.</p>`
          },
          {
            id: "audiencia-para-cliente",
            title: "Da Audiência ao Cliente: O Funil de Confiança que Transforma Seguidores em Compradores",
            duration: "22 min",
            type: "text",
            glossaryTerms: ["ltv", "cac", "lead-magnet", "nurturing", "opt-in"],
            keyPoints: ["Por que a maioria da audiência nunca compra — e como mudar isso", "Os 5 estágios de consciência do cliente (Eugene Schwartz)", "O funil de confiança: da descoberta à fidelidade", "Métricas de cada estágio: o que acompanhar", "O erro de tentar vender para quem está no estágio errado"],
            content: `<h2>Por que Sua Audiência de 50.000 Seguidores Gera R$2.000 de Venda</h2>
<p>Audiência não é igual a cliente em potencial. Cada seguidor está em um estágio diferente de consciência sobre o problema que você resolve — e tentar vender para quem ainda não está consciente do problema é o erro mais comum e mais custoso do marketing digital.</p>

<h3>Os 5 Estágios de Consciência de Eugene Schwartz</h3>
<p>Eugene Schwartz mapeou em "Breakthrough Advertising" (1966, considerado o livro de copy mais valioso já escrito) os estágios pelos quais todo comprador passa:</p>
<ol>
  <li><strong>Inconsciente:</strong> Não sabe que tem o problema. Conteúdo necessário: educação sobre o sintoma, não a solução.</li>
  <li><strong>Consciente do Problema:</strong> Sabe que tem o problema, não sabe que existe solução. Conteúdo: "isso tem solução".</li>
  <li><strong>Consciente da Solução:</strong> Sabe que existe solução, não conhece seu produto. Conteúdo: seu método é a melhor solução.</li>
  <li><strong>Consciente do Produto:</strong> Conhece seu produto, ainda não decidiu. Conteúdo: prova social, detalhe da oferta, garantia.</li>
  <li><strong>Mais Consciente:</strong> Está pronto para comprar, precisa apenas do CTA e da oferta correta. Conteúdo: urgência, condições, CTA direto.</li>
</ol>

<h3>O Funil de Confiança: Da Descoberta à Fidelidade</h3>
<pre>
DESCOBERTA: Conteúdo orgânico/anúncio de tráfego
    ↓ (10-20% avançam)
INTERESSE: Lead magnet / conteúdo de valor aprofundado
    ↓ (30-50% avançam)
CONSIDERAÇÃO: Sequência de nutrição (7-14 dias)
    ↓ (10-20% avançam)
INTENÇÃO: Evento de conversão (webinar, pré-lançamento, carrinho)
    ↓ (2-5% convertem)
COMPRA: Produto principal
    ↓ (50-70% ficam ativos)
FIDELIDADE: Upsell, membership, comunidade
</pre>

<h3>Métricas de Cada Estágio para Acompanhar</h3>
<table>
<tr><th>Estágio</th><th>Métrica principal</th><th>Benchmark saudável</th></tr>
<tr><td>Descoberta</td><td>Alcance / impressões</td><td>Crescimento de 10%/mês</td></tr>
<tr><td>Interesse</td><td>Taxa de opt-in do lead magnet</td><td>20-40%</td></tr>
<tr><td>Consideração</td><td>Taxa de abertura de email</td><td>25-35%</td></tr>
<tr><td>Intenção</td><td>Presença no webinar ou evento</td><td>30-50% dos inscritos</td></tr>
<tr><td>Compra</td><td>Taxa de conversão de evento</td><td>2-8%</td></tr>
<tr><td>Fidelidade</td><td>Taxa de conclusão e NPS</td><td>NPS &gt; 50</td></tr>
</table>`
          }
        ],
        locked: false
      },

      // ── CAPÍTULO 33: CRIANDO PRODUTOS DIGITAIS ──
      {
        id: "criacao-produtos-digitais",
        number: 33,
        title: "Criando Produtos Digitais: Do Zero ao Produto que o Mercado Quer",
        subtitle: "Tipos, estruturas, produção e o processo de criação que elimina a paralisia",
        icon: "🛠️",
        color: "from-emerald-800 to-green-900",
        duration: "2h 10min",
        summary: "Existe uma ordem errada de criar produtos digitais: criar primeiro, vender depois. E uma certa: vender primeiro, criar depois. Este capítulo cobre os tipos de produto, como estruturar cada um, como produzir com qualidade e o processo de validação antes de investir meses em criação.",
        lessons: [
          {
            id: "tipos-produtos-digitais",
            title: "Os 8 Tipos de Produto Digital e Quando Usar Cada Um",
            duration: "25 min",
            type: "text",
            keyPoints: ["Ebook e guia PDF: o produto de entrada mais versátil", "Mini-curso (3-7 aulas): a isca que converte audiência em compradores", "Curso online completo: o produto principal de 6 a 8 dígitos", "Mentoria e consultoria: o produto de maior ticket e menor escala", "Membership e recorrência: a receita previsível", "Templates e ferramentas: o produto que resolve um problema específico", "Evento ao vivo (online ou presencial): a conversão mais alta", "Comunidade paga: o modelo que cresce com os membros"],
            content: `<h2>O Mapa de Produtos Digitais: Do Menor ao Maior Ticket</h2>
<p>A maioria dos produtores começa com o produto errado — geralmente um curso completo que leva 6 meses para criar e não sabe se vai vender. A ordem inteligente é outra: comece pelo produto mais simples, valide a demanda, e suba a escada de valor.</p>

<h3>A Escada de Produtos Digitais</h3>
<table>
<tr><th>Produto</th><th>Ticket</th><th>Tempo de criação</th><th>Escala</th></tr>
<tr><td>Lead magnet (gratuito)</td><td>R$0</td><td>1-3 dias</td><td>Ilimitado</td></tr>
<tr><td>Ebook / PDF</td><td>R$27-97</td><td>3-10 dias</td><td>Ilimitado</td></tr>
<tr><td>Mini-curso (3-7 aulas)</td><td>R$97-297</td><td>1-2 semanas</td><td>Ilimitado</td></tr>
<tr><td>Curso completo</td><td>R$297-2.997</td><td>1-3 meses</td><td>Ilimitado</td></tr>
<tr><td>Membership mensal</td><td>R$47-297/mês</td><td>Setup 2 semanas + cont.</td><td>Ilimitado</td></tr>
<tr><td>Mentoria em grupo</td><td>R$997-5.997</td><td>Setup 1 semana</td><td>20-50 pessoas</td></tr>
<tr><td>Mentoria individual</td><td>R$3.000-30.000</td><td>Zero criação</td><td>5-15 pessoas</td></tr>
<tr><td>Evento ao vivo</td><td>R$297-9.997</td><td>2-3 meses de prep</td><td>50-1.000 pessoas</td></tr>
</table>

<h3>O Mini-Curso: O Produto mais Estratégico para Começar</h3>
<p>O mini-curso (3-7 aulas, 1-3 horas de conteúdo, R$97-297) é o produto mais estratégico para quem está começando porque:</p>
<ul>
  <li>Cria em 1-2 semanas — sem meses de produção</li>
  <li>Valida a demanda com baixo risco (se não vende a R$147, o curso completo a R$1.497 também não venderia)</li>
  <li>Gera depoimentos para o produto principal</li>
  <li>Serve como Order Bump ou Upsell do produto maior no futuro</li>
</ul>

<h3>Membership: O Modelo que Cria Receita Previsível</h3>
<p>Um membership de R$97/mês com 200 membros = R$19.400/mês garantidos — antes de qualquer lançamento. Mas membership exige comprometimento de conteúdo contínuo (pelo menos 4 novas entregas/mês) e comunidade ativa.</p>
<p>Funciona para: nichos com demanda de atualização constante (marketing, finanças, fitness, idiomas) e criadores que gostam de interação com a comunidade.</p>
<p>Não funciona para: nichos em que o problema é resolvido uma vez (ex: "como fazer o ENEM") ou criadores que preferem criar uma vez e não precisar de manutenção contínua.</p>`
          },
          {
            id: "estrutura-curso-online",
            title: "Estrutura de Curso Online: Do Briefing às Aulas Gravadas",
            duration: "28 min",
            type: "text",
            keyPoints: ["O briefing de curso: o trabalho de 2 horas que economiza 2 meses", "Estrutura de módulo e aula: a hierarquia que mantém o aluno progredindo", "Script ou improviso: qual gera mais retenção", "Produção de qualidade: o que importa e o que não importa", "Edição: o mínimo necessário vs. o diferencial de qualidade"],
            content: `<h2>Criando um Curso que os Alunos Terminam</h2>
<p>A taxa de conclusão média de cursos online no mundo é de 3-8% (dado do MIT OpenCourseWare e Coursera). No mercado de infoprodutos, um curso com 20-30% de conclusão é considerado excelente. A estrutura do curso é o principal determinante da conclusão — não a qualidade do conteúdo.</p>

<h3>O Briefing de Curso: Faça Antes de Gravar Uma Aula</h3>
<p>Responda estas perguntas por escrito antes de criar qualquer conteúdo:</p>
<ol>
  <li><strong>Qual a transformação central?</strong> "Ao final, o aluno será capaz de [resultado específico e mensurável]"</li>
  <li><strong>Qual o pré-requisito mínimo?</strong> "O aluno precisa saber X e ter Y antes de começar"</li>
  <li><strong>Qual o quick win?</strong> "O aluno consegue implementar [resultado pequeno] no módulo 1, em menos de [tempo]"</li>
  <li><strong>Qual a ordem lógica?</strong> Liste os módulos na ordem que cria a progressão de habilidade — não na ordem que faz sentido para você como especialista</li>
  <li><strong>Quais são as objeções em cada módulo?</strong> "No módulo 3, o aluno vai pensar [objeção] — como você antecipa isso?"</li>
</ol>

<h3>Estrutura de Módulo Que Funciona</h3>
<pre>
Módulo X: [Resultado específico que o aluno alcança neste módulo]
├── Aula 1: Conceito central (máx. 15 min)
├── Aula 2: Como fazer (máx. 20 min)
├── Aula 3: Exemplo prático / caso real (máx. 15 min)
├── Recurso: Template/planilha/checklist
└── Exercício: O que implementar antes do próximo módulo
</pre>
<p>Regra dos 15 minutos: aulas acima de 15 minutos têm queda de retenção acima de 40%. Se o conteúdo precisa de 30 minutos, divida em duas aulas de 15 — com títulos que criam curiosidade para a segunda.</p>

<h3>O que Realmente Importa na Produção</h3>
<table>
<tr><th>Elemento</th><th>Importância real</th><th>Impacto no aluno</th></tr>
<tr><td>Áudio limpo (sem eco, sem ruído)</td><td>🔴 Crítico</td><td>Alunos param por áudio ruim, não por vídeo ruim</td></tr>
<tr><td>Iluminação adequada</td><td>🟡 Importante</td><td>Afeta percepção de profissionalismo</td></tr>
<tr><td>Resolução de vídeo</td><td>🟢 Menor</td><td>720p é suficiente, 1080p é ótimo</td></tr>
<tr><td>Background</td><td>🟢 Menor</td><td>Limpo e consistente — não precisa ser estúdio</td></tr>
<tr><td>Edição elaborada</td><td>🟢 Menor</td><td>Cortes básicos são suficientes</td></tr>
</table>

<p>Equipamento mínimo para começar: microfone de lapela (R$80-150), luz de anel básica (R$120-200), Canva para slides. Total: menos de R$400 para produção profissional.</p>`
          },
          {
            id: "validacao-antes-criar",
            title: "Validar Antes de Criar: O Método que Elimina o Risco de Criar Produto que Não Vende",
            duration: "25 min",
            type: "text",
            keyPoints: ["O Lançamento Semente: vender antes de criar", "Mínimo Produto Viável (MVP) para infoprodutos", "O pré-venda: como funciona, riscos e como comunicar com transparência", "Testando a proposta de valor com R$0 de investimento", "O que fazer quando a validação falha (e o que isso te diz)"],
            content: `<h2>A Regra de Ouro: Nunca Crie um Produto Antes de Vender</h2>
<p>Esta é a lição mais contra-intuitiva — e mais valiosa — do mercado de infoprodutos. Produtores que criam produtos por meses antes de validar a demanda são a maioria. Produtores que faturam consistentemente validam antes de criar — sempre.</p>

<h3>O Lançamento Semente: Validação Máxima com Risco Zero</h3>
<p>Jeff Walker documentou o lançamento semente em "Launch" (2014) como o método que ele chama de "o poder do pré-venda". A versão brasileira foi popularizada por Érico Rocha e outros como "Lançamento Semente".</p>
<p><strong>Como funciona:</strong></p>
<ol>
  <li>Defina a proposta de valor do produto (não crie ainda)</li>
  <li>Abra uma conversa pública: "Estou pensando em criar X. Se você compraria, me conta por que"</li>
  <li>Receba as respostas e refine a proposta com base nelas</li>
  <li>Abra pré-venda para lista pequena com preço de fundador (30-50% abaixo do preço final)</li>
  <li>Se 10-20 pessoas comprarem: produto validado. Agora crie.</li>
  <li>Se menos de 5 comprarem: a proposta precisa de ajuste. Você economizou meses de trabalho.</li>
</ol>
<p>A chave: seja transparente. "Estou criando este produto e você terá acesso antes de qualquer um, por um preço de fundador, porque seu feedback vai moldar o conteúdo." Compradores de semente geralmente são os clientes mais engajados — eles querem ver o produto existir.</p>

<h3>O MVP de Infoproduto: Conteúdo Mínimo que Entrega a Promessa</h3>
<p>MVP (Minimum Viable Product) em infoproduto não é um produto ruim — é o produto mínimo que entrega a transformação prometida. Se a promessa é "ensinar a criar anúncios no Meta em 7 dias", o MVP pode ser:</p>
<ul>
  <li>7 aulas de 15 minutos (não 40 aulas de 20 minutos)</li>
  <li>1 template de campanha (não uma biblioteca completa)</li>
  <li>1 sessão de Q&A ao vivo por mês (substitui o suporte elaborado)</li>
</ul>
<p>Você cria em 2 semanas. Vende. Recebe feedback. Melhora nas versões seguintes com o dinheiro das vendas — em vez de investir 3 meses sem receita.</p>

<h3>O Teste de Proposta com R$0</h3>
<p>Antes de qualquer investimento:</p>
<ol>
  <li>Crie um post no Instagram descrevendo o produto (sem preço, sem link)</li>
  <li>Na legenda: "Se você quereria aprender isso, comenta QUERO"</li>
  <li>Conte os comentários: &lt;20 = proposta fraca ou audiência errada; 20-100 = validado para mini-lançamento; &gt;100 = produto de alta demanda</li>
</ol>`
          },
          {
            id: "precificacao-produto-digital",
            title: "Precificação: Como Definir o Preço que Vende Mais (Não o Mais Barato)",
            duration: "22 min",
            type: "text",
            keyPoints: ["Por que preço mais barato frequentemente vende menos", "Precificação por valor vs. precificação por custo", "O efeito âncora: como o preço mais caro faz o do meio parecer razoável", "Precificação por resultados: cobrando com base no ROI que o aluno terá", "Quando e como fazer desconto sem destruir a percepção de valor"],
            content: `<h2>A Psicologia do Preço que a Maioria dos Produtores Ignora</h2>
<p>Um experimento clássico de psicologia do consumidor (Dan Ariely, "Predictably Irrational", 2008): a revista The Economist ofereceu 3 planos:</p>
<ul>
  <li>Digital: $59/ano → 68% escolhiam</li>
  <li>Impresso: $125/ano → 0% escolhiam</li>
  <li>Digital + Impresso: $125/ano → 32% escolhiam</li>
</ul>
<p>Quando retiraram a opção do meio (impresso só), apenas 16% escolheram o plano mais caro. A opção "isca" (que ninguém comprava) existia apenas para fazer o mais caro parecer razoável por comparação. Isso é o efeito âncora.</p>

<h3>3 Cenários de Precificação com Análise</h3>
<p><strong>Cenário A (Preço baixo):</strong><br/>
Curso a R$197 → 100 vendas → R$19.700<br/>
Percepção do mercado: "barato demais para ser sério"<br/>
Qualidade do aluno: comprador oportunista, menor taxa de implementação, mais reembolsos</p>
<p><strong>Cenário B (Preço médio):</strong><br/>
Curso a R$997 → 30 vendas → R$29.910<br/>
Percepção: produto legítimo com valor real<br/>
Qualidade do aluno: comprometido, implementa, gera depoimentos</p>
<p><strong>Cenário C (Preço alto):</strong><br/>
Curso a R$1.997 → 15 vendas → R$29.955<br/>
Percepção: premium, autoridade, exclusividade<br/>
Qualidade do aluno: o mais comprometido, maior LTV, maiores indicações</p>
<p>Resultado financeiro B e C são similares. Mas o resultado em depoimentos, reembolsos e qualidade da comunidade favorece massivamente o preço mais alto.</p>

<h3>Como Precificar por Valor (Não por Custo)</h3>
<p>A fórmula: calcule o valor econômico que o aluno recebe ao implementar o produto.</p>
<p>Exemplo: curso de copy que ensina a escrever sua própria página de vendas. Um copywriter cobra R$3.000-8.000 por página. O aluno que aprende nunca mais paga por isso. Valor econômico: mínimo R$3.000 por uso. Preço do curso: R$997 = 1/3 do valor de uma aplicação. É fácil justificar.</p>

<h3>Estrutura de Preços com Âncora</h3>
<pre>
Plano Básico: R$497 (acesso ao curso + comunidade)
Plano Completo: R$997 (curso + comunidade + templates + 1 sessão de grupo/mês)
Plano VIP: R$2.997 (tudo + 3 sessões individuais + revisão de copy)
</pre>
<p>A maioria comprará o Plano Completo — que é o produto que você realmente quer vender. O Plano Básico faz o Completo parecer razoável. O VIP faz o Completo parecer econômico.</p>`
          }
        ],
        locked: false
      },

      // ── CAPÍTULO 34: ESCOLHA DE PLATAFORMA E ENTREGA ──
      {
        id: "escolha-plataforma-entrega",
        number: 34,
        title: "Escolha de Plataforma, Teste e Entrega do Produto",
        subtitle: "Como escolher onde vender, como testar antes de lançar e como entregar uma experiência que retém",
        icon: "🚀",
        color: "from-violet-800 to-purple-900",
        duration: "1h 50min",
        summary: "A plataforma certa não é a mais famosa — é a que melhor serve o modelo de negócio e o produto específico. Este capítulo cobre os critérios de escolha, como testar toda a jornada antes de lançar, e como entregar a experiência que transforma compradores em fãs que indicam.",
        lessons: [
          {
            id: "criterios-escolha-plataforma",
            title: "Como Escolher a Plataforma Certa para Seu Produto",
            duration: "25 min",
            type: "text",
            keyPoints: ["Os 7 critérios de escolha de plataforma de venda", "Hotmart vs. Kiwify vs. Eduzz vs. Asaas vs. plataforma própria", "Quando migrar de plataforma (e o custo real da migração)", "Área de membros: nativa vs. externa — prós e contras", "A decisão de plataforma que você não deve tomar sozinho — e quem consultar"],
            content: `<h2>Não Existe Plataforma Perfeita — Existe a Certa para Cada Caso</h2>
<p>A escolha de plataforma é uma decisão de longo prazo — migrar leva tempo, pode perder avaliações e afeta afiliados. Faça certo na primeira vez.</p>

<h3>Os 7 Critérios de Escolha</h3>
<ol>
  <li><strong>Tipo de produto:</strong> Curso com área de membros complexa → Hotmart. Checkout simples e conversão alta → Kiwify. Produto de serviço ou recorrência B2B → Asaas. Produto simples sem plataforma de membros → qualquer um com webhook para plataforma externa.</li>
  <li><strong>Volume mensal de vendas:</strong> Abaixo de R$10k/mês: taxas de plataforma não são críticas. Acima de R$50k/mês: diferença de 2% de taxa = R$1.000/mês. Vale otimizar.</li>
  <li><strong>Necessidade de afiliados:</strong> Quer programa de afiliados ativo? Hotmart tem o maior ecossistema PT-BR. Kiwify está crescendo. Asaas e plataformas próprias não têm.</li>
  <li><strong>Integrações necessárias:</strong> Liste as integrações que seu negócio precisa (CRM, email, WhatsApp) e verifique se a plataforma tem nativo ou webhook. Hotmart e Kiwify têm Zapier. Asaas tem API completa.</li>
  <li><strong>Controle da relação com o cliente:</strong> Em marketplaces (Hotmart), o cliente é "deles" — você tem acesso limitado aos dados. Com Asaas + plataforma própria, o cliente é 100% seu.</li>
  <li><strong>Suporte e uptime:</strong> Verifique o histórico de estabilidade. Uma hora fora do ar no dia de fechamento de carrinho pode custar R$50k em vendas.</li>
  <li><strong>Custo total de operação:</strong> Calcule: taxa por venda + mensalidade da plataforma de membros + custo de integrações + horas de suporte técnico. O mais barato na taxa pode ser o mais caro no total.</li>
</ol>

<h3>Matriz de Decisão Rápida</h3>
<table>
<tr><th>Situação</th><th>Plataforma recomendada</th></tr>
<tr><td>Primeiro produto, menos de R$5k/mês</td><td>Kiwify (taxa menor, setup simples)</td></tr>
<tr><td>Produto com área de membros complexa</td><td>Hotmart (nativo e maduro)</td></tr>
<tr><td>Volume &gt;R$100k/mês, quer controle total</td><td>Asaas + Memberkit/Ead Plataforma</td></tr>
<tr><td>Venda de serviços profissionais + cursos</td><td>Asaas (consolida em um gateway)</td></tr>
<tr><td>Afiliados como canal principal</td><td>Hotmart (maior rede)</td></tr>
<tr><td>Produto físico + digital</td><td>Shopify + Asaas ou WooCommerce</td></tr>
</table>`
          },
          {
            id: "teste-completo-produto",
            title: "Testando Tudo Antes de Lançar: O Checklist de 42 Pontos",
            duration: "22 min",
            type: "text",
            keyPoints: ["Por que 90% dos problemas de lançamento poderiam ser evitados com teste", "O checklist completo de produto, checkout, automação e entrega", "Teste de experiência: percorra a jornada como seu cliente faria", "Grupos de beta-teste: como usar para encontrar o que você não veria", "O protocolo de teste de 72 horas antes do carrinho abrir"],
            content: `<h2>O Erro que Custa R$50k: Lançar Sem Testar</h2>
<p>Em todo lançamento existem problemas técnicos. Nos lançamentos de produtores profissionais, esses problemas são descobertos na fase de teste. Nos lançamentos de amadores, são descobertos quando o carrinho está aberto e clientes reais estão tentando comprar.</p>

<h3>O Checklist Completo de 42 Pontos</h3>
<p><strong>Produto (10 pontos):</strong></p>
<ul>
  <li>[ ] Todas as aulas/módulos estão acessíveis e em ordem</li>
  <li>[ ] Vídeos carregam em conexões lentas (teste com 3G simulado)</li>
  <li>[ ] Áudio de todas as aulas está claro (sem eco, sem ruído)</li>
  <li>[ ] Materiais complementares (PDFs, planilhas) acessíveis para download</li>
  <li>[ ] Módulo 1 entrega quick win em menos de 30 minutos</li>
  <li>[ ] Exercícios estão claros e implementáveis</li>
  <li>[ ] Navegação entre aulas funciona (anterior/próximo)</li>
  <li>[ ] Versão mobile da área de membros funcional</li>
  <li>[ ] Certificado de conclusão (se prometido) gerado corretamente</li>
  <li>[ ] Área de comunidade acessível e moderada</li>
</ul>
<p><strong>Checkout (8 pontos):</strong></p>
<ul>
  <li>[ ] Compra de teste realizada (com cupom 100%)</li>
  <li>[ ] Pixel disparou corretamente (verificar Pixel Helper)</li>
  <li>[ ] Order Bump aparece e funciona</li>
  <li>[ ] Upsell aparece após compra e funciona</li>
  <li>[ ] Página de obrigado aparece com próximos passos</li>
  <li>[ ] PIX, boleto e cartão testados individualmente</li>
  <li>[ ] Parcelamento no cartão funciona no máximo de parcelas configurado</li>
  <li>[ ] Domínio do checkout é seu (não hotmart.com/pay) para mais conversão</li>
</ul>
<p><strong>Automações (12 pontos):</strong></p>
<ul>
  <li>[ ] Email de boas-vindas chega em menos de 5 minutos</li>
  <li>[ ] WhatsApp de boas-vindas chega em menos de 5 minutos</li>
  <li>[ ] Tag de comprador aplicada no CRM</li>
  <li>[ ] Sequência de onboarding iniciada automaticamente</li>
  <li>[ ] Acesso na área de membros liberado automaticamente</li>
  <li>[ ] Teste de reembolso: acesso revogado, sequência de recuperação iniciada</li>
  <li>[ ] Webhook funcionando (verificar logs do Zapier)</li>
  <li>[ ] Pixel de Purchase disparando com valor correto</li>
  <li>[ ] Remarketing de compradores excluído dos anúncios</li>
  <li>[ ] Relatório interno de venda criado (planilha ou CRM)</li>
  <li>[ ] Alerta de nova venda no Slack/email interno funcionando</li>
  <li>[ ] Teste de boleto expirado: sequência de recuperação ativa</li>
</ul>
<p><strong>Suporte (6 pontos):</strong></p>
<ul>
  <li>[ ] Canal de suporte definido e comunicado (email, WhatsApp, Telegram)</li>
  <li>[ ] Tempo de resposta de suporte definido e comunicado</li>
  <li>[ ] FAQ documentado com as 10 perguntas mais comuns</li>
  <li>[ ] Responsável por suporte durante o lançamento definido</li>
  <li>[ ] Protocolo de reembolso documentado</li>
  <li>[ ] Acesso de emergência à área de membros para suporte</li>
</ul>
<p><strong>Comunicação (6 pontos):</strong></p>
<ul>
  <li>[ ] Sequência completa de emails escrita e agendada</li>
  <li>[ ] Templates de WhatsApp escritos e aprovados</li>
  <li>[ ] Conteúdo orgânico pré-produzido para toda a semana de carrinho</li>
  <li>[ ] Anúncios criados e aprovados pela Meta</li>
  <li>[ ] Copy de fechamento revisado (último dia)</li>
  <li>[ ] Plano B para se algo der errado (outra plataforma, email manual)</li>
</ul>`
          },
          {
            id: "entrega-experiencia-cliente",
            title: "Entrega e Experiência do Cliente: O que Acontece Depois da Venda Decide Tudo",
            duration: "25 min",
            type: "text",
            keyPoints: ["Os primeiros 7 dias definem a retenção de longo prazo", "O onboarding que transforma comprador em fã", "Comunidade como produto: o diferencial que nenhuma IA substitui", "Medindo satisfação: NPS, entrevistas e sinais de churn", "Expandindo o produto com feedback: a versão 2.0 que o mercado pediu"],
            content: `<h2>A Venda é o Início — Não o Fim</h2>
<p>Todo o trabalho de marketing serve para trazer a pessoa para a porta. O que acontece depois da porta determina se ela fica, se indica e se compra novamente.</p>

<h3>Os Primeiros 7 Dias: A Janela que Define o LTV</h3>
<p>Dados de plataformas de cursos online (Teachable, relatório 2022) mostram: alunos que completam o módulo 1 nos primeiros 3 dias têm 4x mais probabilidade de completar o curso. Alunos que não acessam nos primeiros 7 dias têm 70% de probabilidade de nunca acessar.</p>
<p>Ação: crie "missão impossível de resistir" no módulo 1. Uma aula que entrega resultado em 20 minutos. Um template que o aluno usa imediatamente. Um quick win que prova que comprou certo.</p>

<h3>Comunidade como Produto</h3>
<p>A comunidade — seja no WhatsApp, Telegram, Skool ou Discord — frequentemente é o motivo real pelo qual os alunos ficam, mais do que o conteúdo. Ninguém cancela uma membership onde tem amigos e conexões reais.</p>
<p>Para construir comunidade ativa:</p>
<ul>
  <li>Apresentação obrigatória de novos membros (o admin apresenta, não o membro)</li>
  <li>Desafio semanal com premiação simbólica</li>
  <li>Celebração pública de resultados dos membros</li>
  <li>Pergunta semanal provocativa que gera discussão</li>
  <li>O criador presente — mesmo que 30 minutos/semana</li>
</ul>

<h3>NPS: A Métrica que Prediz Crescimento</h3>
<p>Net Promoter Score: "Em uma escala de 0-10, quanto você recomendaria este produto para um amigo?"</p>
<ul>
  <li>9-10: Promotores (indicam ativamente)</li>
  <li>7-8: Passivos (satisfeitos mas não indicam)</li>
  <li>0-6: Detratores (podem falar mal)</li>
</ul>
<p>NPS = % Promotores - % Detratores. Acima de 50: excelente. Acima de 70: classe mundial. Abaixo de 0: o produto tem problemas sérios.</p>
<p>Envie a pesquisa de NPS em D+30 (quando o aluno já usou o produto o suficiente para opinar). Para cada Detrator, entre em contato pessoalmente — a resposta que você recebe deles é o feedback mais valioso que existe.</p>`
          }
        ],
        locked: false
      }
    ]
  }
];

export const PRODUCTS = [
  {
    id: "free-guide",
    name: "Os 7 Erros do Primeiro Lançamento",
    price: 0,
    type: "free" as const,
    description: "Guia gratuito com os erros mais comuns de quem estreia no digital — e o que fazer diferente desde o início. PDF de acesso imediato.",
    features: [
      "12 páginas direto ao ponto",
      "Os 7 erros com exemplos reais",
      "Checklist de autodiagnóstico",
      "Acesso imediato ao PDF"
    ],
    badge: "Gratuito"
  },
  {
    id: "mini-guide",
    name: "Mini-Guia: Primeiros R$10k Online",
    price: 10,
    type: "starter" as const,
    description: "O caminho mais rápido para sua primeira renda digital. 47 páginas direto ao ponto.",
    features: [
      "47 páginas de conteúdo denso",
      "Checklist de lançamento em 7 dias",
      "Planilha de projeção de receita",
      "3 estudos de caso reais"
    ],
    badge: "Apostila"
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
    badge: "Acesso Completo"
  }
];
