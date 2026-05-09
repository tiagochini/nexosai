import { db, plansTable } from "./index.js";
import { sql } from "drizzle-orm";

const plans = [
  {
    name: "Solo",
    slug: "solo" as const,
    priceMonthly: "297.00",
    priceOnboarding: "2500.00",
    creditsMonthly: 1500,
    maxCampaigns: 3,
    maxVideosPerCampaign: 5,
    maxDomains: 1,
    whiteLabel: false,
    multiNurturingChannels: false,
    features: [
      "Up to 3 simultaneous campaigns",
      "6-digit launch track",
      "1 custom domain",
      "WhatsApp OR Telegram nurturing",
      "AI content generation",
      "Landing page builder",
      "Campaign analytics",
      "1,500 monthly credits",
      "Up to 5 videos per campaign",
    ],
  },
  {
    name: "Agency",
    slug: "agency" as const,
    priceMonthly: "1497.00",
    priceOnboarding: "2500.00",
    creditsMonthly: 5000,
    maxCampaigns: 10,
    maxVideosPerCampaign: 5,
    maxDomains: 10,
    whiteLabel: true,
    multiNurturingChannels: true,
    features: [
      "Up to 10 simultaneous campaigns",
      "All launch tracks (6/8/10-digit)",
      "10 custom domains",
      "WhatsApp AND Telegram nurturing",
      "White-label 'Powered by NexOS'",
      "Multi-client dashboard",
      "All AI modules including Creator Engine",
      "5,000 monthly credits",
      "Up to 5 videos per campaign",
      "Priority support",
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
