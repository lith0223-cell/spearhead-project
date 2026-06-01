"use client";

import { useState, useEffect, useRef } from "react";
import { playBeep, playCountdownTick, resumeAudioContext, type BeepType } from "@/utils/audio";
import { cancelRestNotification } from "@/utils/notifications";

const TIMER_KEY = "ph_timer_end";
const BEEP_TYPE_KEY = "ph_beep_type";
const BEEP_VOL_KEY = "ph_beep_volume";

function loadBeepSettings(): { type: BeepType; volume: number } {
  if (typeof window === "undefined") return { type: "single", volume: 0.7 };
  const type = (localStorage.getItem(BEEP_TYPE_KEY) as BeepType) || "single";
  const volume = parseFloat(localStorage.getItem(BEEP_VOL_KEY) || "0.7");
  return { type, volume };
}

export function GlobalTimerOverlay() {
  const [countdown, setCountdown] = useState<number | null>(null);
  const lastCountdownSecRef = useRef<number | null>(null);
  const beepFiredRef = useRef(false);
  const suppressNextBeepRef = useRef(false);
  const beepSettingsRef = useRef<{ type: BeepType; volume: number }>({ type: "single", volume: 0.7 });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 비프음 설정 초기 로드 + storage 변경 시 동기화
  useEffect(() => {
    beepSettingsRef.current = loadBeepSettings();
    const onStorage = (e: StorageEvent) => {
      if (e.key === BEEP_TYPE_KEY || e.key === BEEP_VOL_KEY) {
        beepSettingsRef.current = loadBeepSettings();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 백그라운드에서 포그라운드 복귀 시:
  // - AudioContext unlock
  // - 타이머가 이미 종료된 경우 비프음 억제 + QStash 취소
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      resumeAudioContext();
      const endStr = localStorage.getItem(TIMER_KEY);
      if (endStr) {
        const endTime = parseInt(endStr);
        if (Date.now() >= endTime) {
          // 백그라운드에서 푸시 알림으로 이미 인지 → 앱 복귀 시 비프음 X
          suppressNextBeepRef.current = true;
          beepFiredRef.current = true;
          localStorage.removeItem(TIMER_KEY);
          cancelRestNotification();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // 메인 tick — 타이머 폴링 + 카운트다운 강조음 + 종료 비프음
  useEffect(() => {
    const tick = () => {
      const endStr = localStorage.getItem(TIMER_KEY);
      if (!endStr) {
        setCountdown(null);
        lastCountdownSecRef.current = null;
        beepFiredRef.current = false;
        suppressNextBeepRef.current = false;
        return;
      }
      const remaining = Math.max(0, Math.round((parseInt(endStr) - Date.now()) / 1000));

      // 3·2·1 카운트다운 강조음 (같은 초가 두 번 울리지 않도록 가드)
      if (remaining >= 1 && remaining <= 3 && lastCountdownSecRef.current !== remaining) {
        lastCountdownSecRef.current = remaining;
        playCountdownTick(beepSettingsRef.current.volume);
      }

      // 0초 종료 비프음 (1회만 발화)
      if (remaining === 0 && !beepFiredRef.current) {
        beepFiredRef.current = true;
        localStorage.removeItem(TIMER_KEY);
        cancelRestNotification();
        if (!suppressNextBeepRef.current) {
          playBeep(beepSettingsRef.current.type, beepSettingsRef.current.volume).catch(() => {
            /* AudioContext suspended 등 무음 처리 */
          });
        }
        suppressNextBeepRef.current = false;
      }

      // UI 표시 — 3·2·1 카운트만 큰 숫자로
      if (remaining >= 1 && remaining <= 3) {
        setCountdown(remaining);
      } else {
        setCountdown(null);
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 300);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (countdown === null) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
      <span
        key={countdown}
        className="text-[160px] font-extrabold leading-none text-accent animate-in zoom-in-75 duration-150 drop-shadow-[0_0_40px_var(--accent)]"
      >
        {countdown}
      </span>
    </div>
  );
}
