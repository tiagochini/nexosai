import fs from 'fs';

const path = 'artifacts/landing/src/pages/landing.tsx';
let content = fs.readFileSync(path, 'utf8');

const newPhases = `const glp22Phases = [
  {
    phase: "Fase 01 / Estratégia e Fundações",
    title: "Onde o achismo termina e a inteligência de mercado começa.",
    items: [
      { id: "01", title: "Imersão e intake", desc: "Coleta profunda da sua visão, objetivos e restrições para balizar a operação sem recorrer a premissas genéricas." },
      { id: "02", title: "Inteligência e análise de mercado", desc: "Mapeamento ativo da concorrência e do ambiente competitivo para encontrar brechas de atenção, demandas ocultas e padrões de mercado." },
      { id: "03", title: "Avatar, segmentação e jornada", desc: "Definição clara do cliente ideal e desenho do caminho exato que ele percorre do primeiro contato até o momento da decisão." },
      { id: "04", title: "Posicionamento, mecanismo e narrativa", desc: "Construção de uma tese única e argumentação central que diferenciem sua mensagem da comoditização do nicho." },
      { id: "05", title: "Engenharia da oferta", desc: "Estruturação de preço, ancoragem, quebra de objeções, garantias e bônus para criar uma proposta comercial robusta." },
      { id: "06", title: "Arquitetura estratégica do lançamento", desc: "Desenho do formato e do modelo de vendas mais adequados, estipulando cronograma, eventos e pontos de contato da campanha." },
      { id: "07", title: "Master Plan", desc: "Consolidação de todas as diretrizes em um documento mestre, alinhando a execução autônoma em torno do mesmo objetivo." }
    ]
  },
  {
    phase: "Fase 02 / Criação e Ativos Visuais",
    title: "Da arquitetura conceitual para interfaces e roteiros focados em conversão.",
    items: [
      { id: "08", title: "Construção do funil", desc: "Desenho prático da estrutura de aquisição e qualificação, conectando os passos da jornada de compra de forma fluida." },
      { id: "09", title: "Copy", desc: "Redação persuasiva de cartas de vendas, anúncios e scripts visuais, orquestrada para respeitar o tom de voz definido no Master Plan." },
      { id: "10", title: "Direção criativa e produção visual", desc: "Desenvolvimento da identidade visual da campanha e desdobramento em peças gráficas e banners padronizados para todos os canais." },
      { id: "11", title: "Direção e produção de vídeos", desc: "Roteirização e renderização dinâmica de VSLs, anúncios e conteúdos audiovisuais voltados a reter a atenção nos segundos cruciais." },
      { id: "12", title: "Páginas e ativos digitais", desc: "Implementação de landing pages desenhadas para conversão e performance de carregamento, prontas para receber tráfego." }
    ]
  },
  {
    phase: "Fase 03 / Infraestrutura e Engajamento",
    title: "Sistemas técnicos, gestão de audiência e comunicação orgânica.",
    items: [
      { id: "13", title: "Infraestrutura, tracking e integrações", desc: "Configuração técnica de pixels, tags e fluxos de dados, além de apoio em domínios e hospedagem (serviços faturados diretamente pelos fornecedores escolhidos)." },
      { id: "14", title: "CRM, gestão de leads, grupos e comunidades", desc: "Estruturação das bases de contatos e organização de ambientes de aquecimento para centralizar a comunicação com os interessados." },
      { id: "15", title: "Presença Digital e audiência", desc: "Programação e controle de postagens para manter consistência nos perfis sociais, aproveitando os algoritmos de descoberta." },
      { id: "16", title: "E-mail, mensagens e nutrição", desc: "Desenvolvimento de sequências de comunicação ativa e fluxos automatizados para elevar o nível de consciência dos leads." }
    ]
  },
  {
    phase: "Fase 04 / Aquisição e Vendas",
    title: "Geração de tráfego, orquestração e recuperação de receita.",
    items: [
      { id: "17", title: "Mídia paga", desc: "Planejamento e gestão de campanhas publicitárias com distribuição de verba em criativos e públicos que apresentam o melhor custo por aquisição." },
      { id: "18", title: "Execução coordenada do lançamento", desc: "Sincronização de todos os canais, e-mails, grupos e anúncios nos dias-chave da campanha para um fluxo de aberturas de carrinho alinhado." },
      { id: "19", title: "Atendimento, vendas e conversão", desc: "Atuação voltada para recuperação de boletos/Pix, carrinhos abandonados e quebra de objeções de última hora, maximizando a receita aprovada." }
    ]
  },
  {
    phase: "Fase 05 / Dados e Continuidade",
    title: "Leitura de métricas, aprendizado institucional e próximos passos.",
    items: [
      { id: "20", title: "Monitoramento e otimização", desc: "Acompanhamento e leitura contínua de métricas reais para possibilitar ajustes finos e proteção de orçamento ao longo da campanha." },
      { id: "21", title: "Pós-lançamento e aprendizado", desc: "Consolidação de dados de performance em inteligência institucional, registrando o que converteu melhor e mapeando novas objeções." },
      { id: "22", title: "Continuidade, relançamento e perpétuo", desc: "Transformação da inteligência acumulada em novas esteiras de vendas e adaptação do produto para campanhas sucessivas ou recorrência." }
    ]
  }
];`;

content = content.replace(/const glp22Phases = \[[\s\S]*?\];\n/, newPhases + '\n');
fs.writeFileSync(path, content);
