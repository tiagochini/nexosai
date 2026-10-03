import { Router } from "express";
import { z } from "zod/v4";
import { eq, and, asc, desc } from "drizzle-orm";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";
import { completeWithAgent, callVisionChat } from "../ai-gateway/ai-gateway.service.js";
import { INTEGRATIONS_SPECIALIST_PROMPT } from "./integrations-specialist.prompt.js";
import {
  containsLikelyIntegrationCredential,
  INTEGRATION_CREDENTIAL_BLOCK_MESSAGE,
  redactIntegrationCredentials,
} from "./integration-credential-safety.js";
import {
  db,
  workspacesTable,
  auditLogsTable,
  integrationChatConversationsTable,
  integrationChatMessagesTable,
} from "@workspace/db";

const router = Router();
router.use(requireAuth);

const KICKOFF_USER_PROMPT =
  "[INÍCIO DE CONVERSA] Apresente-se rapidamente e siga o FLUXO GUIADO DE ABERTURA definido nas suas instruções, começando pela primeira pergunta.";

async function getOrCreateActiveConversation(workspaceId: string) {
  const [existing] = await db
    .select()
    .from(integrationChatConversationsTable)
    .where(
      and(
        eq(integrationChatConversationsTable.workspaceId, workspaceId),
        eq(integrationChatConversationsTable.status, "active"),
      ),
    )
    .orderBy(desc(integrationChatConversationsTable.createdAt))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(integrationChatConversationsTable)
    .values({ workspaceId, status: "active" })
    .returning();

  return created;
}

// ── GET /api/integration-chat/active — get or create the active guided conversation ──
router.get("/active", async (req, res): Promise<void> => {
  const workspaceId = req.auth.workspaceId;
  const conversation = await getOrCreateActiveConversation(workspaceId);

  let messages = await db
    .select()
    .from(integrationChatMessagesTable)
    .where(eq(integrationChatMessagesTable.conversationId, conversation.id))
    .orderBy(asc(integrationChatMessagesTable.createdAt));

  if (messages.length === 0) {
    const [ws] = await db
      .select({ creditsBalance: workspacesTable.creditsBalance })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId))
      .limit(1);

    if (ws && ws.creditsBalance >= 1) {
      try {
        const result = await completeWithAgent(
          "integrations_specialist",
          INTEGRATIONS_SPECIALIST_PROMPT,
          [{ role: "user", content: KICKOFF_USER_PROMPT }],
          workspaceId,
          req.log,
        );

        const [saved] = await db
          .insert(integrationChatMessagesTable)
          .values({ conversationId: conversation.id, role: "assistant", content: result.content })
          .returning();

        await db
          .update(workspacesTable)
          .set({ creditsBalance: Math.max(0, ws.creditsBalance - 1) })
          .where(eq(workspacesTable.id, workspaceId));

        messages = [saved];
      } catch (err) {
        req.log.warn({ err }, "integration-chat: failed to generate kickoff message");
      }
    }
  }

  res.json({
    conversation,
    messages: messages.map((item) => ({
      ...item,
      content: redactIntegrationCredentials(item.content),
      imageUrl: null,
    })),
  });
});

const sendMessageSchema = z.object({
  message: z.string().max(12000).default(""),
  images: z.array(z.string()).max(10).optional(),
});

// ── POST /api/integration-chat/:conversationId/messages — send a message, get AI reply ──
router.post("/:conversationId/messages", async (req, res): Promise<void> => {
  const { conversationId } = req.params;
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const { message, images } = parsed.data;
  const hasImages = Array.isArray(images) && images.length > 0;
  if (!message.trim() && !hasImages) {
    res.status(400).json({ error: "Mensagem vazia", code: "VALIDATION_ERROR" });
    return;
  }
  if (hasImages || containsLikelyIntegrationCredential(message)) {
    res.status(422).json({
      error: INTEGRATION_CREDENTIAL_BLOCK_MESSAGE,
      code: "CREDENTIAL_INPUT_BLOCKED",
    });
    return;
  }

  const workspaceId = req.auth.workspaceId;

  const [conversation] = await db
    .select()
    .from(integrationChatConversationsTable)
    .where(
      and(
        eq(integrationChatConversationsTable.id, conversationId),
        eq(integrationChatConversationsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!conversation) {
    res.status(404).json({ error: "Conversa não encontrada", code: "NOT_FOUND" });
    return;
  }
  if (conversation.status !== "active") {
    res.status(409).json({ error: "Esta conversa já foi encerrada", code: "CONVERSATION_ENDED" });
    return;
  }

  const creditCost = hasImages ? 5 : 3;

  try {
    const [ws] = await db
      .select({ creditsBalance: workspacesTable.creditsBalance })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId))
      .limit(1);

    if (!ws || ws.creditsBalance < creditCost) {
      res.status(402).json({
        error: `Créditos insuficientes (mín ${creditCost} por mensagem${hasImages ? " com imagem" : ""})`,
        code: "INSUFFICIENT_CREDITS",
      });
      return;
    }

    const priorMessages = await db
      .select()
      .from(integrationChatMessagesTable)
      .where(eq(integrationChatMessagesTable.conversationId, conversationId))
      .orderBy(asc(integrationChatMessagesTable.createdAt));

    const history = priorMessages.map(m => ({
      role: m.role as "user" | "assistant",
      content: redactIntegrationCredentials(m.content),
    }));

    const userContent = message || "Analise esta imagem que enviei.";

    const [userMsg] = await db
      .insert(integrationChatMessagesTable)
      .values({
        conversationId,
        role: "user",
        content: userContent,
        imageUrl: hasImages ? images![0] : null,
      })
      .returning();

    let result;
    if (hasImages) {
      result = await callVisionChat(
        INTEGRATIONS_SPECIALIST_PROMPT,
        [...history, { role: "user" as const, content: userContent }],
        images!,
        workspaceId,
        req.log,
      );
    } else {
      result = await completeWithAgent(
        "integrations_specialist",
        INTEGRATIONS_SPECIALIST_PROMPT,
        [...history, { role: "user" as const, content: userContent }],
        workspaceId,
        req.log,
      );
    }

    const safeAssistantContent = redactIntegrationCredentials(result.content);
    const [assistantMsg] = await db
      .insert(integrationChatMessagesTable)
      .values({ conversationId, role: "assistant", content: safeAssistantContent })
      .returning();

    await db
      .update(integrationChatConversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(integrationChatConversationsTable.id, conversationId));

    await db
      .update(workspacesTable)
      .set({ creditsBalance: Math.max(0, ws.creditsBalance - creditCost) })
      .where(eq(workspacesTable.id, workspaceId));

    await db.insert(auditLogsTable).values({
      workspaceId,
      action: "integration_chat.message",
      actor: "user",
      data: {
        conversationId,
        hasImages,
        tokensUsed: result.inputTokens + result.outputTokens,
        model: result.model,
      },
    });

    res.json({ userMessage: userMsg, assistantMessage: assistantMsg, creditsCharged: creditCost });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      res.status(504).json({ error: "A IA demorou demais para responder. Tente novamente.", code: "AI_TIMEOUT" });
      return;
    }
    throw err;
  }
});

// ── POST /api/integration-chat/:conversationId/end — end the guided conversation ──
router.post("/:conversationId/end", async (req, res): Promise<void> => {
  const { conversationId } = req.params;
  const workspaceId = req.auth.workspaceId;

  const [conversation] = await db
    .select()
    .from(integrationChatConversationsTable)
    .where(
      and(
        eq(integrationChatConversationsTable.id, conversationId),
        eq(integrationChatConversationsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!conversation) {
    res.status(404).json({ error: "Conversa não encontrada", code: "NOT_FOUND" });
    return;
  }

  const [updated] = await db
    .update(integrationChatConversationsTable)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(integrationChatConversationsTable.id, conversationId))
    .returning();

  res.json({ conversation: updated });
});

export default router;
