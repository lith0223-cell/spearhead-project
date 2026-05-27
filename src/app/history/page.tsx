"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Dumbbell, Utensils, Trash2, Pencil, Plus, X } from "lucide-react";
import {
  getWorkoutSessions,
  getAllDietRecords,
  calculateCalories,
  calculate1RM,
  deleteWorkoutSession,
  updateWorkoutSession,
  saveWorkoutSession,
  getRoutines,
  deleteDietItem,
  getSessionsByExerciseName,
  getAllWeightRecords,
  estimateRoutineCalories,
  getLastSessionByExercise,
} from "@/utils/storage";
import { WorkoutSession, DietRecord, MealType, MealItem, Routine, ExerciseRecord, BodyWeightRecord, WeightMode } from "@/types";
import { useActiveWorkout } from "@/providers/ActiveWorkoutProvider";
import { Drawer } from "@/components/ui/Drawer";
import { DietItemDrawer, type DietItemDrawerEditing } from "@/components/ui/DietItemDrawer";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MEAL_TYPES: MealType[] = ["아침", "점심", "저녁", "간식"];

const WEIGHT_MODE_CYCLE: WeightMode[] = ["weighted", "bodyweight", "assisted"];
const nextWeightMode = (mode: WeightMode): WeightMode => {
  const idx = WEIGHT_MODE_CYCLE.indexOf(mode);
  return WEIGHT_MODE_CYCLE[(idx + 1) % WEIGHT_MODE_CYCLE.length];
};

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function HistoryPage() {
  const { isActive } = useActiveWorkout();
  const [today, setToday] = useState(() => new Date());
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toDateStr(new Date()));
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [dietRecords, setDietRecords] = useState<DietRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<BodyWeightRecord[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [userWeight, setUserWeight] = useState(70);

  // 운동 수정 모달
  const [editDraft, setEditDraft] = useState<WorkoutSession | null>(null);
  // 운동 추가 모달
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addRoutineId, setAddRoutineId] = useState<string>("");
  const [addExData, setAddExData] = useState<
    { name: string; sets: { id: string; weight: string; reps: string; weightMode?: WeightMode }[] }[]
  >([]);

  // 식단 추가/수정 모달
  const [isDietOpen, setIsDietOpen] = useState(false);
  const [dietEditing, setDietEditing] = useState<DietItemDrawerEditing | null>(null);

  // 탭
  const [activeTab, setActiveTab] = useState<"history" | "analytics">("history");

  // 분석 탭
  const [chartExName, setChartExName] = useState<string>("");
  const [chartMetric, setChartMetric] = useState<"1rm" | "weight" | "volume">("1rm");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDietCardOpen, setIsDietCardOpen] = useState(true);
  const [isWeightCardOpen, setIsWeightCardOpen] = useState(true);

  const refreshData = () => {
    setSessions(getWorkoutSessions());
    setDietRecords(getAllDietRecords());
    setWeightRecords(getAllWeightRecords());
  };

  useEffect(() => {
    refreshData();
    setRoutines(getRoutines());
    setUserWeight(parseInt(localStorage.getItem("ph_user_weight") || "70"));

    // 자정 경계 갱신 — 앱이 켜진 채 날짜가 바뀌어도 todayStr이 정확히 유지되도록 today를 1분마다 재계산
    const refreshToday = () => {
      const now = new Date();
      setToday((prev) => (toDateStr(prev) === toDateStr(now) ? prev : now));
    };
    const interval = setInterval(refreshToday, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") refreshToday(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const sessionByDate = useMemo(() => {
    const map: Record<string, WorkoutSession[]> = {};
    sessions.forEach((s) => {
      const d = toDateStr(new Date(s.date));
      if (!map[d]) map[d] = [];
      map[d].push(s);
    });
    return map;
  }, [sessions]);

  const dietByDate = useMemo(() => {
    const map: Record<string, DietRecord[]> = {};
    dietRecords.forEach((r) => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return map;
  }, [dietRecords]);

  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(viewYear, viewMonth, d));
    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const todayStr = toDateStr(today);
  const selectedSessions = selectedDate ? (sessionByDate[selectedDate] ?? []) : [];
  const selectedDiets = selectedDate ? (dietByDate[selectedDate] ?? []) : [];

  const totalNutrition = useMemo(() => {
    let carbs = 0, protein = 0, fat = 0;
    selectedDiets.forEach((r) => r.items.forEach((item) => {
      carbs += item.carbs; protein += item.protein; fat += item.fat;
    }));
    const calories = calculateCalories(carbs, protein, fat);
    const carbsPercent = calories > 0 ? Math.round((carbs * 4 / calories) * 100) : 0;
    const proteinPercent = calories > 0 ? Math.round((protein * 4 / calories) * 100) : 0;
    const fatPercent = calories > 0 ? 100 - carbsPercent - proteinPercent : 0;
    return { carbs, protein, fat, calories, carbsPercent, proteinPercent, fatPercent };
  }, [selectedDiets]);

  const getRoutineName = (routineId: string) =>
    routines.find((r) => r.id === routineId)?.name ?? "기록된 운동";

  const isExerciseCardio = (session: WorkoutSession, exName: string): boolean => {
    const r = routines.find(rt => rt.id === session.routineId);
    return r?.exerciseConfigs?.find(c => c.name === exName)?.category === "유산소";
  };

  // ── 운동 CRUD ──
  const handleDeleteSession = (sessionId: string) => {
    if (!confirm("이 운동 기록을 삭제하시겠습니까?")) return;
    deleteWorkoutSession(sessionId);
    refreshData();
  };

  const openEditModal = (session: WorkoutSession) => setEditDraft(structuredClone(session));

  const handleEditSetChange = (exIdx: number, setIdx: number, field: "weight" | "reps", value: string) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.exercises[exIdx].sets[setIdx][field] = value === "" ? 0 : Number(value);
      return next;
    });
  };

  const addEditSet = (exIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const ex = next.exercises[exIdx];
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        id: crypto.randomUUID(),
        weight: last?.weight ?? 0,
        reps: last?.reps ?? 0,
        isCompleted: true,
        restTime: last?.restTime ?? 60,
      });
      return next;
    });
  };

  const removeEditSet = (exIdx: number, setIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.exercises[exIdx].sets.splice(setIdx, 1);
      return next;
    });
  };

  const handleEditSave = () => {
    if (!editDraft) return;
    updateWorkoutSession(editDraft);
    refreshData();
    setEditDraft(null);
  };

  const openAddModal = () => { setAddStep(1); setAddRoutineId(""); setAddExData([]); setIsAddOpen(true); };

  const selectRoutineForAdd = (routineId: string) => {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;
    setAddRoutineId(routineId);

    // 1순위: exerciseConfigs에 세트 정보가 있으면 그대로 불러옴
    // 2순위: 이전 운동 기록이 있으면 마지막 기록의 세트를 불러옴
    // 3순위: 빈 1세트
    const exData = routine.exercises.map((name) => {
      const config = routine.exerciseConfigs?.find((c) => c.name === name);
      if (config && config.sets.length > 0) {
        return {
          name,
          sets: config.sets.map((s) => ({
            id: crypto.randomUUID(),
            weight: s.weightMode === "bodyweight" ? "" : (s.weight ? String(s.weight) : ""),
            reps: s.reps ? String(s.reps) : "",
            weightMode: s.weightMode,
          })),
        };
      }
      const lastSession = getLastSessionByExercise(name);
      const lastEx = lastSession?.exercises.find((e) => e.name === name);
      if (lastEx && lastEx.sets.length > 0) {
        const completedSets = lastEx.sets.filter((s) => s.isCompleted && (s.weight > 0 || s.reps > 0));
        if (completedSets.length > 0) {
          return {
            name,
            sets: completedSets.map((s) => ({
              id: crypto.randomUUID(),
              weight: s.weightMode === "bodyweight" ? "" : (s.weight ? String(s.weight) : ""),
              reps: s.reps ? String(s.reps) : "",
              weightMode: s.weightMode,
            })),
          };
        }
      }
      return { name, sets: [{ id: crypto.randomUUID(), weight: "", reps: "", weightMode: undefined }] };
    });

    setAddExData(exData);
    setAddStep(2);
  };

  const addAddSet = (exIdx: number) => {
    setAddExData((prev) => {
      const next = [...prev];
      const ex = { ...next[exIdx], sets: [...next[exIdx].sets] };
      const last = ex.sets[ex.sets.length - 1];
      ex.sets = [
        ...ex.sets,
        {
          id: crypto.randomUUID(),
          weight: last?.weightMode === "bodyweight" ? "" : (last?.weight ?? ""),
          reps: last?.reps ?? "",
          weightMode: last?.weightMode,
        },
      ];
      next[exIdx] = ex;
      return next;
    });
  };

  const removeAddSet = (exIdx: number, setIdx: number) => {
    setAddExData((prev) => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], sets: next[exIdx].sets.filter((_, i) => i !== setIdx) };
      return next;
    });
  };

  const updateAddSet = (exIdx: number, setIdx: number, field: "weight" | "reps", value: string) => {
    setAddExData((prev) => {
      const next = [...prev];
      const sets = [...next[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      next[exIdx] = { ...next[exIdx], sets };
      return next;
    });
  };

  const updateAddSetMode = (exIdx: number, setIdx: number) => {
    setAddExData((prev) => {
      const next = [...prev];
      const sets = [...next[exIdx].sets];
      const current = sets[setIdx].weightMode ?? "weighted";
      const newMode = nextWeightMode(current);
      sets[setIdx] = {
        ...sets[setIdx],
        weightMode: newMode,
        weight: newMode === "bodyweight" ? "" : sets[setIdx].weight,
      };
      next[exIdx] = { ...next[exIdx], sets };
      return next;
    });
  };

  const handleAddSave = () => {
    if (!selectedDate) return;
    const exercises: ExerciseRecord[] = addExData
      .map((ex) => ({
        id: ex.name, name: ex.name,
        sets: ex.sets
          .filter((s) => s.reps !== "")
          .map((s) => ({
            id: s.id,
            weight: s.weightMode === "bodyweight" ? 0 : Number(s.weight),
            reps: Number(s.reps),
            isCompleted: true,
            restTime: 60,
            weightMode: s.weightMode,
          })),
      }))
      .filter((ex) => ex.sets.length > 0);
    if (exercises.length === 0) return;
    // 사용자 로컬 정오 시각을 ISO로 저장 → 어느 시간대에서도 selectedDate와 동일한 날짜로 분류됨
    const localNoon = new Date(`${selectedDate}T12:00:00`);
    saveWorkoutSession({ id: crypto.randomUUID(), routineId: addRoutineId, date: localNoon.toISOString(), exercises });
    refreshData();
    setIsAddOpen(false);
  };

  // ── 식단 CRUD ──
  const openDietAddModal = () => {
    setDietEditing(null);
    setIsDietOpen(true);
  };

  const openDietEditModal = (record: DietRecord, item: MealItem) => {
    setDietEditing({
      recordId: record.id,
      itemId: item.id,
      mealType: record.mealType,
      foodName: item.name,
      carbs: item.carbs,
      protein: item.protein,
      fat: item.fat,
    });
    setIsDietOpen(true);
  };

  const handleDietDelete = (recordId: string, itemId: string) => {
    if (!confirm("이 식단을 삭제하시겠습니까?")) return;
    deleteDietItem(recordId, itemId);
    refreshData();
  };

  // 식단 주간 분석
  const dietWeeklyPoints = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const dateStr = toDateStr(d);
      const dayRecords = dietRecords.filter(r => r.date === dateStr);
      let carbs = 0, protein = 0, fat = 0;
      dayRecords.forEach(r => r.items.forEach(item => { carbs += item.carbs; protein += item.protein; fat += item.fat; }));
      return { date: `${d.getMonth() + 1}/${d.getDate()}`, calories: calculateCalories(carbs, protein, fat), carbs, protein, fat, hasData: dayRecords.length > 0 };
    });
  }, [dietRecords]);

  const dietWeekAvg = useMemo(() => {
    const days = dietWeeklyPoints.filter(p => p.hasData);
    if (days.length === 0) return null;
    return {
      calories: Math.round(days.reduce((s, p) => s + p.calories, 0) / days.length),
      carbs: Math.round(days.reduce((s, p) => s + p.carbs, 0) / days.length),
      protein: Math.round(days.reduce((s, p) => s + p.protein, 0) / days.length),
      fat: Math.round(days.reduce((s, p) => s + p.fat, 0) / days.length),
      days: days.length,
    };
  }, [dietWeeklyPoints]);

  const weightChartPoints = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 29);
    const cutoffStr = toDateStr(cutoff);
    return [...weightRecords]
      .filter(r => r.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => {
        const d = new Date(r.date + "T00:00:00");
        return { date: `${d.getMonth() + 1}/${d.getDate()}`, value: r.weight };
      });
  }, [weightRecords]);

  // 분석 탭용 데이터
  const allExerciseNames = useMemo(() => {
    const names = new Set<string>();
    sessions.forEach(s => s.exercises.forEach(e => names.add(e.name)));
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ko"));
  }, [sessions]);

  const chartData = useMemo(() => {
    if (!chartExName) return [];
    return getSessionsByExerciseName(chartExName).slice(-10);
  }, [chartExName, sessions]);

  const chartPoints = useMemo(() => {
    return chartData.map(({ date, sets }) => {
      const completed = sets.filter(s => s.isCompleted && s.weight > 0 && s.reps > 0);
      if (completed.length === 0) return null;
      let value = 0;
      if (chartMetric === "1rm") value = Math.max(...completed.map(s => calculate1RM(s.weight, s.reps)));
      else if (chartMetric === "weight") value = Math.max(...completed.map(s => s.weight));
      else value = completed.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const d = new Date(date);
      return { date: `${d.getMonth() + 1}/${d.getDate()}`, value };
    }).filter(Boolean) as { date: string; value: number }[];
  }, [chartData, chartMetric]);

  const SvgChart = ({ points }: { points: { date: string; value: number }[] }) => {
    if (points.length < 2) return (
      <div className="flex items-center justify-center h-40 text-sm text-muted">
        {points.length === 1 ? "기록이 2회 이상 있어야 차트가 표시됩니다" : "기록이 없습니다"}
      </div>
    );
    const W = 320, H = 160, PL = 44, PR = 12, PT = 12, PB = 28;
    const cW = W - PL - PR, cH = H - PT - PB;
    const vals = points.map(p => p.value);
    const minV = Math.min(...vals), maxV = Math.max(...vals);
    const range = maxV - minV || 1;
    const toX = (i: number) => PL + (i / (points.length - 1)) * cW;
    const toY = (v: number) => PT + cH - ((v - minV) / range) * cH;
    const polyline = points.map((p, i) => `${toX(i)},${toY(p.value)}`).join(" ");
    const yTicks = [minV, minV + range / 2, maxV].map(v => Math.round(v));
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
        {yTicks.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
              <text x={PL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.4}>{v}</text>
            </g>
          );
        })}
        <polygon points={`${PL},${PT + cH} ${polyline} ${W - PR},${PT + cH}`} fill="var(--color-accent)" fillOpacity={0.08} stroke="none" />
        <polyline points={polyline} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.value)} r={3.5} fill="var(--color-accent)" />
            <text x={toX(i)} y={H - 4} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.5}>{p.date}</text>
          </g>
        ))}
        <circle cx={toX(points.length - 1)} cy={toY(points[points.length - 1].value)} r={5} fill="var(--color-accent)" />
        <text x={toX(points.length - 1)} y={toY(points[points.length - 1].value) - 8} textAnchor="middle" fontSize={10} fill="var(--color-accent)" fontWeight="bold">
          {points[points.length - 1].value}
        </text>
      </svg>
    );
  };

  return (
    <main className="flex flex-col h-full animate-in fade-in duration-300">
      <header className="px-6 py-6 border-b border-border bg-card sticky top-0 z-10">
        <h1 className="text-2xl font-bold">기록</h1>
        <div className="flex gap-1 mt-4 bg-background rounded-xl p-1">
          {([["history", "캘린더"], ["analytics", "분석"]] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className={`flex-1 overflow-y-auto ${isActive ? "pb-24" : "pb-8"}`}>
      {activeTab === "analytics" ? (
        <div className="p-4 space-y-4">
          {allExerciseNames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-muted text-sm">운동 기록이 없습니다</p>
              <p className="text-muted text-xs mt-1">운동을 완료하면 여기서 성장 추이를 확인할 수 있어요</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(p => !p)}
                  className={`w-full flex items-center justify-between px-4 py-3 bg-card border rounded-xl text-sm font-semibold transition-colors ${isDropdownOpen ? "border-accent" : "border-border"}`}
                >
                  <span className={chartExName ? "text-foreground" : "text-muted"}>
                    {chartExName || "종목을 선택하세요"}
                  </span>
                  <ChevronDown size={16} className={`text-muted transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-20 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="max-h-56 overflow-y-auto py-1">
                        {allExerciseNames.map(name => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => { setChartExName(name); setIsDropdownOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                              chartExName === name
                                ? "bg-accent/15 text-accent font-semibold"
                                : "text-foreground hover:bg-background font-medium"
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {chartExName && (
                <>
                  <div className="flex gap-2">
                    {([["1rm", "예상 1RM"], ["weight", "최대 무게"], ["volume", "총 볼륨"]] as const).map(([m, label]) => (
                      <button
                        key={m}
                        onClick={() => setChartMetric(m)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                          chartMetric === m ? "bg-accent text-background border-accent" : "bg-card border-border text-muted"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-semibold text-muted mb-3">
                      {chartExName} — {chartMetric === "1rm" ? "예상 1RM" : chartMetric === "weight" ? "최대 무게" : "총 볼륨"}
                      {chartMetric === "volume" ? " (kg·회)" : " (kg)"}
                    </p>
                    <SvgChart points={chartPoints} />
                  </div>

                  {chartPoints.length > 0 && (() => {
                    const vals = chartPoints.map(p => p.value);
                    const best = Math.max(...vals);
                    const latest = vals[vals.length - 1];
                    const first = vals[0];
                    const totalGrowth = first > 0 ? Math.round(((latest - first) / first) * 100) : null;
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "최고 기록", value: best, unit: "kg" },
                          { label: "최근 기록", value: latest, unit: "kg" },
                          { label: "전체 성장", value: totalGrowth !== null ? `${totalGrowth > 0 ? "+" : ""}${totalGrowth}%` : "-", unit: "" },
                        ].map(({ label, value, unit }) => (
                          <div key={label} className="bg-card border border-border rounded-2xl p-3 text-center">
                            <p className="text-[10px] text-muted mb-1">{label}</p>
                            <p className="text-lg font-extrabold leading-none">{value}</p>
                            {unit && <p className="text-[10px] text-muted mt-0.5">{unit}</p>}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </>
          )}

          {/* 식단 분석 */}

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setIsDietCardOpen(o => !o)}
              className="w-full px-4 pt-4 pb-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Utensils size={14} className="text-accent" />
                <p className="text-sm font-semibold">식단 분석 (최근 7일)</p>
              </div>
              <ChevronDown size={16} className={`text-muted transition-transform duration-300 ${isDietCardOpen ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isDietCardOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <div className="border-t border-border">
                  {dietWeekAvg ? (
                    <div className="p-4 space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-muted mb-3">칼로리 추이 — 최근 7일</p>
                        <SvgChart points={dietWeeklyPoints.filter(p => p.hasData).map(p => ({ date: p.date, value: p.calories }))} />
                      </div>
                      <div>
                        <p className="text-xs text-muted mb-2">일 평균 ({dietWeekAvg.days}일 기준)</p>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: "칼로리", value: dietWeekAvg.calories, unit: "kcal", color: "text-accent" },
                            { label: "탄수화물", value: dietWeekAvg.carbs, unit: "g", color: "text-blue-400" },
                            { label: "단백질", value: dietWeekAvg.protein, unit: "g", color: "text-emerald-400" },
                            { label: "지방", value: dietWeekAvg.fat, unit: "g", color: "text-amber-400" },
                          ].map(({ label, value, unit, color }) => (
                            <div key={label} className="bg-background rounded-xl p-2.5 text-center">
                              <p className="text-[10px] text-muted mb-1">{label}</p>
                              <p className={`text-base font-extrabold leading-none ${color}`}>{value}</p>
                              <p className="text-[9px] text-muted mt-0.5">{unit}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <p className="text-sm text-muted">최근 7일간 식단 기록이 없습니다</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 체중 추이 */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setIsWeightCardOpen(o => !o)}
              className="w-full px-4 pt-4 pb-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M3 6h18M3 12h18M3 18h18" /><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="2" fill="currentColor" stroke="none" /></svg>
                <p className="text-sm font-semibold">체중 추이 (최근 30일)</p>
              </div>
              <ChevronDown size={16} className={`text-muted transition-transform duration-300 ${isWeightCardOpen ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isWeightCardOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <div className="border-t border-border">
                  {weightChartPoints.length >= 2 ? (
                    <div className="p-4">
                      <SvgChart points={weightChartPoints} />
                      <div className="flex justify-between mt-2 text-xs text-muted">
                        <span>최저 {Math.min(...weightChartPoints.map(p => p.value))}kg</span>
                        <span>최고 {Math.max(...weightChartPoints.map(p => p.value))}kg</span>
                        <span>최근 {weightChartPoints[weightChartPoints.length - 1].value}kg</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-1">
                      <p className="text-sm text-muted">
                        {weightChartPoints.length === 1 ? "2회 이상 기록하면 추이를 볼 수 있어요" : "식단 탭에서 체중을 기록해보세요"}
                      </p>
                      <p className="text-xs text-muted/60">날짜를 이동하며 매일 체중을 입력하세요</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
        {/* 캘린더 */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 text-muted hover:text-foreground active:scale-90 transition-transform">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-bold">{viewYear}년 {viewMonth + 1}월</h2>
            <button onClick={nextMonth} className="p-2 text-muted hover:text-foreground active:scale-90 transition-transform">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d, i) => (
              <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? "text-danger" : i === 6 ? "text-accent/80" : "text-muted"}`}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />;
              const ds = toDateStr(date);
              const hasWorkout = !!sessionByDate[ds];
              const hasDiet = !!dietByDate[ds];
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDate;
              const dow = date.getDay();
              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDate(ds === selectedDate ? null : ds)}
                  className={`relative flex flex-col items-center py-2 rounded-xl transition-all active:scale-95 ${
                    isSelected ? "bg-accent/20 border border-accent" : isToday ? "bg-card border border-border" : "hover:bg-card"
                  }`}
                >
                  <span className={`text-sm font-medium leading-none mb-1.5 ${
                    isSelected ? "text-accent font-bold" : isToday ? "text-foreground font-bold" : dow === 0 ? "text-danger" : dow === 6 ? "text-accent/70" : "text-foreground"
                  }`}>
                    {date.getDate()}
                  </span>
                  <div className="flex gap-0.5 h-1.5">
                    {hasWorkout && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    {hasDiet && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent" /><span className="text-xs text-muted">운동</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" /><span className="text-xs text-muted">식단</span></div>
          </div>
        </div>

        {/* 선택한 날짜 상세 */}
        {selectedDate && (
          <div className="px-4 space-y-4 animate-in slide-in-from-bottom-4 duration-200">
            <h3 className="text-sm font-semibold text-muted">
              {(() => { const d = new Date(selectedDate + "T00:00:00"); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`; })()}
            </h3>

            {/* 운동 기록 */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Dumbbell size={14} className="text-accent" />
                  <p className="text-sm font-semibold">운동 기록</p>
                </div>
                <button onClick={openAddModal} className="flex items-center gap-1 text-xs text-accent hover:text-accent/70 transition-colors">
                  <Plus size={14} />추가
                </button>
              </div>

              {selectedSessions.length > 0 ? (
                <div>
                  {selectedSessions.map((session, sIdx) => (
                    <div key={session.id} className={`px-4 py-3 space-y-2 ${sIdx > 0 ? "border-t border-border" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{getRoutineName(session.routineId)}</span>
                        <div className="flex items-center">
                          <button onClick={() => openEditModal(session)} className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors px-2 py-1">
                            <Pencil size={12} />수정
                          </button>
                          <button onClick={() => handleDeleteSession(session.id)} className="flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors px-2 py-1">
                            <Trash2 size={12} />삭제
                          </button>
                        </div>
                      </div>
                      {session.exercises.map((ex) => {
                        const done = ex.sets.filter((s) => s.isCompleted && (s.weight > 0 || s.reps > 0));
                        if (done.length === 0) return null;
                        const isCardio = isExerciseCardio(session, ex.name);
                        return (
                          <div key={ex.id} className="bg-background rounded-xl px-3 py-2.5">
                            <p className="text-xs font-bold text-foreground mb-1.5">{ex.name}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {done.map((s, i) => (
                                <span key={s.id} className="text-xs text-muted">
                                  {i + 1}{isCardio ? "구간" : "세트"}{" "}
                                  <span className="text-foreground font-semibold">
                                    {isCardio
                                      ? `${(s.weight || 0).toFixed(1)}km × ${s.reps}분`
                                      : s.weightMode === "bodyweight"
                                      ? `${s.reps}회`
                                      : s.weightMode === "assisted"
                                      ? `보조 ${s.weight}kg × ${s.reps}회`
                                      : `${s.weight}kg × ${s.reps}회`}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 flex flex-col items-center gap-2">
                  <Dumbbell size={20} className="text-muted" />
                  <p className="text-xs text-muted">운동 기록 없음</p>
                </div>
              )}
            </div>

            {/* 식단 기록 */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Utensils size={14} className="text-accent" />
                  <p className="text-sm font-semibold">식단 기록</p>
                </div>
                <button onClick={openDietAddModal} className="flex items-center gap-1 text-xs text-accent hover:text-accent/70 transition-colors">
                  <Plus size={14} />추가
                </button>
              </div>

              {selectedDiets.length > 0 ? (
                <>
                  {/* 영양 요약 */}
                  <div className="px-4 pt-3 pb-3 border-b border-border space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-sm text-muted">총 섭취 칼로리</span>
                      <span className="text-2xl font-extrabold text-accent">
                        {totalNutrition.calories} <span className="text-sm font-normal text-muted">kcal</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-muted">탄 {totalNutrition.carbs}g <span className="text-accent font-bold">({totalNutrition.carbsPercent}%)</span></span>
                      <span className="text-muted">단 {totalNutrition.protein}g <span className="text-accent font-bold">({totalNutrition.proteinPercent}%)</span></span>
                      <span className="text-muted">지 {totalNutrition.fat}g <span className="text-accent font-bold">({totalNutrition.fatPercent}%)</span></span>
                    </div>
                    {totalNutrition.calories > 0 && (
                      <div className="flex w-full h-2 rounded-full overflow-hidden gap-0.5">
                        <div className="bg-blue-400 rounded-l-full" style={{ width: `${totalNutrition.carbsPercent}%` }} />
                        <div className="bg-emerald-400" style={{ width: `${totalNutrition.proteinPercent}%` }} />
                        <div className="bg-amber-400 rounded-r-full" style={{ width: `${totalNutrition.fatPercent}%` }} />
                      </div>
                    )}
                  </div>

                  {/* 끼니별 아이템 */}
                  <div className="px-4">
                    {(() => {
                      let mealCount = 0;
                      return MEAL_TYPES.map((type) => {
                        const mealsOfType = selectedDiets.filter((r) => r.mealType === type);
                        if (mealsOfType.length === 0) return null;
                        const isFirst = mealCount++ === 0;
                        return (
                          <div key={type} className={`py-3 space-y-2 ${isFirst ? "" : "border-t border-border"}`}>
                            <h4 className="font-bold text-sm border-l-4 border-accent pl-2">{type}</h4>
                            {mealsOfType.map((record) =>
                              record.items.map((item) => (
                                <div key={item.id} className="bg-background rounded-xl px-3 py-2.5 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium flex-1 min-w-0 truncate">{item.name}</p>
                                    <span className="text-sm font-bold text-accent shrink-0">
                                      {calculateCalories(item.carbs, item.protein, item.fat)}kcal
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted">탄 {item.carbs}g • 단 {item.protein}g • 지 {item.fat}g</p>
                                  <div className="flex justify-end gap-1">
                                    <button
                                      onClick={() => openDietEditModal(record, item)}
                                      className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors px-2 py-1"
                                    >
                                      <Pencil size={12} />수정
                                    </button>
                                    <button
                                      onClick={() => handleDietDelete(record.id, item.id)}
                                      className="flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors px-2 py-1"
                                    >
                                      <Trash2 size={12} />삭제
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              ) : (
                <div className="px-4 py-6 flex flex-col items-center gap-2">
                  <Utensils size={20} className="text-muted" />
                  <p className="text-xs text-muted">식단 기록 없음</p>
                </div>
              )}
            </div>
          </div>
        )}
        </>
      )}
      </div>

      {/* 운동 수정 Drawer */}
      <Drawer open={!!editDraft} onClose={() => setEditDraft(null)} height="85vh" zIndex={60}>
        <div className="flex justify-between items-center shrink-0 px-6 pt-3 pb-3">
          <h2 className="text-xl font-bold">운동 기록 수정</h2>
          <button onClick={() => setEditDraft(null)} className="p-2 -mr-2 text-muted hover:text-foreground"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-5">
          {editDraft?.exercises.map((ex, exIdx) => (
            <div key={ex.id} className="space-y-2">
              <p className="text-sm font-bold">{ex.name}</p>
              {ex.sets.map((set, setIdx) => (
                <div key={set.id} className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-5 text-center shrink-0 leading-none ${
                    set.weightMode === "bodyweight" ? "text-blue-400" :
                    set.weightMode === "assisted" ? "text-purple-400" :
                    "text-muted"
                  }`}>
                    {set.weightMode === "bodyweight" ? "BW" : set.weightMode === "assisted" ? "AS" : setIdx + 1}
                  </span>
                  {set.weightMode === "assisted" && (
                    <span className="text-[10px] font-bold text-purple-400 shrink-0">보조</span>
                  )}
                  {set.weightMode !== "bodyweight" ? (
                    <input type="text" inputMode="decimal" value={set.weight}
                      onChange={(e) => handleEditSetChange(exIdx, setIdx, "weight", e.target.value)}
                      placeholder="0"
                      className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-2 text-sm font-bold text-center focus:outline-none focus:border-accent transition-colors" />
                  ) : (
                    <span className="flex-1 text-center text-sm text-muted opacity-40">—</span>
                  )}
                  {set.weightMode !== "bodyweight" && (
                    <span className="text-xs text-muted shrink-0">kg ×</span>
                  )}
                  <input type="text" inputMode="decimal" value={set.reps} onChange={(e) => handleEditSetChange(exIdx, setIdx, "reps", e.target.value)} placeholder="0"
                    className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-2 text-sm font-bold text-center focus:outline-none focus:border-accent transition-colors" />
                  <span className="text-xs text-muted shrink-0">회</span>
                  <button onClick={() => removeEditSet(exIdx, setIdx)} disabled={ex.sets.length <= 1}
                    className="p-1.5 text-muted hover:text-danger transition-colors disabled:opacity-20 shrink-0"><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={() => addEditSet(exIdx)} className="flex items-center gap-1 text-xs text-accent hover:text-accent/70 transition-colors">
                <Plus size={12} />세트 추가
              </button>
            </div>
          ))}
        </div>
        <div className="shrink-0 px-6 pb-6 pt-2">
          <button onClick={handleEditSave} className="w-full bg-foreground text-background font-bold py-4 rounded-xl active:scale-95 transition-transform">
            저장하기
          </button>
        </div>
      </Drawer>

      {/* 운동 추가 모달 */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in" onClick={() => setIsAddOpen(false)}>
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl animate-in slide-in-from-bottom-8 flex flex-col h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-border shrink-0">
              <h2 className="text-xl font-bold">운동 기록 추가</h2>
              <button onClick={() => setIsAddOpen(false)} className="p-2 -mr-2 text-muted hover:text-foreground"><X size={24} /></button>
            </div>
            {addStep === 1 ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                <p className="text-sm text-muted">루틴을 선택하세요</p>
                {routines.length === 0 ? (
                  <p className="text-xs text-muted text-center py-8">등록된 루틴이 없습니다</p>
                ) : (
                  routines.map((r) => {
                    const tSets = r.exerciseConfigs?.reduce((s, c) => s + c.sets.length, 0) ?? 0;
                    const kcal = estimateRoutineCalories(r, userWeight);
                    const parts = [
                      `${r.exercises.length}종목`,
                      ...(tSets > 0 ? [`${tSets}세트`] : []),
                      ...(kcal > 0 ? [`약 ${kcal}kcal`] : []),
                    ];
                    return (
                      <button key={r.id} onClick={() => selectRoutineForAdd(r.id)}
                        className="w-full text-left bg-background border border-border rounded-xl px-4 py-3 hover:border-accent transition-colors active:scale-[0.98]">
                        <p className="font-semibold text-sm">{r.name}</p>
                        <p className="text-xs text-muted mt-0.5">{parts.join(" · ")}</p>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {addExData.map((ex, exIdx) => (
                    <div key={ex.name} className="space-y-2">
                      <p className="text-sm font-bold">{ex.name}</p>
                      {ex.sets.map((set, setIdx) => (
                        <div key={set.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateAddSetMode(exIdx, setIdx)}
                            className={`text-xs font-bold w-5 text-center shrink-0 leading-none transition-colors ${
                              set.weightMode === "bodyweight" ? "text-blue-400" :
                              set.weightMode === "assisted" ? "text-purple-400" :
                              "text-muted"
                            }`}
                            title="탭하여 모드 변경"
                          >
                            {set.weightMode === "bodyweight" ? "BW" : set.weightMode === "assisted" ? "AS" : setIdx + 1}
                          </button>
                          {set.weightMode !== "bodyweight" && (
                            <>
                              {set.weightMode === "assisted" && (
                                <span className="text-[10px] font-bold text-purple-400 shrink-0">보조</span>
                              )}
                              <input type="text" inputMode="decimal"
                                value={set.weight}
                                onChange={(e) => updateAddSet(exIdx, setIdx, "weight", e.target.value)}
                                placeholder="0"
                                className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-2 text-sm font-bold text-center focus:outline-none focus:border-accent transition-colors" />
                              <span className="text-xs text-muted shrink-0">kg ×</span>
                            </>
                          )}
                          {set.weightMode === "bodyweight" && (
                            <span className="flex-1 text-center text-sm text-muted opacity-40">—</span>
                          )}
                          <input type="text" inputMode="decimal"
                            value={set.reps}
                            onChange={(e) => updateAddSet(exIdx, setIdx, "reps", e.target.value)}
                            placeholder="0"
                            className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-2 text-sm font-bold text-center focus:outline-none focus:border-accent transition-colors" />
                          <span className="text-xs text-muted shrink-0">회</span>
                          <button onClick={() => removeAddSet(exIdx, setIdx)} disabled={ex.sets.length <= 1}
                            className="p-1.5 text-muted hover:text-danger transition-colors disabled:opacity-20 shrink-0"><Trash2 size={14} /></button>
                        </div>
                      ))}
                      <button onClick={() => addAddSet(exIdx)} className="flex items-center gap-1 text-xs text-accent hover:text-accent/70 transition-colors">
                        <Plus size={12} />세트 추가
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-6 pt-2 shrink-0 space-y-2">
                  <button onClick={() => setAddStep(1)} className="w-full text-sm text-muted hover:text-foreground py-2 transition-colors">← 루틴 다시 선택</button>
                  <button onClick={handleAddSave} className="w-full bg-foreground text-background font-bold py-4 rounded-xl active:scale-95 transition-transform">기록 추가</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 식단 추가/수정 Drawer (공통 컴포넌트) */}
      {selectedDate && (
        <DietItemDrawer
          open={isDietOpen}
          onClose={() => setIsDietOpen(false)}
          date={selectedDate}
          editing={dietEditing}
          onSaved={refreshData}
        />
      )}
    </main>
  );
}
