export function masterPlanReview(data: Record<string, unknown>, campaignType?: string, campaignTrack?: string) {
  const text = (key: string) => typeof data[key] === "string" ? data[key] as string : "";
  const model = campaignType || text("campaign.type") || text("campaign.model") || text("launch.model") || "launch";
  const continuous = ["continuous_sales", "subscription_growth", "perpetual_launch"].includes(model);
  const raw = data["campaign.timeline"] ?? data["launch.duration"];
  const duration = typeof raw === "number" ? raw : Number(String(raw ?? "").match(/^(\d+)\s*(?:_days|dias|days)?$/i)?.[1]);
  return { model, continuous, duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    track: campaignTrack || text("campaign.track") || text("launch.track") || (continuous ? "not_applicable" : "six_digits"),
    audience: text("audience.description") || text("audience.avatar") || text("audience.target") || text("audience.primaryPersona"),
    reviewNotes: text("briefing.reviewNotes"),
  };
}
