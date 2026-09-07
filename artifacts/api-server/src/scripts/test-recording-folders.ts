import assert from "node:assert/strict";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";
import {
  ProtectedRecordingFolderError,
  RecordingFolderNotFoundError,
  createFolder,
  deleteFolder,
  ensureSystemRecordingFolder,
  listFolders,
  listRecordings,
  recordingResponse,
  renameFolder,
  startRecording,
  stopRecording,
} from "../modules/recording/recording.service.js";

const marker = markerFromSuffix(`recording_folders_${process.pid}`);
const fixture = await seedE2eFixtures(marker);
const [workspaceId, foreignWorkspaceId] = fixture.workspaces;
if (!workspaceId || !foreignWorkspaceId) throw new Error("fixture workspaces missing");

try {
  // A newly-created workspace has no folder rows, but the library always shows both defaults.
  const folders = await listFolders(workspaceId);
  assert.equal(folders.filter((folder) => folder.isSystem).length, 2);
  assert.equal(folders.filter((folder) => folder.systemType === "automatic").length, 1);
  assert.equal(folders.filter((folder) => folder.systemType === "manual").length, 1);

  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () => ensureSystemRecordingFolder(workspaceId, "automatic")),
  );
  assert.equal(new Set(concurrent.map((folder) => folder.id)).size, 1);

  const recording = await startRecording(workspaceId, `${marker} recording`);
  const withoutVideo = recordingResponse(recording);
  assert.equal(withoutVideo.hasVideo, false);
  assert.equal(withoutVideo.videoUrl, null);
  assert.equal("videoPath" in withoutVideo, false);

  const withVideo = recordingResponse({ ...recording, videoPath: "recordings/private-key.webm" });
  assert.equal(withVideo.hasVideo, true);
  assert.equal(withVideo.videoUrl, `/api/recordings/${recording.id}/video`);
  assert.equal(JSON.stringify(withVideo).includes("private-key.webm"), false);

  const custom = await createFolder(workspaceId, `${marker} custom`);
  const renamed = await renameFolder(custom.id, workspaceId, `${marker} renamed`);
  assert.equal(renamed?.name, `${marker} renamed`);
  const automatic = await startRecording(workspaceId, `${marker} automatic`, {
    recordingMode: "automatic",
    folderId: custom.id,
  });
  const manual = await startRecording(workspaceId, `${marker} manual`, {
    recordingMode: "manual",
    folderId: custom.id,
  });
  assert.equal(automatic.folderId, custom.id);
  assert.equal(manual.folderId, custom.id);

  const automaticFolder = await ensureSystemRecordingFolder(workspaceId, "automatic");
  const manualFolder = await ensureSystemRecordingFolder(workspaceId, "manual");
  await assert.rejects(
    () => renameFolder(automaticFolder.id, workspaceId, "cannot rename"),
    ProtectedRecordingFolderError,
  );
  await assert.rejects(
    () => deleteFolder(manualFolder.id, workspaceId),
    ProtectedRecordingFolderError,
  );

  // Deleting a custom folder preserves recordings by moving each mode to its matching default.
  assert.equal(await deleteFolder(custom.id, workspaceId), true);
  assert.equal((await listRecordings(workspaceId, automaticFolder.id)).some((row) => row.id === automatic.id), true);
  assert.equal((await listRecordings(workspaceId, manualFolder.id)).some((row) => row.id === manual.id), true);

  const foreignFolder = await ensureSystemRecordingFolder(foreignWorkspaceId, "manual");
  await assert.rejects(
    () => startRecording(workspaceId, `${marker} denied`, { folderId: foreignFolder.id }),
    RecordingFolderNotFoundError,
  );
  await assert.rejects(
    () => listRecordings(workspaceId, foreignFolder.id),
    RecordingFolderNotFoundError,
  );
  assert.equal(await renameFolder(foreignFolder.id, workspaceId, "denied"), null);
  assert.equal(await deleteFolder(foreignFolder.id, workspaceId), false);

  const stopped = await stopRecording(manual.id, workspaceId);
  const stoppedAgain = await stopRecording(manual.id, workspaceId);
  assert.equal(stopped?.id, manual.id);
  assert.equal(stoppedAgain?.id, manual.id);
  assert.equal(stoppedAgain?.state, "stopped");
} finally {
  await cleanupE2eFixtures(fixture);
}

console.log("recording folder regression test passed");