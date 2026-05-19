import { useEffect, useState } from "react";

interface WatermarkProps {
  children: React.ReactNode;
}

function getUserInfo(): { name: string; email: string } {
  try {
    const token = localStorage.getItem("nexos-academy-token") ?? "";
    const email = localStorage.getItem("nexos-academy-email") ?? "";
    const name = localStorage.getItem("nexos-academy-name") ?? "";
    const label = [name, email, token].filter(Boolean).join(" · ");
    return { name: label || "NexOS Academy", email };
  } catch {
    return { name: "NexOS Academy", email: "" };
  }
}

export default function Watermark({ children }: WatermarkProps) {
  const [info, setInfo] = useState({ name: "NexOS Academy", email: "" });

  useEffect(() => {
    setInfo(getUserInfo());
  }, []);

  const stamp = info.name;

  return (
    <div className="relative" style={{ userSelect: "none" }}>
      {/* Watermark overlay */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {/* Grid of watermark stamps */}
        {Array.from({ length: 120 }).map((_, i) => {
          const row = Math.floor(i / 10);
          const col = i % 10;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${col * 10 + 2}%`,
                top: `${row * 9 + 1}%`,
                fontSize: "10px",
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.045)",
                whiteSpace: "nowrap",
                transform: "rotate(-35deg)",
                transformOrigin: "center",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
            >
              {stamp}
            </div>
          );
        })}
      </div>

      {/* Print watermark — much more visible when printing */}
      <style>{`
        @media print {
          body::before {
            content: "${stamp.replace(/"/g, "'")} · ${stamp.replace(/"/g, "'")} · ${stamp.replace(/"/g, "'")}";
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 14px;
            color: rgba(0,0,0,0.18) !important;
            white-space: pre;
            line-height: 2.5;
            word-spacing: 30px;
            pointer-events: none;
            z-index: 99999;
            width: 200%;
            text-align: center;
            font-family: monospace;
          }
          @page { margin: 2cm; }
        }
      `}</style>

      {/* Context menu blocker */}
      <div
        onContextMenu={e => e.preventDefault()}
        style={{ WebkitUserSelect: "none", MozUserSelect: "none", msUserSelect: "none", userSelect: "none" } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
