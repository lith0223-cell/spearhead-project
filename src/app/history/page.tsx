"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, Utensils } from "lucide-react";
import { getWorkoutSessions, getAllDietRecords, calculateCalories } from "@/utils/storage";
import { WorkoutSession, DietRecord } from "@/types";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

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
    return { carbs, protein, fat, calories: calculateCalories(carbs, protein, fat) };
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
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <Utensils size={14} className="text-success" />
                  <p className="text-xs font-semibold text-muted">식단 기록</p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {/* 영양 요약 */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-background rounded-xl py-2.5">
                      <p className="text-[10px] text-muted mb-0.5">칼로리</p>
                      <p className="text-base font-extrabold">{totalNutrition.calories}</p>
                      <p className="text-[10px] text-muted">kcal</p>
                    </div>
                    <div className="bg-background rounded-xl py-2.5">
                      <p className="text-[10px] text-muted mb-0.5">탄수화물</p>
                      <p className="text-base font-extrabold">{totalNutrition.carbs}g</p>
                      {totalNutrition.calories > 0 && (
                        <p className="text-[10px] text-muted">
                          {Math.round((totalNutrition.carbs * 4 / totalNutrition.calories) * 100)}%
                        </p>
                      )}
                    </div>
                    <div className="bg-background rounded-xl py-2.5">
                      <p className="text-[10px] text-muted mb-0.5">단백질</p>
                      <p className="text-base font-extrabold">{totalNutrition.protein}g</p>
                      {totalNutrition.calories > 0 && (
                        <p className="text-[10px] text-muted">
                          {Math.round((totalNutrition.protein * 4 / totalNutrition.calories) * 100)}%
                        </p>
                      )}
                    </div>
                    <div className="bg-background rounded-xl py-2.5">
                      <p className="text-[10px] text-muted mb-0.5">지방</p>
                      <p className="text-base font-extrabold">{totalNutrition.fat}g</p>
                      {totalNutrition.calories > 0 && (
                        <p className="text-[10px] text-muted">
                          {Math.round((totalNutrition.fat * 9 / totalNutrition.calories) * 100)}%
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 영양소 비율 바 */}
                  {totalNutrition.calories > 0 && (
                    <div className="h-2 rounded-full overflow-hidden flex gap-px">
                      <div
                        style={{ width: `${Math.round((totalNutrition.carbs * 4 / totalNutrition.calories) * 100)}%` }}
                        className="bg-yellow-400 h-full rounded-l-full"
                      />
                      <div
                        style={{ width: `${Math.round((totalNutrition.protein * 4 / totalNutrition.calories) * 100)}%` }}
                        className="bg-accent h-full"
                      />
                      <div
                        style={{ width: `${Math.round((totalNutrition.fat * 9 / totalNutrition.calories) * 100)}%` }}
                        className="bg-orange-400 h-full rounded-r-full"
                      />
                    </div>
                  )}

                  {/* 식품 목록 */}
                  <div className="divide-y divide-border">
                    {selectedDiets.map((record) =>
                      record.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center py-2.5">
                          <div>
                            <span className="text-sm font-medium">{item.name}</span>
                            <span className="text-xs text-muted ml-2">{record.mealType}</span>
                          </div>
                          <span className="text-xs text-muted shrink-0 ml-2">
                            {calculateCalories(item.carbs, item.protein, item.fat)}kcal
                          </span>
                        </div>
                      ))
                    )}
                  </div>
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
