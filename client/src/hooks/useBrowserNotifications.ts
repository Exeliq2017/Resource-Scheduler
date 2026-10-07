import { useEffect, useState } from "react";
import { useNotifications } from "../api/hooks";

const SHOWN_KEY = "exeliq_shown_notifications";
const MAX_TRACKED = 500;

function loadShown(): Set<string> {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveShown(ids: Set<string>) {
  try {
    const trimmed = Array.from(ids).slice(-MAX_TRACKED);
    localStorage.setItem(SHOWN_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore — browser notifications are a convenience, never block the app on storage errors
  }
}

/** Requests permission once and fires a native browser Notification for each new alert while this tab is open. */
export function useBrowserNotifications() {
  const { data: notifications } = useNotifications();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  useEffect(() => {
    if (typeof Notification === "undefined" || !notifications) return;
    if (permission !== "granted") return;

    const shown = loadShown();
    let changed = false;
    for (const n of notifications) {
      if (shown.has(n.id)) continue;
      shown.add(n.id);
      changed = true;
      try {
        new Notification("Exeliq Resource Scheduler", { body: n.message, tag: n.id });
      } catch {
        // Notification constructor can throw in some contexts (e.g. no user gesture yet) — non-fatal.
      }
    }
    if (changed) saveShown(shown);
  }, [notifications, permission]);

  function requestPermission() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(setPermission);
  }

  return { permission, requestPermission, notifications: notifications ?? [] };
}
