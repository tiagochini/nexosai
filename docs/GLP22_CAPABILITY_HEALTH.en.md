# GLP22 Method — Internal Capability Health and Certification Matrix

**Languages:** [Português](./GLP22_CAPABILITY_HEALTH.md) | English

**Nature:** internal operational truth; this is not landing-page copy or a
commercial claim.

**Version:** 0.1

**Canonical basis:** `docs/ETAPA_0_CONGELAMENTO_CONCEITUAL.md` (v0.2) and the
Stage 1 technical inventory.

**Current conservative audit:** 20 capabilities **PARTIAL**, 2 **BLOCKED**,
0 **HEALTHY**.

## Naming and scope rule

**GLP22 Method** is the adopted public and internal proprietary name of the
protocol. “Global Launch Protocol (GLP)” is the former historical/conceptual
name and may appear with that meaning in evidence and legacy documents. This
matrix uses the **exact 22 canonical domains** from Stage 0. They are
interdependent operational capabilities—not 22 agents or roadmap stages.

## Classes and strict certification rule

- **PARTIAL:** a foundation is implemented, but at least one condition involving
  scope, executor, evidence, isolation, recovery, or sovereign linkage is missing.
- **BLOCKED:** a critical condition still lacks real provider/sandbox or executor
  evidence; the capability cannot advance to certification.
- **HEALTHY:** only when the applicable material scope includes:
  1. material operational execution;
  2. a deterministic executor when applicable;
  3. independent external provider evidence;
  4. tenant/workspace isolation and idempotency;
  5. proven fault injection and recovery; and
  6. immutable linkage to the approved Master Plan version.

A unit test, fixture, mock, simulation, local environment, or dry-run **never**
equals HEALTHY. Internal logs also do not replace a receipt or independent
provider confirmation. The evidence below is the minimum objective evidence
required to certify each row, in addition to the six strict requirements above.

## Certification matrix

| # | Canonical capability | Current class | Implemented foundation | Priority missing condition | Objective evidence required for certification |
|---:|---|---|---|---|---|
| 1 | Immersion and intake | PARTIAL | Conversational questionnaire/intake, persistence, scoring, and clarifications. | A single gate for evidence, delivery capacity, risks, and contradictions. | Approved real intake record with complete fields and gates, immutably linked to the Master Plan; isolation, idempotent replay, and failure/resumption tests. |
| 2 | Market intelligence and analysis | PARTIAL | Agent, asynchronous report, states, and campaign/workspace linkage. | Uniform external sources, provenance, confidence, and freshness. | Report using dated, verifiable external sources with confidence and reconciliation; query receipts, isolation/idempotency, source failure and recovery, linked to the approved Master Plan. |
| 3 | Avatar, segmentation, and journey | PARTIAL | Profile builder, targeting, dynamic avatar, and social analysis. | Audiences built, synchronized, and used by stage and channel. | Real provider audience creation/synchronization receipts, independent segment reconciliation and use; isolation, idempotent reexecution, failure/recovery, and Master Plan linkage. |
| 4 | Positioning, mechanism, and narrative | PARTIAL | Identity, strategic core/doctrine, emotional arc, coherence, and internal gates. | Uniform versioning, approval, and propagation into execution. | Approved version propagated to assets and actions with auditable input/output hashes; change/rejection, isolation, recovery, and immutable Master Plan linkage tests. |
| 5 | Offer engineering | PARTIAL | Offer/pricing agents, objections, upsell, products, and checkout. | End-to-end published and verified offer, including terms and continuity. | Real or authorized-sandbox offer published at checkout with independent price/terms query; demonstrated idempotency, isolation, failure/reversal, and approved Master Plan. |
| 6 | Strategic launch architecture | PARTIAL | Strategy, command, governor, launch manager, phases, pipeline, and scheduler. | Proven coordination of channels, dependencies, gates, and contingencies. | Material multichannel execution against the approved plan with observable dependencies/gates; external receipts, isolation/idempotency, injected/recovered failure, and immutable linkage. |
| 7 | Master Plan | PARTIAL | Visualization, PDF, memory, decision trails, and cross-validation. | A versioned sovereign entity governing actions, budget, approvals, gates, and rollback. | Approved, versioned Master Plan whose hash is required and preserved in every action; auditable mutation/replay attempt, isolation, and proven recovery. |
| 8 | Funnel construction | PARTIAL | Capture, pages, sequences, pipeline, checkout, and analytics components. | Published and verified funnel from traffic through conversion, abandonment, onboarding, and ascension. | Real/sandbox end-to-end journey with independent receipts at each transition; rerun without duplication, isolation, failure/recovery, and immutable Master Plan. |
| 9 | Copy | PARTIAL | Generation for ads, pages, VSL, content, email, and WhatsApp; approval/compliance. | Uniform derivation from the active Master Plan and evidence of publishing/delivery/performance. | Artifacts containing the Master Plan version/hash and provider publishing/delivery receipts; isolation, idempotency, failure/recovery, and external reconciliation. |
| 10 | Creative direction and visual production | PARTIAL | Brief, direction, generation, previews, approval, rejection, and regeneration. | Uniform export, distribution, visual verification, and recovery by channel. | Approved final asset published with a verifiable URL/receipt; independent validation, isolation/idempotency, recovered export/publication failure, and Master Plan linkage. |
| 11 | Video direction and production | BLOCKED | Strategy, hooks, brief, storyboard, projects, recordings, avatar/voice, generation, and editor. | Evidence of a real provider/sandbox executor for final render → publication → verification. | Provider/sandbox render and publication receipts, independent availability confirmation, and asset chain; isolation/idempotency, failure/recovery, and immutable Master Plan. |
| 12 | Pages and digital assets | PARTIAL | Landing-page agent, site builder, content, VSL, checkout, routes, and persistence. | Deployment, domain, responsiveness, tracking, tests, and post-publication verification. | Published and externally verified URL, responsiveness/tracking tests, and deployment/DNS receipts; isolation/idempotency, failure/recovery, and Master Plan linkage. |
| 13 | Infrastructure, tracking, and integrations | PARTIAL | OAuth, integrations, validation, webhooks, Meta security, and revenue events. | A single attribution, permission, expiration, and recovery standard across channels. | Real provider connection with receipt and event/attribution reconciliation; scope, expiration and recovery tests, isolation/idempotency, and immutable Master Plan. |
| 14 | CRM, lead, group, and community management | PARTIAL | Capture, contacts, pipeline, conversations, segments, follow-up, WhatsApp, and group planner. | Unified identity/history, deduplication, scoring, synchronization, and autonomous management. | Consented real/sandbox lead tracked in CRM/provider and community with deduplication and receipts; isolation/idempotency, failure/recovery, and Master Plan linkage. |
| 15 | Digital presence and audience | PARTIAL | Planning, generation, approval, scheduling, publication, worker, metrics, and webhooks. | Uniform token/failure recovery and a proven audience → lead → sale journey. | Independent publication, metric, and attributed-conversion receipts; expired-token recovery test, isolation/idempotency, and immutable Master Plan. |
| 16 | Email, messaging, and nurturing | PARTIAL | Dispatchers, sequences, schedule, contacts, copy, email, WhatsApp, and partial webhooks. | End-to-end deliverability, receipt/reply, opt-out, dead-letter, and recovery. | Provider acceptance/delivery and opt-out receipts with reconciled history; delivery deduplication, isolation, failure/dead-letter/resumption, and Master Plan linkage. |
| 17 | Paid media | BLOCKED | Accounts, providers, policies, proposals, attempts, actions, sync, scheduler, and partial preflight. | Evidence of a real provider/sandbox executor that creates, approves, and verifies campaigns/metrics. | Real sandbox/provider API receipts for campaign, spend/state, and reconciled metrics; isolation/idempotency, failure/rollback/recovery, and immutable Master Plan. |
| 18 | Coordinated launch execution | PARTIAL | Queues, worker, fallback, checkpoint, dead-letter, replay, status, and war room. | An end-to-end chain governing external actions through the same Master Plan with uniform evidence. | Complete material-launch trace between external actions and the approved plan; provider receipts, isolation/idempotency, injected failure/replay/recovery, and immutable hash. |
| 19 | Service, sales, and conversion | PARTIAL | Sales team, suggestions, WhatsApp, conversations, objections, pipeline, checkout, and revenue. | Reliable handoff, follow-up, recovery, closing, and attribution across providers. | Consented conversation through CRM/checkout outcome with independent receipts and reconciled attribution; isolation/idempotency, failure/recovery, and immutable Master Plan. |
| 20 | Monitoring and optimization | PARTIAL | Metrics, health, status, social analytics, traffic feedback, optimization, and reports. | Proven diagnosis → decision → external action → verification cycle. | Reconciled external metric that triggers an authorized action and measures its later effect; isolation/idempotency, failure/recovery, and Master Plan linkage. |
| 21 | Post-launch and learning | PARTIAL | Debriefing, memory, cross-campaign intelligence, logs, metrics, audit, and self-proof. | Quality governance and automatic/verifiable reuse in the next cycle. | Debrief with reconciled external sources and approved learning consumed by a later cycle with provenance; isolation, idempotency, failure/recovery, and immutable Master Plan. |
| 22 | Continuity, relaunch, and evergreen | PARTIAL | Perpetual launch manager, reengagement, campaigns, sequences, scheduler, memory, and continuous presence. | Results-driven adaptive operation with decision, gates, execution, verification, and closure. | Material later cycle with a decision based on external results, verified gate and execution; isolation/idempotency, failure/recovery, and approved Master Plan linkage. |

## Public communication rule

The landing page presents **only the capabilities** of the GLP22 Method; it must
not claim certification, operational health, or proven execution for any row
above. Public promotion of the GLP22 Method as a fully operational system is
conditional on **HEALTHY certification for all 22 capabilities** in this matrix,
without exceptions for unit tests or dry-runs.
