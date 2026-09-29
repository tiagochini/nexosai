/**
 * Guia do Diretor — Director's Filming Guide
 *
 * O Diretor de Filmagem instrui o usuário sobre cada detalhe da produção:
 * vestuário, cenário, linguagem, roteiro e energia por cena.
 *
 * Download com anti-pirataria: documento personalizado com nome/email do usuário
 * + token único + timestamp gravado no próprio conteúdo.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";
import {
  ArrowLeft, Download, Camera, Shirt, MapPin,
  MessageSquare, FileText, Zap, ChevronDown, ChevronUp,
  Star, AlertTriangle, CheckCircle2, Eye, Volume2,
  Clapperboard, Palette, Mic2, BookOpen,
} from "lucide-react";

interface DirectorSection {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  director: string;
  content: DirectorBlock[];
}

interface DirectorBlock {
  type: "instruction" | "do" | "dont" | "note" | "example" | "choice";
  text: string;
  options?: string[];
}

const DIRECTOR_SECTIONS: DirectorSection[] = [
  {
    id: "vestuario",
    icon: Shirt,
    color: "text-indigo-400",
    title: "Vestuário",
    director: "A roupa fala antes de você abrir a boca. Aqui está o briefing.",
    content: [
      { type: "instruction", text: "Use cores sólidas, de média a alta saturação. O cérebro registra autoridade e presença antes de processar qualquer palavra." },
      { type: "do", text: "Azul marinho, cinza chumbo, preto, bordô — transmitem autoridade sem competir com seu rosto." },
      { type: "do", text: "Branco puro e bege claro funcionam bem com fundos escuros ou neutros." },
      { type: "do", text: "Uma camisa social ou blazer casual eleva imediatamente a percepção de valor — mesmo em casa." },
      { type: "dont", text: "Listras finas e xadrez miúdo — vibram na câmera (efeito moiré). Nunca use." },
      { type: "dont", text: "Estampas grandes, logos visíveis, camisetas de banda ou time." },
      { type: "dont", text: "Roupas que combinam exatamente com o fundo — você some." },
      { type: "note", text: "Teste: grave 30 segundos e reveja no celular em tela cheia. Se a roupa chama mais atenção que seus olhos, troque." },
      { type: "choice", text: "Escolha de acordo com o tom do seu produto:", options: [
        "Produto premium / high-ticket → blazer, camisa social, relógio discreto",
        "Produto de transformação pessoal → look casual elegante, cor quente",
        "Produto técnico / educacional → camisa polo, tom neutro, sem acessórios",
        "Saúde e bem-estar → cores terrosas, linho, visual clean",
      ]},
    ],
  },
  {
    id: "cenario",
    icon: MapPin,
    color: "text-amber-400",
    title: "Cenário e Fundo",
    director: "O fundo é o segundo personagem do seu vídeo. Ele precisa trabalhar para você.",
    content: [
      { type: "instruction", text: "O cenário deve comunicar: 'esse criador tem contexto, tem ambiente, é real'. Não precisa ser perfeito — precisa ser intencional." },
      { type: "choice", text: "Escolha o fundo de acordo com o posicionamento:", options: [
        "Parede com poucos elementos (quadro, planta, livros) → profissional e acessível",
        "Biblioteca ou estante com livros → autoridade intelectual",
        "Home office arrumado → especialista que trabalha de verdade",
        "Fundo neutro ou parede de cor sólida → produto e solução em foco",
        "Ambiente ao ar livre com boa luz → lifestyle, leveza, liberdade",
      ]},
      { type: "do", text: "Adicione profundidade: algo levemente desfocado atrás de você cria cinema mesmo com câmera de celular." },
      { type: "do", text: "Uma luz suave no fundo separa você do cenário e cria 3D visual." },
      { type: "dont", text: "Porta fechada, parede lisa branca sem elementos — parece entrevista de emprego." },
      { type: "dont", text: "Bagunça visível, roupas, camas, banheiros ou ambientes com muita informação." },
      { type: "note", text: "Segredo de direção: coloque um objeto relevante ao seu nicho no canto do fundo. Não precisa aparecer em destaque — mas quem presta atenção percebe e o cérebro registra congruência." },
    ],
  },
  {
    id: "linguagem",
    icon: MessageSquare,
    color: "text-green-400",
    title: "Linguagem e Tom",
    director: "A câmera amplifica tudo. Uma voz plana vira sonolência. Uma voz com intenção vira magnetismo.",
    content: [
      { type: "instruction", text: "Você está tendo uma conversa íntima com UMA pessoa — não fazendo discurso para uma plateia. Fale como se estivesse tomando café com seu melhor cliente." },
      { type: "do", text: "Varie a velocidade: acelere nos pontos de energia, desacelere nas revelações importantes." },
      { type: "do", text: "Pause intencionalmente antes das frases mais importantes. O silêncio é pontuação." },
      { type: "do", text: "Use o nome da pessoa (se possível) ou diga 'você' — não 'vocês', não 'as pessoas'." },
      { type: "do", text: "Gesticule naturalmente. Mãos visíveis e abertas = abertura + confiança." },
      { type: "dont", text: "Ler da tela com olho parado. A audiência percebe e desconecta." },
      { type: "dont", text: "Falar em monoton sem variação de tom — toda frase com a mesma energia." },
      { type: "dont", text: "Usar palavras complexas só para parecer especialista. Clareza = autoridade real." },
      { type: "example", text: "Em vez de: 'Este programa foi desenvolvido para auxiliar empreendedores...' → Diga: 'Eu criei isso para quem já tentou de tudo e está cansado de não ver resultado.'" },
      { type: "choice", text: "Tom por tipo de produto:", options: [
        "Transformação pessoal → caloroso, próximo, como um amigo que já passou por isso",
        "Business / resultados → direto, confiante, sem enrolação",
        "Educacional → paciente, claro, com exemplos práticos",
        "Premium / high-ticket → calmo, sóbrio, pesado de valor — não animado",
      ]},
    ],
  },
  {
    id: "roteiro",
    icon: FileText,
    color: "text-blue-400",
    title: "Estrutura do Roteiro",
    director: "Todo vídeo que converte segue uma arquitetura. Desvie dela e perde o espectador.",
    content: [
      { type: "instruction", text: "A estrutura abaixo foi testada nos maiores lançamentos digitais do Brasil. Cada bloco tem uma função neurológica. Não pule nenhum." },
      { type: "do", text: "GANCHO (0–15s): Comece com o maior problema ou a maior promessa. Nunca com 'oi, meu nome é...'" },
      { type: "example", text: "Gancho modelo: 'Se você já fez tudo que ensinaram e ainda não chegou em [resultado], este vídeo é literalmente o que estava faltando.'" },
      { type: "do", text: "AUTORIDADE (15–45s): Por que você? Um momento de prova rápida — resultado, caso de sucesso, credencial real." },
      { type: "do", text: "PROBLEMA (45s–2min): Detalhe a dor com precisão cirúrgica. Quem se sente compreendido fica. Use: 'Eu sei que você...' e descreva o estado interno." },
      { type: "do", text: "SOLUÇÃO (2–4min): Apresente a ideia, o método, o framework. Não revele tudo — crie antecipação." },
      { type: "do", text: "PROVA (4–6min): Resultados, depoimentos, antes/depois. Quanto mais específico, mais crível." },
      { type: "do", text: "OFERTA + URGÊNCIA (6–8min): O que está sendo ofertado, por quanto, por quanto tempo. Escassez real ou de percepção." },
      { type: "do", text: "CTA (últimos 30s): UM único botão, UMA única ação. Repita o benefício principal e ordene o próximo passo." },
      { type: "dont", text: "Começar agradecendo pelo tempo ou se apresentando. Os primeiros 3 segundos decidem se a pessoa fica." },
      { type: "dont", text: "Colocar o CTA apenas no final sem preparar o terreno antes." },
      { type: "note", text: "Regra de ouro: cada cena deve responder 'e daí?' para o espectador. Se não responder, corte." },
    ],
  },
  {
    id: "energia",
    icon: Zap,
    color: "text-yellow-400",
    title: "Energia por Cena",
    director: "Cada fase do vídeo exige uma frequência emocional diferente. Trocar de energia na hora certa é o que separa vídeos mediocres dos que convertem.",
    content: [
      { type: "instruction", text: "Pense em cada cena como uma nota musical. A composição precisa de variação para criar impacto." },
      { type: "choice", text: "Mapa de energia por fase:", options: [
        "GANCHO → Energia alta, urgente. Velocidade rápida, tom levemente elevado, postura para frente",
        "PROBLEMA → Energia empática, pesada. Desacelere, abaixe o tom, pause nas palavras-dor",
        "SOLUÇÃO → Energia esperançosa, limpa. Tom médio-alto, voz mais leve, sorriso natural",
        "PROVA → Energia sóbria, confiante. Fatos sólidos, voz pausada, olho firme na câmera",
        "OFERTA → Energia decisiva. Direto, sem enrolação, sem tremer",
        "CTA → Energia de convite. Caloroso, mas claro. Como dizer 'vem, eu te espero'",
      ]},
      { type: "do", text: "Grave cada fase separadamente se precisar. É mais fácil manter a energia certa por segmento." },
      { type: "do", text: "Antes de gravar cada cena: respire fundo, visualize o estado emocional desejado, só então fale." },
      { type: "note", text: "Técnica do diretor: antes do GANCHO, pense em algo que te deixa empolgado. Antes da cena PROBLEMA, pense num momento em que você mesmo sofreu com isso. A memória emocional aparece na câmera." },
    ],
  },
  {
    id: "tecnico",
    icon: Clapperboard,
    color: "text-purple-400",
    title: "Direção Técnica",
    director: "Detalhes técnicos que a maioria ignora e que fazem toda a diferença na percepção de qualidade.",
    content: [
      { type: "instruction", text: "Você não precisa de equipamento caro. Precisa de setup correto. Aqui estão os 5 ajustes que mais impactam o resultado final." },
      { type: "do", text: "LOOK CAMERA: Olhe diretamente para a LENTE — não para a sua imagem na tela. Coloque um adesivo de ponto ao lado da lente como guia." },
      { type: "do", text: "EYELINE: A câmera deve estar exatamente na altura dos olhos ou 2–3cm acima. Nunca abaixo." },
      { type: "do", text: "HEADROOM: Deixe espaço entre o topo da sua cabeça e a borda da tela — mas não muito. Regra dos terços." },
      { type: "do", text: "MOVIMENTO INTENCIONAL: Se vai gesticular, comece o gesto ANTES de começar a frase. Movimento depois da palavra parece mecânico." },
      { type: "do", text: "BREAKS: A cada 5–7 minutos de gravação, pare, beba água, respire. Sua energia renovada aparece na câmera." },
      { type: "dont", text: "Checar o celular ou notas durante a gravação sem pausar. A câmera registra os olhos desviando." },
      { type: "note", text: "Para vídeos longos (VSL): grave em blocos de no máximo 10 minutos. Você mantém a energia, a edição fica mais fácil e o resultado é visivelmente melhor." },
    ],
  },
  {
    id: "checklist",
    icon: CheckCircle2,
    color: "text-success",
    title: "Checklist do Diretor",
    director: "O set está pronto quando TODOS esses itens estiverem marcados. Sem exceção.",
    content: [
      { type: "do", text: "Câmera na altura dos olhos, enquadrada em 1/3 superior" },
      { type: "do", text: "Iluminação: luz principal lateral, sem sombras duras no rosto" },
      { type: "do", text: "Roupa sólida, sem listras, sem logo, compatível com o tom do produto" },
      { type: "do", text: "Fundo intencional — não uma parede branca vazia" },
      { type: "do", text: "Microfone conectado e testado (30s de gravação + fone)" },
      { type: "do", text: "Ambiente silencioso — AC, ventilador, celular em modo avião" },
      { type: "do", text: "Roteiro praticado em voz alta pelo menos 3 vezes" },
      { type: "do", text: "Estado emocional preparado para o GANCHO (energia alta)" },
      { type: "do", text: "Água por perto para hidratar a voz entre takes" },
      { type: "do", text: "Câmera/celular com bateria acima de 80% ou carregando" },
    ],
  },
];

const COLOR_MAP: Record<string, string> = {
  "text-indigo-400": "#818cf8",
  "text-amber-400": "#fbbf24",
  "text-green-400": "#4ade80",
  "text-blue-400": "#60a5fa",
  "text-yellow-400": "#facc15",
  "text-purple-400": "#c084fc",
  "text-success": "#22c55e",
};

// UI-only translations: the Portuguese source strings remain unchanged for the
// downloadable document and are only localized when rendered in the interface.
const DIRECTOR_UI_COPY: Record<string, readonly [string, string]> = {
  "A roupa fala antes de você abrir a boca. Aqui está o briefing.": ["Clothing speaks before you open your mouth. Here's the brief.", "La ropa habla antes de que abras la boca. Aquí tienes las instrucciones."],
  "Use cores sólidas, de média a alta saturação. O cérebro registra autoridade e presença antes de processar qualquer palavra.": ["Wear solid colors with medium to high saturation. The brain registers authority and presence before processing a single word.", "Usa colores sólidos, de saturación media a alta. El cerebro percibe autoridad y presencia antes de procesar una sola palabra."],
  "Azul marinho, cinza chumbo, preto, bordô — transmitem autoridade sem competir com seu rosto.": ["Navy, charcoal gray, black, and burgundy convey authority without competing with your face.", "Azul marino, gris carbón, negro y burdeos transmiten autoridad sin competir con tu rostro."],
  "Branco puro e bege claro funcionam bem com fundos escuros ou neutros.": ["Pure white and light beige work well with dark or neutral backgrounds.", "El blanco puro y el beige claro funcionan bien con fondos oscuros o neutros."],
  "Uma camisa social ou blazer casual eleva imediatamente a percepção de valor — mesmo em casa.": ["A dress shirt or casual blazer immediately elevates perceived value—even at home.", "Una camisa formal o un blazer informal eleva de inmediato la percepción de valor, incluso en casa."],
  "Listras finas e xadrez miúdo — vibram na câmera (efeito moiré). Nunca use.": ["Fine stripes and small checks shimmer on camera (the moiré effect). Never wear them.", "Las rayas finas y los cuadros pequeños vibran en cámara (efecto moiré). No los uses."],
  "Estampas grandes, logos visíveis, camisetas de banda ou time.": ["Large prints, visible logos, and band or sports team T-shirts.", "Estampados grandes, logotipos visibles y camisetas de bandas o equipos."],
  "Roupas que combinam exatamente com o fundo — você some.": ["Clothes that exactly match the background—you disappear.", "La ropa que combina exactamente con el fondo hace que desaparezcas."],
  "Teste: grave 30 segundos e reveja no celular em tela cheia. Se a roupa chama mais atenção que seus olhos, troque.": ["Test: record 30 seconds and watch it full-screen on your phone. If your clothes draw more attention than your eyes, change them.", "Prueba: graba 30 segundos y míralos a pantalla completa en el móvil. Si la ropa llama más la atención que tus ojos, cámbiala."],
  "Escolha de acordo com o tom do seu produto:": ["Choose according to your product's tone:", "Elige según el tono de tu producto:"],
  "Produto premium / high-ticket → blazer, camisa social, relógio discreto": ["Premium / high-ticket product → blazer, dress shirt, understated watch", "Producto prémium / de alto valor → blazer, camisa formal, reloj discreto"],
  "Produto de transformação pessoal → look casual elegante, cor quente": ["Personal transformation product → smart casual look, warm color", "Producto de transformación personal → estilo casual elegante, color cálido"],
  "Produto técnico / educacional → camisa polo, tom neutro, sem acessórios": ["Technical / educational product → polo shirt, neutral tone, no accessories", "Producto técnico / educativo → polo, tono neutro, sin accesorios"],
  "Saúde e bem-estar → cores terrosas, linho, visual clean": ["Health and wellness → earth tones, linen, clean look", "Salud y bienestar → tonos tierra, lino, estilo limpio"],
  "O fundo é o segundo personagem do seu vídeo. Ele precisa trabalhar para você.": ["The background is the second character in your video. It needs to work for you.", "El fondo es el segundo personaje de tu video. Tiene que trabajar a tu favor."],
  "O cenário deve comunicar: 'esse criador tem contexto, tem ambiente, é real'. Não precisa ser perfeito — precisa ser intencional.": ["Your setting should say: 'this creator has context, a real environment, and is authentic.' It doesn't need to be perfect—it needs to be intentional.", "El entorno debe comunicar: «este creador tiene contexto, un espacio y es real». No tiene que ser perfecto, sino intencional."],
  "Escolha o fundo de acordo com o posicionamento:": ["Choose a background that fits your positioning:", "Elige el fondo según tu posicionamiento:"],
  "Parede com poucos elementos (quadro, planta, livros) → profissional e acessível": ["Wall with a few elements (art, plant, books) → professional and approachable", "Pared con pocos elementos (cuadro, planta, libros) → profesional y cercano"],
  "Biblioteca ou estante com livros → autoridade intelectual": ["Library or bookcase → intellectual authority", "Biblioteca o estantería con libros → autoridad intelectual"],
  "Home office arrumado → especialista que trabalha de verdade": ["Tidy home office → a specialist who really does the work", "Oficina en casa ordenada → especialista que trabaja de verdad"],
  "Fundo neutro ou parede de cor sólida → produto e solução em foco": ["Neutral background or solid-color wall → keeps the product and solution in focus", "Fondo neutro o pared de color liso → producto y solución en primer plano"],
  "Ambiente ao ar livre com boa luz → lifestyle, leveza, liberdade": ["Outdoor setting with good light → lifestyle, ease, freedom", "Espacio exterior con buena luz → estilo de vida, ligereza y libertad"],
  "Adicione profundidade: algo levemente desfocado atrás de você cria cinema mesmo com câmera de celular.": ["Add depth: something slightly out of focus behind you creates a cinematic look, even with a phone camera.", "Añade profundidad: algo ligeramente desenfocado detrás de ti crea un aspecto cinematográfico, incluso con la cámara del móvil."],
  "Uma luz suave no fundo separa você do cenário e cria 3D visual.": ["A soft background light separates you from the setting and adds visual depth.", "Una luz suave de fondo te separa del entorno y crea profundidad visual."],
  "Porta fechada, parede lisa branca sem elementos — parece entrevista de emprego.": ["A closed door or bare white wall looks like a job interview.", "Una puerta cerrada o una pared blanca vacía parece una entrevista de trabajo."],
  "Bagunça visível, roupas, camas, banheiros ou ambientes com muita informação.": ["Visible clutter, laundry, beds, bathrooms, or visually busy spaces.", "Desorden visible, ropa, camas, baños o espacios con demasiada información."],
  "Segredo de direção: coloque um objeto relevante ao seu nicho no canto do fundo. Não precisa aparecer em destaque — mas quem presta atenção percebe e o cérebro registra congruência.": ["Director's tip: place an object related to your niche in the background. It needn't stand out; attentive viewers notice it, and the brain registers consistency.", "Consejo de dirección: coloca un objeto relacionado con tu sector en el fondo. No hace falta destacarlo; quien presta atención lo nota y el cerebro percibe coherencia."],
  "A câmera amplifica tudo. Uma voz plana vira sonolência. Uma voz com intenção vira magnetismo.": ["The camera amplifies everything. A flat voice becomes dull; a purposeful voice becomes magnetic.", "La cámara lo amplifica todo. Una voz plana resulta aburrida; una voz con intención resulta magnética."],
  "Você está tendo uma conversa íntima com UMA pessoa — não fazendo discurso para uma plateia. Fale como se estivesse tomando café com seu melhor cliente.": ["You're having an intimate conversation with ONE person—not giving a speech to an audience. Speak as if having coffee with your best customer.", "Estás conversando íntimamente con UNA persona, no dando un discurso a una audiencia. Habla como si tomaras un café con tu mejor cliente."],
  "Varie a velocidade: acelere nos pontos de energia, desacelere nas revelações importantes.": ["Vary your pace: speed up for energetic moments and slow down for important revelations.", "Varía el ritmo: acelera en los momentos de energía y baja la velocidad en las revelaciones importantes."],
  "Pause intencionalmente antes das frases mais importantes. O silêncio é pontuação.": ["Pause intentionally before your most important lines. Silence is punctuation.", "Haz una pausa intencional antes de las frases más importantes. El silencio es puntuación."],
  "Use o nome da pessoa (se possível) ou diga 'você' — não 'vocês', não 'as pessoas'.": ["Use the person's name if possible, or say 'you'—not 'you all' or 'people'.", "Usa el nombre de la persona si es posible, o di «tú», no «ustedes» ni «la gente»."],
  "Gesticule naturalmente. Mãos visíveis e abertas = abertura + confiança.": ["Gesture naturally. Visible, open hands communicate openness and confidence.", "Gestualiza con naturalidad. Las manos visibles y abiertas transmiten cercanía y confianza."],
  "Ler da tela com olho parado. A audiência percebe e desconecta.": ["Reading from a screen with a fixed gaze. The audience notices and disengages.", "Leer de la pantalla con la mirada fija. La audiencia lo nota y desconecta."],
  "Falar em monoton sem variação de tom — toda frase com a mesma energia.": ["Speaking monotonously, with no variation in tone or energy.", "Hablar de forma monótona, sin variar el tono ni la energía."],
  "Usar palavras complexas só para parecer especialista. Clareza = autoridade real.": ["Using complex words just to sound like an expert. Clarity is real authority.", "Usar palabras complejas solo para parecer especialista. La claridad es autoridad real."],
  "Em vez de: 'Este programa foi desenvolvido para auxiliar empreendedores...' → Diga: 'Eu criei isso para quem já tentou de tudo e está cansado de não ver resultado.'": ["Instead of: 'This program was developed to assist entrepreneurs...' → Say: 'I created this for people who've tried everything and are tired of seeing no results.'", "En lugar de: «Este programa se desarrolló para ayudar a emprendedores...» → Di: «Creé esto para quienes ya lo han intentado todo y están cansados de no ver resultados»."],
  "Tom por tipo de produto:": ["Tone by product type:", "Tono según el tipo de producto:"],
  "Transformação pessoal → caloroso, próximo, como um amigo que já passou por isso": ["Personal transformation → warm and close, like a friend who's been through it", "Transformación personal → cálido y cercano, como un amigo que ya pasó por eso"],
  "Business / resultados → direto, confiante, sem enrolação": ["Business / results → direct, confident, no-nonsense", "Negocios / resultados → directo, seguro y sin rodeos"],
  "Educacional → paciente, claro, com exemplos práticos": ["Educational → patient and clear, with practical examples", "Educativo → paciente y claro, con ejemplos prácticos"],
  "Premium / high-ticket → calmo, sóbrio, pesado de valor — não animado": ["Premium / high-ticket → calm, composed, substantial—not overexcited", "Prémium / alto valor → tranquilo, sobrio y convincente, sin exaltación"],
  "Todo vídeo que converte segue uma arquitetura. Desvie dela e perde o espectador.": ["Every video that converts follows a structure. Stray from it and you lose the viewer.", "Todo video que convierte sigue una estructura. Si te desvías, pierdes a la audiencia."],
  "A estrutura abaixo foi testada nos maiores lançamentos digitais do Brasil. Cada bloco tem uma função neurológica. Não pule nenhum.": ["This structure has been tested in major Brazilian digital launches. Each segment has a psychological purpose. Don't skip any.", "Esta estructura se ha probado en grandes lanzamientos digitales de Brasil. Cada bloque cumple una función psicológica. No te saltes ninguno."],
  "GANCHO (0–15s): Comece com o maior problema ou a maior promessa. Nunca com 'oi, meu nome é...'": ["HOOK (0–15s): Start with the biggest problem or promise. Never open with 'Hi, my name is…'", "GANCHO (0–15 s): Empieza con el mayor problema o la gran promesa. Nunca con «Hola, me llamo…»"],
  "Gancho modelo: 'Se você já fez tudo que ensinaram e ainda não chegou em [resultado], este vídeo é literalmente o que estava faltando.'": ["Hook example: 'If you've tried everything they taught you and still haven't achieved [result], this video is exactly what you've been missing.'", "Ejemplo de gancho: «Si ya probaste todo lo que te enseñaron y aún no lograste [resultado], este video es justo lo que te faltaba»."],
  "AUTORIDADE (15–45s): Por que você? Um momento de prova rápida — resultado, caso de sucesso, credencial real.": ["AUTHORITY (15–45s): Why you? Offer a quick proof point—a result, success story, or genuine credential.", "AUTORIDAD (15–45 s): ¿Por qué tú? Aporta una prueba rápida: un resultado, un caso de éxito o una credencial real."],
  "PROBLEMA (45s–2min): Detalhe a dor com precisão cirúrgica. Quem se sente compreendido fica. Use: 'Eu sei que você...' e descreva o estado interno.": ["PROBLEM (45s–2min): Describe the pain precisely. People stay when they feel understood. Use 'I know you…' and describe their inner experience.", "PROBLEMA (45 s–2 min): Describe el dolor con precisión. Quien se siente comprendido se queda. Usa «Sé que…» y describe cómo se siente por dentro."],
  "SOLUÇÃO (2–4min): Apresente a ideia, o método, o framework. Não revele tudo — crie antecipação.": ["SOLUTION (2–4min): Present the idea, method, or framework. Don't reveal everything—build anticipation.", "SOLUCIÓN (2–4 min): Presenta la idea, el método o el marco. No lo reveles todo: crea expectación."],
  "PROVA (4–6min): Resultados, depoimentos, antes/depois. Quanto mais específico, mais crível.": ["PROOF (4–6min): Results, testimonials, before and after. The more specific, the more credible.", "PRUEBA (4–6 min): Resultados, testimonios, antes y después. Cuanto más específico, más creíble."],
  "OFERTA + URGÊNCIA (6–8min): O que está sendo ofertado, por quanto, por quanto tempo. Escassez real ou de percepção.": ["OFFER + URGENCY (6–8min): Explain what's offered, at what price, and for how long. Use genuine or clearly framed scarcity.", "OFERTA + URGENCIA (6–8 min): Explica qué se ofrece, a qué precio y durante cuánto tiempo. Usa escasez real o claramente contextualizada."],
  "CTA (últimos 30s): UM único botão, UMA única ação. Repita o benefício principal e ordene o próximo passo.": ["CTA (final 30s): ONE button, ONE action. Repeat the main benefit and clearly direct the next step.", "CTA (últimos 30 s): UN botón, UNA acción. Repite el beneficio principal e indica claramente el siguiente paso."],
  "Começar agradecendo pelo tempo ou se apresentando. Os primeiros 3 segundos decidem se a pessoa fica.": ["Opening by thanking viewers for their time or introducing yourself. The first three seconds decide whether they stay.", "Empezar dando las gracias o presentándote. Los primeros tres segundos deciden si la persona se queda."],
  "Colocar o CTA apenas no final sem preparar o terreno antes.": ["Leaving the CTA until the end without building toward it first.", "Dejar el CTA para el final sin preparar el terreno."],
  "Regra de ouro: cada cena deve responder 'e daí?' para o espectador. Se não responder, corte.": ["Golden rule: every scene must answer 'so what?' for the viewer. If it doesn't, cut it.", "Regla de oro: cada escena debe responder «¿y qué?» para la audiencia. Si no lo hace, córtala."],
  "Cada fase do vídeo exige uma frequência emocional diferente. Trocar de energia na hora certa é o que separa vídeos mediocres dos que convertem.": ["Each phase of a video calls for a different emotional frequency. Shifting energy at the right moment separates mediocre videos from those that convert.", "Cada fase del video requiere una frecuencia emocional distinta. Cambiar la energía en el momento adecuado distingue los videos mediocres de los que convierten."],
  "Pense em cada cena como uma nota musical. A composição precisa de variação para criar impacto.": ["Think of each scene as a musical note. The composition needs variation to make an impact.", "Piensa en cada escena como una nota musical. La composición necesita variación para generar impacto."],
  "Mapa de energia por fase:": ["Energy map by phase:", "Mapa de energía por fase:"],
  "GANCHO → Energia alta, urgente. Velocidade rápida, tom levemente elevado, postura para frente": ["HOOK → High, urgent energy. Fast pace, slightly raised tone, lean forward.", "GANCHO → Energía alta y urgente. Ritmo rápido, tono algo elevado e inclínate hacia delante."],
  "PROBLEMA → Energia empática, pesada. Desacelere, abaixe o tom, pause nas palavras-dor": ["PROBLEM → Empathetic, weighty energy. Slow down, lower your tone, pause on pain-point words.", "PROBLEMA → Energía empática e seria. Baja el ritmo y el tono; haz pausas en las palabras que expresan dolor."],
  "SOLUÇÃO → Energia esperançosa, limpa. Tom médio-alto, voz mais leve, sorriso natural": ["SOLUTION → Hopeful, clear energy. Mid-high tone, lighter voice, natural smile.", "SOLUCIÓN → Energía esperanzadora y clara. Tono medio-alto, voz más ligera y sonrisa natural."],
  "PROVA → Energia sóbria, confiante. Fatos sólidos, voz pausada, olho firme na câmera": ["PROOF → Composed, confident energy. Solid facts, measured voice, steady eye contact with the camera.", "PRUEBA → Energía sobria y segura. Datos sólidos, voz pausada y mirada firme a cámara."],
  "OFERTA → Energia decisiva. Direto, sem enrolação, sem tremer": ["OFFER → Decisive energy. Be direct, clear, and unwavering.", "OFERTA → Energía decisiva. Sé directo, claro y firme."],
  "CTA → Energia de convite. Caloroso, mas claro. Como dizer 'vem, eu te espero'": ["CTA → Inviting energy. Warm but clear—like saying 'come on, I'll be here.'", "CTA → Energía de invitación. Cercana y clara, como decir «ven, aquí te espero»."],
  "Grave cada fase separadamente se precisar. É mais fácil manter a energia certa por segmento.": ["Record each phase separately if needed. It's easier to maintain the right energy for each segment.", "Graba cada fase por separado si hace falta. Es más fácil mantener la energía adecuada en cada segmento."],
  "Antes de gravar cada cena: respire fundo, visualize o estado emocional desejado, só então fale.": ["Before each scene, take a deep breath and picture the desired emotional state—then speak.", "Antes de cada escena, respira hondo e imagina el estado emocional deseado; después, habla."],
  "Técnica do diretor: antes do GANCHO, pense em algo que te deixa empolgado. Antes da cena PROBLEMA, pense num momento em que você mesmo sofreu com isso. A memória emocional aparece na câmera.": ["Director's technique: before the HOOK, think of something that excites you. Before the PROBLEM scene, recall a time you experienced that struggle yourself. Emotional memory shows on camera.", "Técnica de dirección: antes del GANCHO, piensa en algo que te entusiasme. Antes de la escena del PROBLEMA, recuerda cuándo viviste esa dificultad. La memoria emocional se refleja en cámara."],
  "Detalhes técnicos que a maioria ignora e que fazem toda a diferença na percepção de qualidade.": ["Technical details most people overlook that make all the difference to perceived quality.", "Detalles técnicos que muchos pasan por alto y que marcan la diferencia en la calidad percibida."],
  "Você não precisa de equipamento caro. Precisa de setup correto. Aqui estão os 5 ajustes que mais impactam o resultado final.": ["You don't need expensive equipment. You need the right setup. Here are the five adjustments that most affect the final result.", "No necesitas equipo caro, sino una buena configuración. Estos son los cinco ajustes que más influyen en el resultado final."],
  "LOOK CAMERA: Olhe diretamente para a LENTE — não para a sua imagem na tela. Coloque um adesivo de ponto ao lado da lente como guia.": ["CAMERA GAZE: Look directly into the LENS—not at your image on screen. Place a small dot sticker beside the lens as a guide.", "MIRADA A CÁMARA: Mira directamente al OBJETIVO, no a tu imagen en pantalla. Pon una pegatina junto al objetivo como guía."],
  "EYELINE: A câmera deve estar exatamente na altura dos olhos ou 2–3cm acima. Nunca abaixo.": ["EYE LINE: Position the camera at eye level or 2–3 cm above. Never below.", "ALTURA DE MIRADA: Coloca la cámara a la altura de los ojos o 2–3 cm por encima. Nunca por debajo."],
  "HEADROOM: Deixe espaço entre o topo da sua cabeça e a borda da tela — mas não muito. Regra dos terços.": ["HEADROOM: Leave some—not too much—space between the top of your head and the frame. Use the rule of thirds.", "AIRE SOBRE LA CABEZA: Deja algo de espacio entre la cabeza y el borde del encuadre, pero no demasiado. Aplica la regla de los tercios."],
  "MOVIMENTO INTENCIONAL: Se vai gesticular, comece o gesto ANTES de começar a frase. Movimento depois da palavra parece mecânico.": ["INTENTIONAL MOVEMENT: If you're going to gesture, start BEFORE the sentence. Movement after the words looks mechanical.", "MOVIMIENTO INTENCIONAL: Si vas a gesticular, empieza ANTES de la frase. Moverte después de hablar parece mecánico."],
  "BREAKS: A cada 5–7 minutos de gravação, pare, beba água, respire. Sua energia renovada aparece na câmera.": ["BREAKS: Every 5–7 minutes, stop, drink water, and breathe. Your refreshed energy will show on camera.", "PAUSAS: Cada 5–7 minutos, para, bebe agua y respira. La cámara reflejará tu energía renovada."],
  "Checar o celular ou notas durante a gravação sem pausar. A câmera registra os olhos desviando.": ["Checking your phone or notes without pausing. The camera catches your eyes wandering.", "Mirar el móvil o las notas sin pausar. La cámara capta cómo apartas la mirada."],
  "Para vídeos longos (VSL): grave em blocos de no máximo 10 minutos. Você mantém a energia, a edição fica mais fácil e o resultado é visivelmente melhor.": ["For long videos (VSLs), record in segments of no more than 10 minutes. You'll maintain your energy, simplify editing, and get a visibly better result.", "Para videos largos (VSL), graba bloques de 10 minutos como máximo. Mantendrás la energía, facilitarás la edición y mejorarás claramente el resultado."],
  "O set está pronto quando TODOS esses itens estiverem marcados. Sem exceção.": ["The set is ready when EVERY item is checked. No exceptions.", "El set está listo cuando TODOS estos puntos están marcados. Sin excepciones."],
  "Câmera na altura dos olhos, enquadrada em 1/3 superior": ["Camera at eye level, framed in the upper third", "Cámara a la altura de los ojos, encuadrada en el tercio superior"],
  "Iluminação: luz principal lateral, sem sombras duras no rosto": ["Lighting: key light from the side, with no harsh facial shadows", "Iluminación: luz principal lateral, sin sombras marcadas en el rostro"],
  "Roupa sólida, sem listras, sem logo, compatível com o tom do produto": ["Solid-color clothing, no stripes or logos, matching the product's tone", "Ropa de color liso, sin rayas ni logotipos, acorde con el tono del producto"],
  "Fundo intencional — não uma parede branca vazia": ["Intentional background—not a blank white wall", "Fondo intencional, no una pared blanca vacía"],
  "Microfone conectado e testado (30s de gravação + fone)": ["Microphone connected and tested (30-second recording + headphones)", "Micrófono conectado y probado (grabación de 30 s + auriculares)"],
  "Ambiente silencioso — AC, ventilador, celular em modo avião": ["Quiet environment—air conditioning and fan off, phone in airplane mode", "Entorno silencioso: aire acondicionado y ventilador apagados, móvil en modo avión"],
  "Roteiro praticado em voz alta pelo menos 3 vezes": ["Script practised aloud at least three times", "Guion practicado en voz alta al menos tres veces"],
  "Estado emocional preparado para o GANCHO (energia alta)": ["Emotional state ready for the HOOK (high energy)", "Estado emocional preparado para el GANCHO (energía alta)"],
  "Água por perto para hidratar a voz entre takes": ["Water nearby to hydrate your voice between takes", "Agua a mano para hidratar la voz entre tomas"],
  "Câmera/celular com bateria acima de 80% ou carregando": ["Camera/phone battery above 80% or charging", "Cámara/móvil con más del 80 % de batería o conectado al cargador"],
};

function localizedDirectorCopy(text: string, t: ReturnType<typeof useUiText>) {
  const copy = DIRECTOR_UI_COPY[text];
  return copy ? t(text, copy[0], copy[1]) : text;
}

function BlockItem({ block }: { block: DirectorBlock }) {
  const t = useUiText();
  if (block.type === "instruction") {
    return (
      <p className="font-mono text-sm text-foreground/80 leading-relaxed italic border-l-2 border-primary/40 pl-3 py-1 my-2">
        {localizedDirectorCopy(block.text, t)}
      </p>
    );
  }
  if (block.type === "do") {
    return (
      <div className="flex items-start gap-2 my-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
        <span className="font-mono text-[12px] text-foreground/75 leading-relaxed">{localizedDirectorCopy(block.text, t)}</span>
      </div>
    );
  }
  if (block.type === "dont") {
    return (
      <div className="flex items-start gap-2 my-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
        <span className="font-mono text-[12px] text-destructive/70 leading-relaxed">{localizedDirectorCopy(block.text, t)}</span>
      </div>
    );
  }
  if (block.type === "note") {
    return (
      <div className="my-2 flex items-start gap-2 bg-primary/5 border border-primary/20 p-3">
        <Star className="h-3.5 w-3.5 text-primary/60 shrink-0 mt-0.5" />
        <span className="font-mono text-[11px] text-primary/70 leading-relaxed">{localizedDirectorCopy(block.text, t)}</span>
      </div>
    );
  }
  if (block.type === "example") {
    return (
      <div className="my-2 bg-card/40 border border-border/30 p-3">
         <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 block mb-1">{t("Exemplo do diretor", "Director's example", "Ejemplo del director")}</span>
         <span className="font-mono text-[12px] text-foreground/70 leading-relaxed">{localizedDirectorCopy(block.text, t)}</span>
      </div>
    );
  }
  if (block.type === "choice" && block.options) {
    return (
      <div className="my-2">
         <span className="font-mono text-[11px] text-muted-foreground/60 block mb-2">{localizedDirectorCopy(block.text, t)}</span>
        <div className="space-y-1">
          {block.options.map((opt, i) => (
            <div key={i} className="flex items-start gap-2">
              <Eye className="h-3 w-3 text-primary/40 shrink-0 mt-0.5" />
               <span className="font-mono text-[11px] text-foreground/60 leading-relaxed">{localizedDirectorCopy(opt, t)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function SectionCard({ section, defaultOpen = false }: { section: DirectorSection; defaultOpen?: boolean }) {
  const t = useUiText();
  const [open, setOpen] = useState(defaultOpen);
  const Icon = section.icon;
  const titles: Record<string, readonly [string, string, string]> = {
    vestuario: ["Vestuário", "Wardrobe", "Vestuario"],
    cenario: ["Cenário e Fundo", "Setting and Background", "Escenario y fondo"],
    linguagem: ["Linguagem e Tom", "Language and Tone", "Lenguaje y tono"],
    roteiro: ["Estrutura do Roteiro", "Script Structure", "Estructura del guion"],
    energia: ["Energia por Cena", "Energy by Scene", "Energía por escena"],
    tecnico: ["Direção Técnica", "Technical Direction", "Dirección técnica"],
    checklist: ["Checklist do Diretor", "Director's Checklist", "Lista del director"],
  };
  const title = titles[section.id] ? t(...titles[section.id]) : section.title;

  return (
    <div className="border border-border/30 bg-card/20 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-card/40 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full border border-border/30 flex items-center justify-center bg-card/30">
            <Icon className={`h-5 w-5 ${section.color}`} />
          </div>
          <div>
            <div className="font-mono text-sm font-black text-foreground uppercase tracking-wide">{title}</div>
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5 italic line-clamp-1">
               "{localizedDirectorCopy(section.director, t)}"
            </div>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border/20">
          <div className="mt-4 font-mono text-[12px] text-muted-foreground/60 italic mb-4 leading-relaxed">
             "{localizedDirectorCopy(section.director, t)}"
          </div>
          {section.content.map((block, i) => (
            <BlockItem key={i} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

function generateAntiPiracyDocument(
  userName: string,
  userEmail: string,
  planName: string,
): string {
  const now = new Date();
  const token = btoa(`${userEmail}:${now.getTime()}`).slice(0, 16).toUpperCase();
  const serial = `NX-DIR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${token}`;
  const dateStr = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const lines: string[] = [];

  lines.push("╔══════════════════════════════════════════════════════════════╗");
  lines.push("║           NEXOS AI — GUIA DO DIRETOR DE FILMAGEM            ║");
  lines.push("╚══════════════════════════════════════════════════════════════╝");
  lines.push("");
  lines.push("DOCUMENTO PERSONALIZADO E PROTEGIDO CONTRA REDISTRIBUIÇÃO");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`Licenciado para: ${userName}`);
  lines.push(`E-mail registrado: ${userEmail}`);
  lines.push(`Plano: ${planName}`);
  lines.push(`Serial de acesso: ${serial}`);
  lines.push(`Gerado em: ${dateStr} (horário de Brasília)`);
  lines.push("");
  lines.push("AVISO LEGAL: Este documento é de uso exclusivo do titular acima.");
  lines.push("A redistribuição, cópia ou compartilhamento não autorizado viola");
  lines.push("os Termos de Uso da NexOS AI e pode acarretar responsabilidade civil.");
  lines.push("Cada download gera um código rastreável único vinculado ao usuário.");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  for (const section of DIRECTOR_SECTIONS) {
    lines.push("");
    lines.push(`${"═".repeat(64)}`);
    lines.push(`  ${section.title.toUpperCase()}`);
    lines.push(`${"═".repeat(64)}`);
    lines.push(`  "${section.director}"`);
    lines.push("");

    for (const block of section.content) {
      if (block.type === "instruction") {
        lines.push(`  ▸ ${block.text}`);
      } else if (block.type === "do") {
        lines.push(`  ✓ ${block.text}`);
      } else if (block.type === "dont") {
        lines.push(`  ✗ ${block.text}`);
      } else if (block.type === "note") {
        lines.push(`  ★ NOTA DO DIRETOR: ${block.text}`);
      } else if (block.type === "example") {
        lines.push(`  » EXEMPLO: ${block.text}`);
      } else if (block.type === "choice") {
        lines.push(`  • ${block.text}`);
        block.options?.forEach(opt => lines.push(`      – ${opt}`));
      }
      lines.push("");
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("© NexOS AI — nexos.ai | Todos os direitos reservados.");
  lines.push(`Documento gerado exclusivamente para: ${userName} <${userEmail}>`);
  lines.push(`Serial: ${serial}`);
  lines.push("Este documento não pode ser compartilhado, revendido ou distribuído.");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return lines.join("\n");
}

export default function DirectorGuide() {
  const t = useUiText();
  const [, setLocation] = useLocation();
  const { user, plan } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const userName = user?.name ?? "Usuário NexOS";
  const userEmail = (user as unknown as { email?: string })?.email ?? "usuario@nexos.ai";
  const planName = plan?.name ?? "NexOS";

  function handleDownload() {
    setDownloading(true);
    try {
      const content = generateAntiPiracyDocument(userName, userEmail, planName);
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexos-diretor-filmagem-${userName.replace(/\s+/g, "-").toLowerCase()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border/30 px-6 py-4 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/video-production")}
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="font-mono text-sm font-bold text-foreground flex items-center gap-2">
              <Clapperboard className="h-4 w-4 text-primary" />
               {t("Guia do Diretor", "Director's Guide", "Guía del director")}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
              {t(`Instruções completas de filmagem · Personalizado para ${userName}`, `Complete filming instructions · Personalised for ${userName}`, `Instrucciones completas de filmación · Personalizado para ${userName}`)}
            </div>
          </div>
        </div>

        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="rounded-none font-mono uppercase tracking-widest text-xs btn-weapon-primary gap-2"
        >
          {downloading ? (
            <span className="animate-pulse">{t("Gerando...", "Generating...", "Generando...")}</span>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              {t("Baixar guia personalizado", "Download personalised guide", "Descargar guía personalizada")}
            </>
          )}
        </Button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── Director Intro ── */}
        <div className="mb-10 border border-border/30 bg-card/20 p-6 relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40" />

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <Clapperboard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary/60 mb-1">
                 {t("Diretor de Filmagem · NexOS AI", "Filming Director · NexOS AI", "Director de filmación · NexOS AI")}
              </div>
              <h1 className="font-mono font-black text-xl text-foreground mb-2">
                 {t(`${userName}, aqui são as minhas instruções.`, `${userName}, here are my instructions.`, `${userName}, estas son mis instrucciones.`)}
              </h1>
              <p className="font-mono text-sm text-muted-foreground/70 leading-relaxed">
                 {t("Um vídeo que converte não é acidente — é direção. Cada detalhe abaixo foi calibrado para maximizar autoridade, confiança e conversão. Siga o briefing. Grave com intenção. O resultado vai surpreender você.", "A video that converts is no accident — it takes direction. Every detail below is calibrated to maximise authority, trust, and conversion. Follow the brief. Record with intention. The result will surprise you.", "Un video que convierte no es casualidad: requiere dirección. Cada detalle está calibrado para maximizar autoridad, confianza y conversión. Sigue las instrucciones. Graba con intención. El resultado te sorprenderá.")}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground/40" />
                   <span className="font-mono text-[10px] text-muted-foreground/40">{t("7 módulos de direção", "7 direction modules", "7 módulos de dirección")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-muted-foreground/40" />
                   <span className="font-mono text-[10px] text-muted-foreground/40">{t("Vestuário · Cenário · Performance", "Wardrobe · Setting · Performance", "Vestuario · Escenario · Interpretación")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mic2 className="h-3.5 w-3.5 text-muted-foreground/40" />
                   <span className="font-mono text-[10px] text-muted-foreground/40">{t("Roteiro · Energia · Técnico", "Script · Energy · Technical", "Guion · Energía · Técnica")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Anti-piracy badge ── */}
        <div className="mb-6 flex items-center gap-2 border border-warning/20 bg-warning/5 px-4 py-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
          <span className="font-mono text-[11px] text-warning/70">
             {t("Documento personalizado e protegido — licenciado exclusivamente para", "Personalised, protected document — licensed exclusively to", "Documento personalizado y protegido, con licencia exclusiva para")} <strong>{userName}</strong>.
             {t(" O download gera um serial único rastreável vinculado à sua conta.", " Downloading generates a unique traceable serial linked to your account.", " La descarga genera un número de serie único y rastreable vinculado a tu cuenta.")}
          </span>
        </div>

        {/* ── Sections ── */}
        <div className="space-y-2">
          {DIRECTOR_SECTIONS.map((section, i) => (
            <SectionCard key={section.id} section={section} defaultOpen={i === 0} />
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-none font-mono uppercase tracking-widest font-black gap-3 btn-weapon-primary h-14 px-12 text-sm"
          >
            <Download className="h-4 w-4" />
            {downloading ? t("Gerando documento...", "Generating document...", "Generando documento...") : t("Baixar guia completo personalizado", "Download complete personalised guide", "Descargar guía personalizada completa")}
          </Button>
          <p className="font-mono text-[10px] text-muted-foreground/30 text-center">
             {t(`Licenciado para ${userName} · Serial único por download · Documento rastreável`, `Licensed to ${userName} · Unique serial per download · Traceable document`, `Con licencia para ${userName} · Número de serie único por descarga · Documento rastreable`)}
          </p>
          <button
            onClick={() => setLocation("/video-production")}
            className="font-mono text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Camera className="h-3.5 w-3.5" />
             {t("Criar vídeo agora com CYRUS", "Create a video now with CYRUS", "Crear video ahora con CYRUS")}
          </button>
        </div>
      </div>
    </div>
  );
}
