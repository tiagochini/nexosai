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
  if (channel === "telegram") {
    return {
      supported: true,
      reason: action === "respond"
        ? "Requires a configured Telegram bot."
        : "Requires the configured Telegram bot to be administrator with the matching chat permission.",
    };
  }
  return { supported: false, reason: `No ${channel} community mutation adapter is configured.` };
}