import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Users, MessageCircle, Facebook, Send } from "lucide-react";

interface CampaignGroup {
  id: string;
  campaignId: string;
  workspaceId: string;
  platform: "whatsapp" | "telegram" | "facebook";
  groupName: string;
  groupLink: string | null;
  groupId: string | null;
  description: string | null;
  segment: string | null;
  memberCount: number | null;
  status: "active" | "inactive" | "archived";
  createdAt: string;
}

const PLATFORM_META: Record<string, { label: string; icon: React.ElementType; color: string; placeholder: string }> = {
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
    placeholder: "https://chat.whatsapp.com/...",
  },
  telegram: {
    label: "Telegram",
    icon: Send,
    color: "text-sky-400 border-sky-400/30 bg-sky-400/5",
    placeholder: "https://t.me/+...",
  },
  facebook: {
    label: "Facebook",
    icon: Facebook,
    color: "text-blue-400 border-blue-400/30 bg-blue-400/5",
    placeholder: "https://www.facebook.com/groups/...",
  },
};

const SEGMENT_OPTIONS = [
  { value: "", label: "Todos os segmentos" },
  { value: "hot", label: "Hot — já comprou / alto engajamento" },
  { value: "warm", label: "Warm — leads engajados" },
  { value: "cold", label: "Cold — leads novos / frios" },
  { value: "vip", label: "VIP — clientes premium" },
  { value: "afiliados", label: "Afiliados" },
];

interface AddGroupFormData {
  platform: "whatsapp" | "telegram" | "facebook";
  groupName: string;
  groupLink: string;
  description: string;
  segment: string;
  memberCount: string;
}

const EMPTY_FORM: AddGroupFormData = {
  platform: "whatsapp",
  groupName: "",
  groupLink: "",
  description: "",
  segment: "",
  memberCount: "",
};

export function GroupsTab({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddGroupFormData>(EMPTY_FORM);

  const { data, isLoading } = useQuery<{ groups: CampaignGroup[] }>({
    queryKey: ["campaign-groups", campaignId],
    queryFn: () => customFetch(`/api/campaigns/${campaignId}/groups`),
    enabled: !!campaignId,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      customFetch(`/api/campaigns/${campaignId}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Grupo adicionado com sucesso");
      void queryClient.invalidateQueries({ queryKey: ["campaign-groups", campaignId] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast.error("Erro ao adicionar grupo"),
  });

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) =>
      customFetch(`/api/campaigns/${campaignId}/groups/${groupId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Grupo removido");
      void queryClient.invalidateQueries({ queryKey: ["campaign-groups", campaignId] });
    },
    onError: () => toast.error("Erro ao remover grupo"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.groupName.trim()) return;
    createMutation.mutate({
      platform: form.platform,
      groupName: form.groupName.trim(),
      groupLink: form.groupLink.trim() || undefined,
      description: form.description.trim() || undefined,
      segment: form.segment || undefined,
      memberCount: form.memberCount ? Number(form.memberCount) : undefined,
    });
  };

  const groups = data?.groups ?? [];
  const byPlatform: Record<string, CampaignGroup[]> = {};
  for (const g of groups) {
    if (!byPlatform[g.platform]) byPlatform[g.platform] = [];
    byPlatform[g.platform]!.push(g);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Grupos de Lançamento
          </span>
          {groups.length > 0 && (
            <Badge variant="outline" className="rounded-none font-mono text-[10px] px-2 py-0.5">
              {groups.length} grupo{groups.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-none font-mono text-xs h-7 px-3 border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Adicionar grupo
        </Button>
      </div>

      {/* Add Group Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border border-primary/20 bg-primary/5 p-4 space-y-4"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Novo grupo</p>

          {/* Platform selector */}
          <div className="grid grid-cols-3 gap-2">
            {(["whatsapp", "telegram", "facebook"] as const).map((p) => {
              const meta = PLATFORM_META[p]!;
              const Icon = meta.icon;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, platform: p }))}
                  className={`flex items-center gap-2 border p-2.5 text-xs font-mono transition-all rounded-none
                    ${form.platform === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Nome do grupo *
            </label>
            <input
              value={form.groupName}
              onChange={e => setForm(f => ({ ...f, groupName: e.target.value }))}
              placeholder="Ex: Grupo VIP — Lançamento Turma 2"
              required
              className="w-full bg-background border border-border/50 px-3 py-2 text-sm font-mono rounded-none focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Link */}
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Link de convite
            </label>
            <input
              value={form.groupLink}
              onChange={e => setForm(f => ({ ...f, groupLink: e.target.value }))}
              placeholder={PLATFORM_META[form.platform]!.placeholder}
              className="w-full bg-background border border-border/50 px-3 py-2 text-sm font-mono rounded-none focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Segment + Member count */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Segmento
              </label>
              <select
                value={form.segment}
                onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
                className="w-full bg-background border border-border/50 px-3 py-2 text-sm font-mono rounded-none focus:outline-none focus:border-primary/50 text-foreground"
              >
                {SEGMENT_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Membros (aprox.)
              </label>
              <input
                type="number"
                min="0"
                value={form.memberCount}
                onChange={e => setForm(f => ({ ...f, memberCount: e.target.value }))}
                placeholder="0"
                className="w-full bg-background border border-border/50 px-3 py-2 text-sm font-mono rounded-none focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Descrição / observações
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Ex: Grupo principal para leads hot da lista de espera"
              className="w-full bg-background border border-border/50 px-3 py-2 text-sm font-mono rounded-none focus:outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-none font-mono text-xs h-7"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              className="rounded-none font-mono text-xs h-7 px-4"
              disabled={createMutation.isPending || !form.groupName.trim()}
            >
              {createMutation.isPending ? "Salvando..." : "Salvar grupo"}
            </Button>
          </div>
        </form>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 bg-muted/20" />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && groups.length === 0 && (
        <div className="py-12 text-center border border-border/30 bg-card/20">
          <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Nenhum grupo cadastrado
          </p>
          <p className="font-mono text-xs text-muted-foreground/50 mt-2 max-w-sm mx-auto">
            Adicione grupos de WhatsApp, Telegram ou Facebook para organizar seus leads por segmento e facilitar o disparo de mensagens.
          </p>
        </div>
      )}

      {/* Groups grouped by platform */}
      {!isLoading && Object.entries(byPlatform).map(([platform, platformGroups]) => {
        const meta = PLATFORM_META[platform];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <div key={platform} className="space-y-2">
            <div className="flex items-center gap-2 pt-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                {meta.label}
              </span>
              <div className="flex-1 h-px bg-border/30" />
              <span className="font-mono text-[10px] text-muted-foreground/40">
                {platformGroups.length} grupo{platformGroups.length !== 1 ? "s" : ""}
              </span>
            </div>

            {platformGroups.map(group => (
              <div
                key={group.id}
                className={`border p-4 flex items-start gap-4 ${meta.color}`}
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0 opacity-60" />

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {group.groupName}
                    </span>
                    {group.segment && (
                      <Badge
                        variant="outline"
                        className={`rounded-none font-mono text-[10px] px-2 py-0.5 ${
                          group.segment === "hot" ? "border-orange-400/40 text-orange-400" :
                          group.segment === "warm" ? "border-yellow-400/40 text-yellow-400" :
                          group.segment === "cold" ? "border-sky-400/40 text-sky-400" :
                          "border-border/50 text-muted-foreground"
                        }`}
                      >
                        {group.segment}
                      </Badge>
                    )}
                    {group.memberCount != null && group.memberCount > 0 && (
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        {group.memberCount.toLocaleString("pt-BR")} membros
                      </span>
                    )}
                  </div>

                  {group.description && (
                    <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                      {group.description}
                    </p>
                  )}

                  {group.groupLink && (
                    <a
                      href={group.groupLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline mt-1"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      Abrir grupo
                    </a>
                  )}
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 rounded-none text-muted-foreground/40 hover:text-destructive shrink-0"
                  onClick={() => {
                    if (confirm(`Remover "${group.groupName}"?`)) {
                      deleteMutation.mutate(group.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        );
      })}

      {/* Summary bar */}
      {!isLoading && groups.length > 0 && (
        <div className="border border-border/30 bg-card/30 p-3 flex items-center gap-4 text-xs font-mono text-muted-foreground flex-wrap">
          <span className="uppercase tracking-widest">Resumo:</span>
          {(["whatsapp", "telegram", "facebook"] as const).map(p => {
            const count = (byPlatform[p] ?? []).length;
            if (!count) return null;
            const meta = PLATFORM_META[p]!;
            const Icon = meta.icon;
            return (
              <span key={p} className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {count} {meta.label}
              </span>
            );
          })}
          <span className="ml-auto">
            {groups.reduce((sum, g) => sum + (g.memberCount ?? 0), 0).toLocaleString("pt-BR")} membros totais
          </span>
        </div>
      )}
    </div>
  );
}
