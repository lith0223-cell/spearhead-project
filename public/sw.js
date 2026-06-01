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

  // SW idle 종료 방지용 ping — 수신 자체가 SW를 활성 상태로 유지
  if (type === 'KEEPALIVE') {
    // 응답 불필요 — message 수신으로 SW 유지
  }
});

// Web Push 수신 — 앱이 백그라운드/종료 상태에서도 알림 표시
self.addEventListener('push', (event) => {
  let data = { title: '⏰ 휴식 종료!', body: '다음 세트를 시작하세요!' };
  try {
    data = event.data?.json() ?? data;
  } catch {
    // ignore parse error
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'rest-timer',
      requireInteraction: true,
      data: { url: self.location.origin },
    })
  );
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
