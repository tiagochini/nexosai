import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { discoverMockupFiles } from "../artifacts/mockup-sandbox/mockup-file-discovery.ts";

test("preview discovery preserves nested files and excludes hidden/private targets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nexos-mockup-discovery-"));
  try {
    for (const file of ["Visible.tsx", "nested/Second.tsx", "_Private.tsx", "_folder/Hidden.tsx", ".hidden/Hidden.tsx", "nested/.Hidden.tsx", "Ignore.ts"]) {
      const target = path.join(root, "src/components/mockups", file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, "");
    }
    assert.deepEqual(await discoverMockupFiles(root), [
      "src/components/mockups/Visible.tsx",
      "src/components/mockups/nested/Second.tsx",
    ]);
  } finally {
    // Only remove the exact fixture directory created by mkdtemp above.
    await rm(root, { recursive: true, force: true });
  }
});

test("a missing mockup directory yields an empty preview inventory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nexos-mockup-empty-"));
  try {
    assert.deepEqual(await discoverMockupFiles(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
