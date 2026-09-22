---
name: Community Lifecycle Orchestration
description: Defines community creation and lifecycle management as a cross-channel NexOS execution capability.
---

NexOS must create and operate authorized customer communities across WhatsApp, Telegram, Facebook Groups, forums, and future channels. Community execution spans acquisition through advocacy: provisioning, governance, content feeding, nurturing, warming, preparation, conversion, onboarding, follow-up, post-sale, retention, and referrals.

**Why:** Treating communities as only a social publishing feature disconnects pre-sale engagement from CRM, sales, delivery, and customer success, leaving agents to produce plans without operating the relationship lifecycle.

**How to apply:** Begin channel provisioning and moderation in the social execution program, then bind every member and interaction to tenant-scoped CRM lifecycle states, consent, channel policies, Masterplan versions, human handoff, evidence, metrics, and post-sale/referral playbooks.

Channel capabilities must follow current official APIs rather than a generic “group” abstraction. Meta removed the Facebook Groups API and its publish/member permissions in April 2024, so NexOS must not claim automated Facebook Group creation or management; use human-operated groups with assisted planning, or supported Page/Instagram surfaces. In June 2026 Meta opened the WhatsApp Groups API to businesses with an Official Business Account (OBA): eligible Cloud API numbers can create, manage and message groups and receive lifecycle, participant, settings and status webhooks. It is unavailable to WhatsApp Business app numbers and numbers using Multi-solution Conversations. Telegram Bot API remains bot-admin based: a human creates/selects the group and installs/promotes the bot, after which NexOS can operate supported messaging, topic and moderation actions.

**Why:** Provider capability changed materially in 2026: treating WhatsApp groups as universally unavailable is now stale, while treating Facebook Groups as automatable would rely on an API removed across versions.

**How to apply:** Discover and persist a capability snapshot per connected channel. Enable WhatsApp group provisioning only after verifying OBA and Cloud API eligibility; fail closed otherwise. Keep Facebook Groups as assisted-only, and require Telegram bot installation/admin status before executing.