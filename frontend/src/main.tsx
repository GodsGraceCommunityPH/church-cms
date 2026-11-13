import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App";
import { AuthProvider } from "./features/auth/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

// The resource service worker caches same-origin scripts and styles. Vite dev
// module URLs never change, so a cached module would hide new code forever.
// Register it only for production builds, and clear any registration left by an
// earlier development session.
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/resource-sw.js");
    });
  } else {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations.map((registration) => registration.unregister()),
        ),
      );

    if ("caches" in window) {
      void caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("ggccc-"))
            .map((key) => caches.delete(key)),
        ),
      );
    }
  }
}
