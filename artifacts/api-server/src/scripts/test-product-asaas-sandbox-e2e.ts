/**
 * Real Asaas sandbox checkout verification. This script is intentionally
 * fail-closed: it has no production fallback and never logs sensitive inputs.
 */
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, productsTable, productSalesTable } from "@workspace/db";
import {
  assertAsaasSandboxE2eEnvironment,
  createProduct,
  fetchAsaasPayment,
  getProductCardInstallments,
  getSale,
  initiateProductCheckout,
  reconcileProductSaleFromAsaasWebhook,
} from "../modules/product-checkout/product-checkout.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures, type E2eManifest } from "./e2e-fixtures.js";

type Payment = { id: string; status: string; customer?: string; value?: number; netValue?: number };

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Sandbox E2E requires ${name}; configure it as a secure sandbox test input`);
  return value;
};

const sandbox = assertAsaasSandboxE2eEnvironment();
const card = {
  number: required("ASAAS_SANDBOX_TEST_CARD_NUMBER"),
  holderName: required("ASAAS_SANDBOX_TEST_CARD_HOLDER"),
  expiryMonth: required("ASAAS_SANDBOX_TEST_CARD_EXPIRY_MONTH"),
  expiryYear: required("ASAAS_SANDBOX_TEST_CARD_EXPIRY_YEAR"),
  cvv: required("ASAAS_SANDBOX_TEST_CARD_CVV"),
  cpf: required("ASAAS_SANDBOX_TEST_CPF"),
};
// This is configured separately because webhook authentication is part of E2E.
required("ASAAS_WEBHOOK_TOKEN");

async function asaas(path: string, init: RequestInit = {}): Promise<Payment> {
  const response = await fetch(`${sandbox.base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: sandbox.apiKey, ...init.headers },
  });
  const body = await response.json() as Payment;
  if (!response.ok) throw new Error(`Sandbox provider request failed (${response.status})`);
  return body;
}

async function waitForStatus(id: string, allowed: Set<string>): Promise<Payment> {
  let payment = await fetchAsaasPayment(sandbox.apiKey, sandbox.base, id);
  for (let attempt = 0; attempt < 12 && !allowed.has(payment.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    payment = await fetchAsaasPayment(sandbox.apiKey, sandbox.base, id);
  }
  return payment;
}

let manifest: E2eManifest | undefined;
let productId: string | undefined;
let payment: Payment | undefined;
try {
  manifest = await seedE2eFixtures(markerFromSuffix(`asaas_${process.pid}`));
  const product = await createProduct({
    workspaceId: manifest.workspaces[0]!,
    name: `${manifest.marker} Sandbox product`,
    priceCents: 10_000,
  });
  productId = product.id;

  const options = await getProductCardInstallments(product.id);
  assert.equal(options.length, 21);
  assert.deepEqual(options.map((option) => option.installmentCount), Array.from({ length: 21 }, (_, i) => i + 1));
  for (let index = 1; index < options.length; index += 1) {
    assert.ok(options[index]!.totalCents >= options[index - 1]!.totalCents, "installment totals must be monotonic");
  }
  assert.ok(options[20]!.totalCents >= product.priceCents, "21x option must cover the contracted amount");

  const sale = await initiateProductCheckout({
    productId: product.id,
    buyerName: `${manifest.marker} Buyer`,
    buyerEmail: `${manifest.marker.toLowerCase()}@e2e.invalid`,
    buyerCpf: card.cpf,
    method: "credit_card",
    installmentCount: 21,
    card: { holderName: card.holderName, number: card.number, expiryMonth: card.expiryMonth, expiryYear: card.expiryYear, cvv: card.cvv },
  });
  assert.ok(sale.externalId);
  payment = await fetchAsaasPayment(sandbox.apiKey, sandbox.base, sale.externalId!);
  if (!new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]).has(payment.status)) {
    throw new Error(`Sandbox payment was not immediately settled; provider status: ${payment.status}`);
  }
  await reconcileProductSaleFromAsaasWebhook(sale.externalId!);
  const paid = await getSale(sale.id);
  assert.equal(paid?.status, "paid");
  assert.equal(paid?.amountCents, Math.round((payment.value ?? 0) * 100));
  assert.ok(typeof payment.netValue === "number", "provider must return netValue for reconciliation");
  assert.ok(Math.round(payment.netValue! * 100) <= paid!.amountCents, "provider net value cannot exceed the local charged amount");

  await asaas(`/payments/${encodeURIComponent(payment.id)}/refund`, { method: "POST", body: "{}" });
  const refundedPayment = await waitForStatus(payment.id, new Set(["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"]));
  if (!new Set(["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"]).has(refundedPayment.status)) {
    throw new Error(`Sandbox refund was not confirmed; provider status: ${refundedPayment.status}`);
  }
  await reconcileProductSaleFromAsaasWebhook(payment.id);
  assert.equal((await getSale(sale.id))?.status, "refunded");
  console.log("Asaas sandbox product checkout E2E passed");
} finally {
  // Deleting a sandbox customer is best-effort; provider may retain paid history.
  if (payment?.customer) await fetch(`${sandbox.base}/customers/${encodeURIComponent(payment.customer)}`, { method: "DELETE", headers: { access_token: sandbox.apiKey } }).catch(() => undefined);
  if (productId) await db.delete(productSalesTable).where(eq(productSalesTable.productId, productId));
  if (productId && manifest) await db.delete(productsTable).where(and(eq(productsTable.id, productId), eq(productsTable.workspaceId, manifest.workspaces[0]!)));
  if (manifest) await cleanupE2eFixtures(manifest);
}