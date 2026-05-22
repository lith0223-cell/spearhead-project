"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, Utensils, Trash2, Pencil, Plus, X } from "lucide-react";
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
  updateDietItem,
  addItemToDietRecord,
  getSessionsByExerciseName,
} from "@/utils/storage";
import { WorkoutSession, DietRecord, MealType, MealItem, Routine, ExerciseRecord, SetRecord } from "@/types";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MEAL_TYPES: MealType[] = ["아침", "점심", "저녁", "간식"];

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type DietModal = {
  mode: "add" | "edit";
  recordId?: string;
  itemId?: string;
  mealType: MealType;
  foodName: string;
  carbs: string;
  protein: string;
  fat: string;
};

export default function HistoryPage() {
  const [today] = useState(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toDateStr(new Date()));
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [dietRecords, setDietRecords] = useState<DietRecord[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);

  // 운동 수정 모달
  const [editDraft, setEditDraft] = useState<WorkoutSession | null>(null);
  // 운동 추가 모달
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addRoutineId, setAddRoutineId] = useState<string>("");
  const [addExData, setAddExData] = useState<
    { name: string; sets: { id: string; weight: string; reps: string }[] }[]
  >([]);

  // 식단 추가/수정 모달
  const [dietModal, setDietModal] = useState<DietModal | null>(null);

  // 탭
  const [activeTab, setActiveTab] = useState<"history" | "analytics">("history");

  // 분석 탭
  const [chartExName, setChartExName] = useState<string>("");
  const [chartMetric, setChartMetric] = useState<"1rm" | "weight" | "volume">("1rm");

  const refreshData = () => {
    setSessions(getWorkoutSessions());
    setDietRecords(getAllDietRecords());
  };

  useEffect(() => {
    refreshData();
    setRoutines(getRoutines());
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

  // ── 운동 CRUD ──
  const handleDeleteSession = (sessionId: string) => {
    if (!confirm("이 운동 기록을 삭제하시겠습니까?")) return;
    deleteWorkoutSession(sessionId);
    refreshData();
  };

  const openEditModal = (session: WorkoutSession) => setEditDraft(JSON.parse(JSON.stringify(session)));

  const handleEditSetChange = (exIdx: number, setIdx: number, field: "weight" | "reps", value: string) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as WorkoutSession;
      next.exercises[exIdx].sets[setIdx][field] = value === "" ? 0 : Number(value);
      return next;
    });
  };

  const addEditSet = (exIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as WorkoutSession;
      const ex = next.exercises[exIdx];
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push({ id: crypto.randomUUID(), weight: last?.weight ?? 0, reps: last?.reps ?? 0, isCompleted: true });
      return next;
    });
  };

  const removeEditSet = (exIdx: number, setIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as WorkoutSession;
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
    setAddExData(routine.exercises.map((name) => ({ name, sets: [{ id: crypto.randomUUID(), weight: "", reps: "" }] })));
    setAddStep(2);
  };

  const addAddSet = (exIdx: number) => {
    setAddExData((prev) => {
      const next = [...prev];
      const ex = { ...next[exIdx], sets: [...next[exIdx].sets] };
      const last = ex.sets[ex.sets.length - 1];
      ex.sets = [...ex.sets, { id: crypto.randomUUID(), weight: last?.weight ?? "", reps: last?.reps ?? "" }];
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

  const handleAddSave = () => {
    if (!selectedDate) return;
    const exercises: ExerciseRecord[] = addExData
      .map((ex) => ({
        id: ex.name, name: ex.name,
        sets: ex.sets.filter((s) => s.weight !== "" && s.reps !== "")
          .map((s) => ({ id: s.id, weight: Number(s.weight), reps: Number(s.reps), isCompleted: true })),
      }))
      .filter((ex) => ex.sets.length > 0);
    if (exercises.length === 0) return;
    saveWorkoutSession({ id: crypto.randomUUID(), routineId: addRoutineId, date: `${selectedDate}T12:00:00.000Z`, exercises });
    refreshData();
    setIsAddOpen(false);
  };

  // ── 식단 CRUD ──
  const openDietAddModal = () => {
    setDietModal({ mode: "add", mealType: "점심", foodName: "", carbs: "", protein: "", fat: "" });
  };

  const openDietEditModal = (record: DietRecord, item: MealItem) => {
    setDietModal({
      mode: "edit", recordId: record.id, itemId: item.id,
      mealType: record.mealType, foodName: item.name,
      carbs: String(item.carbs), protein: String(item.protein), fat: String(item.fat),
    });
  };

  const handleDietDelete = (recordId: string, itemId: string) => {
    if (!confirm("이 식단을 삭제하시겠습니까?")) return;
    deleteDietItem(recordId, itemId);
    refreshData();
  };

  const handleDietSubmit = () => {
    if (!selectedDate || !dietModal) return;
    const { mode, recordId, itemId, mealType, foodName, carbs, protein, fat } = dietModal;
    if (!foodName || !carbs || !protein || !fat) return;

    if (mode === "edit" && recordId && itemId) {
      updateDietItem(recordId, { id: itemId, name: foodName, carbs: Number(carbs), protein: Number(protein), fat: Number(fat) });
    } else {
      addItemToDietRecord(selectedDate, mealType, {
        id: crypto.randomUUID(), name: foodName, carbs: Number(carbs), protein: Number(protein), fat: Number(fat),
      });
    }
    refreshData();
    setDietModal(null);
  };

  const dietCalPreview = dietModal
    ? calculateCalories(Number(dietModal.carbs) || 0, Number(dietModal.protein) || 0, Number(dietModal.fat) || 0)
    : 0;

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

      <div className="flex-1 overflow-y-auto pb-8">
      {activeTab === "analytics" ? (
        <div className="p-4 space-y-4">
          {allExerciseNames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-muted text-sm">운동 기록이 없습니다</p>
              <p className="text-muted text-xs mt-1">운동을 완료하면 여기서 성장 추이를 확인할 수 있어요</p>
            </div>
          ) : (
            <>
              <select
                value={chartExName}
                onChange={(e) => setChartExName(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">종목을 선택하세요</option>
                {allExerciseNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>

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
                      {chartMetric !== "volume" ? " (kg)" : " (kg)"}
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
                  <p className="text-xs font-semibold text-muted">운동 기록</p>
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
                        return (
                          <div key={ex.id} className="bg-background rounded-xl px-3 py-2.5">
                            <p className="text-xs font-bold text-foreground mb-1.5">{ex.name}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {done.map((s, i) => (
                                <span key={s.id} className="text-xs text-muted">
                                  {i + 1}세트 <span className="text-foreground font-semibold">{s.weight}kg × {s.reps}회</span>
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
                  <Utensils size={14} className="text-success" />
                  <p className="text-xs font-semibold text-muted">식단 기록</p>
                </div>
                <button onClick={openDietAddModal} className="flex items-center gap-1 text-xs text-success hover:text-success/70 transition-colors">
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

      {/* 운동 수정 모달 */}
      {editDraft && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in" onClick={() => setEditDraft(null)}>
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl animate-in slide-in-from-bottom-8 flex flex-col h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-border shrink-0">
              <h2 className="text-xl font-bold">운동 기록 수정</h2>
              <button onClick={() => setEditDraft(null)} className="p-2 -mr-2 text-muted hover:text-foreground"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {editDraft.exercises.map((ex, exIdx) => (
                <div key={ex.id} className="space-y-2">
                  <p className="text-sm font-bold">{ex.name}</p>
                  {ex.sets.map((set, setIdx) => (
                    <div key={set.id} className="flex items-center gap-2">
                      <span className="text-sm font-bold text-muted w-5 text-center shrink-0">{setIdx + 1}</span>
                      <input type="number" value={set.weight} onChange={(e) => handleEditSetChange(exIdx, setIdx, "weight", e.target.value)} placeholder="0"
                        className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-2 text-sm font-bold text-center focus:outline-none focus:border-accent transition-colors" />
                      <span className="text-xs text-muted shrink-0">kg ×</span>
                      <input type="number" value={set.reps} onChange={(e) => handleEditSetChange(exIdx, setIdx, "reps", e.target.value)} placeholder="0"
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
            <div className="px-6 pb-6 pt-2 shrink-0">
              <button onClick={handleEditSave} className="w-full bg-foreground text-background font-bold py-4 rounded-xl active:scale-95 transition-transform">
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

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
                  routines.map((r) => (
                    <button key={r.id} onClick={() => selectRoutineForAdd(r.id)}
                      className="w-full text-left bg-background border border-border rounded-xl px-4 py-3 hover:border-accent transition-colors active:scale-[0.98]">
                      <p className="font-semibold text-sm">{r.name}</p>
                      <p className="text-xs text-muted mt-0.5">{r.exercises.join(" · ")}</p>
                    </button>
                  ))
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
                          <span className="text-sm font-bold text-muted w-5 text-center shrink-0">{setIdx + 1}</span>
                          <input type="number" value={set.weight} onChange={(e) => updateAddSet(exIdx, setIdx, "weight", e.target.value)} placeholder="0"
                            className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-2 text-sm font-bold text-center focus:outline-none focus:border-accent transition-colors" />
                          <span className="text-xs text-muted shrink-0">kg ×</span>
                          <input type="number" value={set.reps} onChange={(e) => updateAddSet(exIdx, setIdx, "reps", e.target.value)} placeholder="0"
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

      {/* 식단 추가/수정 모달 */}
      {dietModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in" onClick={() => setDietModal(null)}>
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl animate-in slide-in-from-bottom-8 flex flex-col h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center shrink-0 px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-xl font-bold">{dietModal.mode === "edit" ? "식단 수정" : "식단 추가"}</h2>
              <button onClick={() => setDietModal(null)} className="p-2 -mr-2 text-muted hover:text-foreground"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* 끼니 선택 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted">식사 종류</label>
                <div className="grid grid-cols-4 gap-2">
                  {MEAL_TYPES.map((t) => (
                    <button key={t} type="button"
                      disabled={dietModal.mode === "edit"}
                      onClick={() => setDietModal((p) => p ? { ...p, mealType: t } : p)}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors ${dietModal.mealType === t ? "bg-accent text-background" : "bg-background text-foreground border border-border"} disabled:opacity-50`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 메뉴명 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted">메뉴명</label>
                <input type="text" required value={dietModal.foodName}
                  onChange={(e) => setDietModal((p) => p ? { ...p, foodName: e.target.value } : p)}
                  placeholder="예: 닭가슴살 샐러드"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-accent transition-colors" />
              </div>

              {/* 탄단지 */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "탄수화물 (g)", key: "carbs" },
                  { label: "단백질 (g)",   key: "protein" },
                  { label: "지방 (g)",     key: "fat" },
                ].map(({ label, key }) => (
                  <div key={key} className="space-y-2">
                    <label className="text-sm font-medium text-muted">{label}</label>
                    <input type="number" value={dietModal[key as keyof DietModal] as string}
                      onChange={(e) => setDietModal((p) => p ? { ...p, [key]: e.target.value } : p)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-center focus:outline-none focus:border-accent" />
                  </div>
                ))}
              </div>
            </div>

            <div className="shrink-0 px-6 pb-6 pt-4 border-t border-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted">예상 칼로리</span>
                <span className="text-lg font-bold">{dietCalPreview} kcal</span>
              </div>
              <button onClick={handleDietSubmit}
                disabled={!dietModal.foodName || !dietModal.carbs || !dietModal.protein || !dietModal.fat}
                className="w-full bg-foreground text-background font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-40">
                {dietModal.mode === "edit" ? "수정하기" : "기록하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
