const CACHE_NAME = "erpnext-timesheet-v8";
const APP_SHELL = ["/login", "/manifest.webmanifest", "/icon.svg", "/icon.png"];

async function warmAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(
    APP_SHELL.map(async (path) => {
      const response = await fetch(path, { cache: "no-store" });
      if (response.ok) {
        await cache.put(path, response.clone());
      }
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

function isCacheable(response) {
  return Boolean(response && response.ok && response.status === 200 && response.type === "basic");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const isNavigation = event.request.mode === "navigate";
  const isNextStatic = url.pathname.startsWith("/_next/static/");
  const isApiRequest = url.pathname.startsWith("/api/");

  if (isApiRequest) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isNavigation) {
    // Never cache HTML navigations for Next.js app routes.
    // Caching route HTML can reference stale _next chunk URLs after deploy,
    // causing client-side 404 and "Application error" crashes.
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/login"))
    );
    return;
  }

  if (isNextStatic) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (isCacheable(response)) {
            const cloned = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (isCacheable(response)) {
          const cloned = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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
