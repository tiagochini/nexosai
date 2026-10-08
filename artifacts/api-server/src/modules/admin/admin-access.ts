const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Server configuration only. Empty or malformed configuration denies all access. */
export function isPlatformAdmin(userId: string): boolean {
  const ids = (process.env["PLATFORM_ADMIN_USER_IDS"] ?? "").split(",").map(id => id.trim()).filter(Boolean);
  return UUID.test(userId) && ids.length > 0 && ids.every(id => UUID.test(id)) &&
    ids.some(id => id.toLowerCase() === userId.toLowerCase());
}

/** Workspace creation remains scoped to the authenticated user's own operations. */
export function canCreateInternalWorkspace(userId: string): boolean {
  return isPlatformAdmin(userId);
}
