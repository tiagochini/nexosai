import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { open, writeFile, appendFile, stat, unlink, link } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
// Backup transport encryption. Keys remain separate from database/integration keys.
export async function encryptBackup(input, output, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('A 32-byte backup key is required');
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
  const header = Buffer.from('NEXOSBACKUP1'); cipher.setAAD(header);
  await writeFile(output, Buffer.concat([header, nonce]), { mode: 0o600, flag: 'wx' });
  try {
    await pipeline(createReadStream(input), cipher, createWriteStream(output, { flags: 'a' }));
    await appendFile(output, cipher.getAuthTag());
    const hash = createHash('sha256'); for await (const chunk of createReadStream(output)) hash.update(chunk);
    return { bytes: (await stat(output)).size, sha256: hash.digest('hex') };
  } catch (err) { await unlink(output).catch(() => {}); throw err; }
}
export async function decryptBackup(input, output, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('A 32-byte backup key is required');
  const header = Buffer.from('NEXOSBACKUP1'), size = (await stat(input)).size;
  if (size < header.length + 28) throw new Error('Invalid backup');
  const file = await open(input, 'r'), prefix = Buffer.alloc(header.length + 12), tag = Buffer.alloc(16);
  try { await file.read(prefix, 0, prefix.length, 0); await file.read(tag, 0, 16, size - 16); } finally { await file.close(); }
  if (!prefix.subarray(0, header.length).equals(header)) throw new Error('Invalid backup');
  const decipher = createDecipheriv('aes-256-gcm', key, prefix.subarray(header.length));
  decipher.setAAD(header); decipher.setAuthTag(tag);
  const temporary = `${output}.${randomBytes(8).toString('hex')}.partial`;
  try {
    const ciphertext = size === prefix.length + 16 ? Readable.from([]) : createReadStream(input, { start: prefix.length, end: size - 17 });
    await pipeline(ciphertext, decipher, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
    // Publish only authenticated bytes, without overwriting an existing target.
    await link(temporary, output);
  } finally { await unlink(temporary).catch(() => {}); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, input, output, keyFile] = process.argv.slice(2);
  if (!['encrypt', 'decrypt'].includes(mode) || !input || !output || !keyFile) throw new Error('Usage: backup-crypto.mjs encrypt|decrypt input output external-32-byte-key-file');
  const file = await open(keyFile, 'r'); let key;
  try { key = await file.readFile(); } finally { await file.close(); }
  try {
    if (mode === 'encrypt') console.log(JSON.stringify(await encryptBackup(input, output, key)));
    else { await decryptBackup(input, output, key); console.log('Backup authenticated and decrypted'); }
  } finally { key.fill(0); }
}
