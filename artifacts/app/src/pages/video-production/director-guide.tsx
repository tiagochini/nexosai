/**
 * Guia do Diretor — Director's Filming Guide
 *
 * O Diretor de Filmagem instrui o usuário sobre cada detalhe da produção:
 * vestuário, cenário, linguagem, roteiro e energia por cena.
 *
 * Download com anti-pirataria: documento personalizado com nome/email do usuário
 * + token único + timestamp gravado no próprio conteúdo.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Download, Camera, Shirt, MapPin,
  MessageSquare, FileText, Zap, ChevronDown, ChevronUp,
  Star, AlertTriangle, CheckCircle2, Eye, Volume2,
  Clapperboard, Palette, Mic2, BookOpen,
} from "lucide-react";

interface DirectorSection {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  director: string;
  content: DirectorBlock[];
}

interface DirectorBlock {
  type: "instruction" | "do" | "dont" | "note" | "example" | "choice";
  text: string;
  options?: string[];
}

const DIRECTOR_SECTIONS: DirectorSection[] = [
  {
    id: "vestuario",
    icon: Shirt,
    color: "text-indigo-400",
    title: "Vestuário",
    director: "A roupa fala antes de você abrir a boca. Aqui está o briefing.",
    content: [
      { type: "instruction", text: "Use cores sólidas, de média a alta saturação. O cérebro registra autoridade e presença antes de processar qualquer palavra." },
      { type: "do", text: "Azul marinho, cinza chumbo, preto, bordô — transmitem autoridade sem competir com seu rosto." },
      { type: "do", text: "Branco puro e bege claro funcionam bem com fundos escuros ou neutros." },
      { type: "do", text: "Uma camisa social ou blazer casual eleva imediatamente a percepção de valor — mesmo em casa." },
      { type: "dont", text: "Listras finas e xadrez miúdo — vibram na câmera (efeito moiré). Nunca use." },
      { type: "dont", text: "Estampas grandes, logos visíveis, camisetas de banda ou time." },
      { type: "dont", text: "Roupas que combinam exatamente com o fundo — você some." },
      { type: "note", text: "Teste: grave 30 segundos e reveja no celular em tela cheia. Se a roupa chama mais atenção que seus olhos, troque." },
      { type: "choice", text: "Escolha de acordo com o tom do seu produto:", options: [
        "Produto premium / high-ticket → blazer, camisa social, relógio discreto",
        "Produto de transformação pessoal → look casual elegante, cor quente",
        "Produto técnico / educacional → camisa polo, tom neutro, sem acessórios",
        "Saúde e bem-estar → cores terrosas, linho, visual clean",
      ]},
    ],
  },
  {
    id: "cenario",
    icon: MapPin,
    color: "text-amber-400",
    title: "Cenário e Fundo",
    director: "O fundo é o segundo personagem do seu vídeo. Ele precisa trabalhar para você.",
    content: [
      { type: "instruction", text: "O cenário deve comunicar: 'esse criador tem contexto, tem ambiente, é real'. Não precisa ser perfeito — precisa ser intencional." },
      { type: "choice", text: "Escolha o fundo de acordo com o posicionamento:", options: [
        "Parede com poucos elementos (quadro, planta, livros) → profissional e acessível",
        "Biblioteca ou estante com livros → autoridade intelectual",
        "Home office arrumado → especialista que trabalha de verdade",
        "Fundo neutro ou parede de cor sólida → produto e solução em foco",
        "Ambiente ao ar livre com boa luz → lifestyle, leveza, liberdade",
      ]},
      { type: "do", text: "Adicione profundidade: algo levemente desfocado atrás de você cria cinema mesmo com câmera de celular." },
      { type: "do", text: "Uma luz suave no fundo separa você do cenário e cria 3D visual." },
      { type: "dont", text: "Porta fechada, parede lisa branca sem elementos — parece entrevista de emprego." },
      { type: "dont", text: "Bagunça visível, roupas, camas, banheiros ou ambientes com muita informação." },
      { type: "note", text: "Segredo de direção: coloque um objeto relevante ao seu nicho no canto do fundo. Não precisa aparecer em destaque — mas quem presta atenção percebe e o cérebro registra congruência." },
    ],
  },
  {
    id: "linguagem",
    icon: MessageSquare,
    color: "text-green-400",
    title: "Linguagem e Tom",
    director: "A câmera amplifica tudo. Uma voz plana vira sonolência. Uma voz com intenção vira magnetismo.",
    content: [
      { type: "instruction", text: "Você está tendo uma conversa íntima com UMA pessoa — não fazendo discurso para uma plateia. Fale como se estivesse tomando café com seu melhor cliente." },
      { type: "do", text: "Varie a velocidade: acelere nos pontos de energia, desacelere nas revelações importantes." },
      { type: "do", text: "Pause intencionalmente antes das frases mais importantes. O silêncio é pontuação." },
      { type: "do", text: "Use o nome da pessoa (se possível) ou diga 'você' — não 'vocês', não 'as pessoas'." },
      { type: "do", text: "Gesticule naturalmente. Mãos visíveis e abertas = abertura + confiança." },
      { type: "dont", text: "Ler da tela com olho parado. A audiência percebe e desconecta." },
      { type: "dont", text: "Falar em monoton sem variação de tom — toda frase com a mesma energia." },
      { type: "dont", text: "Usar palavras complexas só para parecer especialista. Clareza = autoridade real." },
      { type: "example", text: "Em vez de: 'Este programa foi desenvolvido para auxiliar empreendedores...' → Diga: 'Eu criei isso para quem já tentou de tudo e está cansado de não ver resultado.'" },
      { type: "choice", text: "Tom por tipo de produto:", options: [
        "Transformação pessoal → caloroso, próximo, como um amigo que já passou por isso",
        "Business / resultados → direto, confiante, sem enrolação",
        "Educacional → paciente, claro, com exemplos práticos",
        "Premium / high-ticket → calmo, sóbrio, pesado de valor — não animado",
      ]},
    ],
  },
  {
    id: "roteiro",
    icon: FileText,
    color: "text-blue-400",
    title: "Estrutura do Roteiro",
    director: "Todo vídeo que converte segue uma arquitetura. Desvie dela e perde o espectador.",
    content: [
      { type: "instruction", text: "A estrutura abaixo foi testada nos maiores lançamentos digitais do Brasil. Cada bloco tem uma função neurológica. Não pule nenhum." },
      { type: "do", text: "GANCHO (0–15s): Comece com o maior problema ou a maior promessa. Nunca com 'oi, meu nome é...'" },
      { type: "example", text: "Gancho modelo: 'Se você já fez tudo que ensinaram e ainda não chegou em [resultado], este vídeo é literalmente o que estava faltando.'" },
      { type: "do", text: "AUTORIDADE (15–45s): Por que você? Um momento de prova rápida — resultado, caso de sucesso, credencial real." },
      { type: "do", text: "PROBLEMA (45s–2min): Detalhe a dor com precisão cirúrgica. Quem se sente compreendido fica. Use: 'Eu sei que você...' e descreva o estado interno." },
      { type: "do", text: "SOLUÇÃO (2–4min): Apresente a ideia, o método, o framework. Não revele tudo — crie antecipação." },
      { type: "do", text: "PROVA (4–6min): Resultados, depoimentos, antes/depois. Quanto mais específico, mais crível." },
      { type: "do", text: "OFERTA + URGÊNCIA (6–8min): O que está sendo ofertado, por quanto, por quanto tempo. Escassez real ou de percepção." },
      { type: "do", text: "CTA (últimos 30s): UM único botão, UMA única ação. Repita o benefício principal e ordene o próximo passo." },
      { type: "dont", text: "Começar agradecendo pelo tempo ou se apresentando. Os primeiros 3 segundos decidem se a pessoa fica." },
      { type: "dont", text: "Colocar o CTA apenas no final sem preparar o terreno antes." },
      { type: "note", text: "Regra de ouro: cada cena deve responder 'e daí?' para o espectador. Se não responder, corte." },
    ],
  },
  {
    id: "energia",
    icon: Zap,
    color: "text-yellow-400",
    title: "Energia por Cena",
    director: "Cada fase do vídeo exige uma frequência emocional diferente. Trocar de energia na hora certa é o que separa vídeos mediocres dos que convertem.",
    content: [
      { type: "instruction", text: "Pense em cada cena como uma nota musical. A composição precisa de variação para criar impacto." },
      { type: "choice", text: "Mapa de energia por fase:", options: [
        "GANCHO → Energia alta, urgente. Velocidade rápida, tom levemente elevado, postura para frente",
        "PROBLEMA → Energia empática, pesada. Desacelere, abaixe o tom, pause nas palavras-dor",
        "SOLUÇÃO → Energia esperançosa, limpa. Tom médio-alto, voz mais leve, sorriso natural",
        "PROVA → Energia sóbria, confiante. Fatos sólidos, voz pausada, olho firme na câmera",
        "OFERTA → Energia decisiva. Direto, sem enrolação, sem tremer",
        "CTA → Energia de convite. Caloroso, mas claro. Como dizer 'vem, eu te espero'",
      ]},
      { type: "do", text: "Grave cada fase separadamente se precisar. É mais fácil manter a energia certa por segmento." },
      { type: "do", text: "Antes de gravar cada cena: respire fundo, visualize o estado emocional desejado, só então fale." },
      { type: "note", text: "Técnica do diretor: antes do GANCHO, pense em algo que te deixa empolgado. Antes da cena PROBLEMA, pense num momento em que você mesmo sofreu com isso. A memória emocional aparece na câmera." },
    ],
  },
  {
    id: "tecnico",
    icon: Clapperboard,
    color: "text-purple-400",
    title: "Direção Técnica",
    director: "Detalhes técnicos que a maioria ignora e que fazem toda a diferença na percepção de qualidade.",
    content: [
      { type: "instruction", text: "Você não precisa de equipamento caro. Precisa de setup correto. Aqui estão os 5 ajustes que mais impactam o resultado final." },
      { type: "do", text: "LOOK CAMERA: Olhe diretamente para a LENTE — não para a sua imagem na tela. Coloque um adesivo de ponto ao lado da lente como guia." },
      { type: "do", text: "EYELINE: A câmera deve estar exatamente na altura dos olhos ou 2–3cm acima. Nunca abaixo." },
      { type: "do", text: "HEADROOM: Deixe espaço entre o topo da sua cabeça e a borda da tela — mas não muito. Regra dos terços." },
      { type: "do", text: "MOVIMENTO INTENCIONAL: Se vai gesticular, comece o gesto ANTES de começar a frase. Movimento depois da palavra parece mecânico." },
      { type: "do", text: "BREAKS: A cada 5–7 minutos de gravação, pare, beba água, respire. Sua energia renovada aparece na câmera." },
      { type: "dont", text: "Checar o celular ou notas durante a gravação sem pausar. A câmera registra os olhos desviando." },
      { type: "note", text: "Para vídeos longos (VSL): grave em blocos de no máximo 10 minutos. Você mantém a energia, a edição fica mais fácil e o resultado é visivelmente melhor." },
    ],
  },
  {
    id: "checklist",
    icon: CheckCircle2,
    color: "text-success",
    title: "Checklist do Diretor",
    director: "O set está pronto quando TODOS esses itens estiverem marcados. Sem exceção.",
    content: [
      { type: "do", text: "Câmera na altura dos olhos, enquadrada em 1/3 superior" },
      { type: "do", text: "Iluminação: luz principal lateral, sem sombras duras no rosto" },
      { type: "do", text: "Roupa sólida, sem listras, sem logo, compatível com o tom do produto" },
      { type: "do", text: "Fundo intencional — não uma parede branca vazia" },
      { type: "do", text: "Microfone conectado e testado (30s de gravação + fone)" },
      { type: "do", text: "Ambiente silencioso — AC, ventilador, celular em modo avião" },
      { type: "do", text: "Roteiro praticado em voz alta pelo menos 3 vezes" },
      { type: "do", text: "Estado emocional preparado para o GANCHO (energia alta)" },
      { type: "do", text: "Água por perto para hidratar a voz entre takes" },
      { type: "do", text: "Câmera/celular com bateria acima de 80% ou carregando" },
    ],
  },
];

const COLOR_MAP: Record<string, string> = {
  "text-indigo-400": "#818cf8",
  "text-amber-400": "#fbbf24",
  "text-green-400": "#4ade80",
  "text-blue-400": "#60a5fa",
  "text-yellow-400": "#facc15",
  "text-purple-400": "#c084fc",
  "text-success": "#22c55e",
};

function BlockItem({ block }: { block: DirectorBlock }) {
  if (block.type === "instruction") {
    return (
      <p className="font-mono text-sm text-foreground/80 leading-relaxed italic border-l-2 border-primary/40 pl-3 py-1 my-2">
        {block.text}
      </p>
    );
  }
  if (block.type === "do") {
    return (
      <div className="flex items-start gap-2 my-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
        <span className="font-mono text-[12px] text-foreground/75 leading-relaxed">{block.text}</span>
      </div>
    );
  }
  if (block.type === "dont") {
    return (
      <div className="flex items-start gap-2 my-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
        <span className="font-mono text-[12px] text-destructive/70 leading-relaxed">{block.text}</span>
      </div>
    );
  }
  if (block.type === "note") {
    return (
      <div className="my-2 flex items-start gap-2 bg-primary/5 border border-primary/20 p-3">
        <Star className="h-3.5 w-3.5 text-primary/60 shrink-0 mt-0.5" />
        <span className="font-mono text-[11px] text-primary/70 leading-relaxed">{block.text}</span>
      </div>
    );
  }
  if (block.type === "example") {
    return (
      <div className="my-2 bg-card/40 border border-border/30 p-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 block mb-1">Exemplo do diretor</span>
        <span className="font-mono text-[12px] text-foreground/70 leading-relaxed">{block.text}</span>
      </div>
    );
  }
  if (block.type === "choice" && block.options) {
    return (
      <div className="my-2">
        <span className="font-mono text-[11px] text-muted-foreground/60 block mb-2">{block.text}</span>
        <div className="space-y-1">
          {block.options.map((opt, i) => (
            <div key={i} className="flex items-start gap-2">
              <Eye className="h-3 w-3 text-primary/40 shrink-0 mt-0.5" />
              <span className="font-mono text-[11px] text-foreground/60 leading-relaxed">{opt}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function SectionCard({ section, defaultOpen = false }: { section: DirectorSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = section.icon;

  return (
    <div className="border border-border/30 bg-card/20 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-card/40 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full border border-border/30 flex items-center justify-center bg-card/30">
            <Icon className={`h-5 w-5 ${section.color}`} />
          </div>
          <div>
            <div className="font-mono text-sm font-black text-foreground uppercase tracking-wide">{section.title}</div>
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5 italic line-clamp-1">
              "{section.director}"
            </div>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border/20">
          <div className="mt-4 font-mono text-[12px] text-muted-foreground/60 italic mb-4 leading-relaxed">
            "{section.director}"
          </div>
          {section.content.map((block, i) => (
            <BlockItem key={i} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

function generateAntiPiracyDocument(
  userName: string,
  userEmail: string,
  planName: string,
): string {
  const now = new Date();
  const token = btoa(`${userEmail}:${now.getTime()}`).slice(0, 16).toUpperCase();
  const serial = `NX-DIR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${token}`;
  const dateStr = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const lines: string[] = [];

  lines.push("╔══════════════════════════════════════════════════════════════╗");
  lines.push("║           NEXOS AI — GUIA DO DIRETOR DE FILMAGEM            ║");
  lines.push("╚══════════════════════════════════════════════════════════════╝");
  lines.push("");
  lines.push("DOCUMENTO PERSONALIZADO E PROTEGIDO CONTRA REDISTRIBUIÇÃO");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`Licenciado para: ${userName}`);
  lines.push(`E-mail registrado: ${userEmail}`);
  lines.push(`Plano: ${planName}`);
  lines.push(`Serial de acesso: ${serial}`);
  lines.push(`Gerado em: ${dateStr} (horário de Brasília)`);
  lines.push("");
  lines.push("AVISO LEGAL: Este documento é de uso exclusivo do titular acima.");
  lines.push("A redistribuição, cópia ou compartilhamento não autorizado viola");
  lines.push("os Termos de Uso da NexOS AI e pode acarretar responsabilidade civil.");
  lines.push("Cada download gera um código rastreável único vinculado ao usuário.");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  for (const section of DIRECTOR_SECTIONS) {
    lines.push("");
    lines.push(`${"═".repeat(64)}`);
    lines.push(`  ${section.title.toUpperCase()}`);
    lines.push(`${"═".repeat(64)}`);
    lines.push(`  "${section.director}"`);
    lines.push("");

    for (const block of section.content) {
      if (block.type === "instruction") {
        lines.push(`  ▸ ${block.text}`);
      } else if (block.type === "do") {
        lines.push(`  ✓ ${block.text}`);
      } else if (block.type === "dont") {
        lines.push(`  ✗ ${block.text}`);
      } else if (block.type === "note") {
        lines.push(`  ★ NOTA DO DIRETOR: ${block.text}`);
      } else if (block.type === "example") {
        lines.push(`  » EXEMPLO: ${block.text}`);
      } else if (block.type === "choice") {
        lines.push(`  • ${block.text}`);
        block.options?.forEach(opt => lines.push(`      – ${opt}`));
      }
      lines.push("");
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("© NexOS AI — nexos.ai | Todos os direitos reservados.");
  lines.push(`Documento gerado exclusivamente para: ${userName} <${userEmail}>`);
  lines.push(`Serial: ${serial}`);
  lines.push("Este documento não pode ser compartilhado, revendido ou distribuído.");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return lines.join("\n");
}

export default function DirectorGuide() {
  const [, setLocation] = useLocation();
  const { user, plan } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const userName = user?.name ?? "Usuário NexOS";
  const userEmail = (user as unknown as { email?: string })?.email ?? "usuario@nexos.ai";
  const planName = plan?.name ?? "NexOS";

  function handleDownload() {
    setDownloading(true);
    try {
      const content = generateAntiPiracyDocument(userName, userEmail, planName);
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexos-diretor-filmagem-${userName.replace(/\s+/g, "-").toLowerCase()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border/30 px-6 py-4 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/video-production")}
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="font-mono text-sm font-bold text-foreground flex items-center gap-2">
              <Clapperboard className="h-4 w-4 text-primary" />
              Guia do Diretor
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
              Instruções completas de filmagem · Personalizado para {userName}
            </div>
          </div>
        </div>

        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="rounded-none font-mono uppercase tracking-widest text-xs btn-weapon-primary gap-2"
        >
          {downloading ? (
            <span className="animate-pulse">Gerando...</span>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              Baixar guia personalizado
            </>
          )}
        </Button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── Director Intro ── */}
        <div className="mb-10 border border-border/30 bg-card/20 p-6 relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40" />

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <Clapperboard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary/60 mb-1">
                Diretor de Filmagem · NexOS AI
              </div>
              <h1 className="font-mono font-black text-xl text-foreground mb-2">
                {userName}, aqui são as minhas instruções.
              </h1>
              <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed">
                Um vídeo que converte não é acidente — é direção. Cada detalhe abaixo foi calibrado
                para maximizar autoridade, confiança e conversão. Siga o briefing. Grave com intenção.
                O resultado vai surpreender você.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <span className="font-mono text-[10px] text-muted-foreground/40">7 módulos de direção</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <span className="font-mono text-[10px] text-muted-foreground/40">Vestuário · Cenário · Performance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mic2 className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <span className="font-mono text-[10px] text-muted-foreground/40">Roteiro · Energia · Técnico</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Anti-piracy badge ── */}
        <div className="mb-6 flex items-center gap-2 border border-warning/20 bg-warning/5 px-4 py-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
          <span className="font-mono text-[11px] text-warning/70">
            Documento personalizado e protegido — licenciado exclusivamente para <strong>{userName}</strong>.
            O download gera um serial único rastreável vinculado à sua conta.
          </span>
        </div>

        {/* ── Sections ── */}
        <div className="space-y-2">
          {DIRECTOR_SECTIONS.map((section, i) => (
            <SectionCard key={section.id} section={section} defaultOpen={i === 0} />
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-none font-mono uppercase tracking-widest font-black gap-3 btn-weapon-primary h-14 px-12 text-sm"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Gerando documento..." : "Baixar guia completo personalizado"}
          </Button>
          <p className="font-mono text-[10px] text-muted-foreground/30 text-center">
            Licenciado para {userName} · Serial único por download · Documento rastreável
          </p>
          <button
            onClick={() => setLocation("/video-production")}
            className="font-mono text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Camera className="h-3.5 w-3.5" />
            Criar vídeo agora com CYRUS
          </button>
        </div>
      </div>
    </div>
  );
}
