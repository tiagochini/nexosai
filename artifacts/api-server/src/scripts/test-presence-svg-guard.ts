import assert from "node:assert/strict";
import { isSvgMediaUrl } from "../modules/social-presence/social-presence.service.js";

assert.equal(isSvgMediaUrl("data:image/svg+xml;base64,PHN2Zz4="), true);
assert.equal(isSvgMediaUrl("data:image/svg+xml;charset=utf-8,%3Csvg%3E"), true);
assert.equal(
  isSvgMediaUrl("https://api.example.test/api/presence/media/serve?key=presence-storyboard/a.svg"),
  true,
);
assert.equal(
  isSvgMediaUrl("https://api.example.test/api/presence/media/serve?key=presence-storyboard%2Fa.svg"),
  true,
);
assert.equal(isSvgMediaUrl("https://cdn.example.test/image.png?version=svg"), false);
assert.equal(isSvgMediaUrl("https://cdn.example.test/image.png?version=render.svg"), false);
assert.equal(isSvgMediaUrl("https://cdn.example.test/image.jpg"), false);
assert.equal(isSvgMediaUrl("data:image/png;base64,AAAA"), false);
assert.equal(isSvgMediaUrl(null), false);

console.log("presence SVG guard tests passed");