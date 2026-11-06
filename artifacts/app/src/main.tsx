import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installChunkRecovery } from "./lib/chunk-recovery";

installChunkRecovery();
createRoot(document.getElementById("root")!).render(<App />);
