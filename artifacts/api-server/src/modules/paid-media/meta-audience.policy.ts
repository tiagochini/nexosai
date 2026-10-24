import { createHash } from "node:crypto";
import { z } from "zod/v4";
import { metaId } from "./meta-assets.policy.js";
import { AppError } from "../../lib/errors.js";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const member = z
  .object({
    email: z.union([z.email(), z.literal("")]).optional(),
    phone: z
      .union([z.string().regex(/^\+[1-9]\d{7,14}$/), z.literal("")])
      .optional(),
    marketingConsent: z.literal(true),
    consentedAt: z.iso.datetime(),
    consentReference: z.string().trim().min(1).max(300),
  })
  .strict()
  .refine(
    (value) => value.email || value.phone,
    "Informe e-mail ou telefone com código do país.",
  )
  .refine(
    (value) => Date.parse(value.consentedAt) <= Date.now(),
    "O consentimento não pode estar no futuro.",
  );
const common = {
  accountId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(150),
  dataRightsConfirmed: z.literal(true),
};
export const audienceRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...common,
      kind: z.literal("website"),
      pixelId: metaId,
      retentionDays: z.number().int().min(1).max(180),
      event: z.enum([
        "PageView",
        "Lead",
        "CompleteRegistration",
        "Purchase",
        "AddToCart",
        "InitiateCheckout",
      ]),
      urlContains: z.string().trim().min(1).max(500).optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal("lookalike"),
      originAudienceId: metaId,
      country: z.string().regex(/^[A-Z]{2}$/),
      ratio: z.number().min(0.01).max(0.2),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal("crm"),
      members: z.array(member).min(1).max(1000),
    })
    .strict(),
]);
export type AudienceRequest = z.infer<typeof audienceRequestSchema>;
export function compileAudienceRequest(input: unknown) {
  const parsed = audienceRequestSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      422,
      "Revise a configuração do público, os direitos sobre os dados e os consentimentos individuais.",
      "AUDIENCE_REQUEST_INVALID",
    );
  const form = parsed.data;
  let payload: Record<string, unknown>,
    members: string[][] = [];
  if (form.kind === "website") {
    payload = {
      name: form.name,
      subtype: "WEBSITE",
      rule: JSON.stringify({
        inclusions: {
          operator: "or",
          rules: [
            {
              event_sources: [{ id: form.pixelId, type: "pixel" }],
              retention_seconds: form.retentionDays * 86400,
              filter: {
                operator: "and",
                filters: [
                  { field: "event", operator: "eq", value: form.event },
                  ...(form.urlContains
                    ? [
                        {
                          field: "url",
                          operator: "i_contains",
                          value: form.urlContains,
                        },
                      ]
                    : []),
                ],
              },
            },
          ],
        },
      }),
    };
  } else if (form.kind === "lookalike") {
    payload = {
      name: form.name,
      subtype: "LOOKALIKE",
      origin_audience_id: form.originAudienceId,
      lookalike_spec: JSON.stringify({
        country: form.country,
        ratio: form.ratio,
        type: "similarity",
      }),
    };
  } else {
    members = [
      ...new Map(
        form.members.map((row) => {
          const data = [
            row.email ? hash(row.email.trim().toLowerCase()) : "",
            row.phone ? hash(row.phone.replace(/\D/g, "")) : "",
          ];
          return [JSON.stringify(data), data] as const;
        }),
      ).values(),
    ];
    payload = {
      name: form.name,
      subtype: "CUSTOM",
      customer_file_source: "USER_PROVIDED_ONLY",
    };
  }
  // Only hashes and consent evidence are encrypted. Raw CRM identifiers never reach storage.
  const consent =
    form.kind === "crm"
      ? form.members.map((row) => ({
          consentedAt: row.consentedAt,
          referenceHash: hash(row.consentReference),
        }))
      : [];
  const request = {
    kind: form.kind,
    payload,
    members,
    consent,
    ...(form.kind === "website" ? { pixelId: form.pixelId } : {}),
    ...(form.kind === "lookalike"
      ? { originAudienceId: form.originAudienceId }
      : {}),
  };
  return {
    form,
    request,
    summary: {
      kind: form.kind,
      name: form.name,
      members: members.length,
      dataRightsConfirmed: true,
      ...(form.kind === "website"
        ? {
            pixelId: form.pixelId,
            event: form.event,
            retentionDays: form.retentionDays,
            urlContains: form.urlContains ?? null,
          }
        : {}),
      ...(form.kind === "lookalike"
        ? {
            originAudienceId: form.originAudienceId,
            country: form.country,
            ratio: form.ratio,
          }
        : {}),
    },
  };
}
export function assertAudienceReadback(
  row: Record<string, any>,
  account: string,
  payload: Record<string, any>,
  id: string,
) {
  if (
    String(row.id) !== id ||
    String(row.account_id).replace(/^act_/, "") !==
      account.replace(/^act_/, "") ||
    row.name !== payload.name ||
    row.subtype !== payload.subtype
  )
    throw new AppError(
      502,
      "O público retornado não corresponde à aprovação/conta.",
      "AUDIENCE_READBACK_INVALID",
    );
  if (payload.description && row.description !== payload.description)
    throw new AppError(
      502,
      "O público não tem o marcador desta operação.",
      "AUDIENCE_READBACK_INVALID",
    );
  if (payload.lookalike_spec) {
    const spec = JSON.parse(payload.lookalike_spec);
    // Meta may expose seed_audience as an integer larger than JS can represent.
    // In that case use an explicit string ID in the returned origin objects;
    // never compare a rounded integer or declare the source verified by name.
    const seed =
      typeof row.seed_audience === "string" ||
      Number.isSafeInteger(row.seed_audience)
        ? String(row.seed_audience)
        : undefined;
    const origins = Array.isArray(row.lookalike_spec?.origin)
      ? row.lookalike_spec.origin
      : [];
    const originVerified =
      seed !== undefined
        ? seed === payload.origin_audience_id
        : origins.some(
            (origin: any) =>
              typeof origin?.id === "string" &&
              origin.id === payload.origin_audience_id,
          );
    if (
      row.lookalike_spec?.country !== spec.country ||
      Number(row.lookalike_spec?.ratio) !== spec.ratio ||
      !originVerified
    )
      throw new AppError(
        502,
        "O Lookalike retornado difere do aprovado.",
        "AUDIENCE_READBACK_INVALID",
      );
  }
  if (payload.rule) {
    const canonical = (value: any): string =>
      value && typeof value === "object"
        ? Array.isArray(value)
          ? `[${value.map(canonical).join(",")}]`
          : `{${Object.keys(value)
              .sort()
              .map((key) => `${key}:${canonical(value[key])}`)
              .join(",")}}`
        : JSON.stringify(value);
    try {
      if (
        canonical(JSON.parse(row.rule)) !== canonical(JSON.parse(payload.rule))
      )
        throw new Error();
    } catch {
      throw new AppError(
        502,
        "A regra do público retornado difere da aprovada.",
        "AUDIENCE_READBACK_INVALID",
      );
    }
  }
  if (
    payload.customer_file_source &&
    row.customer_file_source !== payload.customer_file_source
  )
    throw new AppError(
      502,
      "A origem dos dados do público difere da aprovada.",
      "AUDIENCE_READBACK_INVALID",
    );
}
