import assert from "node:assert/strict";
import { TelegramBotAdapter, normalizeTelegramUpdate, resolveTelegramBotToken, validateTelegramWebhookSecret, type TelegramIntegrationConfig } from "../modules/community/telegram.adapter.js";

const config: TelegramIntegrationConfig = {
  id: "integration-a", workspaceId: "workspace-a", status: "connected", accountId: "42",
  metadata: { telegramBotTokenRef: "TELEGRAM_UNIT_TOKEN", telegramWebhookSecretRef: "TELEGRAM_UNIT_SECRET" },
};
process.env["TELEGRAM_UNIT_TOKEN"] = "unit-token-not-persisted";
process.env["TELEGRAM_UNIT_SECRET"] = "unit-webhook-secret";
assert.equal(resolveTelegramBotToken(config), "unit-token-not-persisted");
assert.equal(validateTelegramWebhookSecret(config, "unit-webhook-secret"), true);
assert.equal(validateTelegramWebhookSecret(config, "incorrect"), false);
assert.throws(() => resolveTelegramBotToken({ ...config, metadata: { telegramBotTokenRef: "bad ref" } }), /reference/);

const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
const transport = async (url: string, init: { body: string }) => {
  const method = url.split("/").at(-1)!; calls.push({ method, body: JSON.parse(init.body) });
  const result = method === "getMe" ? { id: 42, first_name: "NexOS" }
    : method === "getChat" ? { id: -100, type: "supergroup", is_forum: true }
    : method === "getChatMember" ? { status: "administrator", can_delete_messages: true, can_restrict_members: true, can_pin_messages: true, can_manage_topics: true }
    : method === "sendMessage" ? { message_id: 9, chat: { id: -100 } } : true;
  return { ok: true, status: 200, json: async () => ({ ok: true, result }) };
};
const adapter = new TelegramBotAdapter(config, transport);
assert.equal((await adapter.getMe()).id, 42);
assert.equal((await adapter.discoverGroup("-100")).actions.ban, true);
assert.equal((await adapter.send("-100", "approved text")).providerMessageId, "9");
await adapter.delete("-100", "9");
assert.deepEqual(calls.map((call) => call.method), ["getMe", "getChat", "getChatMember", "sendMessage", "deleteMessage"]);

const normalized = normalizeTelegramUpdate({ update_id: 7, message: { message_id: 3, date: 1_700_000_000, text: "hello", chat: { id: -100, type: "supergroup" }, from: { id: 88, first_name: "Member" } } }, config.id);
assert.equal(normalized?.providerMessageId, "-100:3");
assert.equal(normalizeTelegramUpdate({ update_id: 8, message: { message_id: 3, date: 1, chat: { id: 1, type: "private" }, from: { id: 1 } } }, config.id), null);
console.log("telegram adapter secret references, provider contract and group update normalization passed");