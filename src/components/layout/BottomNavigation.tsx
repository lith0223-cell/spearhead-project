"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Dumbbell, Utensils, CalendarDays, Settings, Pause, Play } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const PAUSE_KEY = "ph_workout_pause";

export function BottomNavigation() {
  const pathname = usePathname();
  const [activeWorkout, setActiveWorkout] = useState<{ routineId: string; routineName: string; startTime?: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedElapsedSec, setPausedElapsedSec] = useState(0);

  useEffect(() => {
    const check = () => {
      try {
        const saved = localStorage.getItem("ph_active_workout");
        if (saved) {
          const data = JSON.parse(saved);
          const hasProgress = data.exercisesData?.some((ex: { sets: { isCompleted: boolean }[] }) =>
            ex.sets.some((s) => s.isCompleted)
          );
          if (data.routineId && data.routineName && hasProgress) {
            setActiveWorkout({ routineId: data.routineId, routineName: data.routineName, startTime: data.startTime });
            const pausedRaw = localStorage.getItem(PAUSE_KEY);
            if (pausedRaw) {
              const pausedSec = parseInt(pausedRaw);
              setIsPaused(true);
              setPausedElapsedSec(pausedSec);
              setElapsed(pausedSec);
            } else {
              setIsPaused(false);
              setPausedElapsedSec(0);
            }
            return;
          }
        }
      } catch {}
      setActiveWorkout(null);
      setIsPaused(false);
    };
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, [pathname]);

  useEffect(() => {
    if (isPaused) { setElapsed(pausedElapsedSec); return; }
    if (!activeWorkout?.startTime) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - activeWorkout.startTime!) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeWorkout?.startTime, isPaused, pausedElapsedSec]);

  const handleTogglePause = () => {
    if (isPaused) {
      // 재개: startTime을 현재 기준으로 재계산
      const newStartTime = Date.now() - pausedElapsedSec * 1000;
      try {
        const saved = localStorage.getItem("ph_active_workout");
        if (saved) {
          const data = JSON.parse(saved);
          data.startTime = newStartTime;
          localStorage.setItem("ph_active_workout", JSON.stringify(data));
          setActiveWorkout((prev) => prev ? { ...prev, startTime: newStartTime } : null);
        }
      } catch {}
      localStorage.removeItem(PAUSE_KEY);
      setIsPaused(false);
    } else {
      // 일시정지
      const cur = activeWorkout?.startTime ? Math.floor((Date.now() - activeWorkout.startTime) / 1000) : elapsed;
      setPausedElapsedSec(cur);
      setElapsed(cur);
      localStorage.setItem(PAUSE_KEY, String(cur));
      setIsPaused(true);
    }
  };

  const navItems = [
    { label: "홈",   href: "/",         icon: Home         },
    { label: "운동", href: "/routines", icon: Dumbbell     },
    { label: "식단", href: "/diet",     icon: Utensils     },
    { label: "기록", href: "/history",  icon: CalendarDays },
    { label: "설정", href: "/settings", icon: Settings     },
  ];

  if (pathname.startsWith("/workout/")) return null;

  const workoutHref = `/workout/${activeWorkout?.routineId}?resume=true`;

  return (
    <div className="z-50 shrink-0 bg-card border-t border-border">
      {/* 이어하기 배너 — 레이아웃 흐름에 포함되어 컨텐츠 영역이 자동으로 줄어듦 */}
      {activeWorkout && (
        <div className="max-w-md mx-auto px-4 pt-2">
          <div className="bg-accent text-background rounded-xl py-2.5 px-4 flex items-center gap-2.5 shadow-lg shadow-accent/20">
            <Link href={workoutHref} className="flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {!isPaused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />}
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
              <span className="text-sm font-bold truncate">{activeWorkout.routineName} 진행 중</span>
            </Link>
            {activeWorkout.startTime && (
              <button
                onClick={handleTogglePause}
                className="flex items-center gap-1.5 shrink-0 bg-black/15 rounded-lg px-2.5 py-1 active:scale-90 transition-transform"
              >
                {isPaused
                  ? <Play size={11} fill="currentColor" />
                  : <Pause size={11} fill="currentColor" />
                }
                <span className="text-xs font-mono w-10 text-left">{formatElapsed(elapsed)}</span>
              </button>
            )}
            <Link href={workoutHref} className="text-sm font-extrabold shrink-0">이어하기 →</Link>
          </div>
        </div>
      )}

      {/* 내비게이션 */}
      <div className="pb-safe">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors relative",
                  isActive ? "text-accent" : "text-muted hover:text-foreground"
                )}
              >
                <Icon size={24} strokeWidth={2} />
                <span className="text-[10px] font-medium">{item.label}</span>
                <span className={cn("w-1 h-1 rounded-full mt-0.5 transition-colors", isActive ? "bg-accent" : "bg-transparent")} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
