export interface GlossaryTerm {
  id: string;
  term: string;
  category: string;
  definition: string;
  example?: string;
  related?: string[];
  lessonIds?: string[];
}

export const GLOSSARY_CATEGORIES = [
  "Lançamentos",
  "Meta Ads & Tráfego Pago",
  "Algoritmos & Plataformas",
  "Copywriting & Persuasão",
  "Email & WhatsApp Marketing",
  "Analytics & Métricas",
  "Monetização & Funis",
  "Automação & Ferramentas",
  "Negócio & Estratégia",
  "SEO & Busca Orgânica",
];

export const GLOSSARY: GlossaryTerm[] = [];
export function setPaidglossary(entries: GlossaryTerm[]) { GLOSSARY.splice(0, GLOSSARY.length, ...entries); }
