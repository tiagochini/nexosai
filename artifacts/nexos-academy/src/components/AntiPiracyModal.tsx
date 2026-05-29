import { useState } from "react";

interface Props {
  studentName: string;
  studentEmail: string;
  documentTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AntiPiracyModal({ studentName, studentEmail, documentTitle, onConfirm, onCancel }: Props) {
  const [confirmed, setConfirmed] = useState(false);

  function handleConfirm() {
    setConfirmed(true);
    setTimeout(() => onConfirm(), 100);
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-7 space-y-5"
        style={{
          background: "hsl(222 25% 6%)",
          border: "1px solid hsl(0 70% 45% / 0.35)",
          boxShadow: "0 0 60px hsl(0 70% 30% / 0.25)",
        }}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mx-auto"
            style={{ background: "hsl(0 70% 30% / 0.2)", border: "1px solid hsl(0 70% 45% / 0.3)" }}
          >
            🛡️
          </div>
          <h3 className="text-lg font-bold text-white">Sistema Antipirataria Ativado</h3>
          <p className="text-xs" style={{ color: "hsl(220 10% 50%)" }}>
            Documento: <span className="text-white font-semibold">{documentTitle}</span>
          </p>
        </div>

        {/* Warning box */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "hsl(0 70% 20% / 0.15)", border: "1px solid hsl(0 70% 45% / 0.2)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "hsl(0 70% 70%)" }}>
            ⚠️ Este PDF contém marca d'água com seus dados pessoais em todas as páginas:
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span style={{ color: "hsl(220 10% 45%)" }}>Nome:</span>
              <span className="text-white font-semibold">{studentName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span style={{ color: "hsl(220 10% 45%)" }}>E-mail:</span>
              <span className="text-white font-mono text-xs">{studentEmail}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span style={{ color: "hsl(220 10% 45%)" }}>Data:</span>
              <span className="text-white text-xs">{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
            </div>
          </div>
        </div>

        {/* Anti-piracy notice */}
        <div
          className="rounded-lg p-3"
          style={{ background: "hsl(220 25% 8%)", border: "1px solid hsl(220 20% 14%)" }}
        >
          <p className="text-xs leading-relaxed" style={{ color: "hsl(220 10% 50%)" }}>
            Ao baixar este material você confirma que é o único usuário autorizado. Compartilhar, redistribuir ou reproduzir este conteúdo sem autorização constitui violação da Lei 9.610/98 (Lei de Direitos Autorais) e pode resultar em penalidades legais.{" "}
            <strong className="text-white">As impressões e capturas de tela revelam a identidade de quem as realizou.</strong>
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            disabled={confirmed}
            className="w-full py-3 rounded-xl font-bold text-sm transition-opacity"
            style={{
              background: confirmed ? "hsl(168 100% 35%)" : "hsl(250 90% 60%)",
              color: "#fff",
              opacity: confirmed ? 0.7 : 1,
            }}
          >
            {confirmed ? "Gerando PDF..." : "Entendido — Baixar PDF com Minha Marca d'Água"}
          </button>
          <button
            onClick={onCancel}
            disabled={confirmed}
            className="w-full py-2 rounded-xl font-semibold text-sm"
            style={{ background: "transparent", color: "hsl(220 10% 45%)", border: "1px solid hsl(220 20% 14%)" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
