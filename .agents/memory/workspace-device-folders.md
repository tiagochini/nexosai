---
name: Workspace Device Folders
description: Browser permission and identity contract for saving each workspace to a remembered local folder.
---

Each device may remember a user-authorized folder for each authoritative NexOS
workspace. The folder hierarchy is `NexOS/<readable workspace name>-<stable
full-ID-derived suffix>`, avoiding collisions between workspaces with similar IDs.

**Why:** Browsers cannot silently create or access arbitrary device folders.
File System Access permissions are origin- and device-local, and folder handles
must be stored in IndexedDB rather than localStorage. Starting a fallback browser
download does not prove the operating system saved the file.

**How to apply:** Resolve workspace identity through authenticated server data,
never token decoding. Ask once from a direct user gesture, remember the handle,
query permission on later sessions, and offer change/forget controls. Treat
`createWritable().close()` as verified local writing; otherwise use download/share
fallback without claiming success. PC/mobile mirroring requires the user to select
a provider-synced folder on each supported device; NexOS does not silently sync or
retain an extra cloud copy.