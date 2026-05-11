import { db, waitlistTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { env } from "../../lib/env.js";

export interface SimulatorConfig {
  cartOpen: boolean;
  checkoutUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
}

export interface SaveLeadInput {
  firstName: string;
  productName: string;
  productType: string;
  email: string;
  whatsapp: string;
}

export async function getSimulatorConfig(): Promise<SimulatorConfig> {
  return {
    cartOpen: env.SIMULATOR_CART_OPEN,
    checkoutUrl: env.SIMULATOR_CHECKOUT_URL || null,
    whatsappUrl: env.SIMULATOR_WHATSAPP_URL || null,
    telegramUrl: env.SIMULATOR_TELEGRAM_URL || null,
  };
}

export async function saveSimulatorLead(input: SaveLeadInput): Promise<{ saved: boolean; duplicate: boolean }> {
  const phone = input.whatsapp.replace(/\D/g, "");

  const [existing] = await db
    .select({ id: waitlistTable.id })
    .from(waitlistTable)
    .where(eq(waitlistTable.whatsapp, phone))
    .limit(1);

  if (existing) {
    return { saved: true, duplicate: true };
  }

  await db.insert(waitlistTable).values({
    name: `${input.firstName} — ${input.productName}`,
    whatsapp: phone,
    email: input.email || null,
    segment: "individual",
    source: `simulator:${input.productType}`,
  });

  return { saved: true, duplicate: false };
}
