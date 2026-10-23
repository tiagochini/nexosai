/** Same-origin public form/events requests on a verified custom domain need
 * no CORS headers. Do not extend this exception to authenticated APIs. */
export async function isVerifiedLandingSameOrigin(
  input: { path: string; origin?: string; protocol: string; host?: string },
  verify: (hostname: string) => Promise<boolean>,
): Promise<boolean> {
  if (
    !/^\/api\/(?:landings\/[a-f0-9-]{36}\/events|lead-capture\/[a-f0-9-]{36})$/i.test(
      input.path,
    ) ||
    !input.origin ||
    !input.host
  )
    return false;
  try {
    const origin = new URL(input.origin),
      request = new URL(`${input.protocol}://${input.host}`);
    if (origin.protocol !== "https:" || origin.origin !== request.origin)
      return false;
    return verify(origin.hostname);
  } catch {
    return false;
  }
}
