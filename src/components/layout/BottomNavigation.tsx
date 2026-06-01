"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Dumbbell, Utensils, CalendarDays, Settings, Pause, Play, ChevronRight, Square } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ACTIVE_WORKOUT_EVENT, clearActiveWorkout, getActiveWorkout, updateActiveWorkoutStartTime } from "@/utils/storage";

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

const TIMER_KEY = "ph_timer_end";

export function BottomNavigation() {
  const pathname = usePathname();
  const [activeWorkout, setActiveWorkout] = useState<{ routineId: string; routineName: string; startTime?: number; currentExerciseName?: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedElapsedSec, setPausedElapsedSec] = useState(0);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      const data = getActiveWorkout();
      if (data) {
        const hasProgress = data.exercisesData?.some((ex) => ex.sets.some((s) => s.isCompleted));
        if (data.routineId && data.routineName && hasProgress) {
          const currentExerciseName = data.exercisesData?.[data.currentExIndex ?? 0]?.name;
          setActiveWorkout({ routineId: data.routineId, routineName: data.routineName, startTime: data.startTime, currentExerciseName });
          const pausedRaw = localStorage.getItem(PAUSE_KEY);
          if (pausedRaw) {
            const pausedSec = parseInt(pausedRaw);
            if (!isNaN(pausedSec)) {
              setIsPaused(true);
              setPausedElapsedSec(pausedSec);
              setElapsed(pausedSec);
              return;
            }
          }
          setIsPaused(false);
          setPausedElapsedSec(0);
          return;
        }
      }
      setActiveWorkout(null);
      setIsPaused(false);
    };
    check();
    // 같은 탭의 변경은 커스텀 이벤트로, 다른 탭은 storage 이벤트로 감지
    window.addEventListener(ACTIVE_WORKOUT_EVENT, check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener(ACTIVE_WORKOUT_EVENT, check);
      window.removeEventListener("storage", check);
    };
  }, [pathname]);

  useEffect(() => {
    if (isPaused) { setElapsed(pausedElapsedSec); return; }
    if (!activeWorkout?.startTime) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - activeWorkout.startTime!) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeWorkout?.startTime, isPaused, pausedElapsedSec]);

  useEffect(() => {
    const tick = () => {
      const endStr = localStorage.getItem(TIMER_KEY);
      if (!endStr) { setRestSeconds(null); return; }
      const remaining = Math.max(0, Math.round((parseInt(endStr) - Date.now()) / 1000));
      setRestSeconds(remaining > 0 ? remaining : null);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  const handleAbortWorkout = () => {
    clearActiveWorkout();
    localStorage.removeItem(PAUSE_KEY);
    setShowAbortConfirm(false);
  };

  const handleTogglePause = () => {
    if (isPaused) {
      // 재개: startTime을 현재 기준으로 재계산
      const newStartTime = Date.now() - pausedElapsedSec * 1000;
      updateActiveWorkoutStartTime(newStartTime);
      setActiveWorkout((prev) => prev ? { ...prev, startTime: newStartTime } : null);
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
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* 이어하기 배너 — absolute로 네비바 위에 부유, 배경 완전 투명 */}
      {activeWorkout && (
        <div className="absolute bottom-full left-0 right-0 px-4 pb-2 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
          <div className="bg-gradient-to-r from-accent to-accent/80 text-background rounded-2xl py-3 px-4 flex items-center gap-2.5 shadow-xl shadow-accent/40">
            <Link href={workoutHref} className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {!isPaused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />}
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate leading-tight">{activeWorkout.routineName} 진행 중</p>
                {restSeconds !== null ? (
                  <p className="text-xs font-medium opacity-90 truncate leading-tight">휴식 중 · {restSeconds}초</p>
                ) : activeWorkout.currentExerciseName ? (
                  <p className="text-xs font-medium opacity-75 truncate leading-tight">{activeWorkout.currentExerciseName}</p>
                ) : null}
              </div>
            </Link>
            {activeWorkout.startTime && (
              <button
                onClick={handleTogglePause}
                aria-label={isPaused ? "운동 재개" : "운동 일시정지"}
                className="flex items-center gap-1.5 shrink-0 bg-black/15 rounded-lg px-2.5 py-1 active:scale-90 transition-transform"
              >
                {isPaused
                  ? <Play size={11} fill="currentColor" />
                  : <Pause size={11} fill="currentColor" />
                }
                <span className="text-xs font-mono tabular-nums">{formatElapsed(elapsed)}</span>
              </button>
            )}
            <button
              onClick={() => setShowAbortConfirm(true)}
              aria-label="운동 중단"
              className="shrink-0 flex items-center justify-center w-8 h-8 bg-black/20 rounded-xl active:scale-90 transition-transform"
            >
              <Square size={13} fill="currentColor" />
            </button>
            <Link href={workoutHref} className="shrink-0 flex items-center justify-center w-8 h-8 bg-white/20 rounded-xl active:scale-90 transition-transform">
              <ChevronRight size={16} strokeWidth={3} />
            </Link>
          </div>
          </div>
        </div>
      )}

      {/* 운동 중단 확인 팝업 */}
      {showAbortConfirm && (
        <div
          className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/40"
          onClick={() => setShowAbortConfirm(false)}
        >
          <div
            className="bg-card border-t border-border rounded-t-3xl p-6 pb-safe max-w-md mx-auto w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold mb-2">운동을 중단할까요?</h2>
            <p className="text-sm text-muted mb-6">중단하면 현재까지의 운동 데이터는 저장되지 않습니다.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAbortWorkout}
                className="w-full py-4 bg-danger text-white rounded-2xl font-extrabold active:scale-95 transition-transform"
              >
                운동 중단
              </button>
              <button
                onClick={() => setShowAbortConfirm(false)}
                className="w-full py-4 bg-background border border-border rounded-2xl font-bold active:scale-95 transition-transform"
              >
                계속하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 내비게이션 */}
      <div className="bg-card border-t border-border pb-safe">
        <div className="flex justify-around items-center h-20 max-w-md mx-auto px-4">
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
