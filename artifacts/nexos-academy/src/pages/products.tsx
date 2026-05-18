import { useState } from "react";
import { PRODUCTS } from "@/data/curriculum";

interface ProductsProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  hasAccess: boolean;
  onAccessGranted: () => void;
}

export default function Products({ onNavigate, hasAccess, onAccessGranted }: ProductsProps) {
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchased, setPurchased] = useState<Record<string, boolean>>({});
  const [freeEmail, setFreeEmail] = useState("");
  const [freeSubmitted, setFreeSubmitted] = useState(false);
  const [freeLoading, setFreeLoading] = useState(false);

  function handleBuy(productId: string, productType: string) {
    setPurchasing(productId);
    setTimeout(() => {
      setPurchasing(null);
      setPurchased(p => ({ ...p, [productId]: true }));
      if (productType === "premium") {
        onAccessGranted();
      }
    }, 2000);
  }

  function handleFreeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!freeEmail.trim()) return;
    setFreeLoading(true);
    setTimeout(() => {
      setFreeLoading(false);
      setFreeSubmitted(true);
    }, 1500);
  }

  const freeProduct = PRODUCTS.find(p => p.type === "free");
  const paidProducts = PRODUCTS.filter(p => p.type !== "free");

  return (
    <div className="space-y-10 max-w-3xl mx-auto">

      {/* Free lead magnet */}
      {freeProduct && (
        <div className="card-nexos rounded-2xl p-8 border-[hsl(168_100%_42%/0.2)]" style={{ boxShadow: "0 0 30px hsl(168 100% 42% / 0.04)" }}>
          <div className="flex justify-center mb-4">
            <span className="badge-primary text-sm px-4 py-1 rounded-full" style={{ background: "hsl(168 100% 42% / 0.12)", color: "hsl(168 100% 55%)", border: "1px solid hsl(168 100% 42% / 0.25)" }}>
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
                  <p className="text-xs text-[hsl(220_10%_50%)]">Verifique sua caixa de entrada (e o spam, só por garantia).</p>
                  <button className="btn-outline w-full text-xs" onClick={() => setFreeSubmitted(false)}>
                    Enviar para outro e-mail
                  </button>
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
                  <button
                    type="submit"
                    disabled={freeLoading}
                    className="btn-primary w-full"
                    style={{ background: "hsl(168 100% 38%)" }}
                  >
                    {freeLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Enviando...
                      </span>
                    ) : (
                      "Receber PDF Grátis →"
                    )}
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
          <p className="text-[hsl(220_10%_55%)]">
            Escolha o produto que melhor se encaixa na sua fase de negócio.
          </p>
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

              {/* Already has access banner */}
              {hasAccess && product.type === "premium" && (
                <div className="flex items-center gap-3 mb-5 rounded-lg border border-[hsl(168_100%_42%/0.2)] bg-[hsl(168_100%_42%/0.06)] px-4 py-3">
                  <span className="text-[hsl(168_100%_50%)]">✓</span>
                  <span className="text-sm text-[hsl(168_100%_60%)] font-semibold">Você já tem acesso a este produto</span>
                  <button className="btn-outline text-xs px-3 py-1 ml-auto" onClick={() => onNavigate("modules")}>
                    Acessar →
                  </button>
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge-primary ${product.type === "premium" ? "badge-gold" : ""}`}>
                      {product.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{product.name}</h3>
                  <p className="text-[hsl(220_10%_60%)] text-sm leading-relaxed mb-5">{product.description}</p>

                  <ul className="space-y-2">
                    {product.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-[hsl(220_10%_70%)]">
                        <span className="w-4 h-4 rounded-full bg-[hsl(168_100%_42%/0.1)] flex items-center justify-center text-[hsl(168_100%_50%)] text-xs shrink-0">
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="md:w-64 shrink-0">
                  <div className="card-nexos rounded-xl p-5 text-center">
                    {product.type === "premium" && (
                      <div className="mb-2">
                        <span className="text-xs text-[hsl(220_10%_40%)] line-through">R$4.500</span>
                        <span className="text-xs text-[hsl(168_100%_50%)] ml-2">44% off</span>
                      </div>
                    )}
                    <div
                      className="text-4xl font-extrabold mb-1"
                      style={{ background: product.type === "premium" ? "var(--gradient-gold)" : "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                    >
                      R${product.price.toLocaleString("pt-BR")}
                    </div>
                    {product.type === "premium" ? (
                      <p className="text-xs text-[hsl(220_10%_45%)] mb-4">
                        ou até 12x de R${(product.price / 12).toFixed(2).replace(".", ",")}
                      </p>
                    ) : (
                      <p className="text-xs text-[hsl(220_10%_45%)] mb-4">pagamento único</p>
                    )}

                    {purchased[product.id] ? (
                      <div className="space-y-2">
                        <div className="w-full py-3 rounded-lg bg-[hsl(168_100%_42%/0.1)] border border-[hsl(168_100%_42%/0.2)] text-[hsl(168_100%_50%)] text-sm font-semibold">
                          ✓ Compra Realizada!
                        </div>
                        {product.type === "premium" && (
                          <button className="btn-primary w-full" onClick={() => onNavigate("modules")}>
                            Acessar o Curso →
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        className="btn-primary w-full"
                        disabled={purchasing === product.id}
                        onClick={() => handleBuy(product.id, product.type)}
                        style={product.type === "premium" ? { background: "var(--gradient-gold)" } : {}}
                      >
                        {purchasing === product.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Processando...
                          </span>
                        ) : (
                          `Comprar Agora — R$${product.price.toLocaleString("pt-BR")}`
                        )}
                      </button>
                    )}

                    {product.type === "premium" && (
                      <p className="text-xs text-[hsl(220_10%_40%)] mt-3">
                        🔒 Garantia de 30 dias · Acesso imediato
                      </p>
                    )}
                  </div>
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
            {
              q: "Por quanto tempo tenho acesso?",
              a: "O acesso é vitalício. Você também recebe 2 anos de atualizações gratuitas para a Edição Completa."
            },
            {
              q: "O conteúdo é para iniciantes?",
              a: "O Módulo 1 cobre fundamentos completos. Os módulos avançados são mais densos. Recomendamos para quem já vendeu algo online ou quer aprender de forma estruturada."
            },
            {
              q: "Posso parcelar?",
              a: "Sim! A Edição Completa pode ser parcelada em até 12x no cartão. Para boleto, apenas à vista."
            },
            {
              q: "Tem garantia?",
              a: "30 dias de garantia incondicional. Se não ficar satisfeito por qualquer motivo, devolvemos 100% do valor."
            }
          ].map((faq, i) => (
            <div key={i} className="border-b border-[hsl(220_20%_10%)] pb-4 last:border-0 last:pb-0">
              <p className="text-sm font-semibold text-white mb-1">{faq.q}</p>
              <p className="text-sm text-[hsl(220_10%_55%)]">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
