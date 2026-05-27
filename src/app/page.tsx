"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dumbbell, Flame, Utensils } from "lucide-react";
import { useActiveWorkout } from "@/providers/ActiveWorkoutProvider";
import {
  initializeDummyData,
  getDietRecordsByDate,
  calculateCalories,
  getWorkoutStreak,
  getWeeklyWorkoutCount,
  getWorkoutDaysThisWeek,
  getLastWorkoutDaysAgo,
  getLocalDateStr,
} from "@/utils/storage";

export default function Home() {
  const { isActive } = useActiveWorkout();
  const [mounted, setMounted] = useState(false);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [stats, setStats] = useState({ calories: 0, carbs: 0, protein: 0, fat: 0 });
  const [workoutStats, setWorkoutStats] = useState({ streak: 0, weeklyCount: 0, daysAgo: null as number | null, weekDays: Array(7).fill(false) as boolean[] });

  useEffect(() => {
    initializeDummyData();

    const refresh = () => {
      const today = getLocalDateStr();
      const diets = getDietRecordsByDate(today);
      let totalCarbs = 0, totalProtein = 0, totalFat = 0;
      diets.forEach((r) => r.items.forEach((item) => {
        totalCarbs += item.carbs;
        totalProtein += item.protein;
        totalFat += item.fat;
      }));
      setStats({
        calories: calculateCalories(totalCarbs, totalProtein, totalFat),
        carbs: totalCarbs,
        protein: totalProtein,
        fat: totalFat,
      });
      setCalorieGoal(parseInt(localStorage.getItem("ph_calorie_goal") || "2000"));
      setWorkoutStats({
        streak: getWorkoutStreak(),
        weeklyCount: getWeeklyWorkoutCount(),
        daysAgo: getLastWorkoutDaysAgo(),
        weekDays: getWorkoutDaysThisWeek(),
      });
    };

    refresh();
    setMounted(true);

    // 자정 경과 또는 포그라운드 복귀 시 통계 재계산
    const interval = setInterval(refresh, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!mounted) return null;

  const todayStr = new Intl.DateTimeFormat("ko-KR", {
    month: "long", day: "numeric", weekday: "long",
  }).format(new Date());

  const isOverGoal = calorieGoal > 0 && stats.calories > calorieGoal;
  const goalPercent = calorieGoal > 0 ? Math.min((stats.calories / calorieGoal) * 100, 100) : 0;
  const carbsPercent = stats.calories > 0 ? Math.round((stats.carbs * 4 / stats.calories) * 100) : 0;
  const proteinPercent = stats.calories > 0 ? Math.round((stats.protein * 4 / stats.calories) * 100) : 0;
  const fatPercent = stats.calories > 0 ? 100 - carbsPercent - proteinPercent : 0;

  return (
    <main className="flex flex-col h-full animate-in fade-in duration-300">
      <header className="px-6 py-6 border-b border-border bg-card sticky top-0 z-10">
        <h1 className="text-2xl font-bold">반가워요!</h1>
        <p className="text-sm font-semibold text-accent mt-0.5">오늘도 득근합시다</p>
        <p className="text-xs text-muted mt-1">{todayStr}</p>
      </header>

      <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${isActive ? "pb-24" : "pb-8"}`}>
        {/* 오늘의 식단 카드 */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Utensils size={14} className="text-accent" />
              <p className="text-xs font-semibold text-muted">오늘의 식단</p>
            </div>
            <Link href="/diet" className="text-xs text-accent hover:text-accent/70 transition-colors">
              상세보기 →
            </Link>
          </div>

          <div className="px-4 py-4 space-y-3">
            {/* 칼로리 행 */}
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted">오늘 섭취</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-extrabold ${isOverGoal ? "text-danger" : "text-accent"}`}>
                  {stats.calories}
                </span>
                <span className="text-sm text-muted mx-1">/</span>
                <span className="text-sm text-muted">{calorieGoal}</span>
                <span className="text-xs text-muted">kcal</span>
                <span className={`text-xs font-bold ml-1 ${isOverGoal ? "text-danger" : "text-accent"}`}>
                  {calorieGoal > 0 ? `${Math.round((stats.calories / calorieGoal) * 100)}%` : "0%"}
                  {isOverGoal && " ↑"}
                </span>
              </div>
            </div>

            {/* 칼로리 게이지 */}
            <div className="w-full h-2 bg-background rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 rounded-full ${isOverGoal ? "bg-danger" : "bg-accent"}`}
                style={{ width: `${goalPercent}%` }}
              />
            </div>

            {/* 탄단지 비율 텍스트 */}
            <div className="flex justify-between text-xs font-medium pt-1">
              <span className="text-muted">탄 {stats.carbs}g <span className="text-blue-400 font-bold">({carbsPercent}%)</span></span>
              <span className="text-muted">단 {stats.protein}g <span className="text-emerald-400 font-bold">({proteinPercent}%)</span></span>
              <span className="text-muted">지 {stats.fat}g <span className="text-amber-400 font-bold">({fatPercent}%)</span></span>
            </div>

            {/* 탄단지 누적 바 */}
            <div className="flex w-full h-2 rounded-full overflow-hidden gap-0.5">
              {stats.calories > 0 ? (
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
        </div>

        {/* 이번 주 운동 카드 */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Dumbbell size={14} className="text-accent" />
              <p className="text-xs font-semibold text-muted">이번 주 운동</p>
            </div>
            {workoutStats.daysAgo !== null && (
              <p className="text-xs text-muted">
                {workoutStats.daysAgo === 0 ? "오늘 운동했어요" : `${workoutStats.daysAgo}일 전`}
              </p>
            )}
          </div>
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Flame size={20} className="text-accent" />
                <span className="text-2xl font-extrabold text-accent">{workoutStats.streak}</span>
                <span className="text-sm text-muted">일 연속</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold">{workoutStats.weeklyCount}</span>
                <span className="text-sm text-muted ml-1">회 / 주</span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-1">
              {["월","화","수","목","금","토","일"].map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-muted font-medium">{day}</span>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    workoutStats.weekDays[i]
                      ? "bg-accent text-background"
                      : "bg-background border border-border text-muted"
                  }`}>
                    {workoutStats.weekDays[i] ? "✓" : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 운동 시작 CTA */}
        <Link
          href="/routines"
          className="group relative flex items-center justify-center gap-3 w-full bg-foreground text-background py-5 rounded-2xl font-bold text-lg overflow-hidden shadow-xl hover:shadow-accent/20 transition-all active:scale-95"
        >
          <div className="absolute inset-0 bg-accent translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
          <Dumbbell size={24} className="relative z-10 group-hover:text-background transition-colors" />
          <span className="relative z-10 group-hover:text-background transition-colors">오늘의 운동 시작하기</span>
        </Link>
      </div>
    </main>
  );
}
