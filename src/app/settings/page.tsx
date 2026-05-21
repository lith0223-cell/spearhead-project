"use client";

import { useEffect, useState } from "react";
import { useTheme, type AccentColor, type ColorMode } from "@/providers/ThemeProvider";
import { Sun, Moon, Check, Play } from "lucide-react";
import { playBeep, resumeAudioContext, BEEP_TYPES, type BeepType } from "@/utils/audio";

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
  const [currentMode, setCurrentMode]     = useState<ColorMode>("dark");
  const [beepType, setBeepType]           = useState<BeepType>("single");
  const [beepVolume, setBeepVolume]       = useState(0.7);

  useEffect(() => {
    const a = (localStorage.getItem("ph_accent")      as AccentColor) || "cyan";
    const m = (localStorage.getItem("ph_mode")        as ColorMode)   || "dark";
    const bt = (localStorage.getItem("ph_beep_type")  as BeepType)    || "single";
    const bv = parseFloat(localStorage.getItem("ph_beep_volume") || "0.7");
    setCurrentAccent(a);
    setCurrentMode(m);
    setBeepType(bt);
    setBeepVolume(bv);
  }, []);

  const handleAccentChange = (a: AccentColor) => {
    setCurrentAccent(a);
    setAccent(a);
  };

  const handleModeChange = (m: ColorMode) => {
    setCurrentMode(m);
    setMode(m);
  };

  const handleBeepTypeChange = (type: BeepType) => {
    resumeAudioContext();
    setBeepType(type);
    localStorage.setItem("ph_beep_type", type);
    playBeep(type, beepVolume);
  };

  const handleVolumeChange = (vol: number) => {
    setBeepVolume(vol);
    localStorage.setItem("ph_beep_volume", String(vol));
  };

  const volumePct = Math.round(beepVolume * 100);

  return (
    <main className="flex flex-col h-full animate-in fade-in duration-300">
      <header className="px-6 py-6 border-b border-border bg-card sticky top-0 z-10">
        <h1 className="text-2xl font-bold">설정</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">

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
                  <span className="w-8 h-8 rounded-full flex-shrink-0 shadow" style={{ backgroundColor: hex }} />
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
                  <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted"}`}>{label}</span>
                  {active && <span className="w-2 h-2 rounded-full bg-accent" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* 알림음 */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">알림음</h2>

          {/* 볼륨 */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">볼륨</span>
              <span className="text-sm font-bold text-accent">{volumePct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volumePct}
              onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
              style={{ accentColor: "var(--color-accent)" }}
              className="w-full h-2 rounded-full cursor-pointer"
            />
          </div>

          {/* 5가지 음원 */}
          <div className="space-y-2">
            {BEEP_TYPES.map(({ id, label, desc }) => {
              const active = beepType === id;
              return (
                <button
                  key={id}
                  onClick={() => handleBeepTypeChange(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all active:scale-95 ${
                    active ? "border-accent bg-card" : "border-border bg-card"
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    active ? "bg-accent" : "bg-background border border-border"
                  }`}>
                    <Play size={13} fill="currentColor" className={active ? "text-background" : "text-muted"} />
                  </span>
                  <span className="flex-1 text-left">
                    <span className="text-sm font-semibold block">{label}</span>
                    <span className="text-xs text-muted">{desc}</span>
                  </span>
                  {active && (
                    <span className="w-5 h-5 rounded-full flex items-center justify-center bg-accent flex-shrink-0">
                      <Check size={11} strokeWidth={3} className="text-background" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}
