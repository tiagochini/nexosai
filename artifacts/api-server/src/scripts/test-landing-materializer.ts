import assert from "node:assert/strict";
import { Script } from "node:vm";
import { materializeLandingHtml } from "../modules/landing-publication/landing-publication.service.js";

const html = materializeLandingHtml({
  pageTitle: "Teste <script>alert(1)</script>",
  metaTitle: "Teste seguro",
  metaDescription: "Descrição & segurança",
  sections: [{ headline: "Título <img src=x>", subheadline: "Subtítulo", bodyContent: "Conteúdo seguro", cta: { text: "Enviar" } }],
}, {
  ctas: [{ key: "hero", label: "Quero saber mais", action: "capture_lead", target: "sequence-id" }],
  tracking: { metaPixelId: "123456", tiktokPixelId: "789012" },
}, "sequence-id");

assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.match(html, /&lt;img src=x&gt;/);
assert.match(html, /data-cta="hero"/);
assert.match(html, /\/api\/lead-capture\//);
assert.match(html, /Autorizo o contato/);
assert.match(html, /nexos-marketing-consent/);
assert.match(html, /connect\.facebook\.net/);
assert.match(html, /analytics\.tiktok\.com/);
assert.match(html, /marketingConsent==='granted'/);
assert.match(html, /utmCampaign/);
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inlineScript, "expected page behavior script");
assert.doesNotThrow(() => new Script(inlineScript));
console.log("landing-materializer: escaping, CTA, lead capture, consent-gated pixels, and UTMs passed");
