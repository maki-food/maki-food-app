self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'Maki Food';
  const options = {
    body: data.body || 'Você tem uma atualização no seu pedido.',
    icon: data.icon || '/favicon.png',
    badge: data.badge || '/favicon.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'maki-food-notification',
    renotify: true,
    silent: false,
    vibrate: [300, 100, 300, 100, 600],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existingClient = windowClients.find(client => 'focus' in client);
      if (existingClient) {
        existingClient.navigate(url);
        return existingClient.focus();
      }
      return clients.openWindow(url);
    })
  );
});
