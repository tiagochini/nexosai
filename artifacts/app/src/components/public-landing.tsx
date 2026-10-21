import { useQuery } from "@tanstack/react-query";

type PublishedLanding = { page: { id: string; title: string; html: string; publishedUrl: string | null } };

export function PublicLanding({ slug = "index" }: { slug?: string }) {
  const host = window.location.hostname;
  const { data, isLoading } = useQuery<PublishedLanding>({
    queryKey: ["/api/landings/resolve", host, slug],
    queryFn: async () => {
      const response = await fetch(`/api/landings/resolve?host=${encodeURIComponent(host)}&slug=${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error("Landing não encontrada");
      return response.json() as Promise<PublishedLanding>;
    },
    retry: false,
    staleTime: 60_000,
  });

  if (data?.page.html) return <iframe title={data.page.title} srcDoc={data.page.html} className="fixed inset-0 h-full w-full border-0 bg-white" />;
  if (isLoading) return <div className="min-h-screen bg-white" aria-label="Carregando página" />;
  return null;
}
