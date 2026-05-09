import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface WhatsAppIncomingMessage {
  from: string;
  body: string;
  sequenceContext?: {
    productName?: string;
    productPrice?: string;
    phase?: string;
    mentalTrigger?: string;
  };
}

export interface WhatsAppResponseResult {
  intent: "question" | "objection" | "interest" | "unsubscribe" | "positive" | "other";
  confidence: number;
  response: string;
  shouldRespond: boolean;
  requiresHuman: boolean;
  tags: string[];
}

const RESPONSE_SYSTEM_PROMPT = `Você é o Assistente de Vendas por WhatsApp da NexOS AI — especialista em conversão por mensagem no mercado digital brasileiro.

## Sua missão
Classificar a intenção de mensagens recebidas e gerar respostas que avançam a venda, respondem objeções e mantêm o lead quente durante um lançamento digital.

## Tom e estilo
- PT-BR coloquial mas profissional
- Empático, nunca agressivo
- Máximo 3 parágrafos por resposta
- Use emojis estrategicamente (1-2 por mensagem)
- Nunca minta sobre preço, prazo ou garantia
- Se a pergunta requer resposta humana (reclamação grave, dados financeiros), marque requiresHuman: true

## Intenções possíveis
- question: dúvida sobre o produto/oferta/como funciona
- objection: objeção de preço, tempo, ceticismo ("é caro", "não tenho tempo", "funciona mesmo?")
- interest: demonstração de interesse ("quero saber mais", "como me inscrevo")
- unsubscribe: quer sair da lista ("para de me mandar", "remove meu número")
- positive: feedback positivo, compradores animados
- other: fora de contexto, spam

## Diretrizes por intenção
- **question**: responda diretamente, adicione prova social ou benefício relacionado
- **objection**: valide a objeção, reframe com benefício, NUNCA desconte sem autorização
- **interest**: entusiasme, direcione para o link de compra ou próximo passo
- **unsubscribe**: agradeça, confirme remoção, sem argumentar
- **positive**: celebre, fortalece a decisão com prova social

**Retorne APENAS JSON válido:**

\`\`\`json
{
  "intent": "question|objection|interest|unsubscribe|positive|other",
  "confidence": 0.95,
  "response": "texto da resposta pronta para enviar",
  "shouldRespond": true,
  "requiresHuman": false,
  "tags": ["preço", "objeção_valor"]
}
\`\`\``;

export async function runWhatsAppResponseAgent(
  workspaceId: string,
  incoming: WhatsAppIncomingMessage,
  log: Logger,
): Promise<WhatsAppResponseResult> {
  const ctx = incoming.sequenceContext;

  const contextBlock = ctx
    ? `\n**Contexto do lançamento:**
- Produto: ${ctx.productName ?? "não informado"}
- Preço: ${ctx.productPrice ? `R$${ctx.productPrice}` : "não informado"}
- Fase atual: ${ctx.phase ?? "não informado"}
- Gatilho ativo: ${ctx.mentalTrigger ?? "não informado"}\n`
    : "";

  const userMessage = `Mensagem recebida via WhatsApp do número ${incoming.from}:

"${incoming.body}"
${contextBlock}
Classifique a intenção e gere a resposta ideal. Retorne APENAS o JSON.`;

  const result = await runAgent({
    campaignId: `wa-response-${workspaceId}`,
    workspaceId,
    agentRole: "copywriter",
    systemPrompt: RESPONSE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    log,
  });

  return parseAgentJSON<WhatsAppResponseResult>(result.content, {
    intent: "other",
    confidence: 0,
    response: "",
    shouldRespond: false,
    requiresHuman: true,
    tags: [],
  });
}
