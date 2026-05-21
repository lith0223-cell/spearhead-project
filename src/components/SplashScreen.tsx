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
        {/* 스피어헤드 로고 — 다크: invert+screen(화이트), 라이트: multiply(검정) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/spearhead-logo.png"
          alt="스피어헤드"
          className="logo-img w-52 h-auto select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
