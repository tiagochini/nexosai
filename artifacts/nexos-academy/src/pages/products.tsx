import { useState } from "react";
import { PRODUCTS } from "@/data/curriculum";

interface ProductsProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  hasAccess: boolean;
  onAccessGranted: (token?: string, productId?: string) => void;
  paymentSuccess?: boolean;
}

const API_BASE = "/api/academy";

export default function Products({ onNavigate, hasAccess, onAccessGranted, paymentSuccess }: ProductsProps) {
  // Checkout modal state (kept for token verification only)
  const [checkoutProduct, setCheckoutProduct] = useState<string | null>(null);
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkoutCpf, setCheckoutCpf] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  // Lead capture for paid products
  const [leadProduct, setLeadProduct] = useState<string | null>(null);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  // Token verification state
  const [token, setToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [tokenError, setTokenError] = useState("");

  // Free guide state
  const [freeEmail, setFreeEmail] = useState("");
  const [freeSubmitted, setFreeSubmitted] = useState(false);
  const [freeLoading, setFreeLoading] = useState(false);

  const freeProduct = PRODUCTS.find(p => p.type === "free");
  const paidProducts = PRODUCTS.filter(p => p.type !== "free");

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!checkoutProduct) return;
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      const resp = await fetch(`${API_BASE}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: checkoutName,
          email: checkoutEmail,
          cpfCnpj: checkoutCpf.replace(/\D/g, ""),
          productId: checkoutProduct,
        }),
      });
      const data = await resp.json() as { paymentUrl?: string; alreadyPurchased?: boolean; message?: string; error?: string };
      if (data.alreadyPurchased) {
        setCheckoutProduct(null);
        setCheckoutError("");
        alert(data.message ?? "Reenviamos o código para o seu e-mail.");
        return;
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      setCheckoutError(data.error ?? "Erro ao processar. Tente novamente.");
    } catch {
      setCheckoutError("Sem conexão. Verifique sua internet e tente novamente.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleVerifyToken(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setVerifying(true);
    setTokenError("");
    try {
      const resp = await fetch(`${API_BASE}/verify/${encodeURIComponent(token.trim().toUpperCase())}`);
      const data = await resp.json() as { valid?: boolean; productId?: string; error?: string; email?: string; name?: string };
      if (data.valid) {
        if (data.productId === "mini-guide") {
          onAccessGranted(token.trim().toUpperCase(), "mini-guide");
          onNavigate("mini-guide");
          return;
        }
        if (data.productId !== "complete-bundle") {
          setTokenError("Código inválido para este portal. Verifique o produto adquirido.");
          return;
        }
        onAccessGranted(token.trim().toUpperCase());
      } else {
        setTokenError(data.error ?? "Código inválido.");
      }
    } catch {
      setTokenError("Sem conexão. Verifique sua internet.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleLeadCapture(e: React.FormEvent) {
    e.preventDefault();
    if (!leadProduct || !leadEmail.trim()) return;
    setLeadLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      await fetch("/api/academy/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: leadName.trim() || undefined,
          email: leadEmail.trim(),
          source: `${leadProduct}-interest`,
          utmSource: params.get("utm_source") ?? undefined,
          utmMedium: params.get("utm_medium") ?? undefined,
          utmCampaign: params.get("utm_campaign") ?? undefined,
        }),
      });
    } catch {
      // best-effort
    } finally {
      setLeadLoading(false);
      setLeadSubmitted(true);
    }
  }

  async function handleFreeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!freeEmail.trim()) return;
    setFreeLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      await fetch("/api/academy/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: freeEmail.trim(),
          source: "free-guide",
          utmSource: params.get("utm_source") ?? undefined,
          utmMedium: params.get("utm_medium") ?? undefined,
          utmCampaign: params.get("utm_campaign") ?? undefined,
        }),
      });
    } catch {
      // best-effort — still show success
    } finally {
      setFreeLoading(false);
      setFreeSubmitted(true);
    }
  }

  return (
    <div className="space-y-10 max-w-3xl mx-auto">

      {/* Payment success banner */}
      {paymentSuccess && !hasAccess && (
        <div className="rounded-xl border border-[hsl(168_100%_42%/0.3)] bg-[hsl(168_100%_42%/0.06)] p-6 text-center space-y-3">
          <div className="text-3xl">📧</div>
          <h3 className="text-lg font-bold text-white">Pagamento confirmado — verifique seu e-mail!</h3>
          <p className="text-sm text-[hsl(220_10%_55%)]">Assim que o pagamento for processado (pode levar alguns minutos), você receberá um e-mail com seu código de acesso. Cole-o abaixo:</p>
        </div>
      )}

      {/* Access code input — shown when no access yet */}
      {!hasAccess && (
        <div className="card-nexos rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-1">Já adquiriu? Insira seu código de acesso</h3>
          <p className="text-xs text-[hsl(220_10%_50%)] mb-4">Após o pagamento confirmado, você recebe um código por e-mail. Cole aqui para desbloquear o portal.</p>
          <form onSubmit={handleVerifyToken} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={token}
              onChange={e => setToken(e.target.value.toUpperCase())}
              placeholder="Ex: A1B2-C3D4-E5F6"
              maxLength={16}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[hsl(222_25%_10%)] border border-[hsl(220_20%_12%)] text-white text-sm font-mono placeholder:text-[hsl(220_10%_30%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.4)] uppercase tracking-widest"
            />
            <button
              type="submit"
              disabled={verifying || !token.trim()}
              className="btn-primary shrink-0"
            >
              {verifying ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Verificando...
                </span>
              ) : "Ativar Acesso →"}
            </button>
          </form>
          {tokenError && (
            <p className="text-xs text-red-400 mt-2">{tokenError}</p>
          )}
        </div>
      )}

      {/* Already has access banner */}
      {hasAccess && (
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: "linear-gradient(135deg, hsl(168 100% 42% / 0.08), hsl(250 90% 60% / 0.08))",
            border: "1px solid hsl(168 100% 42% / 0.25)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
              style={{ background: "hsl(168 100% 42% / 0.15)", border: "1px solid hsl(168 100% 42% / 0.3)" }}
            >
              ✓
            </div>
            <div>
              <p className="font-bold text-white">Acesso Completo Ativado</p>
              <p className="text-xs mt-0.5" style={{ color: "hsl(220 10% 50%)" }}>
                Todos os produtos do ecossistema NexOS estão disponíveis para você.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              className="btn-primary py-3 font-bold text-sm"
              style={{ background: "linear-gradient(135deg, hsl(250 90% 55%), hsl(270 80% 50%))" }}
              onClick={() => onNavigate("modules")}
            >
              📚 Acessar Curso Completo →
            </button>
            <button
              className="btn-primary py-3 font-bold text-sm"
              onClick={() => onNavigate("mini-guide")}
            >
              📖 Acessar Mini-Guia R$97 →
            </button>
          </div>
        </div>
      )}

      {/* Free lead magnet */}
      {freeProduct && (
        <div className="card-nexos rounded-2xl p-8 border-[hsl(168_100%_42%/0.2)]" style={{ boxShadow: "0 0 30px hsl(168 100% 42% / 0.04)" }}>
          <div className="flex justify-center mb-4">
            <span className="px-4 py-1 rounded-full text-sm font-semibold" style={{ background: "hsl(168 100% 42% / 0.12)", color: "hsl(168 100% 55%)", border: "1px solid hsl(168 100% 42% / 0.25)" }}>
              🎁 {freeProduct.badge} — Sem custo
            </span>
          </div>
          <h3 className="text-xl font-bold text-white text-center mb-2">{freeProduct.name}</h3>
          <p className="text-[hsl(220_10%_60%)] text-sm text-center mb-6">{freeProduct.description}</p>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            <ul className="flex-1 space-y-2">
              {freeProduct.features.map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-[hsl(220_10%_70%)]">
                  <span className="w-4 h-4 rounded-full bg-[hsl(168_100%_42%/0.1)] flex items-center justify-center text-[hsl(168_100%_50%)] text-xs shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="md:w-64 shrink-0 w-full">
              {freeSubmitted ? (
                <div className="card-nexos rounded-xl p-5 text-center space-y-3">
                  <div className="text-3xl">✅</div>
                  <p className="text-sm font-semibold text-white">PDF enviado!</p>
                  <p className="text-xs text-[hsl(220_10%_50%)]">Verifique sua caixa de entrada.</p>
                </div>
              ) : (
                <form onSubmit={handleFreeSubmit} className="card-nexos rounded-xl p-5 space-y-3">
                  <p className="text-xs text-center text-[hsl(220_10%_55%)]">Informe seu e-mail para receber o PDF grátis</p>
                  <input
                    type="email"
                    required
                    value={freeEmail}
                    onChange={e => setFreeEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-3 py-2 rounded-lg bg-[hsl(222_25%_10%)] border border-[hsl(220_20%_12%)] text-white text-sm placeholder:text-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.4)]"
                  />
                  <button type="submit" disabled={freeLoading} className="btn-primary w-full" style={{ background: "hsl(168 100% 38%)" }}>
                    {freeLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Enviando...
                      </span>
                    ) : "Receber PDF Grátis →"}
                  </button>
                  <p className="text-[10px] text-center text-[hsl(220_10%_35%)]">Sem spam. Cancelamento a qualquer momento.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paid products */}
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Adquira a Metodologia</h2>
          <p className="text-[hsl(220_10%_55%)]">Acesso vitalício ao portal de treinamento completo.</p>
        </div>

        <div className="space-y-5">
          {paidProducts.map(product => (
            <div
              key={product.id}
              className={`card-nexos rounded-2xl p-8 ${product.type === "premium" ? "border-[hsl(40_95%_55%/0.25)]" : ""}`}
              style={product.type === "premium" ? { boxShadow: "0 0 30px hsl(40 95% 55% / 0.06)" } : {}}
            >
              {product.type === "premium" && (
                <div className="flex justify-center mb-4">
                  <span className="badge-primary badge-gold text-sm px-4 py-1 rounded-full">
                    ⭐ Mais Popular — Edição Completa
                  </span>
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge-primary ${product.type === "premium" ? "badge-gold" : ""}`}>{product.badge}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{product.name}</h3>
                  <p className="text-[hsl(220_10%_60%)] text-sm leading-relaxed mb-5">{product.description}</p>
                  <ul className="space-y-2">
                    {product.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-[hsl(220_10%_70%)]">
                        <span className="w-4 h-4 rounded-full bg-[hsl(168_100%_42%/0.1)] flex items-center justify-center text-[hsl(168_100%_50%)] text-xs shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="md:w-52 shrink-0 flex flex-col gap-3">
                  {hasAccess ? (
                    product.type === "premium" ? (
                      <button
                        className="btn-primary w-full py-3 font-bold"
                        style={{ background: "var(--gradient-gold)" }}
                        onClick={() => onNavigate("modules")}
                      >
                        ✓ Acessar o Curso →
                      </button>
                    ) : (
                      <button
                        className="btn-primary w-full py-3 font-bold"
                        onClick={() => onNavigate("mini-guide")}
                      >
                        ✓ Acessar Mini-Guia →
                      </button>
                    )
                  ) : (
                    <>
                      <button
                        className="btn-primary w-full py-3 font-bold"
                        style={product.type === "premium" ? { background: "var(--gradient-gold)" } : {}}
                        onClick={() => {
                          setLeadProduct(product.id);
                          setLeadName("");
                          setLeadEmail("");
                          setLeadSubmitted(false);
                        }}
                      >
                        Quero Saber Mais →
                      </button>
                      <p className="text-[10px] text-center" style={{ color: "hsl(220 10% 38%)" }}>
                        Receba informações por e-mail
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="card-nexos rounded-xl p-6">
        <h3 className="font-bold text-white mb-4">Perguntas Frequentes</h3>
        <div className="space-y-4">
          {[
            { q: "Por quanto tempo tenho acesso?", a: "Vitalício. Você também recebe 2 anos de atualizações gratuitas para a Edição Completa." },
            { q: "Como recebo o acesso após a compra?", a: "Imediatamente após o pagamento ser confirmado, enviamos um código por e-mail. Cole-o no portal para desbloquear todos os módulos." },
            { q: "Posso parcelar?", a: "Sim! A Edição Completa pode ser parcelada em até 12x no cartão. PIX e boleto também disponíveis." },
            { q: "Tem garantia?", a: "30 dias de garantia incondicional. Se não ficar satisfeito por qualquer motivo, devolvemos 100% do valor." },
          ].map((faq, i) => (
            <div key={i} className="border-b border-[hsl(220_20%_10%)] pb-4 last:border-0 last:pb-0">
              <p className="text-sm font-semibold text-white mb-1">{faq.q}</p>
              <p className="text-sm text-[hsl(220_10%_55%)]">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lead capture modal for paid products */}
      {leadProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          onClick={e => e.target === e.currentTarget && setLeadProduct(null)}
        >
          <div className="card-nexos rounded-2xl p-8 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Quero saber mais</h3>
                <p className="text-xs mt-0.5" style={{ color: "hsl(220 10% 50%)" }}>
                  {PRODUCTS.find(p => p.id === leadProduct)?.name}
                </p>
              </div>
              <button
                className="text-xl transition-colors"
                style={{ color: "hsl(220 10% 40%)" }}
                onClick={() => setLeadProduct(null)}
              >✕</button>
            </div>

            {leadSubmitted ? (
              <div className="text-center space-y-4 py-4">
                <div className="text-5xl">✅</div>
                <p className="text-white font-bold text-lg">Perfeito! Te avisamos em breve.</p>
                <p className="text-sm" style={{ color: "hsl(220 10% 55%)" }}>
                  Enviamos informações detalhadas para o seu e-mail. Fique de olho na caixa de entrada.
                </p>
                <button
                  className="btn-primary w-full mt-2"
                  onClick={() => setLeadProduct(null)}
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeadCapture} className="space-y-4">
                <div
                  className="rounded-xl p-4 text-sm"
                  style={{ background: "hsl(250 30% 8%)", border: "1px solid hsl(250 90% 65% / 0.15)" }}
                >
                  <p style={{ color: "hsl(250 90% 75%)" }} className="font-semibold mb-1">
                    Deixe seus dados e te enviamos tudo
                  </p>
                  <p style={{ color: "hsl(220 10% 50%)" }} className="text-xs">
                    Detalhes do conteúdo, condições especiais e como funciona o acesso.
                  </p>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: "hsl(220 10% 55%)" }}>Seu nome</label>
                  <input
                    type="text"
                    value={leadName}
                    onChange={e => setLeadName(e.target.value)}
                    placeholder="Como posso te chamar?"
                    className="w-full px-3 py-2.5 rounded-lg text-white text-sm placeholder:text-[hsl(220_10%_30%)] focus:outline-none"
                    style={{ background: "hsl(222 25% 10%)", border: "1px solid hsl(220 20% 12%)" }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: "hsl(220 10% 55%)" }}>Seu melhor e-mail *</label>
                  <input
                    type="email"
                    required
                    value={leadEmail}
                    onChange={e => setLeadEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-3 py-2.5 rounded-lg text-white text-sm placeholder:text-[hsl(220_10%_30%)] focus:outline-none"
                    style={{ background: "hsl(222 25% 10%)", border: "1px solid hsl(220 20% 12%)" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={leadLoading}
                  className="btn-primary w-full py-3 font-bold"
                  style={PRODUCTS.find(p => p.id === leadProduct)?.type === "premium" ? { background: "var(--gradient-gold)" } : {}}
                >
                  {leadLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Enviando...
                    </span>
                  ) : "Quero as Informações →"}
                </button>
                <p className="text-[10px] text-center" style={{ color: "hsl(220 10% 35%)" }}>
                  Sem spam. Você pode cancelar a qualquer momento.
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Checkout modal (token-based access) */}
      {checkoutProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={e => e.target === e.currentTarget && setCheckoutProduct(null)}
        >
          <div className="card-nexos rounded-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Finalizar Compra</h3>
              <button className="text-[hsl(220_10%_40%)] hover:text-white transition-colors text-xl" onClick={() => setCheckoutProduct(null)}>✕</button>
            </div>

            <div className="rounded-lg border border-[hsl(250_90%_65%/0.2)] bg-[hsl(250_30%_8%)] p-3 mb-6 text-sm text-center">
              <p className="text-[hsl(250_90%_75%)] font-semibold">
                {PRODUCTS.find(p => p.id === checkoutProduct)?.name}
              </p>
              <p className="text-[hsl(220_10%_50%)] text-xs mt-0.5">
                R${PRODUCTS.find(p => p.id === checkoutProduct)?.price.toLocaleString("pt-BR")} · Acesso imediato após confirmação
              </p>
            </div>

            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="text-xs text-[hsl(220_10%_55%)] mb-1.5 block">Nome completo</label>
                <input
                  type="text"
                  required
                  value={checkoutName}
                  onChange={e => setCheckoutName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-3 py-2.5 rounded-lg bg-[hsl(222_25%_10%)] border border-[hsl(220_20%_12%)] text-white text-sm placeholder:text-[hsl(220_10%_30%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.4)]"
                />
              </div>
              <div>
                <label className="text-xs text-[hsl(220_10%_55%)] mb-1.5 block">E-mail</label>
                <input
                  type="email"
                  required
                  value={checkoutEmail}
                  onChange={e => setCheckoutEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-[hsl(222_25%_10%)] border border-[hsl(220_20%_12%)] text-white text-sm placeholder:text-[hsl(220_10%_30%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.4)]"
                />
                <p className="text-[10px] text-[hsl(220_10%_40%)] mt-1">Seu código de acesso será enviado para este e-mail</p>
              </div>
              <div>
                <label className="text-xs text-[hsl(220_10%_55%)] mb-1.5 block">CPF ou CNPJ</label>
                <input
                  type="text"
                  required
                  value={checkoutCpf}
                  onChange={e => setCheckoutCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={18}
                  className="w-full px-3 py-2.5 rounded-lg bg-[hsl(222_25%_10%)] border border-[hsl(220_20%_12%)] text-white text-sm placeholder:text-[hsl(220_10%_30%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.4)]"
                />
              </div>
              {checkoutError && (
                <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{checkoutError}</p>
              )}
              <button
                type="submit"
                disabled={checkoutLoading}
                className="btn-primary w-full text-base py-3"
                style={PRODUCTS.find(p => p.id === checkoutProduct)?.type === "premium" ? { background: "var(--gradient-gold)" } : {}}
              >
                {checkoutLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Redirecionando...
                  </span>
                ) : "Ir para o Pagamento →"}
              </button>
              <p className="text-[10px] text-center text-[hsl(220_10%_35%)]">🔒 Pagamento seguro via Asaas · PIX, Boleto ou Cartão</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
