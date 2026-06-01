"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { DietItemDrawer, type DietItemDrawerEditing } from "@/components/ui/DietItemDrawer";
import { useActiveWorkout } from "@/providers/ActiveWorkoutProvider";
import {
  getDietRecordsByDate,
  calculateCalories,
  deleteDietItem,
  getLocalDateStr,
  getWeightRecord,
  saveWeightRecord,
} from "@/utils/storage";
import { DietRecord, MealType } from "@/types";

export default function DietPage() {
  const { isActive } = useActiveWorkout();
  const [records, setRecords] = useState<DietRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<DietItemDrawerEditing | null>(null);
  const [viewDateStr, setViewDateStr] = useState("");
  const realTodayRef = useRef("");

  // 칼로리 목표
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [isGoalEditing, setIsGoalEditing] = useState(false);
  const [goalDraft, setGoalDraft] = useState("2000");

  // 체중 상태
  const [weightForDate, setWeightForDate] = useState<number | null>(null);
  const [weightDraft, setWeightDraft] = useState("");

  useEffect(() => {
    const today = getLocalDateStr();
    realTodayRef.current = today;
    setViewDateStr(today);
    setRecords(getDietRecordsByDate(today));
    const w = getWeightRecord(today);
    setWeightForDate(w);
    setWeightDraft(w !== null ? String(w) : "");
    const savedGoal = parseInt(localStorage.getItem("ph_calorie_goal") || "2000");
    setCalorieGoal(savedGoal);
    setGoalDraft(String(savedGoal));

    // 자정 경계 갱신 — 앱이 켜진 채 날짜가 바뀌어도 realToday를 정확히 유지
    const refreshToday = () => {
      const next = getLocalDateStr();
      if (next !== realTodayRef.current) {
        realTodayRef.current = next;
      }
    };
    const interval = setInterval(refreshToday, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") refreshToday(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const refreshRecords = () => {
    setRecords(getDietRecordsByDate(viewDateStr));
  };

  const changeDate = (delta: number) => {
    const d = new Date(viewDateStr + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const next = getLocalDateStr(d);
    if (next > realTodayRef.current) return;
    setViewDateStr(next);
    setRecords(getDietRecordsByDate(next));
    const w = getWeightRecord(next);
    setWeightForDate(w);
    setWeightDraft(w !== null ? String(w) : "");
  };

  const commitWeight = () => {
    const val = parseFloat(weightDraft);
    if (!isNaN(val) && val > 0 && val < 300) {
      const rounded = Math.round(val * 10) / 10;
      saveWeightRecord(viewDateStr, rounded);
      setWeightForDate(rounded);
      setWeightDraft(String(rounded));
    } else {
      // 잘못된 입력 → 마지막 유효 값으로 복원 (silent fail 방지)
      setWeightDraft(weightForDate !== null ? String(weightForDate) : "");
    }
  };

  const dateLabel = (() => {
    if (!viewDateStr || !realTodayRef.current) return "";
    if (viewDateStr === realTodayRef.current) return "오늘";
    const d = new Date(viewDateStr + "T00:00:00");
    const yesterday = new Date(realTodayRef.current + "T00:00:00");
    yesterday.setDate(yesterday.getDate() - 1);
    if (viewDateStr === getLocalDateStr(yesterday)) return "어제";
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${["일","월","화","수","목","금","토"][d.getDay()]})`;
  })();

  const commitGoal = () => {
    const val = Math.max(500, Math.min(9999, parseInt(goalDraft) || 2000));
    setCalorieGoal(val);
    setGoalDraft(String(val));
    localStorage.setItem("ph_calorie_goal", String(val));
    setIsGoalEditing(false);
  };

  let totalCarbs = 0;
  let totalProtein = 0;
  let totalFat = 0;

  records.forEach((r) => {
    r.items.forEach((item) => {
      totalCarbs += item.carbs;
      totalProtein += item.protein;
      totalFat += item.fat;
    });
  });

  const totalCalories = calculateCalories(totalCarbs, totalProtein, totalFat);
  const goalPercent = calorieGoal > 0 ? Math.min((totalCalories / calorieGoal) * 100, 100) : 0;
  const isOverGoal = calorieGoal > 0 && totalCalories > calorieGoal;

  // 비율 계산
  const carbsCal = totalCarbs * 4;
  const proteinCal = totalProtein * 4;
  const fatCal = totalFat * 9;
  const carbsPercent = totalCalories > 0 ? Math.round((carbsCal / totalCalories) * 100) : 0;
  const proteinPercent = totalCalories > 0 ? Math.round((proteinCal / totalCalories) * 100) : 0;
  const fatPercent = totalCalories > 0 ? 100 - carbsPercent - proteinPercent : 0;

  const openAddModal = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const openEditModal = (recordId: string, item: { id: string; name: string; carbs: number; protein: number; fat: number }, type: MealType) => {
    setEditing({
      recordId,
      itemId: item.id,
      mealType: type,
      foodName: item.name,
      carbs: item.carbs,
      protein: item.protein,
      fat: item.fat,
    });
    setIsModalOpen(true);
  };

  const handleDeleteItem = (recordId: string, itemId: string) => {
    deleteDietItem(recordId, itemId);
    refreshRecords();
  };

  return (
    <main className="flex flex-col h-full animate-in fade-in duration-300">
      <header className="px-6 pt-6 pb-4 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">식단</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => changeDate(-1)} aria-label="이전 날짜" className="p-1.5 text-muted hover:text-foreground active:scale-90 transition-all">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-semibold min-w-[56px] text-center">{dateLabel}</span>
            <button
              onClick={() => changeDate(1)}
              aria-label="다음 날짜"
              disabled={viewDateStr >= realTodayRef.current}
              className="p-1.5 text-muted hover:text-foreground active:scale-90 transition-all disabled:opacity-30"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        {/* 체중 입력 */}
        <div className="flex items-center justify-between pt-2 pb-3 mb-1 border-b border-border/50">
          <span className="text-xs font-medium text-muted">
            {viewDateStr === realTodayRef.current ? "금일 체중" : "체중"}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={weightDraft}
              step="0.1"
              min="1"
              max="299"
              onChange={(e) => setWeightDraft(e.target.value)}
              onBlur={commitWeight}
              onKeyDown={(e) => e.key === "Enter" && commitWeight()}
              placeholder="00.0"
              aria-label="체중 (kg)"
              className="w-16 bg-background border border-border rounded-lg px-2 py-1 text-sm font-semibold text-right focus:outline-none focus:border-accent transition-colors"
            />
            <span className="text-xs text-muted">kg</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          {/* 섭취 / 목표 칼로리 */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted">
              {viewDateStr === realTodayRef.current ? "오늘 섭취" : "해당일 섭취"}
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-extrabold ${isOverGoal ? "text-danger" : "text-accent"}`}>
                {totalCalories}
              </span>
              <span className="text-sm text-muted mx-1">/</span>
              {isGoalEditing ? (
                <input
                  type="number"
                  inputMode="numeric"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onBlur={commitGoal}
                  onKeyDown={(e) => e.key === "Enter" && commitGoal()}
                  autoFocus
                  aria-label="칼로리 목표 (kcal)"
                  className="w-20 bg-background border border-accent rounded-lg px-2 py-0.5 text-sm text-center focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => setIsGoalEditing(true)}
                  aria-label="칼로리 목표 편집"
                  className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
                >
                  {calorieGoal}
                  <Pencil size={11} className="opacity-40" />
                </button>
              )}
              <span className="text-xs text-muted">kcal</span>
              <span className={`text-xs font-bold ml-1 ${isOverGoal ? "text-danger" : "text-accent"}`}>
                {calorieGoal > 0 ? `${Math.round((totalCalories / calorieGoal) * 100)}%` : "0%"}
                {isOverGoal && " ↑"}
              </span>
            </div>
          </div>
          {/* 목표 달성 게이지 */}
          <div className="w-full h-2 bg-background rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${isOverGoal ? "bg-danger" : "bg-accent"}`}
              style={{ width: `${goalPercent}%` }}
            />
          </div>
          {/* 탄단지 비율 */}
          <div className="flex justify-between text-xs font-medium pt-1">
            <span className="text-muted">탄 {totalCarbs}g <span className="text-accent font-bold">({carbsPercent}%)</span></span>
            <span className="text-muted">단 {totalProtein}g <span className="text-accent font-bold">({proteinPercent}%)</span></span>
            <span className="text-muted">지 {totalFat}g <span className="text-accent font-bold">({fatPercent}%)</span></span>
          </div>
          <div className="flex w-full h-2 rounded-full overflow-hidden gap-0.5">
            {totalCalories > 0 ? (
              <>
                <div className="bg-blue-400 rounded-l-full transition-all" style={{ width: `${carbsPercent}%` }} />
                <div className="bg-emerald-400 transition-all" style={{ width: `${proteinPercent}%` }} />
                <div className="bg-amber-400 rounded-r-full transition-all" style={{ width: `${fatPercent}%` }} />
              </>
            ) : (
              <div className="w-full bg-background rounded-full" />
            )}
          </div>
        </div>
      </header>

      <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${isActive ? "pb-60" : "pb-40"}`}>
        {["아침", "점심", "저녁", "간식"].map((type) => {
          const mealRecords = records.filter(r => r.mealType === type);
          if (mealRecords.length === 0) return null;

          return (
            <section key={type} className="space-y-3">
              <h3 className="font-bold border-l-4 border-accent pl-3">{type}</h3>
              <div className="space-y-3">
                {mealRecords.map(record =>
                  record.items.map(item => (
                    <div key={item.id} className="bg-card p-4 rounded-2xl border border-border">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.name}</p>
                          <p className="text-xs text-muted mt-0.5">탄 {item.carbs}g · 단 {item.protein}g · 지 {item.fat}g</p>
                        </div>
                        <span className="text-sm font-bold text-accent shrink-0">
                          {calculateCalories(item.carbs, item.protein, item.fat)} kcal
                        </span>
                      </div>
                      <div className="flex justify-end gap-1 mt-2">
                        <button
                          onClick={() => openEditModal(record.id, item, type as MealType)}
                          aria-label={`${item.name} 수정`}
                          className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors px-2 py-1 rounded-lg"
                        >
                          <Pencil size={13} />
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteItem(record.id, item.id)}
                          aria-label={`${item.name} 삭제`}
                          className="flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors px-2 py-1 rounded-lg"
                        >
                          <Trash2 size={13} />
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
        {records.length === 0 && (
          <div className="flex flex-col items-center justify-center text-muted h-32 text-center">
            {viewDateStr === realTodayRef.current ? (
              <>
                <p>아직 기록된 식단이 없습니다.</p>
                <p className="text-sm mt-1">하단의 + 버튼을 눌러 기록해보세요.</p>
              </>
            ) : (
              <p>이 날의 식단 기록이 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={openAddModal}
        aria-label="식단 추가"
        style={{ bottom: isActive
          ? "calc(10.5rem + env(safe-area-inset-bottom, 0px))"
          : "calc(5.5rem + env(safe-area-inset-bottom, 0px))"
        }}
        className="fixed right-6 w-14 h-14 bg-accent text-background rounded-full flex items-center justify-center shadow-lg shadow-accent/30 hover:scale-105 active:scale-95 transition-all duration-200"
      >
        <Plus size={28} strokeWidth={3} />
      </button>

      {/* 식단 추가/수정 Drawer (공통 컴포넌트) */}
      <DietItemDrawer
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        date={viewDateStr}
        editing={editing}
        onSaved={refreshRecords}
      />
    </main>
  );
}
