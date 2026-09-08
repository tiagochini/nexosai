/**
 * Telegram Bot API boundary. Credentials are references to process secrets, never
 * values stored in the integration row. Keep this module transport-injectable so
 * its provider contract is testable without a network or a bot token.
 */
export type TelegramTransport = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

type TelegramResult<T> = { ok: boolean; result?: T; description?: string; error_code?: number };
export type TelegramIntegrationConfig = {
  id: string; workspaceId: string; status: string; accountId: string | null;
  metadata: Record<string, unknown>;
};
export type TelegramReceipt = { provider: "telegram"; method: string; providerMessageId?: string; chatId?: string; at: string };

const telegramTransport: TelegramTransport = (url, init) => fetch(url, init);
const secretName = /^[A-Z][A-Z0-9_]{2,127}$/;

function secretRef(config: TelegramIntegrationConfig, field: "telegramBotTokenRef" | "telegramWebhookSecretRef") {
  const value = config.metadata[field];
  return typeof value === "string" && secretName.test(value) ? value : undefined;
}

export function resolveTelegramBotToken(config: TelegramIntegrationConfig): string {
  const ref = secretRef(config, "telegramBotTokenRef");
  const value = ref ? process.env[ref] : undefined;
  if (!value) throw new Error("Telegram bot token reference is not configured or unavailable");
  return value;
}

export function validateTelegramWebhookSecret(config: TelegramIntegrationConfig, supplied: string | undefined): boolean {
  const ref = secretRef(config, "telegramWebhookSecretRef");
  const expected = ref ? process.env[ref] : undefined;
  if (!expected || !supplied || expected.length !== supplied.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return mismatch === 0;
}

export class TelegramBotAdapter {
  constructor(private readonly config: TelegramIntegrationConfig, private readonly transport: TelegramTransport = telegramTransport) {}

  private async call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const token = resolveTelegramBotToken(this.config);
    const response = await this.transport(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const payload = await response.json() as TelegramResult<T>;
    if (!response.ok || !payload.ok || payload.result === undefined) {
      // Never expose Telegram's response verbatim: it can include user input.
      throw new Error(`Telegram ${method} failed (${payload.error_code ?? response.status})`);
    }
    return payload.result;
  }

  async getMe() {
    return this.call<{ id: number; username?: string; first_name: string }>("getMe", {});
  }

  async setWebhook(url: string) {
    if (!url.startsWith("https://")) throw new Error("Telegram webhook URL must use HTTPS");
    const secretRefName = secretRef(this.config, "telegramWebhookSecretRef");
    const secret = secretRefName ? process.env[secretRefName] : undefined;
    if (!secret) throw new Error("Telegram webhook secret reference is not configured or unavailable");
    await this.call<boolean>("setWebhook", {
      url, secret_token: secret, allowed_updates: ["message", "edited_message", "channel_post", "my_chat_member", "chat_member"],
    });
    return { provider: "telegram" as const, method: "setWebhook", at: new Date().toISOString() };
  }

  async discoverGroup(chatId: string) {
    if (!this.config.accountId) throw new Error("Telegram bot account ID is not verified; complete readiness first");
    const [chat, bot] = await Promise.all([
      this.call<{ id: number; type: string; title?: string; is_forum?: boolean }>("getChat", { chat_id: chatId }),
      this.call<{ status: string; can_delete_messages?: boolean; can_restrict_members?: boolean; can_pin_messages?: boolean; can_manage_topics?: boolean }>("getChatMember", { chat_id: chatId, user_id: this.config.accountId }),
    ]);
    if (chat.type !== "group" && chat.type !== "supergroup") throw new Error("Telegram chat is not a group or supergroup");
    const admin = bot.status === "administrator" || bot.status === "creator";
    return {
      chatId: String(chat.id), type: chat.type, title: chat.title ?? null, isForum: !!chat.is_forum, botAdmin: admin,
      actions: {
        respond: true, delete: admin && !!bot.can_delete_messages, restrict: admin && !!bot.can_restrict_members,
        ban: admin && !!bot.can_restrict_members, pin: admin && !!bot.can_pin_messages,
        topic: admin && !!chat.is_forum && !!bot.can_manage_topics,
      },
    };
  }

  async send(chatId: string, text: string, messageThreadId?: number): Promise<TelegramReceipt> {
    const result = await this.call<{ message_id: number; chat: { id: number } }>("sendMessage", { chat_id: chatId, text, ...(messageThreadId ? { message_thread_id: messageThreadId } : {}) });
    return { provider: "telegram", method: "sendMessage", providerMessageId: String(result.message_id), chatId: String(result.chat.id), at: new Date().toISOString() };
  }
  async delete(chatId: string, messageId: string): Promise<TelegramReceipt> {
    await this.call<boolean>("deleteMessage", { chat_id: chatId, message_id: Number(messageId) });
    return { provider: "telegram", method: "deleteMessage", providerMessageId: messageId, chatId, at: new Date().toISOString() };
  }
  async restrict(chatId: string, userId: string): Promise<TelegramReceipt> {
    await this.call<boolean>("restrictChatMember", { chat_id: chatId, user_id: userId, permissions: { can_send_messages: false } });
    return { provider: "telegram", method: "restrictChatMember", chatId, at: new Date().toISOString() };
  }
  async ban(chatId: string, userId: string): Promise<TelegramReceipt> {
    await this.call<boolean>("banChatMember", { chat_id: chatId, user_id: userId });
    return { provider: "telegram", method: "banChatMember", chatId, at: new Date().toISOString() };
  }
  async pin(chatId: string, messageId: string): Promise<TelegramReceipt> {
    await this.call<boolean>("pinChatMessage", { chat_id: chatId, message_id: Number(messageId) });
    return { provider: "telegram", method: "pinChatMessage", providerMessageId: messageId, chatId, at: new Date().toISOString() };
  }
  async createTopic(chatId: string, name: string): Promise<TelegramReceipt> {
    const result = await this.call<{ message_thread_id: number }>("createForumTopic", { chat_id: chatId, name });
    return { provider: "telegram", method: "createForumTopic", providerMessageId: String(result.message_thread_id), chatId, at: new Date().toISOString() };
  }
}

export function normalizeTelegramUpdate(update: Record<string, unknown>, integrationId: string) {
  const message = (update["message"] ?? update["edited_message"] ?? update["channel_post"]) as Record<string, unknown> | undefined;
  const chat = message?.["chat"] as Record<string, unknown> | undefined;
  const from = message?.["from"] as Record<string, unknown> | undefined;
  if (!message || !chat || !from || (chat["type"] !== "group" && chat["type"] !== "supergroup")) return null;
  const updateId = update["update_id"];
  const messageId = message["message_id"];
  const chatId = chat["id"];
  const fromId = from["id"];
  const occurredSeconds = message["date"];
  if (typeof updateId !== "number" || !Number.isInteger(updateId) || typeof messageId !== "number" || !Number.isInteger(messageId) || typeof occurredSeconds !== "number" || !Number.isInteger(occurredSeconds) || (typeof chatId !== "number" && typeof chatId !== "string") || (typeof fromId !== "number" && typeof fromId !== "string")) return null;
  const username = typeof from["username"] === "string" ? `@${from["username"]}` : undefined;
  const names = [from["first_name"], from["last_name"]].filter((x): x is string => typeof x === "string");
  return {
    channel: "telegram" as const, integrationId, providerEventId: String(updateId), providerConversationId: String(chatId),
    providerMessageId: `${chatId}:${messageId}`, providerParticipantId: String(fromId), body: typeof message["text"] === "string" ? message["text"] : undefined,
    displayName: (username ?? names.join(" ")) || undefined, occurredAt: new Date(occurredSeconds * 1000),
    attachments: [], payload: { chatId: String(chatId), messageId: String(messageId), fromId: String(fromId), messageThreadId: message["message_thread_id"] },
  };
}