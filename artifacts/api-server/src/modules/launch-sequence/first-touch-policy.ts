import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
export type Segment = "cold" | "warm" | "hot" | "converted" | "unsubscribed";
export type JourneyStage = "awareness" | "consideration" | "qualification" | "objection_handling" | "closing" | "converted";
const segmentPhases: Record<Segment, string[]> = {
  cold: ["pre_capture", "capture", "plc1"], warm: ["plc1", "plc2", "plc3"],
  hot: ["pre_capture", "capture", "plc1", "plc2", "plc3", "cart_open", "cart_middle", "cart_close"],
  converted: [], unsubscribed: [],
};
const stagePhases: Record<JourneyStage, string[]> = {
  awareness: ["pre_capture", "capture", "plc1"], consideration: ["plc1", "plc2"],
  qualification: ["plc2", "plc3"], objection_handling: ["plc3", "cart_open", "cart_middle"],
  closing: ["cart_open", "cart_middle", "cart_close"], converted: [],
};
export const SEGMENTS = ["cold", "warm", "hot", "converted", "unsubscribed"] as const;
export const FIRST_TOUCH_PHASES = ["pre_capture", "capture", "plc1", "plc2", "plc3", "cart_open", "cart_middle", "cart_close"] as const;
export function segmentsForPhase(phase: string): Segment[] { return SEGMENTS.filter((s) => segmentPhases[s].includes(phase)); }
export const SEGMENT_PHASES = segmentPhases;
export const JOURNEY_STAGE_PHASES = stagePhases;
export function phaseEligible(segment: string, stage: string, phase: string): boolean {
  return (segmentPhases[segment as Segment] ?? []).includes(phase) && (stagePhases[stage as JourneyStage] ?? []).includes(phase);
}
export function phaseEligibilitySql(segment: SQLWrapper, stage: SQLWrapper, phase: SQLWrapper): SQL {
  const terms: SQL[] = [];
  for (const [s, phases] of Object.entries(segmentPhases)) for (const p of phases)
    if (stagePhases.awareness.concat(stagePhases.consideration, stagePhases.qualification, stagePhases.objection_handling, stagePhases.closing).includes(p))
      terms.push(sql`(${segment} = ${s} and ${phase} = ${p} and ${stage} in (${sql.join(Object.entries(stagePhases).filter(([, ps]) => ps.includes(p)).map(([x]) => sql`${x}`), sql`, `)}))`);
  return sql`(${sql.join(terms, sql` or `)})`;
}