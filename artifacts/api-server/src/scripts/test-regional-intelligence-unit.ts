import assert from "node:assert/strict";
import { normalizeCountryCode, normalizeE164, normalizePublicUrl, validateIanaTimezone } from "../modules/market-intel/regional-intelligence.service.js";

assert.equal(
  normalizePublicUrl("HTTPS://Example.COM:443/pricing/?utm_source=newsletter&fbclid=abc"),
  "https://example.com/pricing",
);
assert.equal(normalizePublicUrl("https://example.com/"), "https://example.com/");
assert.throws(() => normalizePublicUrl("ftp://example.com"), /HTTP ou HTTPS/);
assert.equal(normalizeCountryCode("br"), "BR");
assert.equal(normalizeCountryCode("DE"), "DE");
assert.throws(() => normalizeCountryCode("BRA"), /ISO/);
assert.equal(normalizeE164("+55 (11) 99999-9999"), "+5511999999999");
assert.equal(normalizeE164("+49 30 12345678"), "+493012345678");
assert.throws(() => normalizeE164("11 99999-9999"), /E.164/);
assert.equal(validateIanaTimezone("America/Sao_Paulo"), "America/Sao_Paulo");
assert.equal(validateIanaTimezone("Europe/Berlin"), "Europe/Berlin");
assert.throws(() => validateIanaTimezone("Brazil/SaoPaulo"), /IANA/);
console.log("regional intelligence pure unit tests passed");