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
import { useUiText } from "@/lib/i18n";

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
  const t = useUiText();
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="border border-primary/30 bg-card/60 p-5 space-y-4 animate-in fade-in duration-200">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Nome do cliente *", "Client name *", "Nombre del cliente *")}</label>
          <input
            value={form.name}
            onChange={set("name")}
            placeholder={t("Ex.: João Silva / Studio Criativo", "E.g. Jane Smith / Creative Studio", "Ej.: Juan Pérez / Estudio Creativo")}
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Segmento / nicho", "Industry / niche", "Sector / nicho")}</label>
          <input
            value={form.industry}
            onChange={set("industry")}
            placeholder={t("Ex.: Nutrição, finanças, SaaS", "E.g. Nutrition, finance, SaaS", "Ej.: Nutrición, finanzas, SaaS")}
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Nome do produto", "Product name", "Nombre del producto")}</label>
          <input
            value={form.productName}
            onChange={set("productName")}
            placeholder={t("Ex.: Método Detox 21 Dias", "E.g. 21-Day Detox Method", "Ej.: Método Detox de 21 días")}
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Site", "Website", "Sitio web")}</label>
          <input
            value={form.website}
            onChange={set("website")}
            placeholder={t("https://exemplo.com.br", "https://example.com", "https://ejemplo.com")}
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Público-alvo", "Target audience", "Público objetivo")}</label>
          <input
            value={form.targetAudience}
            onChange={set("targetAudience")}
            placeholder={t("Ex.: Mulheres de 30 a 45 anos que querem emagrecer sem dieta restritiva", "E.g. Women aged 30–45 who want to lose weight without restrictive diets", "Ej.: Mujeres de 30 a 45 años que quieren adelgazar sin dietas restrictivas")}
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Tom de voz da marca", "Brand voice", "Tono de voz de la marca")}</label>
          <input
            value={form.brandVoice}
            onChange={set("brandVoice")}
            placeholder={t("Ex.: Amigável, direto, com humor leve", "E.g. Friendly, direct, with light humor", "Ej.: Amigable, directo y con humor ligero")}
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Dor principal do público", "Audience's main pain point", "Principal problema del público")}</label>
          <input
            value={form.mainPain}
            onChange={set("mainPain")}
            placeholder={t("Ex.: Faz dieta, mas não consegue manter o resultado", "E.g. Can follow a diet but struggles to maintain results", "Ej.: Sigue dietas, pero no logra mantener los resultados")}
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Transformação prometida", "Promised transformation", "Transformación prometida")}</label>
          <input
            value={form.transformation}
            onChange={set("transformation")}
            placeholder={t("Ex.: Perder 8 kg em 21 dias sem passar fome", "E.g. Lose 8 kg in 21 days without going hungry", "Ej.: Perder 8 kg en 21 días sin pasar hambre")}
            className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none rounded-sm px-3 py-2"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Notas internas", "Internal notes", "Notas internas")}</label>
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder={t("Observações, histórico do cliente, contexto adicional...", "Observations, client history, additional context...", "Observaciones, historial del cliente, contexto adicional...")}
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
          {saving ? t("Salvando...", "Saving...", "Guardando...") : t("Salvar perfil", "Save profile", "Guardar perfil")}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          className="font-mono uppercase tracking-widest rounded-none h-9 px-4 text-xs border-border/50"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          {t("Cancelar", "Cancel", "Cancelar")}
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
  const t = useUiText();
  const [expanded, setExpanded] = useState(false);

  const fields = [
    { icon: Briefcase, label: t("Segmento", "Industry", "Sector"), value: profile.industry },
    { icon: Target, label: t("Produto", "Product", "Producto"), value: profile.productName },
    { icon: Users, label: t("Público", "Audience", "Público"), value: profile.targetAudience },
    { icon: Mic, label: t("Tom de voz", "Brand voice", "Tono de voz"), value: profile.brandVoice },
    { icon: Heart, label: t("Dor principal", "Main pain point", "Problema principal"), value: profile.mainPain },
    { icon: Lightbulb, label: t("Transformação", "Transformation", "Transformación"), value: profile.transformation },
    { icon: Globe, label: t("Site", "Website", "Sitio web"), value: profile.website },
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
  const t = useUiText();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["client-profiles"],
    queryFn: async () => {
      return customFetch<{ profiles: ClientProfile[] }>("/api/client-profiles")
        .catch(() => ({ profiles: [] as ClientProfile[] }));
    },
  });

  const createMut = useMutation({
    mutationFn: async (form: typeof EMPTY_FORM) => {
      await customFetch<unknown>("/api/client-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-profiles"] });
      setShowForm(false);
      toast.success(t("Perfil de cliente criado!", "Client profile created!", "¡Perfil de cliente creado!"));
    },
    onError: () => toast.error(t("Erro ao criar perfil", "Failed to create profile", "Error al crear el perfil")),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: typeof EMPTY_FORM }) => {
      await customFetch<unknown>(`/api/client-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-profiles"] });
      setEditingId(null);
      toast.success(t("Perfil atualizado!", "Profile updated!", "¡Perfil actualizado!"));
    },
    onError: () => toast.error(t("Erro ao atualizar perfil", "Failed to update profile", "Error al actualizar el perfil")),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await customFetch<unknown>(`/api/client-profiles/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-profiles"] });
      toast.success(t("Perfil removido", "Profile removed", "Perfil eliminado"));
    },
    onError: () => toast.error(t("Erro ao remover perfil", "Failed to remove profile", "Error al eliminar el perfil")),
  });

  const profiles = data?.profiles ?? [];
  const editingProfile = editingId ? profiles.find((p) => p.id === editingId) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono font-bold text-xl uppercase tracking-tighter text-foreground">
            {t("Perfis de clientes", "Client profiles", "Perfiles de clientes")}
          </h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-0.5">
            {t("Memória de marca por cliente — os agentes usam esse contexto nas campanhas", "Brand memory for each client — agents use this context in campaigns", "Memoria de marca por cliente — los agentes usan este contexto en las campañas")}
          </p>
        </div>
        <Button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          disabled={showForm}
          className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("Novo perfil", "New profile", "Nuevo perfil")}
        </Button>
      </div>

      {/* Info strip */}
      <div className="border border-border/30 bg-muted/10 px-4 py-3 flex items-start gap-3">
        <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="font-mono text-xs text-muted-foreground leading-relaxed">
          {t(
            "Cada perfil armazena o contexto de um cliente: produto, público, tom de voz e transformação. Ao criar uma campanha, selecione o perfil do cliente para que todos os agentes usem esse contexto automaticamente.",
            "Each profile stores a client's context: product, audience, brand voice, and transformation. Select the profile when creating a campaign so every agent can use that context.",
            "Cada perfil guarda el contexto de un cliente: producto, público, tono de voz y transformación. Selecciona el perfil al crear una campaña para que todos los agentes usen ese contexto automáticamente."
          )}
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
          <p className="font-mono text-sm text-muted-foreground">{t("Nenhum perfil criado ainda", "No profiles created yet", "Aún no hay perfiles")}</p>
          <p className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest mt-1">
            {t("Crie um perfil para cada cliente da sua agência", "Create a profile for each agency client", "Crea un perfil para cada cliente de tu agencia")}
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
                  if (confirm(t(`Remover perfil "${profile.name}"?`, `Remove profile "${profile.name}"?`, `¿Eliminar el perfil "${profile.name}"?`))) deleteMut.mutate(profile.id);
                }}
              />
            )
          )}
        </div>
      )}

      {/* Count */}
      {profiles.length > 0 && (
        <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest text-right">
          {profiles.length === 1 ? t("1 perfil cadastrado", "1 profile saved", "1 perfil registrado") : t(`${profiles.length} perfis cadastrados`, `${profiles.length} profiles saved`, `${profiles.length} perfiles registrados`)}
        </p>
      )}
    </div>
  );
}
