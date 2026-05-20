import { useState } from "react";

const CAPTURE_KEY = "nexos-lead-captured";
const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/../../api";

interface Props {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

type Stage = "capture" | "guide";

const ERRORS = [
  {
    n: "01",
    titulo: "Criar o produto antes de validar a demanda",
    descricao: "A maioria passa meses gravando aulas, montando área de membros e contratando designer — antes de saber se alguém vai comprar. Quando finalmente lançam, descobrem que o mercado não queria aquilo do jeito que entregaram.",
    exemplo: "Mariana gravou 40 aulas de culinária funcional ao longo de 4 meses. Lançou e vendeu 3 unidades. O problema? Ninguém tinha pedido um curso gravado — as pessoas da sua audiência queriam acompanhamento ao vivo. Ela descobriu isso só depois de gastar R$3.200 em produção.",
    correcao: "Lance primeiro, crie depois. Abra pré-venda ou lançamento semente com promessa de entrega. Se vender, você tem tudo para criar com foco. Se não vender, você descobriu sem gastar meses.",
    cor: "#f87171",
  },
  {
    n: "02",
    titulo: "Preço baseado em quanto você acha que vale",
    descricao: "Iniciantes tendem a precificar pelo que acham que merecem ou pelo que dariam — não pelo valor percebido pelo cliente. O resultado é preço baixo demais (que desvaloriza e dificulta lucro) ou alto demais sem estrutura de persuasão.",
    exemplo: "Carlos cobrou R$49 pelo seu curso de finanças pessoais porque 'estava começando e não queria assustar'. Vendeu 11 cópias = R$539. Com R$197, com o mesmo esforço de divulgação, teria vendido 8 = R$1.576. Preço mais alto, menos vendas, mais dinheiro.",
    correcao: "Pesquise o que concorrentes diretos cobram. O preço certo não é o mais barato — é o que a sua audiência específica está disposta a pagar dado o resultado prometido. Para maioria dos primeiros produtos: entre R$97 e R$497.",
    cor: "#fbbf24",
  },
  {
    n: "03",
    titulo: "Lançar para audiência fria sem aquecimento",
    descricao: "Você cria um post anunciando a oferta para seguidores que mal te conhecem, sem aquecimento prévio, sem construção de autoridade, sem conteúdo gratuito de valor. A conversão é quase zero.",
    exemplo: "Pedro lançou seu produto direto no feed sem preparação. Tinha 800 seguidores, nenhum conteúdo educativo, sem histórias pessoais. Resultado: 0 vendas. Ficou convencido de que 'o mercado estava saturado'.",
    correcao: "Aqueça por pelo menos 7 dias antes de lançar. Entregue valor gratuito, mostre seu processo, colete dúvidas via Stories, responda tudo. Só então apresente a oferta — para uma audiência que já te conhece e confia.",
    cor: "#a78bfa",
  },
  {
    n: "04",
    titulo: "Copy genérico que não fala com ninguém",
    descricao: "A maioria escreve como se quisesse agradar a todos — e acaba não tocando ninguém. Copy genérico não converte porque a pessoa lê e pensa 'não é bem isso que eu preciso'.",
    exemplo: "Amanda escreveu: 'Aprenda marketing digital do jeito certo. Para todos que querem crescer online.' Versus o que deveria ter escrito: 'Para mães CLT com menos de 2h por dia que querem uma renda extra de R$2k/mês sem depender de redes sociais.'",
    correcao: "Seja específico até doer. Quanto mais nicho o copy, mais a pessoa certa vai se sentir chamada. Genérico = invisível. Específico = magnético. Escreva para uma pessoa, não para todo mundo.",
    cor: "#34d399",
  },
  {
    n: "05",
    titulo: "Desistir após o primeiro lançamento fraco",
    descricao: "A maioria lança uma vez, não vende como esperava, e conclui que o negócio não funciona. O primeiro lançamento raramente é o melhor. É o aprendizado mais caro — e mais valioso.",
    exemplo: "Rodrigo lançou, fez 4 vendas quando esperava 20. Ficou dois meses sem lançar nada, desanimado. Quando voltou (por insistência de uma amiga), fez o segundo lançamento com os aprendizados do primeiro e teve 19 vendas.",
    correcao: "O segundo lançamento é sempre melhor que o primeiro. O terceiro, melhor que o segundo. Lance, colete dados, melhore uma coisa, relance. A constância bate a perfeição toda vez.",
    cor: "#c084fc",
  },
  {
    n: "06",
    titulo: "Ignorar o pós-venda completamente",
    descricao: "Após a venda, 70% dos empreendedores digitais iniciantes somem. O cliente recebe o produto e fica à deriva. Resultado: sem recompra, sem indicação, sem depoimento.",
    exemplo: "Juliana vendeu 15 vagas de um workshop. Entregou o conteúdo. Nunca mais entrou em contato. Três meses depois, zero indicações, zero recompras. Quando ela perguntou a umas delas, a resposta foi: 'Achei que tinha sido só uma venda e pronto.'",
    correcao: "Crie um onboarding básico: mensagem de boas-vindas, acompanhamento em D+7 e D+30, pedido de depoimento em D+14. O cliente que se sentiu cuidado indica naturalmente — e a indicação não custa nada.",
    cor: "#fb923c",
  },
  {
    n: "07",
    titulo: "Não construir lista — depender 100% das redes",
    descricao: "Quem depende só do Instagram ou TikTok está construindo em terreno alugado. Mudança de algoritmo, suspensão de conta, queda de alcance — qualquer um desses eventos pode zerar anos de trabalho em dias.",
    exemplo: "Thiago tinha 18 mil seguidores e faturava R$6k/mês em vendas diretas pelo Instagram. Em um fim de semana, sua conta foi suspensa por erro de sistema. Ficou 3 semanas sem conta e perdeu R$15k em receita que não aconteceu.",
    correcao: "Desde o primeiro dia: construa uma lista de email ou WhatsApp. Ofereça algo gratuito em troca do contato. Com 500 emails quentes, você fatura com ou sem Instagram. A lista é o único ativo que é 100% seu.",
    cor: "#f87171",
  },
];

const CHECKLIST_ITEMS = [
  "Eu validei que pessoas reais querem isso — não só que eu acho que querem",
  "Meu preço foi definido com base no valor percebido, não no que 'parece razoável'",
  "Aqueci minha audiência por pelo menos 7 dias antes de apresentar a oferta",
  "Meu copy é específico o suficiente para excluir quem não é meu cliente ideal",
  "Tenho comprometimento de lançar ao menos 3 vezes antes de desistir do produto",
  "Tenho um processo básico de pós-venda (boas-vindas, acompanhamento, pedido de depoimento)",
  "Estou coletando emails ou contatos de WhatsApp desde o início, não só seguidores",
];

function CaptureStage({ onCapture }: { onCapture: (name: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    setErrorMsg("");
    try {
      await fetch(`${API_BASE}/academy/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          source: "lead_magnet_guia_gratuito",
        }),
      });
      localStorage.setItem(CAPTURE_KEY, JSON.stringify({ name: name.trim(), email: email.trim() }));
      onCapture(name.trim());
    } catch {
      setErrorMsg("Erro ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(135deg, hsl(222 25% 5%) 0%, hsl(250 30% 8%) 50%, hsl(222 25% 5%) 100%)" }}
    >
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-bold uppercase tracking-widest"
            style={{ background: "hsl(250 90% 60% / 0.15)", color: "hsl(250 90% 75%)", border: "1px solid hsl(250 90% 60% / 0.3)" }}>
            🎁 Guia Gratuito · PDF
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            Os 7 Erros que{" "}
            <span style={{ background: "linear-gradient(135deg, hsl(250 90% 70%), hsl(270 80% 65%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Destroem
            </span>{" "}
            Lançamentos Digitais
          </h1>

          <p className="text-lg text-[hsl(220_10%_65%)] leading-relaxed mb-8">
            E como evitar cada um antes do seu próximo lançamento — com casos reais e o checklist de autodiagnóstico.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {["📄 12 páginas", "⚠️ 7 erros com casos reais", "✅ Checklist de autodiagnóstico"].map(item => (
              <span key={item} className="text-sm text-[hsl(220_10%_55%)] bg-[hsl(220_20%_8%)] px-4 py-1.5 rounded-full border border-[hsl(220_20%_13%)]">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "hsl(222 25% 7%)", border: "1px solid hsl(250 90% 60% / 0.2)" }}>
          <h2 className="text-lg font-bold text-white mb-1">Receba o guia agora — é gratuito</h2>
          <p className="text-sm text-[hsl(220_10%_50%)] mb-6">Sem spam. Cancele quando quiser.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[hsl(220_10%_50%)] uppercase tracking-widest mb-1.5">
                Seu nome
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Como você se chama?"
                className="w-full px-4 py-3 rounded-xl border text-white placeholder-[hsl(220_10%_30%)] text-sm focus:outline-none focus:ring-2 transition-all"
                style={{
                  background: "hsl(222 25% 5%)",
                  borderColor: "hsl(220 20% 14%)",
                  outline: "none",
                }}
                onFocus={e => (e.target.style.borderColor = "hsl(250 90% 60% / 0.6)")}
                onBlur={e => (e.target.style.borderColor = "hsl(220 20% 14%)")}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(220_10%_50%)] uppercase tracking-widest mb-1.5">
                Seu melhor email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full px-4 py-3 rounded-xl border text-white placeholder-[hsl(220_10%_30%)] text-sm focus:outline-none transition-all"
                style={{
                  background: "hsl(222 25% 5%)",
                  borderColor: "hsl(220 20% 14%)",
                }}
                onFocus={e => (e.target.style.borderColor = "hsl(250 90% 60% / 0.6)")}
                onBlur={e => (e.target.style.borderColor = "hsl(220 20% 14%)")}
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-400 text-center">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-white font-bold text-base tracking-wide transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 mt-2"
              style={{ background: "linear-gradient(135deg, hsl(250 90% 58%), hsl(270 80% 52%))" }}
            >
              {loading ? "Processando..." : "Acessar o Guia Gratuitamente →"}
            </button>

            <p className="text-xs text-center text-[hsl(220_10%_35%)] pt-1">
              🔒 Seus dados estão seguros. Nada de spam.
            </p>
          </form>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs text-[hsl(220_10%_40%)]">
          <span>✓ Acesso imediato</span>
          <span>✓ 100% gratuito</span>
          <span>✓ Sem cartão de crédito</span>
        </div>
      </div>
    </div>
  );
}

function GuideStage({ onNavigate, leadName }: { onNavigate: (page: string, params?: Record<string, string>) => void; leadName: string }) {
  function handlePrint() {
    window.print();
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #pdf-guide, #pdf-guide * { visibility: visible !important; }
          #pdf-guide { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: #111 !important; }
          .no-print { display: none !important; }
          .pdf-error-card { background: #fff5f5 !important; border: 1px solid #fca5a5 !important; }
          .pdf-fix-card { background: #f0fdf4 !important; border: 1px solid #86efac !important; }
          h1, h2, h3 { color: #111 !important; }
          p, span, li, label { color: #333 !important; }
          .pdf-header { background: #1e1b4b !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>

      <div id="pdf-guide" className="max-w-3xl mx-auto space-y-8 pb-16">
        {/* PDF Header bar */}
        <div className="pdf-header rounded-2xl p-6 flex items-center justify-between gap-4"
          style={{ background: "linear-gradient(135deg, hsl(250 40% 15%), hsl(250 30% 10%))", border: "1px solid hsl(250 90% 60% / 0.3)" }}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full text-white"
                style={{ background: "hsl(250 90% 60% / 0.3)", border: "1px solid hsl(250 90% 60% / 0.4)" }}>
                🎁 Guia Gratuito
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white leading-snug">
              Os 7 Erros do Primeiro Lançamento
            </h1>
            <p className="text-sm text-[hsl(220_10%_60%)] mt-1">
              {leadName ? `Preparado para ${leadName} · ` : ""}NexOS Academy · nexos.ai
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="no-print shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
            style={{ background: "hsl(250 90% 58%)", border: "1px solid hsl(250 90% 70% / 0.4)" }}
          >
            ↓ Baixar PDF
          </button>
        </div>

        {/* Intro */}
        <section className="card p-6 space-y-3">
          <h2 className="text-lg font-bold text-white">Por que 9 em cada 10 primeiros lançamentos falham?</h2>
          <p className="text-[hsl(220_10%_65%)] leading-relaxed text-sm">
            Não é falta de esforço. Não é falta de produto bom. É porque quem está começando comete os mesmos erros — sempre os mesmos, na mesma ordem — sem saber que existe um padrão claro que separa quem vende de quem fica frustrado.
          </p>
          <p className="text-[hsl(220_10%_65%)] leading-relaxed text-sm">
            Este guia documenta os 7 erros que mais se repetem, com exemplos reais de como eles acontecem e o que fazer diferente. Leia do começo ao fim antes do seu próximo lançamento.
          </p>
        </section>

        {/* Os 7 erros */}
        <section className="space-y-5">
          {ERRORS.map(erro => (
            <div key={erro.n} className="card p-6 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl font-extrabold shrink-0" style={{ color: erro.cor }}>#{erro.n}</span>
                <h3 className="text-white font-bold text-base leading-tight">{erro.titulo}</h3>
              </div>
              <p className="text-[hsl(220_10%_65%)] leading-relaxed text-sm">{erro.descricao}</p>
              <div className="pdf-error-card rounded-xl p-4 text-sm" style={{ background: "hsl(0 90% 65% / 0.05)", border: "1px solid hsl(0 90% 65% / 0.15)" }}>
                <p className="font-semibold text-xs uppercase tracking-wider mb-1.5" style={{ color: "hsl(0 90% 70%)" }}>📍 Caso real</p>
                <p className="text-[hsl(220_10%_65%)] leading-relaxed italic">{erro.exemplo}</p>
              </div>
              <div className="pdf-fix-card rounded-xl p-4 text-sm" style={{ background: "hsl(168 100% 42% / 0.05)", border: "1px solid hsl(168 100% 42% / 0.2)" }}>
                <p className="font-semibold text-xs uppercase tracking-wider mb-1.5" style={{ color: "hsl(168 100% 55%)" }}>✓ O que fazer</p>
                <p className="text-[hsl(220_10%_65%)] leading-relaxed">{erro.correcao}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Checklist */}
        <section className="card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Checklist de Autodiagnóstico</h2>
          <p className="text-[hsl(220_10%_65%)] text-sm">Antes do seu próximo lançamento, responda cada item honestamente:</p>
          <div className="space-y-3">
            {CHECKLIST_ITEMS.map((item, i) => (
              <label key={i} className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" className="mt-0.5 w-4 h-4 rounded shrink-0" style={{ accentColor: "hsl(250 90% 65%)" }} />
                <span className="text-sm text-[hsl(220_10%_65%)] group-hover:text-white transition-colors leading-relaxed">{item}</span>
              </label>
            ))}
          </div>
          <div className="pt-3 border-t border-[hsl(220_20%_12%)] text-xs text-[hsl(220_10%_40%)] space-y-0.5">
            <p>Se marcou menos de 5: há ajustes urgentes antes de lançar.</p>
            <p>Se marcou 5–6: seu lançamento tem boas chances com pequenos ajustes.</p>
            <p>Se marcou 7: você está pronto — foque na execução.</p>
          </div>
        </section>

        {/* CTA */}
        <section className="no-print rounded-2xl p-8 text-center space-y-4"
          style={{ background: "linear-gradient(135deg, hsl(222 25% 7%), hsl(250 30% 8%))", border: "1px solid hsl(250 90% 65% / 0.3)" }}>
          <h2 className="text-xl font-bold text-white">Quer o método completo?</h2>
          <p className="text-[hsl(220_10%_65%)] leading-relaxed text-sm max-w-md mx-auto">
            Este guia cobre os erros a evitar. A Metodologia NexOS cobre o caminho completo — do zero ao lançamento estruturado, com módulos de copy, tráfego, automação e IA.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => onNavigate("products")}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-opacity text-sm"
              style={{ background: "linear-gradient(135deg, hsl(250 90% 60%), hsl(270 80% 55%))" }}
            >
              Ver Metodologia NexOS Completa →
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:bg-[hsl(220_20%_12%)]"
              style={{ border: "1px solid hsl(220 20% 15%)", color: "hsl(220 10% 55%)" }}
            >
              ↓ Salvar como PDF
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

export default function LeadMagnet({ onNavigate }: Props) {
  const existing = (() => {
    try { return JSON.parse(localStorage.getItem(CAPTURE_KEY) ?? "null") as { name: string; email: string } | null; } catch { return null; }
  })();

  const [stage, setStage] = useState<Stage>(existing ? "guide" : "capture");
  const [leadName, setLeadName] = useState<string>(existing?.name ?? "");

  function handleCapture(name: string) {
    setLeadName(name);
    setStage("guide");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (stage === "capture") {
    return <CaptureStage onCapture={handleCapture} />;
  }

  return <GuideStage onNavigate={onNavigate} leadName={leadName} />;
}
