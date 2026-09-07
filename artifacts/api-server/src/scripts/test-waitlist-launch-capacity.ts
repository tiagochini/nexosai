import assert from "node:assert/strict";
import {
  LAUNCH_CAPACITY,
  LAUNCH_SOURCE,
  appendLaunchSource,
  decideLaunchReservation,
  isLaunchSource,
} from "../modules/waitlist/launch-reservation.service.js";
import waitlistRouter from "../modules/waitlist/waitlist.routes.js";

assert.equal(LAUNCH_CAPACITY, 100);
assert.equal(isLaunchSource("campaign,landing-plf"), true);
assert.equal(isLaunchSource("landing"), false);
assert.equal(appendLaunchSource("legacy-campaign"), `legacy-campaign,${LAUNCH_SOURCE}`);
assert.equal(appendLaunchSource("legacy,landing-plf"), "legacy,landing-plf");
assert.equal(appendLaunchSource(null), LAUNCH_SOURCE);
// The direct landing and ?seq= landing both invoke this same decision path.
const standardLanding = { existingLaunchReservation: false, capacityReached: false, existingWaitlistEntry: false };
const sequenceAttributedLanding = { existingLaunchReservation: false, capacityReached: false, existingWaitlistEntry: false };
assert.equal(decideLaunchReservation(standardLanding), "reserve");
assert.equal(decideLaunchReservation(sequenceAttributedLanding), "reserve");
assert.equal(decideLaunchReservation({ existingLaunchReservation: false, capacityReached: false, existingWaitlistEntry: true }), "upgrade");
assert.equal(decideLaunchReservation({ existingLaunchReservation: true, capacityReached: true, existingWaitlistEntry: true }), "duplicate");
assert.equal(decideLaunchReservation({ existingLaunchReservation: false, capacityReached: true, existingWaitlistEntry: false }), "capacity_reached");

const routeStack = (waitlistRouter as unknown as {
  stack?: Array<{ route?: { path?: string } }>;
}).stack ?? [];
assert.equal(
  routeStack.some(({ route }) => /(?:count|capacity|status)/.test(route?.path ?? "")),
  false,
  "waitlist router must not publicly register capacity/status routes",
);
console.log("waitlist launch capacity policy tests passed");