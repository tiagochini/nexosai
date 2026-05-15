import VideoTemplate from "@/components/video/VideoTemplate";
import MetaDemoVideo from "@/components/video/MetaDemoVideo";

export default function App() {
  const path = window.location.pathname;
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const localPath = path.replace(base, "") || "/";
  if (localPath.startsWith("/meta-demo")) return <MetaDemoVideo />;
  return <VideoTemplate />;
}
