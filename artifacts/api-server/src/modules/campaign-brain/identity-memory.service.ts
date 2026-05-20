/**
 * Identity Memory — Longitudinal Strategic Profile
 *
 * O workspace aprende o perfil estratégico do founder ao longo das campanhas.
 * Armazenado em workspace.settings.identityProfile (JSONB existente).
 *
 * Aprende: tom preferido, agressividade, gatilhos que convertem, nichos que saturaram,
 * narrativas que funcionaram, padrões do produto.
 */

import { db, workspacesTable, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StrategicPattern {
  pattern:     string;
  strength:    "strong" | "moderate" | "weak";
  evidence:    string;
  lastSeen:    string;
}

export interface IdentityProfile {
  version:         number;
  lastUpdatedAt:   string;
  campaignsLearned: number;

  // Voice & style
  preferredTone:          string | null;
  preferredEmotion:       string | null;
  aggressionLevel:        "low" | "moderate" | "high" | null;
  brandVoiceKeywords:     string[];

  // Strategic patterns
  successfulTriggers:     string[];
  saturatedApproaches:    string[];
  topPositioning:         string | null;
  preferredCampaignTypes: string[];

  // ICP intelligence
  icpEvolution:           string[];   // recurring ICP descriptions
  conversionContext:      string[];   // what contexts drove conversions

  // Learnings
  strategicPatterns:      StrategicPattern[];
  founderNotes:           string[];   // AI-extracted founder intent cues
}

// ─── Default profile ──────────────────────────────────────────────────────────

function defaultProfile(): IdentityProfile {
  return {
    version:              1,
    lastUpdatedAt:        new Date().toISOString(),
    campaignsLearned:     0,
    preferredTone:        null,
    preferredEmotion:     null,
    aggressionLevel:      null,
    brandVoiceKeywords:   [],
    successfulTriggers:   [],
    saturatedApproaches:  [],
    topPositioning:       null,
    preferredCampaignTypes: [],
    icpEvolution:         [],
    conversionContext:    [],
    strategicPatterns:    [],
    founderNotes:         [],
  };
}

// ─── Pattern strength helper ──────────────────────────────────────────────────

function resolveStrength(count: number, total: number): "strong" | "moderate" | "weak" {
  const ratio = count / Math.max(total, 1);
  if (ratio >= 0.6) return "strong";
  if (ratio >= 0.3) return "moderate";
  return "weak";
}

// ─── Build profile from campaign history ─────────────────────────────────────

async function buildProfileFromHistory(workspaceId: string): Promise<IdentityProfile> {
  const campaigns = await db
    .select({
      id:        campaignsTable.id,
      type:      campaignsTable.type,
      status:    campaignsTable.status,
      brainData: (campaignsTable as any).brainData,
      intakeData: campaignsTable.intakeData,
      createdAt: campaignsTable.createdAt,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.workspaceId, workspaceId))
    .limit(100);

  // Filter out very early-stage campaigns that have no brain data yet
  const activeCampaigns = campaigns
    .filter(c => !["draft", "analyzing"].includes(c.status))
    .slice(0, 50);

  if (activeCampaigns.length === 0) return defaultProfile();

  const profile = defaultProfile();
  profile.campaignsLearned = activeCampaigns.length;

  // Tally collections
  const tones:      Record<string, number> = {};
  const emotions:   Record<string, number> = {};
  const triggers:   Record<string, number> = {};
  const positions:  Record<string, number> = {};
  const types:      Record<string, number> = {};
  const icpDescs:   string[] = [];

  for (const c of activeCampaigns) {
    const brain    = (c.brainData   ?? {}) as Record<string, unknown>;
    const intake   = (c.intakeData  ?? {}) as Record<string, unknown>;
    const narrative = (brain["narrative"] ?? {}) as Record<string, unknown>;
    const offer     = (brain["offer"]     ?? {}) as Record<string, unknown>;
    const icp       = (brain["icp"]       ?? {}) as Record<string, unknown>;

    if (narrative["tone"])           tones[String(narrative["tone"])]     = (tones[String(narrative["tone"])]    ?? 0) + 1;
    if (narrative["dominantEmotion"]) emotions[String(narrative["dominantEmotion"])] = (emotions[String(narrative["dominantEmotion"])] ?? 0) + 1;
    if (offer["positioning"])        positions[String(offer["positioning"])] = (positions[String(offer["positioning"])] ?? 0) + 1;
    if (c.type)                      types[c.type] = (types[c.type] ?? 0) + 1;
    if (icp["description"])          icpDescs.push(String(icp["description"]).slice(0, 100));

    const stratOutput = (brain["strategyOutput"] ?? {}) as Record<string, unknown>;
    if (Array.isArray(stratOutput["mentalTriggers"])) {
      for (const t of stratOutput["mentalTriggers"] as string[]) {
        triggers[t] = (triggers[t] ?? 0) + 1;
      }
    }

    // Founder notes from intake
    if (intake["founderVision"])  profile.founderNotes.push(String(intake["founderVision"]).slice(0, 80));
    if (intake["brandVoice"])     profile.brandVoiceKeywords.push(...String(intake["brandVoice"]).split(",").map(s => s.trim()).filter(Boolean));
  }

  // Resolve dominant values
  profile.preferredTone     = Object.entries(tones).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  profile.preferredEmotion  = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  profile.topPositioning    = Object.entries(positions).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  profile.preferredCampaignTypes = Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  profile.successfulTriggers     = Object.entries(triggers).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
  profile.icpEvolution           = [...new Set(icpDescs)].slice(0, 5);
  profile.brandVoiceKeywords     = [...new Set(profile.brandVoiceKeywords)].slice(0, 10);
  profile.founderNotes           = [...new Set(profile.founderNotes)].slice(0, 5);

  // Aggression level from tone/emotion patterns
  const aggressiveTones = ["direto", "provocador", "urgente", "desafiador", "bold"];
  const softTones       = ["suave", "educativo", "inspirador", "sóbrio", "sereno"];
  if (profile.preferredTone) {
    if (aggressiveTones.some(t => profile.preferredTone!.toLowerCase().includes(t))) profile.aggressionLevel = "high";
    else if (softTones.some(t => profile.preferredTone!.toLowerCase().includes(t)))  profile.aggressionLevel = "low";
    else profile.aggressionLevel = "moderate";
  }

  // Strategic patterns
  const patterns: StrategicPattern[] = [];
  const total = activeCampaigns.length;
  if (profile.preferredTone) {
    patterns.push({
      pattern:  `Tom "${profile.preferredTone}" é o padrão dominante`,
      strength: resolveStrength(tones[profile.preferredTone] ?? 0, total),
      evidence: `${tones[profile.preferredTone] ?? 0} de ${total} campanhas`,
      lastSeen: activeCampaigns[0]?.createdAt?.toISOString() ?? "",
    });
  }
  if (profile.successfulTriggers.length > 0) {
    patterns.push({
      pattern:  `Gatilho "${profile.successfulTriggers[0]}" é o mais ativado`,
      strength: resolveStrength(triggers[profile.successfulTriggers[0]] ?? 0, total),
      evidence: `usado em ${triggers[profile.successfulTriggers[0]] ?? 0} campanhas`,
      lastSeen: activeCampaigns[0]?.createdAt?.toISOString() ?? "",
    });
  }

  profile.strategicPatterns = patterns;
  profile.lastUpdatedAt = new Date().toISOString();

  return profile;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getIdentityProfile(workspaceId: string): Promise<IdentityProfile> {
  const [ws] = await db
    .select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  const settings = (ws?.settings ?? {}) as Record<string, unknown>;
  return (settings["identityProfile"] as IdentityProfile | null) ?? defaultProfile();
}

export async function refreshIdentityProfile(
  workspaceId: string,
  log: Logger,
): Promise<IdentityProfile> {
  log.info({ workspaceId }, "Refreshing identity profile from campaign history");
  const profile = await buildProfileFromHistory(workspaceId);

  const [ws] = await db
    .select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  const settings = { ...(ws?.settings ?? {}) as Record<string, unknown>, identityProfile: profile };

  await db
    .update(workspacesTable)
    .set({ settings: settings as any })
    .where(eq(workspacesTable.id, workspaceId));

  log.info({ workspaceId, campaigns: profile.campaignsLearned }, "Identity profile refreshed");
  return profile;
}

/** Append a founder note manually (from intake AI conversation) */
export async function appendFounderNote(
  workspaceId: string,
  note: string,
  log: Logger,
): Promise<void> {
  const profile = await getIdentityProfile(workspaceId);
  profile.founderNotes = [...new Set([note.slice(0, 100), ...profile.founderNotes])].slice(0, 10);
  profile.lastUpdatedAt = new Date().toISOString();

  const [ws] = await db
    .select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  const settings = { ...(ws?.settings ?? {}) as Record<string, unknown>, identityProfile: profile };
  await db.update(workspacesTable).set({ settings: settings as any }).where(eq(workspacesTable.id, workspaceId));
  log.info({ workspaceId }, "Founder note appended to identity profile");
}
