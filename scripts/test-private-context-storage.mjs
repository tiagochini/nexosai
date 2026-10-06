import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../artifacts/app/src/lib/private-context-storage.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const exports = {};
new Function('exports', compiled.outputText)(exports);
test('account/workspace change removes legacy and scoped private context while preserving preferences', () => {
  const values = new Map([
    ['nexos-chat-command', 'old user context'],
    ['nexos-chat-v2:user-a:workspace-a:strategy:project-a', 'private project'],
    ['nexos_intake_draft_project-a', 'private intake'],
    ['nexos:chatComplete:project-a', '1'],
    ['nexos_mode', 'advanced'],
    ['accessToken', 'fixture'],
  ]);
  const storage = { get length() { return values.size; }, key(index) { return [...values.keys()][index] ?? null; }, removeItem(key) { values.delete(key); } };
  exports.clearPrivateContextStorage(storage);
  assert.deepEqual([...values.keys()], ['nexos_mode', 'accessToken']);
  exports.clearPrivateContextStorage(storage);
  assert.equal(values.size, 2);
});
