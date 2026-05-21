"use client";

import { useState, useEffect } from "react";

export function SplashScreen() {
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "done">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 350);
    const t2 = setTimeout(() => setPhase("out"),  2350);
    const t3 = setTimeout(() => setPhase("done"), 2850);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        phase === "out" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`flex flex-col items-center transition-all duration-500 ${
          phase === "in" ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
        }`}
      >
        {/* 창끝 로고 */}
        <svg width="72" height="80" viewBox="0 0 64 70" fill="none">
          {/* 외곽 창끝 — 액센트 윤곽선 */}
          <path
            d="M32 4 L60 66 L32 54 L4 66 Z"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* 내부 창끝 — 액센트 채움 */}
          <path
            d="M32 16 L50 52 L32 44 L14 52 Z"
            fill="var(--color-accent)"
          />
        </svg>

        <h1 className="mt-7 text-3xl font-black tracking-wider text-foreground">
          스피어헤드
        </h1>
        <p className="mt-1.5 text-xs font-bold tracking-[0.45em] text-accent uppercase">
          Spearhead
        </p>
      </div>
    </div>
  );
}
