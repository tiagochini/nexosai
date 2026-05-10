import { useState, useEffect, useRef } from "react";
import nexosLogo from "/nexos-logo.png";
import {
  CheckCircle2, ArrowRight, Lock, Shield,
  Clock, Zap, BrainCircuit, Target, Activity,
  MessageSquare, X, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── CONFIGURAÇÃO DA ABERTURA — editar aqui antes de abrir o carrinho ──────────
const CART_CONFIG = {
  precoFundador: "R$297",          // preço especial das 24h de Fundador
  precoFundadorSufixo: "/mês",     // sufixo (ex: "/mês", "/ano", " à vista")
  precoCheio: "R$1.497",           // preço depois das 24h
  precoCheioSufixo: "/mês",
  horasFundador: 24,               // janela em horas
  cartUrl: "/comprar",             // URL do checkout
  vagas: 47,
};

// ─── Countdown de 24h real ────────────────────────────────────────────────────
function useCountdown(hours: number) {
  const storageKey = "nexos_cart_open_ts";
  const getOrSetTs = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return Number(saved);
      const ts = Date.now() + hours * 60 * 60 * 1000;
      localStorage.setItem(storageKey, String(ts));
      return ts;
    } catch { return Date.now() + hours * 60 * 60 * 1000; }
  };

  const [endsAt] = useState(getOrSetTs);
  const [remaining, setRemaining] = useState(endsAt - Date.now());

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, endsAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  const expired = remaining <= 0;
  return { h, m, s, expired };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center border border-primary/40 bg-primary/5 py-4 px-3 min-w-[72px]">
      <span className="font-mono font-black text-4xl md:text-5xl text-primary drop-shadow-[0_0_14px_hsl(var(--primary)/0.6)] tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

// ─── Anchor section — "aquele curso famoso de lançamento" ─────────────────────
function AnchorSection() {
  const comparisons = [
    {
      label: "O curso do maior especialista em lançamentos do Brasil",
      detalhe: "Você aprende a montar um lançamento. Executa você mesmo. Acesso por 1 ano.",
      preco: "R$10.000",
      sufixo: "por 1 ano de acesso",
      cor: "text-destructive/60",
      riscado: true,
    },
    {
      label: "Agência de lançamento completa",
      detalhe: "Contrato de 6 meses mínimo. Resultados em 90 dias.",
      preco: "R$15k–R$50k",
      sufixo: "por mês",
      cor: "text-destructive/60",
      riscado: true,
    },
    {
      label: "Copywriter sênior + gestor de tráfego + automação",
      detalhe: "3 fornecedores diferentes. Você gerencia todos.",
      preco: "R$13k–R$27k",
      sufixo: "por mês",
      cor: "text-destructive/60",
      riscado: true,
    },
  ];

  return (
    <section className="border-t border-border/20 bg-background/95 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">A COMPARAÇÃO QUE MUDA TUDO</div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
          Pagar R$10.000 para aprender<br />a lançar você mesmo.<br />
          <span className="text-primary">Ou pagar muito menos<br />para a IA lançar por você.</span>
        </h2>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-12">
          O curso de lançamento mais famoso do Brasil custa R$10.000 e te dá acesso por <strong className="text-foreground">1 ano</strong>. Você aprende cada etapa. Depois executa tudo sozinho — estratégia, copy, segmentação, disparos, carrinho. Semanas de trabalho por lançamento.{" "}
          <strong className="text-foreground">O NexOS AI faz tudo isso por você. Em 72 horas. Sem prazo de acesso vencendo.</strong>
        </p>

        <div className="space-y-3 mb-8">
          {comparisons.map((item, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-border/30 bg-card/20 px-5 py-4">
              <div className="flex-1">
                <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{item.label}</div>
                <div className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">{item.detalhe}</div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-mono font-black text-base ${item.cor} line-through`}>{item.preco}</div>
                <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">{item.sufixo}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-l-4 border-primary pl-6">
          <p className="font-mono text-base text-muted-foreground leading-relaxed">
            Nenhuma dessas opções é errada. Mas existe uma diferença brutal entre <strong className="text-foreground">aprender a lançar</strong> e <strong className="text-foreground">ter algo que lança por você</strong>.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Price reveal section ─────────────────────────────────────────────────────
function PriceRevealSection({ expired }: { expired: boolean }) {
  const { precoCheio, precoCheioSufixo, precoFundador, precoFundadorSufixo, cartUrl, vagas } = CART_CONFIG;
  const includes = [
    "29 agentes de IA executando 24h no seu lançamento",
    "Estratégia completa gerada em 47 minutos",
    "23 emails + 18 mensagens WhatsApp por campanha",
    "Segmentação comportamental atualizada em tempo real",
    "Abertura e fechamento automático de carrinho",
    "Dashboard ao vivo com health score e alertas de risco",
    "Acesso prioritário a todos os novos agentes",
    "Grupo privado de fundadores com suporte direto",
  ];

  return (
    <section className="border-t border-primary/20 auth-bg-gradient py-16 px-6" id="oferta">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4">
            {expired ? "OFERTA DE FUNDADOR ENCERRADA" : `OFERTA DE FUNDADOR · ${vagas} VAGAS`}
          </div>
          <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
            {expired ? (
              <>O carrinho está<br /><span className="text-destructive/80">no preço cheio.</span></>
            ) : (
              <>O carrinho abriu.<br /><span className="text-primary">Esse é o momento.</span></>
            )}
          </h2>
          {!expired && (
            <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Quem estava na lista chega primeiro — e paga o preço de Fundador. <strong className="text-foreground">Depois dessas 24 horas, essa condição fecha para sempre. Sem reabertura.</strong>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left — includes */}
          <div className="border border-primary/20 bg-primary/5 p-7">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-5">O que está incluso</div>
            <ul className="space-y-2.5 mb-8">
              {includes.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="font-mono text-xs text-foreground/80 leading-relaxed">{feat}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-primary/20 pt-5">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Custo equivalente no mercado</div>
              <div className="font-mono font-black text-2xl text-destructive/60 line-through">R$31.000 – R$83.000/mês</div>
            </div>
          </div>

          {/* Right — price + CTA */}
          <div className="flex flex-col gap-4">

            {/* Preço cheio */}
            <div className={`border ${expired ? "border-primary/30 bg-primary/5" : "border-border/30 bg-card/20"} p-6`}>
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                {expired ? "Preço atual" : "Preço após 24h"}
              </div>
              <div className={`font-mono font-black text-4xl mb-1 ${expired ? "text-foreground" : "text-muted-foreground/50 line-through"}`}>
                {precoCheio}
                <span className="text-xl font-normal ml-1">{precoCheioSufixo}</span>
              </div>
              {!expired && (
                <div className="font-mono text-[11px] text-muted-foreground/50">Disponível depois da janela de Fundador</div>
              )}
            </div>

            {/* Preço Fundador */}
            {!expired && (
              <div className="border-2 border-primary bg-primary/5 p-6 relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest bg-primary text-primary-foreground px-2 py-1 font-bold">
                    24H · FUNDADOR
                  </span>
                </div>
                <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-2">Preço de Fundador — agora</div>
                <div className="font-mono font-black text-5xl md:text-6xl text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)] mb-1">
                  {precoFundador}
                  <span className="text-2xl font-normal ml-1">{precoFundadorSufixo}</span>
                </div>
                <div className="font-mono text-xs text-muted-foreground mt-2">Nunca mais este valor. Sem cupom futuro. Sem reabertura.</div>
              </div>
            )}

            {/* CTA */}
            <a href={cartUrl}>
              <Button className={`w-full btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-base h-16 gap-3 ${expired ? "opacity-60" : ""}`}>
                {expired
                  ? <><Lock className="h-5 w-5" /> ENTRAR NO PREÇO CHEIO</>
                  : <><ArrowRight className="h-5 w-5" /> GARANTIR MEU ACESSO AGORA</>
                }
              </Button>
            </a>

            <div className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
              <Shield className="h-3 w-3" />
              Sem fidelidade · Cancela quando quiser · Acesso em 24h
            </div>

            {expired && (
              <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive/70 shrink-0 mt-0.5" />
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  A oferta de Fundador encerrou. O acesso ainda está disponível no preço cheio. Não há previsão de nova janela com condições especiais.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Features strip ───────────────────────────────────────────────────────────
function FeaturesStrip() {
  const feats = [
    { icon: BrainCircuit, label: "Estrategista IA", sub: "Cronograma completo em 47min" },
    { icon: Target,       label: "Copywriter IA",   sub: "23 copies por campanha" },
    { icon: MessageSquare,label: "Disparador IA",   sub: "WhatsApp + Email automático" },
    { icon: Activity,     label: "Analytics IA",    sub: "Health score em tempo real" },
  ];
  return (
    <section className="border-t border-border/20 bg-background py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {feats.map(({ icon: Icon, label, sub }) => (
            <div key={label} className="border border-primary/15 bg-primary/5 p-5 text-center">
              <Icon className="h-6 w-6 text-primary mx-auto mb-2" />
              <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-1">{label}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AberturaPage() {
  const { h, m, s, expired } = useCountdown(CART_CONFIG.horasFundador);
  const { precoFundador, precoFundadorSufixo, vagas, cartUrl } = CART_CONFIG;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={nexosLogo} alt="NexOS AI" className="h-12 w-12 object-contain" style={{ filter: "drop-shadow(0 0 12px hsl(var(--primary)/0.7))" }} />
            <div className="hidden sm:block">
              <div className="font-mono font-black text-lg tracking-[0.15em] uppercase">NexOS <span className="text-primary">AI</span></div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">Abertura do Carrinho</div>
            </div>
          </div>
          {!expired && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              <span className="font-mono text-xs uppercase tracking-widest text-destructive font-bold hidden sm:inline">
                Oferta encerra em {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
              </span>
            </div>
          )}
          <a href={cartUrl}>
            <Button size="sm" className="btn-weapon-primary rounded-none font-mono uppercase text-xs tracking-widest font-bold h-9 px-5">
              Garantir acesso
            </Button>
          </a>
        </div>
      </nav>

      {/* ── Hero — carrinho aberto ── */}
      <section className="pt-20 pb-16 px-6 auth-bg-gradient">
        <div className="max-w-5xl mx-auto pt-10">

          {/* Urgent badge */}
          <div className="inline-flex items-center gap-2 border border-destructive/40 bg-destructive/5 px-4 py-2 mb-8 font-mono text-xs uppercase tracking-[0.3em] text-destructive">
            <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            {expired ? "Oferta de Fundador encerrada · Preço cheio ativo" : `Carrinho aberto · ${vagas} vagas · Fundador por 24h`}
          </div>

          <h1 className="text-5xl md:text-8xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
            O carrinho<br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
              abriu.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl">
            Você estava na lista. Chegou primeiro. Agora tem{" "}
            <strong className="text-foreground">{CART_CONFIG.horasFundador} horas para garantir o preço de Fundador</strong>{" "}
            — um valor que não vai mais existir depois disso.
          </p>

          {/* Countdown */}
          {!expired ? (
            <div className="mb-10">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="h-3 w-3" /> Tempo restante para o preço de Fundador
              </div>
              <div className="flex items-center gap-2">
                <CountdownUnit value={h} label="horas" />
                <span className="font-mono font-black text-3xl text-primary/40">:</span>
                <CountdownUnit value={m} label="min" />
                <span className="font-mono font-black text-3xl text-primary/40">:</span>
                <CountdownUnit value={s} label="seg" />
              </div>
            </div>
          ) : (
            <div className="mb-10 border border-destructive/30 bg-destructive/5 inline-flex items-center gap-3 px-5 py-3">
              <X className="h-4 w-4 text-destructive/70" />
              <span className="font-mono text-sm text-foreground">A janela de Fundador encerrou. Preço cheio ativo.</span>
            </div>
          )}

          {/* Price highlight */}
          {!expired && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1">Preço de Fundador</div>
                <div className="font-mono font-black text-5xl text-primary drop-shadow-[0_0_16px_hsl(var(--primary)/0.5)]">
                  {precoFundador}<span className="text-2xl font-normal ml-1 text-muted-foreground">{precoFundadorSufixo}</span>
                </div>
              </div>
              <a href={cartUrl}>
                <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-base h-16 px-10 gap-3">
                  GARANTIR AGORA <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
            </div>
          )}

          <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground/50">
            <Zap className="h-4 w-4 text-primary/40" />
            Acesso liberado em 24h · Sem fidelidade · Cancela quando quiser
          </div>
        </div>
      </section>

      {/* ── Anchor: o curso do especialista ── */}
      <AnchorSection />

      {/* ── Features ── */}
      <FeaturesStrip />

      {/* ── Price reveal + CTA ── */}
      <PriceRevealSection expired={expired} />

      {/* ── Bottom strip ── */}
      <div className="border-t border-border/30 bg-muted/5 py-6 px-6 text-center">
        <p className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest">
          NexOS AI · Plataforma de Lançamento com IA
        </p>
      </div>
    </div>
  );
}
