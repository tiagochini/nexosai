/**
 * Guia de Filmagem — Filming Guide
 *
 * Guia interativo para usuários que querem aparecer na câmera.
 * Inclui setup técnico, roteiro de apresentação, dicas de performance
 * e exportação em PDF para referência offline.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Camera, Mic, Lightbulb, Monitor,
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  Download, Play, Eye, Zap, Volume2,
  Smartphone, Wind,
} from "lucide-react";

interface Step {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  color: string;
  tips: string[];
  warning?: string;
}

const STEPS: Step[] = [
  {
    id: "setup",
    icon: Camera,
    title: "Setup da câmera",
    subtitle: "Posicionamento e enquadramento",
    color: "text-primary",
    tips: [
      "Posicione a câmera na altura dos olhos — nunca abaixo (ângulo de sapo).",
      "Enquadramento ideal: cabeça a 1/3 do topo, espaço acima da cabeça.",
      "Distância da câmera: 60–90 cm — próximo o suficiente para sentir presença.",
      "Use tripé ou apoio firme — câmera tremida destrói credibilidade.",
      "Fundo limpo ou levemente desfocado. Evite bagunça ou distrações.",
      "Formato 16:9 para YouTube/VSL, 9:16 para Stories/Reels.",
    ],
  },
  {
    id: "lighting",
    icon: Lightbulb,
    title: "Iluminação",
    subtitle: "A diferença entre amador e profissional",
    color: "text-yellow-400",
    tips: [
      "Luz natural de janela lateral é a melhor opção gratuita.",
      "Janela deve ficar do lado — nunca atrás de você (silhueta).",
      "Ring light posicionada na frente e levemente acima dos olhos.",
      "Evite luz fria branca diretamente no rosto — prefira luz quente suave.",
      "Adicione uma luz de preenchimento fraca no lado oposto para reduzir sombras.",
      "Teste antes gravando 30 segundos e revisando — olhos brilhando = certo.",
    ],
    warning: "Janela atrás de você = você vira uma sombra. Nunca faça isso.",
  },
  {
    id: "audio",
    icon: Mic,
    title: "Áudio",
    subtitle: "O fator mais subestimado",
    color: "text-green-400",
    tips: [
      "Áudio ruim destrói vídeos bonitos. Invista no microfone antes da câmera.",
      "Microfone de lapela (mesmo barato) é infinitamente melhor que câmera built-in.",
      "Grave em ambiente fechado com objetos absorventes (tapete, sofá, cortinas).",
      "Evite ventiladores, ar-condicionado e frigoríficos ligados durante a gravação.",
      "Faça um teste de 10 segundos e escute com fone antes de gravar tudo.",
      "Fale 20% mais devagar do que você acha natural — câmera acelera percepção.",
    ],
    warning: "Ruído de fundo de ar-condicionado é quase impossível de remover na edição.",
  },
  {
    id: "performance",
    icon: Play,
    title: "Performance na câmera",
    subtitle: "Como parecer natural e convincente",
    color: "text-blue-400",
    tips: [
      "Olhe diretamente para a LENTE — não para a tela ou para você mesmo.",
      "Sorria naturalmente antes de começar cada take — isso muda sua expressão.",
      "Faça pausas deliberadas após pontos importantes — silêncio = ênfase.",
      "Use gestos naturais — mãos visíveis transmitem abertura e confiança.",
      "Se errar, pause 3 segundos e recomece a frase. Facilita na edição.",
      "Grave mais de uma vez — a 3ª ou 4ª take costuma ser a melhor.",
    ],
  },
  {
    id: "script",
    icon: Monitor,
    title: "Uso do roteiro",
    subtitle: "Como usar sem parecer lendo",
    color: "text-purple-400",
    tips: [
      "Coloque o roteiro atrás ou ao lado da câmera — nunca abaixo dela.",
      "Use fonte grande (24pt+) para não precisar forçar a vista.",
      "Divida o script em blocos curtos — decore o conceito, não as palavras.",
      "Teleprompter: app gratuito no celular posicionado atrás da câmera.",
      "Pratique o roteiro em voz alta 2–3 vezes antes de gravar.",
      "Permita variações naturais de palavra — rigidez demais soa robótico.",
    ],
  },
  {
    id: "mobile",
    icon: Smartphone,
    title: "Gravando com celular",
    subtitle: "Dicas específicas para smartphone",
    color: "text-orange-400",
    tips: [
      "Use o celular em modo paisagem para VSL, vertical para stories/reels.",
      "Câmera traseira tem qualidade muito superior à frontal — use-a com apoio.",
      "Ative 'Grade' nas configurações para enquadrar corretamente.",
      "Modo Pro/Manual: ISO baixo (< 400), velocidade 1/60 para 30fps.",
      "Limpe a lente antes de gravar — dedada estraga qualidade.",
      "Deixe o celular em modo avião durante a gravação — sem notificações.",
    ],
  },
  {
    id: "checklist",
    icon: CheckCircle2,
    title: "Checklist pré-gravação",
    subtitle: "Revise antes de apertar REC",
    color: "text-success",
    tips: [
      "☐ Câmera na altura dos olhos e enquadrada",
      "☐ Iluminação testada — sem sombras duras no rosto",
      "☐ Microfone conectado e testado",
      "☐ Ambiente silencioso — AC, ventilador, celular desligados",
      "☐ Fundo arrumado e profissional",
      "☐ Roteiro revisado e praticado",
      "☐ Roupa sólida (evite listras finas — vibra na câmera)",
      "☐ Água por perto para hidratar a voz",
    ],
  },
];

function StepCard({ step, defaultOpen = false }: { step: Step; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const Icon = step.icon;

  function toggleCheck(i: number) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const isChecklist = step.id === "checklist";

  return (
    <div className="border border-border/30 bg-card/20 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-card/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${step.color}`} />
          <div>
            <div className="font-mono text-sm font-bold text-foreground">{step.title}</div>
            <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">{step.subtitle}</div>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border/20">
          {step.warning && (
            <div className="mt-3 mb-3 flex items-start gap-2 bg-destructive/10 border border-destructive/20 p-3">
              <Wind className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <span className="font-mono text-[11px] text-destructive/80">{step.warning}</span>
            </div>
          )}
          <ul className="mt-3 space-y-2">
            {step.tips.map((tip, i) => (
              <li
                key={i}
                className={`flex items-start gap-2.5 cursor-pointer group ${
                  isChecklist ? "hover:bg-success/5 p-1 -mx-1 rounded" : ""
                }`}
                onClick={isChecklist ? () => toggleCheck(i) : undefined}
              >
                {isChecklist ? (
                  checked.has(i) ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-0.5 group-hover:text-success/50 transition-colors" />
                  )
                ) : (
                  <span className="w-1 h-1 rounded-full bg-primary/40 shrink-0 mt-1.5" />
                )}
                <span className={`font-mono text-[11px] leading-relaxed ${
                  isChecklist && checked.has(i)
                    ? "text-success/60 line-through"
                    : "text-foreground/70"
                }`}>
                  {isChecklist ? tip.replace("☐ ", "") : tip}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function generatePdfContent(): string {
  const lines: string[] = [
    "NEXOS AI — GUIA DE FILMAGEM",
    "================================",
    "",
  ];

  for (const step of STEPS) {
    lines.push(`## ${step.title.toUpperCase()}`);
    lines.push(`${step.subtitle}`);
    lines.push("");
    if (step.warning) {
      lines.push(`⚠️  ATENÇÃO: ${step.warning}`);
      lines.push("");
    }
    for (const tip of step.tips) {
      lines.push(`• ${tip.replace("☐ ", "")}`);
    }
    lines.push("");
  }

  lines.push("================================");
  lines.push("NexOS AI — nexos.ai");
  lines.push("Guia gerado automaticamente pela plataforma NexOS.");

  return lines.join("\n");
}

function downloadTextAsPdf() {
  const content = generatePdfContent();
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nexos-guia-filmagem.txt";
  a.click();
  URL.revokeObjectURL(url);
}

export default function FilmingGuide() {
  const [, setLocation] = useLocation();

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
              <Camera className="h-4 w-4 text-primary" />
              Guia de Filmagem
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
              Para quem quer aparecer na câmera
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={downloadTextAsPdf}
          className="rounded-none font-mono uppercase tracking-widest text-xs border-border/40 gap-2"
        >
          <Download className="h-3.5 w-3.5" />
          Baixar guia
        </Button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* ── Hero ── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-primary/70">
              Guia completo · 7 módulos
            </span>
          </div>
          <h1 className="font-mono font-black text-2xl md:text-3xl uppercase tracking-tight text-foreground mb-3">
            Apareça na câmera<br />
            <span className="text-primary">com autoridade.</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground/60 leading-relaxed">
            Você não precisa de estúdio caro. Precisa de setup certo.
            Este guia te leva do zero ao vídeo profissional com o que você já tem.
          </p>
        </div>

        {/* ── Quick wins ── */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Eye,     label: "Enquadramento", desc: "Câmera na altura dos olhos" },
            { icon: Volume2, label: "Áudio",         desc: "Microfone de lapela" },
            { icon: Zap,     label: "Iluminação",    desc: "Janela lateral" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="border border-border/30 bg-card/20 p-3 text-center">
              <Icon className="h-4 w-4 text-primary/60 mx-auto mb-1.5" />
              <div className="font-mono text-[11px] font-bold text-foreground/80 uppercase tracking-wide">{label}</div>
              <div className="font-mono text-[10px] text-muted-foreground/40 mt-0.5">{desc}</div>
            </div>
          ))}
        </div>

        {/* ── Steps ── */}
        <div className="space-y-2">
          {STEPS.map((step, i) => (
            <StepCard key={step.id} step={step} defaultOpen={i === 0} />
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        <div className="mt-8 border border-primary/20 bg-primary/5 p-6 text-center">
          <p className="font-mono text-sm font-bold text-foreground mb-1">
            Pronto para gravar?
          </p>
          <p className="font-mono text-[11px] text-muted-foreground/50 mb-4">
            Abra a Produção de Vídeo e deixe o CYRUS criar o roteiro cinematográfico.
          </p>
          <Button
            onClick={() => setLocation("/video-production")}
            className="rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary"
          >
            <Camera className="h-4 w-4" />
            Criar vídeo com IA
          </Button>
        </div>
      </div>
    </div>
  );
}
