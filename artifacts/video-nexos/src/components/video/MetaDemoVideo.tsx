import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Short demo video for Meta App Review submission (~90s) ──────────────────
// Shows: OAuth login → NexOS app with campaign → content approved → published to Instagram

const STEPS = [
  {
    id: "intro",
    duration: 5000,
    title: "NexOS AI — App Review Demo",
    subtitle: "Demonstração de uso das permissões da API do Meta",
    bg: "from-black to-zinc-900",
    accent: "#7c3aed",
  },
  {
    id: "oauth",
    duration: 14000,
    title: "Passo 1 — Login com Instagram",
    subtitle: "Usuário autoriza acesso via OAuth 2.0",
    bg: "from-zinc-900 to-zinc-800",
    accent: "#E1306C",
  },
  {
    id: "campaign",
    duration: 15000,
    title: "Passo 2 — Campanha de Lançamento",
    subtitle: "IA gera estratégia e conteúdo para o lançamento",
    bg: "from-zinc-900 to-zinc-800",
    accent: "#7c3aed",
  },
  {
    id: "approval",
    duration: 15000,
    title: "Passo 3 — Aprovação de Conteúdo",
    subtitle: "Usuário revisa e aprova posts gerados pela IA",
    bg: "from-zinc-900 to-zinc-800",
    accent: "#10b981",
  },
  {
    id: "publish",
    duration: 16000,
    title: "Passo 4 — Publicação Automática",
    subtitle: "NexOS publica via instagram_content_publish",
    bg: "from-zinc-900 to-zinc-800",
    accent: "#E1306C",
  },
  {
    id: "disconnect",
    duration: 14000,
    title: "Passo 5 — Revogação de Acesso",
    subtitle: "Usuário desconecta e o token é deletado imediatamente",
    bg: "from-zinc-900 to-zinc-800",
    accent: "#6b7280",
  },
  {
    id: "end",
    duration: 7000,
    title: "Obrigado pela análise",
    subtitle: "Privacy Policy: https://agencianexos.vip/privacy",
    bg: "from-zinc-900 to-black",
    accent: "#7c3aed",
  },
];

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <div className="w-full h-0.5 bg-white/10 overflow-hidden">
      <motion.div
        className="h-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${progress * 100}%` }}
        transition={{ duration: 0.1, ease: "linear" }}
      />
    </div>
  );
}

function OAuthStep({ visible }: { visible: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!visible) { setStep(0); return; }
    const timers = [
      setTimeout(() => setStep(1), 1500),
      setTimeout(() => setStep(2), 4000),
      setTimeout(() => setStep(3), 7000),
      setTimeout(() => setStep(4), 10000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  return (
    <div className="flex gap-6 items-start w-full max-w-2xl mx-auto">
      {/* NexOS side */}
      <div className="flex-1 border border-purple-500/30 bg-black/50 p-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-purple-400 mb-3">NexOS AI — Integrações</div>
        <div className="border border-white/10 bg-zinc-900 p-3 flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">IG</div>
          <div>
            <div className="font-mono text-xs text-white">Instagram Business</div>
            <div className="font-mono text-[10px] text-white/40">Publicação automática de conteúdo</div>
          </div>
          <AnimatePresence>
            {step >= 4 ? (
              <motion.div
                key="connected"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="ml-auto font-mono text-[10px] text-emerald-400 border border-emerald-400/30 px-2 py-0.5"
              >
                ● CONECTADO
              </motion.div>
            ) : (
              <motion.button
                key="connect-btn"
                onClick={() => setStep(1)}
                className="ml-auto font-mono text-[10px] bg-purple-600 text-white px-3 py-1 cursor-default"
              >
                Conectar
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {step >= 4 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="font-mono text-[10px] text-emerald-400/60 border-l-2 border-emerald-400/30 pl-2"
            >
              Token armazenado com segurança ✓<br />
              Permissões: instagram_content_publish, instagram_basic
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* OAuth popup */}
      <AnimatePresence>
        {step >= 1 && step < 4 && (
          <motion.div
            key="popup"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="w-64 border border-white/20 bg-white shadow-2xl"
          >
            <div className="bg-[#1877F2] p-3 flex items-center gap-2">
              <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center">
                <span className="text-[#1877F2] font-bold text-xs">f</span>
              </div>
              <span className="text-white font-bold text-sm">Facebook</span>
            </div>
            <div className="p-4 bg-white">
              <div className="font-sans text-sm font-semibold text-gray-900 mb-1">NexOS AI está solicitando acesso</div>
              <div className="font-sans text-xs text-gray-500 mb-3">Às suas informações do Instagram Business</div>
              <div className="space-y-1.5 mb-3">
                {["instagram_content_publish", "instagram_basic", "pages_read_engagement"].map((scope, si) => (
                  <motion.div
                    key={scope}
                    initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: si * 0.3 + 0.5 }}
                    className="flex items-center gap-2"
                  >
                    <AnimatePresence>
                      {step >= 2 && (
                        <motion.span
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[8px]"
                        >✓</motion.span>
                      )}
                    </AnimatePresence>
                    <span className="font-mono text-[9px] text-gray-600">{scope}</span>
                  </motion.div>
                ))}
              </div>
              <AnimatePresence>
                {step >= 3 && (
                  <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onClick={() => setStep(4)}
                    className="w-full bg-[#1877F2] text-white font-sans text-sm font-semibold py-2 cursor-default"
                  >
                    Continuar
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CampaignStep({ visible }: { visible: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!visible) { setStep(0); return; }
    const timers = [
      setTimeout(() => setStep(1), 1000),
      setTimeout(() => setStep(2), 4000),
      setTimeout(() => setStep(3), 8000),
      setTimeout(() => setStep(4), 11000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  const content = [
    { label: "Estratégia de Lançamento", ready: step >= 2, icon: "📊" },
    { label: "Roteiro de VSL (Copy)", ready: step >= 3, icon: "✍️" },
    { label: "Posts para Instagram (10 peças)", ready: step >= 4, icon: "📱" },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto border border-purple-500/30 bg-black/50 p-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-purple-400 mb-4">Campanha: Lançamento Semente 7 Dias</div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {["R$ 0", "7 dias", "Instagram"].map((val, i) => (
          <div key={i} className="border border-white/10 bg-zinc-900 p-2 text-center">
            <div className="font-mono text-xs text-white font-bold">{val}</div>
          </div>
        ))}
      </div>
      {content.map((item, ci) => (
        <div key={ci} className="flex items-center gap-3 border border-white/10 bg-zinc-900 p-2.5 mb-2">
          <span className="text-base">{item.icon}</span>
          <span className="font-mono text-xs text-white/70 flex-1">{item.label}</span>
          <AnimatePresence>
            {item.ready ? (
              <motion.span key="ready" initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="font-mono text-[10px] text-emerald-400">✓ Pronto</motion.span>
            ) : step >= ci && (
              <motion.span key="gen" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="font-mono text-[10px] text-purple-400">gerando…</motion.span>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function ApprovalStep({ visible }: { visible: boolean }) {
  const [approved, setApproved] = useState<number[]>([]);
  useEffect(() => {
    if (!visible) { setApproved([]); return; }
    const timers = [
      setTimeout(() => setApproved([0]), 2000),
      setTimeout(() => setApproved([0, 1]), 5000),
      setTimeout(() => setApproved([0, 1, 2]), 8500),
      setTimeout(() => setApproved([0, 1, 2, 3]), 11500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  const posts = [
    { day: "Dia 1", type: "Reel de Abertura", preview: "🎬 Hook: 'A maioria dos coaches erra...' ✅ instagram_content_publish" },
    { day: "Dia 2", type: "Carrossel — Prova Social", preview: "📸 5 slides com depoimentos formatados automaticamente" },
    { day: "Dia 3", type: "Story — Bastidores", preview: "📱 Sequência de 3 stories + link de captura" },
    { day: "Dia 7", type: "Post de Abertura do Carrinho", preview: "🛒 Copy de urgência + CTA direto com link de checkout" },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto border border-purple-500/30 bg-black/50 p-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 mb-4">
        Aprovação de Conteúdo — {approved.length}/{posts.length} aprovados
      </div>
      <div className="space-y-2">
        {posts.map((post, pi) => (
          <div key={pi} className={`border p-3 transition-all ${approved.includes(pi) ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10 bg-zinc-900"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] text-white/40">{post.day}</span>
              <span className="font-mono text-xs text-white font-semibold">{post.type}</span>
              <AnimatePresence>
                {approved.includes(pi) && (
                  <motion.span key="approved" initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="ml-auto font-mono text-[10px] text-emerald-400">✓ APROVADO</motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="font-mono text-[10px] text-white/40 leading-relaxed">{post.preview}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PublishStep({ visible }: { visible: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!visible) { setStep(0); return; }
    const timers = [
      setTimeout(() => setStep(1), 1500),
      setTimeout(() => setStep(2), 4500),
      setTimeout(() => setStep(3), 7500),
      setTimeout(() => setStep(4), 10500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  const logs = [
    { ts: "08:00:01", msg: "Autenticando com token Instagram…", ok: true },
    { ts: "08:00:02", msg: "POST /v20.0/me/media — upload do Reel", ok: true },
    { ts: "08:00:04", msg: "POST /v20.0/{media_id}/publish — publicando", ok: true },
    { ts: "08:00:05", msg: "✓ Post publicado com sucesso (ID: 17854321098765)", ok: true },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* API call log */}
      <div className="border border-pink-500/30 bg-black/70 p-4 font-mono">
        <div className="text-[10px] uppercase tracking-widest text-pink-400 mb-3">Log de Publicação — API Meta Graph v20.0</div>
        {logs.slice(0, step).map((log, li) => (
          <motion.div key={li} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            className="flex gap-3 mb-1.5 text-[11px]">
            <span className="text-white/30 shrink-0">{log.ts}</span>
            <span className={log.ok ? "text-emerald-400" : "text-red-400"}>{log.msg}</span>
          </motion.div>
        ))}
      </div>
      {/* Instagram preview */}
      <AnimatePresence>
        {step >= 4 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="border border-white/20 bg-white max-w-[200px] mx-auto"
          >
            <div className="p-2 flex items-center gap-1.5 border-b border-gray-100">
              <div className="w-5 h-5 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full" />
              <span className="font-sans text-[10px] font-semibold text-gray-900">@seuinfoproduto</span>
            </div>
            <div className="aspect-square bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs text-center px-2">🎬 Reel publicado via NexOS AI</span>
            </div>
            <div className="p-2">
              <div className="font-sans text-[9px] text-gray-600">❤️ 127 · 💬 34 · 📤 Compartilhar</div>
              <div className="font-sans text-[9px] text-gray-800 mt-1">
                <span className="font-bold">@seuinfoproduto</span> A maioria dos coaches erra nesse ponto…
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DisconnectStep({ visible }: { visible: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!visible) { setStep(0); return; }
    const timers = [
      setTimeout(() => setStep(1), 2000),
      setTimeout(() => setStep(2), 5000),
      setTimeout(() => setStep(3), 8000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  return (
    <div className="w-full max-w-2xl mx-auto border border-white/10 bg-black/50 p-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-4">NexOS AI — Gestão de Acesso</div>
      <div className="border border-white/10 bg-zinc-900 p-4 flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">IG</div>
        <div className="flex-1">
          <div className="font-mono text-xs text-white">Instagram Business</div>
          <AnimatePresence>
            {step < 2 ? (
              <motion.div key="connected" className="font-mono text-[10px] text-emerald-400">● Conectado</motion.div>
            ) : step === 2 ? (
              <motion.div key="disco" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="font-mono text-[10px] text-yellow-400">Desconectando…</motion.div>
            ) : (
              <motion.div key="removed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="font-mono text-[10px] text-white/30">● Desconectado</motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {step < 2 && (
            <motion.button key="btn" exit={{ opacity: 0 }}
              className="font-mono text-[10px] border border-red-500/40 text-red-400 px-3 py-1 cursor-default">
              Desconectar
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {step >= 3 && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="border border-emerald-400/20 bg-emerald-400/5 p-3 font-mono text-[11px] space-y-1">
            <div className="text-emerald-400">✓ Token deletado do banco de dados</div>
            <div className="text-emerald-400">✓ NexOS não tem mais acesso ao Instagram</div>
            <div className="text-white/40">O usuário pode reconectar a qualquer momento</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MetaDemoVideo() {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [stepElapsed, setStepElapsed] = useState(0);
  const step = STEPS[currentStep]!;
  const stepDuration = step.duration;
  const progress = Math.min(stepElapsed / stepDuration, 1);

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      setElapsed(now - startTime);
      setStepElapsed(prev => {
        const next = prev + 50;
        if (next >= stepDuration && currentStep < STEPS.length - 1) {
          setCurrentStep(s => s + 1);
          return 0;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [currentStep, stepDuration]);

  const totalMs = STEPS.reduce((a, s) => a + s.duration, 0);
  const totalProgress = Math.min(elapsed / totalMs, 1);
  const totalSecs = Math.round(totalMs / 1000);
  const elapsedSecs = Math.round(elapsed / 1000);

  return (
    <div className={`min-h-screen bg-gradient-to-b ${step.bg} flex flex-col`}>
      {/* Top bar */}
      <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-purple-600 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">N</span>
          </div>
          <span className="font-mono text-xs text-white/60 uppercase tracking-widest">NexOS AI — Meta App Review</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-white/30">
            {currentStep + 1}/{STEPS.length} · {elapsedSecs}s / {totalSecs}s
          </span>
          <div className="w-24 h-1 bg-white/10 overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${totalProgress * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Step progress */}
      <ProgressBar progress={progress} color={step.accent} />

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-3xl"
          >
            {/* Step header */}
            <div className="text-center mb-6">
              <div className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: step.accent }}>
                Passo {currentStep + 1} de {STEPS.length}
              </div>
              <h2 className="font-mono text-xl font-bold text-white mb-1">{step.title}</h2>
              <p className="font-mono text-sm text-white/40">{step.subtitle}</p>
            </div>

            {/* Step content */}
            {step.id === "oauth"       && <OAuthStep      visible={currentStep === 1} />}
            {step.id === "campaign"    && <CampaignStep   visible={currentStep === 2} />}
            {step.id === "approval"    && <ApprovalStep   visible={currentStep === 3} />}
            {step.id === "publish"     && <PublishStep    visible={currentStep === 4} />}
            {step.id === "disconnect"  && <DisconnectStep visible={currentStep === 5} />}

            {step.id === "intro" && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-purple-600 flex items-center justify-center mx-auto text-2xl">N</div>
                <div className="font-mono text-xs text-white/40 space-y-1">
                  <div>App ID: 992748096543542</div>
                  <div>Permissões: instagram_content_publish · pages_manage_posts · instagram_basic</div>
                  <div>Privacy Policy: nexos.ai/privacy</div>
                </div>
              </div>
            )}

            {step.id === "end" && (
              <div className="text-center space-y-4">
                <div className="font-mono text-sm text-white/60 space-y-2">
                  <div>✓ OAuth 2.0 para autorização segura</div>
                  <div>✓ Publicação apenas com conteúdo aprovado pelo usuário</div>
                  <div>✓ Token deletado imediatamente ao desconectar</div>
                  <div>✓ Conformidade com LGPD e Política da Plataforma Meta</div>
                </div>
                <div className="font-mono text-xs text-white/30 mt-4">
                  nexos.ai/privacy · privacy@nexos.ai
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Step indicator dots */}
      <div className="flex justify-center gap-1.5 pb-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all ${i === currentStep ? "w-6" : "w-1.5"}`}
            style={{ background: i <= currentStep ? step.accent : "rgba(255,255,255,0.1)" }}
          />
        ))}
      </div>
    </div>
  );
}
