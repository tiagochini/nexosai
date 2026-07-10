---
name: Invite code plan assignment
description: invite codes must gate access only, never override the user's selected plan
---

`invite_codes.planSlug` in the DB schema defaults to `"agency"`. The registration handler used to read this field and force-upgrade the newly created workspace to that plan, overwriting whatever plan the user had actually selected (e.g. a user choosing "Solo" would silently end up on "Agency" because the invite code they used had no explicit planSlug override recorded and fell back to the column default).

**Why:** invite codes in this product are a platform access gate (closed-cart / invite-only registration), not a plan-selection mechanism. There is no UI anywhere that lets an admin author an invite code tied to a specific plan on purpose, so the field's default was silently corrupting plan assignment for every invite-gated signup.

**How to apply:** registration must resolve the plan strictly from the plan the client explicitly requested (`planSlug` in the register payload, defaulting to `"solo"` if absent/invalid). Invite code validation/redemption should only: (1) gate whether registration is allowed when the platform is closed, and (2) mark the code as used + record who used it. Never read `invite.planSlug` to set `workspacesTable.planId`/`creditsBalance`. If a genuine "gift this specific plan via code" feature is wanted later, it needs its own explicit UI showing the target plan before submission — don't silently infer it from a DB column default.
