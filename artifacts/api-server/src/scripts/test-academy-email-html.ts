import assert from "node:assert/strict";
import { escapeEmailHtml, emailHref, renderAccessEmailHtml } from "../modules/academy/academy-email-html.js";

assert.equal(escapeEmailHtml(`<&>"'`), "&lt;&amp;&gt;&quot;&#39;");
assert.equal(escapeEmailHtml("João 🚀"), "João 🚀");
assert.equal(escapeEmailHtml("&lt;img&gt;"), "&amp;lt;img&amp;gt;", "entity input remains literal text");
const payload = "<img/src=x/onerror=alert(1)>";
const html = renderAccessEmailHtml({
  name: `${payload} Silva`, productName: "<a href='https://attacker.invalid'>Curso</a>",
  token: "<fixture>&", portalUrl: "https://example.invalid/portal?a=1&b=2",
});
assert.ok(html.includes("&lt;img/src=x/onerror=alert(1)&gt;"));
assert.ok(!html.includes("<img"));
assert.ok(!html.includes("<a href='https://attacker.invalid'"));
assert.ok(html.includes("&lt;fixture&gt;&amp;"));
assert.ok(html.includes('href="https://example.invalid/portal?a=1&amp;b=2"'));
assert.ok(renderAccessEmailHtml({ name: "D'Ávila", productName: "Curso", token: "FIXTURE", portalUrl: "http://localhost:8081/" }).includes("D&#39;Ávila"));
for (const link of ["javascript:alert(1)", "data:text/html,<script>x</script>", "ftp://example.invalid", "not a url", "https://user:password@example.invalid/"]) {
  assert.throws(() => emailHref(link), /Invalid Academy email link/);
}
assert.ok(!emailHref('https://example.invalid/?x=" onclick="alert(1)').includes('" onclick="'));
console.log("PASS Academy email HTML: escaped text, Unicode, literal entities, safe attributes and invalid link rejection (offline)");
