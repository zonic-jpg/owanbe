import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installAsset404Listener } from "./lib/log-404";
import { installSessionExpiredListener } from "./lib/session-guard";

installAsset404Listener();
installSessionExpiredListener();

createRoot(document.getElementById("root")!).render(<App />);
