/**
 * AFFILIATE CAMPAIGN AGENT — BLOCKED
 *
 * Este agente está reservado para o sistema de afiliados do NexOS AI.
 *
 * Status: AGUARDANDO DEFINIÇÃO DO USUÁRIO
 * Motivo: A lógica de negócio e o modelo de comissionamento precisam ser
 *         definidos pelo usuário antes da implementação.
 *
 * O que este agente irá fazer (quando implementado):
 * - Estruturar campanhas para afiliados que vendem produtos de terceiros
 * - Gerar estratégias de divulgação para afiliados do próprio NexOS AI
 * - Calcular projeções de comissão por nível/tier de afiliado
 * - Criar materiais de divulgação (e-mails prontos, links rastreáveis, scripts de vídeo)
 * - Gerenciar regras de compliance para divulgação de afiliados (obrigatoriedade de disclosure)
 *
 * Para implementar: o usuário precisa definir:
 * 1. Modelo de comissionamento (% único, recorrente, por tier, etc.)
 * 2. Regras de qualificação de afiliado
 * 3. Janela de atribuição de conversão
 * 4. Política de estorno e contestação
 * 5. Integração com plataforma de pagamento de afiliados (Hotmart, Eduzz, Monetizze, etc.)
 */

import type { Logger } from "pino";

export interface AffiliateCampaignOutput {
  status: "blocked";
  reason: string;
  blockedUntil: string;
}

export async function runAffiliateCampaignAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<AffiliateCampaignOutput> {
  log.info(
    { campaignId, workspaceId },
    "Affiliate campaign agent called — blocked pending user definition",
  );

  return {
    status: "blocked",
    reason: "Aguardando definição da lógica de afiliados pelo usuário. Este agente será implementado após a reunião de alinhamento.",
    blockedUntil: "user_defined",
  };
}
