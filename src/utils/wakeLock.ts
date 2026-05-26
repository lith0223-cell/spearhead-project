// 화면 꺼짐 방지 (Wake Lock API)
type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

let wakeLock: WakeLockSentinelLike | null = null;

export const requestWakeLock = async () => {
  if (typeof window === "undefined") return;
  const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };
  if (!nav.wakeLock) return;
  try {
    wakeLock = await nav.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    // WakeLock은 일부 환경(시크릿 모드, 권한 거부, 백그라운드 탭 등)에서 거부될 수 있다.
    // 사용자 시나리오에는 영향이 없으므로 조용히 무시한다 — dev overlay에 잡히지 않도록 console 출력도 생략.
  }
};

export const releaseWakeLock = () => {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
    }).catch(() => {
      // 이미 해제됨
      wakeLock = null;
    });
  }
};
