import { Link } from "wouter";
import { useUiText } from "@/lib/i18n";
import { useEffect, useState } from "react";
export type MetaAdvancedForm = {
  audienceMode?: "original" | "advantage";
  includedAudienceIds?: string[];
  excludedAudienceIds?: string[];
  placementMode?: "automatic" | "manual";
  placements?: string[];
  creativeFormat?: "image" | "video" | "catalog";
  videoId?: string;
  catalogId?: string;
  productSetId?: string;
  customerLifecycle?: {
    mode: "acquisition" | "retention";
    customerAudienceIds: string[];
  };
  creativeAutomation?: {
    creative_features_spec: Record<
      string,
      { enroll_status: "OPT_IN" | "OPT_OUT" }
    >;
  };
};
export function MetaAdvancedFields<T extends MetaAdvancedForm>({
  form,
  update,
}: {
  form: T;
  update: <K extends keyof T>(key: K, value: T[K]) => void;
}) {
  const t = useUiText();
  const field =
    "h-10 w-full border border-border/50 bg-background px-3 text-sm";
  const set = (key: keyof MetaAdvancedForm, value: unknown) =>
    update(key as keyof T, value as T[keyof T]);
  const [audienceText, setAudienceText] = useState({
    includedAudienceIds: (form.includedAudienceIds ?? []).join(", "),
    excludedAudienceIds: (form.excludedAudienceIds ?? []).join(", "),
  });
  const [customerText, setCustomerText] = useState(
    (form.customerLifecycle?.customerAudienceIds ?? []).join(", "),
  );
  useEffect(() => {
    if (
      customerText
        .split(/[,\s]+/)
        .filter(Boolean)
        .join(",") !==
      (form.customerLifecycle?.customerAudienceIds ?? []).join(",")
    )
      setCustomerText(
        (form.customerLifecycle?.customerAudienceIds ?? []).join(", "),
      );
  }, [form.customerLifecycle?.customerAudienceIds]);
  useEffect(() => {
    setAudienceText((current) => {
      const next = { ...current };
      for (const key of ["includedAudienceIds", "excludedAudienceIds"] as const)
        if (
          current[key]
            .split(/[,\s]+/)
            .filter(Boolean)
            .join(",") !== (form[key] ?? []).join(",")
        )
          next[key] = (form[key] ?? []).join(", ");
      return next;
    });
  }, [form.includedAudienceIds, form.excludedAudienceIds]);
  return (
    <div className="md:col-span-2 border border-border/40 p-3 space-y-4">
      <h4>
        {t(
          "Públicos, placements e formato",
          "Audiences, placements and format",
          "Públicos, ubicaciones y formato",
        )}
      </h4>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs">
          Advantage+ Audience
          <select
            className={field}
            value={form.audienceMode ?? "original"}
            onChange={(event) => set("audienceMode", event.target.value)}
          >
            <option value="original">
              {t("Público original", "Original audience", "Público original")}
            </option>
            <option value="advantage">Advantage+ Audience</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          {t(
            "No Advantage+, os públicos incluídos são sugestões de sinal; localização, idade mínima e exclusões permanecem no pedido. A elegibilidade depende da Meta. O NexOS não promete limite máximo de idade ou gênero nesse modo.",
            "With Advantage+, included audiences provide signal suggestions; location, minimum age and exclusions remain in the request. Eligibility depends on Meta. Maximum age and gender restrictions are not promised in this mode.",
            "En Advantage+, los públicos incluidos son sugerencias; ubicación, edad mínima y exclusiones permanecen en la solicitud. La elegibilidad depende de Meta. No se promete edad máxima ni restricción de género.",
          )}
        </p>
        {(["includedAudienceIds", "excludedAudienceIds"] as const).map(
          (key, index) => (
            <label key={key} className="text-xs">
              {index
                ? t(
                    "Excluir públicos — IDs separados por vírgula",
                    "Exclude audiences — comma-separated IDs",
                    "Excluir públicos — IDs separados por comas",
                  )
                : t(
                    "Incluir públicos — IDs separados por vírgula",
                    "Include audiences — comma-separated IDs",
                    "Incluir públicos — IDs separados por comas",
                  )}
              <input
                className={field}
                value={audienceText[key]}
                onChange={(event) => {
                  setAudienceText((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }));
                  set(key, event.target.value.split(/[,\s]+/).filter(Boolean));
                }}
              />
            </label>
          ),
        )}
        <p className="text-xs md:col-span-2">
          <Link href="/paid-media" className="text-primary underline">
            {t(
              "Gerencie Custom/CRM/Lookalike em Mídia paga → Públicos Meta.",
              "Manage Custom/CRM/Lookalike in Paid Media → Meta audiences.",
              "Gestiona Custom/CRM/Lookalike en Medios pagos → Públicos Meta.",
            )}
          </Link>{" "}
          {t(
            "O acesso a cada ID será verificado na conta aprovada antes de criar anúncios.",
            "Access to every ID is checked in the approved account before ad creation.",
            "Se comprobará acceso a cada ID en la cuenta aprobada antes de crear anuncios.",
          )}
        </p>
        <label className="text-xs">
          Placements
          <select
            className={field}
            value={form.placementMode ?? "automatic"}
            onChange={(event) => {
              set("placementMode", event.target.value);
              if (event.target.value === "automatic") set("placements", []);
            }}
          >
            <option value="automatic">
              {t(
                "Automáticos — padrão da Meta",
                "Automatic — Meta default",
                "Automáticas — predeterminado de Meta",
              )}
            </option>
            <option value="manual">{t("Manuais", "Manual", "Manuales")}</option>
          </select>
        </label>
        {form.placementMode === "manual" && (
          <div className="flex flex-wrap gap-3 text-xs">
            {[
              "facebook_feed",
              "facebook_stories",
              "facebook_reels",
              "instagram_feed",
              "instagram_stories",
              "instagram_reels",
            ].map((key) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={form.placements?.includes(key) ?? false}
                  onChange={(event) =>
                    set(
                      "placements",
                      event.target.checked
                        ? [...(form.placements ?? []), key]
                        : (form.placements?.filter((value) => value !== key) ??
                            []),
                    )
                  }
                />{" "}
                {key.replaceAll("_", " ")}
              </label>
            ))}
          </div>
        )}
        <label className="text-xs">
          {t("Formato do anúncio", "Ad format", "Formato del anuncio")}
          <select
            className={field}
            value={form.creativeFormat ?? "image"}
            onChange={(event) => {
              set("creativeFormat", event.target.value);
              set("videoId", "");
              set("catalogId", "");
              set("productSetId", "");
            }}
          >
            <option value="image">{t("Imagem", "Image", "Imagen")}</option>
            <option value="video">
              {t(
                "Vídeo existente na Meta",
                "Existing Meta video",
                "Vídeo existente en Meta",
              )}
            </option>
            <option value="catalog">
              {t("Catálogo — vendas", "Catalog — sales", "Catálogo — ventas")}
            </option>
          </select>
        </label>
        {form.creativeFormat === "video" && (
          <label className="text-xs">
            Meta Video ID
            <input
              className={field}
              required
              pattern="[0-9]+"
              value={form.videoId ?? ""}
              onChange={(event) => set("videoId", event.target.value)}
            />
            <span>
              {t(
                "Use a URL de imagem acima como miniatura. O vídeo precisa estar pronto na conta de anúncios.",
                "Use the image URL above as thumbnail. The video must be ready in this ad account.",
                "Usa la URL de imagen como miniatura. El vídeo debe estar listo en la cuenta.",
              )}
            </span>
          </label>
        )}
        {form.creativeFormat === "catalog" && (
          <>
            {(["catalogId", "productSetId"] as const).map((key) => (
              <label className="text-xs" key={key}>
                {key === "catalogId" ? "Catalog ID" : "Product Set ID"}
                <input
                  className={field}
                  required
                  pattern="[0-9]+"
                  value={form[key] ?? ""}
                  onChange={(event) => set(key, event.target.value)}
                />
              </label>
            ))}
            <p className="text-xs">
              {t(
                "Selecione Vendas e Purchase. O catálogo e seu feed já devem existir na Meta; o conjunto precisa conter produtos. Esta configuração cria anúncios de catálogo, sem criar ou alterar o feed.",
                "Select Sales and Purchase. The catalog/feed must already exist in Meta and the set must contain products. This creates catalog ads without creating or modifying the feed.",
                "Selecciona Ventas y Purchase. El catálogo/feed debe existir en Meta y el conjunto debe contener productos. Crea anuncios de catálogo sin modificar el feed.",
              )}
            </p>
          </>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2 border-t border-border/40 pt-3">
        <label className="text-xs">
          {t(
            "Clientes: aquisição ou retenção",
            "Customers: acquisition or retention",
            "Clientes: adquisición o retención",
          )}
          <select
            className={field}
            value={form.customerLifecycle?.mode ?? "none"}
            onChange={(event) => {
              const mode = event.target.value;
              set(
                "customerLifecycle",
                mode === "none"
                  ? undefined
                  : {
                      mode,
                      customerAudienceIds: customerText
                        .split(/[,\s]+/)
                        .filter(Boolean),
                    },
              );
              if (mode === "retention") set("audienceMode", "original");
            }}
          >
            <option value="none">
              {t(
                "Sem regra adicional",
                "No additional rule",
                "Sin regla adicional",
              )}
            </option>
            <option value="acquisition">
              {t(
                "Aquisição — excluir clientes",
                "Acquisition — exclude customers",
                "Adquisición — excluir clientes",
              )}
            </option>
            <option value="retention">
              {t(
                "Retenção — somente clientes",
                "Retention — customers only",
                "Retención — solo clientes",
              )}
            </option>
          </select>
        </label>
        {form.customerLifecycle && (
          <label className="text-xs">
            {t(
              "IDs dos públicos de clientes",
              "Customer audience IDs",
              "IDs de públicos de clientes",
            )}
            <input
              className={field}
              required
              value={customerText}
              onChange={(event) => {
                setCustomerText(event.target.value);
                set("customerLifecycle", {
                  ...form.customerLifecycle,
                  customerAudienceIds: event.target.value
                    .split(/[,\s]+/)
                    .filter(Boolean),
                });
              }}
            />
          </label>
        )}
        <p className="text-xs md:col-span-2">
          {t(
            "Estas são regras explícitas de inclusão/exclusão. Não certificam ativação do recurso nativo Customer Lifecycle da Meta. Retenção exige público original sem expansão.",
            "These are explicit inclusion/exclusion rules, not certification of Meta's native Customer Lifecycle. Retention requires original audience without expansion.",
            "Son reglas explícitas de inclusión/exclusión; no certifican Customer Lifecycle nativo de Meta. Retención requiere público original sin expansión.",
          )}
        </p>
        <h4 className="text-xs md:col-span-2">
          Advantage+ Creative / enhancements
        </h4>
        {[
          "standard_enhancements",
          "text_optimizations",
          "image_touchups",
          "image_uncrop",
          "video_auto_crop",
          "product_browsing",
        ].map((feature) => (
          <label key={feature} className="text-xs">
            {feature.replaceAll("_", " ")}
            <select
              className={field}
              value={
                form.creativeAutomation?.creative_features_spec[feature]
                  ?.enroll_status ?? "default"
              }
              onChange={(event) => {
                const features = {
                  ...form.creativeAutomation?.creative_features_spec,
                };
                if (event.target.value === "default") delete features[feature];
                else
                  features[feature] = {
                    enroll_status: event.target.value as "OPT_IN" | "OPT_OUT",
                  };
                set(
                  "creativeAutomation",
                  Object.keys(features).length
                    ? { creative_features_spec: features }
                    : undefined,
                );
              }}
            >
              <option value="default">
                {t("Padrão da Meta", "Meta default", "Predeterminado Meta")}
              </option>
              <option value="OPT_IN">
                {t("Autorizar", "Opt in", "Autorizar")}
              </option>
              <option value="OPT_OUT">
                {t("Desativar", "Opt out", "Desactivar")}
              </option>
            </select>
          </label>
        ))}
        <p className="text-xs md:col-span-2">
          {t(
            "A escolha entra no criativo aprovado. Recorte de vídeo exige vídeo; tratamentos de imagem exigem imagem; product browsing exige catálogo. A Meta pode rejeitar recursos indisponíveis na conta.",
            "Choices are part of the approved creative. Video cropping needs video, image treatments need an image and product browsing needs a catalog. Meta may reject unavailable features.",
            "Las opciones forman parte del creativo aprobado. Recorte de vídeo requiere vídeo, tratamientos de imagen requieren imagen y product browsing requiere catálogo. Meta puede rechazar funciones no disponibles.",
          )}
        </p>
      </div>
    </div>
  );
}
