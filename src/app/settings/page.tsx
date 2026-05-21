"use client";

import { useEffect, useState } from "react";
import { useTheme, type AccentColor, type ColorMode } from "@/providers/ThemeProvider";
import { Sun, Moon, Check } from "lucide-react";

const ACCENT_COLORS: { id: AccentColor; hex: string; label: string }[] = [
  { id: "yellow", hex: "#fede24", label: "옐로우" },
  { id: "cyan",   hex: "#00e5ff", label: "사이언" },
  { id: "red",    hex: "#df1b3f", label: "레드"   },
  { id: "green",  hex: "#a6ff00", label: "그린"   },
];

const COLOR_MODES: { id: ColorMode; label: string; Icon: typeof Sun }[] = [
  { id: "dark",  label: "다크 모드",  Icon: Moon },
  { id: "light", label: "라이트 모드", Icon: Sun  },
];

export default function SettingsPage() {
  const { setAccent, setMode } = useTheme();

  const [currentAccent, setCurrentAccent] = useState<AccentColor>("cyan");
  const [currentMode, setCurrentMode] = useState<ColorMode>("dark");

  useEffect(() => {
    const a = (localStorage.getItem("ph_accent") as AccentColor) || "cyan";
    const m = (localStorage.getItem("ph_mode") as ColorMode) || "dark";
    setCurrentAccent(a);
    setCurrentMode(m);
  }, []);

  const handleAccentChange = (a: AccentColor) => {
    setCurrentAccent(a);
    setAccent(a);
  };

  const handleModeChange = (m: ColorMode) => {
    setCurrentMode(m);
    setMode(m);
  };

  return (
    <main className="flex flex-col h-full animate-in fade-in duration-300">
      <header className="px-6 py-6 border-b border-border bg-card sticky top-0 z-10">
        <h1 className="text-2xl font-bold">설정</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-24">

        {/* 컬러 테마 */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">컬러 테마</h2>
          <div className="grid grid-cols-2 gap-3">
            {ACCENT_COLORS.map(({ id, hex, label }) => {
              const active = currentAccent === id;
              return (
                <button
                  key={id}
                  onClick={() => handleAccentChange(id)}
                  className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-95 ${
                    active ? "border-accent bg-card" : "border-border bg-card"
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-full flex-shrink-0 shadow"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="font-medium text-sm">{label}</span>
                  {active && (
                    <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center bg-accent">
                      <Check size={12} strokeWidth={3} className="text-background" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 화면 모드 */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">화면 모드</h2>
          <div className="grid grid-cols-2 gap-3">
            {COLOR_MODES.map(({ id, label, Icon }) => {
              const active = currentMode === id;
              return (
                <button
                  key={id}
                  onClick={() => handleModeChange(id)}
                  className={`flex flex-col items-center gap-3 py-6 rounded-2xl border-2 transition-all active:scale-95 ${
                    active ? "border-accent bg-card" : "border-border bg-card"
                  }`}
                >
                  <Icon size={28} className={active ? "text-accent" : "text-muted"} />
                  <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted"}`}>
                    {label}
                  </span>
                  {active && <span className="w-2 h-2 rounded-full bg-accent" />}
                </button>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}
