"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Minus, Pencil, Plus, Square, Timer, Trash2 } from "lucide-react";
import {
  getRoutines,
  getLastSessionByExercise,
  getRecentSessionsByExercise,
  getWorkoutSessions,
  calculate1RM,
  saveWorkoutSession,
  getActiveWorkout,
  setActiveWorkout,
  clearActiveWorkout,
} from "@/utils/storage";
import { requestWakeLock, releaseWakeLock } from "@/utils/wakeLock";
import { playBeep, resumeAudioContext, type BeepType } from "@/utils/audio";
import {
  scheduleRestNotification,
  cancelRestNotification,
  requestNotificationPermission,
} from "@/utils/notifications";
import { ExerciseRecord, Routine, SetRecord, WorkoutSession } from "@/types";
import { Drawer } from "@/components/ui/Drawer";

const KG_TO_LB = 2.20462;
const MAX_REST_SECONDS = 240;
const REST_STEP = 30;
const DEFAULT_REST = 60;
const TIMER_STORAGE_KEY = "ph_timer_end";

export default function WorkoutClient({ routineId }: { routineId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldAutoResume = searchParams.get("resume") === "true";

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [exercisesData, setExercisesData] = useState<ExerciseRecord[]>([]);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [isEditMode, setIsEditMode] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [summary, setSummary] = useState<{ exercises: number; sets: number; durationSec: number; calories: number; volumeDiff: number | null } | null>(null);

  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerInitial, setTimerInitial] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  // 절대 timestamp 기반 타이머 — 백그라운드에서도 정확히 작동
  const timerEndTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 비프음 설정 — stale closure 없이 최신값 보장
  const beepSettingsRef = useRef<{ type: BeepType; volume: number }>({ type: "single", volume: 0.7 });

  // 현재 운동명 ref (알림 메시지용)
  const currentExNameRef = useRef<string>("");
  // 알림 권한 요청 여부 (세션 내 중복 요청 방지)
  const notifPermAskedRef = useRef(false);
  const savedExDataRef = useRef<ExerciseRecord[]>([]);
  const savedExIndexRef = useRef(0);
  const workoutStartTimeRef = useRef<number | null>(null);

  // 타이머 tick — ref 기반이므로 stale closure 없음
  const tick = () => {
    if (timerEndTimeRef.current === null) return;
    const remaining = Math.max(0, Math.round((timerEndTimeRef.current - Date.now()) / 1000));
    setTimerSeconds(remaining);
    if (remaining === 0) {
      setIsTimerRunning(false);
      timerEndTimeRef.current = null;
      localStorage.removeItem(TIMER_STORAGE_KEY);
      cancelRestNotification(); // 앱이 포그라운드이므로 SW 알림 취소 후 비프음으로 대체
      playBeep(beepSettingsRef.current.type, beepSettingsRef.current.volume);
    }
  };

  // isTimerRunning 변경 시 interval 시작/정지
  useEffect(() => {
    if (isTimerRunning) {
      tick();
      intervalRef.current = setInterval(tick, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTimerRunning]);

  // 탭/앱이 포그라운드로 돌아올 때 즉시 재계산
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    const routines = getRoutines();
    const found = routines.find((r) => r.id === routineId);
    if (!found) {
      alert("루틴을 찾을 수 없습니다.");
      router.push("/routines");
      return;
    }

    setRoutine(found);
    requestWakeLock();

    // 비프음 설정 로드
    const beepType = (localStorage.getItem("ph_beep_type") as BeepType) || "single";
    const beepVolume = parseFloat(localStorage.getItem("ph_beep_volume") || "0.7");
    beepSettingsRef.current = { type: beepType, volume: beepVolume };

    // 현재 운동명 초기화
    currentExNameRef.current = found.exercises[0] ?? "";

    const initialData: ExerciseRecord[] = found.exercises.map((name) => {
      const routineConfig = found.exerciseConfigs?.find((c) => c.name === name);
      const lastSession = getLastSessionByExercise(name);
      const lastEx = lastSession?.exercises.find((e) => e.name === name);

      let sets: SetRecord[];
      if (routineConfig && routineConfig.sets.length > 0) {
        sets = routineConfig.sets.map((s) => ({
          id: crypto.randomUUID(),
          weight: s.weight,
          reps: s.reps,
          isCompleted: false,
          restTime: s.restTime,
        }));
      } else if (lastEx && lastEx.sets.length > 0) {
        sets = lastEx.sets.map((s) => ({
          ...s,
          id: crypto.randomUUID(),
          isCompleted: false,
          restTime: s.restTime || DEFAULT_REST,
        }));
      } else {
        sets = [{ id: crypto.randomUUID(), weight: 0, reps: 0, isCompleted: false, restTime: DEFAULT_REST }];
      }
      return { id: name, name, sets };
    });
    // 이전 세션 복원 확인
    const saved = getActiveWorkout();
    let resumedFromSave = false;
    if (saved && saved.routineId === routineId) {
      const hasProgress = saved.exercisesData?.some((ex) => ex.sets.some((s) => s.isCompleted));
      if (hasProgress) {
        savedExDataRef.current = saved.exercisesData;
        savedExIndexRef.current = saved.currentExIndex ?? 0;
        workoutStartTimeRef.current = saved.startTime ?? Date.now();
        if (shouldAutoResume) {
          // 배너에서 진입 시 프롬프트 없이 즉시 복원
          setExercisesData(saved.exercisesData);
          setCurrentExIndex(saved.currentExIndex ?? 0);
          resumedFromSave = true;
        } else {
          setShowResumePrompt(true);
        }
      }
    }
    if (!resumedFromSave) {
      setExercisesData(initialData);
    }

    // 이전에 실행 중이던 타이머 복원 (화면 이탈 후 복귀 시)
    const storedEnd = localStorage.getItem(TIMER_STORAGE_KEY);
    if (storedEnd) {
      const endTime = parseInt(storedEnd);
      const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      if (remaining > 0) {
        timerEndTimeRef.current = endTime;
        setTimerSeconds(remaining);
        setTimerInitial(remaining);
        setIsTimerRunning(true);
        scheduleRestNotification(endTime, found.exercises[0] ?? "운동");
      } else {
        localStorage.removeItem(TIMER_STORAGE_KEY);
      }
    }

    return () => {
      releaseWakeLock();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [routineId, router, shouldAutoResume]);

  // 진행 중 운동 세션 자동 저장
  useEffect(() => {
    if (!routine || exercisesData.length === 0 || showResumePrompt) return;
    const hasProgress = exercisesData.some((ex) => ex.sets.some((s) => s.isCompleted));
    if (!hasProgress) return;
    if (workoutStartTimeRef.current === null) {
      workoutStartTimeRef.current = Date.now();
    }
    setActiveWorkout({
      routineId: routine.id,
      routineName: routine.name,
      exercisesData,
      currentExIndex,
      startTime: workoutStartTimeRef.current,
    });
  }, [exercisesData, currentExIndex, routine, showResumePrompt]);

  const handleResume = () => {
    setExercisesData(savedExDataRef.current);
    setCurrentExIndex(savedExIndexRef.current);
    setShowResumePrompt(false);
  };

  const handleFresh = () => {
    clearActiveWorkout();
    setShowResumePrompt(false);
  };

  const startTimer = (seconds: number, exerciseName?: string) => {
    const clamped = Math.min(seconds, MAX_REST_SECONDS);
    const endTime = Date.now() + clamped * 1000;
    timerEndTimeRef.current = endTime;
    localStorage.setItem(TIMER_STORAGE_KEY, String(endTime));
    setTimerSeconds(clamped);
    setTimerInitial(clamped);
    setIsTimerRunning(true);
    scheduleRestNotification(endTime, exerciseName ?? currentExNameRef.current);
  };

  const adjustTimer = (delta: number) => {
    if (timerEndTimeRef.current === null) return;
    const newEndTime = timerEndTimeRef.current + delta * 1000;
    const remaining = Math.max(0, Math.round((newEndTime - Date.now()) / 1000));
    if (remaining <= 0 || remaining > MAX_REST_SECONDS) return;
    timerEndTimeRef.current = newEndTime;
    localStorage.setItem(TIMER_STORAGE_KEY, String(newEndTime));
    setTimerSeconds(remaining);
    if (remaining > timerInitial) setTimerInitial(remaining);
    scheduleRestNotification(newEndTime, currentExNameRef.current);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(0);
    timerEndTimeRef.current = null;
    localStorage.removeItem(TIMER_STORAGE_KEY);
    cancelRestNotification();
  };

  const toggleUnit = () => {
    const newUnit = unit === "kg" ? "lb" : "kg";
    const factor = newUnit === "lb" ? KG_TO_LB : 1 / KG_TO_LB;
    setExercisesData((prev) =>
      prev.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => ({
          ...s,
          weight: s.weight > 0 ? Math.round(s.weight * factor) : 0,
        })),
      }))
    );
    setUnit(newUnit);
  };

  const updateSetRestTime = (exIdx: number, setIdx: number, delta: number) => {
    setExercisesData((prev) => {
      const next = [...prev];
      const set = { ...next[exIdx].sets[setIdx] };
      const current = set.restTime || DEFAULT_REST;
      set.restTime = Math.max(REST_STEP, Math.min(MAX_REST_SECONDS, current + delta));
      next[exIdx] = { ...next[exIdx], sets: next[exIdx].sets.map((s, i) => (i === setIdx ? set : s)) };
      return next;
    });
  };

  const handleSetToggle = (exIdx: number, setIdx: number) => {
    resumeAudioContext(); // iOS: AudioContext 잠금 해제
    if (!notifPermAskedRef.current) {
      notifPermAskedRef.current = true;
      requestNotificationPermission(); // 첫 세트 완료 시 알림 권한 요청
    }
    setExercisesData((prev) => {
      const next = prev.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, si) => {
            if (si !== setIdx) return s;
            const toggled = { ...s, isCompleted: !s.isCompleted };
            if (toggled.isCompleted) {
              currentExNameRef.current = ex.name;
              const isLastEx = exIdx === prev.length - 1;
              const willFinishEx = ex.sets.every((s2, si2) => si2 === setIdx || s2.isCompleted);
              if (!(isLastEx && willFinishEx)) {
                startTimer(toggled.restTime || DEFAULT_REST, ex.name);
              }
            }
            return toggled;
          }),
        };
      });

      const allCompleted = next[exIdx].sets.every((s) => s.isCompleted);
      if (allCompleted && !prev[exIdx].sets[setIdx].isCompleted && exIdx < prev.length - 1) {
        setTimeout(() => {
          setCurrentExIndex(exIdx + 1);
          currentExNameRef.current = next[exIdx + 1]?.name ?? "";
        }, 500);
      }
      return next;
    });
  };

  const updateSet = (exIdx: number, setIdx: number, field: "weight" | "reps", value: number) => {
    setExercisesData((prev) =>
      prev.map((ex, ei) =>
        ei !== exIdx
          ? ex
          : { ...ex, sets: ex.sets.map((s, si) => (si !== setIdx ? s : { ...s, [field]: value })) }
      )
    );
  };

  const addSet = (exIdx: number) => {
    setExercisesData((prev) => {
      const next = [...prev];
      const sets = next[exIdx].sets;
      const last = sets[sets.length - 1];
      return next.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: [
                ...ex.sets,
                {
                  id: crypto.randomUUID(),
                  weight: last?.weight ?? 0,
                  reps: last?.reps ?? 0,
                  isCompleted: false,
                  restTime: last?.restTime ?? DEFAULT_REST,
                },
              ],
            }
      );
    });
  };

  const deleteSet = (exIdx: number, setIdx: number) => {
    setExercisesData((prev) => {
      if (prev[exIdx].sets.length <= 1) return prev;
      return prev.map((ex, i) =>
        i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) }
      );
    });
  };

  const finishWorkout = () => {
    if (!routine) return;
    const exercisesInKg = exercisesData.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        weight: unit === "lb" ? Math.round(s.weight / KG_TO_LB) : s.weight,
      })),
    }));
    const allSessions = getWorkoutSessions();
    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      routineId: routine.id,
      date: new Date().toISOString(),
      exercises: exercisesInKg,
    };
    saveWorkoutSession(session);
    stopTimer();
    cancelRestNotification();
    localStorage.removeItem(TIMER_STORAGE_KEY);
    clearActiveWorkout();

    const completedExercises = exercisesInKg.filter((ex) => ex.sets.some((s) => s.isCompleted)).length;
    const totalSets = exercisesInKg.flatMap((ex) => ex.sets).filter((s) => s.isCompleted).length;
    const durationSec = workoutStartTimeRef.current ? Math.floor((Date.now() - workoutStartTimeRef.current) / 1000) : 0;
    const userWeight = parseInt(localStorage.getItem("ph_user_weight") || "70");
    let calories = 0;
    for (const ex of exercisesInKg) {
      const exCategory = routine.exerciseConfigs?.find((c) => c.name === ex.name)?.category;
      const isCardio = exCategory === "유산소";
      for (const s of ex.sets) {
        if (!s.isCompleted) continue;
        if (isCardio) {
          calories += 7.5 * userWeight * ((s.reps || 0) / 60);
        } else {
          calories += 4.5 * userWeight * ((40 + (s.restTime || 60)) / 3600);
        }
      }
    }
    const prevSession = [...allSessions]
      .filter(s => s.routineId === routine.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const prevVolume = prevSession
      ? prevSession.exercises.flatMap(e => e.sets).filter((s) => s.isCompleted).reduce((sum: number, s) => sum + s.weight * s.reps, 0)
      : null;
    const curVolume = exercisesInKg.flatMap(e => e.sets).filter((s) => s.isCompleted).reduce((sum: number, s) => sum + s.weight * s.reps, 0);
    const volumeDiff = (prevVolume !== null && prevVolume > 0)
      ? Math.round(((curVolume - prevVolume) / prevVolume) * 100)
      : null;
    setSummary({ exercises: completedExercises, sets: totalSets, durationSec, calories: Math.round(calories), volumeDiff });
  };

  const todayStats = useMemo(() => {
    const ex = exercisesData[currentExIndex];
    if (!ex) return null;
    const isCardio = routine?.exerciseConfigs?.find((c) => c.name === ex.name)?.category === "유산소";
    const done = ex.sets.filter((s) => s.isCompleted && s.reps > 0);
    if (done.length === 0) return null;
    if (isCardio) {
      return {
        isCardio: true as const,
        totalDist: done.reduce((sum, s) => sum + (s.weight || 0), 0),
        totalMin: done.reduce((sum, s) => sum + (s.reps || 0), 0),
      };
    }
    const doneWeighted = done.filter((s) => s.weight > 0);
    if (doneWeighted.length === 0) return null;
    const toUnit = (w: number) => unit === "lb" ? Math.round(w * KG_TO_LB) : w;
    return {
      isCardio: false as const,
      maxRM:      Math.max(...doneWeighted.map((s) => calculate1RM(toUnit(s.weight), s.reps))),
      maxWeight:  Math.max(...doneWeighted.map((s) => toUnit(s.weight))),
      totalVolume: doneWeighted.reduce((sum, s) => sum + toUnit(s.weight) * s.reps, 0),
    };
  }, [exercisesData, currentExIndex, unit, routine]);

  const recentSessions = useMemo(() => {
    const ex = exercisesData[currentExIndex];
    if (!ex) return [];
    return getRecentSessionsByExercise(ex.name, 7);
  }, [exercisesData, currentExIndex]);

  if (!routine || exercisesData.length === 0) return null;

  const currentExercise = exercisesData[currentExIndex];
  const lastSession = getLastSessionByExercise(currentExercise.name);
  const lastEx = lastSession?.exercises.find((e) => e.name === currentExercise.name);
  const isCardioExercise = routine.exerciseConfigs?.find((c) => c.name === currentExercise.name)?.category === "유산소";

  const formatRestTime = (sec: number) => `${sec}초`;

  return (
    <>
    <div className="flex flex-col h-[100dvh] bg-background">
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-background z-20">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-muted hover:text-foreground">
          <ChevronLeft size={24} />
        </button>
        <div className="flex gap-1.5">
          {routine.exercises.map((_, idx) => {
            const exDone = exercisesData[idx]?.sets.length > 0 && exercisesData[idx].sets.every(s => s.isCompleted);
            return (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentExIndex ? "w-6 bg-accent" :
                  exDone ? "bg-success" : "bg-border"
                }`}
              />
            );
          })}
        </div>
        {exercisesData.some(ex => ex.sets.some(s => s.isCompleted)) ? (
          <button
            onClick={() => setShowFinishConfirm(true)}
            className="flex items-center gap-1 bg-danger/10 border border-danger/25 text-danger rounded-lg px-2.5 py-1.5 text-xs font-bold active:scale-95 transition-all"
          >
            <Square size={10} fill="currentColor" />
            마무리
          </button>
        ) : (
          <div className="w-16" />
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-48">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold">{currentExercise.name}</h1>
            {lastEx && lastEx.sets.filter(s => s.isCompleted).length > 0 && (
              <p className="text-sm text-muted mt-2">
                {isCardioExercise ? (
                  <>
                    지난번:{" "}
                    {lastEx.sets.filter((s) => s.isCompleted).reduce((sum, s) => sum + (s.weight || 0), 0).toFixed(1)}km{" "}
                    / {lastEx.sets.filter((s) => s.isCompleted).reduce((sum, s) => sum + (s.reps || 0), 0)}분
                  </>
                ) : (
                  <>
                    지난번 최고기록:{" "}
                    {Math.max(...lastEx.sets.filter((s) => s.isCompleted).map((s) => s.weight))}kg x{" "}
                    {Math.max(...lastEx.sets.filter((s) => s.isCompleted).map((s) => s.reps))}회
                  </>
                )}
              </p>
            )}
          </div>
          {!isCardioExercise && (
            <button
              onClick={toggleUnit}
              className="px-3 py-1 bg-card border border-border rounded-lg text-sm font-bold active:scale-95"
            >
              {unit.toUpperCase()}
            </button>
          )}
        </div>

        {/* Sets */}
        <div className="space-y-3">
          <div className="flex text-xs font-medium text-muted px-2 mb-2 items-center">
            <span className="w-8 text-center">{isCardioExercise ? "구간" : "세트"}</span>
            <span className="flex-1 text-center">{isCardioExercise ? "거리 (km)" : `무게 (${unit})`}</span>
            <span className="flex-1 text-center">{isCardioExercise ? "시간 (분)" : "횟수"}</span>
            {!isCardioExercise && <span className="w-24 text-center">휴식</span>}
            <span className={`${isCardioExercise ? "w-10" : "w-10"} text-center`}>완료</span>
            <button
              onClick={() => setIsEditMode((p) => !p)}
              title={isEditMode ? "편집 완료" : "세트 편집 (삭제 활성화)"}
              className={`w-8 flex items-center justify-center rounded transition-colors ${
                isEditMode ? "text-danger" : "text-muted hover:text-foreground"
              }`}
            >
              <Pencil size={13} />
            </button>
          </div>

          {currentExercise.sets.map((set, sIdx) => (
            <div key={set.id}>
              <div className={`flex items-center p-2.5 rounded-2xl border transition-all ${set.isCompleted ? "bg-success/10 border-success/30" : "bg-card border-border"}`}>
                <span className={`w-8 text-center font-bold text-sm ${set.isCompleted ? "text-success" : "text-muted"}`}>
                  {sIdx + 1}
                </span>

                <div className="flex-1 flex justify-center px-1">
                  <input
                    type="number" inputMode="decimal"
                    value={set.weight || ""}
                    onChange={(e) => updateSet(currentExIndex, sIdx, "weight", Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className={`w-14 text-center bg-transparent text-lg font-bold focus:outline-none focus:text-accent transition-colors ${set.isCompleted ? "text-success opacity-80" : ""}`}
                    disabled={set.isCompleted}
                  />
                </div>

                <div className="flex-1 flex justify-center px-1">
                  <input
                    type="number" inputMode="decimal"
                    value={set.reps || ""}
                    onChange={(e) => updateSet(currentExIndex, sIdx, "reps", Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className={`w-14 text-center bg-transparent text-lg font-bold focus:outline-none focus:text-accent transition-colors ${set.isCompleted ? "text-success opacity-80" : ""}`}
                    disabled={set.isCompleted}
                  />
                </div>

                {!isCardioExercise && (
                  <div className="w-24 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateSetRestTime(currentExIndex, sIdx, -REST_STEP)}
                      disabled={set.isCompleted || (set.restTime || DEFAULT_REST) <= REST_STEP}
                      className="w-6 h-6 flex items-center justify-center text-muted hover:text-foreground disabled:opacity-20"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-bold text-muted whitespace-nowrap">
                      {formatRestTime(set.restTime || DEFAULT_REST)}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateSetRestTime(currentExIndex, sIdx, REST_STEP)}
                      disabled={set.isCompleted || (set.restTime || DEFAULT_REST) >= MAX_REST_SECONDS}
                      className="w-6 h-6 flex items-center justify-center text-muted hover:text-foreground disabled:opacity-20"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => handleSetToggle(currentExIndex, sIdx)}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 ${set.isCompleted ? "bg-success text-white shadow-lg shadow-success/30" : "bg-background border-2 border-border text-muted hover:border-accent"}`}
                >
                  {set.isCompleted ? <Check strokeWidth={3} size={18} /> : null}
                </button>

                {isEditMode ? (
                  <button
                    onClick={() => deleteSet(currentExIndex, sIdx)}
                    disabled={currentExercise.sets.length <= 1 || set.isCompleted}
                    className="w-8 flex items-center justify-center text-danger disabled:opacity-20 transition-colors animate-in fade-in duration-150"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <div className="w-8" />
                )}
              </div>
              {lastEx?.sets[sIdx] && (
                <p className="text-xs text-muted mt-1 pr-1 text-right">
                  지난번:{" "}
                  {unit === "lb"
                    ? Math.round(lastEx.sets[sIdx].weight * KG_TO_LB)
                    : lastEx.sets[sIdx].weight}
                  {unit} × {lastEx.sets[sIdx].reps}회
                </p>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => addSet(currentExIndex)}
          className="w-full mt-4 py-3 border-2 border-dashed border-border rounded-2xl text-muted font-bold hover:text-foreground hover:border-muted transition-colors"
        >
          + {isCardioExercise ? "구간 추가" : "세트 추가"}
        </button>

        {/* 금일 기록 */}
        {todayStats && (
          <div className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-2xl animate-in fade-in duration-300">
            <p className="text-sm font-semibold mb-3">금일 기록</p>
            {todayStats.isCardio ? (
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-[11px] text-muted mb-0.5">총 거리</p>
                  <p className="text-xl font-extrabold text-accent">{todayStats.totalDist.toFixed(1)}km</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted mb-0.5">총 시간</p>
                  <p className="text-xl font-extrabold">{todayStats.totalMin}분</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[11px] text-muted mb-0.5">예상 1RM</p>
                  <p className="text-xl font-extrabold text-accent">{todayStats.maxRM}{unit}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted mb-0.5">최대 무게</p>
                  <p className="text-xl font-extrabold">{todayStats.maxWeight}{unit}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted mb-0.5">총 볼륨</p>
                  <p className="text-xl font-extrabold">{todayStats.totalVolume}{unit}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 최근 기록 */}
        {recentSessions.length > 0 && (
          <div className="mt-4 bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">최근 기록</p>
            </div>
            <div>
              {(() => {
                let renderCount = 0;
                return recentSessions.map((session) => {
                  const ex = session.exercises.find((e) => e.name === currentExercise.name);
                  if (!ex) return null;
                  const done = ex.sets.filter((s) => s.isCompleted);
                  if (done.length === 0) return null;
                  const isFirst = renderCount++ === 0;
                  const d = new Date(session.date);
                  const dateStr = `${d.getMonth() + 1}/${d.getDate()} (${["일","월","화","수","목","금","토"][d.getDay()]})`;
                  return (
                    <div key={session.id} className={`px-4 py-3 ${isFirst ? "" : "border-t border-border"}`}>
                      <p className="text-xs font-bold text-accent mb-2">{dateStr}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {done.map((s, i) => {
                          const w = unit === "lb" ? Math.round(s.weight * KG_TO_LB) : s.weight;
                          return (
                            <span key={s.id} className="text-xs text-muted">
                              {i + 1}{isCardioExercise ? "구간" : "세트"}{" "}
                              <span className="text-foreground font-semibold">
                                {isCardioExercise
                                  ? `${(s.weight || 0).toFixed(1)}km×${s.reps}분`
                                  : `${w}${unit}×${s.reps}회`}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </main>

      {/* 이전 운동 복원 프롬프트 — Drawer */}
      <Drawer open={showResumePrompt} onClose={() => router.back()} height="auto" zIndex={50}>
        <div className="p-6 pb-safe">
          <h2 className="text-xl font-extrabold mb-2">진행 중인 운동이 있어요</h2>
          <p className="text-sm text-muted mb-6">이전에 진행하던 운동 기록을 이어서 하시겠어요?</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleResume}
              className="w-full py-4 bg-accent text-background rounded-2xl font-extrabold text-base active:scale-95 transition-transform"
            >
              이어서 하기
            </button>
            <button
              onClick={handleFresh}
              className="w-full py-4 bg-background border border-border rounded-2xl font-bold text-base active:scale-95 transition-transform"
            >
              새로 시작하기
            </button>
          </div>
        </div>
      </Drawer>

      {/* 운동 마무리 확인 Drawer */}
      <Drawer open={showFinishConfirm} onClose={() => setShowFinishConfirm(false)} height="auto" zIndex={50}>
        <div className="p-6 pb-safe">
          <h2 className="text-xl font-extrabold mb-2">지금 마무리할까요?</h2>
          <p className="text-sm text-muted mb-6">
            완료한 세트까지만 기록하고 운동을 종료합니다.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setShowFinishConfirm(false); finishWorkout(); }}
              className="w-full py-4 bg-danger text-white rounded-2xl font-extrabold text-base active:scale-95 transition-transform"
            >
              지금 마무리하기
            </button>
            <button
              onClick={() => setShowFinishConfirm(false)}
              className="w-full py-4 bg-background border border-border rounded-2xl font-bold text-base active:scale-95 transition-transform"
            >
              계속하기
            </button>
          </div>
        </div>
      </Drawer>

      {/* Bottom Fixed Area */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card border-t border-border p-4 pb-safe space-y-3 shadow-2xl">
        {/* 타이머 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => (isTimerRunning ? stopTimer() : startTimer(DEFAULT_REST))}
            className={`p-2.5 rounded-full flex items-center justify-center transition-colors shrink-0 ${isTimerRunning ? "bg-danger/20 text-danger" : "bg-accent/20 text-accent"}`}
          >
            {isTimerRunning ? <Square size={18} fill="currentColor" /> : <Timer size={18} />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-muted">휴식 타이머</span>
              <span className={isTimerRunning ? "text-accent font-mono text-lg leading-none" : "text-muted"}>
                {timerSeconds}초
              </span>
            </div>
            <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-linear ${isTimerRunning ? "bg-accent" : "bg-transparent"}`}
                style={{ width: `${timerInitial > 0 ? (timerSeconds / timerInitial) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => adjustTimer(-REST_STEP)}
              disabled={!isTimerRunning}
              className="w-8 h-8 flex items-center justify-center bg-background border border-border rounded-lg text-muted hover:text-foreground text-xs font-bold disabled:opacity-30"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() => adjustTimer(REST_STEP)}
              disabled={!isTimerRunning}
              className="w-8 h-8 flex items-center justify-center bg-background border border-border rounded-lg text-muted hover:text-foreground text-xs font-bold disabled:opacity-30"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentExIndex((i) => Math.max(0, i - 1))}
            disabled={currentExIndex === 0}
            className="flex-1 bg-background border border-border py-3.5 rounded-xl font-bold flex justify-center items-center gap-1 disabled:opacity-30"
          >
            <ChevronLeft size={20} />
            이전
          </button>

          {currentExIndex < routine.exercises.length - 1 ? (
            <button
              onClick={() => setCurrentExIndex((i) => i + 1)}
              className="flex-[2] bg-foreground text-background py-3.5 rounded-xl font-bold flex justify-center items-center gap-1 active:scale-95 transition-transform shadow-lg"
            >
              다음 운동
              <ChevronRight size={20} />
            </button>
          ) : (
            <button
              onClick={finishWorkout}
              className="flex-[2] bg-accent text-background py-3.5 rounded-xl font-extrabold flex justify-center items-center gap-1 active:scale-95 transition-transform shadow-lg shadow-accent/30"
            >
              운동 완료하기
            </button>
          )}
        </div>
      </div>
    </div>

    {/* 운동 완료 요약 */}

    {summary && (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
        <div className="w-full max-w-xs space-y-8">
          <div className="text-center">
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">오운완</p>
            <h2 className="text-3xl font-extrabold">고생하셨습니다</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "종목", value: String(summary.exercises), unit: "종목" },
              { label: "세트",  value: String(summary.sets),      unit: "세트"  },
              {
                label: "소요 시간",
                value: (() => {
                  const h = Math.floor(summary.durationSec / 3600);
                  const m = Math.floor((summary.durationSec % 3600) / 60);
                  const s = summary.durationSec % 60;
                  if (h > 0) return `${h}시간 ${m}분`;
                  if (m > 0) return `${m}분 ${s}초`;
                  return `${s}초`;
                })(),
                unit: "",
              },
              { label: "소모 칼로리", value: String(summary.calories), unit: "kcal" },
            ].map(({ label, value, unit }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
                <p className="text-xs text-muted mb-1">{label}</p>
                <p className="text-2xl font-extrabold leading-none">{value}</p>
                {unit && <p className="text-xs text-muted mt-1">{unit}</p>}
              </div>
            ))}
          </div>

          {/* 볼륨 비교 인사이트 */}
          {summary.volumeDiff === null ? (
            <div className="text-center py-2 px-4 bg-accent/10 border border-accent/20 rounded-xl">
              <p className="text-sm font-bold text-accent">첫 번째 기록이에요!</p>
              <p className="text-xs text-muted mt-0.5">다음엔 더 높이 도전해보세요</p>
            </div>
          ) : summary.volumeDiff > 0 ? (
            <div className="text-center py-2 px-4 bg-accent/10 border border-accent/20 rounded-xl">
              <p className="text-sm font-bold text-accent">이전보다 {summary.volumeDiff}% 더 했어요!</p>
              <p className="text-xs text-muted mt-0.5">꾸준히 성장하고 있습니다</p>
            </div>
          ) : summary.volumeDiff === 0 ? (
            <div className="text-center py-2 px-4 bg-card border border-border rounded-xl">
              <p className="text-sm font-medium text-muted">지난 기록과 동일해요</p>
            </div>
          ) : (
            <div className="text-center py-2 px-4 bg-card border border-border rounded-xl">
              <p className="text-sm font-medium text-muted">이전보다 {Math.abs(summary.volumeDiff)}% 감소했어요</p>
              <p className="text-xs text-muted mt-0.5">괜찮아요, 다음엔 더 잘할 거예요</p>
            </div>
          )}

          <button
            onClick={() => router.push("/")}
            className="w-full py-4 bg-accent text-background font-extrabold rounded-2xl active:scale-95 transition-transform shadow-lg shadow-accent/30"
          >
            홈으로
          </button>
        </div>
      </div>
    )}
    </>
  );
}
