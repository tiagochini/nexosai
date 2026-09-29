import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "pt-BR" | "en-US" | "en-AU" | "es-LA";

export const APP_TRANSLATIONS = {
  "pt-BR": {
    nav: {
      main: "Sistemas Principais",
      agent_team: "Time do agente",
      tools: "Ferramentas",
      growth: "Crescimento",
      automations: "Automações",
      account: "Conta",
      mode: "Modo de Uso",
    },
    sidebar: {
      dashboard: "Dashboard",
      campaigns: "Campanhas",
      agents: "Especialistas",
      vsl: "VSL Studio",
      video: "Editor de Vídeo",
      social: "Social Media",
      moderation: "Moderação Bot",
      sequences: "Sequências",
      revenue: "Receita",
      compliance: "Compliance",
      site_builder: "Construtor de Sites",
      clients: "Clientes",
      profiles: "Perfis de Cliente",
      affiliates: "Afiliados",
      products: "Produtos",
      integrations: "Integrações",
      credits: "Créditos do agente",
      memory: "Memória do agente",
      billing: "Plano & Fatura",
      settings: "Configurações",
      admin: "Admin SaaS",
      operations: "Operações Inteligentes",
    },
    mode: {
      beginner: "Individual",
      advanced: "Agency",
      beginner_desc: "Menu simplificado · foco no seu lançamento",
      advanced_desc: "Gestão de múltiplos clientes e campanhas",
    },
    credits: {
      label: "Créditos",
      low: "Créditos baixos!",
    },
    user: {
      settings: "Configurações",
      credits: "Créditos do agente",
      ai_language: "Idioma do agente",
      logout: "Sair da Plataforma",
      default_name: "Usuário",
    },
    login: {
      tagline: "Automated Launch",
      email_label: "Identificação (Email)",
      password_label: "Código de Acesso (Senha)",
      show_password: "Revelar senha",
      hide_password: "Ocultar senha",
      submit: "Iniciar Sessão",
      submitting: "Autenticando...",
      no_account: "Solicitar novo acesso?",
      register: "Registrar-se",
      success: "Acesso autorizado.",
      error: "Acesso negado. Verifique as credenciais.",
    },
    register: {
      tagline: "Automated Launch",
      title: "Criar Acesso",
      subtitle: "Junte-se à plataforma de automação de lançamentos",
      name_label: "Nome completo",
      name_ph: "Seu nome completo",
      email_label: "Email",
      email_ph: "seu@email.com",
      email_confirm_label: "Confirmar email",
      email_confirm_ph: "Repita o email",
      phone_label: "WhatsApp (opcional)",
      phone_ph: "(11) 99999-9999",
      phone_confirm_label: "Confirmar WhatsApp",
      phone_confirm_ph: "Repita o número",
      password_label: "Senha de acesso",
      password_ph: "Mínimo 8 caracteres",
      password_confirm_label: "Confirmar senha",
      password_confirm_ph: "Repita a senha",
      plan_label: "Plano de acesso",
      plan_solo: "Solo — 3 campanhas / 900 créditos incluídos",
      plan_agency: "Agency — 10 campanhas / 2.000 créditos incluídos",
      submit: "Criar meu acesso",
      submitting: "Criando acesso...",
      have_account: "Já tem acesso?",
      login_link: "Entrar",
      match_ok: "Confirmado",
      match_err: "Não confere",
      weak_pass: "Mínimo 8 caracteres",
      strong_pass: "Senha válida",
      success: "Conta criada com sucesso!",
      error: "Falha ao criar acesso. Email pode já estar em uso.",
    },
  },

  "en-US": {
    nav: {
      main: "Core Systems",
      agent_team: "Agent Team",
      tools: "Tools",
      growth: "Growth",
      automations: "Automations",
      account: "Account",
      mode: "Usage Mode",
    },
    sidebar: {
      dashboard: "Dashboard",
      campaigns: "Campaigns",
      agents: "Specialists",
      vsl: "VSL Studio",
      video: "Video Editor",
      social: "Social Media",
      moderation: "Moderation Bot",
      sequences: "Sequences",
      revenue: "Revenue",
      compliance: "Compliance",
      site_builder: "Site Builder",
      clients: "Clients",
      profiles: "Client Profiles",
      affiliates: "Affiliates",
      products: "Products",
      integrations: "Integrations",
      credits: "Agent Credits",
      memory: "Agent Memory",
      billing: "Plan & Billing",
      settings: "Settings",
      admin: "Admin SaaS",
      operations: "Smart Operations",
    },
    mode: {
      beginner: "Individual",
      advanced: "Agency",
      beginner_desc: "Simplified menu · your launch focus",
      advanced_desc: "Manage multiple clients and campaigns",
    },
    credits: {
      label: "Credits",
      low: "Low credits!",
    },
    user: {
      settings: "Settings",
      credits: "Agent Credits",
      ai_language: "Platform language",
      logout: "Sign Out",
      default_name: "User",
    },
    login: {
      tagline: "Automated Launch",
      email_label: "Email Address",
      password_label: "Password",
      show_password: "Show password",
      hide_password: "Hide password",
      submit: "Sign In",
      submitting: "Authenticating...",
      no_account: "Need access?",
      register: "Create account",
      success: "Access granted.",
      error: "Access denied. Please check your credentials.",
    },
    register: {
      tagline: "Automated Launch",
      title: "Create Account",
      subtitle: "Join the launch automation platform",
      name_label: "Full name",
      name_ph: "Your full name",
      email_label: "Email",
      email_ph: "your@email.com",
      email_confirm_label: "Confirm email",
      email_confirm_ph: "Repeat email",
      phone_label: "WhatsApp (optional)",
      phone_ph: "+1 (555) 999-9999",
      phone_confirm_label: "Confirm WhatsApp",
      phone_confirm_ph: "Repeat number",
      password_label: "Password",
      password_ph: "Minimum 8 characters",
      password_confirm_label: "Confirm password",
      password_confirm_ph: "Repeat password",
      plan_label: "Access plan",
      plan_solo: "Solo — 3 campaigns / 900 credits included",
      plan_agency: "Agency — 10 campaigns / 2,000 credits included",
      submit: "Create my account",
      submitting: "Creating account...",
      have_account: "Already have access?",
      login_link: "Sign in",
      match_ok: "Confirmed",
      match_err: "Does not match",
      weak_pass: "Minimum 8 characters",
      strong_pass: "Password valid",
      success: "Account created successfully!",
      error: "Failed to create account. Email may already be in use.",
    },
  },

  "en-AU": {
    nav: {
      main: "Core Systems",
      agent_team: "Agent Team",
      tools: "Tools",
      growth: "Growth",
      automations: "Automations",
      account: "Account",
      mode: "Usage Mode",
    },
    sidebar: {
      dashboard: "Dashboard",
      campaigns: "Campaigns",
      agents: "Specialists",
      vsl: "VSL Studio",
      video: "Video Editor",
      social: "Social Media",
      moderation: "Moderation Bot",
      sequences: "Sequences",
      revenue: "Revenue",
      compliance: "Compliance",
      site_builder: "Site Builder",
      clients: "Clients",
      profiles: "Client Profiles",
      affiliates: "Affiliates",
      products: "Products",
      integrations: "Integrations",
      credits: "Agent Credits",
      memory: "Agent Memory",
      billing: "Plan & Billing",
      settings: "Settings",
      admin: "Admin SaaS",
      operations: "Smart Operations",
    },
    mode: {
      beginner: "Individual",
      advanced: "Agency",
      beginner_desc: "Simplified menu · your launch focus",
      advanced_desc: "Manage multiple clients and campaigns",
    },
    credits: {
      label: "Credits",
      low: "Low credits!",
    },
    user: {
      settings: "Settings",
      credits: "Agent Credits",
      ai_language: "Platform language",
      logout: "Sign Out",
      default_name: "User",
    },
    login: {
      tagline: "Automated Launch",
      email_label: "Email Address",
      password_label: "Password",
      show_password: "Show password",
      hide_password: "Hide password",
      submit: "Sign In",
      submitting: "Authenticating...",
      no_account: "Need access?",
      register: "Create account",
      success: "Access granted.",
      error: "Access denied. Please check your credentials.",
    },
    register: {
      tagline: "Automated Launch",
      title: "Create Account",
      subtitle: "Join the launch automation platform",
      name_label: "Full name",
      name_ph: "Your full name",
      email_label: "Email",
      email_ph: "your@email.com",
      email_confirm_label: "Confirm email",
      email_confirm_ph: "Repeat email",
      phone_label: "WhatsApp (optional)",
      phone_ph: "+61 4XX XXX XXX",
      phone_confirm_label: "Confirm WhatsApp",
      phone_confirm_ph: "Repeat number",
      password_label: "Password",
      password_ph: "Minimum 8 characters",
      password_confirm_label: "Confirm password",
      password_confirm_ph: "Repeat password",
      plan_label: "Access plan",
      plan_solo: "Solo — 3 campaigns / 900 credits included",
      plan_agency: "Agency — 10 campaigns / 2,000 credits included",
      submit: "Create my account",
      submitting: "Creating account...",
      have_account: "Already have access?",
      login_link: "Sign in",
      match_ok: "Confirmed",
      match_err: "Does not match",
      weak_pass: "Minimum 8 characters",
      strong_pass: "Password valid",
      success: "Account created successfully!",
      error: "Failed to create account. Email may already be in use.",
    },
  },

  "es-LA": {
    nav: {
      main: "Sistemas Principales",
      agent_team: "Equipo de agentes",
      tools: "Herramientas",
      growth: "Crecimiento",
      automations: "Automatizaciones",
      account: "Cuenta",
      mode: "Modo de Uso",
    },
    sidebar: {
      dashboard: "Panel",
      campaigns: "Campañas",
      agents: "Especialistas",
      vsl: "VSL Studio",
      video: "Editor de Video",
      social: "Social Media",
      moderation: "Bot de Moderación",
      sequences: "Secuencias",
      revenue: "Ingresos",
      compliance: "Compliance",
      site_builder: "Constructor de Sitios",
      clients: "Clientes",
      profiles: "Perfiles de Cliente",
      affiliates: "Afiliados",
      products: "Productos",
      integrations: "Integraciones",
      credits: "Créditos de agentes",
      memory: "Memoria de agentes",
      billing: "Plan y Facturación",
      settings: "Configuración",
      admin: "Admin SaaS",
      operations: "Operaciones Inteligentes",
    },
    mode: {
      beginner: "Individual",
      advanced: "Agency",
      beginner_desc: "Menú simplificado · enfoque en tu lanzamiento",
      advanced_desc: "Gestión de múltiples clientes y campañas",
    },
    credits: {
      label: "Créditos",
      low: "¡Créditos bajos!",
    },
    user: {
      settings: "Configuración",
      credits: "Créditos de agentes",
      ai_language: "Idioma de la plataforma",
      logout: "Cerrar Sesión",
      default_name: "Usuario",
    },
    login: {
      tagline: "Lanzamiento Automatizado",
      email_label: "Correo electrónico",
      password_label: "Contraseña",
      show_password: "Mostrar contraseña",
      hide_password: "Ocultar contraseña",
      submit: "Iniciar Sesión",
      submitting: "Autenticando...",
      no_account: "¿Necesitas acceso?",
      register: "Crear cuenta",
      success: "Acceso concedido.",
      error: "Acceso denegado. Verifica tus credenciales.",
    },
    register: {
      tagline: "Lanzamiento Automatizado",
      title: "Crear Cuenta",
      subtitle: "Únete a la plataforma de automatización de lanzamientos",
      name_label: "Nombre completo",
      name_ph: "Tu nombre completo",
      email_label: "Correo electrónico",
      email_ph: "tu@correo.com",
      email_confirm_label: "Confirmar correo",
      email_confirm_ph: "Repite el correo",
      phone_label: "WhatsApp (opcional)",
      phone_ph: "+52 55 9999-9999",
      phone_confirm_label: "Confirmar WhatsApp",
      phone_confirm_ph: "Repite el número",
      password_label: "Contraseña",
      password_ph: "Mínimo 8 caracteres",
      password_confirm_label: "Confirmar contraseña",
      password_confirm_ph: "Repite la contraseña",
      plan_label: "Plan de acceso",
      plan_solo: "Solo — 3 campañas / 900 créditos incluidos",
      plan_agency: "Agency — 10 campañas / 2,000 créditos incluidos",
      submit: "Crear mi cuenta",
      submitting: "Creando cuenta...",
      have_account: "¿Ya tienes acceso?",
      login_link: "Entrar",
      match_ok: "Confirmado",
      match_err: "No coincide",
      weak_pass: "Mínimo 8 caracteres",
      strong_pass: "Contraseña válida",
      success: "¡Cuenta creada con éxito!",
      error: "Error al crear cuenta. El correo puede estar en uso.",
    },
  },
} as const;

export type AppTranslations = typeof APP_TRANSLATIONS["pt-BR"];

const I18nContext = createContext<AppTranslations>(APP_TRANSLATIONS["pt-BR"]);
const LOCALE_STORAGE_KEY = "nexos.ui-locale";

function isLang(value: string | undefined): value is Lang {
  return value === "pt-BR" || value === "en-US" || value === "en-AU" || value === "es-LA";
}

function storedLocale(): Lang {
  if (typeof window === "undefined") return "pt-BR";
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY) ?? undefined;
    return isLang(value) ? value : "pt-BR";
  } catch {
    return "pt-BR";
  }
}

const LocaleContext = createContext<{ locale: Lang; setGuestLocale: (locale: Lang) => void }>({
  locale: "pt-BR",
  setGuestLocale: () => {},
});

export function useAppI18n() {
  return useContext(I18nContext);
}

export function useUiLocale() {
  return useContext(LocaleContext);
}

/** Inline translations for screens that are being migrated from hard-coded UI copy. */
export function useUiText() {
  const { locale } = useUiLocale();
  return useCallback((pt: string, en: string, es: string, enAu?: string): string => {
    if (locale === "es-LA") return es;
    if (locale === "en-AU") return enAu ?? en;
    if (locale === "en-US") return en;
    return pt;
  }, [locale]);
}

/** es-LA is our persisted code; es-419 is the BCP 47 locale for Latin America. */
export function intlLocale(locale: string): string {
  return locale === "es-LA" ? "es-419" : locale;
}

export { I18nContext };

export function AppI18nProvider({ locale, children }: { locale?: string; children: ReactNode }) {
  const [guestLocale, setGuestLocaleState] = useState<Lang>(storedLocale);
  const resolved = isLang(locale) ? locale : guestLocale;

  const setGuestLocale = useCallback((next: Lang) => {
    setGuestLocaleState(next);
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, next); } catch { /* blocked storage */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = intlLocale(resolved);
    if (isLang(locale)) {
      setGuestLocaleState(locale);
      try { window.localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* blocked storage */ }
    }
  }, [resolved, locale]);

  const translations = (APP_TRANSLATIONS[resolved] ?? APP_TRANSLATIONS["pt-BR"]) as AppTranslations;
  return (
    <LocaleContext.Provider value={{ locale: resolved, setGuestLocale }}>
      <I18nContext.Provider value={translations}>{children}</I18nContext.Provider>
    </LocaleContext.Provider>
  );
}
