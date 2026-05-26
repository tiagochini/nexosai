/**
 * NEXOS AI — Avatar Voice File Generator
 *
 * Classic direct response technique from Gary Halbert, John Carlton, and Dan Kennedy:
 * before writing a single headline, write 500-600 words AS the customer.
 * In first person. In their exact language. Raw, unpolished, human.
 *
 * This "voice file" becomes the copy's ground truth:
 *   - Phrases get lifted directly into headlines and bullets
 *   - The emotional arc guides the email sequence structure
 *   - The raw confession informs what the sales page must overcome
 *
 * Usage: called fire-and-forget after generatePsychologicalProfile() saves the profile.
 * Result stored as campaign.intakeData._avatarVoiceFile (plain text, ~500-600 words).
 */

import { db, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { saveIntakeData } from "../intake/intake.service.js";
import type { Logger } from "pino";

const AVATAR_VOICE_SYSTEM = `Você é um especialista em pesquisa de mercado e psicologia do comprador.

Sua tarefa é escrever um documento chamado "Arquivo de Voz do Avatar".

CONCEITO:
Este é um monólogo interno — escrito na primeira pessoa — como se fosse a própria pessoa falando sobre si mesma.
NÃO é copy. NÃO é polido. É a voz bruta, real, com imperfeições, hesitações e contradições naturais.

Gary Halbert chamava de "Customer Language Document".
John Carlton chamava de "Voice File".
O objetivo é o mesmo: capturar a voz real para que o copy pareça escrito PELA pessoa, não PARA ela.

REGRAS CRÍTICAS:
1. Escreva em primeira pessoa ("Eu sei que...", "Sempre que eu...", "A verdade é que...")
2. Use as palavras EXATAS do avatar — não traduza para linguagem de marketing
3. Inclua hesitações, contradições e vergonhas reais — NÃO apenas o que eles gostariam de dizer
4. Evite jargões de marketing, palavras bonitas, promessas
5. O tom é como uma conversa honesta com um amigo de confiança às 23h
6. Não mencione o produto diretamente — este é o estado ANTES do produto
7. Comprimento: 450-600 palavras
8. Estrutura natural de monólogo — não use títulos, bullets ou formatação

SEÇÕES QUE DEVEM APARECER NATURALMENTE (sem marcar):
- A frustração cotidiana (o dia a dia com o problema)
- A vergonha que nunca admite
- As tentativas anteriores que não funcionaram (e por quê)
- O que realmente quer (não o que diz que quer)
- O medo que não fala
- O sonho que parece ridículo demais para admitir
- A objeção interna antes de comprar qualquer solução

Responda APENAS com o monólogo. Sem introdução, sem explicação, sem formatação.`;

export async function generateAvatarVoiceFile(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger
): Promise<void> {
  // Skip if already exists
  if (intakeData["_avatarVoiceFile"]) return;

  const profile = intakeData["_psychologicalProfile"];
  if (!profile || typeof profile !== "object") {
    log.warn({ campaignId }, "Avatar Voice File: no psychological profile found — skipping");
    return;
  }

  // Build the context for the AI — combine profile maps + key intake fields
  const p = profile as Record<string, unknown>;

  const profileSummary = [
    p["desejo"] ? `DESEJO REAL: ${JSON.stringify(p["desejo"])}` : "",
    p["emocao"] ? `MAPA EMOCIONAL: ${JSON.stringify(p["emocao"])}` : "",
    p["identidade"] ? `MAPA DE IDENTIDADE: ${JSON.stringify(p["identidade"])}` : "",
    p["objecao"] ? `OBJEÇÕES: ${JSON.stringify(p["objecao"])}` : "",
    p["linguagem"] ? `LINGUAGEM DO AVATAR: ${JSON.stringify(p["linguagem"])}` : "",
    p["mercado"] ? `CONTEXTO DE MERCADO: ${JSON.stringify(p["mercado"])}` : "",
    p["incoerencias"] ? `INCOERÊNCIAS DETECTADAS: ${JSON.stringify(p["incoerencias"])}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const briefingContext = Object.entries(intakeData)
    .filter(([k]) => !k.startsWith("_") && k.startsWith("audience."))
    .map(([k, v]) => `${k}: ${String(v).slice(0, 200)}`)
    .join("\n")
    .slice(0, 800);

  const product = String(intakeData["product.name"] ?? "produto");
  const category = String(intakeData["product.category"] ?? "");
  const price = String(intakeData["product.price"] ?? "");

  const userPrompt = `Escreva o Arquivo de Voz do Avatar para uma pessoa que é o cliente ideal do produto "${product}" (categoria: ${category}, investimento: R$${price}).

PERFIL PSICOLÓGICO DETECTADO:
${profileSummary}

DADOS DE AUDIÊNCIA DO BRIEFING:
${briefingContext || "(não disponível)"}

Escreva o monólogo agora — como esta pessoa fala consigo mesma sobre o problema que ${product} resolve.`;

  try {
    const result = await completeWithAgent(
      "strategy",
      AVATAR_VOICE_SYSTEM,
      [{ role: "user", content: userPrompt }],
      workspaceId,
      log,
      campaignId
    );

    const voiceFile = result.content.trim();
    if (!voiceFile || voiceFile.length < 100) {
      log.warn({ campaignId }, "Avatar Voice File: response too short — skipping save");
      return;
    }

    // Merge into existing intakeData
    const current = await db
      .select({ intakeData: campaignsTable.intakeData })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1);

    const existing = (current[0]?.intakeData ?? {}) as Record<string, unknown>;
    await saveIntakeData(
      campaignId,
      workspaceId,
      { ...existing, _avatarVoiceFile: voiceFile },
      log
    );

    log.info({ campaignId, words: voiceFile.split(" ").length }, "Avatar Voice File saved");
  } catch (err) {
    log.warn({ err, campaignId }, "Avatar Voice File generation failed — non-blocking");
  }
}
