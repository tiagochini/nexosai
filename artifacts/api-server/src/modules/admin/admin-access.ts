const ADMIN_EMAILS = new Set([
  "admin@nexos.ai",
  "founder@nexos.ai",
  "admin@agencianexos.vip",
  "founder@agencianexos.vip",
]);

/** Kept separate so privileged routes share a single, testable authorization rule. */
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}