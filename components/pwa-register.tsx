"use client";

import { useEffect } from "react";

const CHUNK_RELOAD_KEY = "chunk-reload-attempted";

function shouldReloadForChunkError(message: string) {
  return /ChunkLoadError|Loading chunk [\d]+ failed|Failed to fetch dynamically imported module|Loading CSS chunk [\d]+ failed/i.test(
    message
  );
}

function isNextStaticAssetError(target: EventTarget | null) {
  if (typeof HTMLLinkElement !== "undefined" && target instanceof HTMLLinkElement) {
    return target.href.includes("/_next/static/");
  }

  if (typeof HTMLScriptElement !== "undefined" && target instanceof HTMLScriptElement) {
    return target.src.includes("/_next/static/");
  }

  return false;
}

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const clearReloadFlag = () => {
      try {
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      } catch {}
    };

    const tryHardReload = () => {
      try {
        if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") {
          return;
        }
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      } catch {}
      window.location.reload();
    };

    const onWindowError = (event: ErrorEvent) => {
      const message = event.message || String(event.error || "");
      if (shouldReloadForChunkError(message) || isNextStaticAssetError(event.target)) {
        tryHardReload();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason?.message || reason?.name || String(reason || "");
      if (shouldReloadForChunkError(message)) {
        tryHardReload();
      }
    };

    const cleanupChunkReloadHandlers = () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    clearReloadFlag();

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });

      if ("caches" in window) {
        void caches.keys().then((keys) => {
          keys.forEach((key) => {
            void caches.delete(key);
          });
        });
      }

      return cleanupChunkReloadHandlers;
    }

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) {
        return;
      }
      reloaded = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        void registration.update();

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) {
            return;
          }

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              registration.waiting?.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      cleanupChunkReloadHandlers();
    };
  }, []);

  return null;
}
