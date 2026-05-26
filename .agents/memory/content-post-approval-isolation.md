---
name: Content Post-Approval Isolation
description: All approval side-effects are centralized in content-post-approval.ts, not inline in content.routes.ts
---

## Rule
`content.routes.ts` approval handler calls `runPostApprovalHooks(ctx)` — never the individual side-effects directly.

Side-effects live in `content/content-post-approval.ts`:
1. Memory save via `processContentPieceApproval()` (agentRole = pieceType, approved = true)
2. Social auto-post via `autoPostApprovedContent()`
3. Creative auto-gen via `autoGenerateCreativesFromBrief()` (media_brief only)
4. Strategic alignment re-check via `runStrategicAlignmentEngine()` + `updateBrainSection()`

**Why:** 4 scattered fire-and-forget calls in the route handler made the approval flow hard to audit and test. Centralization means adding/removing a hook changes one file.

**How to apply:** To add a new post-approval side-effect, edit `content-post-approval.ts` only — add a new hook inside `runPostApprovalHooks()`.
