import { useState, useEffect } from "react";
import nexosLogo from "/nexos-logo.png";
import {
  CheckCircle2, ArrowRight, Lock, Shield,
  Clock, Zap, BrainCircuit, Target, Activity,
  MessageSquare, X, AlertTriangle, TrendingDown,
  Users, Star, ChevronRight, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── CONFIGURAÇÃO — editar aqui antes de abrir o carrinho ──────────────────────
const CART_CONFIG = {
  precoFundador:       "R$297",
  precoFundadorSufixo: "/mês",
  precoCheio:          "R$1.497",
  precoCheioSufixo:    "/mês",
  horasFundador:       24,
  cartUrl:             "/comprar",
  vagas:               47,
  vagasRestantes:      31,     // atualizar conforme entradas
};

// ─── Countdown ────────────────────────────────────────────────────────────────
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
    <div className="flex flex-col items-center border border-primary/40 bg-primary/5 py-3 px-3 min-w-[64px]">
      <span className="font-mono font-black text-3xl md:text-4xl text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)] tabular-nums leading-none">
        {String(v).padStart(2, "0")}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mt-1">{label}</span>
    </div>
  );
}

// ─── Atividade social ao vivo (simulada) ──────────────────────────────────────
const CITIES = ["São Paulo", "Belo Horizonte", "Curitiba", "Fortaleza", "Recife", "Florianópolis", "Porto Alegre", "Goiânia"];
function useSocialFeed() {
  const [feed, setFeed] = useState<{ name: string; city: string; ago: number }[]>([]);
  useEffect(() => {
    const names = ["Carlos M.", "Amanda R.", "Felipe S.", "Juliana T.", "Rodrigo A.", "Mariana L.", "Bruno C.", "Patrícia N."];
    const addEntry = () => {
      const entry = {
        name: names[Math.floor(Math.random() * names.length)],
        city: CITIES[Math.floor(Math.random() * CITIES.length)],
        ago: Math.floor(Math.random() * 12) + 1,
      };
      setFeed(prev => [entry, ...prev].slice(0, 3));
    };
    addEntry();
    const id = setInterval(addEntry, 18_000 + Math.random() * 12_000);
    return () => clearInterval(id);
  }, []);
  return feed;
}

// ─── SEÇÃO 1: HERO ────────────────────────────────────────────────────────────
function HeroSection({ h, m, s, expired }: { h: number; m: number; s: number; expired: boolean }) {
  const feed = useSocialFeed();
  const { precoFundador, precoFundadorSufixo, cartUrl, vagasRestantes } = CART_CONFIG;

  return (
    <section className="pt-20 pb-16 px-6 auth-bg-gradient">
      <div className="max-w-5xl mx-auto pt-8">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 border border-destructive/40 bg-destructive/5 px-4 py-2 mb-8 font-mono text-xs uppercase tracking-[0.25em] text-destructive">
          <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
          {expired ? "Oferta de Fundador encerrada" : `Carrinho aberto · ${vagasRestantes} vagas restantes · Fundador por 24h`}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-start">
          <div>
            <h1 className="text-6xl md:text-8xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
              O carrinho<br />
              <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">abriu.</span>
            </h1>
            <p className="font-mono text-base text-muted-foreground leading-relaxed mb-8 max-w-xl">
              Você estava na lista. Chegou antes de todo mundo.{" "}
              <strong className="text-foreground">Agora tem {CART_CONFIG.horasFundador}h para garantir o preço de Fundador</strong>{" "}
              — um valor que não vai mais existir depois dessas 24 horas. Sem replay, sem reabertura, sem cupom.
            </p>

            {/* Price + CTA */}
            {!expired && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">Preço de Fundador</div>
                  <div className="font-mono font-black text-5xl text-primary drop-shadow-[0_0_16px_hsl(var(--primary)/0.5)]">
                    {precoFundador}
                    <span className="text-2xl font-normal ml-1 text-muted-foreground">{precoFundadorSufixo}</span>
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
              <Shield className="h-3 w-3" />
              Sem fidelidade · Cancela quando quiser · Acesso liberado em até 24h
            </div>
          </div>

          {/* Countdown + social proof */}
          <div className="space-y-4 min-w-[260px]">
            {!expired ? (
              <div className="border border-border/40 bg-card/30 p-5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Oferta de Fundador encerra em
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Digit v={h} label="h" />
                  <span className="font-mono font-black text-2xl text-primary/40">:</span>
                  <Digit v={m} label="min" />
                  <span className="font-mono font-black text-2xl text-primary/40">:</span>
                  <Digit v={s} label="seg" />
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                  Depois disso: preço cheio. Sem exceções.
                </div>
              </div>
            ) : (
              <div className="border border-destructive/30 bg-destructive/5 p-5 flex items-start gap-3">
                <X className="h-4 w-4 text-destructive/70 shrink-0 mt-0.5" />
                <span className="font-mono text-xs text-foreground">Janela de Fundador encerrada. Preço cheio ativo.</span>
              </div>
            )}

            {/* Vagas */}
            <div className="border border-border/40 bg-card/30 p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Vagas restantes
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="font-mono font-black text-3xl text-foreground">{vagasRestantes}</div>
                <div className="font-mono text-xs text-muted-foreground">de {CART_CONFIG.vagas}</div>
              </div>
              <div className="w-full bg-border/30 h-1.5 rounded-none">
                <div
                  className="bg-primary h-1.5 transition-all"
                  style={{ width: `${((CART_CONFIG.vagas - vagasRestantes) / CART_CONFIG.vagas) * 100}%` }}
                />
              </div>
              <div className="font-mono text-[10px] text-muted-foreground/40 mt-1.5">
                {CART_CONFIG.vagas - vagasRestantes} garantidas · {vagasRestantes} restantes
              </div>
            </div>

            {/* Social feed */}
            {feed.length > 0 && (
              <div className="space-y-1.5">
                {feed.map((entry, i) => (
                  <div key={i} className="border border-primary/15 bg-primary/5 px-3 py-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                    <span className="font-mono text-[10px] text-muted-foreground leading-snug">
                      <strong className="text-foreground">{entry.name}</strong> de {entry.city} garantiu há {entry.ago}min
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 2: TRANSFORMAÇÃO — Antes vs Depois ─────────────────────────────────
function TransformacaoSection() {
  const antes = [
    "Janeiro vira março. Março vira junho. O ano passa com 1 lançamento feito.",
    "40h de trabalho por lançamento. Copy, segmentação, disparos, carrinho — tudo manual.",
    "Acordar às 6h pra escrever email de abertura antes do café esfriar.",
    "Copiar mensagem no WhatsApp pra 200 leads. Um por um. Braço doendo.",
    "Reescrever a mesma copy 7 vezes sem saber se está boa o suficiente.",
    "Perder venda porque esqueceu de mandar o último email de escassez.",
  ];
  const depois = [
    "Você responde 7 perguntas. Em 47 minutos, estratégia completa montada.",
    "23 emails + 18 mensagens WhatsApp gerados e agendados automaticamente.",
    "Carrinho abre e fecha no horário. Sem você tocar em nada.",
    "Base segmentada em tempo real: hot, warm, cold. Cada grupo recebe copy diferente.",
    "Dashboard ao vivo mostra faturamento entrando. Você assiste.",
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
          {/* Antes */}
          <div className="border border-destructive/20 bg-destructive/5 p-7">
            <div className="flex items-center gap-2 mb-5">
              <X className="h-4 w-4 text-destructive/70" />
              <div className="font-mono text-xs uppercase tracking-widest text-destructive/70 font-bold">Antes do NexOS AI</div>
            </div>
            <ul className="space-y-3">
              {antes.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 border border-destructive/30 bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-1.5 h-0.5 bg-destructive/50 rounded-none" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Depois */}
          <div className="border border-primary/30 bg-primary/5 p-7">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <div className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Com o NexOS AI</div>
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
      custo: "40h do seu tempo",
      equivalente: "Se seu tempo vale R$200/h → R$8.000 desperdiçados",
      icon: Clock,
    },
    {
      rotulo: "Leads esfriando na base",
      custo: "Taxa de conversão caindo 30% por semana",
      equivalente: "Base de 2.000 leads sem nurturing = dinheiro apodrecendo",
      icon: TrendingDown,
    },
    {
      rotulo: "Copy feita sem teste",
      custo: "1 a 3% de conversão quando poderia ser 4 a 8%",
      equivalente: "Em R$10k de tráfego: diferença de R$300 a R$500 em vendas",
      icon: BarChart2,
    },
    {
      rotulo: "Concorrente que já automatizou",
      custo: "Lança 6x ao ano enquanto você lança 1x",
      equivalente: "Cada mês de atraso = 1 lançamento que ele fez e você não",
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
          O problema de não automatizar não é que você perde dinheiro diretamente. É que você perde tempo, velocidade e posicionamento — e isso se acumula silenciosamente todo mês.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {itens.map(({ rotulo, custo, equivalente, icon: Icon }, i) => (
            <div key={i} className="border border-border/30 bg-card/20 p-6">
              <div className="flex items-start gap-3 mb-3">
                <Icon className="h-5 w-5 text-destructive/50 shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-0.5">{rotulo}</div>
                  <div className="font-mono text-xs text-destructive/70 font-bold">{custo}</div>
                </div>
              </div>
              <div className="border-l-2 border-border/40 pl-3 ml-8">
                <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{equivalente}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border border-primary/20 bg-primary/5 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Zap className="h-5 w-5 text-primary shrink-0" />
          <p className="font-mono text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">O custo invisível da inação é maior do que o investimento no NexOS AI.</strong>{" "}
            A diferença é que um aparece no extrato e o outro não. Você só percebe quando olha pro ano todo e vê que fez metade do que planejou.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 4: ANCHOR — Comparação honesta ─────────────────────────────────────
function AnchorSection() {
  const alternativas = [
    {
      label: "O curso de lançamento mais famoso do Brasil",
      detalhe: "R$10.000 para aprender a fazer você mesmo. Você assiste às aulas. Depois monta, escreve, dispara, gerencia — tudo sozinho. Acesso expira em 1 ano.",
      preco: "R$10.000",
      sufixo: "acesso por 1 ano · você executa tudo",
      destaque: true,
    },
    {
      label: "Agência de lançamento completa",
      detalhe: "Contrato mínimo de 6 meses. Você ainda precisa aprovar cada entrega, participar de reuniões semanais, gerenciar o relacionamento.",
      preco: "R$15k–R$50k",
      sufixo: "por mês · contrato de 6 meses",
      destaque: false,
    },
    {
      label: "Copywriter sênior + gestor + automação",
      detalhe: "3 fornecedores. 3 pontos de falha. Você no meio coordenando. E ainda não há integração entre eles.",
      preco: "R$13k–R$27k",
      sufixo: "por mês · 3 fornecedores separados",
      destaque: false,
    },
  ];

  return (
    <section className="border-t border-border/20 bg-background py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-6">A COMPARAÇÃO QUE MUDA TUDO</div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-4">
          Pagar R$10.000 para<br />aprender a fazer você mesmo.<br />
          <span className="text-primary">Ou ter a IA fazendo por você.</span>
        </h2>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
          O maior curso de lançamento do Brasil é excelente. Ensina tudo. Mas depois que você aprende — você ainda precisa <em>executar</em>. Estratégia, copy, segmentação, disparos, carrinho, análise. Semanas de trabalho por lançamento. O NexOS AI não te ensina. <strong className="text-foreground">Ele executa.</strong>
        </p>
        <div className="space-y-3 mb-10">
          {alternativas.map((item, i) => (
            <div key={i} className={`border ${item.destaque ? "border-primary/20 bg-primary/5" : "border-border/30 bg-card/20"} p-6`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold mb-1.5">{item.label}</div>
                  <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{item.detalhe}</p>
                </div>
                <div className="text-right shrink-0 sm:ml-6">
                  <div className="font-mono font-black text-xl text-destructive/70 line-through">{item.preco}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest max-w-[160px] text-right">{item.sufixo}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* O ponto real */}
        <div className="border-l-4 border-primary pl-6">
          <p className="font-mono text-base text-foreground font-bold leading-relaxed mb-2">
            A questão não é se essas alternativas funcionam.
          </p>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed">
            É que em todas elas — <em>você ainda é o executor</em>. Você aprende, você coordena, você gerencia. O NexOS AI é a única opção onde a IA é quem executa — e você só aprova. Essa diferença vale muito mais do que a diferença de preço.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 5: COMUNIDADE DOS FUNDADORES ───────────────────────────────────────
function ComunidadeSection() {
  const beneficios = [
    { icon: Star,         titulo: "Status de Fundador permanente",     desc: "Seu acesso fica marcado como Fundador na plataforma. Quando novos usuários entrarem pagando mais, você mantém o preço e o status para sempre." },
    { icon: Users,        titulo: "Grupo privado dos Fundadores",      desc: "Canal direto com o time. Nenhum usuário comum tem acesso. Você reporta bugs, sugere features e influencia o roadmap antes de todo mundo." },
    { icon: Zap,          titulo: "Acesso antecipado a novos agentes", desc: "Cada novo agente que lançarmos vai pra você primeiro. Você testa, dá feedback e já opera com ele enquanto o resto da base ainda está esperando." },
    { icon: ChevronRight, titulo: "Onboarding individual com o time",  desc: "Não é um vídeo gravado. É uma sessão ao vivo para configurar sua primeira campanha. Você sai do onboarding com tudo rodando." },
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
          Fundadores não são clientes comuns com desconto. São as pessoas que constroem o NexOS AI com a gente. Esse status não volta — quando o carrinho fechar, a próxima turma entra no preço cheio, sem acesso ao grupo, sem onboarding individual, sem influência no roadmap.
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

// ─── SEÇÃO 6: COMPROMETIMENTO + OFERTA ────────────────────────────────────────
function OfertaSection({ expired }: { expired: boolean }) {
  const { precoCheio, precoCheioSufixo, precoFundador, precoFundadorSufixo, cartUrl, vagasRestantes, vagas } = CART_CONFIG;
  const includes = [
    "29 agentes de IA executando 24h no seu lançamento",
    "Estratégia completa gerada em 47 minutos",
    "23 emails + 18 mensagens WhatsApp por campanha",
    "Segmentação comportamental em tempo real",
    "Abertura e fechamento automático de carrinho",
    "Dashboard ao vivo com health score e alertas",
    "Acesso prioritário a todos os novos agentes",
    "Onboarding individual + grupo privado de Fundadores",
  ];

  return (
    <section className="border-t border-primary/20 auth-bg-gradient py-16 px-6 pb-32" id="oferta">
      <div className="max-w-5xl mx-auto">

        {/* Comprometimento */}
        <div className="border border-primary/20 bg-primary/5 px-7 py-6 mb-12">
          <p className="font-mono text-base text-foreground leading-relaxed">
            <strong>Você não chegou aqui por acaso.</strong> Você entrou na lista porque já decidiu que precisa disso. A única decisão que falta agora é:{" "}
            <strong className="text-primary">fazer isso hoje, com o preço de Fundador</strong> — ou fazer isso depois, pagando mais, sem o status, sem o grupo, sem o onboarding individual. A IA vai lançar o seu produto de qualquer jeito. A questão é quanto você vai pagar por isso.
          </p>
        </div>

        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary/60 mb-4 text-center">
          {expired ? "OFERTA DE FUNDADOR ENCERRADA" : `OFERTA DE FUNDADOR · ${vagasRestantes} VAGAS RESTANTES`}
        </div>
        <h2 className="text-4xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-10 text-center">
          {expired
            ? <><span className="text-destructive/80">A janela fechou.</span><br />Preço cheio ativo.</>
            : <>Esse é o momento.<br /><span className="text-primary">Garanta agora.</span></>
          }
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Incluso */}
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
            <div className="border-t border-primary/20 pt-5 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Custo equivalente no mercado</div>
              <div className="font-mono font-black text-2xl text-destructive/60 line-through">R$31.000 – R$83.000/mês</div>
              <div className="font-mono text-[10px] text-muted-foreground/40">Se você contratar tudo separado</div>
            </div>
          </div>

          {/* Price + CTA */}
          <div className="flex flex-col gap-4">
            {/* Preço cheio */}
            <div className={`border p-6 ${expired ? "border-primary/30 bg-primary/5" : "border-border/30 bg-card/20"}`}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                {expired ? "Preço atual" : "Preço após as 24h de Fundador"}
              </div>
              <div className={`font-mono font-black text-4xl mb-1 ${expired ? "text-foreground" : "text-muted-foreground/40 line-through"}`}>
                {precoCheio}<span className="text-lg font-normal ml-1">{precoCheioSufixo}</span>
              </div>
              {!expired && <div className="font-mono text-[10px] text-muted-foreground/40">Ativo após encerramento da janela</div>}
            </div>

            {/* Preço Fundador */}
            {!expired && (
              <div className="border-2 border-primary bg-primary/5 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary px-3 py-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary-foreground font-bold">24H · FUNDADOR</span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2 mt-1">Preço de Fundador — agora</div>
                <div className="font-mono font-black text-5xl md:text-6xl text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)] mb-1">
                  {precoFundador}<span className="text-2xl font-normal ml-1 text-muted-foreground">{precoFundadorSufixo}</span>
                </div>
                <div className="font-mono text-xs text-muted-foreground mt-2">Nunca mais este valor. Sem cupom. Sem reabertura. Sem negociação.</div>
              </div>
            )}

            {/* Vagas */}
            {!expired && (
              <div className="border border-border/30 bg-card/20 px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Vagas de Fundador</span>
                  <span className="font-mono text-xs font-bold text-foreground">{vagasRestantes} de {vagas}</span>
                </div>
                <div className="w-full bg-border/30 h-1">
                  <div className="bg-destructive h-1" style={{ width: `${((vagas - vagasRestantes) / vagas) * 100}%` }} />
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
                  Oferta de Fundador encerrada. Não há nova janela com essas condições prevista. O acesso ainda está disponível no preço cheio.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── STICKY BAR (sempre visível no rodapé) ────────────────────────────────────
function StickyBar({ h, m, s, expired }: { h: number; m: number; s: number; expired: boolean }) {
  const { precoFundador, precoFundadorSufixo, cartUrl } = CART_CONFIG;
  const fmt = (v: number) => String(v).padStart(2, "0");

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-primary/30 bg-background/95 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {!expired ? (
          <>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hidden sm:inline">Fundador encerra em</span>
              </div>
              <div className="font-mono font-black text-lg text-primary tabular-nums">
                {fmt(h)}:{fmt(m)}:{fmt(s)}
              </div>
              <div className="hidden sm:block border-l border-border/40 pl-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary">{precoFundador}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{precoFundadorSufixo}</span>
              </div>
            </div>
            <a href={cartUrl}>
              <Button className="btn-weapon-primary rounded-none font-mono uppercase tracking-widest font-black text-xs h-10 px-6 gap-2">
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
            <img src={nexosLogo} alt="NexOS AI" className="h-10 w-10 object-contain" style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary)/0.7))" }} />
            <div className="hidden sm:block">
              <div className="font-mono font-black text-base tracking-[0.15em] uppercase leading-none">NexOS <span className="text-primary">AI</span></div>
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

      {/* ── Seções ── */}
      <HeroSection h={h} m={m} s={s} expired={expired} />
      <TransformacaoSection />
      <CustoInacaoSection />
      <AnchorSection />
      <ComunidadeSection />
      <OfertaSection expired={expired} />

      {/* ── Footer ── */}
      <div className="border-t border-border/30 bg-muted/5 py-5 px-6 text-center mb-16">
        <p className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest">
          NexOS AI · Plataforma de Lançamento com IA · contato@nexos.ai
        </p>
      </div>

      {/* ── Sticky bar ── */}
      <StickyBar h={h} m={m} s={s} expired={expired} />
    </div>
  );
}
