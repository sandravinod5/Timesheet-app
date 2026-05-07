const APP_NOTIFICATION_ICON = "/icon.png";
const APP_NOTIFICATION_BADGE = "/icon.png";

type AppNotification = {
  title: string;
  body: string;
  tag: string;
  url?: string;
};

export function getNotificationPermissionState() {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported" as const;
  }

  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported" as const;
  }

  return Notification.requestPermission();
}

export async function showSystemNotification(notification: AppNotification) {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  const options = {
    body: notification.body,
    tag: notification.tag,
    icon: APP_NOTIFICATION_ICON,
    badge: APP_NOTIFICATION_BADGE,
    data: {
      url: notification.url || "/timesheet"
    }
  };

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(notification.title, options);
        return true;
      }
    } catch {}
  }

  try {
    new Notification(notification.title, options);
    return true;
  } catch {
    return false;
  }
}

export function shouldSendNotification(key: string, cooldownMs: number) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const storageKey = `planner-notify:${key}`;
    const now = Date.now();
    const previous = Number(window.localStorage.getItem(storageKey) || "0");

    if (previous && now - previous < cooldownMs) {
      return false;
    }

    window.localStorage.setItem(storageKey, String(now));
    return true;
  } catch {
    return true;
  }
}
