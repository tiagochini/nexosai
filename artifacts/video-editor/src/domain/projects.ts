export const PRODUCTION_PHASES = [
  "script",
  "storyboard",
  "assets",
  "timeline",
  "edit",
  "sound",
  "color",
  "qc",
  "corrections",
  "export",
] as const;

export type ProductionPhase = (typeof PRODUCTION_PHASES)[number];
export type ProjectStatus = "draft" | "active" | "review" | "complete" | "archived";
export type PhaseStatus = "not_started" | "in_progress" | "ready" | "blocked";

export interface ProjectPhase {
  phase: ProductionPhase;
  status: PhaseStatus;
  updatedAt?: string;
  owner?: string;
}

export interface StudioProject {
  id: string;
  name: string;
  status: ProjectStatus;
  activePhase: ProductionPhase;
  phases: ProjectPhase[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudioProjectInput {
  name: string;
  campaignId?: string;
  format?: "vsl" | "cpl" | "live_promo" | "stories" | "reels" | "youtube" | "webinar_promo" | "testimonial" | "product_demo";
  sourceMode?: "filmed" | "digital_twin" | "synthetic" | "hybrid";
  targetDurationsSeconds?: number[];
  aspectRatio?: "16:9" | "9:16" | "1:1";
  trailerPolicy?: {
    enabled: boolean;
    durations: (15 | 30)[];
  };
}

export interface StudioProjectCollection {
  projects: StudioProject[];
}