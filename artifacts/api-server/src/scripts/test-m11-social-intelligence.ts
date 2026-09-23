/**
 * Contract-level adversarial checks for M11's read-only boundary.
 * This intentionally does not contact providers or require a database.
 */
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const service = readFileSync(new URL("../modules/m11-social-intelligence/m11-social-intelligence.service.ts", import.meta.url), "utf8");
const routes = readFileSync(new URL("../modules/m11-social-intelligence/m11-social-intelligence.routes.ts", import.meta.url), "utf8");

// Every source read must carry workspace scope, and integrations must be joined
// for conversation turns (prevents cross-tenant integration leakage).
assert.match(service, /socialCommentActionsTable\.workspaceId/);
assert.match(service, /socialConversationTurnsTable\.workspaceId/);
assert.match(service, /workspaceIntegrationsTable\.workspaceId/);
// Cursor pagination is deterministic on timestamp plus id, not offset.
assert.match(service, /b\.at\.getTime\(\).*b\.id\.localeCompare/);
assert.match(service, /encodeCursor\(page\[page\.length - 1\]!\.at/);
// Reports cannot be mutated and saving is explicitly owner-gated.
assert.doesNotMatch(routes, /router\.(put|patch|delete)\(["']\/reports/);
assert.match(routes, /isOwner\(req\.auth\.workspaceId, req\.auth\.userId\)/);
// This module must remain provider-free.
assert.doesNotMatch(service, /fetch\(|axios|accessToken/);
process.stdout.write("M11 social intelligence adversarial contract checks passed\n");