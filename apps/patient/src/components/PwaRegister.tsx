"use client";

// Service Worker registration + Lock 16 (ITP Eviction Shield).
//
// Lock 16: navigator.storage.persist() pede ao browser para promover o
// storage a "Persistent", protegendo IndexedDB/Cache de eviction agressiva
// em iOS Safari (ITP 2.x) após 7 dias sem uso.
//
// Registra apenas em produção (dev/HMR ruim com SW ativo).

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Skip in dev (Next.js HMR conflita com SW caching)
    if (process.env.NODE_ENV !== "production") return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        console.log("[pwa] SW registered, scope:", reg.scope);

        // Lock 16: pedir persistent storage (Safari ITP shield).
        if ("storage" in navigator && "persist" in navigator.storage) {
          const persisted = await navigator.storage.persisted();
          if (!persisted) {
            const granted = await navigator.storage.persist();
            console.log(
              "[pwa] persistent storage:",
              granted ? "granted" : "denied",
            );
          }
        }
      } catch (err) {
        console.error("[pwa] SW registration failed:", err);
      }
    };

    void register();
  }, []);

  return null;
}
