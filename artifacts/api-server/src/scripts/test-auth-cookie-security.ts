import assert from "node:assert/strict";
import { readRefreshCookie, refreshCookieOptions } from "../modules/auth/auth-session-cookie.js";

assert.deepEqual(refreshCookieOptions(true), { httpOnly: true, secure: true, sameSite: "strict", path: "/api/auth" });
assert.equal(refreshCookieOptions(false).secure, false);
assert.equal(readRefreshCookie({ headers: {} }), null);
assert.equal(readRefreshCookie({ headers: { cookie: "other=value; nexos_refresh=fixture%2Evalue" } }), "fixture.value");
assert.equal(readRefreshCookie({ headers: { cookie: "nexos_refresh=%INVALID" } }), null);
assert.equal(readRefreshCookie({ headers: { cookie: "nexos_refresh=one; nexos_refresh=two" } }), null);
console.log("Production cookie security and ambiguous/malformed cookie rejection passed");
