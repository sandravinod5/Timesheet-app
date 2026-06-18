const CACHE_PREFIX = "erpnext-timesheet";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX))
          .map((key) => caches.delete(key))
      );

      await self.registration.unregister();

      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(
        clients.map(async (client) => {
          if ("navigate" in client) {
            try {
              await client.navigate(client.url);
              return;
            } catch {}
          }

          if ("focus" in client) {
            try {
              await client.focus();
            } catch {}
          }
        })
      );
    })()
  );
});
