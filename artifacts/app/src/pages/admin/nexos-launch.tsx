import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Zap, Target, Users, Brain, Flame, Radio, ChevronDown, ChevronUp,
  Copy, RefreshCw, Rocket, Star, Shield, AlertTriangle, Play,
  MessageSquare, Mail, Video, Megaphone, FileText, Mic,
} from "lucide-react";
import { Link } from "wouter";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ContentType =
  | "vsl_script"
  | "cpl_series"
  | "captacao_copy"
  | "whatsapp_sequence"
  | "email_sequence"
  | "live_script"
  | "ad_copy"
  | "live_talking_points";

interface GeneratedContent {
  type: ContentType;
  titulo: string;
  conteudo: string;
  geradoEm: string;
}

// ─── Arsenal Config ─────────────────────────────────────────────────────────────

const ARSENAL: {
  type: ContentType;
  label: string;
  descricao: string;
  icon: React.ElementType;
  cor: string;
  tempo: string;
}[] = [
  {
    type: "live_script",
    label: "Roteiro da Live + Sorteado",
    descricao: "O roteiro completo da live — da abertura ao fechamento, incluindo como conduzir o sorteado ao vivo",
    icon: Radio,
    cor: "text-red-400",
    tempo: "~90 seg",
  },
  {
    type: "live_talking_points",
    label: "Talking Points da Live",
    descricao: "Guia de bolso para usar durante a live — frases que não podem faltar, gatilhos de fechamento, como lidar com objeções ao vivo",
    icon: Mic,
    cor: "text-orange-400",
    tempo: "~60 seg",
  },
  {
    type: "vsl_script",
    label: "Roteiro VSL",
    descricao: "VSL completo que instala as micro-convicções na ordem certa — do gancho emocional ao CTA",
    icon: Video,
    cor: "text-purple-400",
    tempo: "~90 seg",
  },
  {
    type: "cpl_series",
    label: "Série CPL 1/2/3",
    descricao: "Outline dos 3 vídeos de conteúdo de pré-lançamento — cada um remove uma camada de objeção",
    icon: Play,
    cor: "text-blue-400",
    tempo: "~75 seg",
  },
  {
    type: "captacao_copy",
    label: "Copy de Captação",
    descricao: "Headlines, subheadlines, copy do botão e página de obrigado — para a captura de leads",
    icon: FileText,
    cor: "text-cyan-400",
    tempo: "~60 seg",
  },
  {
    type: "whatsapp_sequence",
    label: "Sequência WhatsApp",
    descricao: "7 dias de mensagens — do opt-in ao fechamento do carrinho — com timing e segmentação",
    icon: MessageSquare,
    cor: "text-green-400",
    tempo: "~75 seg",
  },
  {
    type: "email_sequence",
    label: "Sequência de Emails",
    descricao: "7 emails que constroem antecipação, instalam a epifania e fecham com urgência real",
    icon: Mail,
    cor: "text-yellow-400",
    tempo: "~75 seg",
  },
  {
    type: "ad_copy",
    label: "Pacote de Anúncios",
    descricao: "Copy para Meta Ads e TikTok — tráfego frio, morno e remarketing — com hook de vídeo",
    icon: Megaphone,
    cor: "text-pink-400",
    tempo: "~60 seg",
  },
];

// ─── Micro-convicções (exibição visual) ────────────────────────────────────────

const MICRO_CONVICCOES = [
  { num: "01", texto: "O método de lançamento funciona — você já sabe disso" },
  { num: "02", texto: "O que faz a diferença não é o conhecimento, é a execução" },
  { num: "03", texto: "Quem executa bem tem time especializado — copy, estratégia, vídeo, sequências" },
  { num: "04", texto: "Contratar esse time custa R$30k+/mês — fora do alcance de quem está começando" },
  { num: "05", texto: "Uma agente treinada para cada função do time de lançamento resolve isso" },
  { num: "06", texto: "NexOS tem 64 agentes especializados — cada um treinado para uma função" },
  { num: "07", texto: "Você pode ver funcionando ao vivo — sem promessa, sem slide" },
  { num: "08", texto: "R$3.990 uma única vez é menos que um mês de um bom copywriter" },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function NexosLaunchRoom() {
  const { isAdmin } = useAuth();
  const [generated, setGenerated] = useState<Record<string, GeneratedContent>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [epifaniaExpanded, setEpifaniaExpanded] = useState(true);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Acesso restrito ao fundador</p>
          <Button asChild variant="ghost" className="mt-4"><Link href="/admin">← Voltar</Link></Button>
        </div>
      </div>
    );
  }

  const generateMutation = useMutation({
    mutationFn: async (type: ContentType) => {
      const data = await customFetch<{ content: GeneratedContent }>("/api/nexos-launch/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      return data.content;
    },
    onSuccess: (data) => {
      setGenerated(prev => ({ ...prev, [data.type]: data }));
      setExpanded(data.type);
      toast.success(`${data.titulo} gerado com sucesso`);
    },
    onError: () => toast.error("Erro ao gerar — verifique os especialistas"),
  });

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border/50 bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono text-xs">
                  ACESSO FUNDADOR
                </Badge>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-mono text-xs">
                  NÃO REPLICADO NOS CLIENTES
                </Badge>
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Sala de Lançamento NexOS
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Framework estratégico exclusivo · Agentes pré-calibrados · NexOS vendendo NexOS
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-mono">META DO LANÇAMENTO</p>
              <p className="text-2xl font-bold text-foreground">500 acessos</p>
              <p className="text-sm text-muted-foreground">R$1.995.000 bruto</p>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[
              { label: "Ticket", value: "R$3.990", sub: "lançamento", color: "text-green-400" },
              { label: "Track", value: "6 Dígitos", sub: "R$100k–999k em 7d", color: "text-blue-400" },
              { label: "Orçamento Mídia", value: "R$20–35k", sub: "ROAS alvo: 57x", color: "text-purple-400" },
              { label: "CPL Alvo", value: "≤ R$15", sub: "3.300+ leads", color: "text-orange-400" },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground font-mono">{k.label}</p>
                <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── A Epifania Central ── */}
        <div className="border border-amber-500/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setEpifaniaExpanded(e => !e)}
            className="w-full flex items-center justify-between px-6 py-4 bg-amber-500/10 hover:bg-amber-500/15 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Flame className="h-5 w-5 text-amber-400" />
              <span className="font-semibold text-foreground">A Epifania Central — O Argumento de Vendas Mais Importante</span>
            </div>
            {epifaniaExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {epifaniaExpanded && (
            <div className="px-6 py-6 space-y-6 bg-card/20">

              {/* Gancho */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-xs text-amber-400 font-mono mb-2">GANCHO CENTRAL</p>
                <p className="text-lg font-bold text-foreground leading-snug">
                  "A única coisa que separava você de um lançamento de 6 dígitos não era o método — era o time de execução."
                </p>
              </div>

              {/* Antes / Depois */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-xs text-red-400 font-mono mb-3">AVATAR ANTES</p>
                  <ul className="space-y-2">
                    {[
                      "Sabe o método — viu funcionar para outros",
                      "Travou na execução toda vez que tentou",
                      "Não tem time, não tem orçamento para agência",
                      "\"Sei que funciona, mas não sei se funciono\"",
                    ].map((t, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">✗</span> {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <p className="text-xs text-green-400 font-mono mb-3">AVATAR DEPOIS</p>
                  <ul className="space-y-2">
                    {[
                      "64 agentes executando cada etapa do lançamento",
                      "Briefing preenchido — estratégia, copy, vídeo gerados",
                      "Sequência rodando, leads aquecendo, atendimento 24h",
                      "\"Finalmente executei — e os números são reais\"",
                    ].map((t, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">✓</span> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Mecanismo */}
              <div className="bg-card border border-border/50 rounded-lg p-4">
                <p className="text-xs text-blue-400 font-mono mb-2">O MECANISMO (como explicar na live)</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-medium">NexOS não é mais um curso. Não é mais um framework.</span>{" "}
                  É o time de execução que o Érico tem — disponível para qualquer pessoa, a qualquer hora, sem mensalidade.
                  Quando você compra NexOS, você não aprende como lançar.{" "}
                  <span className="text-foreground font-medium">Você ganha 57 especialistas que lançam junto com você.</span>
                </p>
              </div>

              {/* Estratégia do Sorteado */}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4 text-purple-400" />
                  <p className="text-xs text-purple-400 font-mono">ESTRATÉGIA DO SORTEADO — A CHAVE DE OURO</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  A maior objeção do avatar não é <em>"o produto funciona?"</em> — é <em>"funciona para alguém como eu?"</em>.
                  O sorteado destrói essa objeção em tempo real, ao vivo, com uma pessoa aleatória da plateia.
                  Não é depoimento. Não é simulação. É o produto se demonstrando para quem não foi escolhido a dedo.
                </p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { step: "1. Sorteio ao vivo", desc: "Escolha aleatória — credibilidade total" },
                    { step: "2. Briefing em 5 min", desc: "Intake do NexOS para o sorteado" },
                    { step: "3. Demo em 30 min", desc: "Estratégia completa gerada na tela" },
                  ].map(s => (
                    <div key={s.step} className="bg-purple-500/10 rounded p-2">
                      <p className="text-purple-300 font-medium">{s.step}</p>
                      <p className="text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Micro-convicções */}
              <div>
                <p className="text-xs text-muted-foreground font-mono mb-3">SEQUÊNCIA DE MICRO-CONVICÇÕES (instalar nesta ordem)</p>
                <div className="space-y-2">
                  {MICRO_CONVICCOES.map(mc => (
                    <div key={mc.num} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                      <span className="font-mono text-xs text-muted-foreground/50 w-6 shrink-0">{mc.num}</span>
                      <span className="text-sm text-muted-foreground">{mc.texto}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ── Avatar: Dores e Linguagem ── */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Medos Reais do Avatar</p>
            </div>
            <ul className="space-y-2">
              {[
                "Tentar mais uma vez e fracassar novamente",
                "Perder dinheiro com mídia e não converter",
                "Montar tudo sozinho e chegar ao carrinho sem lista",
                "Não conseguir escrever copy que converte",
                "Ser mais um que sabia o método mas não conseguiu",
              ].map((m, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                  {m}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Linguagem Literal (use nas copies)</p>
            </div>
            <ul className="space-y-2">
              {[
                "\"Sei que funciona, mas não sei se funciono\"",
                "\"Não tenho time pra criar tudo isso\"",
                "\"Tentei antes e não saiu do papel\"",
                "\"O método está certo, mas eu travo na hora de fazer\"",
                "\"Quero lançar mas não sei por onde começar a execução\"",
              ].map((f, i) => (
                <li key={i} className="text-sm text-muted-foreground font-mono text-xs bg-muted/30 rounded px-2 py-1">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Arsenal de Conteúdo ── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Rocket className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Arsenal de Conteúdo</h2>
            <Badge variant="outline" className="text-xs font-mono">
              {Object.keys(generated).length}/{ARSENAL.length} gerados
            </Badge>
          </div>

          <div className="space-y-3">
            {ARSENAL.map(item => {
              const Icon = item.icon;
              const isGenerating = generateMutation.isPending && generateMutation.variables === item.type;
              const isDone = Boolean(generated[item.type]);
              const isOpen = expanded === item.type;

              return (
                <div
                  key={item.type}
                  className={`border rounded-xl overflow-hidden transition-all ${isDone ? "border-border" : "border-border/40"}`}
                >
                  {/* Card Header */}
                  <div className="flex items-center gap-4 px-5 py-4 bg-card/50">
                    <div className={`p-2 rounded-lg bg-card border border-border/50`}>
                      <Icon className={`h-4 w-4 ${item.cor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{item.label}</p>
                        {isDone && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                            Gerado
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono">{item.tempo}</span>
                      {isDone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setExpanded(isOpen ? null : item.type)}
                        >
                          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={isDone ? "outline" : "default"}
                        className="h-7 text-xs gap-1.5"
                        disabled={isGenerating}
                        onClick={() => generateMutation.mutate(item.type)}
                      >
                        {isGenerating ? (
                          <><RefreshCw className="h-3 w-3 animate-spin" /> Gerando...</>
                        ) : isDone ? (
                          <><RefreshCw className="h-3 w-3" /> Regenerar</>
                        ) : (
                          <><Zap className="h-3 w-3" /> Gerar com o agente</>
                        )}
                      </Button>
                      {isDone && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => copyToClipboard(generated[item.type]!.conteudo, item.label)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Content Area */}
                  {isDone && isOpen && (
                    <div className="border-t border-border/50 bg-card/20 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-muted-foreground font-mono">
                          Gerado em {new Date(generated[item.type]!.geradoEm).toLocaleString("pt-BR")}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs gap-1"
                          onClick={() => copyToClipboard(generated[item.type]!.conteudo, item.label)}
                        >
                          <Copy className="h-3 w-3" /> Copiar tudo
                        </Button>
                      </div>
                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-[500px] overflow-y-auto scrollbar-thin">
                        {generated[item.type]!.conteudo}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Checklist Pré-Live ── */}
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Checklist de Lançamento</h2>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {[
              {
                fase: "Semana -1",
                cor: "border-blue-500/30",
                items: [
                  "Página de captura no ar",
                  "Copy de captação gerado e aprovado",
                  "Anúncios subidos no Meta + TikTok",
                  "Sequência WhatsApp configurada",
                  "Grupo de WhatsApp criado",
                ],
              },
              {
                fase: "D-3 a D-1",
                cor: "border-amber-500/30",
                items: [
                  "CPL 1, 2 e 3 publicados",
                  "Emails D-5, D-3, D-1 agendados",
                  "Sorteado pré-filtrado (tem produto?)",
                  "Roteiro da live revisado",
                  "Talking points impressos/disponíveis",
                ],
              },
              {
                fase: "Dia da Live",
                cor: "border-red-500/30",
                items: [
                  "Link da live nas mensagens D0 manhã",
                  "NexOS logado e pronto para demo",
                  "Checkout configurado e testado",
                  "Sequência de cart aberta",
                  "Recuperação pós-live programada",
                ],
              },
            ].map(fase => (
              <div key={fase.fase} className={`border ${fase.cor} rounded-lg p-4`}>
                <p className="text-xs font-mono text-muted-foreground mb-3">{fase.fase}</p>
                <ul className="space-y-2">
                  {fase.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border border-border/60 rounded shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── Projeção ── */}
        <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/20 rounded-xl p-6">
          <p className="text-xs text-primary font-mono mb-4">PROJEÇÃO DE LANÇAMENTO</p>
          <div className="grid grid-cols-4 gap-4 text-center">
            {[
              { label: "Leads via mídia", value: "2.000–3.000", sub: "com R$30k, CPL ≤R$15" },
              { label: "Leads orgânicos", value: "+500–800", sub: "referral + sorteado share" },
              { label: "Assistiram a live", value: "770–1.400", sub: "35–45% da lista" },
              { label: "Conversão esperada", value: "200–500", sub: "15–35% dos que viram a live" },
            ].map(p => (
              <div key={p.label}>
                <p className="text-2xl font-bold text-foreground">{p.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.label}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{p.sub}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Receita potencial no cenário base</p>
            <div className="text-right">
              <span className="text-xl font-bold text-green-400">R$800k–R$1.995.000</span>
              <span className="text-xs text-muted-foreground ml-2">com R$30k de mídia</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
