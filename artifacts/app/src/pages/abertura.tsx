import { useState, useEffect } from "react";
import nexosLogo from "/nexos-logo.png";
import {
  CheckCircle2, ArrowRight, Lock, Shield,
  Clock, Zap, AlertTriangle, X,
  TrendingDown, Users, BarChart2, Activity, ChevronRight, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";

// ─── CONFIGURAÇÃO — editar aqui antes de abrir o carrinho ──────────────────────
const CART_CONFIG = {
  precoFundador:       "R$3.990",
  precoFundadorSufixo: " acesso único",
  precoCheio:          "R$9.990",
  precoCheioSufixo:    " acesso único",
  horasFundador:       24,       // janela real em horas
  cartUrl:             "/comprar",
};

// ─── Countdown real de 24h ────────────────────────────────────────────────────
function useCountdown(hours: number) {
  const key = "nexos_cart_open_ts";
  const getOrSetTs = () => {
    try {
      const s = localStorage.getItem(key);
      if (s) return Number(s);
      const ts = Date.now() + hours * 3_600_000;
      localStorage.setItem(key, String(ts));
      return ts;
    } catch { return Date.now() + hours * 3_600_000; }
  };
  const [endsAt] = useState(getOrSetTs);
  const [rem, setRem] = useState(endsAt - Date.now());
  useEffect(() => {
    const id = setInterval(() => setRem(Math.max(0, endsAt - Date.now())), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return {
    h: Math.floor(rem / 3_600_000),
    m: Math.floor((rem % 3_600_000) / 60_000),
    s: Math.floor((rem % 60_000) / 1_000),
    expired: rem <= 0,
  };
}

function Digit({ v, label }: { v: number; label: string }) {
  return (
    <div className="flex flex-col items-center border border-primary/40 bg-primary/5 py-4 px-4 min-w-[72px]">
      <span className="font-mono font-black text-4xl md:text-5xl text-primary drop-shadow-[0_0_14px_hsl(var(--primary)/0.6)] tabular-nums leading-none">
        {String(v).padStart(2, "0")}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mt-1.5">{label}</span>
    </div>
  );
}

// ─── SEÇÃO 1: HERO ────────────────────────────────────────────────────────────
function HeroSection({ h, m, s, expired }: { h: number; m: number; s: number; expired: boolean }) {
  const t = useUiText();
  const { precoFundador, precoFundadorSufixo, cartUrl } = CART_CONFIG;

  return (
    <section className="pt-20 pb-16 px-6 auth-bg-gradient">
      <div className="max-w-5xl mx-auto pt-10">

        <div className="inline-flex items-center gap-2 border border-destructive/40 bg-destructive/5 px-4 py-2 mb-8 font-mono text-xs uppercase tracking-[0.25em] text-destructive">
          <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
          {expired
            ? t("A janela de Fundador encerrou — preço cheio ativo", "The Founder window has closed — full price is now active", "La ventana de fundador terminó: ya está activo el precio completo")
            : t("Carrinho aberto · Preço de Fundador · 24h e fecha para sempre", "Cart open · Founder price · 24 hours, then it closes forever", "Carrito abierto · Precio de fundador · 24 horas y se cierra para siempre")
          }
        </div>

        <h1 className="text-6xl md:text-9xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
          {t("O carrinho", "The cart", "El carrito")}<br />
          <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
            {t("abriu.", "is open.", "está abierto.")}
          </span>
        </h1>

        <p className="font-mono text-base md:text-lg text-muted-foreground leading-relaxed mb-4 max-w-2xl">
          {t("Você estava na lista de espera. Chegou antes de todo mundo.", "You were on the waitlist. You got here before everyone else.", "Estabas en la lista de espera. Llegaste antes que los demás.")}{" "}
          <strong className="text-foreground">
            {t(`Agora tem ${CART_CONFIG.horasFundador} horas para garantir o preço de Fundador.`, `You now have ${CART_CONFIG.horasFundador} hours to lock in the Founder price.`, `Tienes ${CART_CONFIG.horasFundador} horas para asegurar el precio de fundador.`)}
          </strong>
        </p>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-10 max-w-2xl">
          {t("Esse carrinho abre ", "This cart opens ", "Este carrito se abre ")}<strong className="text-foreground">{t("uma única vez", "only once", "una sola vez")}</strong>{t(" neste preço. Não existe reabertura, cupom futuro, condição especial posterior, nem negociação. Quando o contador chegar a zero, esse valor sai do ar para sempre.", " at this price. There will be no reopening, future coupon, later special offer, or negotiation. When the countdown reaches zero, this price is gone forever.", " a este precio. No habrá reapertura, cupones futuros, ofertas especiales posteriores ni negociación. Cuando llegue a cero el contador, este precio desaparecerá para siempre.")}
        </p>

        {/* Countdown */}
        {!expired ? (
          <div className="mb-10">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> {t("Tempo restante para o preço de Fundador", "Time left to get the Founder price", "Tiempo restante para obtener el precio de fundador")}
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Digit v={h} label={t("horas", "hours", "horas")} />
              <span className="font-mono font-black text-4xl text-primary/30">:</span>
              <Digit v={m} label="min" />
              <span className="font-mono font-black text-4xl text-primary/30">:</span>
              <Digit v={s} label="seg" />
            </div>
            <p className="font-mono text-xs text-destructive/70 uppercase tracking-widest">
              {t("Cada segundo que passa é um segundo a menos para garantir este preço", "Every second that passes is one less second to secure this price", "Cada segundo que pasa es un segundo menos para asegurar este precio")}
            </p>
          </div>
        ) : (
          <div className="mb-10 border border-destructive/30 bg-destructive/5 inline-flex items-center gap-3 px-5 py-4">
            <X className="h-4 w-4 text-destructive/70 shrink-0" />
            <span className="font-mono text-sm text-foreground">{t("A janela de Fundador encerrou. O acesso continua disponível no preço cheio.", "The Founder window has closed. Access is still available at the full price.", "La ventana de fundador terminó. El acceso sigue disponible al precio completo.")}</span>
          </div>
        )}

        {/* Price + CTA */}
        {!expired && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">{t("Preço de Fundador — agora", "Founder price — now", "Precio de fundador — ahora")}</div>
              <div className="font-mono font-black text-5xl md:text-6xl text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">
                {precoFundador}
                <span className="text-2xl font-normal ml-2 text-muted-foreground">{t(precoFundadorSufixo, " one-time access", " acceso único")}</span>
              </div>
            </div>
            <a href={cartUrl}>
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-base h-16 px-10 gap-3">
                {t("GARANTIR AGORA", "SECURE ACCESS NOW", "ASEGURAR ACCESO AHORA")} <ArrowRight className="h-5 w-5" />
              </Button>
            </a>
          </div>
        )}

        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground/40">
          <Shield className="h-3.5 w-3.5" />
          {t("Sem fidelidade · Cancela quando quiser · Acesso liberado em até 24h", "No commitment · Cancel anytime · Access activated within 24 hours", "Sin permanencia · Cancela cuando quieras · Acceso en un máximo de 24 horas")}
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 2: TRANSFORMAÇÃO — Antes vs Depois ────────────────────────────────
function TransformacaoSection() {
  const t = useUiText();
  const antes = [
    "Janeiro vira março. Março vira junho. O ano passa com 1 lançamento feito.",
    "40h de trabalho por lançamento — copy, segmentação, disparos, carrinho, tudo manual.",
    "Acordar cedo pra escrever email de abertura antes do café esfriar.",
    "Reescrever a mesma copy 7 vezes sem saber se está boa o suficiente.",
    "Perder venda porque esqueceu de mandar o último email de escassez.",
    "Base de leads esfriando enquanto você ainda está montando a sequência.",
  ];
  const depois = [
    "Você responde 7 perguntas. Em 47 minutos, estratégia completa montada.",
    "23 emails + 18 mensagens WhatsApp gerados e agendados automaticamente.",
    "Carrinho abre e fecha no horário exato. Sem você tocar em nada.",
    "Base segmentada em tempo real: hot, warm, cold — cada grupo recebe copy diferente.",
    "Dashboard ao vivo mostra faturamento entrando. Você acompanha.",
    "Agente responde objeções no WhatsApp enquanto você dorme.",
  ];

  return (
    <section className="border-t border-border/20 bg-background py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">{t("A DIFERENÇA É CONCRETA", "THE DIFFERENCE IS REAL", "LA DIFERENCIA ES CONCRETA")}</div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-12">
          {t("Você conhece essa realidade.", "You know this reality.", "Conoces esta realidad.")}<br />
          <span className="text-primary">{t("A outra começa quando você entra.", "The alternative starts when you join.", "La otra empieza cuando te unes.")}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-destructive/20 bg-destructive/5 p-7">
            <div className="flex items-center gap-2 mb-5">
              <X className="h-4 w-4 text-destructive/60" />
              <div className="font-mono text-xs uppercase tracking-widest text-destructive/70 font-bold">{t("Hoje, sem o NexOS", "Today, without NexOS", "Hoy, sin NexOS")}</div>
            </div>
            <ul className="space-y-3">
              {antes.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 border border-destructive/30 flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-1.5 h-0.5 bg-destructive/50" />
                  </div>
                   <span className="font-mono text-xs text-muted-foreground leading-relaxed">{t(item, [
                     "January becomes March. March becomes June. The year passes with one launch completed.",
                     "40 hours of work per launch — copy, segmentation, sends, cart, all manual.",
                     "Waking up early to write the opening email before your coffee gets cold.",
                     "Rewriting the same copy seven times, never sure if it's good enough.",
                     "Losing a sale because you forgot to send the final scarcity email.",
                     "Your leads go cold while you're still building the sequence.",
                   ][i], [
                     "Enero se vuelve marzo. Marzo se vuelve junio. Pasa el año y solo hiciste un lanzamiento.",
                     "40 horas de trabajo por lanzamiento: textos, segmentación, envíos y carrito, todo manual.",
                     "Levantarte temprano para escribir el correo de apertura antes de que se enfríe el café.",
                     "Reescribir el mismo texto siete veces sin saber si ya está lo bastante bien.",
                     "Perder una venta por olvidar el último correo de escasez.",
                     "Tus leads se enfrían mientras todavía preparas la secuencia.",
                   ][i])}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-primary/30 bg-primary/5 p-7">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <div className="font-mono text-xs uppercase tracking-widest text-primary font-bold">{t("Com o NexOS", "With NexOS", "Con NexOS")}</div>
            </div>
            <ul className="space-y-3">
              {depois.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                   <span className="font-mono text-xs text-foreground/80 leading-relaxed">{t(item, [
                     "You answer seven questions. In 47 minutes, a complete strategy is ready.",
                     "23 emails + 18 WhatsApp messages generated and scheduled automatically.",
                     "The cart opens and closes at the exact time. No manual work needed.",
                     "Real-time segmentation: hot, warm, cold — each group gets different copy.",
                     "A live dashboard shows revenue coming in. You stay informed.",
                     "An agent answers WhatsApp objections while you sleep.",
                   ][i], [
                     "Respondes siete preguntas. En 47 minutos tienes una estrategia completa.",
                     "23 correos y 18 mensajes de WhatsApp generados y programados automáticamente.",
                     "El carrito abre y cierra a la hora exacta. Sin que tengas que hacer nada.",
                     "Segmentación en tiempo real: interesados, templados y fríos; cada grupo recibe textos distintos.",
                     "Un panel en vivo muestra cómo entran los ingresos. Tú solo supervisas.",
                     "Un agente responde objeciones por WhatsApp mientras duermes.",
                   ][i])}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 3: CUSTO DE NÃO AGIR ───────────────────────────────────────────────
function CustoInacaoSection() {
  const t = useUiText();
  const itens = [
    {
      rotulo: "1 lançamento manual por mês",
      custo: "40h do seu tempo × 12 meses = 480h/ano",
      detalhe: "Se o seu tempo vale R$200/h → R$96.000 desperdiçados executando o que a agente faria por você",
      icon: Clock,
    },
    {
      rotulo: "Leads esfriando na base",
      custo: "Taxa de conversão cai 30% a cada semana sem nurturing",
      detalhe: "Uma base de 2.000 leads sem sequência automatizada é dinheiro apodrecendo em silêncio",
      icon: TrendingDown,
    },
    {
      rotulo: "Copy feita sem otimização",
      custo: "1–3% de conversão quando poderia ser 4–8%",
      detalhe: "Em R$10k de tráfego: a diferença entre copy manual e copy otimizada pelo agente é R$300–R$500 em vendas",
      icon: BarChart2,
    },
    {
      rotulo: "Concorrente que já automatizou",
      custo: "Ele lança 6× ao ano. Você lança 1×.",
      detalhe: "Cada mês de atraso é 1 lançamento que ele fez e você não. Em 12 meses, ele está 5 lançamentos à frente",
      icon: Activity,
    },
  ];

  return (
    <section className="border-t border-border/20 bg-background/95 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-destructive/60 mb-6">{t("O QUE VOCÊ PERDE CADA MÊS SEM ISSO", "WHAT YOU LOSE EVERY MONTH WITHOUT THIS", "LO QUE PIERDES CADA MES SIN ESTO")}</div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
          {t("Não agir também", "Inaction also", "No actuar también")}<br />{t("tem um preço.", "has a price.", "tiene un precio.")}<br />
          <span className="text-destructive/80">{t("Ele só não aparece na fatura.", "It just doesn't show up on your bill.", "Solo que no aparece en la factura.")}</span>
        </h2>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
          {t("O custo da inação não é direto — é composto. Tempo perdido, leads esfriando, concorrentes acelerando, lançamentos adiados. Todo mês sem automação é um mês que você nunca recupera.", "The cost of inaction is indirect but cumulative: lost time, cold leads, faster competitors, delayed launches. Every month without automation is a month you never get back.", "El costo de no actuar es indirecto, pero acumulativo: tiempo perdido, leads que se enfrían, competidores que avanzan y lanzamientos aplazados. Cada mes sin automatización es un mes que no recuperarás.")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {itens.map(({ rotulo, custo, detalhe, icon: Icon }, i) => (
            <div key={i} className="border border-border/30 bg-card/20 p-6">
              <div className="flex items-start gap-3 mb-3">
                <Icon className="h-5 w-5 text-destructive/50 shrink-0 mt-0.5" />
                <div>
                   <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-0.5">{t(rotulo, ["One manual launch per month", "Leads going cold", "Unoptimised copy", "A competitor who has already automated"][i], ["1 lanzamiento manual al mes", "Leads que se enfrían", "Textos sin optimizar", "Un competidor que ya automatizó"][i])}</div>
                   <div className="font-mono text-xs text-destructive/70 font-bold">{t(custo, ["40 hours of your time × 12 months = 480 hours/year", "Conversion rate drops 30% for every week without nurturing", "1–3% conversion when it could be 4–8%", "They launch 6× a year. You launch once."][i], ["40 horas de tu tiempo × 12 meses = 480 horas/año", "La conversión cae un 30 % por cada semana sin nutrición", "1–3 % de conversión cuando podría ser 4–8 %", "Lanza 6 veces al año. Tú, una."][i])}</div>
                </div>
              </div>
              <div className="border-l-2 border-border/40 pl-3 ml-8">
                 <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{t(detalhe, [
                   "If your time is worth R$200/hour → R$96,000 wasted doing what the agent could do for you",
                   "A database of 2,000 leads without an automated sequence is money quietly going to waste",
                   "With R$10k in ad spend, the difference between manual and agent-optimised copy is R$300–R$500 in sales",
                   "Every month of delay is one launch they completed and you didn't. In 12 months, they're five launches ahead",
                 ][i], [
                   "Si tu hora vale R$200 → R$96.000 desperdiciados en tareas que el agente haría por ti",
                   "Una base de 2.000 leads sin secuencia automatizada es dinero que se pierde en silencio",
                   "Con R$10k en publicidad, la diferencia entre textos manuales y optimizados por el agente es de R$300–R$500 en ventas",
                   "Cada mes de retraso es un lanzamiento que ellos hicieron y tú no. En 12 meses te llevan cinco lanzamientos de ventaja",
                 ][i])}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border border-primary/20 bg-primary/5 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Zap className="h-5 w-5 text-primary shrink-0" />
          <p className="font-mono text-sm text-muted-foreground leading-relaxed">
             <strong className="text-foreground">{t("O custo invisível da inação supera o investimento no NexOS todo mês.", "The hidden cost of inaction exceeds the NexOS investment every month.", "El costo invisible de no actuar supera cada mes la inversión en NexOS.")}</strong>{" "}
             {t("A diferença é que um aparece na sua conta bancária e o outro não. Você só percebe quando olha pro ano inteiro e vê que fez metade do que planejou.", "The difference is that one shows up in your bank account and the other doesn't. You only notice when you look back at the year and see you did half of what you planned.", "La diferencia es que uno aparece en tu cuenta bancaria y el otro no. Solo te das cuenta al mirar el año y ver que hiciste la mitad de lo que planeabas.")}
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 4: ANCHOR ──────────────────────────────────────────────────────────
function AnchorSection() {
  const t = useUiText();
  const comparisonCopy: [string, string, string, string, string, string][] = [
    ["Brazil's most famous launch course", "El curso de lanzamientos más famoso de Brasil", "You learn. You execute. R$10,000 buys the knowledge — the execution is still yours.", "Aprendes. Ejecutas. R$10.000 por el conocimiento; la ejecución sigue siendo tuya.", "1-year access · you do all the work", "acceso por 1 año · tú haces todo"],
    ["Full-service launch agency", "Agencia de lanzamientos integral", "Minimum 6-month contract. Weekly meetings. You still manage relationships with 3–5 suppliers.", "Contrato mínimo de 6 meses. Reuniones semanales. Aún gestionas la relación con 3–5 proveedores.", "per month · long contract", "al mes · contrato largo"],
    ["Copywriter + traffic manager + automation", "Copywriter + gestor de tráfico + automatización", "3 separate suppliers. 3 points of failure. You coordinate everything in between, with no real integration.", "3 proveedores separados. 3 puntos de falla. Tú coordinas todo, sin integración real entre ellos.", "per month · 3 suppliers", "al mes · 3 proveedores"],
  ];
  return (
    <section className="border-t border-border/20 bg-background py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">{t("A COMPARAÇÃO QUE MUDA TUDO", "THE COMPARISON THAT CHANGES EVERYTHING", "LA COMPARACIÓN QUE LO CAMBIA TODO")}</div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
          {t("Pagar R$10.000 para", "Pay R$10,000 to", "Pagar R$10.000 para")}<br />{t("aprender a lançar você mesmo.", "learn to launch on your own.", "aprender a lanzar por tu cuenta.")}<br />
          <span className="text-primary">{t("Ou ter a agente lançando por você.", "Or have an agent launch for you.", "O dejar que un agente lance por ti.")}</span>
        </h2>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
          {t("O curso de lançamento mais famoso do Brasil custa R$10.000 e te dá acesso por 1 ano. Você assiste às aulas, aprende cada etapa, e então ", "Brazil's most famous launch course costs R$10,000 and gives you access for one year. You watch the lessons, learn each step, and then ", "El curso de lanzamientos más famoso de Brasil cuesta R$10.000 y te da acceso por un año. Ves las clases, aprendes cada etapa y después ")}<strong className="text-foreground">{t("executa tudo sozinho", "do everything yourself", "lo ejecutas todo por tu cuenta")}</strong>{t(" — estratégia, copy, segmentação, disparos, carrinho. Semanas de trabalho por lançamento.", " — strategy, copy, segmentation, sends, cart. Weeks of work per launch.", ": estrategia, textos, segmentación, envíos y carrito. Semanas de trabajo por lanzamiento.")}
        </p>
        <div className="space-y-4 mb-10">
          {[
            {
              label: "O curso mais famoso de lançamentos do Brasil",
              detalhe: "Você aprende. Você executa. R$10.000 para ter o conhecimento — a execução ainda é sua.",
              preco: "R$10.000",
              sufixo: "acesso por 1 ano · você executa tudo",
            },
            {
              label: "Agência de lançamento completa",
              detalhe: "Contrato mínimo de 6 meses. Reuniões semanais. Você ainda gerencia o relacionamento com 3 a 5 fornecedores.",
              preco: "R$15k–R$50k",
              sufixo: "por mês · contrato longo",
            },
            {
              label: "Copywriter + gestor de tráfego + automação",
              detalhe: "3 fornecedores separados. 3 pontos de falha. Você no meio coordenando tudo. Sem integração real entre eles.",
              preco: "R$13k–R$27k",
              sufixo: "por mês · 3 fornecedores",
            },
          ].map((item, i) => (
            <div key={i} className="border border-border/30 bg-card/20 p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-1.5">{t(item.label, comparisonCopy[i][0], comparisonCopy[i][1])}</div>
                  <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{t(item.detalhe, comparisonCopy[i][2], comparisonCopy[i][3])}</p>
                </div>
                <div className="text-right shrink-0 sm:ml-6">
                  <div className="font-mono font-black text-xl text-destructive/60 line-through">{item.preco}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest max-w-[160px] text-right">{t(item.sufixo, comparisonCopy[i][4], comparisonCopy[i][5])}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-l-4 border-primary pl-6">
          <p className="font-mono text-base text-foreground font-bold leading-relaxed mb-2">
            {t("Em todas as alternativas acima, você ainda é o executor.", "With every option above, you are still the one doing the work.", "Con todas las alternativas anteriores, tú sigues siendo quien ejecuta.")}
          </p>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed">
            {t("Você aprende, coordena, gerencia — ou paga alguém para fazer e ainda precisa gerenciar esse alguém. No NexOS, o agente executa. Você aprova. Essa diferença vale muito mais do que a diferença de preço entre qualquer uma das opções acima e o preço de Fundador de hoje.", "You learn, coordinate, and manage — or pay someone to do the work and still manage them. With NexOS, the agent executes and you approve. That difference is worth far more than the price gap between any option above and today's Founder price.", "Aprendes, coordinas y gestionas, o pagas a alguien para hacerlo y aun así debes gestionarlo. Con NexOS, el agente ejecuta y tú apruebas. Esa diferencia vale mucho más que la diferencia de precio entre cualquiera de las opciones y el precio de fundador de hoy.")}
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 5: COMUNIDADE DOS FUNDADORES ──────────────────────────────────────
function ComunidadeSection() {
  const t = useUiText();
  const beneficios = [
    {
      icon: Star,
      titulo: "Status de Fundador permanente",
      desc: "Seu acesso fica marcado como Fundador na plataforma — para sempre. Quando novos usuários entrarem pagando o preço cheio, você mantém o preço e o status. Sem renegociação futura.",
    },
    {
      icon: Users,
      titulo: "Grupo privado dos Fundadores",
      desc: "Canal direto com o time de produto. Nenhum usuário comum tem acesso. Você reporta, sugere e influencia o roadmap antes de todo mundo. Suas campanhas moldam o que a agente aprende.",
    },
    {
      icon: Zap,
      titulo: "Acesso antecipado a novos agentes",
      desc: "Cada novo agente que lançarmos vai para os Fundadores primeiro. Você testa, opera e já usa enquanto o restante da base ainda está na fila de espera.",
    },
    {
      icon: ChevronRight,
      titulo: "Onboarding individual com o time",
      desc: "Não é vídeo gravado. É uma sessão ao vivo para configurar sua primeira campanha. Você sai do onboarding com tudo rodando — não só com acesso.",
    },
  ];

  return (
    <section className="border-t border-border/20 bg-background/95 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">{t("O QUE VEM COM SER FUNDADOR", "WHAT COMES WITH BEING A FOUNDER", "LO QUE INCLUYE SER FUNDADOR")}</div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
          {t("Não é só o preço.", "It's not just the price.", "No es solo el precio.")}<br />
          <span className="text-primary">{t("É o que o preço traz junto.", "It's what comes with it.", "Es todo lo que incluye.")}</span>
        </h2>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
          {t("Fundadores não são clientes comuns com desconto. São as pessoas que constroem o NexOS junto com a gente. Esse status não tem segunda chance — quando esse carrinho fechar, a próxima turma entra no preço cheio, sem grupo privado, sem onboarding individual, sem influência no roadmap.", "Founders aren't ordinary customers with a discount. They're the people building NexOS with us. This status is a one-time opportunity — when this cart closes, the next cohort pays full price, without a private group, individual onboarding, or influence over the roadmap.", "Los fundadores no son clientes comunes con descuento. Son quienes construyen NexOS con nosotros. Esta oportunidad no se repetirá: cuando se cierre el carrito, la próxima edición pagará el precio completo, sin grupo privado, onboarding individual ni influencia en la hoja de ruta.")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {beneficios.map(({ icon: Icon, titulo, desc }, i) => (
            <div key={i} className="border border-primary/15 bg-primary/5 p-6 flex gap-4">
              <div className="w-10 h-10 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                 <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-1.5">{t(titulo, ["Permanent Founder status", "Private Founders Group", "Early access to new agents", "Individual onboarding with the team"][i], ["Estatus permanente de fundador", "Grupo privado de fundadores", "Acceso anticipado a nuevos agentes", "Onboarding individual con el equipo"][i])}</div>
                 <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{t(desc, [
                   "Your access is marked as Founder on the platform — forever. When new users join at the full price, you keep your price and status. No future renegotiation.",
                   "Direct channel with the product team. No regular user has access. Share feedback, make suggestions, and influence the roadmap first. Your campaigns shape what the agent learns.",
                   "Every new agent we launch goes to Founders first. You test, operate, and use it while everyone else is still on the waitlist.",
                   "Not a recorded video. A live session to configure your first campaign. You finish onboarding with everything running — not just access.",
                 ][i], [
                   "Tu acceso quedará marcado como fundador en la plataforma para siempre. Cuando lleguen nuevos usuarios al precio completo, conservarás tu precio y estatus. Sin renegociaciones futuras.",
                   "Canal directo con el equipo de producto, exclusivo para fundadores. Comparte sugerencias e influye en la hoja de ruta antes que nadie. Tus campañas ayudan a mejorar el agente.",
                   "Cada nuevo agente estará primero disponible para los fundadores. Podrás probarlo y usarlo mientras los demás siguen en lista de espera.",
                   "No es un video grabado: es una sesión en vivo para configurar tu primera campaña. Terminarás el onboarding con todo funcionando, no solo con acceso.",
                 ][i])}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 6: COMPROMETIMENTO + OFERTA FINAL ─────────────────────────────────
function OfertaSection({ expired }: { expired: boolean }) {
  const t = useUiText();
  const { precoCheio, precoCheioSufixo, precoFundador, precoFundadorSufixo, cartUrl } = CART_CONFIG;
  const includes = [
    "57 especialistas executando 24h no seu lançamento",
    "Estratégia completa gerada em 47 minutos",
    "23 emails + 18 mensagens WhatsApp por campanha",
    "Segmentação comportamental atualizada em tempo real",
    "Abertura e fechamento automático de carrinho",
    "Dashboard ao vivo com health score e alertas de risco",
    "Acesso prioritário a todos os novos agentes",
    "Onboarding individual + grupo privado de Fundadores",
  ];

  return (
    <section className="border-t border-primary/20 auth-bg-gradient py-16 px-6 pb-32" id="oferta">
      <div className="max-w-5xl mx-auto">

        {/* Comprometimento */}
        <div className="border border-primary/20 bg-primary/5 px-7 py-6 mb-12">
          <p className="font-mono text-base text-foreground leading-relaxed">
            <strong>{t("Você não chegou até aqui por acaso.", "You didn't get this far by accident.", "No llegaste hasta aquí por casualidad.")}</strong> {t("Você entrou na lista, acompanhou o aquecimento, tirou dúvidas — porque já decidiu que precisa disso. A única decisão que sobrou é:", "You joined the list, followed the warm-up, and asked questions because you've already decided you need this. The only decision left is whether to ", "Te apuntaste a la lista, seguiste el calentamiento y resolviste tus dudas porque ya decidiste que lo necesitas. La única decisión que queda es ")}{" "}
            <strong className="text-primary">{t("fazer hoje com o preço de Fundador", "act today at the Founder price", "actuar hoy con el precio de fundador")}</strong>{t(" — ou depois, sem esse preço, sem o grupo, sem o onboarding individual. ", " — or wait until later without this price, the group, or individual onboarding. ", " — o esperar, sin este precio, el grupo ni el onboarding individual. ")}
            {t("O agente vai lançar seu produto de qualquer jeito. A questão é o quanto você vai pagar por isso.", "The agent will launch your product either way. The question is how much you'll pay for it.", "El agente lanzará tu producto de cualquier manera. La pregunta es cuánto pagarás por ello.")}
          </p>
        </div>

        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4 text-center">
          {expired ? t("OFERTA DE FUNDADOR ENCERRADA", "FOUNDER OFFER CLOSED", "OFERTA DE FUNDADOR CERRADA") : t("OFERTA DE FUNDADOR · ÚNICA E DEFINITIVA", "FOUNDER OFFER · ONE TIME ONLY", "OFERTA DE FUNDADOR · ÚNICA Y DEFINITIVA")}
        </div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-10 text-center">
          {expired
            ? <><span className="text-destructive/80">{t("A janela fechou.", "The window has closed.", "La ventana se cerró.")}</span><br />{t("Preço cheio ativo.", "Full price now active.", "Precio completo activo.")}</>
            : <>{t("Esse é o momento.", "This is the moment.", "Este es el momento.")}<br /><span className="text-primary">{t("Esse é o único momento.", "This is the only moment.", "Este es el único momento.")}</span></>
          }
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* O que está incluso */}
          <div className="border border-primary/20 bg-primary/5 p-7">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-5">{t("Tudo que está incluso", "Everything included", "Todo lo que incluye")}</div>
            <ul className="space-y-2.5 mb-8">
              {includes.map((feat, i) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                   <span className="font-mono text-xs text-foreground/80 leading-relaxed">{t(feat, [
                     "57 specialists working on your launch around the clock",
                     "Complete strategy generated in 47 minutes",
                     "23 emails + 18 WhatsApp messages per campaign",
                     "Behavioural segmentation updated in real time",
                     "Automatic cart opening and closing",
                     "Live dashboard with health score and risk alerts",
                     "Priority access to all new agents",
                     "Individual onboarding + private Founders Group",
                   ][i], [
                     "57 especialistas trabajando las 24 horas en tu lanzamiento",
                     "Estrategia completa generada en 47 minutos",
                     "23 correos y 18 mensajes de WhatsApp por campaña",
                     "Segmentación por comportamiento actualizada en tiempo real",
                     "Apertura y cierre automático del carrito",
                     "Panel en vivo con indicadores de salud y alertas de riesgo",
                     "Acceso prioritario a todos los nuevos agentes",
                     "Onboarding individual + grupo privado de fundadores",
                   ][i])}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-primary/20 pt-5 space-y-1">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Custo equivalente no mercado", "Equivalent market cost", "Costo equivalente en el mercado")}</div>
              <div className="font-mono font-black text-2xl text-destructive/60 line-through">R$31.000 – R$83.000/mês</div>
              <div className="font-mono text-[10px] text-muted-foreground/40">{t("Contratando tudo separado", "If you hired each service separately", "Si contrataras cada servicio por separado")}</div>
            </div>
          </div>

          {/* Price + CTA */}
          <div className="flex flex-col gap-4">
            {/* Preço cheio */}
            <div className={`border p-6 ${expired ? "border-primary/30 bg-primary/5" : "border-border/30 bg-card/20"}`}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                {expired ? t("Preço atual", "Current price", "Precio actual") : t("Preço após o encerramento da janela", "Price after the window closes", "Precio tras el cierre de la ventana")}
              </div>
              <div className={`font-mono font-black text-4xl mb-1 ${expired ? "text-foreground" : "text-muted-foreground/40 line-through"}`}>
                {precoCheio}<span className="text-xl font-normal ml-1">{precoCheioSufixo}</span>
              </div>
              {!expired && <div className="font-mono text-[10px] text-muted-foreground/40">{t("Entra em vigor assim que o contador zerar", "Takes effect as soon as the countdown reaches zero", "Entra en vigor cuando el contador llegue a cero")}</div>}
            </div>

            {/* Preço Fundador */}
            {!expired && (
              <div className="border-2 border-primary bg-primary/5 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary px-3 py-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary-foreground font-bold">{t("ÚNICO · FUNDADOR", "ONE TIME · FOUNDER", "ÚNICO · FUNDADOR")}</span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2 mt-1">{t("Preço de Fundador — agora", "Founder price — now", "Precio de fundador — ahora")}</div>
                <div className="font-mono font-black text-5xl md:text-6xl text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)] mb-1">
                  {precoFundador}
                  <span className="text-2xl font-normal ml-2 text-muted-foreground">{t(precoFundadorSufixo, " one-time access", " acceso único")}</span>
                </div>
                <div className="font-mono text-xs text-muted-foreground mt-2">
                  {t("Este valor não volta. Nunca. Sem cupom futuro, sem reabertura, sem exceção.", "This price will never return. No future coupon, reopening, or exceptions.", "Este precio no volverá. Nunca. Sin cupones futuros, reaperturas ni excepciones.")}
                </div>
              </div>
            )}

            {/* CTA */}
            <a href={cartUrl}>
              <Button className={`w-full btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-base h-16 gap-3 ${expired ? "opacity-60" : ""}`}>
                {expired
                  ? <><Lock className="h-5 w-5" /> {t("ACESSAR NO PREÇO CHEIO", "GET ACCESS AT FULL PRICE", "ACCEDER AL PRECIO COMPLETO")}</>
                  : <><ArrowRight className="h-5 w-5" /> {t("GARANTIR MEU ACESSO AGORA", "SECURE MY ACCESS NOW", "ASEGURAR MI ACCESO AHORA")}</>
                }
              </Button>
            </a>
            <div className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
              <Shield className="h-3 w-3" /> {t("Sem fidelidade · Cancela quando quiser · Acesso em até 24h", "No commitment · Cancel anytime · Access within 24 hours", "Sin permanencia · Cancela cuando quieras · Acceso en un máximo de 24 h")}
            </div>

            {expired && (
              <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive/70 shrink-0 mt-0.5" />
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  {t("A oferta de Fundador encerrou definitivamente. Não há previsão de nova condição especial. O acesso ainda está disponível no preço cheio.", "The Founder offer has permanently ended. No new special offer is planned. Access is still available at the full price.", "La oferta de fundador terminó definitivamente. No hay prevista otra oferta especial. El acceso sigue disponible al precio completo.")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── STICKY BAR ───────────────────────────────────────────────────────────────
function StickyBar({ h, m, s, expired }: { h: number; m: number; s: number; expired: boolean }) {
  const t = useUiText();
  const { precoFundador, precoFundadorSufixo, cartUrl } = CART_CONFIG;
  const fmt = (v: number) => String(v).padStart(2, "0");

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-primary/30 bg-background/96 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {!expired ? (
          <>
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hidden sm:inline">{t("Fundador encerra em", "Founder offer ends in", "La oferta de fundador termina en")}</span>
              </div>
              <div className="font-mono font-black text-xl text-primary tabular-nums shrink-0">
                {fmt(h)}:{fmt(m)}:{fmt(s)}
              </div>
              <div className="hidden md:block border-l border-border/40 pl-4 shrink-0">
                <span className="font-mono text-sm font-black text-primary">{precoFundador}</span>
                <span className="font-mono text-xs text-muted-foreground ml-0.5">{t(precoFundadorSufixo, " one-time access", " acceso único")}</span>
              </div>
            </div>
            <a href={cartUrl} className="shrink-0">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-xs h-10 px-5 gap-2">
                {t("GARANTIR ACESSO", "SECURE ACCESS", "ASEGURAR ACCESO")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </a>
          </>
        ) : (
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <X className="h-3.5 w-3.5 text-destructive/60" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Oferta de Fundador encerrada · Preço cheio ativo", "Founder offer closed · Full price active", "Oferta de fundador cerrada · Precio completo activo")}</span>
            </div>
            <a href={cartUrl}>
              <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest font-bold text-xs h-9 px-5">
                {t("VER ACESSO", "VIEW ACCESS", "VER ACCESO")}
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function AberturaPage() {
  const t = useUiText();
  const { h, m, s, expired } = useCountdown(CART_CONFIG.horasFundador);
  const { cartUrl } = CART_CONFIG;
  const fmt = (v: number) => String(v).padStart(2, "0");

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={nexosLogo} alt="NexOS" className="h-10 w-10 object-contain" style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary)/0.7))" }} />
            <div className="hidden sm:block">
              <div className="font-mono font-black text-base tracking-[0.15em] uppercase leading-none">NexOS</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/60 leading-none">{t("Abertura do carrinho", "Cart opening", "Apertura del carrito")}</div>
            </div>
          </div>
          {!expired && (
            <div className="flex items-center gap-2 border border-destructive/30 bg-destructive/5 px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-destructive font-bold tabular-nums">
                {fmt(h)}:{fmt(m)}:{fmt(s)}
              </span>
            </div>
          )}
          <a href={cartUrl}>
            <Button size="sm" className="btn-weapon-primary rounded-none font-mono uppercase text-[10px] tracking-widest font-bold h-8 px-4">
              {t("Garantir acesso", "Secure access", "Asegurar acceso")}
            </Button>
          </a>
        </div>
      </nav>

      <HeroSection h={h} m={m} s={s} expired={expired} />
      <TransformacaoSection />
      <CustoInacaoSection />
      <AnchorSection />
      <ComunidadeSection />
      <OfertaSection expired={expired} />

      <div className="border-t border-border/30 bg-muted/5 py-5 px-6 text-center mb-16">
        <p className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest">
          {t("NexOS · Plataforma de Lançamento com o agente · contato@agencianexos.vip", "NexOS · Agent-powered launch platform · contato@agencianexos.vip", "NexOS · Plataforma de lanzamientos con agentes · contato@agencianexos.vip")}
        </p>
      </div>

      <StickyBar h={h} m={m} s={s} expired={expired} />
    </div>
  );
}
