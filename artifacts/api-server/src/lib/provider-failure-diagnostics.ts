/** Only fixed categories and HTTP status may be logged, never provider response text. */
export function providerFailureDiagnostics(error: unknown) {
  const object = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const rawStatus = object.status ?? object.statusCode;
  const status = typeof rawStatus === "number" && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : undefined;
  const text = error instanceof Error ? error.message.toLowerCase() : "";
  const failureCategory = status === 401 || status === 403 || /unauthorized|authentication|invalid.api.key/.test(text) ? "authentication"
    : /credit|billing|insufficient.quota|balance/.test(text) ? "billing_or_quota"
    : status === 429 || /rate.limit|too.many.requests/.test(text) ? "rate_limit"
    : status === 404 || /model.*not.found|model.*not.exist|unsupported.model/.test(text) ? "model_unavailable"
    : /timeout|timedout|aborted|aborterror/.test(text) ? "timeout"
    : status && status >= 500 ? "provider_unavailable" : "provider_request_failed";
  return { failureCategory, ...(status ? { httpStatus: status } : {}) };
}
