/**
 * Diagnóstico E2E — NexOS AI (rotas corretas v2)
 * intake → market_validation (STEP 0) → estratégia → conteúdo → aprovação
 */

const BASE = "http://localhost:80/api";
const EMAIL = "step0probe@nexos.dev";
const PASS  = "Probe1234!";

type R = { status: number; data: unknown };
type Obj = Record<string, unknown>;

const log  = (t: string, m: string) => console.log(`[${t}] ${m}`);
const ok   = (t: string, m: string) => console.log(`✅ [${t}] ${m}`);
const fail = (t: string, m: string, c: "BUG"|"DEP") => console.log(`❌ [${t}] (${c}) ${m}`);
const warn = (t: string, m: string) => console.log(`⚠️  [${t}] ${m}`);
const j    = (v: unknown, n = 200) => JSON.stringify(v ?? "").substring(0, n);

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

async function poll(
  fn: () => Promise<R>, check: (d: unknown) => boolean,
  label: string, timeoutMs = 600_000, intervalMs = 12_000,
): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await fn();
    if (check(data)) return data;
    const s = (data as Obj)?.campaign ? (((data as Obj).campaign) as Obj).status : (data as Obj)?.status ?? "…";
    log("POLL", `${label} — status atual: ${s}`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

interface StepResult { step: string; c1: string; c2: string; cls?: "BUG"|"DEP" }
const results: StepResult[] = [];
const push = (step: string, c1: string, c2: string, cls?: "BUG"|"DEP") => results.push({ step, c1, c2, cls });

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(" DIAGNÓSTICO E2E — NexOS AI — " + new Date().toISOString());
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── ETAPA 0: AUTH ─────────────────────────────────────────────────────────
  log("AUTH", "Login …");
  const authRes = await api("POST", "/auth/login", undefined, { email: EMAIL, password: PASS });
  if (authRes.status !== 200 || !(authRes.data as Obj).accessToken) {
    fail("AUTH", `${authRes.status}: ${j(authRes.data)}`, "BUG"); return;
  }
  const token = (authRes.data as Obj).accessToken as string;
  ok("AUTH", "Login 200 — token OK");
  push("AUTH", "✅ 200 — token obtido", "N/A");

  // ── ETAPA 1: CRIAR CAMPANHA ───────────────────────────────────────────────
  log("CAMPAIGN", "Criando campanha …");
  const campRes = await api("POST", "/campaigns", token, { title: "DIAG-E2E-FULL", type: "launch", track: "six_digits" });
  if (campRes.status > 201) {
    fail("CAMPAIGN", `${campRes.status}: ${j(campRes.data)}`, "BUG"); return;
  }
  const camp0 = ((campRes.data as Obj).campaign as Obj);
  const cid   = camp0.id as string;
  ok("CAMPAIGN", `Criada: ${cid} — status: ${camp0.status}`);
  push("CRIAR CAMPANHA", `✅ 201 — id: ${cid}`, `status: ${camp0.status}`);

  // ── ETAPA 2: INTAKE ───────────────────────────────────────────────────────
  log("INTAKE", "Salvando dados de intake …");
  // Correct route: POST /api/intake/:campaignId
  const saveRes = await api("POST", `/intake/${cid}`, token, {
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
    guarantee: "30 dias incondicional + suporte de implementação",
    bonuses: ["Auditoria de conta grátis", "Templates prontos", "Comunidade VIP 1 ano"],
    launchStartDate: "2026-08-15",
    contactListSize: 8500,
    existingSocialFollowers: 12000,
  });
  log("INTAKE", `save: ${saveRes.status} — ${j(saveRes.data)}`);

  if (saveRes.status === 404) {
    warn("INTAKE", "POST /intake/:id retornou 404 — tentando POST /intake/:id/save …");
    const altSave = await api("POST", `/intake/${cid}/save`, token, { productName: "Tráfego Máximo" });
    log("INTAKE", `alt-save: ${altSave.status}`);
  }

  // Finalize intake → moves to "analyzing"
  const finalizeRes = await api("POST", `/intake/${cid}/finalize`, token, {});
  log("INTAKE", `finalize: ${finalizeRes.status} — ${j(finalizeRes.data)}`);
  const postFinalize = ((finalizeRes.data as Obj)?.campaign as Obj) ?? {};
  const statusAfterFinalize = postFinalize.status ?? "unknown";

  // Check intake completeness
  const campCheck = await api("GET", `/campaigns/${cid}`, token);
  const campNow   = ((campCheck.data as Obj)?.campaign as Obj) ?? {};
  const completeness = (campNow.brain_data as Obj)?.intakeCompleteness ?? campNow.intakeCompleteness;
  const intakeData   = campNow.intake_data as Obj;
  const filledFields = intakeData ? Object.keys(intakeData).length : 0;

  log("INTAKE", `status: ${campNow.status} | intake_data fields: ${filledFields} | completeness: ${j(completeness)}`);
  push("INTAKE save",     `POST /intake/${cid}: ${saveRes.status}`, j(saveRes.data), saveRes.status === 404 ? "BUG" : undefined);
  push("INTAKE finalize", `POST /intake/${cid}/finalize: ${finalizeRes.status} | status→${statusAfterFinalize}`, `intake_data fields: ${filledFields}`);

  if (finalizeRes.status !== 200) {
    fail("INTAKE", `finalize falhou: ${finalizeRes.status}`, "BUG"); return;
  }

  // ── ETAPA 3: EXECUTE/STRATEGY → MARKET VALIDATION (STEP 0) ───────────────
  log("STRATEGY", "Disparando execute/strategy …");
  // Must be in 'analyzing' state first (finalize already put it there)
  // If not, patch status
  if (campNow.status !== "analyzing") {
    const patch = await api("PATCH", `/campaigns/${cid}/status`, token, { status: "analyzing" });
    log("STRATEGY", `Patch to analyzing: ${patch.status}`);
  }

  const execRes = await api("POST", `/campaigns/${cid}/execute/strategy`, token, {});
  log("STRATEGY", `execute/strategy: ${execRes.status} — ${j(execRes.data)}`);

  if (execRes.status !== 202 && execRes.status !== 200) {
    fail("STRATEGY", `execute/strategy retornou ${execRes.status}: ${j(execRes.data)}`, "BUG");
    push("EXECUTE/STRATEGY", `❌ ${execRes.status}: ${j(execRes.data)}`, "Pipeline não iniciou", "BUG");
  } else {
    ok("STRATEGY", `${execRes.status} — pipeline rodando …`);
    push("EXECUTE/STRATEGY", `✅ ${execRes.status} aceito`, "Pipeline iniciado — aguardando …");

    // Poll for strategy_ready OR market_validation halt (stays analyzing)
    const polled = await poll(
      () => api("GET", `/campaigns/${cid}`, token),
      (d) => {
        const s = ((d as Obj)?.campaign as Obj)?.status as string;
        return s === "strategy_ready" || s === "cancelled";
        // Note: INVIAVEL keeps it in "analyzing" — we detect by brain_data
      },
      "strategy_ready",
      360_000,
      12_000,
    ) as Obj | null;

    // Also check for market_validation halt (INVIAVEL)
    const finalCampRes = await api("GET", `/campaigns/${cid}`, token);
    const finalCamp = (finalCampRes.data as Obj)?.campaign as Obj;
    const stratStatus = finalCamp?.status as string;
    const brainData   = finalCamp?.brain_data as Obj;
    const mv          = brainData?.marketValidation as Obj | undefined;
    const mvVerdict   = mv?.overallVerdict as string | undefined;
    const stratData   = finalCamp?.strategy_data as Obj | undefined;

    log("STRATEGY", `Status: ${stratStatus} | MV: ${mvVerdict ?? "não rodou"} | stratData: ${stratData ? "presente" : "ausente"}`);

    // Market Validation report
    if (mv) {
      const mvValidators = (mv.validators as Obj[]) ?? [];
      ok("MV", `Market Validation executou — verdict: ${mvVerdict}`);
      push("MARKET VALIDATION (STEP 0)",
        `✅ Rodou | verdict: ${mvVerdict} | validators: ${mvValidators.length}`,
        mvValidators.map(v => `${v.validator}:${v.verdict}(score:${v.score})`).join(" | "));
    } else {
      warn("MV", "Market Validation NÃO está em brain_data — STEP 0 não rodou ou dados perdidos");
      push("MARKET VALIDATION (STEP 0)", `⚠️  Não encontrado em brain_data`, "brain_data.marketValidation ausente", "BUG");
    }

    // Check agents that ran
    const agentRes = await api("GET", `/campaigns/${cid}/agents`, token);
    const agents   = ((agentRes.data as Obj)?.agents as Obj[]) ?? [];
    const agentStr = agents.map(a => `${a.agentType}:${a.status}`).join(" | ");
    log("AGENTS", `Agentes (${agents.length}): ${agentStr.substring(0, 300)}`);
    push("AGENTS QUE RODARAM", `${agents.length} agentes`, agentStr.substring(0, 400));

    if (stratStatus === "strategy_ready") {
      ok("STRATEGY", `strategy_ready alcançado!`);
      const stratKeys = stratData ? Object.keys(stratData) : [];
      push("STRATEGY DATA",
        `✅ strategy_ready — strategy_data presente`,
        `Keys: [${stratKeys.join(", ")}] | ${JSON.stringify(stratData).length} chars total`);

      // ── ETAPA 4: EXECUTE/CONTENT ─────────────────────────────────────────
      log("CONTENT", "Disparando execute/content …");
      const contentExecRes = await api("POST", `/campaigns/${cid}/execute/content`, token, {});
      log("CONTENT", `execute/content: ${contentExecRes.status} — ${j(contentExecRes.data)}`);

      if (contentExecRes.status !== 202 && contentExecRes.status !== 200) {
        fail("CONTENT", `${contentExecRes.status}: ${j(contentExecRes.data)}`, "BUG");
        push("EXECUTE/CONTENT", `❌ ${contentExecRes.status}`, j(contentExecRes.data), "BUG");
      } else {
        push("EXECUTE/CONTENT", `✅ ${contentExecRes.status} aceito`, "Gerando conteúdo …");
        ok("CONTENT", "Pipeline de conteúdo rodando …");

        // Poll for awaiting_approval
        await poll(
          () => api("GET", `/campaigns/${cid}`, token),
          (d) => {
            const s = ((d as Obj)?.campaign as Obj)?.status as string;
            return s === "awaiting_approval" || s === "approved";
          },
          "awaiting_approval",
          600_000, 15_000,
        );

        const postContentRes = await api("GET", `/campaigns/${cid}`, token);
        const postCamp = (postContentRes.data as Obj)?.campaign as Obj;
        const contentStatus = postCamp?.status as string;
        log("CONTENT", `Status pós-geração: ${contentStatus}`);

        // Fetch content pieces
        const piecesRes = await api("GET", `/campaigns/${cid}/content`, token);
        const pieces    = ((piecesRes.data as Obj)?.pieces as Obj[]) ?? [];
        log("CONTENT", `Total de peças: ${pieces.length}`);

        for (const p of pieces) {
          const body    = p.content as unknown;
          const chars   = JSON.stringify(body ?? "").length;
          const preview = JSON.stringify(body ?? "").substring(0, 120);
          log("PIECE", `[${p.contentType}] status:${p.status} | ${chars}chars | ${preview}`);
        }

        push("CONTENT GENERATION STATUS", `status: ${contentStatus} | ${pieces.length} peças geradas`,
          pieces.map(p => `${p.contentType}:${p.status}(${JSON.stringify(p.content ?? "").length}c)`).join(" | "));

        // ── VERIFICAÇÃO ENTREGÁVEIS ─────────────────────────────────────────

        // E1: Copy/textos — todos os content_type gerados
        const copyTypes = ["vsl_script", "ad_copy", "email_sequence", "whatsapp_sequence", "content_calendar", "webinar_script", "targeting_config", "media_buying_plan"];
        for (const ct of copyTypes) {
          const p = pieces.find(x => x.contentType === ct);
          if (!p) {
            push(`ENTREGÁVEL: ${ct}`, `❌ peça ausente`, "não foi gerada", "BUG");
            continue;
          }
          const body     = p.content as Obj;
          const chars    = JSON.stringify(body ?? "").length;
          const isEmpty  = !body || chars < 100;
          
          // Type-specific inspection
          let detail = `${chars} chars`;
          if (ct === "content_calendar") {
            const posts = (body?.posts as unknown[]) ?? (body?.calendar as unknown[]) ?? (body?.content as unknown[]) ?? [];
            detail += ` | ${posts.length} posts — primeiro: ${j(posts[0])}`;
          } else if (ct === "ad_copy") {
            const ads = (body?.ads as unknown[]) ?? (body?.copies as unknown[]) ?? (body?.headlines as unknown[]) ?? [];
            detail += ` | ${ads.length} copies — primeiro: ${j(ads[0])}`;
          } else if (ct === "targeting_config") {
            const aud = (body?.audiences as unknown[]) ?? (body?.targeting as unknown[]) ?? [];
            detail += ` | ${aud.length} audiências — primeira: ${j(aud[0])}`;
          } else if (ct === "media_buying_plan") {
            const budget = body?.totalBudget ?? body?.total_budget ?? body?.budget;
            detail += ` | budget: ${budget} — preview: ${j(body)}`;
          } else {
            detail += ` | preview: ${JSON.stringify(body).substring(0, 120)}`;
          }

          push(`ENTREGÁVEL: ${ct}`,
            isEmpty ? `⚠️  ${p.status} mas conteúdo vazio/mínimo` : `✅ ${p.status}`,
            detail, isEmpty ? "BUG" : undefined);
        }

        // E2: Aprovar tudo (necessário para avançar)
        if (contentStatus === "awaiting_approval") {
          log("APPROVAL", "Aprovando todas as peças …");
          let approvedCount = 0, failedCount = 0;
          for (const p of pieces) {
            if (p.status === "pending_approval" || p.status === "draft") {
              const r = await api("POST", `/campaigns/${cid}/content/${p.id}/approve`, token, {});
              if (r.status === 200 || r.status === 201) approvedCount++;
              else failedCount++;
            }
          }
          // Also try patch status
          const patchApp = await api("PATCH", `/campaigns/${cid}/status`, token, { status: "approved" });
          log("APPROVAL", `Aprovadas: ${approvedCount} | falhas: ${failedCount} | PATCH status: ${patchApp.status}`);
          push("APROVAÇÃO", `✅ ${approvedCount} peças aprovadas | ${failedCount} falhas | PATCH: ${patchApp.status}`, "");
        }

        // E3: Launch Sequences
        const seqRes  = await api("GET", `/launch-sequences?campaignId=${cid}`, token);
        const seqs    = ((seqRes.data as Obj)?.sequences as Obj[]) ?? [];
        push("ENTREGÁVEL: Launch Sequences",
          `${seqRes.status} — ${seqs.length} sequências`,
          seqs.length > 0
            ? seqs.map(s => `"${s.name}"(${(s.items as unknown[] ?? []).length} items, ${s.status})`).join(" | ")
            : "❌ nenhuma sequência criada", seqs.length === 0 ? "BUG" : undefined);

        // E4: Creatives (DALL-E — opt-in, não é bug se vazio)
        const crRes  = await api("GET", `/campaigns/${cid}/creatives`, token);
        const crList = ((crRes.data as Obj)?.creatives as Obj[]) ?? [];
        push("ENTREGÁVEL: Creatives/Imagens",
          `${crRes.status} — ${crList.length} criativos`,
          crList.length > 0
            ? crList.map(c => `status:${c.status} | ${j(c.concept, 60)}`).join(" | ")
            : "✅ Vazio = esperado (DALL-E é opt-in por peça — requer trigger manual)");

        // E5: VSL
        const vslRes = await api("GET", `/vsls?campaignId=${cid}`, token);
        push("ENTREGÁVEL: VSL",
          `GET /vsls: ${vslRes.status}`,
          j(vslRes.data, 300), vslRes.status !== 200 ? "BUG" : undefined);

        // E6: Market Intel
        const miRes = await api("GET", `/market-intel?campaignId=${cid}`, token);
        const miData = miRes.data as Obj;
        const miList = (miData?.reports ?? miData?.data ?? miData) as Obj[] | Obj;
        push("ENTREGÁVEL: Market Intel",
          `GET /market-intel: ${miRes.status}`,
          j(miList, 300), miRes.status !== 200 ? "BUG" : undefined);

        // E7: Video Production Projects
        const vidRes = await api("GET", `/campaigns/${cid}/video-production/projects`, token);
        push("ENTREGÁVEL: Video Projects",
          `${vidRes.status}`,
          j(vidRes.data, 200));

        // E8: Landing Page (check if any content piece is landing page)
        const lpPiece = pieces.find(p => (p.contentType as string)?.includes("landing") || (p.contentType as string)?.includes("page"));
        push("ENTREGÁVEL: Landing Page",
          lpPiece ? `✅ peça encontrada: ${lpPiece.contentType}` : `⚠️  nenhuma peça do tipo landing_page`,
          lpPiece ? j(lpPiece.content) : "Landing page não é gerada como content_piece — é um artefato separado da plataforma");

      }
    } else if (mvVerdict === "INVIAVEL") {
      warn("STRATEGY", `Pipeline pausado por INVIAVEL — correto por design`);
      push("STRATEGY (pausado)", `⚠️  Pausado — mv verdict: INVIAVEL`, "Design correto: INVIAVEL bloqueia geração de estratégia", "DEP");
    } else {
      fail("STRATEGY", `Status: ${stratStatus} — não alcançou strategy_ready`, "BUG");
      push("STRATEGY", `❌ ${stratStatus} — timeout ou erro`, j(brainData, 200), "BUG");
    }
  }

  // ── RELATÓRIO FINAL ────────────────────────────────────────────────────────
  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" RELATÓRIO FINAL");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Campanha: ${cid}  |  ${new Date().toISOString()}\n`);

  let clean = 0, bug = 0, dep = 0;
  for (const r of results) {
    const icon = r.cls === "BUG" ? "❌" : r.cls === "DEP" ? "⚠️ " : "✅";
    console.log(`${icon} ${r.step}`);
    console.log(`   C1: ${r.c1}`);
    if (r.c2) console.log(`   C2: ${r.c2}`);
    if (r.cls === "BUG") bug++;
    else if (r.cls === "DEP") dep++;
    else clean++;
    console.log();
  }
  console.log("───────────────────────────────────────────────────────────");
  console.log(`ETAPAS LIMPAS (sem bug/dep):  ${clean}`);
  console.log(`FALHAS POR BUG (a):           ${bug}`);
  console.log(`FALHAS POR DEP (b):           ${dep}`);
  console.log(`TOTAL VERIFICADO:             ${results.length}`);
  console.log("───────────────────────────────────────────────────────────\n");
}

main().catch(e => { console.error("ERRO FATAL:", e); process.exit(1); });
