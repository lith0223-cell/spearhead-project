"use client";

import { useState, useEffect, useRef } from "react";

const TIMER_KEY = "ph_timer_end";

export function GlobalTimerOverlay() {
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const tick = () => {
      const endStr = localStorage.getItem(TIMER_KEY);
      if (!endStr) {
        setCountdown(null);
        return;
      }
      const remaining = Math.max(0, Math.round((parseInt(endStr) - Date.now()) / 1000));
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
