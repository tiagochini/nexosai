---
name: E2E testing needs accessible names on icon-only buttons
description: Playwright-based testing subagent (runTest) cannot reliably click icon-only buttons (e.g. an X close button with no text/aria-label), even when visible in screenshots.
---

Icon-only interactive elements (close "X" buttons, icon-only toggles) must have an `aria-label` (and ideally a `title`) or the Playwright-based `runTest` subagent cannot locate them via role/name/text locators — it will time out and report the step as "unable" even though the element is visually present.

**Why:** Confirmed with the integration chat panel's close button — a bare `<button><X /></button>` was visible in screenshots but not discoverable by the testing subagent's accessibility-tree-based locators.

**How to apply:** When building any icon-only button expected to be exercised by `runTest`, add `aria-label="<action description>"` up front. This also improves real accessibility, so it's a good default for all icon-only buttons, not just ones under test.
