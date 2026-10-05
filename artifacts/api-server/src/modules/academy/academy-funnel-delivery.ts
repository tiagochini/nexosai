import nodemailer from "nodemailer";

export type FunnelDeliveryResult =
  | { status: "sent"; providerId: string }
  | { status: "scheduled" | "failed"; errorCode: string };

type Message = { to: string; subject: string; html: string };
type Configuration = {
  resendKey?: string;
  resendFrom: string;
  gmailUser?: string;
  gmailPassword?: string;
};
type GmailReceipt = { accepted?: unknown[]; messageId?: string };
type Dependencies = {
  fetch: typeof fetch;
  sendGmail: (message: Message, config: Configuration) => Promise<GmailReceipt>;
};

const defaultDependencies: Dependencies = {
  fetch: (...args) => globalThis.fetch(...args),
  async sendGmail(message, config) {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: config.gmailUser, pass: config.gmailPassword },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
    try {
      return await transport.sendMail({
        ...message,
        from: `"NexOS Academy" <${config.gmailUser}>`,
      });
    } finally {
      transport.close();
    }
  },
};

// "sent" means provider acceptance, not delivery to the recipient's inbox.
// Do not fall back after an ambiguous Resend failure: it could duplicate mail.
export async function deliverFunnelMessage(
  message: Message,
  config: Configuration,
  dependencies: Dependencies = defaultDependencies,
): Promise<FunnelDeliveryResult> {
  if (!config.resendKey && !(config.gmailUser && config.gmailPassword)) {
    return { status: "scheduled", errorCode: "EMAIL_PROVIDER_NOT_CONFIGURED" };
  }
  try {
    if (config.resendKey) {
      const response = await dependencies.fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...message, from: config.resendFrom }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        return { status: "failed", errorCode: `RESEND_HTTP_${response.status}` };
      }
      const receipt: unknown = await response.json();
      const id = receipt && typeof receipt === "object" && "id" in receipt
        ? receipt.id : undefined;
      if (typeof id !== "string" || !id.trim() || id.length > 100) {
        return { status: "failed", errorCode: "RESEND_INVALID_RECEIPT" };
      }
      return { status: "sent", providerId: id };
    }
    const receipt = await dependencies.sendGmail(message, config);
    const accepted = receipt.accepted?.some((recipient) =>
      typeof recipient === "string" && recipient.toLowerCase() === message.to.toLowerCase(),
    );
    if (!accepted || !receipt.messageId?.trim() || receipt.messageId.length > 100) {
      return { status: "failed", errorCode: "GMAIL_RECIPIENT_NOT_ACCEPTED" };
    }
    return { status: "sent", providerId: receipt.messageId };
  } catch {
    // Never persist provider response bodies, recipient data or credentials.
    return { status: "failed", errorCode: config.resendKey
      ? "RESEND_TRANSPORT_ERROR" : "GMAIL_TRANSPORT_ERROR" };
  }
}

export function funnelDeliveryPatch(result: FunnelDeliveryResult, now = new Date()) {
  return {
    status: result.status,
    sentAt: result.status === "sent" ? now : null,
    resendId: result.status === "sent" ? result.providerId : null,
    errorMessage: result.status === "sent" ? null : result.errorCode,
  };
}
