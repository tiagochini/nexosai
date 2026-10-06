export interface BibliographyEntry {
  id: string;
  title: string;
  author: string;
  year: number;
  publisher: string;
  language: "pt" | "en" | "both";
  difficulty: 1 | 2 | 3;
  why: string;
  topics: string[];
  amazonBr?: string;
}

export const BIBLIOGRAPHY: BibliographyEntry[] = [];
export function setPaidbibliography(entries: BibliographyEntry[]) { BIBLIOGRAPHY.splice(0, BIBLIOGRAPHY.length, ...entries); }
export function getBibliographyForLesson(lessonId: string): BibliographyEntry[] {
  return BIBLIOGRAPHY.filter(b => b.topics.includes(lessonId));
}

export const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Leitura Acessível",
  2: "Intermediário",
  3: "Denso / Técnico",
};

export const DIFFICULTY_COLOR: Record<number, string> = {
  1: "hsl(168 100% 42%)",
  2: "hsl(45 100% 55%)",
  3: "hsl(10 100% 60%)",
};
