import assert from "node:assert/strict";
import { hasUsableCalendar, scheduleCompleteness } from "../modules/orchestration/schedule-completeness.js";

const timeline = { schedulePreview: { phases: [{ phase: "capture" }, { phase: "cart" }] } };
const content = { calendar: [{ platform: "instagram", caption: "Conteúdo completo" }] };
assert.equal(hasUsableCalendar({ calendar: [] }), false);
assert.equal(hasUsableCalendar({ calendar: [{ platform: "instagram", caption: " " }] }), false);
assert.deepEqual(scheduleCompleteness(timeline, [{ type: "content_calendar", launchPhase: "capture", content }]).missingPhases, ["cart"]);
assert.equal(scheduleCompleteness(timeline, ["capture", "cart"].map(launchPhase => ({ type: "content_calendar", launchPhase, content }))).ready, true);
assert.equal(scheduleCompleteness(timeline, [{ type: "social_post", launchPhase: "capture", content }]).ready, false);
assert.equal(scheduleCompleteness(timeline, [{ type: "content_calendar", launchPhase: "capture", content: { calendar: [] } }]).ready, false);
assert.equal(scheduleCompleteness({}, []).required, false);
console.log("Schedule completeness checks passed");
