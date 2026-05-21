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

export function scheduleRestNotification(endTime: number, exerciseName: string): void {
  const sw = getController();
  if (!sw) return;
  sw.postMessage({ type: 'TIMER_START', endTime, exerciseName });
}

export function cancelRestNotification(): void {
  const sw = getController();
  if (!sw) return;
  sw.postMessage({ type: 'TIMER_CANCEL' });
}
