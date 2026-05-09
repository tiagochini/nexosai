import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useListSequenceContacts, useAddSequenceContacts, getListSequenceContactsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Plus, Upload, Search } from "lucide-react";
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
      case 'hot': return <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase bg-red-500/10 text-red-500 border-red-500/20">Quente</Badge>;
      case 'warm': return <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Morno</Badge>;
      case 'cold': return <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase bg-blue-500/10 text-blue-500 border-blue-500/20">Frio</Badge>;
      case 'converted': return <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase bg-green-500/10 text-green-500 border-green-500/20">Convertido</Badge>;
      case 'unsubscribed': return <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase bg-muted text-muted-foreground border-border">Cancelado</Badge>;
      default: return <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase bg-muted text-muted-foreground border-border">{segment}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col border-b border-border pb-6">
        <Link href={`/sequences/${sequenceId}`}>
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs mb-4 -ml-2 w-fit text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Sequência
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">Base de Contatos</h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-wider">Gestão de leads e inteligência de segmentação</p>
          </div>
          <div className="flex gap-2 text-right">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="font-mono uppercase tracking-wider rounded-none gap-2 font-bold">
                  <Plus className="h-4 w-4" />
                  Injetar Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="border-border bg-card rounded-none sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="font-mono uppercase tracking-wide font-bold">Adição Manual</DialogTitle>
                  <DialogDescription className="font-mono text-xs uppercase tracking-wider mt-2">
                    Injete um lead diretamente na base desta operação.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddContact} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-mono text-xs uppercase tracking-wider">Email (Obrigatório)</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={newEmail} 
                      onChange={e => setNewEmail(e.target.value)} 
                      required 
                      className="font-mono bg-background border-border rounded-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name" className="font-mono text-xs uppercase tracking-wider">Nome (Opcional)</Label>
                    <Input 
                      id="name" 
                      value={newName} 
                      onChange={e => setNewName(e.target.value)} 
                      className="font-mono bg-background border-border rounded-none"
                    />
                  </div>
                  <DialogFooter className="pt-4 border-t border-border">
                    <Button type="submit" disabled={addContactsMutation.isPending} className="font-mono uppercase rounded-none font-bold">
                      {addContactsMutation.isPending ? "Processando..." : "Confirmar Injeção"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="border border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border bg-muted/10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 border border-border bg-background w-full max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="PESQUISAR E-MAIL..." 
              className="bg-transparent border-none outline-none font-mono text-xs uppercase tracking-wider w-full text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="font-mono text-xs uppercase tracking-wider font-bold">
            Total Registros: <span className="text-primary">{data?.total || 0}</span>
          </div>
        </div>

        <div className="p-0 overflow-x-auto">
          {data?.contacts && data.contacts.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Email / Nome</th>
                  <th className="p-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Segmento (Temp)</th>
                  <th className="p-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Score Engajamento</th>
                  <th className="p-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Recebidos / Abertos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-muted/10 font-mono text-sm">
                    <td className="p-4">
                      <div className="font-bold">{contact.email}</div>
                      {contact.name && <div className="text-xs text-muted-foreground mt-1 uppercase">{contact.name}</div>}
                    </td>
                    <td className="p-4">{getSegmentBadge(contact.segment)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{contact.engagementScore || 0}</span>
                        <Progress value={contact.engagementScore || 0} className="w-16 h-1 rounded-none bg-muted [&>div]:bg-primary" />
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {contact.itemsReceived || 0} <span className="mx-1">/</span> {contact.itemsOpened || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="font-mono text-sm uppercase text-muted-foreground">Base vazia. Nenhum lead injetado no sistema.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
