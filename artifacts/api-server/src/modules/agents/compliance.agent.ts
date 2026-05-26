import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { runAgentWithCritique } from "./critique.runner.js";
import { getMemoryContext, buildMemoryContextBlock } from "../memory/memory.service.js";
import type { Logger } from "pino";

export interface ComplianceViolation {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  location: string;
  originalText: string;
  issue: string;
  correctedText: string;
  legalBasis: string;
}

export interface ComplianceOutput {
  campaignTitle: string;
  overallRiskLevel: "safe" | "low_risk" | "medium_risk" | "high_risk" | "blocked";
  complianceScore: number;
  violations: ComplianceViolation[];
  approvedElements: string[];
  conarAnalysis: {
    verdict: string;
    principles: string[];
    issues: string[];
  };
  platformPolicies: {
    meta: { status: "approved" | "restricted" | "rejected"; issues: string[] };
    google: { status: "approved" | "restricted" | "rejected"; issues: string[] };
    tiktok: { status: "approved" | "restricted" | "rejected"; issues: string[] };
  };
  incomeClaimsAnalysis: {
    found: boolean;
    claims: string[];
    riskLevel: string;
    recommendation: string;
  };
  testimonialCompliance: {
    issues: string[];
    recommendations: string[];
  };
  guaranteeCompliance: {
    currentGuarantee: string;
    isCompliant: boolean;
    recommendation: string;
  };
  legalRecommendations: string[];
  requiredDisclosures: string[];
  complianceNotes: string;
}

const COMPLIANCE_PROMPT = `Você é o Agente de Compliance da NexOS AI — especialista em conformidade de publicidade digital no Brasil.

## BIBLIOTECA OBRIGATÓRIA — SUPREME AUDITOR

Você protege o negócio e a credibilidade do usuário NEXOS. Você DEVE dominar:

**ÉTICA E PERSUASÃO RESPONSÁVEL:**
- Strategy of Preeminence (Jay Abraham) — ser o parceiro do cliente: o que é bom para ele determina o que fazemos
- The Trusted Advisor (Maister/Green/Galford) — confiança como ativo mais valioso; credibilidade + confiabilidade + intimidade ÷ auto-orientação
- Influence (Cialdini) — conhecer os 6 princípios para aplicá-los com ética e reconhecer abuso
- Thinking Fast and Slow (Kahneman) — vieses cognitivos: quando explorar o Sistema 1 é manipulação vs. persuasão

**REGULATÓRIO E LEGAL:**
- CONAR — Conselho Nacional de Autorregulamentação Publicitária (código completo de ética publicitária)
- CDC — Código de Defesa do Consumidor (oferta, publicidade enganosa, garantia, arrependimento)
- Meta Ads Policy — o que pode e o que derruba conta; claims proibidos por categoria
- Google Ads Policy — restrições por categoria (saúde, finanças, relacionamento)
- LGPD — Lei Geral de Proteção de Dados (coleta de lead, consentimento, uso de dados)

**PADRÃO DE PUBLICIDADE HONESTA:**
- Scientific Advertising (Hopkins) — toda afirmação deve ser provável e mensurável
- Ogilvy on Advertising (Ogilvy) — promessas claras e verificáveis; sofisticação antes de força
- Trust Me, I'm Lying (Ryan Holiday) — como narrativas se distorcem; o que NÃO fazer

**DISTINÇÃO FILOSÓFICA:** Persuasão agressiva defensável é legal e ética. Promessa falsa não.
Você valida que o output dos outros agentes é AGRESSIVO mas não FRAUDULENTO — essa linha é sua função.

---


Você analisa toda a copy de campanha contra as regras do CONAR, CDC, políticas de plataforma e boas práticas jurídicas para produtos digitais.

## FRAMEWORKS DE COMPLIANCE QUE VOCÊ APLICA

**CONAR (Conselho Nacional de Autorregulamentação Publicitária):**
- Art. 1: A publicidade deve ser honesta e verdadeira
- Art. 4: Não deve abusar da ingenuidade ou inexperiência do consumidor
- Art. 6: Deve conter informações completas e corretas sobre o produto
- Art. 27: Promessas de resultado devem ser fundamentadas e comprováveis
- Seção 28: Proibição de depoimentos falsos ou distorcidos

**CDC (Código de Defesa do Consumidor):**
- Art. 30: Oferta vincula o fornecedor
- Art. 37: Proibição de publicidade enganosa e abusiva
- Art. 49: Direito de arrependimento (7 dias para produtos digitais)
- Art. 56: Infrações administrativas

**Políticas de plataformas:**
- Meta Ads: proibição de claims de saúde/riqueza não fundamentados, antes/depois, linguagem de urgência artificial
- Google Ads: get-rich-quick schemes, guarantees de resultado financeiro
- TikTok Ads: restrições similares + sensibilidade a conteúdo financeiro

**Red flags específicos de infoprodutos:**
- "Ganhe R$X por dia sem fazer nada"
- "Resultado garantido"
- "Método secreto"
- "Funciona para todo mundo"
- "Comprovado cientificamente" (sem citação)
- Depoimentos com valores específicos sem disclaimer de resultado atípico
- Urgência artificial (vagas falsas, timer falso)
- Comparações depreciativas com concorrentes

## COMO AVALIAR

**Score de compliance (0-100):**
- 90-100: Safe — pode publicar
- 70-89: Low Risk — ajustes menores recomendados
- 50-69: Medium Risk — precisa corrigir antes de publicar
- 30-49: High Risk — correções obrigatórias
- 0-29: Blocked — não pode publicar nesta forma

**Para cada violação encontrada:**
1. Identifique o texto exato
2. Explique o problema específico
3. Forneça uma versão corrigida que mantém o poder persuasivo mas elimina o risco

**Retorne APENAS JSON válido** no formato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "overallRiskLevel": "safe|low_risk|medium_risk|high_risk|blocked",
  "complianceScore": 0,
  "violations": [
    {
      "severity": "critical|high|medium|low",
      "category": "string — ex: income_claim, false_urgency, unsubstantiated_claim",
      "location": "string — onde está (ex: headline da página de vendas, email 3)",
      "originalText": "string — trecho exato",
      "issue": "string — qual a regra que viola e por quê",
      "correctedText": "string — versão corrigida mantendo o poder persuasivo",
      "legalBasis": "string — base legal da regra violada"
    }
  ],
  "approvedElements": ["string — o que está dentro das regras"],
  "conarAnalysis": {
    "verdict": "string",
    "principles": ["string — princípios CONAR aplicáveis"],
    "issues": ["string — problemas específicos do CONAR"]
  },
  "platformPolicies": {
    "meta": { "status": "approved|restricted|rejected", "issues": ["string"] },
    "google": { "status": "approved|restricted|rejected", "issues": ["string"] },
    "tiktok": { "status": "approved|restricted|rejected", "issues": ["string"] }
  },
  "incomeClaimsAnalysis": {
    "found": false,
    "claims": ["string — afirmações de resultado financeiro encontradas"],
    "riskLevel": "string",
    "recommendation": "string"
  },
  "testimonialCompliance": {
    "issues": ["string"],
    "recommendations": ["string — como tornar os depoimentos conformes"]
  },
  "guaranteeCompliance": {
    "currentGuarantee": "string",
    "isCompliant": true,
    "recommendation": "string"
  },
  "legalRecommendations": ["string — recomendação legal específica"],
  "requiredDisclosures": ["string — disclaimers obrigatórios a adicionar"],
  "complianceNotes": "string — análise geral e próximos passos para o criador"
}
\`\`\``;

export async function runComplianceAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  copyContent: Record<string, unknown> | undefined,
  adContent: Record<string, unknown> | undefined,
  log: Logger,
): Promise<ComplianceOutput> {
  const memCtx = await getMemoryContext(workspaceId, "compliance");
  const memBlock = buildMemoryContextBlock(memCtx);

  const contentSample = JSON.stringify({
    product: String(intakeData["product.name"] ?? ""),
    price: String(intakeData["product.price"] ?? ""),
    socialProof: String(intakeData["product.socialProof"] ?? ""),
    copy: copyContent
      ? {
          salesPageSections: (copyContent as any).salesPage?.sections?.slice(0, 3) ?? [],
          emailSubjects: [
            ...((copyContent as any).emailSequence?.preLaunch?.slice(0, 2) ?? []),
            ...((copyContent as any).emailSequence?.cartOpen?.slice(0, 1) ?? []),
          ].map((e: any) => ({ subject: e.subject, body: e.body?.slice(0, 300) })),
          cartScripts: (copyContent as any).cartScripts?.slice(0, 2) ?? [],
        }
      : "copy not yet generated",
    ads: adContent
      ? {
          metaAds: (adContent as any).segments?.slice(0, 1)?.[0]?.meta?.slice(0, 2) ?? [],
          tiktokAds: (adContent as any).segments?.slice(0, 1)?.[0]?.tiktok?.slice(0, 1) ?? [],
        }
      : "ads not yet generated",
  }, null, 2);

  const userMessage = `Analise toda a copy desta campanha contra as regras de compliance aplicáveis no Brasil.

**Contexto da campanha:**
\`\`\`json
${contentSample}
\`\`\`

**Informações adicionais:**
- Produto digital: ${String(intakeData["product.deliveryMethod"] ?? "100_online") === "100_online" ? "SIM" : "NÃO"}
- Garante resultado: ${String(intakeData["product.guaranteesResult"] ?? "não especificado")}
- Público: empreendedores e profissionais que buscam renda extra ou escala

**ANÁLISE NECESSÁRIA:**
1. Todas as afirmações de resultado (claims financeiros)
2. Todos os depoimentos e provas sociais
3. Urgência e escassez — são reais ou artificiais?
4. A garantia oferecida — está no formato correto?
5. Headlines e subheadlines — alguma é enganosa?
6. Copy dos anúncios — viola políticas do Meta/Google/TikTok?
7. Disclaimers ausentes que são obrigatórios

Forneça versões corrigidas para CADA violação encontrada.

Retorne APENAS o JSON de compliance.`;

  const critique = await runAgentWithCritique({
    campaignId,
    workspaceId,
    agentRole: "compliance",
    systemPrompt: memBlock + COMPLIANCE_PROMPT,
    userMessage,
    log,
  });

  const result = { content: critique.refinedOutput };

  return parseAgentJSON<ComplianceOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    overallRiskLevel: "medium_risk",
    complianceScore: 70,
    violations: [],
    approvedElements: [],
    conarAnalysis: { verdict: "", principles: [], issues: [] },
    platformPolicies: {
      meta: { status: "restricted", issues: [] },
      google: { status: "restricted", issues: [] },
      tiktok: { status: "restricted", issues: [] },
    },
    incomeClaimsAnalysis: { found: false, claims: [], riskLevel: "", recommendation: "" },
    testimonialCompliance: { issues: [], recommendations: [] },
    guaranteeCompliance: { currentGuarantee: "", isCompliant: true, recommendation: "" },
    legalRecommendations: [],
    requiredDisclosures: [],
    complianceNotes: result.content,
  });
}
