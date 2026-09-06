---
name: Audiovisual Studio Contract
description: Durable safety and capability boundaries for autonomous audiovisual production.
---

The persistent audiovisual flow uses the video project as its production root and
stores manifest, assets, timeline, renders, QC, revisions and correction loops as
workspace-scoped records. Specialist agents plan and validate; provider adapters
and FFmpeg perform media generation and rendering.

**Why:** A polished interface can otherwise overstate what was executed, while
detached media jobs, cross-workspace campaign references and unverified digital
twins create data, recovery and consent failures that are unacceptable in a
multiclient autonomous product.

**How to apply:** Validate every campaign, asset, job and render against the active
workspace. Verify digital-twin consent with the provider and persist confirmation
server-side; never trust a client timestamp. Persist failures and resume interrupted
render jobs. Mark a phase ready only when its declared executor actually ran. QC
must inspect bounded media evidence or fail closed to human review. Any timeline or
correction revision invalidates prior render/QC readiness.