import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateCampaign, CampaignInputType, CampaignInputTrack } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, Rocket, Brain, FileText, Zap, ChevronRight,
} from "lucide-react";

const STEPS_PREVIEW = [
  {
    num: "01",
    icon: Brain,
    title: "Intake com IA",
    desc: "A IA conversa com você, entende seu produto, audiência e metas. Define o modelo ideal.",
  },
  {
    num: "02",
    icon: FileText,
    title: "Plano Estratégico",
    desc: "Estrategista gera o plano completo de campanha com cronograma, canais e abordagens.",
  },
  {
    num: "03",
    icon: Zap,
    title: "Conteúdo para aprovação",
    desc: "Copywriter produz e-mails, copies, sequências e criativos. Você aprova antes de publicar.",
  },
  {
    num: "04",
    icon: Rocket,
    title: "Lançamento monitorado",
    desc: "Campanha vai ao ar com dashboard em tempo real e agentes ajustando a estratégia.",
  },
];

export default function NewCampaign() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");

  const createMutation = useCreateCampaign({
    mutation: {
      onSuccess: (data) => {
        toast.success("Missão criada. Briefing com a IA começa agora.");
        setLocation(`/campaigns/${data.campaign.id}/intake`);
      },
      onError: () => toast.error("Erro ao criar campanha."),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("Dê um nome para a missão."); return; }
    createMutation.mutate({
      data: {
        title,
        type: "launch" as CampaignInputType,
        track: "six_digits" as CampaignInputTrack,
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-4 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />Voltar às Missões
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">Nova Missão</h1>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
          A IA faz o briefing, define o modelo e monta o plano. Você aprova.
        </p>
      </div>

      {/* Journey preview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STEPS_PREVIEW.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.num} className="flex gap-3 p-4 border border-border/30 bg-card/20">
              <div className="shrink-0 flex flex-col items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground/40 tracking-widest">{s.num}</span>
                <div className="w-7 h-7 border border-border/40 bg-card/60 flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
              </div>
              <div>
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground mb-1">{s.title}</div>
                <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="border border-primary/20 bg-card/40 backdrop-blur-xl p-6 relative card-weapon space-y-5">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 pointer-events-none" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 pointer-events-none" />

          <div className="space-y-2 relative z-10">
            <label className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              Codinome da Missão
            </label>
            <Input
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-12 text-base rounded-none px-4"
              placeholder="Ex: Lançamento Produto Alpha — Q3 2026"
            />
            <p className="font-mono text-xs text-muted-foreground/40">Nome interno. Pode alterar depois. O modelo de campanha será definido pela IA.</p>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button
            type="submit"
            disabled={createMutation.isPending || !title.trim()}
            className="rounded-none font-mono uppercase tracking-widest font-bold h-12 px-8 btn-weapon-primary gap-2"
          >
            {createMutation.isPending
              ? <span className="animate-pulse font-mono">Inicializando...</span>
              : <><Brain className="h-4 w-4" />Iniciar Briefing com IA<ChevronRight className="h-4 w-4" /></>
            }
          </Button>
        </div>
      </form>
    </div>
  );
}
