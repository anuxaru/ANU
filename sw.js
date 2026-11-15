/* Service worker for the admin panel: shows phone alerts when a visitor writes in the chat,
   even when the admin page is closed. It does nothing else (no offline caching). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "New message", {
    body: d.body || "", tag: d.tag || "anu-chat", renotify: true,
    icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    data: { url: d.url || "admin.html#chat" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "admin.html#chat", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (c.url.startsWith(new URL("admin.html", self.registration.scope).href)) {
        return c.focus().then(w => (w && "navigate" in w) ? w.navigate(target) : w);
      }
    }
    return self.clients.openWindow(target);
  }));
});
