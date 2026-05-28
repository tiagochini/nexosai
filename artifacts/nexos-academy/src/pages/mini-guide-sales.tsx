import { useState } from "react";

const API_BASE = "/api/academy";

interface Props {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const FEATURES = [
  { icon: "📖", text: "10 capítulos práticos e densos — sem teoria vaga" },
  { icon: "✍️", text: "Scripts de copy prontos para copiar e usar agora" },
  { icon: "✅", text: "Checklist de 7 dias: um cliente pagante em 7 dias" },
  { icon: "🎯", text: "Estratégia 'Sem Seguidores' para quem está no zero" },
  { icon: "💬", text: "Matador de objeções com respostas exatas para cada situação" },
  { icon: "🪜", text: "Produto Escada — como ir de R$97 até R$10K no mesmo funil" },
  { icon: "🔄", text: "Acesso imediato + atualizações gratuitas vitalícias" },
];

const TESTIMONIALS = [
  {
    name: "Rafael S.", role: "Personal trainer · 380 seguidores",
    text: "Segui o checklist de 7 dias ao pé da letra. Fiz 9 vendas em 5 dias = R$3.573. Antes de criar qualquer conteúdo.",
    result: "R$3.573 em 5 dias",
  },
  {
    name: "Paulo M.", role: "Contabilista · sem redes sociais",
    text: "Usei só minha lista de WhatsApp com 180 contatos. Workshop de 3h. 34 inscrições na primeira semana. Gravei e vendi por mais 2 meses.",
    result: "R$10.795 total",
  },
  {
    name: "Camila R.", role: "Designer freelancer",
    text: "Estava há 11 meses estagnada em 3.200 seguidores. Apliquei a Estratégia de Infiltração do capítulo 3. 100 leads qualificados em 8 dias.",
    result: "Primeiros R$4.800",
  },
];

const CHAPTERS = [
  { n: "01", title: "O Mapa Mental do Primeiro R$", sub: "Por que 95% falha — e a única mudança que resolve" },
  { n: "02", title: "O Produto Certo para Começar", sub: "Como escolher o que vender antes de criar qualquer coisa" },
  { n: "03", title: "Estratégia de Infiltração", sub: "100 leads qualificados em 7 dias sem perfil e sem anúncios" },
  { n: "04", title: "Copy que Converte do Zero", sub: "A estrutura de mensagem que vende sem parecer vendedor" },
  { n: "05", title: "O Script de WhatsApp Perfeito", sub: "Palavra por palavra — do primeiro contato ao pagamento" },
  { n: "06", title: "Checklist de 7 Dias", sub: "Cada ação na ordem exata — um cliente pagante em 7 dias" },
  { n: "07", title: "Matador de Objeções", sub: '"Tá caro", "vou pensar", "não tenho tempo" — resposta exata para cada uma' },
  { n: "08", title: "Do Digital ao Escalável", sub: "Como transformar o primeiro resultado em receita recorrente" },
  { n: "09", title: "Tráfego sem Budget", sub: "Os 5 canais gratuitos que geram leads sem gastar R$1" },
  { n: "10", title: "Produto Escada", sub: "Como estruturar de R$97 até R$10K no mesmo funil perpétuo" },
];

export default function MiniGuideSales({ onNavigate }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${API_BASE}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          cpfCnpj: cpf.replace(/\D/g, ""),
          productId: "mini-guide",
        }),
      });
      const data = await resp.json() as { paymentUrl?: string; alreadyPurchased?: boolean; message?: string; error?: string };
      if (data.alreadyPurchased) {
        setError(data.message ?? "Você já tem acesso! Verifique seu e-mail.");
        return;
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      setError(data.error ?? "Erro ao processar. Tente novamente.");
    } catch {
      setError("Sem conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "hsl(222 25% 4%)" }}>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(168 100% 42% / 0.12), transparent)" }} />
        <div className="max-w-4xl mx-auto px-4 pt-16 pb-12 text-center relative">

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-bold uppercase tracking-widest"
            style={{ background: "hsl(168 100% 42% / 0.12)", color: "hsl(168 100% 60%)", border: "1px solid hsl(168 100% 42% / 0.3)" }}>
            🔥 Mais Vendido · Acesso Imediato
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
            Mapa dos Primeiros{" "}
            <span style={{ background: "linear-gradient(135deg, hsl(168 100% 55%), hsl(168 100% 40%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              R$10K
            </span>
            {" "}em Vendas Online
          </h1>

          <p className="text-xl text-[hsl(220_10%_65%)] leading-relaxed max-w-2xl mx-auto mb-4">
            O guia operacional de 10 capítulos para sair do zero e chegar aos primeiros 5 dígitos em vendas online —
            <strong className="text-white"> mesmo sem produto pronto, sem seguidores, sem equipe</strong>.
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-sm text-[hsl(220_10%_55%)] mb-10">
            <span>✓ Scripts prontos para copiar</span>
            <span>✓ Checklist de 7 dias</span>
            <span>✓ Estratégia sem seguidores</span>
            <span>✓ Acesso imediato</span>
          </div>

          {/* PRICE + CTA */}
          <div className="inline-flex flex-col items-center gap-4 rounded-2xl p-8"
            style={{ background: "hsl(222 25% 7%)", border: "1px solid hsl(168 100% 42% / 0.3)", boxShadow: "0 0 60px hsl(168 100% 42% / 0.08)" }}>
            <div>
              <div className="flex items-baseline justify-center gap-3 mb-1">
                <span className="text-sm text-[hsl(220_10%_40%)] line-through">R$299</span>
                <span className="text-sm font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "hsl(168 100% 42% / 0.15)", color: "hsl(168 100% 60%)" }}>67% off</span>
              </div>
              <div className="text-5xl font-extrabold"
                style={{ background: "linear-gradient(135deg, hsl(168 100% 55%), hsl(168 100% 38%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                R$97
              </div>
              <p className="text-xs text-[hsl(220_10%_40%)] mt-1">pagamento único · acesso imediato · vitalício</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="w-full sm:w-64 py-4 rounded-xl text-white font-bold text-base transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, hsl(168 100% 38%), hsl(168 100% 28%))" }}
            >
              Quero o Mapa Agora →
            </button>
            <p className="text-xs text-[hsl(220_10%_40%)]">🔒 Garantia de 30 dias · Pagamento via Asaas (PIX, cartão, boleto)</p>
          </div>
        </div>
      </section>

      {/* FOR WHOM */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Este guia é para você se...</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            "Você quer gerar a primeira renda digital mas não sabe por onde começar",
            "Você tentou vender mas não teve resultado e não entende o porquê",
            "Você não tem seguidores, lista, produto pronto — e quer mudar isso em 7 dias",
            "Você tem um conhecimento que poderia ensinar mas não sabe como monetizar",
            "Você quer um método que funciona sem depender de anúncios pagos",
            "Você quer resultados rápidos sem perder meses aprendendo teoria",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl p-4"
              style={{ background: "hsl(222 25% 7%)", border: "1px solid hsl(220 20% 10%)" }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
                style={{ background: "hsl(168 100% 42% / 0.15)", color: "hsl(168 100% 55%)" }}>✓</span>
              <p className="text-sm text-[hsl(220_10%_70%)] leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CHAPTERS */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">O que você vai aprender</h2>
          <p className="text-[hsl(220_10%_55%)] text-sm">10 capítulos operacionais — sem teoria vaga, sem rodeios</p>
        </div>
        <div className="space-y-3">
          {CHAPTERS.map((ch) => (
            <div key={ch.n} className="flex items-start gap-4 rounded-xl p-4"
              style={{ background: "hsl(222 25% 7%)", border: "1px solid hsl(220 20% 10%)" }}>
              <span className="text-xs font-extrabold tabular-nums shrink-0 mt-0.5"
                style={{ color: "hsl(168 100% 50%)" }}>{ch.n}</span>
              <div>
                <p className="text-sm font-bold text-white">{ch.title}</p>
                <p className="text-xs text-[hsl(220_10%_50%)] mt-0.5">{ch.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="rounded-2xl p-8"
          style={{ background: "hsl(222 25% 7%)", border: "1px solid hsl(168 100% 42% / 0.2)" }}>
          <h2 className="text-xl font-bold text-white mb-6 text-center">O que está incluso</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg shrink-0">{f.icon}</span>
                <p className="text-sm text-[hsl(220_10%_70%)]">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Resultados reais de quem aplicou</h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="rounded-xl p-5 flex flex-col gap-3"
              style={{ background: "hsl(222 25% 7%)", border: "1px solid hsl(220 20% 10%)" }}>
              <div className="inline-block text-sm font-bold px-3 py-1 rounded-full self-start"
                style={{ background: "hsl(168 100% 42% / 0.12)", color: "hsl(168 100% 55%)" }}>
                {t.result}
              </div>
              <p className="text-sm text-[hsl(220_10%_65%)] leading-relaxed italic flex-1">"{t.text}"</p>
              <div>
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="text-xs text-[hsl(220_10%_40%)]">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid hsl(168 100% 42% / 0.35)", boxShadow: "0 0 60px hsl(168 100% 42% / 0.08)" }}>
          <div className="p-8" style={{ background: "linear-gradient(135deg, hsl(168 100% 8% / 0.6), hsl(250 30% 8%))" }}>
            <h2 className="text-2xl font-extrabold text-white mb-2">Pronto para os primeiros R$10K?</h2>
            <p className="text-[hsl(220_10%_60%)] text-sm mb-6">Acesso imediato após o pagamento. Comece hoje.</p>
            <div className="flex items-baseline justify-center gap-3 mb-6">
              <span className="text-sm text-[hsl(220_10%_40%)] line-through">R$299</span>
              <span className="text-4xl font-extrabold"
                style={{ background: "linear-gradient(135deg, hsl(168 100% 55%), hsl(168 100% 38%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                R$97
              </span>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-10 py-4 rounded-xl text-white font-bold text-base transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, hsl(168 100% 38%), hsl(168 100% 28%))" }}
            >
              Quero o Mapa Agora — R$97 →
            </button>
            <p className="text-xs text-[hsl(220_10%_35%)] mt-4">
              🔒 Garantia incondicional de 30 dias · PIX, cartão de crédito ou boleto
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate("products")}
          className="mt-6 text-xs text-[hsl(220_10%_35%)] hover:text-[hsl(220_10%_55%)] transition-colors"
        >
          Ver todos os produtos →
        </button>
      </section>

      {/* CHECKOUT MODAL */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}
        >
          <div className="w-full max-w-md rounded-2xl p-8"
            style={{ background: "hsl(222 25% 7%)", border: "1px solid hsl(168 100% 42% / 0.3)" }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Finalizar Compra</h3>
                <p className="text-xs text-[hsl(220_10%_50%)]">Mapa dos Primeiros R$10K — R$97</p>
              </div>
              <button
                className="text-[hsl(220_10%_40%)] hover:text-white transition-colors text-xl"
                onClick={() => setShowForm(false)}>✕</button>
            </div>

            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="text-xs text-[hsl(220_10%_55%)] mb-1.5 block">Nome completo</label>
                <input
                  type="text" required value={name} onChange={e => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-4 py-3 rounded-xl border text-white text-sm placeholder:text-[hsl(220_10%_30%)] focus:outline-none"
                  style={{ background: "hsl(222 25% 5%)", borderColor: "hsl(220 20% 14%)" }}
                />
              </div>
              <div>
                <label className="text-xs text-[hsl(220_10%_55%)] mb-1.5 block">E-mail</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 rounded-xl border text-white text-sm placeholder:text-[hsl(220_10%_30%)] focus:outline-none"
                  style={{ background: "hsl(222 25% 5%)", borderColor: "hsl(220 20% 14%)" }}
                />
              </div>
              <div>
                <label className="text-xs text-[hsl(220_10%_55%)] mb-1.5 block">CPF (opcional)</label>
                <input
                  type="text" value={cpf} onChange={e => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-4 py-3 rounded-xl border text-white text-sm placeholder:text-[hsl(220_10%_30%)] focus:outline-none"
                  style={{ background: "hsl(222 25% 5%)", borderColor: "hsl(220 20% 14%)" }}
                />
              </div>

              {error && <p className="text-sm text-red-400 text-center">{error}</p>}

              <button
                type="submit" disabled={loading}
                className="w-full py-4 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 disabled:opacity-60 mt-2"
                style={{ background: "linear-gradient(135deg, hsl(168 100% 38%), hsl(168 100% 28%))" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Processando...
                  </span>
                ) : "Pagar R$97 →"}
              </button>

              <p className="text-xs text-center text-[hsl(220_10%_35%)]">
                Você será redirecionado para o ambiente seguro do Asaas
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
