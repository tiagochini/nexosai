/**
 * Audiovisual specialist ensemble.
 *
 * These agents are intentionally independent of video-production.service:
 * callers can compose only the specialists a production needs and retain
 * ownership of sequencing, persistence, and approvals.
 */
import { z } from "zod/v4";
import { parseAgentJSON, runAgent, type TemporalContextOpts } from "./agent.runner.js";
import type { AgentRole } from "../ai-gateway/ai-gateway.service.js";
import type { Logger } from "pino";

const prioritySchema = z.enum(["critical", "high", "medium", "low"]);
const timestampSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
  note: z.string().min(1),
});

export const artDirectionOutputSchema = z.object({
  visualNorthStar: z.string().min(1),
  references: z.array(z.string().min(1)).min(1),
  visualRules: z.array(z.string().min(1)).min(1),
  shotDirection: z.array(z.object({
    beat: z.string().min(1),
    composition: z.string().min(1),
    lighting: z.string().min(1),
    movement: z.string().min(1),
  })).min(1),
  avoid: z.array(z.string()),
});

export const wardrobeAppearanceOutputSchema = z.object({
  appearanceIntent: z.string().min(1),
  looks: z.array(z.object({
    subject: z.string().min(1),
    wardrobe: z.array(z.string().min(1)).min(1),
    grooming: z.array(z.string().min(1)).min(1),
    palette: z.array(z.string().min(1)).min(1),
    continuityNotes: z.array(z.string()),
  })).min(1),
  accessibilityAndCulturalNotes: z.array(z.string()),
  avoid: z.array(z.string()),
});

export const performanceVoiceOutputSchema = z.object({
  performanceObjective: z.string().min(1),
  voiceProfile: z.object({
    tone: z.string().min(1),
    pace: z.string().min(1),
    energyArc: z.string().min(1),
    pronunciationNotes: z.array(z.string()),
  }),
  beatDirection: z.array(z.object({
    beat: z.string().min(1),
    intention: z.string().min(1),
    delivery: z.string().min(1),
    pauseOrEmphasis: z.string().min(1),
  })).min(1),
  prohibitedClaimsOrDelivery: z.array(z.string()),
});

export const soundDesignOutputSchema = z.object({
  sonicConcept: z.string().min(1),
  musicDirection: z.object({
    mood: z.string().min(1),
    tempo: z.string().min(1),
    instrumentation: z.array(z.string().min(1)).min(1),
    licensingNotes: z.array(z.string()),
  }),
  cueSheet: z.array(z.object({
    time: timestampSchema,
    cue: z.string().min(1),
    purpose: z.string().min(1),
    mixNote: z.string().min(1),
  })).min(1),
  mixAndAccessibilityNotes: z.array(z.string().min(1)).min(1),
});

export const editorOutputSchema = z.object({
  editObjective: z.string().min(1),
  editPlan: z.array(z.object({
    time: timestampSchema,
    edit: z.string().min(1),
    rationale: z.string().min(1),
    transition: z.string().min(1),
  })).min(1),
  pacingRules: z.array(z.string().min(1)).min(1),
  deliverableNotes: z.array(z.string()),
});

export const colorContinuityOutputSchema = z.object({
  colorIntent: z.string().min(1),
  showLutGuidance: z.array(z.string().min(1)).min(1),
  continuityPlan: z.array(z.object({
    sceneOrShot: z.string().min(1),
    targetLook: z.string().min(1),
    matchNotes: z.array(z.string().min(1)).min(1),
    priority: prioritySchema,
  })).min(1),
  skinToneAndAccessibilityNotes: z.array(z.string()),
});

export const avQcOutputSchema = z.object({
  verdict: z.enum(["approved", "approved_with_notes", "needs_revision", "blocked"]),
  summary: z.string().min(1),
  findings: z.array(z.object({
    discipline: z.enum(["picture", "sound", "captioning", "continuity", "brand", "compliance"]),
    severity: prioritySchema,
    time: timestampSchema.optional(),
    finding: z.string().min(1),
    remediation: z.string().min(1),
  })),
  releaseChecklist: z.array(z.object({
    item: z.string().min(1),
    status: z.enum(["pass", "fail", "not_applicable"]),
    note: z.string().min(1),
  })).min(1),
});

export type ArtDirectionOutput = z.infer<typeof artDirectionOutputSchema>;
export type WardrobeAppearanceOutput = z.infer<typeof wardrobeAppearanceOutputSchema>;
export type PerformanceVoiceOutput = z.infer<typeof performanceVoiceOutputSchema>;
export type SoundDesignOutput = z.infer<typeof soundDesignOutputSchema>;
export type EditorOutput = z.infer<typeof editorOutputSchema>;
export type ColorContinuityOutput = z.infer<typeof colorContinuityOutputSchema>;
export type AvQcOutput = z.infer<typeof avQcOutputSchema>;

/** The persisted council wire contracts.  These wrappers deliberately remain
 * separate from a specialist's craft output so a later round can be replayed
 * without changing the meaning of the original recommendation. */
export const audiovisualCouncilRoleSchema = z.enum([
  "art_direction", "wardrobe_appearance", "performance_voice", "sound_design",
  "editor", "color_continuity", "av_qc",
]);
export type AudiovisualCouncilRole = z.infer<typeof audiovisualCouncilRoleSchema>;

const proposalMetadataSchema = z.object({
  assumptions: z.array(z.string().min(1)).default([]),
  dependencies: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
});
export const roleProposalSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("art_direction"), proposal: artDirectionOutputSchema }).extend(proposalMetadataSchema.shape),
  z.object({ role: z.literal("wardrobe_appearance"), proposal: wardrobeAppearanceOutputSchema }).extend(proposalMetadataSchema.shape),
  z.object({ role: z.literal("performance_voice"), proposal: performanceVoiceOutputSchema }).extend(proposalMetadataSchema.shape),
  z.object({ role: z.literal("sound_design"), proposal: soundDesignOutputSchema }).extend(proposalMetadataSchema.shape),
  z.object({ role: z.literal("editor"), proposal: editorOutputSchema }).extend(proposalMetadataSchema.shape),
  z.object({ role: z.literal("color_continuity"), proposal: colorContinuityOutputSchema }).extend(proposalMetadataSchema.shape),
  z.object({ role: z.literal("av_qc"), proposal: avQcOutputSchema }).extend(proposalMetadataSchema.shape),
]);
export type RoleProposal = z.infer<typeof roleProposalSchema>;

export const roleCritiqueSchema = z.object({
  role: audiovisualCouncilRoleSchema,
  overallAssessment: z.enum(["support", "support_with_changes", "block"]),
  findings: z.array(z.object({
    proposalRole: audiovisualCouncilRoleSchema,
    severity: prioritySchema,
    issue: z.string().min(1),
    recommendedResolution: z.string().min(1),
  })),
  nonNegotiables: z.array(z.string().min(1)).default([]),
});
export type RoleCritique = z.infer<typeof roleCritiqueSchema>;

const executableSceneSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  negativePrompt: z.string().min(1),
  durationSeconds: z.number().positive(),
  sourceType: z.enum(["filmed", "digital_twin", "synthetic", "hybrid"]),
  voiceoverText: z.string(),
  hasAvatar: z.boolean(),
  visualDirection: z.string().min(1),
  audioDirection: z.string().min(1),
  editDirection: z.string().min(1),
  colorDirection: z.string().min(1),
});
export const trailerPlanSchema = z.object({
  durationSeconds: z.union([z.literal(15), z.literal(30)]),
  orderedSceneSegments: z.array(z.object({
    sceneId: z.string().min(1),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
  })).min(1),
  hook: z.string().min(1),
  captions: z.array(z.string().min(1)).min(1),
  soundDirection: z.string().min(1),
  editDirection: z.string().min(1),
});
export const directorSynthesisSchema = z.object({
  executableScenes: z.array(executableSceneSchema).min(1),
  conflictDecisions: z.array(z.object({
    conflict: z.string().min(1),
    decision: z.string().min(1),
    rationale: z.string().min(1),
    affectedRoles: z.array(audiovisualCouncilRoleSchema).min(1),
  })),
  trailerPlans: z.array(trailerPlanSchema).default([]),
  productionNotes: z.array(z.string().min(1)).default([]),
});
export type DirectorSynthesis = z.infer<typeof directorSynthesisSchema>;

export interface AudiovisualAgentInput {
  campaignId: string | null;
  workspaceId: string;
  brief: string;
  log: Logger;
  memoryContext?: string;
  profileContext?: string;
  phaseContext?: string;
  temporalContext?: TemporalContextOpts;
}

export interface CouncilAgentInput extends AudiovisualAgentInput {
  role?: AudiovisualCouncilRole;
  proposals?: RoleProposal[];
  critiques?: RoleCritique[];
  trailerPolicy?: { enabled: boolean; durationsSeconds: Array<15 | 30> };
}

const SPECIALIST_PROMPTS: Record<keyof AudiovisualOutputByRole, string> = {
  art_direction: "Você é o Diretor de Arte. Traduza o briefing em uma linguagem visual filmável, consistente com a marca e o arco emocional. Não invente assets, locações ou permissões. Retorne somente JSON no schema solicitado.",
  wardrobe_appearance: "Você é o especialista de figurino e aparência. Defina looks filmáveis, respeitosos e consistentes entre planos; não presuma características sensíveis de pessoas. Retorne somente JSON no schema solicitado.",
  performance_voice: "Você é o diretor de performance e voz. Direcione intenção, ritmo e ênfase sem prometer resultados ou orientar imitação de uma pessoa real. Retorne somente JSON no schema solicitado.",
  sound_design: "Você é o sound designer. Planeje música, efeitos, mix e acessibilidade usando apenas áudio licenciado ou original. Retorne somente JSON no schema solicitado.",
  editor: "Você é o editor. Converta o arco narrativo em decisões de ritmo, corte e transição executáveis. Retorne somente JSON no schema solicitado.",
  color_continuity: "Você é o colorista de continuidade. Proteja tons de pele, intenção de marca e correspondência entre planos. Retorne somente JSON no schema solicitado.",
  av_qc: "Você é o auditor final audiovisual. Identifique somente problemas verificáveis no material/brief fornecido, priorize correções e não aprove alegações sem evidência. Retorne somente JSON no schema solicitado.",
};

interface AudiovisualOutputByRole {
  art_direction: ArtDirectionOutput;
  wardrobe_appearance: WardrobeAppearanceOutput;
  performance_voice: PerformanceVoiceOutput;
  sound_design: SoundDesignOutput;
  editor: EditorOutput;
  color_continuity: ColorContinuityOutput;
  av_qc: AvQcOutput;
}

const OUTPUT_SCHEMAS: { [R in keyof AudiovisualOutputByRole]: z.ZodType<AudiovisualOutputByRole[R]> } = {
  art_direction: artDirectionOutputSchema,
  wardrobe_appearance: wardrobeAppearanceOutputSchema,
  performance_voice: performanceVoiceOutputSchema,
  sound_design: soundDesignOutputSchema,
  editor: editorOutputSchema,
  color_continuity: colorContinuityOutputSchema,
  av_qc: avQcOutputSchema,
};

async function runAudiovisualSpecialist<R extends keyof AudiovisualOutputByRole>(
  role: R,
  input: AudiovisualAgentInput,
): Promise<AudiovisualOutputByRole[R]> {
  const result = await runAgent({
    campaignId: input.campaignId,
    workspaceId: input.workspaceId,
    agentRole: role as AgentRole,
    systemPrompt: `${SPECIALIST_PROMPTS[role]}

Use o briefing abaixo e preserve as decisões válidas já presentes nas camadas de contexto. O JSON deve obedecer exatamente a este schema:
${JSON.stringify(z.toJSONSchema(OUTPUT_SCHEMAS[role]))}`,
    messages: [{ role: "user", content: input.brief }],
    log: input.log,
    memoryContext: input.memoryContext,
    profileContext: input.profileContext,
    phaseContext: input.phaseContext,
    temporalContext: input.temporalContext,
    thinkingMessages: ["Analisando o briefing audiovisual...", "Estruturando recomendações executáveis..."],
  });

  const raw = parseAgentJSON<unknown>(result.content, {});
  const parsed = OUTPUT_SCHEMAS[role].safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Resposta inválida do agente ${role}: ${parsed.error.issues.map((issue) => issue.path.join(".") || issue.message).join("; ")}`);
  }
  return parsed.data;
}

export const runArtDirectionAgent = (input: AudiovisualAgentInput) => runAudiovisualSpecialist("art_direction", input);
export const runWardrobeAppearanceAgent = (input: AudiovisualAgentInput) => runAudiovisualSpecialist("wardrobe_appearance", input);
export const runPerformanceVoiceAgent = (input: AudiovisualAgentInput) => runAudiovisualSpecialist("performance_voice", input);
export const runSoundDesignAgent = (input: AudiovisualAgentInput) => runAudiovisualSpecialist("sound_design", input);
export const runEditorAgent = (input: AudiovisualAgentInput) => runAudiovisualSpecialist("editor", input);
export const runColorContinuityAgent = (input: AudiovisualAgentInput) => runAudiovisualSpecialist("color_continuity", input);
export const runAvQcAgent = (input: AudiovisualAgentInput) => runAudiovisualSpecialist("av_qc", input);

async function runCouncilContract<T extends z.ZodType>(
  input: CouncilAgentInput,
  schema: T,
  systemPrompt: string,
): Promise<z.infer<T>> {
  const result = await runAgent({
    campaignId: input.campaignId,
    workspaceId: input.workspaceId,
    agentRole: input.role ?? "scene_director",
    systemPrompt: `${systemPrompt}\nRetorne somente JSON que obedeça exatamente este schema:\n${JSON.stringify(z.toJSONSchema(schema))}`,
    messages: [{ role: "user", content: input.brief }],
    log: input.log,
    memoryContext: input.memoryContext,
    profileContext: input.profileContext,
    phaseContext: input.phaseContext,
    temporalContext: input.temporalContext,
    thinkingMessages: ["Revisando o conselho audiovisual...", "Produzindo contrato executável..."],
  });
  const parsed = schema.safeParse(parseAgentJSON<unknown>(result.content, {}));
  if (!parsed.success) {
    throw new Error(`Resposta inválida do contrato do conselho: ${parsed.error.issues.map((issue) => issue.path.join(".") || issue.message).join("; ")}`);
  }
  return parsed.data;
}

/** Round-one wrapper. Craft proposals are validated by their role runner first;
 * this contract supplies immutable assumptions/dependencies/risk metadata. */
export const runRoleProposalContract = (input: CouncilAgentInput) => {
  if (!input.role) throw new Error("Council role is required for a role proposal");
  return runCouncilContract(input, roleProposalSchema,
    `Você representa o papel ${input.role} no conselho. Resuma a proposta de produção fornecida no briefing, sem inventar fatos, incluindo pressupostos, dependências e riscos.`);
};

export const runRoleCritiqueContract = (input: CouncilAgentInput) => {
  if (!input.role) throw new Error("Council role is required for a role critique");
  return runCouncilContract(input, roleCritiqueSchema,
    `Você representa o papel ${input.role} na segunda rodada do conselho. Critique o conjunto completo de propostas fornecido no briefing. Aponte apenas conflitos verificáveis e resoluções práticas.`);
};

export const runDirectorSynthesisContract = (input: CouncilAgentInput) =>
  runCouncilContract(input, directorSynthesisSchema,
    `Você é o scene_director e preside o conselho audiovisual. Sintetize propostas e críticas em um plano executável. Cada cena precisa ter todos os campos exigidos. Se sourceMode for synthetic, hasAvatar DEVE ser false. Só crie trailerPlans para as durações solicitadas na trailerPolicy e somente se o master exceder 30 segundos. Cada trailer deve selecionar segmentos ordenados, não apenas o início do master.`);