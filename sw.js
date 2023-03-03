
self.addEventListener("install", (event) => {
  console.debug("service worker: install", event);
});

self.addEventListener('activate', async event => {
  console.debug("service worker: activate", event);
});

self.addEventListener("fetch", (event) => {
  console.debug("network fetch:", event);
});

self.addEventListener("notificationclick", e => {
  console.debug("service worker: notificationclick", e.notification);
});