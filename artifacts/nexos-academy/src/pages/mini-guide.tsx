import { useState } from "react";
import Watermark from "@/components/Watermark";
import { generateMiniGuidePDF } from "@/lib/generate-mini-guide-pdf";

interface MiniGuideProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  studentName?: string;
  studentEmail?: string;
}

export default function MiniGuide({ onNavigate, studentName, studentEmail }: MiniGuideProps) {
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    setGenerating(true);
    try {
      await generateMiniGuidePDF(
        studentName || "Leitor NexOS",
        studentEmail || "leitor@nexosacademy.com"
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Watermark>
      <div className="max-w-4xl mx-auto space-y-12 pb-24 px-4">
        {/* Barra de download fixa no topo */}
        <div className="sticky top-0 z-40 -mx-4 px-4 py-3 flex items-center justify-between gap-4"
          style={{ background: "hsl(222 25% 4% / 0.97)", borderBottom: "1px solid hsl(250 90% 65% / 0.2)", backdropFilter: "blur(8px)" }}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: "hsl(250 90% 65% / 0.15)", color: "hsl(250 90% 75%)", border: "1px solid hsl(250 90% 65% / 0.3)" }}>
              Manual de Guerra NexOS
            </span>
            {studentName && (
              <span className="text-xs text-[hsl(220_10%_40%)] hidden sm:block">
                Licenciado para {studentName}
              </span>
            )}
          </div>
          <button
            onClick={handleDownload}
            disabled={generating}
            className="shrink-0 flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, hsl(250 90% 58%), hsl(270 80% 52%))" }}
          >
            {generating ? "⏳ Gerando PDF..." : "↓ Baixar PDF"}
          </button>
        </div>
        {/* Header Profissional */}
        <div className="rounded-3xl border border-[hsl(250_90%_65%/0.3)] bg-gradient-to-br from-[hsl(222_25%_7%)] to-[hsl(250_30%_8%)] p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[hsl(250_90%_65%/0.1)] blur-3xl -mr-20 -mt-20 rounded-full"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-[hsl(250_90%_65%/0.2)] text-[hsl(250_90%_75%)] border border-[hsl(250_90%_65%/0.3)]">
                Manual de Guerra NexOS
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              O Mapa para os Primeiros <span className="text-[hsl(250_90%_65%)]">R$ 10.000</span> em Vendas Online
            </h1>
            <p className="text-[hsl(220_10%_70%)] text-xl leading-relaxed mb-8 max-w-2xl">
              Você não precisa de um exército. Você precisa de uma sequência. Este guia não é teoria — é o plano operacional para quem quer sair do zero e chegar aos 5 dígitos no Brasil real.
            </p>
            <div className="flex flex-wrap gap-6 text-sm text-[hsl(220_10%_55%)] font-medium">
              <div className="flex items-center gap-2">
                <span className="text-[hsl(250_90%_65%)]">⚡</span> 10 Capítulos Práticos
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[hsl(250_90%_65%)]">⚡</span> Scripts de Copy Prontos
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[hsl(250_90%_65%)]">⚡</span> Estratégia "Sem Seguidores"
              </div>
            </div>
          </div>
        </div>

        {/* Capítulo 1: O Bloqueio Mental */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(250_90%_65%)] text-white text-xl font-black flex items-center justify-center shadow-[0_0_20px_hsl(250_90%_65%/0.3)]">
              01
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">O Fim das Desculpas</h2>
              <p className="text-[hsl(220_10%_50%)] text-sm font-medium">Professor Allan: "Onde o amador trava e o profissional fatura"</p>
            </div>
          </div>
          <div className="card-nexos p-8 space-y-6 border-l-4 border-l-[hsl(250_90%_65%)]">
            <p className="text-lg text-white font-medium leading-relaxed italic">
              "Você não está vendendo porque está tentando ser perfeito. E a perfeição é o disfarce covarde da procrastinação."
            </p>
            <p className="text-[hsl(220_10%_65%)] leading-relaxed">
              Existem 3 bloqueios que matam iniciantes antes do Dia 1:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[hsl(222_25%_5%)] border border-[hsl(220_20%_15%)]">
                <p className="text-[hsl(250_90%_75%)] font-bold mb-1">1. "Não tenho autoridade"</p>
                <p className="text-xs text-[hsl(220_10%_50%)]">A autoridade não é dada, é tomada. Se você resolve um problema, você é o perito para quem tem aquele problema.</p>
              </div>
              <div className="p-4 rounded-xl bg-[hsl(222_25%_5%)] border border-[hsl(220_20%_15%)]">
                <p className="text-[hsl(250_90%_75%)] font-bold mb-1">2. "O produto não está pronto"</p>
                <p className="text-xs text-[hsl(220_10%_50%)]">Vender produto pronto é coisa de amador. Profissional vende a promessa e cria com o dinheiro do cliente no bolso.</p>
              </div>
              <div className="p-4 rounded-xl bg-[hsl(222_25%_5%)] border border-[hsl(220_20%_15%)]">
                <p className="text-[hsl(250_90%_75%)] font-bold mb-1">3. "Não tenho seguidores"</p>
                <p className="text-xs text-[hsl(220_10%_50%)]">Seguidor é métrica de ego. Dinheiro no bolso vem de atenção direcionada. 10 pessoas certas valem mais que 10.000 curiosos.</p>
              </div>
            </div>
            <div className="bg-[hsl(250_90%_65%/0.05)] border border-[hsl(250_90%_65%/0.2)] p-4 rounded-xl">
              <p className="text-sm font-bold text-white mb-2">🔥 Exercício Imediato:</p>
              <p className="text-sm text-[hsl(220_10%_65%)]">
                Escreva em uma folha: "Eu não preciso de permissão para vender. Eu só preciso de um problema para resolver." Cole no seu monitor.
              </p>
            </div>
          </div>
        </section>

        {/* Capítulo 2: Validação Flash */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(250_90%_65%)] text-white text-xl font-black flex items-center justify-center">02</div>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Validação Flash (Em 2 horas)</h2>
              <p className="text-[hsl(220_10%_50%)] text-sm font-medium">Como saber se seu tema põe dinheiro no bolso antes de gastar um centavo</p>
            </div>
          </div>
          <div className="card-nexos p-8 space-y-6">
            <p className="text-[hsl(220_10%_65%)] leading-relaxed">
              Não pergunte se as pessoas comprariam. <strong className="text-white text-lg underline decoration-[hsl(250_90%_65%)]">Dê a elas a chance de comprar.</strong> A única pesquisa de mercado real é o comprovante de Pix.
            </p>
            
            <div className="space-y-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[hsl(168_100%_42%)] text-[hsl(222_25%_7%)] text-xs flex items-center justify-center font-black">!</span>
                O Protocolo de 2 Horas:
              </h3>
              <ol className="space-y-3 text-[hsl(220_10%_65%)] text-sm">
                <li className="flex gap-3"><span className="text-[hsl(250_90%_75%)] font-bold">01.</span> Pesquise no TikTok/Insta: "Como [seu tema]". Se tiver vídeos com +50k views, o mercado existe.</li>
                <li className="flex gap-3"><span className="text-[hsl(250_90%_75%)] font-bold">02.</span> Leia os comentários. Procure por: "Eu tenho dificuldade em...", "Como eu faço pra...".</li>
                <li className="flex gap-3"><span className="text-[hsl(250_90%_75%)] font-bold">03.</span> Crie uma oferta de "Acompanhamento Único" ou "Mentoria Experimental" para resolver EXATAMENTE o que eles comentaram.</li>
              </ol>
            </div>

            <div className="p-6 rounded-2xl bg-[hsl(222_25%_4%)] border border-[hsl(250_90%_65%/0.2)]">
              <p className="text-xs font-black text-[hsl(250_90%_65%)] uppercase tracking-[0.2em] mb-4">Exemplo Real - O Caso da Marmita</p>
              <p className="text-sm text-[hsl(220_10%_60%)] leading-relaxed">
                Aline sabia cozinhar saudável. Em vez de curso de culinária, ela viu que as pessoas reclamavam de "falta de tempo para organizar a semana".
                <br /><br />
                <strong className="text-white">Ação:</strong> Ela mandou 5 mensagens no WhatsApp para amigas ocupadas: "Vou fazer um grupo de 3 dias ensinando a organizar 15 marmitas em 2h por R$47. Topa?". 
                <br /><br />
                <strong className="text-[hsl(168_100%_42%)]">Resultado:</strong> 4 pagaram em 15 minutos. <strong className="text-white">Validação concluída com R$188 no bolso.</strong>
              </p>
            </div>
          </div>
        </section>

        {/* Capítulo 3: Audiência Rápida (Sem Seguidores) */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(250_90%_65%)] text-white text-xl font-black flex items-center justify-center shadow-[0_0_20px_hsl(250_90%_65%/0.3)]">03</div>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Audiência Rápida: 100 Leads em 7 Dias</h2>
              <p className="text-[hsl(220_10%_50%)] text-sm font-medium">O método da "Infiltração Estratégica" para quem tem 0 seguidores</p>
            </div>
          </div>
          <div className="card-nexos p-8 space-y-6">
            <p className="text-[hsl(220_10%_65%)] leading-relaxed font-medium text-lg">
              Pare de tentar ser um "influenciador". Seja um <span className="text-white">solucionador de problemas</span> onde o problema já está acontecendo.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-[hsl(222_25%_6%)] border border-[hsl(220_20%_12%)] space-y-3">
                <h4 className="text-[hsl(250_90%_75%)] font-bold text-sm uppercase">1. Grupos de WhatsApp/FB</h4>
                <p className="text-xs text-[hsl(220_10%_50%)] leading-relaxed">
                  Entre em 10 grupos do seu nicho. Não poste link. RESPONDA dúvidas com áudios de 30s. No final diga: "Tenho um PDF que explica isso com detalhes, quer que eu te mande no privado?".
                </p>
              </div>
              <div className="p-5 rounded-xl bg-[hsl(222_25%_6%)] border border-[hsl(220_20%_12%)] space-y-3">
                <h4 className="text-[hsl(250_90%_75%)] font-bold text-sm uppercase">2. A Técnica do Comentário Top</h4>
                <p className="text-xs text-[hsl(220_10%_50%)] leading-relaxed">
                  Vá em posts de grandes players do seu nicho. Responda os comentários de quem está com dúvida. Seja tão útil que a pessoa vai clicar no seu perfil. Tenha um link de WhatsApp na Bio.
                </p>
              </div>
            </div>

            <div className="bg-[hsl(250_90%_65%/0.08)] border-2 border-dashed border-[hsl(250_90%_65%/0.3)] p-6 rounded-2xl">
              <p className="text-[hsl(250_90%_75%)] font-black text-xs uppercase mb-3">Script de Infiltração (DM)</p>
              <div className="font-mono text-sm text-white/90 bg-black/40 p-4 rounded-lg leading-relaxed">
                "Oi [Nome]! Vi sua dúvida lá no grupo do [Nicho] sobre [Problema].<br/><br/>
                Eu passei exatamente por isso mês passado e resolvi usando [Uma pequena dica].<br/><br/>
                Eu montei um checklist rápido com os 3 passos pra resolver isso de vez. Quer que eu te mande o link aqui?"
              </div>
            </div>
          </div>
        </section>

        {/* Capítulo 4: O Checklist de Guerra (7 Dias) */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(250_90%_65%)] text-white text-xl font-black flex items-center justify-center">04</div>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">O Checklist de Guerra: 7 Dias para o Pix</h2>
              <p className="text-[hsl(220_10%_50%)] text-sm font-medium">A sequência exata. Sem desvios. Sem invenções.</p>
            </div>
          </div>
          <div className="card-nexos p-8 space-y-8">
            <div className="space-y-6">
              {[
                { 
                  dia: "Dia 1", 
                  task: "A Isca Magnética", 
                  desc: "Crie um PDF de 1 página ou vídeo de 5 min resolvendo 1 dor pequena. Chame 10 pessoas no privado e entregue.",
                  copy: "Script: 'Fiz um material sobre X. Como vc se interessa por Y, achei que ia curtir. Posso mandar?'"
                },
                { 
                  dia: "Dia 2", 
                  task: "O Feedback de Ouro", 
                  desc: "Pergunte para quem recebeu a isca: 'O que você achou mais difícil de aplicar disso?'. Isso vai ser seu curso.",
                  copy: "Não venda nada hoje. Só ouça as objeções."
                },
                { 
                  dia: "Dia 3", 
                  task: "O Post de Antecipação", 
                  desc: "Poste/Mande: 'Muita gente perguntou como aplicar o que mostrei ontem. Vou abrir 5 vagas para ajudar pessoalmente nisso.'",
                  copy: "Isso cria o efeito de escassez antes de falar preço."
                },
                { 
                  dia: "Dia 4", 
                  task: "A Oferta Irresistível", 
                  desc: "Abra o carrinho. O preço deve ser 'Ridículo para não comprar'. Ex: R$97 ou R$197.",
                  copy: "Script no stories/WhatsApp: 'Pra quem quer [Resultado] em [Tempo] sem [Dor]. Link abaixo.'"
                },
                { 
                  dia: "Dia 5", 
                  task: "O Quebra-Objeções", 
                  desc: "Poste/Mande: 'Recebi algumas dúvidas: Funciona para iniciantes? Tem garantia?'. Responda todas.",
                  copy: "Se ninguém comprou ainda, chame 1 por 1 e pergunte o que travou."
                },
                { 
                  dia: "Dia 6", 
                  task: "A Urgência Real", 
                  desc: "Mostre que as vagas estão acabando. Poste o print (mesmo que seja só 1 venda).",
                  copy: "Script: 'Restam apenas 2 vagas com esse preço promocional. Encerro hoje.'"
                },
                { 
                  dia: "Dia 7", 
                  task: "Fechamento e Entrega", 
                  desc: "Carrinho fecha às 23:59. Amanhã você começa a entregar via Zoom/WhatsApp.",
                  copy: "Última chamada: 'Faltam 3 horas. É agora ou nunca.'"
                }
              ].map((d, i) => (
                <div key={i} className="relative pl-10 border-l border-[hsl(250_90%_65%/0.3)] pb-8 last:pb-0">
                  <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-[hsl(250_90%_65%)] shadow-[0_0_10px_hsl(250_90%_65%/0.5)]"></div>
                  <span className="text-[10px] font-black text-[hsl(250_90%_65%)] uppercase tracking-widest">{d.dia}</span>
                  <h4 className="text-white font-bold text-lg mb-1">{d.task}</h4>
                  <p className="text-sm text-[hsl(220_10%_60%)] mb-3">{d.desc}</p>
                  <div className="p-3 rounded-lg bg-[hsl(222_25%_4%)] border border-[hsl(220_20%_15%)] text-xs text-[hsl(168_100%_42%)] font-mono italic">
                    {d.copy}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-5 rounded-xl bg-[hsl(0_90%_65%/0.1)] border border-[hsl(0_90%_65%/0.3)]">
              <h4 className="text-[hsl(0_90%_75%)] font-bold text-sm flex items-center gap-2 mb-2">
                🛑 E se o Dia 5 não gerar vendas?
              </h4>
              <p className="text-xs text-[hsl(220_10%_65%)] leading-relaxed">
                Allan diz: "Não mude o produto. Mude a abordagem. Sua oferta está fraca ou você está falando com as pessoas erradas. Volte para o privado de cada lead e pergunte: 'O que impediria você de ter esse resultado hoje?'. A resposta deles é o seu novo copy para o Dia 6."
              </p>
            </div>
          </div>
        </section>

        {/* Capítulo 5: O Produto Escada (O caminho para os R$10k) */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(250_90%_65%)] text-white text-xl font-black flex items-center justify-center">05</div>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">O Produto Escada: De R$1k a R$10k</h2>
              <p className="text-[hsl(220_10%_50%)] text-sm font-medium">Como escalar sem precisar de 1 milhão de clientes</p>
            </div>
          </div>
          <div className="card-nexos p-8 space-y-6">
            <p className="text-[hsl(220_10%_65%)] leading-relaxed">
              O maior erro é tentar vender um produto de R$10k para quem nunca te deu R$1. A escada resolve isso.
            </p>
            
            <div className="overflow-x-auto rounded-xl border border-[hsl(220_20%_14%)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[hsl(222_25%_6%)]">
                    <th className="px-4 py-3 text-left text-xs uppercase font-black text-[hsl(220_10%_45%)]">Nível</th>
                    <th className="px-4 py-3 text-left text-xs uppercase font-black text-[hsl(220_10%_45%)]">Produto</th>
                    <th className="px-4 py-3 text-left text-xs uppercase font-black text-[hsl(220_10%_45%)]">Preço</th>
                    <th className="px-4 py-3 text-left text-xs uppercase font-black text-[hsl(220_10%_45%)]">Vendas p/ R$10k</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(220_20%_10%)]">
                  <tr>
                    <td className="px-4 py-4 text-[hsl(250_90%_75%)] font-bold">A Atração</td>
                    <td className="px-4 py-4 text-white">Workshop/Mini-curso</td>
                    <td className="px-4 py-4 text-white">R$ 97</td>
                    <td className="px-4 py-4 text-[hsl(220_10%_50%)]">103 vendas (DIFÍCIL)</td>
                  </tr>
                  <tr className="bg-[hsl(250_90%_65%/0.04)]">
                    <td className="px-4 py-4 text-[hsl(250_90%_75%)] font-bold">O Método</td>
                    <td className="px-4 py-4 text-white font-bold">Curso Completo / Mentoria em Grupo</td>
                    <td className="px-4 py-4 text-[hsl(168_100%_42%)] font-black">R$ 497</td>
                    <td className="px-4 py-4 text-white font-bold">20 vendas (IDEAL)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 text-[hsl(250_90%_75%)] font-bold">A Elite</td>
                    <td className="px-4 py-4 text-white">Mentoria Individual / Consultoria</td>
                    <td className="px-4 py-4 text-white font-bold">R$ 2.000+</td>
                    <td className="px-4 py-4 text-white font-bold">5 vendas (LUCRATIVO)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="p-5 rounded-xl bg-[hsl(250_90%_65%/0.05)] border border-[hsl(250_90%_65%/0.2)]">
              <p className="text-sm font-bold text-white mb-2">💡 A Matemática dos R$ 10k:</p>
              <p className="text-xs text-[hsl(220_10%_65%)] leading-relaxed italic">
                "Não tente vender para 100 pessoas. Venda um curso de R$497 para 15 pessoas e ofereça um upgrade de mentoria individual por +R$1.500 para 2 dessas pessoas. <strong className="text-white">Total: R$ 10.455.</strong> Mais simples do que parece, se você tiver o produto escada."
              </p>
            </div>
          </div>
        </section>

        {/* Capítulo 6: Scripts de Copy (Ouro Puro) */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(250_90%_65%)] text-white text-xl font-black flex items-center justify-center">06</div>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Scripts de Copy (Ouro Puro)</h2>
              <p className="text-[hsl(220_10%_50%)] text-sm font-medium">Copie, cole, adapte e venda.</p>
            </div>
          </div>
          <div className="space-y-4">
            
            <div className="card-nexos overflow-hidden">
              <div className="bg-[hsl(250_90%_65%)] px-6 py-2">
                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">O Post de Oferta Direta</span>
              </div>
              <div className="p-6 font-mono text-sm leading-relaxed text-white/90 bg-[hsl(222_25%_4%)]">
                "Cansado de [Dor Principal]?<br/><br/>
                Eu vejo muita gente tentando [O que não funciona] e acabando com [Resultado Ruim].<br/><br/>
                Eu criei um método simples pra você chegar em [Resultado Desejado] em apenas [Tempo], sem precisar de [O que eles odeiam].<br/><br/>
                Vou abrir apenas 5 vagas para o [Nome do seu Produto] hoje.<br/><br/>
                👇 Comente 'QUERO' abaixo e eu te mando os detalhes no privado."
              </div>
            </div>

            <div className="card-nexos overflow-hidden">
              <div className="bg-[hsl(168_100%_42%)] px-6 py-2">
                <span className="text-[10px] font-black text-[hsl(222_25%_7%)] uppercase tracking-[0.2em]">O Stories de Urgência</span>
              </div>
              <div className="p-6 font-mono text-sm leading-relaxed text-white/90 bg-[hsl(222_25%_4%)]">
                "[Foto de um comprovante de Pix borrado ou de um aluno]<br/><br/>
                Mais uma pessoa garantiu a vaga agora! 🔥<br/><br/>
                Agora restam oficialmente apenas 2 vagas com o bônus de [Algum Bônus].<br/><br/>
                Depois que essas 2 saírem, o preço volta para R$ [Preço Cheio].<br/><br/>
                Toca no link da Bio agora ou responde 'VAGA' aqui."
              </div>
            </div>

          </div>
        </section>

        {/* Capítulo 7: Matador de Objeções */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(250_90%_65%)] text-white text-xl font-black flex items-center justify-center">07</div>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">O Matador de Objeções</h2>
              <p className="text-[hsl(220_10%_50%)] text-sm font-medium">As 5 barreiras que impedem o Pix e como destruí-las</p>
            </div>
          </div>
          <div className="card-nexos p-8 space-y-6">
            <div className="space-y-4">
              {[
                { o: "Tá caro", r: "Caro comparado a quê? Se esse método te fizer economizar R$ 2.000 em 1 mês, ele está de graça. Você não está pagando um curso, está comprando seu tempo de volta." },
                { o: "Não tenho tempo", r: "Exatamente por isso você precisa disso. O método foi feito para quem tem apenas 30 min por dia. Se você não tem 30 min para mudar sua vida, o tempo é seu maior problema." },
                { o: "Será que funciona pra mim?", r: "O método foi testado por [Exemplo de perfil]. Se você fizer o passo a passo, o resultado é matemático. E se não funcionar, você tem 7 dias de garantia total." },
                { o: "Vou pensar", r: "Pensar não traz resultado. Decidir sim. Enquanto você pensa, outros estão ocupando as vagas e faturando o que você poderia estar faturando." },
                { o: "Não sei se é o momento", r: "Nunca vai ser o momento perfeito. O momento perfeito é construído pela sua decisão de começar hoje." }
              ].map((item, i) => (
                <div key={i} className="group p-4 rounded-xl bg-[hsl(222_25%_5%)] border border-[hsl(220_20%_15%)] hover:border-[hsl(250_90%_65%/0.4)] transition-all">
                  <p className="text-[hsl(220_10%_45%)] text-xs font-black uppercase mb-1">Se ele disser: "{item.o}"</p>
                  <p className="text-white text-sm font-medium leading-relaxed">Você diz: <span className="text-[hsl(250_90%_75%)] italic">"{item.r}"</span></p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Capítulo 8: Venda pelo WhatsApp (Sem Rede Social) */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(250_90%_65%)] text-white text-xl font-black flex items-center justify-center shadow-[0_0_20px_hsl(250_90%_65%/0.3)]">08</div>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Estratégia WhatsApp Direct</h2>
              <p className="text-[hsl(220_10%_50%)] text-sm font-medium">O método "Invisível" para vender sem aparecer no Instagram</p>
            </div>
          </div>
          <div className="card-nexos p-8 space-y-6 border-r-4 border-r-[hsl(168_100%_42%)]">
            <p className="text-[hsl(220_10%_65%)] leading-relaxed">
              O WhatsApp é a maior ferramenta de vendas do mundo. Se você tem 50 contatos, você tem 50 chances de fazer R$ 1k hoje.
            </p>
            
            <div className="bg-[hsl(168_100%_42%/0.05)] p-6 rounded-2xl space-y-4">
              <h4 className="text-[hsl(168_100%_42%)] font-black text-xs uppercase">A Técnica do Status de 3 Passos:</h4>
              <div className="space-y-3">
                <div className="flex gap-4">
                  <span className="shrink-0 w-6 h-6 rounded bg-[hsl(168_100%_42%)] text-[hsl(222_25%_7%)] text-[10px] font-black flex items-center justify-center">01</span>
                  <p className="text-xs text-white/80"><strong className="text-white">Status 1:</strong> Uma pergunta sobre a dor. "Alguém aqui também sofre para [Problema]?"</p>
                </div>
                <div className="flex gap-4">
                  <span className="shrink-0 w-6 h-6 rounded bg-[hsl(168_100%_42%)] text-[hsl(222_25%_7%)] text-[10px] font-black flex items-center justify-center">02</span>
                  <p className="text-xs text-white/80"><strong className="text-white">Status 2:</strong> A solução. "Eu descobri um jeito de resolver isso em 10 min. Olha o resultado: [Foto/Print]"</p>
                </div>
                <div className="flex gap-4">
                  <span className="shrink-0 w-6 h-6 rounded bg-[hsl(168_100%_42%)] text-[hsl(222_25%_7%)] text-[10px] font-black flex items-center justify-center">03</span>
                  <p className="text-xs text-white/80"><strong className="text-white">Status 3:</strong> O CTA. "Vou ensinar 3 pessoas a fazerem o mesmo hoje. Me chama aqui agora."</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[hsl(222_25%_4%)] border border-[hsl(220_20%_15%)]">
              <p className="text-xs text-[hsl(220_10%_50%)] italic">
                Allan: "Isso funciona porque no WhatsApp a barreira é menor. É uma conversa, não um anúncio. Seja pessoal, não um robô."
              </p>
            </div>
          </div>
        </section>

        {/* Capítulo 9: Tabela de Erros Fatais */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white text-xl font-black flex items-center justify-center shadow-[0_0_20px_hsl(0_90%_65%/0.3)]">09</div>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Tabela de Erros Fatais</h2>
              <p className="text-[hsl(220_10%_50%)] text-sm font-medium">O que NÃO fazer se você quer chegar aos R$ 10k</p>
            </div>
          </div>
          <div className="card-nexos overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-rose-950/20 border-b border-rose-900/30">
                  <th className="px-4 py-4 text-left text-xs uppercase font-black text-rose-400">Ação Amadora</th>
                  <th className="px-4 py-4 text-left text-xs uppercase font-black text-emerald-400">Ação NexOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220_20%_10%)]">
                <tr>
                  <td className="px-4 py-5 text-rose-200/60">Gastar R$ 2k em tráfego sem validar a oferta</td>
                  <td className="px-4 py-5 text-emerald-200">Validar no 1:1 e WhatsApp antes de gastar R$ 1</td>
                </tr>
                <tr>
                  <td className="px-4 py-5 text-rose-200/60">Esperar o site ficar 'perfeito' para lançar</td>
                  <td className="px-4 py-5 text-emerald-200">Usar um link de pagamento e um PDF direto</td>
                </tr>
                <tr>
                  <td className="px-4 py-5 text-rose-200/60">Falar das 'ferramentas' do seu curso</td>
                  <td className="px-4 py-5 text-emerald-200">Falar da TRANSFORMAÇÃO e do RESULTADO</td>
                </tr>
                <tr>
                  <td className="px-4 py-5 text-rose-200/60">Ignorar quem não comprou</td>
                  <td className="px-4 py-5 text-emerald-200">Pedir feedback para entender onde você errou no copy</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Capítulo 10: Estudos de Caso (Versão Erros) */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(250_90%_65%)] text-white text-xl font-black flex items-center justify-center">10</div>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Estudos de Caso: O Erro que Salvou tudo</h2>
              <p className="text-[hsl(220_10%_50%)] text-sm font-medium">Histórias reais de quem quase quebrou e virou o jogo</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-nexos p-6 space-y-4 border-t-2 border-t-[hsl(250_90%_65%)]">
              <h4 className="text-white font-bold">O Caso do Mentor que Não Vendia</h4>
              <p className="text-xs text-[hsl(220_10%_55%)] leading-relaxed">
                Marcos tentou lançar uma mentoria de R$ 2.000 direto para desconhecidos. <strong className="text-rose-400">Erro:</strong> Falta de escada de valor.
                <br /><br />
                <strong className="text-emerald-400">A virada:</strong> Criou um workshop de R$ 97 sobre "Os 3 Pilares". Vendeu 30 vagas (R$ 2.910). No final do workshop, ofereceu a mentoria de R$ 2k para quem queria ajuda pessoal. 6 pessoas compraram. 
                <br /><br />
                <strong className="text-white">Resultado Final: R$ 14.910 em 10 dias.</strong>
              </p>
            </div>
            <div className="card-nexos p-6 space-y-4 border-t-2 border-t-[hsl(168_100%_42%)]">
              <h4 className="text-white font-bold">O Caso da "Loja" que virou Curso</h4>
              <p className="text-xs text-[hsl(220_10%_55%)] leading-relaxed">
                Júlia vendia planners físicos. Margem pequena, logística infernal. <strong className="text-rose-400">Erro:</strong> Escalar produto físico sem capital.
                <br /><br />
                <strong className="text-emerald-400">A virada:</strong> Parou de vender o planner e começou a vender o MÉTODO de organização de rotina por R$ 197. Custo zero de entrega.
                <br /><br />
                <strong className="text-white">Resultado: 52 vendas no primeiro mês = R$ 10.244 limpos no bolso.</strong>
              </p>
            </div>
          </div>
        </section>

        {/* Próxima Missão */}
        <section className="rounded-3xl border border-[hsl(250_90%_65%/0.4)] bg-gradient-to-br from-[hsl(250_30%_10%)] to-[hsl(222_25%_7%)] p-12 text-center space-y-8 shadow-[0_20px_50px_hsl(250_90%_65%/0.1)]">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[hsl(250_90%_65%/0.1)] border border-[hsl(250_90%_65%/0.3)] text-3xl mb-4">
            🚀
          </div>
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl font-black text-white uppercase tracking-tight">Sua Próxima Missão</h2>
            <p className="text-[hsl(220_10%_65%)] text-lg leading-relaxed">
              Você tem o mapa. Você tem os scripts. Você tem a sequência. 
              <br />
              <strong className="text-white">Agora, você tem um escolha:</strong> Continuar tentando sozinho ou usar a inteligência que orquestrou este guia para lançar para você.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => onNavigate("products")}
              className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-[hsl(250_90%_65%)] text-white font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-[0_10px_20px_hsl(250_90%_65%/0.3)]"
            >
              Ativar Metodologia NexOS Completa
            </button>
            <p className="text-[hsl(220_10%_45%)] text-xs font-mono">
              O fim da amadorismo. O início dos resultados.
            </p>
          </div>
        </section>

      </div>
    </Watermark>
  );
}
