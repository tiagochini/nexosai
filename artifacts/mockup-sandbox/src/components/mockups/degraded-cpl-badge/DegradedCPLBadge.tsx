/**
 * Preview isolado — badge de CPL degradado (#60)
 * Simula como a peça aparece no content.tsx quando _degradedCPLs: [2, 3]
 */
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

interface MockPiece {
  title: string;
  qualityScore?: number;
  degradedCPLs?: number[];
  status: string;
}

function PieceCard({ piece }: { piece: MockPiece }) {
  return (
    <div className="border border-white/10 bg-black/40 p-4 rounded w-full max-w-md font-mono">
      {/* Badge row */}
      <div className="flex flex-wrap gap-1 mb-2">
        <Badge variant="outline" className="rounded-none font-mono text-[11px] px-1.5 py-0 text-purple-400 border-purple-400/40 bg-purple-400/10">
          native_video
        </Badge>
        <Badge variant="outline" className="rounded-none font-mono text-[11px] px-1.5 py-0 text-blue-400 border-blue-400/40 bg-blue-400/10">
          Aguardando
        </Badge>

        {/* quality score badge */}
        {piece.qualityScore != null && (
          <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-1.5 py-0 ${
            piece.qualityScore >= 80 ? "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" :
            piece.qualityScore >= 60 ? "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" :
            "text-red-400 border-red-400/40 bg-red-400/10"
          }`}>
            IA {piece.qualityScore}/100
          </Badge>
        )}

        {/* [#60] degraded CPL badge */}
        {piece.degradedCPLs && piece.degradedCPLs.length > 0 && (
          <Badge
            variant="outline"
            className="rounded-none font-mono text-[11px] px-1.5 py-0 gap-1 text-amber-400 border-amber-400/40 bg-amber-400/10"
            title={`CPL ${piece.degradedCPLs.join(", ")} gerado com roteiro incompleto — recomendamos regenerar esta peça`}
          >
            ⚠ CPL {piece.degradedCPLs.join("/")} incompleto
          </Badge>
        )}
      </div>

      <h3 className="text-sm font-bold text-white">{piece.title}</h3>
      <p className="text-[11px] text-white/40 mt-1">cpl_script · pending_approval</p>
    </div>
  );
}

export default function DegradedCPLBadge() {
  return (
    <div className="bg-zinc-950 min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <p className="text-white/50 font-mono text-xs uppercase tracking-widest mb-2">Prova #60 — badge de roteiro incompleto</p>

      {/* Caso normal: sem degradação */}
      <div>
        <p className="text-white/30 font-mono text-[11px] mb-2">Peça normal (sem _degradedCPLs):</p>
        <PieceCard piece={{
          title: "CPL — 3 Vídeos de Pré-Lançamento",
          qualityScore: 78,
          status: "pending_approval",
        }} />
      </div>

      {/* Caso degradado: _degradedCPLs: [2, 3] */}
      <div>
        <p className="text-amber-400/60 font-mono text-[11px] mb-2">Peça com _degradedCPLs: [2, 3] → badge visível:</p>
        <PieceCard piece={{
          title: "CPL — 3 Vídeos de Pré-Lançamento [TESTE #60]",
          qualityScore: 62,
          degradedCPLs: [2, 3],
          status: "pending_approval",
        }} />
      </div>

      {/* Apenas 1 CPL degradado */}
      <div>
        <p className="text-amber-400/60 font-mono text-[11px] mb-2">Peça com _degradedCPLs: [1]:</p>
        <PieceCard piece={{
          title: "CPL — 3 Vídeos de Pré-Lançamento",
          qualityScore: 55,
          degradedCPLs: [1],
          status: "pending_approval",
        }} />
      </div>
    </div>
  );
}
