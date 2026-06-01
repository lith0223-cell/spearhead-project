// Service Worker — 휴식 타이머 푸시 알림

let timerTimeout = null;
let timerHandledAt = 0; // 앱 포그라운드에서 타이머 처리 시각 (TIMER_HANDLED 수신)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function isAnyClientVisible() {
  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => clients.some((c) => c.visibilityState === 'visible'));
}

self.addEventListener('message', (event) => {
  const { type, endTime, exerciseName, routineId } = event.data || {};

  if (type === 'TIMER_START') {
    if (timerTimeout) clearTimeout(timerTimeout);
    const delay = Math.max(0, endTime - Date.now());
    const targetUrl = routineId
      ? `${self.location.origin}/workout/${routineId}?resume=true`
      : self.location.origin;

    timerTimeout = setTimeout(() => {
      timerTimeout = null;
      const recentlyHandled = (Date.now() - timerHandledAt) < 10000;
      if (recentlyHandled) return;
      isAnyClientVisible().then((visible) => {
        if (visible) return;
        self.registration.showNotification('⏰ 휴식 종료!', {
          body: `${exerciseName ?? '운동'} 다음 세트를 시작하세요!`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          vibrate: [200, 100, 200, 100, 200],
          tag: 'rest-timer',
          requireInteraction: true,
          data: { url: targetUrl },
        });
      });
    }, delay);
  }

  if (type === 'TIMER_CANCEL') {
    if (timerTimeout) {
      clearTimeout(timerTimeout);
      timerTimeout = null;
    }
  }

  if (type === 'TIMER_HANDLED') {
    timerHandledAt = Date.now();
  }

  // SW idle 종료 방지용 ping — 수신 자체가 SW를 활성 상태로 유지
  if (type === 'KEEPALIVE') {
    // 응답 불필요 — message 수신으로 SW 유지
  }
});

// Web Push 수신 — 앱이 백그라운드/종료 상태일 때만 알림 표시
self.addEventListener('push', (event) => {
  let data = {
    title: '⏰ 휴식 종료!',
    body: '다음 세트를 시작하세요!',
    url: self.location.origin,
  };
  try {
    data = { ...data, ...(event.data?.json() ?? {}) };
  } catch {
    // ignore parse error
  }
  event.waitUntil(
    isAnyClientVisible().then((visible) => {
      // 앱 포그라운드이거나, 최근 10초 이내 앱에서 타이머를 직접 처리했으면 알림 표시 안 함
      const recentlyHandled = (Date.now() - timerHandledAt) < 10000;
      if (visible || recentlyHandled) return;
      return self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'rest-timer',
        requireInteraction: true,
        data: { url: data.url },
      });
    })
  );
});

// 알림 클릭 시 해당 운동 페이지로 진입
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.location.origin;
  const targetPath = new URL(targetUrl, self.location.origin).pathname + new URL(targetUrl, self.location.origin).search;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 이미 열린 앱 창이 있으면 해당 URL로 navigate 후 focus
        const appClient = clientList.find((c) => c.url.startsWith(self.location.origin));
        if (appClient) {
          if ('navigate' in appClient) {
            return appClient.navigate(targetUrl).then((c) => c?.focus?.());
          }
          return appClient.focus();
        }
        // 없으면 새 창 열기
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      })
  );
});
