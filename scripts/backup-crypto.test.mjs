import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm, stat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encryptBackup, decryptBackup } from './backup-crypto.mjs';

test('backup encryption authenticates empty and multi-chunk files without overwriting targets', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nexos-backup-test-'));
  try {
    const key = randomBytes(32);
    for (const size of [0, 1, 200_000]) {
      const input = path.join(directory, `input-${size}`), encrypted = `${input}.enc`, output = `${input}.restored`;
      const bytes = randomBytes(size); await writeFile(input, bytes);
      await encryptBackup(input, encrypted, key); await decryptBackup(encrypted, output, key);
      assert.deepEqual(await readFile(output), bytes);
      const original = await readFile(encrypted);
      await assert.rejects(encryptBackup(input, encrypted, key), { code: 'EEXIST' });
      await assert.rejects(decryptBackup(encrypted, output, key), { code: 'EEXIST' });
      assert.deepEqual(await readFile(encrypted), original);
      assert.deepEqual(await readFile(output), bytes);
      const rejected = `${input}.rejected`;
      await assert.rejects(decryptBackup(encrypted, rejected, randomBytes(32)));
      await assert.rejects(stat(rejected), { code: 'ENOENT' });
      original[original.length - 1] ^= 1; await writeFile(encrypted, original);
      await assert.rejects(decryptBackup(encrypted, rejected, key));
      await assert.rejects(stat(rejected), { code: 'ENOENT' });
      assert.ok((await readdir(directory)).every(name => !name.endsWith('.partial')));
    }
  } finally {
    // Only the absolute directory created by mkdtemp above is removed.
    await rm(directory, { recursive: true, force: true });
  }
});
