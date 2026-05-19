"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Square, Timer, Trash2 } from "lucide-react";
import {
  getRoutines,
  getLastSessionByExercise,
  calculate1RM,
  saveWorkoutSession,
} from "@/utils/storage";
import { requestWakeLock, releaseWakeLock } from "@/utils/wakeLock";
import { ExerciseRecord, Routine, SetRecord, WorkoutSession } from "@/types";

const KG_TO_LB = 2.20462;
const MAX_REST_SECONDS = 240; // 4분
const REST_STEP = 30; // 30초 단위
const DEFAULT_REST = 60; // 기본 휴식 시간

export default function WorkoutPage({ params }: { params: Promise<{ routineId: string }> }) {
  const router = useRouter();
  const { routineId } = use(params);

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  
  const [exercisesData, setExercisesData] = useState<ExerciseRecord[]>([]);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  
  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerInitial, setTimerInitial] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio for Beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 1);
    } catch (e) {
      console.log("Audio play failed", e);
    }
  };

  useEffect(() => {
    const routines = getRoutines();
    const found = routines.find(r => r.id === routineId);
    if (!found) {
      alert("루틴을 찾을 수 없습니다.");
      router.push("/routines");
      return;
    }
    
    setRoutine(found);
    requestWakeLock();

    const initialData: ExerciseRecord[] = found.exercises.map(name => {
      const lastSession = getLastSessionByExercise(name);
      const lastEx = lastSession?.exercises.find(e => e.name === name);
      
      let sets: SetRecord[] = [{ id: crypto.randomUUID(), weight: 0, reps: 0, isCompleted: false, restTime: DEFAULT_REST }];
      
      if (lastEx && lastEx.sets.length > 0) {
        sets = lastEx.sets.map(s => ({
          ...s,
          id: crypto.randomUUID(),
          isCompleted: false,
          restTime: s.restTime || DEFAULT_REST,
        }));
      }

      return { id: name, name, sets };
    });

    setExercisesData(initialData);

    return () => {
      releaseWakeLock();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [routineId, router]);

  // Timer Effect
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerRef.current = setTimeout(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (isTimerRunning && timerSeconds === 0) {
      setIsTimerRunning(false);
      playBeep();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isTimerRunning, timerSeconds]);

  const startTimer = (seconds: number) => {
    const clamped = Math.min(seconds, MAX_REST_SECONDS);
    setTimerSeconds(clamped);
    setTimerInitial(clamped);
    setIsTimerRunning(true);
  };

  const adjustTimer = (delta: number) => {
    const newTime = Math.max(0, Math.min(timerSeconds + delta, MAX_REST_SECONDS));
    setTimerSeconds(newTime);
    if (newTime > timerInitial) setTimerInitial(newTime);
    if (newTime > 0 && !isTimerRunning) {
      setIsTimerRunning(true);
    }
  };

  // 단위 변환
  const toggleUnit = () => {
    const newUnit = unit === "kg" ? "lb" : "kg";
    const factor = newUnit === "lb" ? KG_TO_LB : (1 / KG_TO_LB);
    const newData = exercisesData.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => ({
        ...s,
        weight: s.weight > 0 ? Math.round(s.weight * factor) : 0,
      }))
    }));
    setExercisesData(newData);
    setUnit(newUnit);
  };

  // #3: 세트별 휴식 시간 변경
  const updateSetRestTime = (exIdx: number, setIdx: number, delta: number) => {
    const newData = [...exercisesData];
    const set = newData[exIdx].sets[setIdx];
    const current = set.restTime || DEFAULT_REST;
    set.restTime = Math.max(REST_STEP, Math.min(MAX_REST_SECONDS, current + delta));
    setExercisesData(newData);
  };

  const handleSetToggle = (exIdx: number, setIdx: number) => {
    const newData = [...exercisesData];
    const targetSet = newData[exIdx].sets[setIdx];
    
    targetSet.isCompleted = !targetSet.isCompleted;
    
    // 세트별 지정된 휴식 시간으로 타이머 시작
    if (targetSet.isCompleted) {
      const restTime = targetSet.restTime || DEFAULT_REST;
      startTimer(restTime);
    }
    
    setExercisesData(newData);

    const allCompleted = newData[exIdx].sets.every(s => s.isCompleted);
    if (allCompleted && targetSet.isCompleted && exIdx < exercisesData.length - 1) {
      setTimeout(() => {
        setCurrentExIndex(exIdx + 1);
      }, 500);
    }
  };

  const updateSet = (exIdx: number, setIdx: number, field: "weight" | "reps", value: number) => {
    const newData = [...exercisesData];
    newData[exIdx].sets[setIdx][field] = value;
    setExercisesData(newData);
  };

  const addSet = (exIdx: number) => {
    const newData = [...exercisesData];
    const sets = newData[exIdx].sets;
    const lastSet = sets[sets.length - 1];
    sets.push({
      id: crypto.randomUUID(),
      weight: lastSet ? lastSet.weight : 0,
      reps: lastSet ? lastSet.reps : 0,
      isCompleted: false,
      restTime: lastSet?.restTime || DEFAULT_REST,
    });
    setExercisesData(newData);
  };

  // #1: 세트 삭제
  const deleteSet = (exIdx: number, setIdx: number) => {
    const newData = [...exercisesData];
    if (newData[exIdx].sets.length <= 1) return; // 최소 1세트 유지
    newData[exIdx].sets.splice(setIdx, 1);
    setExercisesData(newData);
  };

  const finishWorkout = () => {
    if (!routine) return;
    const exercisesInKg = exercisesData.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => ({
        ...s,
        weight: unit === "lb" ? Math.round(s.weight / KG_TO_LB) : s.weight,
      }))
    }));
    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      routineId: routine.id,
      date: new Date().toISOString(),
      exercises: exercisesInKg,
    };
    saveWorkoutSession(session);
    alert("오운완! 고생하셨습니다.");
    router.push("/");
  };

  if (!routine || exercisesData.length === 0) return null;

  const currentExercise = exercisesData[currentExIndex];
  const lastSession = getLastSessionByExercise(currentExercise.name);
  const lastEx = lastSession?.exercises.find(e => e.name === currentExercise.name);

  // 1RM: 마지막 입력된 세트 기준
  const lastInputSet = [...currentExercise.sets].reverse().find(s => !s.isCompleted && s.weight > 0 && s.reps > 0);
  const lastInputSetIdx = lastInputSet ? currentExercise.sets.findIndex(s => s.id === lastInputSet.id) : -1;

  // 휴식 시간 포맷 헬퍼 (초 단위 표기)
  const formatRestTime = (sec: number) => `${sec}초`;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-background z-20">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-muted hover:text-foreground">
          <ChevronLeft size={24} />
        </button>
        <div className="flex gap-1.5">
          {routine.exercises.map((_, idx) => (
            <div 
              key={idx} 
              className={`w-2 h-2 rounded-full transition-all ${idx === currentExIndex ? 'w-6 bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>
        <div className="w-8" />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 pb-48">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold">{currentExercise.name}</h1>
            {lastEx && lastEx.sets.length > 0 && (
              <p className="text-sm text-muted mt-2 flex items-center gap-1">
                지난번 최고기록: {Math.max(...lastEx.sets.filter(s => s.isCompleted).map(s => s.weight))}kg x {Math.max(...lastEx.sets.filter(s => s.isCompleted).map(s => s.reps))}회
              </p>
            )}
          </div>
          <button 
            onClick={toggleUnit}
            className="px-3 py-1 bg-card border border-border rounded-lg text-sm font-bold active:scale-95"
          >
            {unit.toUpperCase()}
          </button>
        </div>

        {/* Sets */}
        <div className="space-y-3">
          <div className="flex text-xs font-medium text-muted px-2 mb-2">
            <span className="w-8 text-center">세트</span>
            <span className="flex-1 text-center">무게 ({unit})</span>
            <span className="flex-1 text-center">횟수</span>
            <span className="w-24 text-center">휴식</span>
            <span className="w-10 text-center">완료</span>
            <span className="w-8"></span>
          </div>

          {currentExercise.sets.map((set, sIdx) => (
            <div key={set.id}>
              <div className={`flex items-center p-2.5 rounded-2xl border transition-all ${set.isCompleted ? 'bg-success/10 border-success/30' : 'bg-card border-border'}`}>
                <span className={`w-8 text-center font-bold text-sm ${set.isCompleted ? 'text-success' : 'text-muted'}`}>{sIdx + 1}</span>
                
                <div className="flex-1 flex justify-center px-1">
                  <input 
                    type="number" 
                    value={set.weight || ""} 
                    onChange={(e) => updateSet(currentExIndex, sIdx, "weight", Number(e.target.value))}
                    placeholder="0"
                    className={`w-14 text-center bg-transparent text-lg font-bold focus:outline-none focus:text-accent transition-colors ${set.isCompleted ? 'text-success opacity-80' : ''}`}
                    disabled={set.isCompleted}
                  />
                </div>
                
                <div className="flex-1 flex justify-center px-1">
                  <input 
                    type="number" 
                    value={set.reps || ""} 
                    onChange={(e) => updateSet(currentExIndex, sIdx, "reps", Number(e.target.value))}
                    placeholder="0"
                    className={`w-14 text-center bg-transparent text-lg font-bold focus:outline-none focus:text-accent transition-colors ${set.isCompleted ? 'text-success opacity-80' : ''}`}
                    disabled={set.isCompleted}
                  />
                </div>

                {/* #3: 세트별 휴식 시간 */}
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
                
                <button 
                  onClick={() => handleSetToggle(currentExIndex, sIdx)}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 ${set.isCompleted ? 'bg-success text-white shadow-lg shadow-success/30' : 'bg-background border-2 border-border text-muted hover:border-accent'}`}
                >
                  {set.isCompleted ? <Check strokeWidth={3} size={18} /> : null}
                </button>

                {/* #1: 세트 삭제 버튼 */}
                <button
                  onClick={() => deleteSet(currentExIndex, sIdx)}
                  disabled={currentExercise.sets.length <= 1 || set.isCompleted}
                  className="w-8 flex items-center justify-center text-muted hover:text-danger disabled:opacity-20 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 세트 추가 버튼 */}
        <button 
          onClick={() => addSet(currentExIndex)}
          className="w-full mt-4 py-3 border-2 border-dashed border-border rounded-2xl text-muted font-bold hover:text-foreground hover:border-muted transition-colors"
        >
          + 세트 추가
        </button>

        {/* #2: 1RM 표기 - 세트 추가 UI 아래 배치 */}
        {lastInputSet && (
          <div className="mt-4 p-3 bg-accent/10 border border-accent/30 rounded-2xl text-center">
            <span className="text-xs text-muted font-medium">예상 1RM (세트 {lastInputSetIdx + 1} 기준)</span>
            <p className="text-2xl font-extrabold text-accent mt-1">
              {calculate1RM(lastInputSet.weight, lastInputSet.reps)} {unit}
            </p>
          </div>
        )}
      </main>

      {/* Bottom Fixed Area */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card border-t border-border p-4 pb-safe space-y-3 shadow-2xl">
        {/* 타이머 */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (isTimerRunning) {
                setIsTimerRunning(false);
                setTimerSeconds(0);
              } else {
                startTimer(DEFAULT_REST);
              }
            }}
            className={`p-2.5 rounded-full flex items-center justify-center transition-colors shrink-0 ${isTimerRunning ? 'bg-danger/20 text-danger' : 'bg-accent/20 text-accent'}`}
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
                 className={`h-full transition-all duration-1000 linear ${isTimerRunning ? 'bg-accent' : 'bg-transparent'}`} 
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
            onClick={() => setCurrentExIndex(i => Math.max(0, i - 1))}
            disabled={currentExIndex === 0}
            className="flex-1 bg-background border border-border py-3.5 rounded-xl font-bold flex justify-center items-center gap-1 disabled:opacity-30"
          >
            <ChevronLeft size={20} />
            이전
          </button>
          
          {currentExIndex < routine.exercises.length - 1 ? (
            <button 
              onClick={() => setCurrentExIndex(i => i + 1)}
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
  );
}
