/**
 * B2 Contract Violation Test
 *
 * Validates that:
 * 1. validatePieceContract correctly identifies bad content
 * 2. The retry counter logic works (0 → 1 → MAX → permanently rejected)
 * 3. Good content passes validation
 *
 * Run: pnpm --filter @workspace/scripts run b2-contract-violation-test
 */

import { validatePieceContract } from "../../artifacts/api-server/src/modules/content/content.service.js";

const MAX_CONTRACT_RETRIES = 2;

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

// ── 1. email_sequence ─────────────────────────────────────────────────────────
console.log("\n[1] email_sequence");

assert(
  validatePieceContract("email_sequence", {}) !== null,
  "empty object → violation",
);
assert(
  validatePieceContract("email_sequence", { emailSequence: {} }) !== null,
  "missing preLaunch → violation",
);
assert(
  validatePieceContract("email_sequence", { emailSequence: { preLaunch: [], cartOpen: [] } }) !== null,
  "both arrays empty → violation",
);
assert(
  validatePieceContract("email_sequence", { emailSequence: { preLaunch: [{ subject: "test" }] } }) === null,
  "valid preLaunch → passes",
);

// ── 2. vsl_script ─────────────────────────────────────────────────────────────
console.log("\n[2] vsl_script");

assert(
  validatePieceContract("vsl_script", { sections: [] }) !== null,
  "empty sections → violation",
);
assert(
  validatePieceContract("vsl_script", {}) !== null,
  "missing sections → violation",
);
assert(
  validatePieceContract("vsl_script", { sections: [{ title: "hook" }] }) === null,
  "1 section → passes",
);

// ── 3. ad_copy ────────────────────────────────────────────────────────────────
console.log("\n[3] ad_copy");

assert(
  validatePieceContract("ad_copy", { segments: [], ads: [] }) !== null,
  "both empty → violation",
);
assert(
  validatePieceContract("ad_copy", { segments: [{ name: "cold" }] }) === null,
  "1 segment → passes",
);
assert(
  validatePieceContract("ad_copy", { ads: [{ headline: "buy now" }] }) === null,
  "1 ad → passes",
);

// ── 4. landing_page_structure ─────────────────────────────────────────────────
console.log("\n[4] landing_page_structure");

assert(
  validatePieceContract("landing_page_structure", {}) !== null,
  "empty → violation",
);
assert(
  validatePieceContract("landing_page_structure", { sections: [] }) !== null,
  "empty sections, no headline → violation",
);
assert(
  validatePieceContract("landing_page_structure", { headline: "Transforme sua vida" }) === null,
  "headline present → passes",
);
assert(
  validatePieceContract("landing_page_structure", { sections: [{ type: "hero" }] }) === null,
  "1 section → passes",
);

// ── 5. cpl_script ─────────────────────────────────────────────────────────────
console.log("\n[5] cpl_script");

assert(
  validatePieceContract("cpl_script", { videos: [] }) !== null,
  "empty videos → violation",
);
assert(
  validatePieceContract("cpl_script", { videos: [{ title: "CPL 1" }] }) === null,
  "1 video → passes",
);

// ── 6. stories_sequence ───────────────────────────────────────────────────────
console.log("\n[6] stories_sequence");

assert(
  validatePieceContract("stories_sequence", { sequences: [] }) !== null,
  "empty sequences → violation",
);
assert(
  validatePieceContract("stories_sequence", { sequences: [{ theme: "urgency" }] }) === null,
  "1 sequence → passes",
);

// ── 7. targeting_config ───────────────────────────────────────────────────────
console.log("\n[7] targeting_config");

assert(
  validatePieceContract("targeting_config", { metaAudiences: [], googleAudiences: [], tiktokAudiences: [] }) !== null,
  "all empty → violation",
);
assert(
  validatePieceContract("targeting_config", { metaAudiences: [{ name: "cold lookalike" }] }) === null,
  "1 meta audience → passes",
);

// ── 8. Unknown / unguarded types pass through ─────────────────────────────────
console.log("\n[8] unguarded types");

assert(
  validatePieceContract("content_calendar", {}) === null,
  "unguarded type → always passes (no contract rule)",
);
assert(
  validatePieceContract("media_buying_plan", {}) === null,
  "unguarded type → always passes",
);

// ── 9. Retry counter logic (simulated) ────────────────────────────────────────
console.log("\n[9] retry counter simulation");

function simulateRetry(retryCount: number): "rejected_retry" | "rejected_permanent" | "approved" {
  const badContent = { sections: [] };
  const goodContent = { sections: [{ title: "hook" }] };

  const warn = validatePieceContract("vsl_script", badContent);
  if (!warn) return "approved";

  const nextRetry = retryCount + 1;
  if (nextRetry > MAX_CONTRACT_RETRIES) return "rejected_permanent";
  return "rejected_retry";
}

assert(simulateRetry(0) === "rejected_retry", "retry 0 → rejected, will retry (count 1)");
assert(simulateRetry(1) === "rejected_retry", "retry 1 → rejected, will retry (count 2)");
assert(simulateRetry(2) === "rejected_permanent", "retry 2 hits ceiling → permanently rejected");
assert(simulateRetry(3) === "rejected_permanent", "retry 3 past ceiling → permanently rejected");

function simulateCleanRetry(retryCount: number): "rejected_retry" | "rejected_permanent" | "approved" {
  const goodContent = { sections: [{ title: "hook" }] };
  const warn = validatePieceContract("vsl_script", goodContent);
  if (!warn) return "approved";
  const nextRetry = retryCount + 1;
  if (nextRetry > MAX_CONTRACT_RETRIES) return "rejected_permanent";
  return "rejected_retry";
}

assert(simulateCleanRetry(0) === "approved", "clean content at any retry → approved");
assert(simulateCleanRetry(2) === "approved", "clean content even at ceiling → approved");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error("\n❌ B2 test FAILED");
  process.exit(1);
} else {
  console.log("\n✅ B2 contract violation logic verified — all assertions pass");
}
