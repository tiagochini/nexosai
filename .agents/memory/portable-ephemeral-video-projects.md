---
name: Portable Ephemeral Video Projects
description: Contract for editable project downloads and safe server-media deletion.
---

An ephemeral video project may delete server media only after the user downloads
and explicitly confirms a checksum-bound editable `.nexosvideo` package. A final
MP4 is not enough because it cannot restore sources or timeline editability.

**Why:** Browsers cannot prove that a download was saved successfully on a
device. Deleting after merely starting an HTTP response risks permanent project
loss. Portable packages also need to survive import without carrying server
authority from the exporting workspace.

**How to apply:** Package sources, canonical timeline state and checksums with
relative package-local IDs. On import, validate archive limits, paths, versions
and every checksum before creating fresh tenant-scoped project and media IDs.
Purge only proven project-owned objects, retain minimal audit/legal evidence,
remain retryable after partial deletion, and never promise literally zero total
cost—temporary processing plus small database metadata remain.