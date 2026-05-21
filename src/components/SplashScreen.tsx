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
        {/* 스피어헤드 심볼 — 두 날개가 위로 모이는 창끝 형상 */}
        <svg
          width="88"
          height="82"
          viewBox="39 -0.5 36.5 34"
          fill="none"
        >
          <path
            fill="var(--logo-color)"
            d="M57.93,32.38 c4.05-13.49,9.44-24.29,16.19-32.38 -5.4,4.05 -8.77,6.75 -10.12,8.1 -2.7,4.05 -4.72,7.42 -6.07,10.12 v14.17Z"
          />
          <path
            fill="var(--logo-color)"
            d="M56.31,32.38 c-4.05-13.49,-9.44-24.29,-16.19-32.38 5.4,4.05 8.77,6.75 10.12,8.1 2.7,4.05 4.72,7.42 6.07,10.12 v14.17Z"
          />
        </svg>

        {/* 브랜드명 */}
        <h1
          className="mt-7 text-3xl font-black tracking-wider"
          style={{ color: "var(--logo-color)" }}
        >
          스피어헤드
        </h1>
        <p
          className="mt-1.5 text-xs font-bold tracking-[0.45em] uppercase opacity-60"
          style={{ color: "var(--logo-color)" }}
        >
          Spearhead
        </p>
      </div>
    </div>
  );
}
