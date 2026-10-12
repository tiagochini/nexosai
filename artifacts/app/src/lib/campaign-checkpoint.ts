/** API uses checkpointType; accept older cached responses with type as well. */
export interface CampaignCheckpoint {
  id: string;
  checkpointType?: string;
  type?: string;
  status: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export function checkpointType(checkpoint: CampaignCheckpoint): string {
  return checkpoint.checkpointType ?? checkpoint.type ?? "";
}

export function checkpointNeedsReview(checkpoint: CampaignCheckpoint): boolean {
  return checkpoint.status === "pending" || checkpoint.status === "awaiting_review";
}
