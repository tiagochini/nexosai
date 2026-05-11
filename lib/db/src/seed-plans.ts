import { db, plansTable } from "./index.js";
import { sql } from "drizzle-orm";

// ── Credit forcing logic ───────────────────────────────────────────────────────
// Typical launch campaign = 420 credits.
// Plan credits are calibrated to cover exactly 2 typical launches, so the
// 3rd campaign (which is within the plan's campaign limit) always requires
// a credit pack purchase. This is the core upsell forcing mechanism.
//
// Solo  (3 campaigns): 900 cr → 900/420 = 2.1 launches included
//   → campaign 3 = mandatory pack purchase
//   → heavy user (630 cr/launch): campaign 2 already needs a pack
//
// Agency (10 campaigns): 2000 cr → 2000/420 = 4.8 launches included
//   → campaigns 5-10 = mandatory pack purchases (up to 6 pack purchases/mo)
//   → heavy user (630 cr/launch): campaigns 4-10 all need packs
//
// Packs are presented POST-ONBOARDING after the client sees their first results.
// Onboarding allocation: 900 cr (Solo) / 2000 cr (Agency) — sufficient for
// the client to complete 2 full launches before hitting the wall.

const plans = [
  {
    name: "Solo",
    slug: "solo" as const,
    priceMonthly: "297.00",
    priceOnboarding: "2500.00",
    creditsMonthly: 900,
    maxCampaigns: 3,
    maxVideosPerCampaign: 5,
    maxDomains: 1,
    whiteLabel: false,
    multiNurturingChannels: false,
    features: [
      "Até 3 campanhas simultâneas",
      "Track de 6 dígitos",
      "1 domínio customizado",
      "Nurturing via WhatsApp OU Telegram",
      "Geração de conteúdo com IA (16 agentes)",
      "Sequência de lançamento PLF automatizada",
      "Landing page gerada por IA",
      "Análise de campanhas com IA",
      "900 créditos mensais (~2 lançamentos completos)",
      "Até 5 vídeos por campanha",
    ],
  },
  {
    name: "Agency",
    slug: "agency" as const,
    priceMonthly: "1497.00",
    priceOnboarding: "2500.00",
    creditsMonthly: 2000,
    maxCampaigns: 10,
    maxVideosPerCampaign: 5,
    maxDomains: 10,
    whiteLabel: true,
    multiNurturingChannels: true,
    features: [
      "Até 10 campanhas simultâneas",
      "Todos os tracks (6, 8 e 10 dígitos)",
      "10 domínios customizados",
      "Nurturing via WhatsApp E Telegram (multicanal)",
      "White-label 'Desenvolvido com NexOS'",
      "Dashboard multi-cliente",
      "Todos os módulos de IA incluindo Creator Engine",
      "2.000 créditos mensais (~4-5 lançamentos completos)",
      "Até 5 vídeos por campanha",
      "Suporte prioritário",
    ],
  },
];

async function seed() {
  console.log("Seeding plans...");
  for (const plan of plans) {
    await db
      .insert(plansTable)
      .values(plan)
      .onConflictDoUpdate({
        target: plansTable.slug,
        set: {
          name: sql`excluded.name`,
          priceMonthly: sql`excluded.price_monthly`,
          creditsMonthly: sql`excluded.credits_monthly`,
          maxCampaigns: sql`excluded.max_campaigns`,
          features: sql`excluded.features`,
          whiteLabel: sql`excluded.white_label`,
          multiNurturingChannels: sql`excluded.multi_nurturing_channels`,
        },
      });
    console.log(`  ✓ Plan '${plan.name}' seeded (${plan.creditsMonthly} cr/mo)`);
  }
  console.log("Plans seeded successfully.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
