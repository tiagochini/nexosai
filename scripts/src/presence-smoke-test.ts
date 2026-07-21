import { db, inviteCodesTable, usersTable, workspacesTable, socialPresenceConfigTable, socialPresencePostsTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";

const BASE = "http://localhost:80/api";
const TAG = `psmoke${Date.now().toString(36)}`;
const EMAIL = `${TAG}@teste.nexos.ai`;
const PASSWORD = "SenhaForte!123";
const CODE = `PS${TAG.slice(-6).toUpperCase()}`;

let token = "";
let failures = 0;

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* noop */ }
  return { status: res.status, json };
}

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log(`  PASS ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : "");
  }
}

async function main() {
  console.log("── Presence smoke test ──");

  // Setup: invite code + register + login
  await db.insert(inviteCodesTable).values({ code: CODE, planSlug: "solo", label: `[smoke] ${TAG}` } as never);
  const reg = await api("POST", "/auth/register", { name: "Presence Smoke", email: EMAIL, password: PASSWORD, inviteCode: CODE });
  check("register", reg.status === 201 || reg.status === 200, reg);
  token = reg.json?.accessToken ?? reg.json?.tokens?.accessToken ?? "";
  if (!token) {
    const login = await api("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
    token = login.json?.accessToken ?? login.json?.tokens?.accessToken ?? "";
  }
  check("got token", token.length > 10);

  // 1. GET config (empty)
  const c0 = await api("GET", "/presence/config");
  check("GET /presence/config (no config yet)", c0.status === 200 && c0.json?.config === null, c0);

  // 2. PUT config
  const c1 = await api("PUT", "/presence/config", {
    active: true,
    platforms: [
      { platform: "instagram", enabled: true, postsPerDay: 1, autoPublish: false, preferredTimes: ["12:00"] },
      { platform: "linkedin", enabled: true, postsPerDay: 1, autoPublish: false, preferredTimes: ["09:00"] },
    ],
    contentPillars: ["Autoridade", "Bastidores"],
    tone: "Direto e provocador",
    businessContext: "Mentoria de lançamentos digitais para experts, ticket R$5k, público: infoprodutores iniciantes.",
  });
  check("PUT /presence/config", c1.status === 200 && c1.json?.config?.id, c1);

  // 3. GET config again
  const c2 = await api("GET", "/presence/config");
  check("GET /presence/config (saved)", c2.status === 200 && c2.json?.config?.active === true && typeof c2.json?.currentWeekStart === "string", c2);

  // 4. Invalid PUT (bad platform)
  const bad = await api("PUT", "/presence/config", { platforms: [{ platform: "orkut", enabled: true }] });
  check("PUT invalid platform → 400", bad.status === 400, bad);

  // 5. GET posts (empty)
  const p0 = await api("GET", "/presence/posts");
  check("GET /presence/posts", p0.status === 200 && Array.isArray(p0.json?.posts), p0);

  // 6. GET metrics
  const m0 = await api("GET", "/presence/metrics");
  check("GET /presence/metrics", m0.status === 200 && m0.json?.totals && Array.isArray(m0.json?.byPlatform), m0);

  // 7. POST generate-week → 202
  const g0 = await api("POST", "/presence/generate-week", {});
  check("POST /presence/generate-week → 202", g0.status === 202, g0);

  // 8. Immediate duplicate → 409
  const g1 = await api("POST", "/presence/generate-week", {});
  check("duplicate generate-week → 409", g1.status === 409, g1);

  // 9. Poll for generation results (up to 4 min)
  let generated = 0;
  for (let i = 0; i < 48; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const p = await api("GET", "/presence/posts");
    generated = (p.json?.posts ?? []).length;
    if (generated > 0 && p.json?.generating === false) break;
    if (i % 6 === 5) console.log(`  … waiting generation (${generated} posts so far)`);
  }
  check(`generation produced posts (${generated})`, generated > 0);

  // 10. Approve first draft
  const pl = await api("GET", "/presence/posts");
  const draft = (pl.json?.posts ?? []).find((p: any) => p.status === "draft");
  if (draft) {
    const ap = await api("POST", `/presence/posts/${draft.id}/approve`, {});
    check("approve draft → scheduled", ap.status === 200 && ap.json?.post?.status === "scheduled", ap);
    // 11. PATCH caption
    const pt = await api("PATCH", `/presence/posts/${draft.id}`, { caption: "Legenda editada no smoke test." });
    check("PATCH caption", pt.status === 200 && pt.json?.post?.caption?.includes("smoke"), pt);
  } else {
    check("draft available to approve", false, pl.json?.posts?.map((p: any) => p.status));
  }

  // 12. Bio optimize
  const bio = await api("POST", "/presence/bio/optimize", {});
  check("POST /presence/bio/optimize", bio.status === 200 && Array.isArray(bio.json?.suggestions) && bio.json.suggestions.length > 0, bio);

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
}

async function cleanup() {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.email, EMAIL));
    for (const u of users) {
      const wss = await db.select().from(workspacesTable).where(eq(workspacesTable.ownerId, u.id));
      for (const ws of wss) {
        await db.delete(socialPresencePostsTable).where(eq(socialPresencePostsTable.workspaceId, ws.id));
        await db.delete(socialPresenceConfigTable).where(eq(socialPresenceConfigTable.workspaceId, ws.id));
        await db.delete(workspacesTable).where(eq(workspacesTable.id, ws.id));
      }
      await db.delete(usersTable).where(eq(usersTable.id, u.id));
    }
    await db.delete(inviteCodesTable).where(like(inviteCodesTable.label, `[smoke] ${TAG}%`));
  } catch (err) {
    console.log("cleanup warning:", (err as Error).message);
  }
}

main()
  .catch((err) => { failures++; console.error("FATAL", err); })
  .finally(async () => { await cleanup(); process.exit(failures === 0 ? 0 : 1); });
