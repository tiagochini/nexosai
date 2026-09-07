---
name: Recording library finalization
description: Durable rules for automatic/manual recording folders, raw media uploads, and truthful completion state.
---

Automatic captures and manual uploads must remain distinguishable and default to separate workspace-scoped system folders. Custom folders may organize either type, while each recording retains its immutable origin. A recording is usable by preview/editor only after object storage confirms the upload.

**Why:** A global JSON parser once consumed a raw WebM body before the upload route, and earlier asynchronous storage migration could report success before durable storage existed. Both failure modes leave users believing a recording was saved when it was not.

**How to apply:** JSON parsing must honor request content types so raw video streams reach media handlers untouched. Preserve the real media MIME type, persist failed/processing/ready states, retry against the same recording ID, hide editor actions until ready, and delete storage before deleting metadata.