---
name: Supplier-direct infrastructure billing
description: Commercial boundary for domain and hosting purchases arranged through NexOS.
---

Domain registration and hosting charges must be paid directly by the customer to the selected supplier. NexOS may prepare the order and present the supplier's official payment artifact, but must not collect, mark up, remit, or custody those funds.

**Why:** The user explicitly chose a supplier-direct commercial model. Different suppliers may issue a boleto, invoice, hosted checkout, card payment, or guided purchase flow, so NexOS must never label every payment method as boleto or invent one.

**How to apply:** Keep provider-neutral payment artifact states. Block DNS, SSL, domain binding, and publication until a webhook or provider poll independently confirms payment and provisioning. Store provider references and statuses, never payment credentials.