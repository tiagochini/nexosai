import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";
import { toast } from "sonner";

type Account = { id: string; accountName: string; isSelected: boolean };
type Pixel = { pixelId: string; pixelCode: string; name?: string };
type Dataset = { id: string; provider: string; accountId: string; providerDatasetId: string; name?: string };
type Diagnostic = { eventCount: number; providerDelivery: { sent: number; queued: number; failed: number; consentWithheld: number }; pageConfiguration?: Array<{ pageId: string; publishedUrl: string | null; published: boolean; tagInStoredHtml: boolean }>; providerDiagnostic?: { accessible?: boolean; installationVerified?: boolean } };

export function TikTokPixelsTab() {
  const t = useUiText(), queryClient = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const accounts = useQuery({ queryKey: ["/api/paid-media/accounts/tiktok_ads"], queryFn: () => customFetch<{ accounts: Account[] }>("/api/paid-media/accounts/tiktok_ads") });
  const selected = accounts.data?.accounts.find(account => account.id === accountId && account.isSelected);
  const pixels = useQuery({ queryKey: ["tiktok-pixels", selected?.id], enabled: Boolean(selected), retry: false, queryFn: () => customFetch<{ pixels: Pixel[] }>(`/api/paid-media/accounts/tiktok_ads/${selected!.id}/pixels`) });
  const datasets = useQuery({ queryKey: ["/api/paid-media/datasets"], queryFn: () => customFetch<{ datasets: Dataset[] }>("/api/paid-media/datasets") });
  const diagnostic = useQuery({ queryKey: ["tiktok-pixel-diagnostic", datasetId], enabled: Boolean(datasetId), retry: false, queryFn: () => customFetch<Diagnostic>(`/api/paid-media/datasets/${datasetId}/diagnostics`) });
  const register = useMutation({
    mutationFn: (pixel: Pixel) => customFetch<{ dataset: Dataset }>("/api/paid-media/datasets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "tiktok_ads", accountId: selected!.id, providerDatasetId: pixel.pixelCode, name: pixel.name }) }),
    onSuccess: async ({ dataset }) => { await queryClient.invalidateQueries({ queryKey: ["/api/paid-media/datasets"] }); setDatasetId(dataset.id); toast.success(t("Pixel vinculado.", "Pixel linked.", "Píxel vinculado.")); },
    onError: () => toast.error(t("Não foi possível vincular o pixel. Tente novamente em instantes.", "Could not link the pixel. Please try again shortly.", "No se pudo vincular el píxel. Inténtalo de nuevo en unos instantes.")),
  });
  const upload = useMutation({
    mutationFn: () => customFetch<{ videoId: string }>(`/api/paid-media/accounts/tiktok_ads/${selected!.id}/videos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoUrl }) }),
    onError: () => toast.error(t("Não foi possível confirmar o envio. Confira a biblioteca do TikTok antes de tentar novamente.", "Upload could not be confirmed. Check the TikTok library before retrying.", "No se pudo confirmar el envío. Revisa la biblioteca de TikTok antes de reintentar.")),
  });
  return <div className="space-y-4">
    <h3 className="font-mono text-sm font-bold">{t("TikTok — Pixels e conversões", "TikTok — Pixels and conversions", "TikTok — Píxeles y conversiones")}</h3>
    <p className="text-sm text-muted-foreground">{t("Selecione a conta autorizada para consultar os pixels e acompanhar o envio de eventos.", "Select an authorized account to inspect pixels and event delivery.", "Selecciona una cuenta autorizada para consultar los píxeles y el envío de eventos.")}</p>
    <label className="block space-y-2"><span className="text-sm">{t("Conta de anúncios", "Ad account", "Cuenta publicitaria")}</span>
      <select className="block w-full border bg-background p-2" disabled={upload.isPending || register.isPending} value={accountId} onChange={event => { setAccountId(event.target.value); setDatasetId(""); upload.reset(); setVideoUrl(""); }}>
        <option value="">{t("Selecione uma conta", "Select an account", "Selecciona una cuenta")}</option>
        {accounts.data?.accounts.filter(account => account.isSelected).map(account => <option key={account.id} value={account.id}>{account.accountName}</option>)}
      </select>
    </label>
    {accounts.isError && <p role="alert">{t("Não foi possível carregar as contas. Confira a conexão em Integrações.", "Could not load accounts. Check the connection in Integrations.", "No se pudieron cargar las cuentas. Revisa la conexión en Integraciones.")}</p>}
    {selected && <Button variant="outline" disabled={pixels.isFetching} onClick={() => void pixels.refetch()}>{t("Atualizar pixels", "Refresh pixels", "Actualizar píxeles")}</Button>}
    {selected && <div className="space-y-3 border p-4">
      <h4>{t("Enviar vídeo para a biblioteca de anúncios", "Upload video to the ad library", "Enviar video a la biblioteca de anuncios")}</h4>
      <label className="block space-y-1"><span className="text-sm">{t("Link público HTTPS do vídeo", "Public HTTPS video link", "Enlace público HTTPS del video")}</span><input type="url" className="block w-full border bg-background p-2" value={videoUrl} onChange={event => setVideoUrl(event.target.value)} disabled={upload.isPending} /></label>
      <Button disabled={upload.isPending || !videoUrl.startsWith("https://")} onClick={() => upload.mutate()}>{upload.isPending ? t("Enviando…", "Uploading…", "Enviando…") : t("Enviar vídeo", "Upload video", "Enviar video")}</Button>
      {upload.data && <p className="text-sm">{t("Vídeo confirmado na biblioteca", "Video confirmed in the library", "Video confirmado en la biblioteca")}: <code>{upload.data.videoId}</code></p>}
    </div>}
    {pixels.isError && <p role="alert">{t("Não foi possível consultar o TikTok. Confira as permissões e tente novamente.", "Could not query TikTok. Check permissions and try again.", "No se pudo consultar TikTok. Revisa los permisos e inténtalo de nuevo.")}</p>}
    {pixels.data?.pixels.map(pixel => {
      const existing = datasets.data?.datasets.find(dataset => dataset.provider === "tiktok_ads" && dataset.accountId === selected?.id && dataset.providerDatasetId === pixel.pixelCode);
      return <div key={pixel.pixelId} className="flex flex-wrap items-center justify-between gap-3 border p-3"><div><p>{pixel.name || "TikTok Pixel"}</p><p className="text-xs text-muted-foreground">{pixel.pixelCode}</p></div><Button disabled={register.isPending || !pixel.pixelCode} onClick={() => existing ? setDatasetId(existing.id) : register.mutate(pixel)}>{existing ? t("Ver diagnóstico", "View diagnostics", "Ver diagnóstico") : t("Vincular pixel", "Link pixel", "Vincular píxel")}</Button></div>;
    })}
    {pixels.data && !pixels.data.pixels.length && <p>{t("Nenhum pixel foi retornado para esta conta.", "No pixels were returned for this account.", "No se encontraron píxeles para esta cuenta.")}</p>}
    {datasetId && <Button variant="outline" disabled={diagnostic.isFetching} onClick={() => void diagnostic.refetch()}>{t("Atualizar diagnóstico", "Refresh diagnostics", "Actualizar diagnóstico")}</Button>}
    {diagnostic.isError && <p role="alert">{t("Não foi possível carregar o diagnóstico. Tente novamente.", "Could not load diagnostics. Try again.", "No se pudo cargar el diagnóstico. Inténtalo de nuevo.")}</p>}
    {diagnostic.data && <div className="space-y-2 border p-4 text-sm" aria-live="polite">
      <p>{diagnostic.data.providerDiagnostic?.accessible ? t("Pixel acessível no TikTok.", "Pixel accessible in TikTok.", "Píxel accesible en TikTok.") : t("Acesso ao pixel não confirmado.", "Pixel access not confirmed.", "Acceso al píxel no confirmado.")}</p>
      <p>{t("Eventos registrados", "Recorded events", "Eventos registrados")}: {diagnostic.data.eventCount}</p>
      <p>{t("Aceitos pelo provedor", "Accepted by provider", "Aceptados por el proveedor")}: {diagnostic.data.providerDelivery.sent} · {t("Na fila", "Queued", "En cola")}: {diagnostic.data.providerDelivery.queued} · {t("Falhas", "Failed", "Errores")}: {diagnostic.data.providerDelivery.failed}</p>
      <p>{t("Sem consentimento de marketing", "Without marketing consent", "Sin consentimiento de marketing")}: {diagnostic.data.providerDelivery.consentWithheld}</p>
      <p>{t("Páginas publicadas com configuração do pixel", "Published pages with pixel configuration", "Páginas publicadas con configuración del píxel")}: {diagnostic.data.pageConfiguration?.filter(page => page.published && page.tagInStoredHtml).length ?? 0}</p>
      <p className="text-muted-foreground">{t("Acesso ao pixel e eventos aceitos não confirmam a instalação no navegador nem a atribuição de vendas. Confira também o Events Manager do TikTok.", "Pixel access and accepted events do not confirm browser installation or sales attribution. Also check TikTok Events Manager.", "El acceso al píxel y los eventos aceptados no confirman la instalación en el navegador ni la atribución de ventas. Revisa también TikTok Events Manager.")}</p>
    </div>}
  </div>;
}
