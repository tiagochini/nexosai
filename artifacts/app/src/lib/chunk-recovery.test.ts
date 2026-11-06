import assert from "node:assert/strict";
import { test } from "node:test";
import { isChunkLoadError, recoverChunkLoad } from "./chunk-recovery";

test("stale chunks reload once per entry version, including after recovery", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  let reloads = 0;
  const reload = () => { reloads++; };
  const error = new TypeError("Failed to fetch dynamically imported module: /assets/login-old.js");
  assert.equal(recoverChunkLoad(error, "entry-v1.js", storage, reload), true);
  assert.equal(recoverChunkLoad(error, "entry-v1.js", storage, reload), false);
  assert.equal(recoverChunkLoad(new Error("Invalid password"), "entry-v2.js", storage, reload), false);
  assert.equal(recoverChunkLoad(error, "entry-v2.js", storage, reload), true);
  assert.equal(reloads, 2);
});

test("blocked storage leaves the fallback available without a reload loop", () => {
  const storage = {
    getItem: () => { throw new Error("Storage disabled"); },
    setItem: () => { throw new Error("Storage disabled"); },
  };
  assert.equal(recoverChunkLoad(new Error("Importing a module script failed."), "v1", storage,
    () => assert.fail("must not reload without a persistent marker")), false);
});

test("recognizes browser import failures and Vite CSS failures only", () => {
  for (const message of ["Importing a module script failed.", "error loading dynamically imported module", "Unable to preload CSS for /assets/login.css"]) {
    assert.equal(isChunkLoadError(new Error(message)), true);
  }
  assert.equal(isChunkLoadError(new Error("Failed to fetch")), false);
  assert.equal(isChunkLoadError(undefined), false);
});
