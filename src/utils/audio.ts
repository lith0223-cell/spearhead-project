export type BeepType = "single" | "double" | "rise" | "fall" | "triple";

export const BEEP_TYPES: { id: BeepType; label: string; desc: string }[] = [
  { id: "single", label: "단순 비프",    desc: "800Hz 1회" },
  { id: "double", label: "이중 비프",    desc: "짧은 2회 연속" },
  { id: "rise",   label: "상승음",       desc: "저→고 주파수" },
  { id: "fall",   label: "하강음",       desc: "고→저 주파수" },
  { id: "triple", label: "트리플 펄스",  desc: "짧은 3회 펄스" },
];

// iOS Safari: AudioContext를 모듈 레벨에서 단일 인스턴스로 유지
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    _ctx = new Ctor();
  }
  return _ctx;
}

// 사용자 제스처 시점에 호출 → iOS AudioContext 잠금 해제
export function resumeAudioContext(): void {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    // ignore
  }
}

function tone(
  ctx: AudioContext,
  freqStart: number,
  freqEnd: number,
  startTime: number,
  duration: number,
  volume: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freqStart, startTime);
  if (freqEnd !== freqStart) {
    osc.frequency.linearRampToValueAtTime(freqEnd, startTime + duration);
  }
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

export function playBeep(type: BeepType = "single", volume = 0.7): void {
  try {
    const ctx = getCtx();
    const v = Math.max(0.001, Math.min(1, volume));

    const schedule = () => {
      const t = ctx.currentTime;
      switch (type) {
        case "single":
          tone(ctx, 800, 800, t, 0.7, v);
          break;
        case "double":
          tone(ctx, 880, 880, t,        0.12, v);
          tone(ctx, 880, 880, t + 0.22, 0.12, v);
          break;
        case "rise":
          tone(ctx, 500, 1100, t, 0.6, v);
          break;
        case "fall":
          tone(ctx, 1100, 500, t, 0.6, v);
          break;
        case "triple":
          tone(ctx, 900, 900, t,        0.08, v);
          tone(ctx, 900, 900, t + 0.15, 0.08, v);
          tone(ctx, 900, 900, t + 0.30, 0.08, v);
          break;
      }
    };

    // resume()은 비동기 — 컨텍스트가 완전히 running 상태가 된 후 스케줄링
    if (ctx.state === "suspended") {
      ctx.resume().then(schedule);
    } else {
      schedule();
    }
  } catch (e) {
    console.log("Audio play failed", e);
  }
}
