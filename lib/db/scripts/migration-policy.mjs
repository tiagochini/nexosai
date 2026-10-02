export function assertLegacyBaselineAllowed({
  allowExistingSchemaBaseline,
  requiredTables,
  presentTables,
}) {
  const present = new Set(presentTables);
  const missingTables = requiredTables.filter((table) => !present.has(table));

  if (missingTables.length > 0) {
    throw new Error(
      `Refusing migration baseline: database is missing core tables: ${missingTables.join(", ")}. ` +
      "Restore or bootstrap the legacy base schema before applying tracked incremental migrations.",
    );
  }
  if (!allowExistingSchemaBaseline) {
    throw new Error(
      "Existing legacy schema detected but migration history is empty. " +
      "After verifying the schema and backup, rerun once with " +
      "MIGRATION_BASELINE_EXISTING_SCHEMA=true.",
    );
  }
}
