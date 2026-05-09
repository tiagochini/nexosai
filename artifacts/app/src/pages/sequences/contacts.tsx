import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useListSequenceContacts, useAddSequenceContacts, getListSequenceContactsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Plus, Upload, Search, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export default function SequenceContacts() {
  const [match, params] = useRoute("/sequences/:id/contacts");
  const sequenceId = params?.id || "";
  const queryClient = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const { data, isLoading } = useListSequenceContacts(sequenceId, {
    query: {
      enabled: !!sequenceId,
      queryKey: getListSequenceContactsQueryKey(sequenceId)
    }
  });

  const addContactsMutation = useAddSequenceContacts({
    mutation: {
      onSuccess: () => {
        toast.success("Contato adicionado à base.");
        setIsAddOpen(false);
        setNewEmail("");
        setNewName("");
        queryClient.invalidateQueries({ queryKey: getListSequenceContactsQueryKey(sequenceId) });
      },
      onError: () => {
        toast.error("Erro ao adicionar contato.");
      }
    }
  });

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    
    addContactsMutation.mutate({
      sequenceId,
      data: {
        contacts: [
          { email: newEmail, name: newName || undefined }
        ]
      }
    });
  };

  const getSegmentBadge = (segment: string) => {
    switch (segment) {
      case 'hot': return <Badge variant="outline" className="rounded-none font-mono text-[9px] tracking-widest uppercase bg-red-500/10 text-red-400 border-red-500/30 badge-glow-red">Quente</Badge>;
      case 'warm': return <Badge variant="outline" className="rounded-none font-mono text-[9px] tracking-widest uppercase bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Morno</Badge>;
      case 'cold': return <Badge variant="outline" className="rounded-none font-mono text-[9px] tracking-widest uppercase bg-blue-500/10 text-blue-400 border-blue-500/30">Frio</Badge>;
      case 'converted': return <Badge variant="outline" className="rounded-none font-mono text-[9px] tracking-widest uppercase bg-success/10 text-success border-success/30 badge-glow-green">Convertido</Badge>;
      case 'unsubscribed': return <Badge variant="outline" className="rounded-none font-mono text-[9px] tracking-widest uppercase bg-muted/30 text-muted-foreground border-border/50">Cancelado</Badge>;
      default: return <Badge variant="outline" className="rounded-none font-mono text-[9px] tracking-widest uppercase bg-muted/20 text-muted-foreground border-border/50">{segment}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-[500px] w-full bg-muted/20" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col border-b border-border/50 pb-6">
        <Link href={`/sequences/${sequenceId}`}>
          <Button variant="ghost" size="sm" className="font-mono uppercase text-[10px] tracking-widest mb-6 -ml-2 w-fit text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />
            Retornar à Sequência
          </Button>
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground flex items-center gap-3">
              Base de Contatos
            </h1>
            <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-widest">Gestão de leads e inteligência de segmentação</p>
          </div>
          <div className="flex gap-3 text-right">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="font-mono uppercase tracking-widest rounded-none gap-2 font-bold h-10 px-6 btn-weapon-primary">
                  <Plus className="h-4 w-4" />
                  Injetar Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="border border-primary/30 bg-card/90 backdrop-blur-xl rounded-none shadow-[0_0_50px_hsl(var(--primary)/0.15)] sm:max-w-[450px]">
                <DialogHeader>
                  <DialogTitle className="font-mono uppercase tracking-widest font-bold text-lg border-b border-border/50 pb-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center border border-primary/30">
                      <Database className="h-4 w-4 text-primary" />
                    </div>
                    Injeção Manual
                  </DialogTitle>
                  <DialogDescription className="font-mono text-[10px] uppercase tracking-widest mt-4 text-muted-foreground">
                    Adicione um alvo específico à base desta operação.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddContact} className="space-y-5 py-2">
                  <div className="space-y-3">
                    <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-slow"></span>
                      Email (Obrigatório)
                    </Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={newEmail} 
                      onChange={e => setNewEmail(e.target.value)} 
                      required 
                      className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-12 rounded-none transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="name" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Nome (Opcional)</Label>
                    <Input 
                      id="name" 
                      value={newName} 
                      onChange={e => setNewName(e.target.value)} 
                      className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-12 rounded-none transition-all"
                    />
                  </div>
                  <DialogFooter className="pt-6 border-t border-border/30">
                    <Button type="submit" disabled={addContactsMutation.isPending} className="w-full font-mono uppercase tracking-widest rounded-none font-bold h-12 btn-weapon-primary">
                      {addContactsMutation.isPending ? "Processando..." : "Confirmar Injeção"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="border border-border/50 bg-card/40 backdrop-blur-sm flex flex-col card-weapon">
        <div className="p-4 border-b border-border/50 bg-muted/10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 px-4 py-2.5 border border-border/50 bg-background/50 w-full max-w-sm focus-within:border-primary/50 focus-within:shadow-[0_0_10px_hsl(var(--primary)/0.2)] transition-all">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="RASTREAR ALVO..." 
              className="bg-transparent border-none outline-none font-mono text-[10px] uppercase tracking-widest w-full text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest bg-background/50 px-4 py-2 border border-border/50">
            Base Ativa: <span className="text-primary font-bold ml-2 text-sm">{data?.total || 0}</span>
          </div>
        </div>

        <div className="p-0 overflow-x-auto custom-scrollbar">
          {data?.contacts && data.contacts.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="p-5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Identificação</th>
                  <th className="p-5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Segmento (Temp)</th>
                  <th className="p-5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Score Engajamento</th>
                  <th className="p-5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Status Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {data.contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-muted/10 font-mono text-sm table-row-glow transition-colors group">
                    <td className="p-5">
                      <div className="font-bold text-foreground group-hover:text-primary transition-colors">{contact.email}</div>
                      {contact.name && <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">{contact.name}</div>}
                    </td>
                    <td className="p-5">{getSegmentBadge(contact.segment)}</td>
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-foreground w-8">{contact.engagementScore || 0}</span>
                        <Progress 
                          value={contact.engagementScore || 0} 
                          className="w-24 h-1.5 rounded-none bg-muted/50"
                        />
                      </div>
                    </td>
                    <td className="p-5 text-muted-foreground">
                      <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest bg-background/30 px-3 py-1.5 w-fit border border-border/50">
                        <span>REC: <strong className="text-foreground">{contact.itemsReceived || 0}</strong></span>
                        <span className="opacity-30">|</span>
                        <span>ABT: <strong className="text-foreground">{contact.itemsOpened || 0}</strong></span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-20 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full border border-border/50 bg-muted/10 flex items-center justify-center mb-6">
                <Users className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="font-mono text-sm uppercase tracking-widest text-foreground font-bold mb-2">Base Vazia</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground max-w-md">Nenhum lead injetado no sistema para esta operação.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
