import { useState, useEffect } from "react";
import nexosLogo from "/nexos-logo.png";
import {
  CheckCircle2, ArrowRight, Lock, Shield,
  Clock, Zap, AlertTriangle, X,
  TrendingDown, Users, BarChart2, Activity, ChevronRight, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const { precoFundador, precoFundadorSufixo, cartUrl } = CART_CONFIG;

  return (
    <section className="pt-20 pb-16 px-6 auth-bg-gradient">
      <div className="max-w-5xl mx-auto pt-10">

        <div className="inline-flex items-center gap-2 border border-destructive/40 bg-destructive/5 px-4 py-2 mb-8 font-mono text-xs uppercase tracking-[0.25em] text-destructive">
          <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
          {expired
            ? "A janela de Fundador encerrou — preço cheio ativo"
            : "Carrinho aberto · Preço de Fundador · 24h e fecha para sempre"
          }
        </div>

        <h1 className="text-6xl md:text-9xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
          O carrinho<br />
          <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
            abriu.
          </span>
        </h1>

        <p className="font-mono text-base md:text-lg text-muted-foreground leading-relaxed mb-4 max-w-2xl">
          Você estava na lista de espera. Chegou antes de todo mundo.{" "}
          <strong className="text-foreground">
            Agora tem {CART_CONFIG.horasFundador} horas para garantir o preço de Fundador.
          </strong>
        </p>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-10 max-w-2xl">
          Esse carrinho abre <strong className="text-foreground">uma única vez</strong> neste preço. Não existe reabertura, cupom futuro, condição especial posterior, nem negociação. Quando o contador chegar a zero, esse valor sai do ar para sempre.
        </p>

        {/* Countdown */}
        {!expired ? (
          <div className="mb-10">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Tempo restante para o preço de Fundador
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Digit v={h} label="horas" />
              <span className="font-mono font-black text-4xl text-primary/30">:</span>
              <Digit v={m} label="min" />
              <span className="font-mono font-black text-4xl text-primary/30">:</span>
              <Digit v={s} label="seg" />
            </div>
            <p className="font-mono text-xs text-destructive/70 uppercase tracking-widest">
              Cada segundo que passa é um segundo a menos para garantir este preço
            </p>
          </div>
        ) : (
          <div className="mb-10 border border-destructive/30 bg-destructive/5 inline-flex items-center gap-3 px-5 py-4">
            <X className="h-4 w-4 text-destructive/70 shrink-0" />
            <span className="font-mono text-sm text-foreground">A janela de Fundador encerrou. O acesso continua disponível no preço cheio.</span>
          </div>
        )}

        {/* Price + CTA */}
        {!expired && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">Preço de Fundador — agora</div>
              <div className="font-mono font-black text-5xl md:text-6xl text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">
                {precoFundador}
                <span className="text-2xl font-normal ml-2 text-muted-foreground">{precoFundadorSufixo}</span>
              </div>
            </div>
            <a href={cartUrl}>
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-base h-16 px-10 gap-3">
                GARANTIR AGORA <ArrowRight className="h-5 w-5" />
              </Button>
            </a>
          </div>
        )}

        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground/40">
          <Shield className="h-3.5 w-3.5" />
          Sem fidelidade · Cancela quando quiser · Acesso liberado em até 24h
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 2: TRANSFORMAÇÃO — Antes vs Depois ────────────────────────────────
function TransformacaoSection() {
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
    "IA responde objeções no WhatsApp enquanto você dorme.",
  ];

  return (
    <section className="border-t border-border/20 bg-background py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">A DIFERENÇA É CONCRETA</div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-12">
          Você conhece essa realidade.<br />
          <span className="text-primary">A outra começa quando você entra.</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-destructive/20 bg-destructive/5 p-7">
            <div className="flex items-center gap-2 mb-5">
              <X className="h-4 w-4 text-destructive/60" />
              <div className="font-mono text-xs uppercase tracking-widest text-destructive/70 font-bold">Hoje, sem o NexOS</div>
            </div>
            <ul className="space-y-3">
              {antes.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 border border-destructive/30 flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-1.5 h-0.5 bg-destructive/50" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-primary/30 bg-primary/5 p-7">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <div className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Com o NexOS</div>
            </div>
            <ul className="space-y-3">
              {depois.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="font-mono text-xs text-foreground/80 leading-relaxed">{item}</span>
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
        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-destructive/60 mb-6">O QUE VOCÊ PERDE CADA MÊS SEM ISSO</div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
          Não agir também<br />tem um preço.<br />
          <span className="text-destructive/80">Ele só não aparece na fatura.</span>
        </h2>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
          O custo da inação não é direto — é composto. Tempo perdido, leads esfriando, concorrentes acelerando, lançamentos adiados. Todo mês sem automação é um mês que você nunca recupera.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {itens.map(({ rotulo, custo, detalhe, icon: Icon }, i) => (
            <div key={i} className="border border-border/30 bg-card/20 p-6">
              <div className="flex items-start gap-3 mb-3">
                <Icon className="h-5 w-5 text-destructive/50 shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-0.5">{rotulo}</div>
                  <div className="font-mono text-xs text-destructive/70 font-bold">{custo}</div>
                </div>
              </div>
              <div className="border-l-2 border-border/40 pl-3 ml-8">
                <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{detalhe}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border border-primary/20 bg-primary/5 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Zap className="h-5 w-5 text-primary shrink-0" />
          <p className="font-mono text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">O custo invisível da inação supera o investimento no NexOS todo mês.</strong>{" "}
            A diferença é que um aparece na sua conta bancária e o outro não. Você só percebe quando olha pro ano inteiro e vê que fez metade do que planejou.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 4: ANCHOR ──────────────────────────────────────────────────────────
function AnchorSection() {
  return (
    <section className="border-t border-border/20 bg-background py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">A COMPARAÇÃO QUE MUDA TUDO</div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
          Pagar R$10.000 para<br />aprender a lançar você mesmo.<br />
          <span className="text-primary">Ou ter a agente lançando por você.</span>
        </h2>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
          O curso de lançamento mais famoso do Brasil custa R$10.000 e te dá acesso por 1 ano. Você assiste às aulas, aprende cada etapa, e então <strong className="text-foreground">executa tudo sozinho</strong> — estratégia, copy, segmentação, disparos, carrinho. Semanas de trabalho por lançamento.
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
                  <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-1.5">{item.label}</div>
                  <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{item.detalhe}</p>
                </div>
                <div className="text-right shrink-0 sm:ml-6">
                  <div className="font-mono font-black text-xl text-destructive/60 line-through">{item.preco}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest max-w-[160px] text-right">{item.sufixo}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-l-4 border-primary pl-6">
          <p className="font-mono text-base text-foreground font-bold leading-relaxed mb-2">
            Em todas as alternativas acima, você ainda é o executor.
          </p>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed">
            Você aprende, coordena, gerencia — ou paga alguém para fazer e ainda precisa gerenciar esse alguém. No NexOS, o agente executa. Você aprova. Essa diferença vale muito mais do que a diferença de preço entre qualquer uma das opções acima e o preço de Fundador de hoje.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 5: COMUNIDADE DOS FUNDADORES ──────────────────────────────────────
function ComunidadeSection() {
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
        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">O QUE VEM COM SER FUNDADOR</div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
          Não é só o preço.<br />
          <span className="text-primary">É o que o preço traz junto.</span>
        </h2>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
          Fundadores não são clientes comuns com desconto. São as pessoas que constroem o NexOS junto com a gente. Esse status não tem segunda chance — quando esse carrinho fechar, a próxima turma entra no preço cheio, sem grupo privado, sem onboarding individual, sem influência no roadmap.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {beneficios.map(({ icon: Icon, titulo, desc }, i) => (
            <div key={i} className="border border-primary/15 bg-primary/5 p-6 flex gap-4">
              <div className="w-10 h-10 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-1.5">{titulo}</div>
                <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
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
            <strong>Você não chegou até aqui por acaso.</strong> Você entrou na lista, acompanhou o aquecimento, tirou dúvidas — porque já decidiu que precisa disso. A única decisão que sobrou é:{" "}
            <strong className="text-primary">fazer hoje com o preço de Fundador</strong> — ou depois, sem esse preço, sem o grupo, sem o onboarding individual.{" "}
            O agente vai lançar seu produto de qualquer jeito. A questão é o quanto você vai pagar por isso.
          </p>
        </div>

        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4 text-center">
          {expired ? "OFERTA DE FUNDADOR ENCERRADA" : "OFERTA DE FUNDADOR · ÚNICA E DEFINITIVA"}
        </div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-10 text-center">
          {expired
            ? <><span className="text-destructive/80">A janela fechou.</span><br />Preço cheio ativo.</>
            : <>Esse é o momento.<br /><span className="text-primary">Esse é o único momento.</span></>
          }
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* O que está incluso */}
          <div className="border border-primary/20 bg-primary/5 p-7">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-5">Tudo que está incluso</div>
            <ul className="space-y-2.5 mb-8">
              {includes.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="font-mono text-xs text-foreground/80 leading-relaxed">{feat}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-primary/20 pt-5 space-y-1">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Custo equivalente no mercado</div>
              <div className="font-mono font-black text-2xl text-destructive/60 line-through">R$31.000 – R$83.000/mês</div>
              <div className="font-mono text-[10px] text-muted-foreground/40">Contratando tudo separado</div>
            </div>
          </div>

          {/* Price + CTA */}
          <div className="flex flex-col gap-4">
            {/* Preço cheio */}
            <div className={`border p-6 ${expired ? "border-primary/30 bg-primary/5" : "border-border/30 bg-card/20"}`}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                {expired ? "Preço atual" : "Preço após o encerramento da janela"}
              </div>
              <div className={`font-mono font-black text-4xl mb-1 ${expired ? "text-foreground" : "text-muted-foreground/40 line-through"}`}>
                {precoCheio}<span className="text-xl font-normal ml-1">{precoCheioSufixo}</span>
              </div>
              {!expired && <div className="font-mono text-[10px] text-muted-foreground/40">Entra em vigor assim que o contador zerar</div>}
            </div>

            {/* Preço Fundador */}
            {!expired && (
              <div className="border-2 border-primary bg-primary/5 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary px-3 py-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary-foreground font-bold">ÚNICO · FUNDADOR</span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2 mt-1">Preço de Fundador — agora</div>
                <div className="font-mono font-black text-5xl md:text-6xl text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)] mb-1">
                  {precoFundador}
                  <span className="text-2xl font-normal ml-2 text-muted-foreground">{precoFundadorSufixo}</span>
                </div>
                <div className="font-mono text-xs text-muted-foreground mt-2">
                  Este valor não volta. Nunca. Sem cupom futuro, sem reabertura, sem exceção.
                </div>
              </div>
            )}

            {/* CTA */}
            <a href={cartUrl}>
              <Button className={`w-full btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-base h-16 gap-3 ${expired ? "opacity-60" : ""}`}>
                {expired
                  ? <><Lock className="h-5 w-5" /> ACESSAR NO PREÇO CHEIO</>
                  : <><ArrowRight className="h-5 w-5" /> GARANTIR MEU ACESSO AGORA</>
                }
              </Button>
            </a>
            <div className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
              <Shield className="h-3 w-3" /> Sem fidelidade · Cancela quando quiser · Acesso em até 24h
            </div>

            {expired && (
              <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive/70 shrink-0 mt-0.5" />
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  A oferta de Fundador encerrou definitivamente. Não há previsão de nova condição especial. O acesso ainda está disponível no preço cheio.
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
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hidden sm:inline">Fundador encerra em</span>
              </div>
              <div className="font-mono font-black text-xl text-primary tabular-nums shrink-0">
                {fmt(h)}:{fmt(m)}:{fmt(s)}
              </div>
              <div className="hidden md:block border-l border-border/40 pl-4 shrink-0">
                <span className="font-mono text-sm font-black text-primary">{precoFundador}</span>
                <span className="font-mono text-xs text-muted-foreground ml-0.5">{precoFundadorSufixo}</span>
              </div>
            </div>
            <a href={cartUrl} className="shrink-0">
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-xs h-10 px-5 gap-2">
                GARANTIR ACESSO <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </a>
          </>
        ) : (
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <X className="h-3.5 w-3.5 text-destructive/60" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Oferta de Fundador encerrada · Preço cheio ativo</span>
            </div>
            <a href={cartUrl}>
              <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest font-bold text-xs h-9 px-5">
                VER ACESSO
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
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/60 leading-none">Abertura do Carrinho</div>
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
              Garantir acesso
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
          NexOS · Plataforma de Lançamento com o agente · contato@agencianexos.vip
        </p>
      </div>

      <StickyBar h={h} m={m} s={s} expired={expired} />
    </div>
  );
}
