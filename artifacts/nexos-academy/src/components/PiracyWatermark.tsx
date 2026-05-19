interface PiracyWatermarkProps {
  studentName?: string;
  studentEmail?: string;
  visible?: boolean;
}

export default function PiracyWatermark({ studentName, studentEmail, visible = true }: PiracyWatermarkProps) {
  if (!visible) return null;

  const label = [studentName, studentEmail].filter(Boolean).join(" · ") || "Conteúdo Protegido";
  const now = new Date().toLocaleDateString("pt-BR");
  const text = `${label} · ${now} · NexOS Academy`;

  const lines: { x: number; y: number; rotate: number }[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      lines.push({
        x: 5 + col * 26,
        y: 8 + row * 13,
        rotate: -22,
      });
    }
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-0 overflow-hidden z-[100]"
      style={{ userSelect: "none" }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ userSelect: "none" }}
      >
        {lines.map((l, i) => (
          <text
            key={i}
            x={`${l.x}%`}
            y={`${l.y}%`}
            transform={`rotate(${l.rotate}, 0, 0)`}
            fill="rgba(255,255,255,0.045)"
            fontSize="11"
            fontFamily="monospace"
            fontWeight="600"
            letterSpacing="0.5"
            style={{ userSelect: "none" }}
          >
            {text}
          </text>
        ))}
      </svg>
    </div>
  );
}
