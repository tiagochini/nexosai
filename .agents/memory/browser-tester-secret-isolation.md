---
name: Browser tester secret isolation
description: Authentication preparation when a browser testing subagent needs an existing test account.
---

The browser testing runtime does not expose `process` or `process.env` to a browser test. A request to read existing workspace test-account secrets directly from that runtime cannot authenticate and produces an `unable` result. Never print or paste those secrets into a test plan to work around this.

**Why:** An M11 social UI pass reached the login page but could not safely retrieve test credentials from its browser context. The public screenshot and backend tests are not substitutes for an authenticated browser pass.

**How to apply:** Prepare an isolated, disposable test fixture with a supported authentication path, or use a supported secure test-credential injection method, before requesting browser verification of authenticated pages. If neither exists, record UI verification as unproven rather than claiming success.