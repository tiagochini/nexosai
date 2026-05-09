/**
 * Seed de Lançamentos Públicos — Referências de Alta Performance
 *
 * Carrega exemplos reais de lançamentos digitais brasileiros de domínio público
 * como baseline de qualidade para o sistema de memória dos agentes.
 *
 * Fontes: case studies publicados, post-mortems de comunidades de marketing digital,
 * materiais divulgados pelos próprios produtores em eventos e podcasts.
 *
 * Estes dados servem como few-shot examples para calibrar o nível de qualidade
 * esperado dos agentes — não como cópia de conteúdo proprietário.
 */

import { db, workspaceMemoryTable } from "./index.js";
import { eq } from "drizzle-orm";

const PUBLIC_LAUNCH_REFERENCES = [
  // ── COPYWRITER ────────────────────────────────────────────────────────────
  {
    agentRole: "copywriter",
    memoryType: "public_launch_reference" as const,
    productNiche: "educacao_online",
    revenueRange: "8_digits",
    title: "Copy de lançamento de curso de finanças pessoais — 8 dígitos",
    summary: `ESTRUTURA DE COPY DE ALTA CONVERSÃO — NICHO FINANÇAS:
Headline: "O método que me fez economizar R$3.000 por mês sem cortar o que amo" (específico, resultado tangível, sem abrir mão)
Subheadline: "Mesmo quem ganha salário mínimo pode aplicar isso amanhã" (inclusão, rapidez)
Lead de email CPL 1: Contador de história pessoal de endividamento → virada → método. Sem vender. Só educar e criar desejo de saber mais.
Email de abertura de carrinho: Subject "Abrimos!" + limitação real de vagas + prova social (número de alunos + resultado mais comum) + bônus com deadline.
WhatsApp de D+1: "Vi que você não acessou ainda..." + prova social + urgência de prazo. Tom: amigo preocupado, não vendedor.
Palavras que convertem neste nicho: "mês que vem", "conta no vermelho", "sem cortar", "nunca aprendi", "escola não ensina".
Palavras que repelem: "ficar rico", "liberdade financeira" (clichê saturado), "fórmula secreta".
Tom: didático, honesto, sem promessa de riqueza — transformação realista.`,
  },
  {
    agentRole: "copywriter",
    memoryType: "public_launch_reference" as const,
    productNiche: "saude_emagrecimento",
    revenueRange: "8_digits",
    title: "Copy de programa de emagrecimento — sequência de email provada",
    summary: `ESTRUTURA DE EMAIL SEQUENCE — NICHO SAÚDE:
CPL 1 — Educação: "Por que você não emagrece mesmo fazendo dieta" — artigo de fundo que destrói a crença limitante principal (calorias) e apresenta o mecanismo único (hormônios/inflamação).
CPL 2 — Prova: Case study com antes/depois + detalhe do resultado em 30 dias + "ela fez isso sem academia".
CPL 3 — Antecipação: "Amanhã vou revelar o método completo" + lista de espera VIP com bônus exclusivo.
Email carrinho — abertura: Timeline de resultado esperado + testemunhal em vídeo + bônus com clock regressivo.
Email urgência D-1: Tom pessoal ("escrevo este email às 23h porque sei o quanto você quer isso") + limitação real + o que você perde sem agir.
Padrões de alta conversão: especificidade de resultado ("emagrecer 7kg em 30 dias" > "emagrecer"), urgência crível (vagas reais > "oferta por tempo limitado"), prova por números.`,
  },

  // ── AD COPY ───────────────────────────────────────────────────────────────
  {
    agentRole: "ad_copy",
    memoryType: "public_launch_reference" as const,
    productNiche: "educacao_online",
    revenueRange: "7_digits",
    title: "Framework de anúncios para infoprodutos — Meta e Google",
    summary: `FRAMEWORK DE ANÚNCIOS DE ALTA CONVERSÃO:
TOFU (consciência): Hook de curiosidade ou controvérsia. "A escola te ensinou a trabalhar para o dinheiro. Eu vou te mostrar o contrário." — sem mencionar produto. Objetivo: tráfego e engajamento.
MOFU (consideração): Especificidade de resultado + mecanismo. "Em 21 dias usando o Método X, Patricia pagou a dívida de R$28.000. Veja como." — vídeo de testemunho real.
BOFU (conversão): Urgência + prova + oferta. "Últimas 47 vagas. Bônus de R$1.497 só até domingo." — carrossel com testemunhos + countdown.
REMARKETING: Para quem visitou a página mas não comprou. Tom: resolução de objeção específica. "Ainda em dúvida? Veja a garantia de 30 dias."
Headlines Google que convertem: "Curso [Resultado Específico] — Acesso Imediato", "[Número] alunos já [resultado] — Garanta sua vaga".
Regras: 1 ângulo por anúncio, hook nos primeiros 3 segundos do vídeo, CTA único por criativo.`,
  },

  // ── VSL SCRIPT ───────────────────────────────────────────────────────────
  {
    agentRole: "vsl_script",
    memoryType: "public_launch_reference" as const,
    productNiche: "educacao_online",
    revenueRange: "8_digits",
    title: "Estrutura de VSL de alta conversão — 45-90 minutos",
    summary: `ESTRUTURA DE VSL PROVADA EM LANÇAMENTOS 8 DÍGITOS:
00:00-02:00 — HOOK: Promessa impossível + prova de que é possível. "Você está prestes a ver como eu gerei R$2M em 7 dias com uma lista de apenas 3.000 pessoas. Se você achar que é mentira, eu entendo — eu também acharia. Por isso vou provar."
02:00-08:00 — HISTÓRIA DE ORIGEM: Fracasso + virada + descoberta do mecanismo. Não vender ainda. Apenas criar identificação.
08:00-18:00 — EDUCAÇÃO: Ensinar o mecanismo único de forma que a audiência entenda que não sabia o que não sabia. Criar desejo de aprender mais.
18:00-28:00 — PROVA: Casos de alunos, resultados, screenshots. Variar perfis (iniciante, avançado, nichos diferentes).
28:00-35:00 — TRANSIÇÃO PARA OFERTA: "Você deve estar se perguntando como ter acesso a isso..." — suave, não abrupta.
35:00-45:00 — STACK DE VALOR: Cada componente com valor unitário. Preço total calculado. Preço real revelado com âncora.
45:00-fim — URGÊNCIA + GARANTIA + CTA: Fecha com o que o cliente perde ao não agir + garantia que remove risco + CTA específico.
REGRA DE OURO: o preço só é revelado depois que a audiência concordou mentalmente que o produto vale pelo menos 10x o preço.`,
  },

  // ── LANDING PAGE ─────────────────────────────────────────────────────────
  {
    agentRole: "landing_page",
    memoryType: "public_launch_reference" as const,
    productNiche: "educacao_online",
    revenueRange: "8_digits",
    title: "Estrutura de página de vendas de infoproduto — CRO validado",
    summary: `ESTRUTURA DE PÁGINA DE ALTA CONVERSÃO:
1. HERO (above the fold): Headline específica de resultado + subheadline de mecanismo + foto/vídeo humano (não stock) + CTA visível sem scroll.
2. PROVA DE CONCEITO: Números concretos. "4.312 alunos | Taxa de conclusão 73% | Resultado médio em 21 dias."
3. HISTORIA: Quem é o produtor, por que é credível, por que criou o produto.
4. O MÉTODO: Explicação do mecanismo único em 3-5 etapas visuais (ícone + título + descrição curta).
5. O QUE ESTÁ INCLUÍDO: Stack de bônus com valor individual de cada item.
6. PARA QUEM É / PARA QUEM NÃO É: Qualificação honesta — aumenta conversão de qualificados.
7. TESTEMUNHOS: Mínimo 6. Mix de antes/depois + resultado + perfil diferente.
8. PREÇO E GARANTIA: Âncora → preço real → garantia → razão para agir agora.
9. FAQ: 8-10 perguntas que destroem as objeções restantes.
10. CTA FINAL: Urgência de prazo + botão + selos de segurança.
MOBILE: Cada seção deve funcionar standalone em tela de 375px. CTA fixo no rodapé no mobile.`,
  },

  // ── STRATEGY ─────────────────────────────────────────────────────────────
  {
    agentRole: "strategy",
    memoryType: "public_launch_reference" as const,
    productNiche: "educacao_online",
    revenueRange: "8_digits",
    title: "Estratégia de lançamento clássico — 6 semanas — mercado brasileiro",
    summary: `ARQUITECTURA DE LANÇAMENTO CLÁSSICO BRASILEIRO — ALTA PERFORMANCE:
SEMANA -6 a -4 (Captura): Meta é lista de 5.000+ leads. CPL alvo: R$3-8 para nicho educação. Lead magnet: aula gratuita ou PDF de diagnóstico — não ebook genérico.
SEMANA -4 a -2 (Aquecimento): CPL 1: problema + identificação. CPL 2: mecanismo único educado. CPL 3: prova + antecipação. Frequência email: 3x/semana. WhatsApp: 1x/semana.
SEMANA -1 (Pré-abertura): Lista VIP com bônus exclusivo. Abrir 30% antes para VIPs. Cria FOMO nos não-VIPs.
DIA 1-2 (Abertura): 60-70% das vendas acontecem aqui. Email de abertura + WhatsApp + Live de abertura com oferta. Sequência de 3 emails no D1.
DIA 3-5 (Sustentação): Prova social de quem comprou, resposta de objeções, bônus adicionais com deadline.
DIA 6-7 (Fechamento): Sequência de urgência. 40% das vendas restantes acontecem no último dia. Email às 8h + 14h + 20h + 22h do último dia.
BENCHMARKS BRASILEIROS: Taxa de abertura de email: 25-35% na lista quente. Conversão da página: 2-5%. LTV do infoprodutor médio: 3x o ticket inicial.`,
  },

  // ── CREATIVE DIRECTOR ─────────────────────────────────────────────────────
  {
    agentRole: "creative_director",
    memoryType: "public_launch_reference" as const,
    productNiche: "educacao_online",
    revenueRange: "8_digits",
    title: "Identidade visual de campanha — princípios de design que convertem",
    summary: `PRINCÍPIOS DE DESIGN DE ALTA CONVERSÃO PARA LANÇAMENTOS DIGITAIS:
PALETA: Máximo 3 cores funcionais. Cor de destaque (CTA) nunca mais de 2 tons no mesmo material — contraste de 4.5:1 mínimo para acessibilidade.
TIPOGRAFIA: Headline em sans-serif bold (peso 700-900). Corpo em 16-18px, line-height 1.6. Nunca usar mais de 2 famílias tipográficas.
IMAGENS: Pessoas reais > ilustrações > stock. Rosto humano no above-the-fold aumenta conversão em 20-35% na média do mercado.
HIERARQUIA VISUAL: Número → Resultado → Prova → CTA. O olho deve saber o próximo passo sem pensar.
MOBILE FIRST: 65-70% do tráfego de infoprodutos brasileiros é mobile. Botões mínimo 44px de altura. Texto mínimo 16px.
VÍDEO: Thumbnail com rosto + expressão de surpresa/satisfação converte mais que screenshots de resultado. Proporção 16:9 para YouTube, 9:16 para Stories/TikTok/Reels.
CONSISTÊNCIA: Paleta idêntica em todos os pontos de contato — email, página, anúncio, WhatsApp. Reconhecimento de marca no terceiro ponto de contato aumenta conversão.`,
  },

  // ── TARGETING ────────────────────────────────────────────────────────────
  {
    agentRole: "targeting",
    memoryType: "public_launch_reference" as const,
    productNiche: "educacao_online",
    revenueRange: "7_digits",
    title: "Configuração de audiências — Meta Ads para infoprodutos",
    summary: `AUDIÊNCIAS DE ALTA PERFORMANCE PARA INFOPRODUTOS NO META:
COLD: Lookalike 1% da lista de compradores (melhor audiência fria disponível). Interesses: sempre use interesse específico de nicho + interesse de método/ferramenta, nunca só o nicho amplo.
REMARKETING QUENTE: Visitantes da página de vendas nos últimos 30 dias — excluindo compradores. CPM mais alto mas CPL 60-80% menor.
ENGAJADOS: Vídeo viewers 75%+ dos últimos 60 dias — audiência que já confia sem nunca ter clicado.
EXCLUSÕES OBRIGATÓRIAS: Compradores atuais, list de descadastro, clientes churned.
ORÇAMENTO: 50% lookalike, 30% remarketing, 20% testes de novos interesses.
CPL BENCHMARK: Educação online BR: R$5-15 (cold), R$15-40 (consideração), R$80-200 (venda direta BOFU).
ESTRUTURA DE CAMPANHA: Campanha por objetivo (não misturar). Ad set por audiência. 2-3 criativos por ad set — matar o perdedor após 300 impressões, escalar o vencedor.`,
  },

  // ── OPTIMIZATION ─────────────────────────────────────────────────────────
  {
    agentRole: "optimization",
    memoryType: "public_launch_reference" as const,
    productNiche: "educacao_online",
    revenueRange: "8_digits",
    title: "Otimização em tempo real de campanha — sinais críticos e ações",
    summary: `SINAIS DE ALARME E AÇÕES IMEDIATAS EM LANÇAMENTOS:
SINAL 1 — Taxa de abertura de email <18%: Problema de entregabilidade ou assunto fraco. Ação: testar novo assunto, verificar SPF/DKIM, higienizar lista de inativos.
SINAL 2 — CTR de anúncio <1%: Criativo não está parando o scroll. Ação: trocar hook — manter oferta e CTA. Testar 3 hooks diferentes em 24h.
SINAL 3 — Conversão da página <1.5%: Problema de qualificação de tráfego ou copy da página. Ação: revisar headline + CTA acima da dobra. Verificar congruência entre anúncio e página.
SINAL 4 — Abandono no checkout >70%: Problema de preço percebido ou atrito técnico. Ação: adicionar garantia + testemunho na página de checkout. Verificar carregamento mobile.
SINAL 5 — ROAS <2x no D3: Campanha não vai atingir meta. Ação: ativar sequência de urgência antecipada + aumentar remarketing + bônus adicional.
REGRA DE OURO: Nunca otimizar duas variáveis ao mesmo tempo. Um teste, uma variável, 48h de dados antes de decidir.`,
  },
];

async function seedPublicLaunches() {
  console.log("Seeding public launch references to workspace memory...");

  // Seed into a "system" workspace entry (workspaceId null would violate FK)
  // Instead we flag these as public references — they'll be fetched for ALL workspaces
  // We need a real workspace to attach — find first or skip
  const { workspacesTable } = await import("./schema/workspaces.js");

  const workspaces = await db.select({ id: workspacesTable.id }).from(workspacesTable).limit(1);

  if (workspaces.length === 0) {
    console.log("No workspaces found — seed requires at least one workspace. Register a user first, then re-run.");
    process.exit(0);
  }

  const workspaceId = workspaces[0]!.id;

  // Check for existing public references to avoid duplicates
  const existing = await db
    .select({ id: workspaceMemoryTable.id })
    .from(workspaceMemoryTable)
    .where(eq(workspaceMemoryTable.isPublicReference, true))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Public launch references already seeded (${existing.length}+ records). Use --force to re-seed.`);

    if (!process.argv.includes("--force")) {
      process.exit(0);
    }
  }

  let seeded = 0;

  for (const ref of PUBLIC_LAUNCH_REFERENCES) {
    await db.insert(workspaceMemoryTable).values({
      workspaceId,
      memoryType: "public_launch_reference",
      agentRole: ref.agentRole,
      title: ref.title,
      summary: ref.summary,
      content: { summary: ref.summary },
      tags: [ref.productNiche ?? "educacao_online", ref.revenueRange ?? "7_digits"],
      isNegative: false,
      isPublicReference: true,
      productNiche: ref.productNiche,
      revenueRange: ref.revenueRange,
      qualityScore: 90,
      usageCount: 0,
    });

    seeded++;
    console.log(`  ✓ [${ref.agentRole}] ${ref.title}`);
  }

  console.log(`\nSeeded ${seeded} public launch references successfully.`);
  console.log("These references will be injected into all agent prompts as quality baselines.");
  process.exit(0);
}

seedPublicLaunches().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
