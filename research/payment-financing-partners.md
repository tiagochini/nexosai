# Brazil payment-link and financing-partner research — NexOS

**Scope.** Public documentation reviewed 7 September 2026 for a BRL 3,990
digital/software/marketing service sold to Brazilian consumers. “Upfront” below
means the merchant's payment is credited/anticipated; it does **not** establish
that a provider contractually absorbs every refund, card-network dispute, fraud
loss, or consumer-credit default.

## Key Facts

1. **Mercado Pago’s Linha de Crédito is the clearest public fit for a
   lender-funded checkout, but only to 12x in the reviewed documentation.**
   Its official developer guide says the buyer may choose up to 12 fixed monthly
   installments without a card and that the payment is credited in full to the
   seller account. It is administered by Mercado Pago. This is materially
   different from merely anticipating a card receivable. The guide does not
   publish an 18x/24x option.
2. **Pagar.me/Stone has the technical pieces, not a published 24x commitment.**
   Its payment-link documentation supports credit-card configuration and an
   installments array, with an interest-type setting. Its Spot Anticipation API
   explicitly simulates the amount, fees, date, and a recipient-specific
   anticipable limit. Therefore it can support a merchant-upfront design where
   the commercial account is eligible, but the public source does not state
   18x/24x card availability, pricing, or that Pagar.me takes consumer default.
   Its disputes API confirms chargebacks remain an operational flow.
3. **PagBank Link de Pagamento supports merchant-configured installments and
   interest allocation.** PagBank’s own blog says the seller sets the value,
   installment number and due date, can choose whether seller or buyer pays
   installment interest, and card settlement depends on the chosen receiving
   plan. It does not state a maximum count in the reviewed page; it is not
   evidence of 24x or merchant payment upfront.
4. **Asaas publicly offers anticipation on boleto and card receivables, including
   installment-card sales, subject to fees.** Its corporate blog describes
   immediate access to future card-sale proceeds and says fees vary by institution,
   receivable type, and business risk. That is receivables finance, not proof of
   a consumer installment-loan product or provider-borne buyer default.
5. **Koin publicly markets a relevant alternative:** “Pix Parcelado” with
   “até 24x,” “receba à vista,” risk-based rates/number of installments, and a
   “zero risk” claim. It is a supplier marketing page, not contract terms; it
   should be treated as a lead for underwriting/commercial diligence, not proof
   of a no-recourse guarantee.
6. **Chargeback is distinct from buyer repayment/default.** Mercado Pago says a
   card amount is withheld while a cardholder “does not recognize” dispute is
   resolved; Pagar.me provides a chargeback management API. Neither reviewed
   public technical page allocates final financial liability between merchant and
   provider. For a digital service, refund/withdrawal and service-performance
   disputes must be explicitly included in the agreement review.

**Practical shortlist:** First ask Koin for a formal 18–24x, merchant-paid-upfront
proposal and loss-allocation schedule; ask Mercado Pago whether the account/product
qualifies for Linha de Crédito (publicly 12x); and ask Pagar.me/Stone, PagBank,
and Asaas for account-specific maximum installments and automatic/spot
anticipation pricing. No reviewed public source validates 18–24x **and**
unconditional upfront merchant funding for NexOS.

## Claims Requiring Cross-Reference

| Provider | Claim/status | What must be confirmed in writing |
|---|---|---|
| Koin | 24x / merchant receives upfront / “zero risk” are marketing claims. | Approval for BRL 3,990 intangible service; exact tenor, CET and who pays it; settlement timing; recourse for missed Pix installments, fraud, refund, cancellation, chargeback, and insolvency. |
| Mercado Pago | Public guide supports full seller credit and 12x no-card credit. | Brazilian merchant onboarding/beneficial-owner and settlement eligibility for an Australian company; product/category acceptance; buyer APR/CET; reserves; reversals; actual account limit and 18x/24x availability. |
| Pagar.me/Stone | Link installment controls and Spot Anticipation endpoints are public. | Maximum permitted installments for this MCC/product; card-brand rules; whether anticipation is automatic; fee/CET; reserve; chargeback debit/recovery and any fraud coverage terms. |
| PagBank | Seller/buyer interest choice and configurable installment count are public. | Numeric maximum (especially 18/24), receiving-plan payout, anticipation availability/cost, business eligibility and final loss allocation. |
| Asaas | Blog states card/boleto anticipation available for fees. | Payment-link/card installment cap, payout/anticipation contract, reserve/recourse, pricing and eligibility for cross-border ownership. |

## Source Quality

- **High:** Mercado Pago and Pagar.me developer documentation. These are primary
  implementation sources and establish product/API behavior, but not negotiated
  credit underwriting or legal risk allocation.
- **Medium:** PagBank, Asaas, and Koin first-party product/blog pages. They are
  useful evidence of advertised features but are sales/editorial content, not
  contract terms or fee tables.
- **Not sufficient for loss allocation:** none of the reviewed pages is the
  merchant acquiring agreement, financing agreement, schedule of fees/reserves,
  or consumer-credit terms applicable to NexOS. Do not infer “financier bears
  default” from “merchant receives upfront.”

## Gaps

1. No official public document reviewed proves Asaas, PagBank, Mercado Pago, or
   Pagar.me offers **18–24 installments** for this specific service category.
2. No reviewed contract states whether NexOS, the acquirer, a bank/FIDC, or
   Koin bears each kind of loss: borrower nonpayment, card fraud, chargeback,
   consumer cancellation/refund, service non-delivery, and provider insolvency.
3. Exact merchant discount rate, buyer interest/CET, settlement cadence,
   anticipation fee, reserve/holdback, minimum volume, and approval rate are
   private/account-specific commercial terms.
4. Public pages do not resolve whether an Australian parent can contract
   directly, whether a Brazilian CNPJ/local bank account is mandatory, or the
   tax, FX, consumer-law, and invoicing structure. Brazilian counsel and each
   provider's onboarding/compliance team should review this before launch.

## Sources

Fetched 7 September 2026. Saved copies preserve the pages reviewed.

1. Pagar.me (Stone), **Link de Pagamento** (official developer docs), undated.
   https://docs.pagar.me/reference/checkout-link.md  
   Saved: `research/sources/01-pagarme-link-checkout.md`
2. Pagar.me (Stone), **Simulando uma Antecipação Spot** (official developer
   docs), undated. https://docs.pagar.me/reference/simulando-uma-antecipação-spot.md  
   Saved: `research/sources/02-pagarme-spot-anticipation.md`
3. Pagar.me (Stone), **Disputas** (official developer docs), undated.
   https://docs.pagar.me/reference/disputas.md  
   Saved: `research/sources/03-pagarme-chargebacks.md`
4. Mercado Pago, **Installments without card / Linha de Crédito** (official
   developer docs), undated.
   https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/integration-configuration/installments-without-card.md  
   Saved: `research/sources/04-mercadopago-mercado-credito-installments.md`
5. Mercado Pago, **How to manage and prevent chargebacks** (official developer
   docs), undated.
   https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/additional-content/chargebacks/introduction.md  
   Saved: `research/sources/05-mercadopago-chargeback-management.md`
6. PagBank, **Link de Pagamento PagBank: conheça a solução de venda online**
   (first-party blog), undated.
   https://blog.pagbank.com.br/link-de-pagamento-pagbank/  
   Saved: `research/sources/06-pagbank-payment-link.md`
7. Asaas, **O que é antecipação de recebíveis? Veja como funciona**
   (first-party blog), undated.
   https://blog.asaas.com/plataforma-de-antecipacao-de-recebiveis/  
   Saved: `research/sources/07-asaas-receivables-anticipation.md`
8. Koin, **Pix Parcelado** (first-party product page), undated.
   https://www.koin.com.br/pix-parcelado  
   Saved: `research/sources/09-koin-pix-installments.md`

## Search record

Five Portuguese/English searches were submitted through the requested
`webSearch` callback for Asaas, Mercado Pago, PagBank, Pagar.me/Stone, and the
generic Brazil 24x/receivables/default question. The callback returned HTTP 401
Unauthorized in this environment, so result snippets were not used. Sources
above were then discovered/fetched directly from official public documentation.