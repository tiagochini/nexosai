import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 rounded-none border border-border/50 bg-card">
        <CardContent className="pt-6 space-y-4">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive shrink-0" />
            <div>
              <h1 className="font-mono text-xl font-bold uppercase tracking-tight text-foreground">404 — Página não encontrada</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Esta rota não existe no sistema.
              </p>
            </div>
          </div>
          <Link href="/">
            <Button className="w-full rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-10 text-xs">
              <Home className="h-3.5 w-3.5" />
              Ir ao Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
