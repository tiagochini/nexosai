import assert from "node:assert/strict";
import test from "node:test";
import { assertLegacyBaselineAllowed } from "./migration-policy.mjs";

const requiredTables = ["users", "workspaces", "campaigns", "plans"];

test("refuses to baseline an empty database", () => {
  assert.throws(
    () => assertLegacyBaselineAllowed({
      allowExistingSchemaBaseline: true,
      requiredTables,
      presentTables: [],
    }),
    /missing core tables/,
  );
});

test("requires explicit authorization for an existing legacy schema", () => {
  assert.throws(
    () => assertLegacyBaselineAllowed({
      allowExistingSchemaBaseline: false,
      requiredTables,
      presentTables: requiredTables,
    }),
    /MIGRATION_BASELINE_EXISTING_SCHEMA=true/,
  );
});

test("accepts an explicitly authorized and verified legacy schema", () => {
  assert.doesNotThrow(() => assertLegacyBaselineAllowed({
    allowExistingSchemaBaseline: true,
    requiredTables,
    presentTables: requiredTables,
  }));
});
