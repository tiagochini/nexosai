import {
  db,
  defaultAllowedSocialNetworks,
  defaultMaxAccountsPerNetwork,
  plansTable,
} from "./index.js";
import { sql } from "drizzle-orm";

// ── Modelo de negócio NexOS AI ────────────────────────────────────────────────
//
// NÃO É ASSINATURA MENSAL. É ACESSO ÚNICO (lifetime deal).
//
// Solo — R$3.990 (preço de lançamento) / R$5.000 (regular)
//   Inclui: acesso vitalício à plataforma + 900 créditos (= 2 lançamentos completos)
//   A partir do 3º lançamento: cliente compra packs de créditos
//   Até 3 campanhas simultâneas, track 6 dígitos, 5 vídeos/campanha
//
// Agency — R$9.990 (preço de lançamento) / R$14.000 (regular)
//   Inclui: acesso vitalício + 2.000 créditos (= ~4-5 lançamentos)
//   Multi-cliente, white-label, todos os tracks, 10 campanhas
//   A partir do 5º lançamento: packs de créditos
//
// PACKS (ofertados pós-lançamento, quando o cliente já viu resultado):
//   500 cr  → R$85   (~1 lançamento)
//   1500 cr → R$239  (~3 lançamentos) ← mais vendido
//   3500 cr → R$529  (~8 lançamentos)
//   7000 cr → R$979  (~16 lançamentos)
//
// Margem bruta nos packs: ~81%
// (custo real de IA por campanha ~R$14, receita do pack por campanha ~R$71)
//
// CAMPO priceMonthly = preço de acesso único em reais (sem centavos decimais extras)
// CAMPO creditsMonthly = créditos incluídos no acesso (não são mensais)
// CAMPO priceOnboarding = não usado neste modelo (zerado)

const plans = [
  {
    name: "Solo",
    slug: "solo" as const,
    priceMonthly: "3990.00",       // preço de acesso único (lançamento)
    priceOnboarding: "0.00",       // sem taxa separada de onboarding
    creditsMonthly: 900,           // 900 cr incluídos = 2 lançamentos completos
    maxCampaigns: 3,
    maxVideosPerCampaign: 5,
    maxDomains: 1,
    maxWorkspaces: 1,
    allowedSocialNetworks: defaultAllowedSocialNetworks,
    maxAccountsPerNetwork: defaultMaxAccountsPerNetwork,
    whiteLabel: false,
    multiNurturingChannels: false,
    features: [
      "Acesso vitalício à plataforma",
      "900 créditos incluídos (2 lançamentos completos)",
      "Até 3 campanhas simultâneas",
      "Track de 6 dígitos (R$100k–R$999k em 7 dias)",
      "1 domínio customizado",
      "Nurturing via WhatsApp OU Telegram",
      "16 agentes de IA especializados",
      "Sequência de lançamento PLF automatizada",
      "Landing page gerada por IA",
      "Até 5 vídeos por campanha",
      "Relatório semanal de performance",
    ],
  },
  {
    name: "Agency",
    slug: "agency" as const,
    priceMonthly: "9990.00",       // preço de acesso único (lançamento)
    priceOnboarding: "0.00",
    creditsMonthly: 2000,          // 2000 cr incluídos = ~4-5 lançamentos
    maxCampaigns: 10,
    maxVideosPerCampaign: 5,
    maxDomains: 10,
    maxWorkspaces: 1,
    allowedSocialNetworks: defaultAllowedSocialNetworks,
    maxAccountsPerNetwork: defaultMaxAccountsPerNetwork,
    whiteLabel: true,
    multiNurturingChannels: true,
    features: [
      "Acesso vitalício à plataforma",
      "2.000 créditos incluídos (~4-5 lançamentos completos)",
      "Até 10 campanhas simultâneas",
      "Todos os tracks (6, 8 e 10 dígitos)",
      "10 domínios customizados",
      "Nurturing via WhatsApp E Telegram (multicanal)",
      "White-label 'Desenvolvido com NexOS'",
      "Dashboard multi-cliente",
      "Todos os módulos de IA incluindo Creator Engine",
      "Até 5 vídeos por campanha",
      "Suporte prioritário",
    ],
  },
];

async function seed() {
  console.log("Seeding plans (modelo acesso único)...");
  for (const plan of plans) {
    await db
      .insert(plansTable)
      .values(plan)
      .onConflictDoUpdate({
        target: plansTable.slug,
        set: {
          name: sql`excluded.name`,
          priceMonthly: sql`excluded.price_monthly`,
          priceOnboarding: sql`excluded.price_onboarding`,
          creditsMonthly: sql`excluded.credits_monthly`,
          maxCampaigns: sql`excluded.max_campaigns`,
          maxVideosPerCampaign: sql`excluded.max_videos_per_campaign`,
          maxDomains: sql`excluded.max_domains`,
          maxWorkspaces: sql`excluded.max_workspaces`,
          allowedSocialNetworks: sql`excluded.allowed_social_networks`,
          maxAccountsPerNetwork: sql`excluded.max_accounts_per_network`,
          features: sql`excluded.features`,
          whiteLabel: sql`excluded.white_label`,
          multiNurturingChannels: sql`excluded.multi_nurturing_channels`,
        },
      });
    console.log(`  ✓ Plan '${plan.name}' — R$${plan.priceMonthly} acesso único, ${plan.creditsMonthly} cr incluídos`);
  }
  console.log("Plans seeded successfully.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
