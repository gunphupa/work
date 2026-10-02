import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "./styles.css";
import App from "./App";
import { LanguageProvider } from "./i18n";
import { AccountProvider } from "./auth";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <AccountProvider>
        <App />
      </AccountProvider>
    </LanguageProvider>
  </React.StrictMode>,
);
