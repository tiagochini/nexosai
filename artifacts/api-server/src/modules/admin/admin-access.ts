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

/**
 * Temporary commercial gate for creating additional workspaces.
 * This is intentionally narrower than admin access: NexOS staff may create
 * isolated operations without becoming administrators of the platform.
 */
export function canCreateInternalWorkspace(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return isAdminEmail(normalized) || normalized.endsWith("@nexos.ai");
}