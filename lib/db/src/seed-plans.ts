import { db, plansTable } from "./index.js";
import { sql } from "drizzle-orm";

// ── Credit calibration (updated to match actual AI costs) ────────────────────
// Full lifecycle per campaign: strategy(45) + content(145-161) + sequence(37)
//   + monitoring/WhatsApp (75-190 depending on volume)
// Typical launch campaign: ~420 credits
// Light campaign (no traffic): ~290 credits
//
// Solo (3 campaigns): 3 × 420 = 1260 typical → 2000 gives ~37% buffer
// Agency (10 campaigns): 10 × 420 = 4200 typical → 6500 gives ~55% buffer

const plans = [
  {
    name: "Solo",
    slug: "solo" as const,
    priceMonthly: "297.00",
    priceOnboarding: "2500.00",
    creditsMonthly: 2000,
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
      "2.000 créditos mensais (~4-5 campanhas completas)",
      "Até 5 vídeos por campanha",
    ],
  },
  {
    name: "Agency",
    slug: "agency" as const,
    priceMonthly: "1497.00",
    priceOnboarding: "2500.00",
    creditsMonthly: 6500,
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
      "6.500 créditos mensais (~14-15 campanhas completas)",
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
    console.log(`  ✓ Plan '${plan.name}' seeded`);
  }
  console.log("Plans seeded successfully.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
