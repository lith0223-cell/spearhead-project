"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dumbbell, Flame, TrendingUp } from "lucide-react";
import {
  initializeDummyData,
  getDietRecordsByDate,
  calculateCalories,
  getRoutines,
} from "@/utils/storage";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState({
    calories: 0,
    carbs: 0,
    protein: 0,
    fat: 0,
  });

  useEffect(() => {
    initializeDummyData();

    // Load today's diet stats
    const today = new Date().toISOString().split("T")[0];
    const diets = getDietRecordsByDate(today);

    let totalCarbs = 0;
    let totalProtein = 0;
    let totalFat = 0;

    diets.forEach((record) => {
      record.items.forEach((item) => {
        totalCarbs += item.carbs;
        totalProtein += item.protein;
        totalFat += item.fat;
      });
    });

    setStats({
      calories: calculateCalories(totalCarbs, totalProtein, totalFat),
      carbs: totalCarbs,
      protein: totalProtein,
      fat: totalFat,
    });

    setMounted(true);
  }, []);

  if (!mounted) return null;

  const todayStr = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  return (
    <main className="flex flex-col h-full p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">
          반가워요, <br />
          <span className="text-accent">오늘도 득근합시다!</span>
        </h1>
        <p className="text-muted text-sm">{todayStr}</p>
      </header>

      {/* Stats Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp size={20} className="text-accent" />
            오늘의 영양 상태
          </h2>
          <Link href="/diet" className="text-xs text-muted hover:text-accent transition-colors">
            상세보기 &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-card p-4 rounded-2xl border border-border shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-danger/20 rounded-full">
                <Flame size={20} className="text-danger" />
              </div>
              <h3 className="font-semibold text-muted">총 섭취 칼로리</h3>
            </div>
            <p className="text-3xl font-bold">
              {stats.calories} <span className="text-base font-normal text-muted">kcal</span>
            </p>
            {/* 임시 프로그레스 바 (목표 2500kcal 가정) */}
            <div className="w-full h-2 bg-background rounded-full mt-4 overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-1000"
                style={{ width: `${Math.min((stats.calories / 2500) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-card p-4 rounded-2xl border border-border flex flex-col gap-1 shadow-md">
            <span className="text-xs text-muted font-medium">탄수화물</span>
            <span className="text-xl font-bold">{stats.carbs}g</span>
          </div>
          <div className="bg-card p-4 rounded-2xl border border-border flex flex-col gap-1 shadow-md">
            <span className="text-xs text-muted font-medium">단백질</span>
            <span className="text-xl font-bold">{stats.protein}g</span>
          </div>
          <div className="col-span-2 bg-card p-4 rounded-2xl border border-border flex flex-col gap-1 shadow-md">
            <span className="text-xs text-muted font-medium">지방</span>
            <span className="text-xl font-bold">{stats.fat}g</span>
          </div>
        </div>
      </section>

      {/* Action Button */}
      <div className="flex-1 flex flex-col justify-end pb-8">
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
