const CACHE_NAME = "erpnext-timesheet-v4";
const APP_SHELL = [
  "/",
  "/login",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png"
];

async function warmAppShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.allSettled(
    APP_SHELL.map(async (path) => {
      const response = await fetch(path, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Failed to cache ${path}: ${response.status}`);
      }

      await cache.put(path, response.clone());
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    warmAppShell()
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Tracker",
    body: "You have a new update.",
    url: "/timesheet",
    tag: "planner-push"
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/icon.png",
      badge: "/icon.png",
      data: {
        url: payload.url || "/timesheet"
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/timesheet";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if (client.url.includes(targetUrl)) {
            return client.focus();
          }
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
