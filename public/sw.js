// Service Worker — 휴식 타이머 푸시 알림

let timerTimeout = null;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const { type, endTime, exerciseName } = event.data || {};

  if (type === 'TIMER_START') {
    if (timerTimeout) clearTimeout(timerTimeout);
    const delay = Math.max(0, endTime - Date.now());
    timerTimeout = setTimeout(() => {
      self.registration.showNotification('⏰ 휴식 종료!', {
        body: `${exerciseName} 다음 세트를 시작하세요!`,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'rest-timer',
        requireInteraction: true,
        data: { url: self.location.origin },
      });
      timerTimeout = null;
    }, delay);
  }

  if (type === 'TIMER_CANCEL') {
    if (timerTimeout) {
      clearTimeout(timerTimeout);
      timerTimeout = null;
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow('/');
      })
  );
});
