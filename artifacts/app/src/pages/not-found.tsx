import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";

export default function NotFound() {
  const t = useUiText();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 rounded-none border border-border/50 bg-card">
        <CardContent className="pt-6 space-y-4">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive shrink-0" />
            <div>
              <h1 className="font-mono text-xl font-bold uppercase tracking-tight text-foreground">{t("404 — Página não encontrada", "404 — Page not found", "404 — Página no encontrada")}</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {t("Esta rota não existe no sistema.", "This route doesn't exist.", "Esta ruta no existe.")}
              </p>
            </div>
          </div>
          <Link href="/">
            <Button className="w-full rounded-none font-mono uppercase tracking-widest gap-2 btn-weapon-primary h-10 text-xs">
              <Home className="h-3.5 w-3.5" />
              {t("Ir ao Dashboard", "Go to dashboard", "Ir al panel")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
