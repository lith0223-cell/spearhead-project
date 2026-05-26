"use client";

import { useEffect, useState } from "react";
import { useTheme, type AccentColor, type ColorMode } from "@/providers/ThemeProvider";
import { useActiveWorkout } from "@/providers/ActiveWorkoutProvider";
import { Sun, Moon, Check, Play, Minus, Plus, Download, Upload, ChevronDown, User, Palette, Bell, Database } from "lucide-react";
import { playBeep, resumeAudioContext, BEEP_TYPES, type BeepType } from "@/utils/audio";
import { exportAllData, importAllData, getLocalDateStr } from "@/utils/storage";

const ACCENT_COLORS: { id: AccentColor; hex: string; label: string }[] = [
  { id: "cyan",   hex: "#00F2FF", label: "사이언"  },
  { id: "yellow", hex: "#D4FF00", label: "옐로우"  },
  { id: "purple", hex: "#8F00FF", label: "퍼플"    },
  { id: "red",    hex: "#DF1B3F", label: "레드"    },
];

const COLOR_MODES: { id: ColorMode; label: string; Icon: typeof Sun }[] = [
  { id: "dark",  label: "다크",  Icon: Moon },
  { id: "light", label: "라이트", Icon: Sun  },
];

type SectionId = "profile" | "color" | "sound" | "data";

export default function SettingsPage() {
  const { setAccent, setMode } = useTheme();
  const { isActive } = useActiveWorkout();
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    profile: false, color: false, sound: false, data: false,
  });
  const toggle = (id: SectionId) => setOpen(p => ({ ...p, [id]: !p[id] }));

  const [currentAccent, setCurrentAccent] = useState<AccentColor>("cyan");
  const [currentMode, setCurrentMode]     = useState<ColorMode>("dark");
  const [beepType, setBeepType]           = useState<BeepType>("single");
  const [beepVolume, setBeepVolume]       = useState(0.7);
  const [userWeight, setUserWeight]       = useState(70);
  const [userHeight, setUserHeight]       = useState(170);
  const [weightDraft, setWeightDraft]     = useState("70");
  const [heightDraft, setHeightDraft]     = useState("170");

  useEffect(() => {
    const a  = (localStorage.getItem("ph_accent")      as AccentColor) || "cyan";
    const m  = (localStorage.getItem("ph_mode")        as ColorMode)   || "dark";
    const bt = (localStorage.getItem("ph_beep_type")   as BeepType)    || "single";
    const bv = parseFloat(localStorage.getItem("ph_beep_volume") || "0.7");
    const wt = parseInt(localStorage.getItem("ph_user_weight")   || "70");
    const ht = parseInt(localStorage.getItem("ph_user_height")   || "170");
    setCurrentAccent(a); setCurrentMode(m);
    setBeepType(bt); setBeepVolume(bv);
    setUserWeight(wt); setUserHeight(ht);
    setWeightDraft(String(wt)); setHeightDraft(String(ht));
  }, []);

  const handleWeightChange = (delta: number) => {
    const next = Math.max(30, Math.min(200, userWeight + delta));
    setUserWeight(next);
    setWeightDraft(String(next));
    localStorage.setItem("ph_user_weight", String(next));
  };
  const handleHeightChange = (delta: number) => {
    const next = Math.max(100, Math.min(250, userHeight + delta));
    setUserHeight(next);
    setHeightDraft(String(next));
    localStorage.setItem("ph_user_height", String(next));
  };
  const commitWeight = () => {
    const v = Math.max(30, Math.min(200, parseInt(weightDraft) || userWeight));
    setUserWeight(v);
    setWeightDraft(String(v));
    localStorage.setItem("ph_user_weight", String(v));
  };
  const commitHeight = () => {
    const v = Math.max(100, Math.min(250, parseInt(heightDraft) || userHeight));
    setUserHeight(v);
    setHeightDraft(String(v));
    localStorage.setItem("ph_user_height", String(v));
  };
  const handleAccentChange = (a: AccentColor) => { setCurrentAccent(a); setAccent(a); };
  const handleModeChange   = (m: ColorMode)   => { setCurrentMode(m);   setMode(m);   };
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
  const accentHex = ACCENT_COLORS.find(c => c.id === currentAccent)?.hex ?? "#00e5ff";

  const handleExport = () => {
    const json = exportAllData();
    const date = getLocalDateStr().replace(/-/g, "");
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `spearhead-backup-${date}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { importAllData(ev.target?.result as string); location.reload(); }
      catch { alert("파일 형식이 올바르지 않습니다."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <main className="flex flex-col h-full animate-in fade-in duration-300">
      <header className="px-6 py-6 border-b border-border bg-card sticky top-0 z-10">
        <h1 className="text-2xl font-bold">설정</h1>
      </header>

      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isActive ? "pb-24" : "pb-8"}`}>

        {/* 프로필 */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button onClick={() => toggle("profile")} className="w-full flex items-center gap-3 px-4 py-4 active:bg-background transition-colors">
            <span className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
              <User size={17} className="text-accent" />
            </span>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">프로필</p>
              <p className="text-xs text-muted mt-0.5">{userWeight}kg · {userHeight}cm</p>
            </div>
            <ChevronDown size={16} className={`text-muted transition-transform duration-200 shrink-0 ${open.profile ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open.profile ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <div className="border-t border-border px-4 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">체중</p>
                    <p className="text-xs text-muted mt-0.5">칼로리 소모량 계산</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleWeightChange(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-background border border-border text-muted active:scale-90 transition-all">
                      <Minus size={14} />
                    </button>
                    <div className="flex items-center gap-0.5 w-20 justify-center">
                      <input
                        type="number"
                        value={weightDraft}
                        onChange={(e) => setWeightDraft(e.target.value)}
                        onBlur={commitWeight}
                        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur())}
                        min={30}
                        max={200}
                        className="text-base font-extrabold w-12 text-right tabular-nums bg-transparent focus:outline-none focus:text-accent border-b border-border focus:border-accent transition-colors"
                      />
                      <span className="text-base font-extrabold text-muted shrink-0">kg</span>
                    </div>
                    <button onClick={() => handleWeightChange(1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-background border border-border text-muted active:scale-90 transition-all">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">키</p>
                    <p className="text-xs text-muted mt-0.5">신체 정보 기록</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleHeightChange(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-background border border-border text-muted active:scale-90 transition-all">
                      <Minus size={14} />
                    </button>
                    <div className="flex items-center gap-0.5 w-20 justify-center">
                      <input
                        type="number"
                        value={heightDraft}
                        onChange={(e) => setHeightDraft(e.target.value)}
                        onBlur={commitHeight}
                        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur())}
                        min={100}
                        max={250}
                        className="text-base font-extrabold w-12 text-right tabular-nums bg-transparent focus:outline-none focus:text-accent border-b border-border focus:border-accent transition-colors"
                      />
                      <span className="text-base font-extrabold text-muted shrink-0">cm</span>
                    </div>
                    <button onClick={() => handleHeightChange(1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-background border border-border text-muted active:scale-90 transition-all">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 컬러 설정 */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button onClick={() => toggle("color")} className="w-full flex items-center gap-3 px-4 py-4 active:bg-background transition-colors">
            <span className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
              <Palette size={17} className="text-accent" />
            </span>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">컬러 설정</p>
              <p className="text-xs text-muted mt-0.5">테마 · {currentMode === "dark" ? "다크" : "라이트"} 모드</p>
            </div>
            <span className="w-4 h-4 rounded-full shrink-0 mr-1 border border-white/20" style={{ backgroundColor: accentHex }} />
            <ChevronDown size={16} className={`text-muted transition-transform duration-200 shrink-0 ${open.color ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open.color ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <div className="border-t border-border px-4 py-4 space-y-5">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">테마 색상</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ACCENT_COLORS.map(({ id, hex, label }) => {
                      const active = currentAccent === id;
                      return (
                        <button key={id} onClick={() => handleAccentChange(id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-95 ${active ? "border-accent" : "border-border"}`}>
                          <span className="w-7 h-7 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                          <span className="text-sm font-medium">{label}</span>
                          {active && (
                            <span className="ml-auto w-4 h-4 rounded-full flex items-center justify-center bg-accent shrink-0">
                              <Check size={10} strokeWidth={3} className="text-background" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">화면 모드</p>
                  <div className="grid grid-cols-2 gap-2">
                    {COLOR_MODES.map(({ id, label, Icon }) => {
                      const active = currentMode === id;
                      return (
                        <button key={id} onClick={() => handleModeChange(id)}
                          className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all active:scale-95 ${active ? "border-accent" : "border-border"}`}>
                          <Icon size={24} className={active ? "text-accent" : "text-muted"} />
                          <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted"}`}>{label}</span>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 알림음 설정 */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button onClick={() => toggle("sound")} className="w-full flex items-center gap-3 px-4 py-4 active:bg-background transition-colors">
            <span className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
              <Bell size={17} className="text-accent" />
            </span>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">알림음 설정</p>
              <p className="text-xs text-muted mt-0.5">볼륨 {volumePct}% · {BEEP_TYPES.find(b => b.id === beepType)?.label ?? ""}</p>
            </div>
            <ChevronDown size={16} className={`text-muted transition-transform duration-200 shrink-0 ${open.sound ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open.sound ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <div className="border-t border-border px-4 py-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">볼륨</span>
                    <span className="text-sm font-bold text-accent">{volumePct}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={volumePct}
                    onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
                    style={{ accentColor: "var(--color-accent)" }}
                    className="w-full h-2 rounded-full cursor-pointer" />
                </div>
                <div className="space-y-2">
                  {BEEP_TYPES.map(({ id, label, desc }) => {
                    const active = beepType === id;
                    return (
                      <button key={id} onClick={() => handleBeepTypeChange(id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all active:scale-95 ${active ? "border-accent bg-card" : "border-border bg-background"}`}>
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${active ? "bg-accent" : "border border-border bg-card"}`}>
                          <Play size={12} fill="currentColor" className={active ? "text-background" : "text-muted"} />
                        </span>
                        <span className="flex-1 text-left">
                          <span className="text-sm font-semibold block">{label}</span>
                          <span className="text-xs text-muted">{desc}</span>
                        </span>
                        {active && (
                          <span className="w-4 h-4 rounded-full flex items-center justify-center bg-accent shrink-0">
                            <Check size={10} strokeWidth={3} className="text-background" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 데이터 관리 */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button onClick={() => toggle("data")} className="w-full flex items-center gap-3 px-4 py-4 active:bg-background transition-colors">
            <span className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
              <Database size={17} className="text-accent" />
            </span>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">데이터 관리</p>
              <p className="text-xs text-muted mt-0.5">백업 · 복원</p>
            </div>
            <ChevronDown size={16} className={`text-muted transition-transform duration-200 shrink-0 ${open.data ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open.data ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <div className="border-t border-border divide-y divide-border">
                <button onClick={handleExport} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-background transition-colors active:scale-[0.98]">
                  <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Download size={15} className="text-accent" />
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-semibold">데이터 내보내기</p>
                    <p className="text-xs text-muted mt-0.5">루틴·운동·식단 기록을 JSON 파일로 저장</p>
                  </div>
                </button>
                <label className="w-full flex items-center gap-3 px-4 py-4 hover:bg-background transition-colors cursor-pointer active:scale-[0.98]">
                  <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Upload size={15} className="text-accent" />
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-semibold">데이터 불러오기</p>
                    <p className="text-xs text-muted mt-0.5">이전에 저장한 백업 파일을 복원</p>
                  </div>
                  <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                </label>
                <div className="px-4 py-2.5">
                  <p className="text-xs text-muted">불러오기 시 현재 데이터를 덮어씁니다.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
