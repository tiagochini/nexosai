import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShoppingBag, Plus, Pencil, Trash2, ExternalLink, Copy,
  CheckCheck, ToggleLeft, ToggleRight, ChevronRight, X,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  active: boolean;
  sequenceId?: string;
  successUrl?: string;
  createdAt: string;
}

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function copyLink(productId: string) {
  const url = `${window.location.origin}/comprar/${productId}`;
  navigator.clipboard.writeText(url).then(() => toast.success("Link de compra copiado!")).catch(() => {});
}

// ── Form modal ────────────────────────────────────────────────────────────────

function ProductForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<Product>;
  onSave: (data: { name: string; description: string; priceCents: number; sequenceId: string; successUrl: string }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? String((initial.priceCents ?? 0) / 100) : "");
  const [sequenceId, setSequenceId] = useState(initial?.sequenceId ?? "");
  const [successUrl, setSuccessUrl] = useState(initial?.successUrl ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceCents = Math.round(parseFloat(price.replace(",", ".")) * 100);
    if (!name.trim() || !price || isNaN(priceCents) || priceCents < 100) {
      toast.error("Preencha nome e preço (mínimo R$1,00)");
      return;
    }
    onSave({ name: name.trim(), description: description.trim(), priceCents, sequenceId: sequenceId.trim(), successUrl: successUrl.trim() });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="border border-primary/30 bg-card w-full max-w-lg p-6 space-y-5 relative">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40" />

        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">
            {initial?.id ? "Editar produto" : "Novo produto"}
          </h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Nome do produto</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Curso de Lançamento Perpétuo" className="rounded-none" required />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Descrição (opcional)</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva brevemente o que o comprador recebe..."
              className="w-full border border-border/50 bg-background/50 rounded-none px-3 py-2 text-sm font-sans min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Preço (R$)</Label>
            <Input
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="297,00"
              className="rounded-none"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              ID da Sequência (opcional — converte leads automaticamente)
            </Label>
            <Input value={sequenceId} onChange={e => setSequenceId(e.target.value)} placeholder="UUID da sequência de lançamento" className="rounded-none font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">URL após compra (opcional)</Label>
            <Input value={successUrl} onChange={e => setSuccessUrl(e.target.value)} placeholder="https://seusite.com/obrigado" className="rounded-none" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1 rounded-none font-mono uppercase tracking-widest text-xs">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 rounded-none font-mono uppercase tracking-widest text-xs btn-weapon-primary gap-2">
              {loading ? "Salvando..." : <><ChevronRight className="h-3.5 w-3.5" /> Salvar</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProdutosPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => customFetch<{ products: Product[] }>("/api/products"),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => customFetch<{ product: Product }>("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
    onSuccess: () => {
      toast.success("Produto criado!");
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setShowForm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & object) =>
      customFetch<{ product: Product }>(`/api/products/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Produto atualizado!");
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setEditingProduct(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      customFetch(`/api/products/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/products"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customFetch(`/api/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Produto removido.");
      qc.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCopy = (id: string) => {
    copyLink(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const products = data?.products ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-border/50 pb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="h-4 w-4 text-primary" />
            <h1 className="text-2xl font-mono uppercase tracking-tighter font-bold text-foreground">
              Produtos
            </h1>
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Vendas via Asaas · PIX · Boleto · Cartão · Conversão automática de leads
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="rounded-none font-mono uppercase tracking-widest text-xs btn-weapon-primary gap-2"
        >
          <Plus className="h-3.5 w-3.5" /> Novo produto
        </Button>
      </div>

      {/* Info banner */}
      <div className="border border-primary/20 bg-primary/5 px-5 py-4">
        <p className="font-mono text-[11px] text-muted-foreground/80 leading-relaxed">
          Cada produto gera um link público de compra. Quando o lead paga, o sistema confirma automaticamente via Asaas e, se vinculado a uma sequência, converte o contato direto no painel.
          Compartilhe o link no WhatsApp, email ou stories — sem Hotmart, sem comissão de plataforma.
        </p>
      </div>

      {/* Product list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 bg-muted/20 animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="border border-dashed border-border/40 p-12 text-center space-y-3">
          <ShoppingBag className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
            Nenhum produto cadastrado
          </p>
          <Button onClick={() => setShowForm(true)} variant="outline" className="rounded-none font-mono uppercase tracking-widest text-xs gap-2">
            <Plus className="h-3.5 w-3.5" /> Criar primeiro produto
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => (
            <div key={p.id} className={`border bg-card/30 p-5 transition-all ${p.active ? "border-border/40" : "border-border/20 opacity-60"}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-sm font-bold text-foreground truncate">{p.name}</span>
                    <Badge variant="outline" className={p.active ? "text-success border-success/40 text-[10px]" : "text-muted-foreground border-border/40 text-[10px]"}>
                      {p.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  {p.description && (
                    <p className="font-mono text-[11px] text-muted-foreground/70 mb-2 line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="font-mono text-lg font-black text-primary">{fmtBRL(p.priceCents)}</span>
                    {p.sequenceId && (
                      <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                        Converte leads automaticamente
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-1 font-mono text-[11px] text-muted-foreground/50">
                    <span className="truncate">{window.location.origin}/comprar/{p.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopy(p.id)}
                    title="Copiar link"
                    className="p-2 rounded hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedId === p.id ? <CheckCheck className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => window.open(`/comprar/${p.id}`, "_blank")}
                    title="Ver página de compra"
                    className="p-2 rounded hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleMutation.mutate({ id: p.id, active: !p.active })}
                    title={p.active ? "Desativar" : "Ativar"}
                    className="p-2 rounded hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {p.active ? <ToggleRight className="h-4 w-4 text-success" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => setEditingProduct(p)}
                    title="Editar"
                    className="p-2 rounded hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remover "${p.name}"?`)) deleteMutation.mutate(p.id);
                    }}
                    title="Remover"
                    className="p-2 rounded hover:bg-muted/20 text-destructive/70 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <ProductForm
          onSave={data => createMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
          loading={createMutation.isPending}
        />
      )}

      {/* Edit form */}
      {editingProduct && (
        <ProductForm
          initial={editingProduct}
          onSave={data => updateMutation.mutate({ id: editingProduct.id, ...data })}
          onCancel={() => setEditingProduct(null)}
          loading={updateMutation.isPending}
        />
      )}
    </div>
  );
}
