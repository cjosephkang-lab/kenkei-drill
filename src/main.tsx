import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// 配色の見比べ用（?accent=green / ?accent=blue）。画面に切り替えのボタンは置かない
const accent = new URLSearchParams(location.search).get("accent");
if (accent === "green" || accent === "blue")
  document.documentElement.dataset.accent = accent;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
