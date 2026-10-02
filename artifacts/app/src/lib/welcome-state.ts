const WELCOME_SEEN_KEY = "nexos_welcome_seen";

// The database flag remains authoritative. This local hint only avoids a flash
// of the welcome flow while the authenticated profile is still loading.
export function hasSeenWelcome(): boolean {
  try {
    return Boolean(localStorage.getItem(WELCOME_SEEN_KEY));
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    // Storage can be unavailable in privacy modes; the database flag still
    // prevents the flow from being shown again after the profile refreshes.
  }
}
