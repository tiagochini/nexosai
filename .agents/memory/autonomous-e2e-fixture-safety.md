---
name: Autonomous E2E Fixture Safety
description: Prevent operational test fixtures from triggering unrelated autonomous work or external side effects.
---

Operational E2E fixtures must be intentionally inert outside the behavior under test. Keep stale-state fixtures alive for less than the relevant scheduler interval, use locally terminal actions when testing queue failure/replay, and always remove fixtures in a `finally` cleanup.

**Why:** Autonomous recovery and scheduling are expected to react to realistic stale records. A seemingly harmless “stuck campaign” fixture can therefore wake recovery workers and trigger AI or provider activity, contaminating the test and creating unintended cost or side effects.

**How to apply:** Before inserting any stale, due, approved, queued, or retryable fixture, identify every scheduler/worker that can claim it. Either isolate the tested boundary with an inert action, remove the fixture before the next tick, or use an existing test-only seam that is impossible to enable in production.