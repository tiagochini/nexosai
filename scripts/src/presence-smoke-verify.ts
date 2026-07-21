import { db, inviteCodesTable, usersTable, workspacesTable, socialPresenceConfigTable, socialPresencePostsTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";

const BASE = "http://localhost:80/api";
const PASSWORD = "SenhaForte!123";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  PASS ${label}`);
  else { failures++; console.log(`  FAIL ${label}`, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : ""); }
}

async function main() {
  const users = await db.select().from(usersTable).where(like(usersTable.email, "psmoke%@teste.nexos.ai"));
  const user = users[users.length - 1];
  if (!user) { console.log("no smoke user found"); failures++; return; }
  console.log(`── Verifying with ${user.email} ──`);

  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: PASSWORD }),
  });
  const lj: any = await login.json();
  const token = lj?.accessToken ?? lj?.tokens?.accessToken ?? "";
  check("login", token.length > 10, lj);
  const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const pr = await fetch(`${BASE}/presence/posts`, { headers: H });
  const pj: any = await pr.json();
  const posts: any[] = pj?.posts ?? [];
  check(`GET posts after generation (${posts.length})`, posts.length >= 14 && pj?.generating === false, { count: posts.length, generating: pj?.generating });

  const igPosts = posts.filter((p) => p.platform === "instagram");
  const liPosts = posts.filter((p) => p.platform === "linkedin");
  check(`instagram posts (${igPosts.length}) with caption+time`, igPosts.length === 7 && igPosts.every((p) => p.caption && /^\d{2}:\d{2}$/.test(p.postingTime)));
  check(`linkedin posts (${liPosts.length})`, liPosts.length === 7);
  check("all drafts initially", posts.every((p) => ["draft", "scheduled", "published", "cancelled"].includes(p.status)));

  const draft = posts.find((p) => p.status === "draft");
  if (draft) {
    const ap = await fetch(`${BASE}/presence/posts/${draft.id}/approve`, { method: "POST", headers: H });
    const aj: any = await ap.json();
    check("approve draft → scheduled + scheduledFor", ap.status === 200 && aj?.post?.status === "scheduled" && !!aj?.post?.scheduledFor, aj);

    const pt = await fetch(`${BASE}/presence/posts/${draft.id}`, {
      method: "PATCH", headers: H, body: JSON.stringify({ caption: "Legenda editada no smoke test." }),
    });
    const tj: any = await pt.json();
    check("PATCH caption", pt.status === 200 && tj?.post?.caption?.includes("smoke"), tj);
  } else {
    check("draft available", false, posts.map((p) => p.status).slice(0, 5));
  }

  const cf = await fetch(`${BASE}/presence/config`, { headers: H });
  const cj: any = await cf.json();
  check("config has lastWeekGeneratedAt", !!cj?.config?.lastWeekGeneratedAt, cj?.config?.lastWeekGeneratedAt);

  const mt = await fetch(`${BASE}/presence/metrics`, { headers: H });
  const mj: any = await mt.json();
  check("metrics totals reflect posts", mt.status === 200 && (mj?.totals?.drafts + mj?.totals?.scheduled) >= 13, mj?.totals);

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
}

async function cleanup() {
  try {
    const users = await db.select().from(usersTable).where(like(usersTable.email, "psmoke%@teste.nexos.ai"));
    for (const u of users) {
      const wss = await db.select().from(workspacesTable).where(eq(workspacesTable.ownerId, u.id));
      for (const ws of wss) {
        await db.delete(socialPresencePostsTable).where(eq(socialPresencePostsTable.workspaceId, ws.id));
        await db.delete(socialPresenceConfigTable).where(eq(socialPresenceConfigTable.workspaceId, ws.id));
        await db.delete(workspacesTable).where(eq(workspacesTable.id, ws.id));
      }
      await db.delete(usersTable).where(eq(usersTable.id, u.id));
    }
    await db.delete(inviteCodesTable).where(like(inviteCodesTable.label, "[smoke] %"));
    console.log(`cleanup: removed ${users.length} smoke user(s)`);
  } catch (err) {
    console.log("cleanup warning:", (err as Error).message);
  }
}

main()
  .catch((err) => { failures++; console.error("FATAL", err); })
  .finally(async () => { await cleanup(); process.exit(failures === 0 ? 0 : 1); });
