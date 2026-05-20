"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, Utensils } from "lucide-react";
import { getWorkoutSessions, getAllDietRecords, calculateCalories } from "@/utils/storage";
import { WorkoutSession, DietRecord, MealType } from "@/types";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MEAL_TYPES: MealType[] = ["아침", "점심", "저녁", "간식"];

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function HistoryPage() {
  const [today] = useState(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [dietRecords, setDietRecords] = useState<DietRecord[]>([]);

  useEffect(() => {
    setSessions(getWorkoutSessions());
    setDietRecords(getAllDietRecords());
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
      carbs += item.carbs;
      protein += item.protein;
      fat += item.fat;
    }));
    const calories = calculateCalories(carbs, protein, fat);
    const carbsPercent = calories > 0 ? Math.round((carbs * 4 / calories) * 100) : 0;
    const proteinPercent = calories > 0 ? Math.round((protein * 4 / calories) * 100) : 0;
    const fatPercent = calories > 0 ? 100 - carbsPercent - proteinPercent : 0;
    return { carbs, protein, fat, calories, carbsPercent, proteinPercent, fatPercent };
  }, [selectedDiets]);

  return (
    <main className="flex flex-col h-full animate-in fade-in duration-300">
      <header className="px-6 py-6 border-b border-border bg-card sticky top-0 z-10">
        <h1 className="text-2xl font-bold">기록</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-24">
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
              <div
                key={d}
                className={`text-center text-xs font-semibold py-1 ${
                  i === 0 ? "text-danger" : i === 6 ? "text-accent/80" : "text-muted"
                }`}
              >
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
                    isSelected
                      ? "bg-accent/20 border border-accent"
                      : isToday
                      ? "bg-card border border-border"
                      : "hover:bg-card"
                  }`}
                >
                  <span
                    className={`text-sm font-medium leading-none mb-1.5 ${
                      isSelected
                        ? "text-accent font-bold"
                        : isToday
                        ? "text-foreground font-bold"
                        : dow === 0
                        ? "text-danger"
                        : dow === 6
                        ? "text-accent/70"
                        : "text-foreground"
                    }`}
                  >
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
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs text-muted">운동</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs text-muted">식단</span>
            </div>
          </div>
        </div>

        {/* 선택한 날짜 상세 */}
        {selectedDate && (
          <div className="px-4 space-y-4 animate-in slide-in-from-bottom-4 duration-200">
            <h3 className="text-sm font-semibold text-muted">
              {(() => {
                const d = new Date(selectedDate + "T00:00:00");
                return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;
              })()}
            </h3>

            {/* 운동 기록 */}
            {selectedSessions.length > 0 ? (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <Dumbbell size={14} className="text-accent" />
                  <p className="text-xs font-semibold text-muted">운동 기록</p>
                </div>
                <div className="divide-y divide-border">
                  {selectedSessions.map((session) => (
                    <div key={session.id} className="px-4 py-3 space-y-2">
                      {session.exercises.map((ex) => {
                        const done = ex.sets.filter((s) => s.isCompleted);
                        if (done.length === 0) return null;
                        return (
                          <div key={ex.id} className="bg-background rounded-xl px-3 py-2.5">
                            <p className="text-xs font-bold text-foreground mb-1.5">{ex.name}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {done.map((s, i) => (
                                <span key={s.id} className="text-xs text-muted">
                                  {i + 1}세트{" "}
                                  <span className="text-foreground font-semibold">
                                    {s.weight}kg × {s.reps}회
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
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl px-4 py-6 flex flex-col items-center gap-2">
                <Dumbbell size={20} className="text-muted" />
                <p className="text-xs text-muted">운동 기록 없음</p>
              </div>
            )}

            {/* 식단 기록 */}
            {selectedDiets.length > 0 ? (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* 헤더 — 식단 탭과 동일한 스타일 */}
                <div className="px-4 pt-4 pb-3 border-b border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <Utensils size={14} className="text-success" />
                    <p className="text-xs font-semibold text-muted">식단 기록</p>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-muted">총 섭취 칼로리</span>
                    <span className="text-2xl font-extrabold text-accent">
                      {totalNutrition.calories}{" "}
                      <span className="text-sm font-normal text-muted">kcal</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted">탄 {totalNutrition.carbs}g <span className="text-accent font-bold">({totalNutrition.carbsPercent}%)</span></span>
                    <span className="text-muted">단 {totalNutrition.protein}g <span className="text-accent font-bold">({totalNutrition.proteinPercent}%)</span></span>
                    <span className="text-muted">지 {totalNutrition.fat}g <span className="text-accent font-bold">({totalNutrition.fatPercent}%)</span></span>
                  </div>
                  {totalNutrition.calories > 0 && (
                    <div className="flex w-full h-2 rounded-full overflow-hidden gap-0.5">
                      <div className="bg-blue-400 rounded-l-full transition-all" style={{ width: `${totalNutrition.carbsPercent}%` }} />
                      <div className="bg-emerald-400 transition-all" style={{ width: `${totalNutrition.proteinPercent}%` }} />
                      <div className="bg-amber-400 rounded-r-full transition-all" style={{ width: `${totalNutrition.fatPercent}%` }} />
                    </div>
                  )}
                </div>

                {/* 끼니별 목록 */}
                <div className="divide-y divide-border px-4">
                  {MEAL_TYPES.map((type) => {
                    const mealsOfType = selectedDiets.filter((r) => r.mealType === type);
                    if (mealsOfType.length === 0) return null;
                    return (
                      <div key={type} className="py-3 space-y-2">
                        <h4 className="font-bold text-sm border-l-4 border-accent pl-2">{type}</h4>
                        {mealsOfType.map((record) =>
                          record.items.map((item) => (
                            <div key={item.id} className="bg-background rounded-xl px-3 py-2.5">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-medium">{item.name}</p>
                                  <p className="text-xs text-muted mt-0.5">
                                    탄 {item.carbs}g • 단 {item.protein}g • 지 {item.fat}g
                                  </p>
                                </div>
                                <span className="text-sm font-bold text-accent shrink-0 ml-2">
                                  {calculateCalories(item.carbs, item.protein, item.fat)}kcal
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl px-4 py-6 flex flex-col items-center gap-2">
                <Utensils size={20} className="text-muted" />
                <p className="text-xs text-muted">식단 기록 없음</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
