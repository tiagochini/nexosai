import Watermark from "@/components/Watermark";

interface FreeGuideProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export default function FreeGuide({ onNavigate }: FreeGuideProps) {
  return (
    <Watermark>
    <div className="max-w-3xl mx-auto space-y-10 pb-16">

      {/* Header */}
      <div className="rounded-2xl border border-[hsl(168_100%_42%/0.3)] bg-gradient-to-br from-[hsl(222_25%_7%)] to-[hsl(168_30%_8%)] p-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[hsl(168_100%_42%/0.15)] text-[hsl(168_100%_55%)] border border-[hsl(168_100%_42%/0.3)]">🎁 Guia Gratuito</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-3">Os 7 Erros do Primeiro Lançamento</h1>
        <p className="text-[hsl(220_10%_65%)] text-lg leading-relaxed mb-4">
          Os erros mais comuns de quem estreia no digital — e o que fazer diferente desde o início.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-[hsl(220_10%_60%)]">
          <span>📄 12 páginas</span>
          <span>·</span>
          <span>⚠️ 7 erros com exemplos reais</span>
          <span>·</span>
          <span>✅ Checklist de autodiagnóstico</span>
        </div>
      </div>

      {/* Intro */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xl font-bold text-white">Por que 9 em cada 10 primeiros lançamentos falham?</h2>
        <p className="text-[hsl(220_10%_65%)] leading-relaxed">
          Não é falta de esforço. Não é falta de produto bom. É porque quem está começando comete os mesmos erros — sempre os mesmos, na mesma ordem — sem saber que existe um padrão claro que separa quem vende de quem fica frustrado.
        </p>
        <p className="text-[hsl(220_10%_65%)] leading-relaxed">
          Este guia documenta os 7 erros que mais se repetem, com exemplos reais de como eles acontecem e o que fazer diferente. Leia do começo ao fim antes do seu próximo lançamento.
        </p>
      </section>

      {/* Os 7 Erros */}
      <section className="space-y-5">
        {[
          {
            n: "01",
            titulo: "Criar o produto antes de validar a demanda",
            descricao: "A maioria passa meses gravando aulas, montando área de membros e contratando designer — antes de saber se alguém vai comprar. Quando finalmente lançam, descobrem que o mercado não queria aquilo do jeito que entregaram.",
            exemplo: "Mariana gravou 40 aulas de culinária funcional ao longo de 4 meses. Lançou e vendeu 3 unidades. O problema? Ninguém tinha pedido um curso gravado — as pessoas da sua audiência queriam acompanhamento ao vivo. Ela descobriu isso só depois de gastar R$3.200 em produção.",
            correcao: "Lance primeiro, crie depois. Abra pré-venda ou lançamento semente com promessa de entrega. Se vender, você tem tudo para criar com foco. Se não vender, você descobriu sem gastar meses.",
            cor: "hsl(0_90%_65%)",
          },
          {
            n: "02",
            titulo: "Preço baseado em quanto você acha que vale",
            descricao: "Iniciantes tendem a precificar pelo que acham que merecem ou pelo que dariam — não pelo valor percebido pelo cliente. O resultado é preço baixo demais (que desvaloriza e dificulta lucro) ou alto demais sem estrutura de persuasão.",
            exemplo: "Carlos cobrou R$49 pelo seu curso de finanças pessoais porque 'estava começando e não queria assustar'. Vendeu 11 cópias = R$539. Com R$197, com o mesmo esforço de divulgação, teria vendido 8 = R$1.576. Preço mais alto, menos vendas, mais dinheiro.",
            correcao: "Pesquise o que concorrentes diretos cobram. O preço certo não é o mais barato — é o que a sua audiência específica está disposta a pagar dado o resultado prometido. Para maioria dos primeiros produtos: entre R$97 e R$497.",
            cor: "hsl(45_100%_60%)",
          },
          {
            n: "03",
            titulo: "Lançar para o perfil errado (audiência fria)",
            descricao: "Você cria um post anunciando a oferta para seguidores que mal te conhecem, sem aquecimento prévio, sem construção de autoridade, sem conteúdo gratuito de valor. A conversão é quase zero.",
            exemplo: "Pedro lançou seu produto direto no feed sem preparação. Tinha 800 seguidores, nenhum conteúdo educativo, sem histórias pessoais. Resultado: 0 vendas. Ficou convencido de que 'o mercado estava saturado'.",
            correcao: "Aqueça por pelo menos 7 dias antes de lançar. Entregue valor gratuito, mostre seu processo, colete dúvidas via Stories, responda tudo. Só então apresente a oferta — para uma audiência que já te conhece e confia.",
            cor: "hsl(250_90%_65%)",
          },
          {
            n: "04",
            titulo: "Copy genérico que não fala com ninguém",
            descricao: "A maioria escreve como se quisesse agradar a todos — e acaba não tocando ninguém. Copy genérico não converte porque a pessoa lê e pensa 'não é bem isso que eu preciso'.",
            exemplo: "Amanda escreveu: 'Aprenda marketing digital do jeito certo. Para todos que querem crescer online.' Versus o que deveria ter escrito: 'Para mães CLT com menos de 2h por dia que querem uma renda extra de R$2k/mês sem depender de redes sociais.'",
            correcao: "Seja específico até doer. Quanto mais nicho o copy, mais a pessoa certa vai se sentir chamada. Genérico = invisível. Específico = magnético. Escreva para uma pessoa, não para todo mundo.",
            cor: "hsl(168_100%_42%)",
          },
          {
            n: "05",
            titulo: "Desistir cedo demais",
            descricao: "A maioria lança uma vez, não vende como esperava, e conclui que o negócio não funciona. O primeiro lançamento raramente é o melhor. É o aprendizado mais caro — e mais valioso.",
            exemplo: "Rodrigo lançou, fez 4 vendas quando esperava 20. Ficou dois meses sem lançar nada, desanimado. Quando voltou (por insistência de uma amiga), fez o segundo lançamento com os aprendizados do primeiro e teve 19 vendas.",
            correcao: "O segundo lançamento é sempre melhor que o primeiro. O terceiro, melhor que o segundo. Lance, colete dados, melhore uma coisa, relance. A constância bate a perfeição toda vez.",
            cor: "hsl(280_90%_70%)",
          },
          {
            n: "06",
            titulo: "Ignorar o pós-venda",
            descricao: "Após a venda, 70% dos empreendedores digitais iniciantes somem. O cliente recebe o produto e fica à deriva. Resultado: sem recompra, sem indicação, sem depoimento.",
            exemplo: "Juliana vendeu 15 vagas de um workshop. Entregou o conteúdo. Nunca mais entrou em contato. Três meses depois, zero indicações, zero recompras. Quando ela perguntou a umas delas, a resposta foi: 'Achei que tinha sido só uma venda e pronto.'",
            correcao: "Crie um onboarding básico: mensagem de boas-vindas, acompanhamento em D+7 e D+30, pedido de depoimento em D+14. O cliente que se sentiu cuidado indica naturalmente — e a indicação não custa nada.",
            cor: "hsl(15_100%_65%)",
          },
          {
            n: "07",
            titulo: "Não construir lista (depender 100% das redes)",
            descricao: "Quem depende só do Instagram ou TikTok está construindo em terreno alugado. Mudança de algoritmo, suspensão de conta, queda de alcance — qualquer um desses eventos pode zerar anos de trabalho em dias.",
            exemplo: "Thiago tinha 18 mil seguidores e faturava R$6k/mês em vendas diretas pelo Instagram. Em um fim de semana, sua conta foi suspensa por erro de sistema. Ficou 3 semanas sem conta e perdeu R$15k em receita que não aconteceu.",
            correcao: "Desde o primeiro dia: construa uma lista de email ou WhatsApp. Ofereça algo gratuito em troca do contato. Com 500 emails quentes, você fatura com ou sem Instagram. A lista é o único ativo que é 100% seu.",
            cor: "hsl(0_90%_65%)",
          },
        ].map(erro => (
          <div key={erro.n} className="card p-6 space-y-4">
            <div className="flex items-start gap-4">
              <span className="text-3xl font-extrabold shrink-0" style={{ color: erro.cor }}>#{erro.n}</span>
              <h3 className="text-white font-bold text-lg leading-tight">{erro.titulo}</h3>
            </div>
            <p className="text-[hsl(220_10%_65%)] leading-relaxed">{erro.descricao}</p>
            <div className="rounded-xl bg-[hsl(0_90%_65%/0.05)] border border-[hsl(0_90%_65%/0.15)] p-4 text-sm">
              <p className="text-[hsl(0_90%_70%)] font-semibold text-xs uppercase tracking-wider mb-2">📍 Caso real</p>
              <p className="text-[hsl(220_10%_65%)] leading-relaxed italic">{erro.exemplo}</p>
            </div>
            <div className="rounded-xl bg-[hsl(168_100%_42%/0.05)] border border-[hsl(168_100%_42%/0.2)] p-4 text-sm">
              <p className="text-[hsl(168_100%_55%)] font-semibold text-xs uppercase tracking-wider mb-2">✓ O que fazer</p>
              <p className="text-[hsl(220_10%_65%)] leading-relaxed">{erro.correcao}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Checklist de autodiagnóstico */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Checklist de Autodiagnóstico</h2>
        <p className="text-[hsl(220_10%_65%)]">Antes do seu próximo lançamento, responda cada item honestamente:</p>
        <div className="card p-6 space-y-3">
          {[
            "Eu validei que pessoas reais querem isso — não só que eu acho que querem",
            "Meu preço foi definido com base no valor percebido, não no que 'parece razoável'",
            "Aqueci minha audiência por pelo menos 7 dias antes de apresentar a oferta",
            "Meu copy é específico o suficiente para excluir quem não é meu cliente ideal",
            "Tenho comprometimento de lançar ao menos 3 vezes antes de desistir do produto",
            "Tenho um processo básico de pós-venda (boas-vindas, acompanhamento, pedido de depoimento)",
            "Estou coletando emails ou contatos de WhatsApp desde o início, não só seguidores",
          ].map((item, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" className="mt-0.5 w-4 h-4 rounded accent-[hsl(250_90%_65%)] shrink-0" />
              <span className="text-sm text-[hsl(220_10%_65%)] group-hover:text-white transition-colors leading-relaxed">{item}</span>
            </label>
          ))}
          <div className="pt-2 border-t border-[hsl(220_20%_12%)]">
            <p className="text-xs text-[hsl(220_10%_40%)]">
              Se marcou menos de 5: há ajustes urgentes antes de lançar.<br/>
              Se marcou 5–6: seu lançamento tem boas chances com pequenos ajustes.<br/>
              Se marcou 7: você está pronto — foque na execução.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-[hsl(250_90%_65%/0.3)] bg-gradient-to-br from-[hsl(222_25%_7%)] to-[hsl(250_30%_8%)] p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Quer o método completo?</h2>
        <p className="text-[hsl(220_10%_65%)] leading-relaxed">
          Este guia cobre os erros a evitar. A Metodologia NexOS cobre o caminho completo — do zero ao lançamento estruturado, com 10 módulos, 34 capítulos e 118 aulas incluindo copy, tráfego, automação e IA.
        </p>
        <button
          onClick={() => onNavigate("products")}
          className="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-[hsl(250_90%_60%)] to-[hsl(270_80%_55%)] text-white font-bold hover:opacity-90 transition-opacity"
        >
          Ver Metodologia NexOS Completa →
        </button>
      </section>

    </div>
    </Watermark>
  );
}
