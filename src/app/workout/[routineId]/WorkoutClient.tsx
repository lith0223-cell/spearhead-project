"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, MoreHorizontal, Minus, Plus, Square, Timer, Trash2, X } from "lucide-react";
import {
  getRoutines,
  getLastSessionByExercise,
  getRecentSessionsByExercise,
  getWorkoutSessions,
  calculate1RM,
  saveWorkoutSession,
  saveRoutine,
  getExerciseLibrary,
  updateExerciseInLibrary,
  getActiveWorkout,
  setActiveWorkout,
  clearActiveWorkout,
} from "@/utils/storage";
import { requestWakeLock, releaseWakeLock } from "@/utils/wakeLock";
import { resumeAudioContext } from "@/utils/audio";
import {
  scheduleRestNotification,
  cancelRestNotification,
  requestNotificationPermission,
} from "@/utils/notifications";
import { ExerciseRecord, Routine, RoutineExerciseConfig, RoutineSetTemplate, SetRecord, WorkoutSession, WeightMode } from "@/types";
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
  const isRestNotificationReturn = searchParams.get("restDone") === "true";
  const startIdxParam = searchParams.get("startIdx");
  const startIdx = startIdxParam !== null ? Math.max(0, parseInt(startIdxParam) || 0) : 0;

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [exercisesData, setExercisesData] = useState<ExerciseRecord[]>([]);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [optionsState, setOptionsState] = useState<{ exIdx: number; setIdx: number } | null>(null);
  const [rpePickerState, setRpePickerState] = useState<{ exIdx: number; setIdx: number } | null>(null);
  const [restPickerState, setRestPickerState] = useState<{ exIdx: number; setIdx: number } | null>(null);
  const [summary, setSummary] = useState<{ exercises: number; sets: number; durationSec: number; calories: number; volumeDiff: number | null } | null>(null);

  // 루틴 업데이트 관련 상태
  const [showUpdateDiff, setShowUpdateDiff] = useState(false);
  const [pendingUpdatedRoutine, setPendingUpdatedRoutine] = useState<Routine | null>(null);
  const [routineUpdated, setRoutineUpdated] = useState(false);

  // 소수점 입력을 위한 draft 상태
  const [inputDrafts, setInputDrafts] = useState<Record<string, string>>({});

  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const pendingSetToggleRef = useRef<{ exIdx: number; setIdx: number } | null>(null);
  const exSwipeRef = useRef<{ x: number; y: number } | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showOtherRoutineConflict, setShowOtherRoutineConflict] = useState(false);
  const [modePickerState, setModePickerState] = useState<{ exIdx: number; setIdx: number; current: WeightMode } | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerInitial, setTimerInitial] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  // 절대 timestamp 기반 타이머 — 백그라운드에서도 정확히 작동
  const timerEndTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 현재 운동명 ref (알림 메시지용)
  const currentExNameRef = useRef<string>("");
  // 알림 권한 요청 여부 (세션 내 중복 요청 방지)
  const notifPermAskedRef = useRef(false);
  const savedExDataRef = useRef<ExerciseRecord[]>([]);
  const savedExIndexRef = useRef(0);
  const workoutStartTimeRef = useRef<number | null>(null);
  // 운동 완료 후 자동저장 useEffect 재실행 방지
  const workoutFinishedRef = useRef(false);
  // SW keepalive interval — SW idle 종료 방지
  const keepaliveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 타이머 tick — 화면 표시 + 자체 state cleanup만 담당.
  // 비프음/카운트다운 강조음/cancelRestNotification은 GlobalTimerOverlay가 전역 처리.
  const tick = () => {
    if (timerEndTimeRef.current === null) return;
    const remaining = Math.max(0, Math.round((timerEndTimeRef.current - Date.now()) / 1000));
    setTimerSeconds(remaining);

    if (remaining === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (keepaliveIntervalRef.current) {
        clearInterval(keepaliveIntervalRef.current);
        keepaliveIntervalRef.current = null;
      }
      setIsTimerRunning(false);
      timerEndTimeRef.current = null;
    }
  };

  // isTimerRunning 변경 시 interval 시작/정지
  // startTimer에서 직접 interval을 시작하므로 중복 방지
  useEffect(() => {
    if (isTimerRunning) {
      if (!intervalRef.current) {
        tick();
        intervalRef.current = setInterval(tick, 500);
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isTimerRunning]);

  // 탭/앱이 포그라운드로 돌아올 때 화면 즉시 재계산.
  // 비프음 억제/QStash 취소는 GlobalTimerOverlay가 전역 처리.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // 운동 전환 시 입력 draft 초기화 (소수점 입력 버그 방지)
  useEffect(() => {
    setInputDrafts({});
  }, [currentExIndex]);

  useEffect(() => {
    const routines = getRoutines();
    const found = routines.find((r) => r.id === routineId);
    if (!found) {
      router.push("/routines");
      return;
    }

    setRoutine(found);
    requestWakeLock();

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
          weight: s.weightMode === "bodyweight" ? 0 : s.weight,
          reps: s.reps,
          isCompleted: false,
          restTime: s.restTime,
          weightMode: s.weightMode,
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

    // 다른 루틴 진행 중인 경우 → conflict Drawer
    if (saved && saved.routineId !== routineId) {
      const hasProgress = saved.exercisesData?.some((ex) => ex.sets.some((s) => s.isCompleted));
      if (hasProgress) {
        setShowOtherRoutineConflict(true);
      }
    }

    if (saved && saved.routineId === routineId) {
      const hasProgress = saved.exercisesData?.some((ex) => ex.sets.some((s) => s.isCompleted));
      if (hasProgress) {
        // 현재 루틴 순서에 맞게 세트 데이터 재정렬 (운동 중 종목 순서 변경 대응)
        const savedMap = new Map((saved.exercisesData as ExerciseRecord[]).map((ex) => [ex.name, ex]));
        const reorderedData: ExerciseRecord[] = found.exercises.map(
          (name) => savedMap.get(name) ?? initialData.find((d) => d.name === name)!
        );
        savedExDataRef.current = reorderedData;
        savedExIndexRef.current = saved.currentExIndex ?? 0;
        workoutStartTimeRef.current = saved.startTime ?? Date.now();
        setExercisesData(reorderedData);
        const clampedIdx = Math.min(startIdx, found.exercises.length - 1);
        // startIdx 파라미터가 있으면 명시적 인덱스 사용, 없으면 저장된 위치 복원
        setCurrentExIndex(startIdxParam !== null ? clampedIdx : (saved.currentExIndex ?? 0));
        resumedFromSave = true;
      }
    }
    if (!resumedFromSave) {
      setExercisesData(initialData);
      const clampedIdx = Math.min(startIdx, found.exercises.length - 1);
      if (clampedIdx > 0) setCurrentExIndex(clampedIdx);
    }

    if (isRestNotificationReturn) {
      localStorage.removeItem(TIMER_STORAGE_KEY);
      cancelRestNotification();
      navigator.serviceWorker?.controller?.postMessage({ type: 'TIMER_HANDLED' });
    }

    // 이전에 실행 중이던 타이머 복원 (화면 이탈 후 복귀 시)
    const storedEnd = localStorage.getItem(TIMER_STORAGE_KEY);
    if (storedEnd && !isRestNotificationReturn) {
      const endTime = parseInt(storedEnd);
      const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      if (remaining > 0) {
        timerEndTimeRef.current = endTime;
        setTimerSeconds(remaining);
        setTimerInitial(remaining);
        setIsTimerRunning(true);
        const restoredIdx = startIdxParam !== null ? Math.min(startIdx, found.exercises.length - 1) : (saved?.currentExIndex ?? 0);
        scheduleRestNotification(endTime, found.exercises[restoredIdx] ?? "운동", routineId, restoredIdx);
      } else {
        localStorage.removeItem(TIMER_STORAGE_KEY);
      }
    }

    return () => {
      releaseWakeLock();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [routineId, router, shouldAutoResume, isRestNotificationReturn]);

  // 진행 중 운동 세션 자동 저장
  useEffect(() => {
    if (workoutFinishedRef.current) return; // 운동 완료 후 재저장 방지
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

  const startTimer = (seconds: number, exerciseName?: string, exerciseIndex = currentExIndex) => {
    // 기존 interval 즉시 정리 — isTimerRunning이 이미 true여도 확실히 새로 시작
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const clamped = Math.min(seconds, MAX_REST_SECONDS);
    const endTime = Date.now() + clamped * 1000;
    timerEndTimeRef.current = endTime;
    resumeAudioContext(); // iOS: 타이머 시작 시점에 AudioContext unlock
    localStorage.setItem(TIMER_STORAGE_KEY, String(endTime));
    setTimerSeconds(clamped);
    setTimerInitial(clamped);
    setIsTimerRunning(true);
    // isTimerRunning이 이미 true이면 useEffect가 재실행되지 않으므로 직접 interval 시작
    tick();
    intervalRef.current = setInterval(tick, 500);
    // SW keepalive — SW idle 종료 방지 (25초마다 ping)
    if (keepaliveIntervalRef.current) clearInterval(keepaliveIntervalRef.current);
    keepaliveIntervalRef.current = setInterval(() => {
      try {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'KEEPALIVE' });
        }
      } catch { /* ignore */ }
    }, 25000);
    scheduleRestNotification(endTime, exerciseName ?? currentExNameRef.current, routineId, exerciseIndex);
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
    scheduleRestNotification(newEndTime, currentExNameRef.current, routineId, currentExIndex);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current);
      keepaliveIntervalRef.current = null;
    }
    setIsTimerRunning(false);
    setTimerSeconds(0);
    timerEndTimeRef.current = null;
    localStorage.removeItem(TIMER_STORAGE_KEY);
    cancelRestNotification();
  };

  // 종목 전환 시 해당 종목의 저장된 unit 로드
  useEffect(() => {
    if (exercisesData.length === 0) return;
    const exName = exercisesData[currentExIndex]?.name;
    if (!exName) return;
    currentExNameRef.current = exName;
    const savedUnits = JSON.parse(localStorage.getItem("ph_exercise_unit") || "{}") as Record<string, "kg" | "lb">;
    setUnit(savedUnits[exName] || "kg");
  }, [currentExIndex, exercisesData]);

  const toggleUnit = () => {
    const exName = exercisesData[currentExIndex]?.name;
    const newUnit = unit === "kg" ? "lb" : "kg";
    const factor = newUnit === "lb" ? KG_TO_LB : 1 / KG_TO_LB;
    setExercisesData((prev) =>
      prev.map((ex, ei) => {
        if (ei !== currentExIndex) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => ({
            ...s,
            weight: s.weight > 0 ? parseFloat((s.weight * factor).toFixed(1)) : 0,
          })),
        };
      })
    );
    setUnit(newUnit);
    if (exName) {
      const savedUnits = JSON.parse(localStorage.getItem("ph_exercise_unit") || "{}");
      savedUnits[exName] = newUnit;
      localStorage.setItem("ph_exercise_unit", JSON.stringify(savedUnits));
    }
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

  const doSetToggle = (exIdx: number, setIdx: number) => {
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
                startTimer(toggled.restTime || DEFAULT_REST, ex.name, exIdx);
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

  const handleSetToggle = (exIdx: number, setIdx: number) => {
    // 종목 클릭으로 진입(startIdx 파라미터 있음)했고 아직 운동 시작 전일 때만 확인
    const hasStarted = exercisesData.some((ex) => ex.sets.some((s) => s.isCompleted));
    if (startIdxParam !== null && !hasStarted) {
      pendingSetToggleRef.current = { exIdx, setIdx };
      setShowStartConfirm(true);
      return;
    }
    doSetToggle(exIdx, setIdx);
  };

  // ── 루틴 업데이트 헬퍼 ──
  const buildUpdatedRoutine = (exercisesInKg: ExerciseRecord[]): Routine | null => {
    if (!routine) return null;
    const newConfigs: RoutineExerciseConfig[] = routine.exercises.map((exName) => {
      const workoutEx = exercisesInKg.find((ex) => ex.name === exName);
      const oldConfig = routine.exerciseConfigs?.find((c) => c.name === exName);
      if (workoutEx) {
        const completedSets: RoutineSetTemplate[] = workoutEx.sets
          .filter((s) => s.isCompleted)
          .map((s) => ({
            weight: s.weight,
            reps: s.reps,
            restTime: s.restTime ?? DEFAULT_REST,
            weightMode: s.weightMode,
          }));
        if (completedSets.length > 0) {
          return { name: exName, category: oldConfig?.category, sets: completedSets };
        }
      }
      return oldConfig ?? { name: exName, sets: [] };
    });
    return { ...routine, exerciseConfigs: newConfigs };
  };

  const formatSetTemplate = (s: RoutineSetTemplate): string => {
    if (s.weightMode === "bodyweight") return `맨몸 × ${s.reps}회`;
    if (s.weightMode === "assisted") return `AS ${s.weight}kg × ${s.reps}회`;
    return `${s.weight}kg × ${s.reps}회`;
  };

  const handleConfirmUpdate = () => {
    if (!pendingUpdatedRoutine) return;

    // 1. 루틴 exerciseConfigs 갱신
    saveRoutine(pendingUpdatedRoutine);
    setRoutine(pendingUpdatedRoutine);

    // 2. 종목 라이브러리 defaultSets 동기화
    //    루틴에서 업데이트된 세트 정보를 각 종목의 기본 세트에도 반영
    const lib = getExerciseLibrary();
    pendingUpdatedRoutine.exerciseConfigs?.forEach((cfg) => {
      if (cfg.sets.length === 0) return;
      const ex = lib.find((e) => e.name === cfg.name);
      if (ex) {
        updateExerciseInLibrary({ ...ex, defaultSets: cfg.sets });
      }
    });

    setShowUpdateDiff(false);
    setRoutineUpdated(true);
    setPendingUpdatedRoutine(null);
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

  const applySetMode = (exIdx: number, setIdx: number, mode: WeightMode) => {
    setExercisesData((prev) =>
      prev.map((ex, ei) =>
        ei !== exIdx ? ex :
        {
          ...ex,
          sets: ex.sets.map((s, si) =>
            si !== setIdx ? s : { ...s, weightMode: mode, weight: mode === "bodyweight" ? 0 : s.weight }
          ),
        }
      )
    );
    setModePickerState(null);
  };

  const setSetRpe = (exIdx: number, setIdx: number, rpe: number | undefined) => {
    setExercisesData((prev) =>
      prev.map((ex, ei) =>
        ei !== exIdx ? ex :
        { ...ex, sets: ex.sets.map((s, si) => si !== setIdx ? s : { ...s, rpe }) }
      )
    );
    setRpePickerState(null);
  };

  const setSetRestTimeAbsolute = (exIdx: number, setIdx: number, seconds: number) => {
    setExercisesData((prev) => {
      const next = [...prev];
      const sets = [...next[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], restTime: Math.max(REST_STEP, Math.min(MAX_REST_SECONDS, seconds)) };
      next[exIdx] = { ...next[exIdx], sets };
      return next;
    });
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
                  weight: last?.weightMode === "bodyweight" ? 0 : (last?.weight ?? 0),
                  reps: last?.reps ?? 0,
                  isCompleted: false,
                  restTime: last?.restTime ?? DEFAULT_REST,
                  weightMode: last?.weightMode,
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
    workoutFinishedRef.current = true; // 자동 저장 useEffect 재실행 방지
    const savedUnits = JSON.parse(localStorage.getItem("ph_exercise_unit") || "{}") as Record<string, "kg" | "lb">;
    const exercisesInKg = exercisesData.map((ex) => {
      const exUnit = savedUnits[ex.name] || "kg";
      return {
        ...ex,
        sets: ex.sets.map((s) => ({
          ...s,
          weight: exUnit === "lb" ? Math.round(s.weight / KG_TO_LB) : s.weight,
        })),
      };
    });
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

    // 루틴 업데이트 데이터 준비 (완료된 세트가 있을 때만) — 자동 프롬프트 없이, 요약 화면의 버튼으로 열기
    const hasCompletedSets = exercisesInKg.some((ex) => ex.sets.some((s) => s.isCompleted));
    if (hasCompletedSets) {
      const updatedRoutine = buildUpdatedRoutine(exercisesInKg);
      if (updatedRoutine) {
        setPendingUpdatedRoutine(updatedRoutine);
        // setShowUpdatePrompt(true) 제거: 요약 화면이 먼저 표시되어야 함
      }
    }
  };

  const handleExSwipeTouchStart = (e: React.TouchEvent) => {
    exSwipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleExSwipeTouchEnd = (e: React.TouchEvent) => {
    if (!exSwipeRef.current) return;
    const deltaX = e.changedTouches[0].clientX - exSwipeRef.current.x;
    const deltaY = e.changedTouches[0].clientY - exSwipeRef.current.y;
    exSwipeRef.current = null;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaY) > Math.abs(deltaX)) return;
    if (deltaX < 0 && currentExIndex < (routine?.exercises.length ?? 1) - 1) {
      setCurrentExIndex((i) => i + 1);
    } else if (deltaX > 0 && currentExIndex > 0) {
      setCurrentExIndex((i) => i - 1);
    }
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
    const doneWeighted = done.filter((s) => s.weight > 0 && s.weightMode !== "assisted");
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

  // 루틴 업데이트 diff 계산
  const routineDiff = useMemo(() => {
    if (!routine || !pendingUpdatedRoutine?.exerciseConfigs) return [];
    return pendingUpdatedRoutine.exerciseConfigs
      .map((newCfg) => {
        const oldCfg = routine.exerciseConfigs?.find((c) => c.name === newCfg.name);
        return { exName: newCfg.name, oldSets: oldCfg?.sets ?? [], newSets: newCfg.sets };
      })
      .filter((d) => {
        if (d.newSets.length === 0 && d.oldSets.length === 0) return false;
        if (d.newSets.length !== d.oldSets.length) return true;
        return d.newSets.some((ns, i) => {
          const os = d.oldSets[i];
          if (!os) return true;
          return ns.weight !== os.weight || ns.reps !== os.reps || ns.weightMode !== os.weightMode;
        });
      });
  }, [routine, pendingUpdatedRoutine]);

  if (!routine || exercisesData.length === 0) return null;

  const currentExercise = exercisesData[currentExIndex];
  const lastSession = getLastSessionByExercise(currentExercise.name);
  const lastEx = lastSession?.exercises.find((e) => e.name === currentExercise.name);
  const isCardioExercise = routine.exerciseConfigs?.find((c) => c.name === currentExercise.name)?.category === "유산소";

  const formatRestTime = (sec: number) => `${sec}초`;

  return (
    <>
    <div className="flex flex-col h-[100dvh] bg-background overflow-x-hidden">
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

      <main
        className="flex-1 overflow-y-auto px-6 pb-48"
        onTouchStart={handleExSwipeTouchStart}
        onTouchEnd={handleExSwipeTouchEnd}
      >
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
        <div className="space-y-1">
          {/* 컬럼 헤더 — gap-2 동일하게 맞춤 */}
          <div className="flex items-center gap-2 mb-2">
            <span className="w-10 text-center text-xs font-medium text-muted">{isCardioExercise ? "구간" : "세트"}</span>
            <span className="flex-1 text-center text-xs font-medium text-muted">{isCardioExercise ? "거리(km)" : `무게(${unit})`}</span>
            <span className="flex-1 text-center text-xs font-medium text-muted">{isCardioExercise ? "시간(분)" : "횟수"}</span>
            <span className="w-10 text-center text-xs font-medium text-muted">완료</span>
            <span className="w-8" />
          </div>

          {currentExercise.sets.map((set, sIdx) => {
            const lastSet = lastEx?.sets[sIdx];
            return (
              <div key={set.id} className="mb-2">
                {/* ── 세트 메인 행 ── */}
                <div className="flex items-center gap-2 py-0.5">
                  {/* 모드 버튼 — 완료 여부 무관하게 항상 클릭 가능 */}
                  <button
                    type="button"
                    onClick={() => setModePickerState({ exIdx: currentExIndex, setIdx: sIdx, current: set.weightMode ?? "weighted" })}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold shrink-0 transition-all active:scale-90 ${
                      set.isCompleted
                        ? set.weightMode === "bodyweight" ? "bg-blue-500/20 text-blue-300"
                          : set.weightMode === "assisted" ? "bg-purple-500/20 text-purple-300"
                          : "bg-success/15 text-success"
                        : set.weightMode === "bodyweight" ? "bg-blue-500/15 text-blue-400"
                        : set.weightMode === "assisted" ? "bg-purple-500/15 text-purple-400"
                        : "bg-card text-muted"
                    }`}
                  >
                    {set.weightMode === "bodyweight" ? "BW" : set.weightMode === "assisted" ? "AS" : sIdx + 1}
                  </button>

                  {/* 무게 — 항상 editable, 완료 시 success 색 */}
                  {set.weightMode !== "bodyweight" ? (
                    <input
                      type="text" inputMode="decimal"
                      value={`w-${sIdx}` in inputDrafts ? inputDrafts[`w-${sIdx}`] : (set.weight || "")}
                      onChange={(e) => setInputDrafts((prev) => ({ ...prev, [`w-${sIdx}`]: e.target.value }))}
                      onFocus={(e) => {
                        e.target.select();
                        setInputDrafts((prev) => ({ ...prev, [`w-${sIdx}`]: set.weight > 0 ? String(set.weight) : "" }));
                      }}
                      onBlur={() => {
                        const key = `w-${sIdx}`;
                        if (key in inputDrafts) {
                          const num = parseFloat(inputDrafts[key]);
                          updateSet(currentExIndex, sIdx, "weight", isNaN(num) ? 0 : num);
                          setInputDrafts((prev) => { const n = { ...prev }; delete n[key]; return n; });
                        }
                      }}
                      placeholder="0"
                      className={`flex-1 min-w-0 text-center rounded-xl py-2.5 text-lg font-bold focus:outline-none transition-colors ${
                        set.isCompleted
                          ? "bg-success/10 text-success focus:ring-1 focus:ring-success/40"
                          : set.weightMode === "assisted"
                          ? "bg-card focus:ring-1 focus:ring-purple-400 text-foreground"
                          : "bg-card focus:ring-1 focus:ring-accent text-foreground"
                      }`}
                    />
                  ) : (
                    /* 맨몸 — 항상 dash 박스 */
                    <div className={`flex-1 flex items-center justify-center py-2.5 rounded-xl ${
                      set.isCompleted ? "bg-success/10" : "bg-card"
                    }`}>
                      <span className={`text-lg font-bold ${set.isCompleted ? "text-success/50" : "text-muted/40"}`}>—</span>
                    </div>
                  )}

                  {/* 횟수 — 항상 editable, 완료 시 success 색 */}
                  <input
                    type="text" inputMode="decimal"
                    value={`r-${sIdx}` in inputDrafts ? inputDrafts[`r-${sIdx}`] : (set.reps || "")}
                    onChange={(e) => setInputDrafts((prev) => ({ ...prev, [`r-${sIdx}`]: e.target.value }))}
                    onFocus={(e) => {
                      e.target.select();
                      setInputDrafts((prev) => ({ ...prev, [`r-${sIdx}`]: set.reps > 0 ? String(set.reps) : "" }));
                    }}
                    onBlur={() => {
                      const key = `r-${sIdx}`;
                      if (key in inputDrafts) {
                        const num = parseFloat(inputDrafts[key]);
                        updateSet(currentExIndex, sIdx, "reps", isNaN(num) ? 0 : num);
                        setInputDrafts((prev) => { const n = { ...prev }; delete n[key]; return n; });
                      }
                    }}
                    placeholder="0"
                    className={`flex-1 min-w-0 text-center rounded-xl py-2.5 text-lg font-bold focus:outline-none transition-colors ${
                      set.isCompleted
                        ? "bg-success/10 text-success focus:ring-1 focus:ring-success/40"
                        : "bg-card focus:ring-1 focus:ring-accent text-foreground"
                    }`}
                  />

                  {/* 완료 / RPE 버튼 — RPE는 완료 전에도 표시 */}
                  <button
                    onClick={() => handleSetToggle(currentExIndex, sIdx)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl shrink-0 transition-all active:scale-90 ${
                      set.isCompleted && !set.rpe
                        ? "bg-success text-white shadow-md shadow-success/30"
                        : set.isCompleted && set.rpe
                        ? "bg-success/10 border border-success/25"
                        : "bg-card border-2 border-border hover:border-accent"
                    }`}
                  >
                    {set.rpe ? (
                      <span className={`text-sm font-extrabold leading-none ${
                        set.rpe >= 8 ? "text-danger"
                        : set.rpe >= 6 ? "text-amber-400"
                        : set.isCompleted ? "text-success"
                        : "text-muted"
                      }`}>{set.rpe}</span>
                    ) : set.isCompleted ? (
                      <Check strokeWidth={3} size={16} />
                    ) : null}
                  </button>

                  {/* ··· 추가 기능 버튼 */}
                  <button
                    type="button"
                    onClick={() => setOptionsState({ exIdx: currentExIndex, setIdx: sIdx })}
                    className="w-8 h-8 flex items-center justify-center text-muted hover:text-foreground transition-colors shrink-0"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>

                {/* ── 세트 하단: 지난번(RPE 포함) + 타이머 아이콘 ── */}
                {!isCardioExercise && (
                  <div className="flex items-center justify-between min-h-[20px] mt-0.5">
                    <p className="text-xs text-muted">
                      {lastSet ? (() => {
                        const mode = lastSet.weightMode;
                        const rpeStr = lastSet.rpe ? ` · RPE ${lastSet.rpe}` : "";
                        if (mode === "bodyweight") return `지난번: ${lastSet.reps}회${rpeStr}`;
                        const w = unit === "lb" ? Math.round(lastSet.weight * KG_TO_LB) : lastSet.weight;
                        return `지난번: ${mode === "assisted" ? "AS " : ""}${w}${unit} × ${lastSet.reps}회${rpeStr}`;
                      })() : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => !set.isCompleted && setRestPickerState({ exIdx: currentExIndex, setIdx: sIdx })}
                      disabled={set.isCompleted}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-muted hover:text-accent disabled:opacity-30 active:scale-90 transition-all"
                    >
                      <Timer size={12} />
                      <span className="text-xs font-bold whitespace-nowrap">{set.restTime || DEFAULT_REST}초</span>
                    </button>
                  </div>
                )}

                {/* 유산소: 지난번 표시 */}
                {isCardioExercise && lastSet && (
                  <p className="text-xs text-muted mt-0.5">
                    지난번: {(lastSet.weight || 0).toFixed(1)}km × {lastSet.reps}분
                  </p>
                )}
              </div>
            );
          })}
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

      {/* 다른 루틴 진행 중 conflict Drawer */}
      <Drawer open={showOtherRoutineConflict} onClose={() => { setShowOtherRoutineConflict(false); router.back(); }} height="auto" zIndex={50}>
        <div className="p-6 pb-safe">
          <h2 className="text-xl font-extrabold mb-2">다른 루틴이 진행 중이에요</h2>
          <p className="text-sm text-muted mb-6">진행 중인 운동을 중지하고 새 운동을 시작하시겠습니까?</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { clearActiveWorkout(); setShowOtherRoutineConflict(false); }}
              className="w-full py-4 bg-accent text-background rounded-2xl font-extrabold text-base active:scale-95 transition-transform"
            >
              중지하고 새로 시작
            </button>
            <button
              onClick={() => { setShowOtherRoutineConflict(false); router.back(); }}
              className="w-full py-4 bg-background border border-border rounded-2xl font-bold text-base active:scale-95 transition-transform"
            >
              취소
            </button>
          </div>
        </div>
      </Drawer>

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

      {/* 운동 시작 확인 Drawer (첫 세트 체크 시) */}
      <Drawer open={showStartConfirm} onClose={() => { setShowStartConfirm(false); pendingSetToggleRef.current = null; }} height="auto" zIndex={50}>
        <div className="p-6 pb-safe">
          <h2 className="text-xl font-extrabold mb-2">운동을 시작할까요?</h2>
          <p className="text-sm text-muted mb-6">{routine?.name} 루틴의 운동을 시작합니다.</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setShowStartConfirm(false);
                const pending = pendingSetToggleRef.current;
                pendingSetToggleRef.current = null;
                if (pending) doSetToggle(pending.exIdx, pending.setIdx);
              }}
              className="w-full py-4 bg-accent text-background rounded-2xl font-extrabold text-base active:scale-95 transition-transform shadow-lg shadow-accent/30"
            >
              시작하기
            </button>
            <button
              onClick={() => { setShowStartConfirm(false); pendingSetToggleRef.current = null; }}
              className="w-full py-4 bg-background border border-border rounded-2xl font-bold text-base active:scale-95 transition-transform"
            >
              취소
            </button>
          </div>
        </div>
      </Drawer>

      {/* 운동 중간 마무리 확인 Drawer (헤더 마무리 버튼) */}
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

      {/* 운동 전체 완료 확인 Drawer (운동 완료하기 버튼) */}
      <Drawer open={showCompleteConfirm} onClose={() => setShowCompleteConfirm(false)} height="auto" zIndex={50}>
        <div className="p-6 pb-safe">
          <h2 className="text-xl font-extrabold mb-2">운동을 완료할까요?</h2>
          <p className="text-sm text-muted mb-6">
            모든 종목을 마쳤습니다. 운동 기록을 저장하고 종료합니다.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setShowCompleteConfirm(false); finishWorkout(); }}
              className="w-full py-4 bg-accent text-background rounded-2xl font-extrabold text-base active:scale-95 transition-transform shadow-lg shadow-accent/30"
            >
              완료하기
            </button>
            <button
              onClick={() => setShowCompleteConfirm(false)}
              className="w-full py-4 bg-background border border-border rounded-2xl font-bold text-base active:scale-95 transition-transform"
            >
              계속하기
            </button>
          </div>
        </div>
      </Drawer>

      {/* 세트 모드 선택 Bottom Sheet */}
      <Drawer open={!!modePickerState} onClose={() => setModePickerState(null)} height="auto" zIndex={70}>
        <div className="px-6 pt-5 pb-8">
          <h3 className="text-base font-bold mb-0.5">세트 모드</h3>
          <p className="text-xs text-muted mb-4">
            {modePickerState ? `${exercisesData[modePickerState.exIdx]?.name ?? ""} — ${modePickerState.setIdx + 1}세트` : ""}
          </p>
          <div className="space-y-2">
            {([
              { mode: "weighted" as WeightMode,  label: "가중",  desc: "추가 무게를 달고 하는 운동",          color: "text-foreground" },
              { mode: "bodyweight" as WeightMode, label: "맨몸",  desc: "체중만으로 하는 운동 (무게 미입력)",   color: "text-blue-400"   },
              { mode: "assisted" as WeightMode,   label: "보조",  desc: "밴드·머신으로 체중 일부를 보조받는 운동", color: "text-purple-400" },
            ]).map(({ mode, label, desc, color }) => {
              const isSelected = (modePickerState?.current ?? "weighted") === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => modePickerState && applySetMode(modePickerState.exIdx, modePickerState.setIdx, mode)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                    isSelected ? "border-accent bg-accent/10" : "border-border bg-card"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "border-accent" : "border-border"
                  }`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-bold ${isSelected ? color : "text-foreground"}`}>{label}</p>
                    <p className="text-xs text-muted mt-0.5">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Drawer>

      {/* ··· 세트 옵션 Bottom Sheet */}
      <Drawer open={!!optionsState} onClose={() => setOptionsState(null)} height="auto" zIndex={70}>
        {optionsState && (() => {
          const targetSet = exercisesData[optionsState.exIdx]?.sets[optionsState.setIdx];
          return (
            <div className="px-6 pt-5 pb-8 space-y-2">
              <p className="text-sm font-bold text-muted mb-3">
                {exercisesData[optionsState.exIdx]?.name} — {optionsState.setIdx + 1}세트
              </p>

              {/* RPE 설정 */}
              <button
                type="button"
                onClick={() => {
                  setRpePickerState({ exIdx: optionsState.exIdx, setIdx: optionsState.setIdx });
                  setOptionsState(null);
                }}
                className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card active:scale-[0.98] transition-transform"
              >
                <div className="text-left">
                  <p className="text-sm font-bold">RPE 설정</p>
                  <p className="text-xs text-muted mt-0.5">주관적 운동 강도 (1–10)</p>
                </div>
                {targetSet?.rpe ? (
                  <span className="text-lg font-extrabold text-accent">{targetSet.rpe}</span>
                ) : (
                  <span className="text-xs text-muted">미설정</span>
                )}
              </button>

              {/* 세트 삭제 */}
              <button
                type="button"
                onClick={() => {
                  deleteSet(optionsState.exIdx, optionsState.setIdx);
                  setOptionsState(null);
                }}
                disabled={exercisesData[optionsState.exIdx]?.sets.length <= 1 || targetSet?.isCompleted}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-danger/30 bg-danger/5 text-danger disabled:opacity-30 active:scale-[0.98] transition-transform"
              >
                <Trash2 size={16} />
                <span className="text-sm font-bold">세트 삭제</span>
              </button>
            </div>
          );
        })()}
      </Drawer>

      {/* RPE 선택 Bottom Sheet */}
      <Drawer open={!!rpePickerState} onClose={() => setRpePickerState(null)} height="auto" zIndex={75}>
        {rpePickerState && (() => {
          const currentRpe = exercisesData[rpePickerState.exIdx]?.sets[rpePickerState.setIdx]?.rpe;
          const RPE_LABELS: Record<number, string> = {
            1: "매우 쉬움", 2: "쉬움", 3: "가벼움", 4: "편안함", 5: "보통",
            6: "약간 힘듦", 7: "힘듦", 8: "매우 힘듦", 9: "거의 한계", 10: "한계",
          };
          return (
            <div className="px-6 pt-5 pb-8">
              <h3 className="text-base font-bold mb-0.5">RPE 설정</h3>
              <p className="text-xs text-muted mb-4">주관적 운동 강도 척도 — {currentRpe ? RPE_LABELS[currentRpe] : "선택하세요"}</p>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rpe) => (
                  <button
                    key={rpe}
                    type="button"
                    onClick={() => setSetRpe(rpePickerState.exIdx, rpePickerState.setIdx, rpe)}
                    className={`h-12 rounded-xl text-base font-extrabold border transition-all active:scale-95 ${
                      currentRpe === rpe
                        ? "bg-accent text-background border-accent shadow-md shadow-accent/30"
                        : rpe >= 8
                        ? "bg-card border-border text-danger/80"
                        : rpe >= 6
                        ? "bg-card border-border text-amber-400"
                        : "bg-card border-border text-foreground"
                    }`}
                  >
                    {rpe}
                  </button>
                ))}
              </div>
              {currentRpe && (
                <button
                  type="button"
                  onClick={() => setSetRpe(rpePickerState.exIdx, rpePickerState.setIdx, undefined)}
                  className="w-full py-3 rounded-xl border border-border text-sm font-semibold text-muted active:scale-95 transition-transform"
                >
                  RPE 해제
                </button>
              )}
            </div>
          );
        })()}
      </Drawer>

      {/* 휴식 타이머 설정 Bottom Sheet */}
      <Drawer open={!!restPickerState} onClose={() => setRestPickerState(null)} height="auto" zIndex={72}>
        {restPickerState && (() => {
          const currentRest = exercisesData[restPickerState.exIdx]?.sets[restPickerState.setIdx]?.restTime || DEFAULT_REST;
          const PRESETS = [30, 60, 90, 120, 150, 180, 210, 240];
          return (
            <div className="px-6 pt-5 pb-8">
              <div className="flex items-center gap-2 mb-1">
                <Timer size={18} className="text-accent" />
                <h3 className="text-base font-bold">세트별 휴식 타이머 설정</h3>
              </div>
              <p className="text-xs text-muted mb-5">
                {exercisesData[restPickerState.exIdx]?.name} — {restPickerState.setIdx + 1}세트
              </p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {PRESETS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSetRestTimeAbsolute(restPickerState.exIdx, restPickerState.setIdx, sec)}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                      currentRest === sec
                        ? "bg-accent text-background border-accent shadow-md shadow-accent/30"
                        : "bg-card border-border text-foreground hover:border-accent"
                    }`}
                  >
                    {sec}초
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 mb-5">
                <button
                  type="button"
                  onClick={() => setSetRestTimeAbsolute(restPickerState.exIdx, restPickerState.setIdx, currentRest - REST_STEP)}
                  disabled={currentRest <= REST_STEP}
                  className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted disabled:opacity-30 active:scale-90 transition-transform"
                >
                  <Minus size={16} />
                </button>
                <span className="text-3xl font-extrabold w-24 text-center text-accent">{currentRest}초</span>
                <button
                  type="button"
                  onClick={() => setSetRestTimeAbsolute(restPickerState.exIdx, restPickerState.setIdx, currentRest + REST_STEP)}
                  disabled={currentRest >= MAX_REST_SECONDS}
                  className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted disabled:opacity-30 active:scale-90 transition-transform"
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRestPickerState(null)}
                className="w-full py-4 bg-foreground text-background font-bold rounded-xl active:scale-95 transition-transform"
              >
                확인
              </button>
            </div>
          );
        })()}
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

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-xs font-bold text-muted">휴식 타이머</span>
            <span className={`ml-auto text-lg font-bold leading-none tabular-nums ${isTimerRunning ? "text-accent" : "text-muted"}`}>
              {timerSeconds}초
            </span>
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
              onClick={() => setShowCompleteConfirm(true)}
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
            <div className="text-center py-2 px-4 bg-danger/10 border border-danger/25 rounded-xl">
              <p className="text-sm font-bold text-danger">이전보다 {Math.abs(summary.volumeDiff)}% 감소했어요</p>
              <p className="text-xs text-muted mt-0.5">괜찮아요, 다음엔 더 잘할 거예요</p>
            </div>
          )}

          {pendingUpdatedRoutine && !routineUpdated && (
            <button
              onClick={() => setShowUpdateDiff(true)}
              className="w-full py-3.5 bg-card border border-border font-bold rounded-2xl text-sm active:scale-95 transition-transform"
            >
              루틴 업데이트
            </button>
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

    {/* 변경 내용 확인 Drawer (요약 화면에서 "루틴 업데이트" 버튼으로 열림, z=110) */}
    <Drawer open={showUpdateDiff} onClose={() => setShowUpdateDiff(false)} height="80vh" zIndex={110}>
      <div className="flex justify-between items-center px-6 pt-4 pb-2 shrink-0">
        <h2 className="text-xl font-bold">변경 내용 확인</h2>
        <button onClick={() => setShowUpdateDiff(false)} className="p-2 -mr-2 text-muted hover:text-foreground">
          <X size={24} />
        </button>
      </div>
      <p className="text-xs text-muted px-6 pb-3 shrink-0">
        변경된 항목은 <span className="text-accent font-semibold">초록색</span>으로 표시됩니다.
      </p>
      <div className="flex-1 overflow-y-auto px-6 pb-2">
        {routineDiff.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40">
            <p className="text-sm text-muted text-center">기존 루틴과 동일한 기록이에요</p>
            <p className="text-xs text-muted mt-1">업데이트해도 변경 내용이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-5">
            {routineDiff.map(({ exName, oldSets, newSets }) => (
              <div key={exName}>
                <p className="text-sm font-bold mb-2">{exName}</p>
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  {Array.from({ length: Math.max(oldSets.length, newSets.length) }).map((_, i) => {
                    const os = oldSets[i];
                    const ns = newSets[i];
                    const changed = !os || !ns || os.weight !== ns.weight || os.reps !== ns.reps || os.weightMode !== ns.weightMode || os.weightMode !== ns.weightMode;
                    return (
                      <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}>
                        <span className="text-xs font-medium text-muted w-10 shrink-0">{i + 1}세트</span>
                        <span className="flex-1 text-xs text-muted">{os ? formatSetTemplate(os) : "없음"}</span>
                        <span className="text-muted text-xs shrink-0">→</span>
                        <span className={`flex-1 text-xs text-right font-semibold ${ns ? (changed ? "text-accent" : "text-foreground") : "text-danger"}`}>
                          {ns ? formatSetTemplate(ns) : "삭제"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 px-6 pb-6 pt-3 flex gap-3 border-t border-border">
        <button
          onClick={() => setShowUpdateDiff(false)}
          className="flex-1 py-4 bg-background border border-border rounded-2xl font-bold active:scale-95 transition-transform"
        >
          건너뛰기
        </button>
        <button
          onClick={handleConfirmUpdate}
          className="flex-[2] py-4 bg-accent text-background rounded-2xl font-extrabold active:scale-95 transition-transform"
        >
          업데이트 확인
        </button>
      </div>
    </Drawer>
    </>
  );
}
