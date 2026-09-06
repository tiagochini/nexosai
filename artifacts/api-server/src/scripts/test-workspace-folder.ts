import assert from "node:assert/strict";
import {
  collisionSafeFilename,
  createWorkspaceDirectory,
  requestWorkspaceFolderPermission,
  sanitizeFolderSegment,
  saveWorkspaceFile,
  workspaceFolderKey,
  workspaceFolderName,
  type AuthorizedDirectoryHandle,
} from "../../../video-editor/src/lib/workspace-folder.js";

const workspaceA = { id: "workspace-123456789", name: "Cliente: São Paulo/BR" };
const workspaceB = { id: "workspace-987654321", name: "Cliente: São Paulo/BR" };

assert.equal(sanitizeFolderSegment(workspaceA.name), "Cliente- Sao Paulo-BR");
assert.notEqual(workspaceFolderName(workspaceA), workspaceFolderName(workspaceB));
assert.notEqual(
  workspaceFolderKey(workspaceA.id, "https://nexos.example"),
  workspaceFolderKey(workspaceB.id, "https://nexos.example"),
);

const hierarchy: string[] = [];
const writableEvents: string[] = [];
const writable = {
  async write(blob: Blob) { writableEvents.push(`write:${blob.size}`); },
  async close() { writableEvents.push("close"); },
};
const workspaceHandle = {
  async queryPermission() { return "granted" as PermissionState; },
  async requestPermission() { return "granted" as PermissionState; },
  async getFileHandle(name: string) {
    hierarchy.push(`file:${name}`);
    return { async createWritable() { return writable; } };
  },
  async getDirectoryHandle() { throw new Error("unexpected nested directory"); },
} as unknown as AuthorizedDirectoryHandle;
const nexosHandle = {
  async getDirectoryHandle(name: string, options: { create: boolean }) {
    hierarchy.push(`${name}:${options.create}`);
    return workspaceHandle;
  },
} as unknown as AuthorizedDirectoryHandle;
const baseHandle = {
  async getDirectoryHandle(name: string, options: { create: boolean }) {
    hierarchy.push(`${name}:${options.create}`);
    return nexosHandle;
  },
} as unknown as AuthorizedDirectoryHandle;

assert.equal(await createWorkspaceDirectory(baseHandle, workspaceA), workspaceHandle);
assert.deepEqual(hierarchy.slice(0, 2), ["NexOS:true", `${workspaceFolderName(workspaceA)}:true`]);
assert.equal(await requestWorkspaceFolderPermission(workspaceHandle), "connected");

const blob = new Blob(["nexos"]);
const saved = await saveWorkspaceFile(blob, "projeto editável.nexosvideo", workspaceA, workspaceHandle);
assert.equal(saved.verified, true);
assert.equal(saved.size, 5);
assert.ok(saved.filename.endsWith(".nexosvideo"));
assert.deepEqual(writableEvents, ["write:5", "close"]);

let fallbackCalled = false;
const deniedHandle = {
  async queryPermission() { return "denied" as PermissionState; },
} as unknown as AuthorizedDirectoryHandle;
const fallback = await saveWorkspaceFile(blob, "final.mp4", workspaceA, deniedHandle, (_file, name) => {
  fallbackCalled = name.endsWith(".mp4");
});
assert.equal(fallback.verified, false);
assert.equal(fallbackCalled, true);
assert.match(fallback.fallbackMessage ?? "", /não foi verificada/i);
assert.match(collisionSafeFilename("final.mp4"), /^final-\d+-[a-z0-9]+\.mp4$/i);

console.log("workspace device folder test passed");