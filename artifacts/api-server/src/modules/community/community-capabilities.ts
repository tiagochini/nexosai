export type CommunityChannel = "whatsapp" | "telegram" | "instagram" | "facebook";
export type CommunityAction = "delete" | "restrict" | "ban" | "respond";

/**
 * This is intentionally conservative: a capability means an official provider
 * mutation exists, not merely that a user could perform it in a native app.
 */
export function providerCapability(channel: CommunityChannel, action: CommunityAction): {
  supported: boolean; reason?: string;
} {
  if (channel === "whatsapp") {
    return {
      supported: false,
      reason: "WhatsApp Business Cloud API does not support general group moderation or group creation mutations.",
    };
  }
  if (channel === "telegram" && action !== "respond") {
    return {
      supported: false,
      reason: "Telegram moderation requires a bot administrator and is not executed until an authorized provider adapter is configured.",
    };
  }
  return { supported: false, reason: `No ${channel} community mutation adapter is configured.` };
}