# Meta E2E harness

Start the API workflow with `NODE_ENV=test META_E2E_TEST_MODE=true`. This
enables only the in-memory Graph transport fake; it is rejected at production
startup. The testing agent can inspect/reset calls through the exported
`meta-graph.transport` helpers in the running process, and must use normal
authenticated product routes for every webhook flow.

`pnpm test:e2e-seed <suffix>` creates `E2E_<suffix>` fixtures and prints a
non-secret manifest. The test-owner password is the deterministic test-only
value returned by `e2eFixturePassword(markerFromSuffix(suffix))`: exactly
`E2E-E2E_<suffix>-Only!`. It is deliberately never written to the manifest or
normal server logs. Run `pnpm test:e2e-cleanup <manifest.json|suffix>`
immediately afterwards.