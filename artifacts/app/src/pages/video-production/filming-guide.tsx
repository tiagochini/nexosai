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
import { useUiText } from "@/lib/i18n";
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

const STEP_TITLES: Record<string, readonly [string, string, string]> = {
  setup: ["Setup da câmera", "Camera setup", "Configuración de cámara"],
  lighting: ["Iluminação", "Lighting", "Iluminación"],
  audio: ["Áudio", "Audio", "Audio"],
  performance: ["Performance na câmera", "On-camera performance", "Interpretación ante cámara"],
  script: ["Uso do roteiro", "Using the script", "Uso del guion"],
  mobile: ["Gravando com celular", "Recording with a phone", "Grabar con el móvil"],
  checklist: ["Checklist pré-gravação", "Pre-recording checklist", "Lista previa a la grabación"],
};
const STEP_SUBTITLES: Record<string, readonly [string, string, string]> = {
  setup: ["Posicionamento e enquadramento", "Positioning and framing", "Posición y encuadre"],
  lighting: ["A diferença entre amador e profissional", "The difference between amateur and professional", "La diferencia entre aficionado y profesional"],
  audio: ["O fator mais subestimado", "The most underestimated factor", "El factor más subestimado"],
  performance: ["Como parecer natural e convincente", "How to look natural and convincing", "Cómo parecer natural y convincente"],
  script: ["Como usar sem parecer lendo", "How to use it without sounding like you're reading", "Cómo usarlo sin parecer que estás leyendo"],
  mobile: ["Dicas específicas para smartphone", "Tips specifically for smartphones", "Consejos específicos para smartphones"],
  checklist: ["Revise antes de apertar REC", "Review before pressing REC", "Revisa antes de pulsar REC"],
};
// Keep the Portuguese guide source intact for exports; these translations are
// applied only to on-screen copy.
const FILMING_UI_COPY: Record<string, readonly [string, string]> = {
  "Posicione a câmera na altura dos olhos — nunca abaixo (ângulo de sapo).": ["Position the camera at eye level—never below (the up-the-nose angle).", "Coloca la cámara a la altura de los ojos, nunca por debajo (ángulo desde abajo)."],
  "Enquadramento ideal: cabeça a 1/3 do topo, espaço acima da cabeça.": ["Ideal framing: your head sits one-third down from the top, with space above it.", "Encuadre ideal: cabeza en el tercio superior, con espacio por encima."],
  "Distância da câmera: 60–90 cm — próximo o suficiente para sentir presença.": ["Camera distance: 60–90 cm—close enough to feel present.", "Distancia a cámara: 60–90 cm, lo bastante cerca para transmitir presencia."],
  "Use tripé ou apoio firme — câmera tremida destrói credibilidade.": ["Use a tripod or sturdy support—shaky footage undermines credibility.", "Usa un trípode o soporte firme: una cámara temblorosa resta credibilidad."],
  "Fundo limpo ou levemente desfocado. Evite bagunça ou distrações.": ["Keep the background clean or slightly blurred. Avoid clutter and distractions.", "Mantén el fondo limpio o ligeramente desenfocado. Evita el desorden y las distracciones."],
  "Formato 16:9 para YouTube/VSL, 9:16 para Stories/Reels.": ["Use 16:9 for YouTube/VSL and 9:16 for Stories/Reels.", "Usa formato 16:9 para YouTube/VSL y 9:16 para Stories/Reels."],
  "Luz natural de janela lateral é a melhor opção gratuita.": ["Side window light is the best free option.", "La luz natural de una ventana lateral es la mejor opción gratuita."],
  "Janela deve ficar do lado — nunca atrás de você (silhueta).": ["Keep the window to the side—never behind you, or you'll become a silhouette.", "Coloca la ventana a un lado, nunca detrás de ti (te verías en silueta)."],
  "Ring light posicionada na frente e levemente acima dos olhos.": ["Place the ring light in front of you, slightly above eye level.", "Coloca el aro de luz delante y un poco por encima de los ojos."],
  "Evite luz fria branca diretamente no rosto — prefira luz quente suave.": ["Avoid harsh, cool white light directly on your face; choose soft, warm light.", "Evita la luz blanca fría directamente en el rostro; elige una luz cálida y suave."],
  "Adicione uma luz de preenchimento fraca no lado oposto para reduzir sombras.": ["Add a dim fill light on the opposite side to soften shadows.", "Añade una luz de relleno tenue en el lado opuesto para suavizar las sombras."],
  "Teste antes gravando 30 segundos e revisando — olhos brilhando = certo.": ["Record a 30-second test and review it—bright eyes are a good sign.", "Graba una prueba de 30 segundos y revísala: si los ojos brillan, está bien."],
  "Janela atrás de você = você vira uma sombra. Nunca faça isso.": ["A window behind you turns you into a silhouette. Never do this.", "Una ventana detrás de ti te convierte en una sombra. No lo hagas."],
  "Áudio ruim destrói vídeos bonitos. Invista no microfone antes da câmera.": ["Poor audio ruins beautiful video. Invest in a microphone before a camera.", "Un audio malo arruina un video bonito. Invierte antes en un micrófono que en una cámara."],
  "Microfone de lapela (mesmo barato) é infinitamente melhor que câmera built-in.": ["A lavalier mic—even an inexpensive one—is far better than a built-in camera mic.", "Un micrófono de solapa, aunque sea barato, es mucho mejor que el micrófono integrado de la cámara."],
  "Grave em ambiente fechado com objetos absorventes (tapete, sofá, cortinas).": ["Record indoors with sound-absorbing items such as rugs, sofas, and curtains.", "Graba en un espacio interior con materiales absorbentes, como alfombras, sofás y cortinas."],
  "Evite ventiladores, ar-condicionado e frigoríficos ligados durante a gravação.": ["Turn off fans, air conditioning, and refrigerators while recording.", "Apaga ventiladores, aire acondicionado y frigoríficos durante la grabación."],
  "Faça um teste de 10 segundos e escute com fone antes de gravar tudo.": ["Record a 10-second test and listen with headphones before recording everything.", "Graba una prueba de 10 segundos y escúchala con auriculares antes de grabarlo todo."],
  "Fale 20% mais devagar do que você acha natural — câmera acelera percepção.": ["Speak 20% slower than feels natural—the camera makes you seem faster.", "Habla un 20 % más despacio de lo que te parece natural: la cámara acelera la percepción."],
  "Ruído de fundo de ar-condicionado é quase impossível de remover na edição.": ["Air-conditioning background noise is almost impossible to remove in editing.", "El ruido de fondo del aire acondicionado es casi imposible de eliminar en edición."],
  "Olhe diretamente para a LENTE — não para a tela ou para você mesmo.": ["Look directly into the LENS—not at the screen or at yourself.", "Mira directamente al OBJETIVO, no a la pantalla ni a ti mismo."],
  "Sorria naturalmente antes de começar cada take — isso muda sua expressão.": ["Smile naturally before each take—it changes your expression.", "Sonríe con naturalidad antes de cada toma: cambia tu expresión."],
  "Faça pausas deliberadas após pontos importantes — silêncio = ênfase.": ["Pause deliberately after important points—silence adds emphasis.", "Haz pausas deliberadas después de los puntos importantes: el silencio enfatiza."],
  "Use gestos naturais — mãos visíveis transmitem abertura e confiança.": ["Use natural gestures—visible hands convey openness and confidence.", "Usa gestos naturales: las manos visibles transmiten apertura y confianza."],
  "Se errar, pause 3 segundos e recomece a frase. Facilita na edição.": ["If you make a mistake, pause for 3 seconds and restart the sentence. It helps with editing.", "Si te equivocas, pausa 3 segundos y repite la frase. Facilitará la edición."],
  "Grave mais de uma vez — a 3ª ou 4ª take costuma ser a melhor.": ["Record more than once—the third or fourth take is often the best.", "Graba más de una vez: la tercera o cuarta toma suele ser la mejor."],
  "Coloque o roteiro atrás ou ao lado da câmera — nunca abaixo dela.": ["Place the script behind or beside the camera—never below it.", "Coloca el guion detrás o al lado de la cámara, nunca por debajo."],
  "Use fonte grande (24pt+) para não precisar forçar a vista.": ["Use large text (24 pt+) so you don't have to strain your eyes.", "Usa letra grande (24 pt o más) para no forzar la vista."],
  "Divida o script em blocos curtos — decore o conceito, não as palavras.": ["Break the script into short sections—memorise the idea, not the exact words.", "Divide el guion en bloques cortos: memoriza la idea, no las palabras."],
  "Teleprompter: app gratuito no celular posicionado atrás da câmera.": ["Teleprompter: use a free phone app positioned behind the camera.", "Teleprompter: usa una aplicación gratuita en el móvil, colocada detrás de la cámara."],
  "Pratique o roteiro em voz alta 2–3 vezes antes de gravar.": ["Practise the script aloud 2–3 times before recording.", "Practica el guion en voz alta 2–3 veces antes de grabar."],
  "Permita variações naturais de palavra — rigidez demais soa robótico.": ["Allow natural variations in wording—too much rigidity sounds robotic.", "Permite variaciones naturales en las palabras: demasiada rigidez suena robótica."],
  "Use o celular em modo paisagem para VSL, vertical para stories/reels.": ["Use landscape orientation for VSLs and portrait for Stories/Reels.", "Usa el móvil en horizontal para VSL y en vertical para Stories/Reels."],
  "Câmera traseira tem qualidade muito superior à frontal — use-a com apoio.": ["The rear camera is much better than the front one—use it with a support.", "La cámara trasera ofrece mucha más calidad que la frontal; úsala con un soporte."],
  "Ative 'Grade' nas configurações para enquadrar corretamente.": ["Enable 'Grid' in settings to frame your shot correctly.", "Activa la «Cuadrícula» en los ajustes para encuadrar correctamente."],
  "Modo Pro/Manual: ISO baixo (< 400), velocidade 1/60 para 30fps.": ["Pro/Manual mode: low ISO (< 400), shutter speed 1/60 for 30 fps.", "Modo Pro/Manual: ISO bajo (< 400), velocidad 1/60 para 30 fps."],
  "Limpe a lente antes de gravar — dedada estraga qualidade.": ["Clean the lens before recording—a fingerprint ruins image quality.", "Limpia la lente antes de grabar: una huella arruina la calidad."],
  "Deixe o celular em modo avião durante a gravação — sem notificações.": ["Put your phone in airplane mode while recording—no notifications.", "Pon el móvil en modo avión durante la grabación para evitar notificaciones."],
  "Câmera na altura dos olhos e enquadrada": ["Camera at eye level and framed", "Cámara a la altura de los ojos y bien encuadrada"],
  "Iluminação testada — sem sombras duras no rosto": ["Lighting tested—with no harsh facial shadows", "Iluminación probada, sin sombras marcadas en el rostro"],
  "Microfone conectado e testado": ["Microphone connected and tested", "Micrófono conectado y probado"],
  "Ambiente silencioso — AC, ventilador, celular desligados": ["Quiet room—air conditioning and fan off, phone silenced", "Entorno silencioso: aire acondicionado y ventilador apagados, móvil silenciado"],
  "Fundo arrumado e profissional": ["Tidy, professional background", "Fondo ordenado y profesional"],
  "Roteiro revisado e praticado": ["Script reviewed and practised", "Guion revisado y practicado"],
  "Roupa sólida (evite listras finas — vibra na câmera)": ["Solid-color clothing (avoid fine stripes—they shimmer on camera)", "Ropa de color liso (evita rayas finas: vibran en cámara)"],
  "Água por perto para hidratar a voz": ["Water nearby to keep your voice hydrated", "Agua a mano para hidratar la voz"],
};
const localizedFilmingCopy = (text: string, t: ReturnType<typeof useUiText>) => {
  const copy = FILMING_UI_COPY[text];
  return copy ? t(text, copy[0], copy[1]) : text;
};

function StepCard({ step, defaultOpen = false }: { step: Step; defaultOpen?: boolean }) {
  const t = useUiText();
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
            <div>
              <div className="font-mono text-sm font-bold text-foreground">{STEP_TITLES[step.id] ? t(...STEP_TITLES[step.id]) : step.title}</div>
              <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">{STEP_SUBTITLES[step.id] ? t(...STEP_SUBTITLES[step.id]) : step.subtitle}</div>
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
        <div className="px-4 pb-4 border-t border-border/20">
          {step.warning && (
            <div className="mt-3 mb-3 flex items-start gap-2 bg-destructive/10 border border-destructive/20 p-3">
              <Wind className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <span className="font-mono text-[11px] text-destructive/80">{localizedFilmingCopy(step.warning, t)}</span>
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
                  {localizedFilmingCopy(isChecklist ? tip.replace("☐ ", "") : tip, t)}
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
  const t = useUiText();
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
               {t("Guia de Filmagem", "Filming Guide", "Guía de filmación")}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
               {t("Para quem quer aparecer na câmera", "For anyone who wants to appear on camera", "Para quienes quieren aparecer en cámara")}
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
           {t("Baixar guia", "Download guide", "Descargar guía")}
        </Button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* ── Hero ── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-primary/70">
               {t("Guia completo · 7 módulos", "Complete guide · 7 modules", "Guía completa · 7 módulos")}
            </span>
          </div>
          <h1 className="font-mono font-black text-2xl md:text-3xl uppercase tracking-tight text-foreground mb-3">
             {t("Apareça na câmera", "Show up on camera", "Aparece en cámara")}<br />
             <span className="text-primary">{t("com autoridade.", "with authority.", "con autoridad.")}</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground/60 leading-relaxed">
             {t("Você não precisa de estúdio caro. Precisa de setup certo. Este guia te leva do zero ao vídeo profissional com o que você já tem.", "You don't need an expensive studio. You need the right setup. This guide takes you from zero to professional video with what you already have.", "No necesitas un estudio caro. Necesitas la configuración adecuada. Esta guía te lleva desde cero hasta un video profesional con lo que ya tienes.")}
          </p>
        </div>

        {/* ── Quick wins ── */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
             { icon: Eye, label: t("Enquadramento", "Framing", "Encuadre"), desc: t("Câmera na altura dos olhos", "Camera at eye level", "Cámara a la altura de los ojos") },
             { icon: Volume2, label: t("Áudio", "Audio", "Audio"), desc: t("Microfone de lapela", "Lavalier microphone", "Micrófono de solapa") },
             { icon: Zap, label: t("Iluminação", "Lighting", "Iluminación"), desc: t("Janela lateral", "Side window", "Ventana lateral") },
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
             {t("Pronto para gravar?", "Ready to record?", "¿Listo para grabar?")}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground/50 mb-4">
             {t("Abra a Produção de Vídeo e deixe o CYRUS criar o roteiro cinematográfico.", "Open Video Production and let CYRUS create the cinematic script.", "Abre Producción de video y deja que CYRUS cree el guion cinematográfico.")}
          </p>
          <Button
            onClick={() => setLocation("/video-production")}
            className="rounded-none font-mono uppercase tracking-widest font-black gap-2 btn-weapon-primary"
          >
            <Camera className="h-4 w-4" />
             {t("Criar vídeo com IA", "Create video with AI", "Crear video con IA")}
          </Button>
        </div>
      </div>
    </div>
  );
}
