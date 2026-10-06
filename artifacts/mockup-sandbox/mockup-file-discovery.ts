import { readdir } from "node:fs/promises";
import path from "node:path";

/** Discover preview files without parsing globs or following directory symlinks. */
export async function discoverMockupFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(relative: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(path.join(root, relative), { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
      const next = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) await visit(next);
      else if (entry.isFile() && entry.name.endsWith(".tsx")) files.push(next);
    }
  }
  await visit("src/components/mockups");
  return files.sort();
}
