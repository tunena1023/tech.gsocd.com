/* ============================================================
   sw.js — Service Worker: recibe la notificacion push y la muestra,
   y abre la orden correspondiente cuando el tecnico le da clic.

   El payload que manda Admingsocd.com (lib/push.js) siempre trae
   { title, body, url } -- este archivo no necesita saber nada de
   ordenes, divisiones, ni roles: solo muestra lo que le llega y abre
   la url que le llega.
============================================================ */

self.addEventListener('push', function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  const title = data.title || 'GS Solutions';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-monochrome-512.png',
    data: { url: data.url || '/employee.html' },
    /* Mismo tag = reemplaza al aviso anterior de la misma orden en vez
       de amontonar (lib/push.js de Admin lo manda). */
    tag: data.tag || undefined,
    renotify: !!data.tag
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* Si ya hay una pestana abierta de tech.gsocd.com, la enfoca y la
   manda a la orden correcta en vez de abrir una pestana nueva --
   igual que cualquier app real (WhatsApp, juegos, etc). */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url : '/employee.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
