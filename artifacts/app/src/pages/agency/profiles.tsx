import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit2, Trash2, X, Save, Users,
  Globe, Briefcase, Target, Mic, Heart, Lightbulb,
  FileText, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface ClientProfile {
  id: string;
  name: string;
  industry?: string | null;
  productName?: string | null;
  targetAudience?: string | null;
  brandVoice?: string | null;
  mainPain?: string | null;
  transformation?: string | null;
  website?: string | null;
  notes?: string | null;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "",
  industry: "",
  productName: "",
  targetAudience: "",
  brandVoice: "",
  mainPain: "",
  transformation: "",
  website: "",
  notes: "",
};

function ProfileForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: typeof EMPTY_FORM;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="border border-primary/30 bg-card/60 p-5 space-y-4 animate-in fade-in duration-200">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Nome do Cliente *</label>
          <input
            value={form.name}
            onChange={set("name")}
            placeholder="Ex: João Silva / Studio Criativo"
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Segmento / Nicho</label>
          <input
            value={form.industry}
            onChange={set("industry")}
            placeholder="Ex: Nutrição, Finanças, SaaS"
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Nome do Produto</label>
          <input
            value={form.productName}
            onChange={set("productName")}
            placeholder="Ex: Método Detox 21 Dias"
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Website</label>
          <input
            value={form.website}
            onChange={set("website")}
            placeholder="https://exemplo.com.br"
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Público-Alvo</label>
          <input
            value={form.targetAudience}
            onChange={set("targetAudience")}
            placeholder="Ex: Mulheres 30-45 que querem emagrecer sem dieta restritiva"
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Tom de Voz da Marca</label>
          <input
            value={form.brandVoice}
            onChange={set("brandVoice")}
            placeholder="Ex: Amigável, direto, com humor leve"
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Dor Principal do Público</label>
          <input
            value={form.mainPain}
            onChange={set("mainPain")}
            placeholder="Ex: Faz dieta mas não consegue manter o resultado"
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Transformação Prometida</label>
          <input
            value={form.transformation}
            onChange={set("transformation")}
            placeholder="Ex: Perder 8kg em 21 dias sem passar fome"
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Notas Internas</label>
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Observações, histórico do cliente, contexto adicional..."
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2 resize-none"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-5 text-xs"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Salvando..." : "Salvar Perfil"}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          className="font-mono uppercase tracking-widest rounded-none h-9 px-4 text-xs border-border/50"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  onEdit,
  onDelete,
}: {
  profile: ClientProfile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const fields = [
    { icon: Briefcase, label: "Segmento", value: profile.industry },
    { icon: Target, label: "Produto", value: profile.productName },
    { icon: Users, label: "Público", value: profile.targetAudience },
    { icon: Mic, label: "Tom de Voz", value: profile.brandVoice },
    { icon: Heart, label: "Dor Principal", value: profile.mainPain },
    { icon: Lightbulb, label: "Transformação", value: profile.transformation },
    { icon: Globe, label: "Website", value: profile.website },
  ].filter((f) => f.value);

  return (
    <div className="border border-border/50 bg-card/40 hover:border-border/80 transition-colors group relative">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary/30 group-hover:border-primary/60 transition-colors" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary/30 group-hover:border-primary/60 transition-colors" />

      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm border border-border/50 bg-muted/20 flex items-center justify-center">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-sm text-foreground">{profile.name}</h3>
            {profile.industry && (
              <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">{profile.industry}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7 rounded-none hover:bg-primary/10">
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7 rounded-none hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded((e) => !e)}
            className="h-7 w-7 rounded-none hover:bg-muted/30"
          >
            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3 space-y-2 animate-in fade-in duration-150">
          {fields.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2.5">
              <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">{label}: </span>
                <span className="font-mono text-xs text-foreground">{value}</span>
              </div>
            </div>
          ))}
          {profile.notes && (
            <div className="flex items-start gap-2.5 pt-1 border-t border-border/30 mt-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">{profile.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgencyProfilesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["client-profiles"],
    queryFn: async () => {
      const r = await customFetch<Response>("/api/client-profiles");
      return (await r.json()) as { profiles: ClientProfile[] };
    },
  });

  const createMut = useMutation({
    mutationFn: async (form: typeof EMPTY_FORM) => {
      const r = await customFetch<Response>("/api/client-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Falha ao criar perfil");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-profiles"] });
      setShowForm(false);
      toast.success("Perfil de cliente criado!");
    },
    onError: () => toast.error("Erro ao criar perfil"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: typeof EMPTY_FORM }) => {
      const r = await customFetch<Response>(`/api/client-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Falha ao atualizar perfil");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-profiles"] });
      setEditingId(null);
      toast.success("Perfil atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar perfil"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await customFetch<Response>(`/api/client-profiles/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Falha ao remover perfil");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-profiles"] });
      toast.success("Perfil removido");
    },
    onError: () => toast.error("Erro ao remover perfil"),
  });

  const profiles = data?.profiles ?? [];
  const editingProfile = editingId ? profiles.find((p) => p.id === editingId) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono font-bold text-xl uppercase tracking-tighter text-foreground">
            Perfis de Clientes
          </h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-0.5">
            Memória de marca por cliente — a equipe especializada usa esse contexto nas campanhas
          </p>
        </div>
        <Button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          disabled={showForm}
          className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo Perfil
        </Button>
      </div>

      {/* Info strip */}
      <div className="border border-border/30 bg-muted/10 px-4 py-3 flex items-start gap-3">
        <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="font-mono text-xs text-muted-foreground leading-relaxed">
          Cada perfil armazena o contexto de um cliente: produto, público, tom de voz e transformação. 
          Ao criar uma campanha, selecione o perfil do cliente e todos os agentes equipe especializada vão operar com esse contexto automaticamente.
        </p>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="relative">
          <ProfileForm
            initial={EMPTY_FORM}
            onSave={(form) => createMut.mutate(form)}
            onCancel={() => setShowForm(false)}
            saving={createMut.isPending}
          />
        </div>
      )}

      {/* Profiles list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 border border-border/30 bg-muted/10 animate-pulse" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="border border-dashed border-border/40 py-14 text-center">
          <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground">Nenhum perfil criado ainda</p>
          <p className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest mt-1">
            Crie um perfil para cada cliente da sua agência
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) =>
            editingId === profile.id && editingProfile ? (
              <div key={profile.id} className="relative">
                <ProfileForm
                  initial={{
                    name:           editingProfile.name,
                    industry:       editingProfile.industry ?? "",
                    productName:    editingProfile.productName ?? "",
                    targetAudience: editingProfile.targetAudience ?? "",
                    brandVoice:     editingProfile.brandVoice ?? "",
                    mainPain:       editingProfile.mainPain ?? "",
                    transformation: editingProfile.transformation ?? "",
                    website:        editingProfile.website ?? "",
                    notes:          editingProfile.notes ?? "",
                  }}
                  onSave={(form) => updateMut.mutate({ id: profile.id, form })}
                  onCancel={() => setEditingId(null)}
                  saving={updateMut.isPending}
                />
              </div>
            ) : (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onEdit={() => { setEditingId(profile.id); setShowForm(false); }}
                onDelete={() => {
                  if (confirm(`Remover perfil "${profile.name}"?`)) deleteMut.mutate(profile.id);
                }}
              />
            )
          )}
        </div>
      )}

      {/* Count */}
      {profiles.length > 0 && (
        <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest text-right">
          {profiles.length} perfil{profiles.length !== 1 ? "s" : ""} cadastrado{profiles.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
