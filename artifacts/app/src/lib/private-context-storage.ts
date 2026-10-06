/** Remove private browser remnants when an account or workspace changes. */
export function clearPrivateContextStorage(storage: Pick<Storage, "length" | "key" | "removeItem">): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (key && ["nexos-chat-", "nexos_intake_draft_", "nexos:chatComplete:"].some(prefix => key.startsWith(prefix))) {
      storage.removeItem(key);
    }
  }
}
