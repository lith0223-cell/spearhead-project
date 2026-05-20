"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme, type AccentColor, type ColorMode } from "@/providers/ThemeProvider";
import { Sun, Moon, Check, Save } from "lucide-react";

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

  const [draftAccent, setDraftAccent] = useState<AccentColor>("cyan");
  const [draftMode, setDraftMode] = useState<ColorMode>("dark");
  const [justSaved, setJustSaved] = useState(false);

  // 저장된 값 추적 (hasChanges 비교 기준)
  const savedRef = useRef<{ accent: AccentColor; mode: ColorMode }>({
    accent: "cyan",
    mode: "dark",
  });

  // localStorage에서 초기값 로드
  useEffect(() => {
    const a = (localStorage.getItem("ph_accent") as AccentColor) || "cyan";
    const m = (localStorage.getItem("ph_mode") as ColorMode) || "dark";
    setDraftAccent(a);
    setDraftMode(m);
    savedRef.current = { accent: a, mode: m };
  }, []);

  // 페이지 이탈 시 저장 안 된 변경사항 DOM 되돌리기
  useEffect(() => {
    return () => {
      document.documentElement.setAttribute("data-accent", savedRef.current.accent);
      document.documentElement.setAttribute("data-mode", savedRef.current.mode);
    };
  }, []);

  const handleAccentChange = (a: AccentColor) => {
    setDraftAccent(a);
    document.documentElement.setAttribute("data-accent", a);
    setJustSaved(false);
  };

  const handleModeChange = (m: ColorMode) => {
    setDraftMode(m);
    document.documentElement.setAttribute("data-mode", m);
    setJustSaved(false);
  };

  const handleSave = () => {
    setAccent(draftAccent);
    setMode(draftMode);
    savedRef.current = { accent: draftAccent, mode: draftMode };
    setJustSaved(true);
  };

  const hasChanges =
    draftAccent !== savedRef.current.accent ||
    draftMode !== savedRef.current.mode;

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
              const active = draftAccent === id;
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
              const active = draftMode === id;
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

      {/* 저장 버튼 - 하단 고정 */}
      <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-6 pb-4 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <button
          onClick={handleSave}
          disabled={!hasChanges && !justSaved}
          className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
            justSaved
              ? "bg-success/20 text-success border-2 border-success/40"
              : hasChanges
              ? "bg-foreground text-background shadow-lg"
              : "bg-card text-muted border-2 border-border"
          }`}
        >
          {justSaved ? (
            <>
              <Check size={18} strokeWidth={3} />
              저장됨
            </>
          ) : (
            <>
              <Save size={18} />
              저장하기
            </>
          )}
        </button>
      </div>
    </main>
  );
}
