import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initAiRawLogger } from "./services/aiRawLogger";

initAiRawLogger().catch((error) => {
  console.error("[main] Failed to init AI raw logger", error);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
