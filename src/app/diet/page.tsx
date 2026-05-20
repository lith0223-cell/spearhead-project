"use client";

import { useState, useEffect } from "react";
import { Plus, X, Trash2, Edit, Pencil } from "lucide-react";
import { getDietRecordsByDate, saveDietRecord, calculateCalories, deleteDietItem, updateDietItem } from "@/utils/storage";
import { DietRecord, MealItem, MealType } from "@/types";

export default function DietPage() {
  const [records, setRecords] = useState<DietRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [todayStr, setTodayStr] = useState("");

  // Form State
  const [mealType, setMealType] = useState<MealType>("점심");
  const [foodName, setFoodName] = useState("");
  const [carbs, setCarbs] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");

  // Edit state
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [isGoalEditing, setIsGoalEditing] = useState(false);
  const [goalDraft, setGoalDraft] = useState("2000");

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setTodayStr(today);
    setRecords(getDietRecordsByDate(today));
    const savedGoal = parseInt(localStorage.getItem("ph_calorie_goal") || "2000");
    setCalorieGoal(savedGoal);
    setGoalDraft(String(savedGoal));
  }, []);

  const refreshRecords = () => {
    setRecords(getDietRecordsByDate(todayStr));
  };

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
    setEditingRecordId(null);
    setEditingItemId(null);
    setFoodName("");
    setCarbs("");
    setProtein("");
    setFat("");
    setIsModalOpen(true);
  };

  const openEditModal = (recordId: string, item: MealItem, type: MealType) => {
    setEditingRecordId(recordId);
    setEditingItemId(item.id);
    setMealType(type);
    setFoodName(item.name);
    setCarbs(String(item.carbs));
    setProtein(String(item.protein));
    setFat(String(item.fat));
    setIsModalOpen(true);
  };

  const handleDeleteItem = (recordId: string, itemId: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      deleteDietItem(recordId, itemId);
      refreshRecords();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName || !carbs || !protein || !fat) return;

    // 수정 모드
    if (editingRecordId && editingItemId) {
      const updatedItem: MealItem = {
        id: editingItemId,
        name: foodName,
        carbs: Number(carbs),
        protein: Number(protein),
        fat: Number(fat),
      };
      updateDietItem(editingRecordId, updatedItem);
      refreshRecords();
      setIsModalOpen(false);
      return;
    }

    // 추가 모드
    const newItem: MealItem = {
      id: crypto.randomUUID(),
      name: foodName,
      carbs: Number(carbs),
      protein: Number(protein),
      fat: Number(fat),
    };

    const existingRecord = records.find(r => r.mealType === mealType);

    if (existingRecord) {
      existingRecord.items.push(newItem);
      const allData = JSON.parse(localStorage.getItem("ph_diets") || "[]");
      const index = allData.findIndex((d: DietRecord) => d.id === existingRecord.id);
      if (index >= 0) {
        allData[index].items.push(newItem);
        localStorage.setItem("ph_diets", JSON.stringify(allData));
      }
    } else {
      const newRecord: DietRecord = {
        id: crypto.randomUUID(),
        date: todayStr,
        mealType: mealType,
        items: [newItem],
      };
      saveDietRecord(newRecord);
    }

    refreshRecords();
    setFoodName("");
    setCarbs("");
    setProtein("");
    setFat("");
    setIsModalOpen(false);
  };

  return (
    <main className="flex flex-col h-full animate-in fade-in duration-300">
      <header className="px-6 py-6 border-b border-border bg-card sticky top-0 z-10">
        <h1 className="text-2xl font-bold mb-4">오늘의 식단</h1>
        <div className="flex flex-col gap-2">
          {/* 섭취 / 목표 칼로리 */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted">오늘 섭취</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-extrabold ${isOverGoal ? "text-danger" : "text-accent"}`}>
                {totalCalories}
              </span>
              <span className="text-sm text-muted mx-1">/</span>
              {isGoalEditing ? (
                <input
                  type="number"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onBlur={commitGoal}
                  onKeyDown={(e) => e.key === "Enter" && commitGoal()}
                  autoFocus
                  className="w-20 bg-background border border-accent rounded-lg px-2 py-0.5 text-sm text-center focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => setIsGoalEditing(true)}
                  className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
                >
                  {calorieGoal}
                  <Pencil size={11} className="opacity-40" />
                </button>
              )}
              <span className="text-sm text-muted">kcal</span>
            </div>
          </div>
          {/* 목표 달성 게이지 */}
          <div className="w-full h-3 bg-background rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${isOverGoal ? "bg-danger" : "bg-accent"}`}
              style={{ width: `${goalPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted">목표 달성률</span>
            <span className={`font-bold ${isOverGoal ? "text-danger" : "text-accent"}`}>
              {calorieGoal > 0 ? Math.round((totalCalories / calorieGoal) * 100) : 0}%{isOverGoal && " (초과)"}
            </span>
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

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
        {["아침", "점심", "저녁", "간식"].map((type) => {
          const mealRecords = records.filter(r => r.mealType === type);
          if (mealRecords.length === 0) return null;

          return (
            <section key={type} className="space-y-3">
              <h3 className="font-bold border-l-4 border-accent pl-3">{type}</h3>
              <div className="space-y-3">
                {mealRecords.map(record => 
                  record.items.map(item => (
                    <div key={item.id} className="bg-card p-4 rounded-xl border border-border shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-muted mt-1">탄 {item.carbs}g • 단 {item.protein}g • 지 {item.fat}g</p>
                        </div>
                        <span className="font-bold text-accent text-sm">
                          {calculateCalories(item.carbs, item.protein, item.fat)} kcal
                        </span>
                      </div>
                      <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-border">
                        <button
                          onClick={() => openEditModal(record.id, item, type as MealType)}
                          className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors px-2 py-1"
                        >
                          <Edit size={14} />
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteItem(record.id, item.id)}
                          className="flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors px-2 py-1"
                        >
                          <Trash2 size={14} />
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
            <p>아직 기록된 식단이 없습니다.</p>
            <p className="text-sm mt-1">하단의 + 버튼을 눌러 기록해보세요.</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button 
        onClick={openAddModal}
        className="fixed bottom-20 right-6 w-14 h-14 bg-accent text-background rounded-full flex items-center justify-center shadow-lg shadow-accent/30 hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus size={28} strokeWidth={3} />
      </button>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in">
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-border p-6 shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingItemId ? "식단 수정" : "식단 추가"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 -mr-2 text-muted hover:text-foreground">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted">식사 종류</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["아침", "점심", "저녁", "간식"] as MealType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMealType(t)}
                      disabled={!!editingItemId}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors ${mealType === t ? 'bg-accent text-background' : 'bg-background text-foreground border border-border'} disabled:opacity-50`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted">메뉴명</label>
                <input
                  type="text"
                  required
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="예: 닭가슴살 샐러드"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted">탄수화물 (g)</label>
                  <input type="number" required value={carbs} onChange={(e) => setCarbs(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-center" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted">단백질 (g)</label>
                  <input type="number" required value={protein} onChange={(e) => setProtein(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-center" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted">지방 (g)</label>
                  <input type="number" required value={fat} onChange={(e) => setFat(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-center" />
                </div>
              </div>

              <div className="pt-4">
                <div className="flex justify-between items-center mb-4 px-2">
                  <span className="text-sm font-medium text-muted">예상 칼로리</span>
                  <span className="text-lg font-bold">
                    {calculateCalories(Number(carbs) || 0, Number(protein) || 0, Number(fat) || 0)} kcal
                  </span>
                </div>
                <button type="submit" className="w-full bg-foreground text-background font-bold py-4 rounded-xl active:scale-95 transition-transform">
                  {editingItemId ? "수정하기" : "기록하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
