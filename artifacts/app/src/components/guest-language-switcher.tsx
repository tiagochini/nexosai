import { useUiLocale, type Lang } from "@/lib/i18n";

const LANGUAGES: { locale: Lang; label: string; short: string }[] = [
  { locale: "pt-BR", label: "Português", short: "PT" },
  { locale: "en-US", label: "English", short: "EN" },
  { locale: "es-LA", label: "Español", short: "ES" },
];

export function GuestLanguageSwitcher() {
  const { locale, setGuestLocale } = useUiLocale();

  return (
    <div className="flex items-center justify-center gap-1" role="group" aria-label="Language / Idioma">
      {LANGUAGES.map((option) => (
        <button
          key={option.locale}
          type="button"
          data-testid={`button-language-${option.short.toLowerCase()}`}
          title={option.label}
          aria-label={option.label}
          aria-pressed={locale === option.locale}
          onClick={() => setGuestLocale(option.locale)}
          className={`px-2 py-1 font-mono text-xs border transition-colors ${
            locale === option.locale
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}