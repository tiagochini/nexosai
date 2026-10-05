import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Preserve the existing 4-4-4 format. Every character is sampled uniformly
// from a 32-character alphabet using the operating system's CSPRNG.
export function generateAccessToken(): string {
  const characters = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]!);
  return [characters.slice(0, 4), characters.slice(4, 8), characters.slice(8, 12)]
    .map((group) => group.join("")).join("-");
}
