export type BeepType = "single" | "double" | "rise" | "fall" | "triple";

export const BEEP_TYPES: { id: BeepType; label: string; desc: string }[] = [
  { id: "single", label: "단순 비프",    desc: "800Hz 1회" },
  { id: "double", label: "이중 비프",    desc: "짧은 2회 연속" },
  { id: "rise",   label: "상승음",       desc: "저→고 주파수" },
  { id: "fall",   label: "하강음",       desc: "고→저 주파수" },
  { id: "triple", label: "트리플 펄스",  desc: "짧은 3회 펄스" },
];

// 볼륨 허용 범위: 0 ~ 2.0 (100% 초과 시 컴프레서로 음압 부스트)
export const MAX_VOLUME = 2.0;

// iOS Safari: AudioContext를 모듈 레벨에서 단일 인스턴스로 유지
let _ctx: AudioContext | null = null;
// 컴프레서도 모듈 레벨에서 단일 인스턴스로 재사용 (잦은 생성 방지)
let _compressor: DynamicsCompressorNode | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    _ctx = new Ctor();
    _compressor = null;
  }
  return _ctx;
}

function getCompressor(ctx: AudioContext): DynamicsCompressorNode {
  if (!_compressor) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-24, ctx.currentTime);
    comp.knee.setValueAtTime(30, ctx.currentTime);
    comp.ratio.setValueAtTime(8, ctx.currentTime);
    comp.attack.setValueAtTime(0.003, ctx.currentTime);
    comp.release.setValueAtTime(0.1, ctx.currentTime);
    comp.connect(ctx.destination);
    _compressor = comp;
  }
  return _compressor;
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
  // 컴프레서를 통해 음압 부스트 (볼륨 100% 초과 시 클리핑 방지)
  gain.connect(getCompressor(ctx));
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

export async function playBeep(type: BeepType = "single", volume = 0.7): Promise<void> {
  try {
    const ctx = getCtx();
    const v = Math.max(0.001, Math.min(MAX_VOLUME, volume));

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

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
  } catch (e) {
    console.log("Audio play failed", e);
    throw e;
  }
}

// 휴식 종료 3·2·1초 전 카운트다운 강조음 (짧은 600Hz 비프)
export function playCountdownTick(volume = 0.7): void {
  try {
    const ctx = getCtx();
    const v = Math.max(0.001, Math.min(MAX_VOLUME, volume));
    const schedule = () => {
      tone(ctx, 600, 600, ctx.currentTime, 0.1, v);
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(schedule);
    } else {
      schedule();
    }
  } catch (e) {
    console.log("Audio play failed", e);
  }
}
