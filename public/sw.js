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

// Web Push 수신 — 앱이 백그라운드/종료 상태일 때만 알림 표시
self.addEventListener('push', (event) => {
  let data = { title: '⏰ 휴식 종료!', body: '다음 세트를 시작하세요!' };
  try {
    data = event.data?.json() ?? data;
  } catch {
    // ignore parse error
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // 앱이 포그라운드(visible)에 있으면 알림 표시 안 함 — 앱 내 비프음으로 처리됨
      const isForeground = clients.some(c => c.visibilityState === 'visible');
      if (isForeground) return;

      return self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'rest-timer',
        requireInteraction: true,
        data: { url: self.location.origin },
      });
    })
  );
});

// 알림 클릭 시 앱 포커스 또는 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.location.origin;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 이미 열린 앱 창 찾기 (origin이 같은 창)
        const appClient = clientList.find(c => c.url.startsWith(self.location.origin));
        if (appClient && 'focus' in appClient) return appClient.focus();
        // 없으면 새로 열기
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
