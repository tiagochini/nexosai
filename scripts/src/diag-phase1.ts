/**
 * FASE 1 do diagnóstico: intake → execute/strategy
 * Roda rápido (< 30s). Pipeline de AI continua em background.
 */
const BASE = "http://localhost:80/api";
const EMAIL = "step0probe@nexos.dev";
const PASS  = "Probe1234!";
// Campanha já existe — reusar para não bater no limite de 3
const CID   = "9c6c09aa-c271-4147-82c4-037419d61cf1";

type R   = { status: number; data: unknown };
type Obj = Record<string, unknown>;
const j  = (v: unknown, n = 300) => JSON.stringify(v ?? "").substring(0, n);

async function api(method: string, path: string, token?: string, body?: unknown): Promise<R> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function main() {
  // 1. Login
  const authRes = await api("POST", "/auth/login", undefined, { email: EMAIL, password: PASS });
  const token   = (authRes.data as Obj).accessToken as string;
  console.log(`AUTH: ${authRes.status} — token: ${token ? "OK" : "FALHOU"}`);

  // 2. Save intake — formato correto: { intakeData: {...} }
  const saveRes = await api("POST", `/intake/${CID}`, token, {
    intakeData: {
      productName: "Tráfego Máximo",
      productDescription: "Curso completo de tráfego pago (Meta Ads + Google Ads) para donos de ecommerce escalar de R$50k para R$500k/mês sem queimar budget",
      productType: "online_course",
      productPrice: 1997,
      targetAudience: "Donos de ecommerce com loja ativa faturando R$30k–R$100k/mês que já testaram tráfego mas não escalaram",
      audiencePain: "Gastam verba em anúncios sem ROI, não entendem dados, têm medo de escalar e perder mais",
      uniqueMechanism: "Método dos 3 Funis: Aquisição fria → Retargeting inteligente → LTV Máximo. Cada funil tem estrutura, criativos e KPIs pré-definidos",
      authorCredentials: "Gestor de tráfego 8 anos, gerenciou R$50M em verba, clientes ecommerces R$200k–R$3M/mês",
      launchModel: "plf",
      revenueTarget: 300000,
      launchWindowDays: 7,
      brandName: "Tráfego Máximo",
      niche: "marketing_digital",
      competitorDifferential: "Único método focado em ecommerce físico — concorrentes ensinam para infoprodutos",
      priceAnchor: 4997,
      guarantee: "30 dias incondicional",
      bonuses: ["Auditoria de conta grátis", "Templates prontos", "Comunidade VIP 1 ano"],
      launchStartDate: "2026-08-15",
      contactListSize: 8500,
      existingSocialFollowers: 12000,
    }
  });
  console.log(`INTAKE SAVE: ${saveRes.status} — ${j(saveRes.data)}`);

  // 3. Finalize intake → analyzing
  const finalRes = await api("POST", `/intake/${CID}/finalize`, token, {});
  const campStatus = ((finalRes.data as Obj)?.campaign as Obj)?.status;
  console.log(`FINALIZE: ${finalRes.status} — status→${campStatus}`);

  // 4. Check intake_data actually saved
  const checkRes  = await api("GET", `/campaigns/${CID}`, token);
  const campNow   = (checkRes.data as Obj)?.campaign as Obj;
  const fields    = Object.keys((campNow?.intake_data as Obj) ?? {}).length;
  console.log(`INTAKE CHECK: ${fields} campos salvos | status: ${campNow?.status}`);

  // 5. Execute strategy (triggers market_validation STEP 0 + strategy agents)
  const execRes = await api("POST", `/campaigns/${CID}/execute/strategy`, token, {});
  console.log(`EXECUTE/STRATEGY: ${execRes.status} — ${j(execRes.data)}`);

  console.log(`\n🚀 Pipeline rodando em background. CID=${CID}`);
  console.log("   Aguardar ~5–8 min e rodar diag-phase2.ts para verificar resultado.");
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
