// Dynamic email values are text, never HTML supplied by a lead/customer.
export function escapeEmailHtml(value: string): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (character) => entities[character]!);
}

export function emailHref(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid Academy email link"); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Invalid Academy email link");
  }
  return escapeEmailHtml(url.href);
}

export function renderAccessEmailHtml(opts: {
  name: string; token: string; productName: string; portalUrl: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f0f14;color:#e2e8f0;border-radius:12px">
      <div style="text-align:center;margin-bottom:32px">
        <div style="display:inline-block;background:linear-gradient(135deg,#6d4aff,#a78bfa);border-radius:10px;padding:10px 16px;font-size:22px;font-weight:800;color:#fff">N</div>
        <p style="color:#a0aec0;margin-top:8px;font-size:14px">NexOS Academy</p>
      </div>
      <h1 style="color:#fff;font-size:24px;font-weight:700;margin-bottom:8px">Seu acesso está pronto, ${escapeEmailHtml(opts.name.split(" ")[0])}!</h1>
      <p style="color:#a0aec0;margin-bottom:24px">Sua compra de <strong style="color:#e2e8f0">${escapeEmailHtml(opts.productName)}</strong> foi confirmada. Use o código abaixo para acessar o portal:</p>
      <div style="background:#1a1a2e;border:1px solid #2d2d4a;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
        <p style="color:#a0aec0;font-size:12px;margin-bottom:8px;letter-spacing:0.1em;text-transform:uppercase">Seu Código de Acesso</p>
        <p style="font-size:32px;font-weight:800;color:#a78bfa;letter-spacing:4px;margin:0">${escapeEmailHtml(opts.token)}</p>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${emailHref(opts.portalUrl)}" style="display:inline-block;background:linear-gradient(135deg,#6d4aff,#a78bfa);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px">Acessar o Portal →</a>
      </div>
      <p style="color:#6b7280;font-size:12px;text-align:center">Guarde este código. Você precisará dele para acessar o portal em outros dispositivos.<br/>Suporte: suporte@agencianexos.vip</p>
    </div>
  `;
}
