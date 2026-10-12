/** Built-in PDF fonts cannot encode emoji or arbitrary Unicode glyphs. */
export function pdfText(text: string): string {
  return text.normalize("NFC")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...").replace(/[\u2022\u25B8\u25BA\u25C6]/g, "-")
    .replace(/\u2192/g, " -> ").replace(/\u2190/g, " <- ")
    .replace(/\u2264/g, "<=").replace(/\u2265/g, ">=")
    .replace(/\u00A0/g, " ")
    .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/gu, "");
}
