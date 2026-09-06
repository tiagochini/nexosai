import { markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

const suffix = process.argv[2];
if (!suffix) throw new Error("Usage: pnpm test:e2e-seed <suffix>");
console.log(JSON.stringify(await seedE2eFixtures(markerFromSuffix(suffix))));