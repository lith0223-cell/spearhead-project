export function isNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function getController(): ServiceWorker | null {
  return navigator.serviceWorker?.controller ?? null;
}

// ── Web Push 구독 ──────────────────────────────────────────────────────────

const PUSH_SUB_KEY = "ph_push_subscription";
const PUSH_MSG_KEY = "ph_push_message_id";
const PUSH_SCHEDULE_DEBOUNCE_MS = 500;

let pushScheduleTimeout: ReturnType<typeof setTimeout> | null = null;
let pushScheduleVersion = 0;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isNotificationSupported() || !('PushManager' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return null;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    localStorage.setItem(PUSH_SUB_KEY, JSON.stringify(subscription.toJSON()));
    return subscription;
  } catch {
    return null;
  }
}

// ── 서버 스케줄 기반 알림 ──────────────────────────────────────────────────

async function deleteScheduledPush(messageId: string): Promise<void> {
  try {
    await fetch('/api/push/schedule', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    });
  } catch {
    // 무시 — 이미 발송됐거나 만료된 경우
  }
}

// Web Push 서버 예약 — 앱이 백그라운드여도 OS 레벨 알림 발송
async function schedulePushNotification(endTime: number, exerciseName: string, routineId: string | undefined, version: number): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription) return;

  const cancelMessageId = localStorage.getItem(PUSH_MSG_KEY) ?? undefined;

  try {
    const res = await fetch('/api/push/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        endTime,
        exerciseName,
        routineId,
        cancelMessageId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.messageId) {
        if (version === pushScheduleVersion) {
          localStorage.setItem(PUSH_MSG_KEY, data.messageId);
        } else {
          await deleteScheduledPush(data.messageId);
        }
      }
    }
  } catch {
    // 네트워크 오류 시 SW fallback으로 처리됨
  }
}

function queuePushNotification(endTime: number, exerciseName: string, routineId?: string): void {
  pushScheduleVersion += 1;
  const version = pushScheduleVersion;
  if (pushScheduleTimeout) clearTimeout(pushScheduleTimeout);
  pushScheduleTimeout = setTimeout(() => {
    pushScheduleTimeout = null;
    schedulePushNotification(endTime, exerciseName, routineId, version);
  }, PUSH_SCHEDULE_DEBOUNCE_MS);
}

async function cancelPushNotification(): Promise<void> {
  pushScheduleVersion += 1;
  if (pushScheduleTimeout) {
    clearTimeout(pushScheduleTimeout);
    pushScheduleTimeout = null;
  }
  const messageId = localStorage.getItem(PUSH_MSG_KEY);
  if (!messageId) return;
  localStorage.removeItem(PUSH_MSG_KEY);
  await deleteScheduledPush(messageId);
}

// ── 공개 인터페이스 ───────────────────────────────────────────────────────

export function scheduleRestNotification(endTime: number, exerciseName: string, routineId?: string): void {
  // 1. SW fallback (백그라운드 상태일 때 SW 자체 setTimeout으로 발화 — visibility 체크 포함)
  const sw = getController();
  if (sw) sw.postMessage({ type: 'TIMER_START', endTime, exerciseName, routineId });

  // 2. Web Push 서버 예약 (앱이 종료된 경우 OS 레벨 알림)
  if (Notification.permission === 'granted') {
    queuePushNotification(endTime, exerciseName, routineId);
  }
}

export function cancelRestNotification(): void {
  // 1. SW fallback 취소
  const sw = getController();
  if (sw) sw.postMessage({ type: 'TIMER_CANCEL' });

  // 2. 서버 스케줄 취소
  cancelPushNotification();
}
