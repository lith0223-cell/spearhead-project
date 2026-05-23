"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, X, Trash2, Edit, Pencil, Star, Search, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { useActiveWorkout } from "@/providers/ActiveWorkoutProvider";
import { getDietRecordsByDate, addItemToDietRecord, calculateCalories, deleteDietItem, updateDietItem, getFoodPresets, saveFoodPreset, deleteFoodPreset, updateFoodPreset, getLocalDateStr, getWeightRecord, saveWeightRecord } from "@/utils/storage";
import { DietRecord, FoodPreset, MealItem, MealType } from "@/types";

export default function DietPage() {
  const { isActive } = useActiveWorkout();
  const [records, setRecords] = useState<DietRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewDateStr, setViewDateStr] = useState("");
  const realTodayRef = useRef("");

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
  const [presets, setPresets] = useState<FoodPreset[]>([]);
  const [presetSearch, setPresetSearch] = useState("");
  const [showAllPresets, setShowAllPresets] = useState(false);
  const [editingPreset, setEditingPreset] = useState<FoodPreset | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", carbs: "", protein: "", fat: "" });
  const [drawerTab, setDrawerTab] = useState<"presets" | "form">("presets");

  // 체중 상태
  const [weightForDate, setWeightForDate] = useState<number | null>(null);
  const [weightDraft, setWeightDraft] = useState("");

  const PRESET_LIMIT = 4;

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
    setPresets(getFoodPresets());
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

  const handleSavePreset = () => {
    if (!foodName.trim() || !carbs || !protein || !fat) return;
    if (presets.some(p => p.name === foodName.trim())) return;
    const preset: FoodPreset = {
      id: crypto.randomUUID(),
      name: foodName.trim(),
      carbs: Number(carbs),
      protein: Number(protein),
      fat: Number(fat),
    };
    saveFoodPreset(preset);
    setPresets(getFoodPresets());
  };

  const handleApplyPreset = (preset: FoodPreset) => {
    setFoodName(preset.name);
    setCarbs(String(preset.carbs));
    setProtein(String(preset.protein));
    setFat(String(preset.fat));
  };

  const handleApplyAndRecord = (preset: FoodPreset) => {
    const newItem: MealItem = {
      id: crypto.randomUUID(),
      name: preset.name,
      carbs: preset.carbs,
      protein: preset.protein,
      fat: preset.fat,
    };
    addItemToDietRecord(viewDateStr, mealType, newItem);
    refreshRecords();
    closeModal();
  };

  const handleDeletePreset = (id: string) => {
    deleteFoodPreset(id);
    setPresets(getFoodPresets());
  };

  const handleStartEditPreset = (p: FoodPreset) => {
    setEditingPreset(p);
    setEditDraft({ name: p.name, carbs: String(p.carbs), protein: String(p.protein), fat: String(p.fat) });
  };

  const handleSavePresetEdit = () => {
    if (!editingPreset || !editDraft.name.trim()) return;
    updateFoodPreset({
      ...editingPreset,
      name: editDraft.name.trim(),
      carbs: Number(editDraft.carbs) || 0,
      protein: Number(editDraft.protein) || 0,
      fat: Number(editDraft.fat) || 0,
    });
    setPresets(getFoodPresets());
    setEditingPreset(null);
  };

  const filteredPresets = presets
    .filter((p) => p.name.toLowerCase().includes(presetSearch.toLowerCase()))
    .slice(0, showAllPresets || presetSearch ? undefined : PRESET_LIMIT);

  const closeModal = () => {
    setIsModalOpen(false);
    setShowAllPresets(false);
    setPresetSearch("");
    setEditingPreset(null);
  };

  const openAddModal = () => {
    setEditingRecordId(null);
    setEditingItemId(null);
    setFoodName("");
    setCarbs("");
    setProtein("");
    setFat("");
    setDrawerTab(presets.length > 0 ? "presets" : "form");
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
    setDrawerTab("form");
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

    addItemToDietRecord(viewDateStr, mealType, newItem);

    refreshRecords();
    setFoodName("");
    setCarbs("");
    setProtein("");
    setFat("");
    setIsModalOpen(false);
  };

  return (
    <main className="flex flex-col h-full animate-in fade-in duration-300">
      <header className="px-6 pt-6 pb-4 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">식단</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => changeDate(-1)} className="p-1.5 text-muted hover:text-foreground active:scale-90 transition-all">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-semibold min-w-[56px] text-center">{dateLabel}</span>
            <button
              onClick={() => changeDate(1)}
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
              value={weightDraft}
              step="0.1"
              min="1"
              max="299"
              onChange={(e) => setWeightDraft(e.target.value)}
              onBlur={commitWeight}
              onKeyDown={(e) => e.key === "Enter" && commitWeight()}
              placeholder="00.0"
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

      <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${isActive ? "pb-40" : "pb-24"}`}>
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
        style={{ bottom: isActive
          ? "calc(10.5rem + env(safe-area-inset-bottom, 0px))"
          : "calc(5.5rem + env(safe-area-inset-bottom, 0px))"
        }}
        className="fixed right-6 w-14 h-14 bg-accent text-background rounded-full flex items-center justify-center shadow-lg shadow-accent/30 hover:scale-105 active:scale-95 transition-all duration-200"
      >
        <Plus size={28} strokeWidth={3} />
      </button>

      {/* 식단 추가/수정 Drawer */}
      <Drawer open={isModalOpen} onClose={closeModal} height="85vh" zIndex={60}>
        {/* 헤더 */}
        <div className="flex justify-between items-center shrink-0 px-6 pt-3 pb-3">
          <h2 className="text-xl font-bold">{editingItemId ? "식단 수정" : "식단 추가"}</h2>
          <button onClick={closeModal} className="p-2 -mr-2 text-muted hover:text-foreground">
            <X size={24} />
          </button>
        </div>

        {/* 탭 — 수정 모드일 때는 숨김 */}
        {!editingItemId && presets.length > 0 && (
          <div className="flex gap-1 shrink-0 px-6 pb-3">
            {(["presets", "form"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setDrawerTab(tab)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  drawerTab === tab
                    ? "bg-accent text-background"
                    : "bg-background border border-border text-muted"
                }`}
              >
                {tab === "presets" ? "즐겨찾기" : "직접 입력"}
              </button>
            ))}
          </div>
        )}

        {/* 즐겨찾기 탭 */}
        {drawerTab === "presets" && !editingItemId && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* 식사 종류 선택 */}
            <div className="shrink-0 px-6 pb-3 space-y-2">
              <label className="text-sm font-medium text-muted">식사 종류</label>
              <div className="grid grid-cols-4 gap-2">
                {(["아침", "점심", "저녁", "간식"] as MealType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMealType(t)}
                    className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                      mealType === t ? "bg-accent text-background" : "bg-background border border-border text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 검색 — 4개 초과 시 노출 */}
            {presets.length > PRESET_LIMIT && (
              <div className="shrink-0 px-6 pb-3">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={presetSearch}
                    onChange={(e) => { setPresetSearch(e.target.value); setShowAllPresets(false); }}
                    placeholder="즐겨찾기 검색..."
                    className="w-full bg-background border border-border rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>
            )}

            {/* 항목 리스트 */}
            <div className="flex-1 overflow-y-auto px-6 space-y-2 pb-4">
              {filteredPresets.length === 0 && (
                <p className="text-xs text-muted text-center py-6">검색 결과가 없습니다</p>
              )}
              {filteredPresets.map((p) =>
                editingPreset?.id === p.id ? (
                  /* 인라인 수정 모드 */
                  <div key={p.id} className="bg-background border border-accent rounded-xl px-4 py-3 space-y-2.5">
                    <input
                      autoFocus
                      value={editDraft.name}
                      onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="메뉴명"
                      className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent transition-colors"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      {(["carbs", "protein", "fat"] as const).map((field) => (
                        <div key={field} className="space-y-0.5">
                          <label className="text-[10px] text-muted pl-1">
                            {field === "carbs" ? "탄수화물" : field === "protein" ? "단백질" : "지방"}
                          </label>
                          <input
                            type="number"
                            value={editDraft[field]}
                            onChange={(e) => setEditDraft((d) => ({ ...d, [field]: e.target.value }))}
                            className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-accent transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleSavePresetEdit}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-accent text-background rounded-lg text-xs font-bold active:scale-95 transition-transform">
                        <Check size={12} strokeWidth={3} /> 저장
                      </button>
                      <button type="button" onClick={() => setEditingPreset(null)}
                        className="flex-1 py-1.5 bg-background border border-border rounded-lg text-xs active:scale-95 transition-transform">
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 기본 항목 */
                  <div key={p.id} className="flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-3">
                    <button type="button" onClick={() => handleApplyAndRecord(p)}
                      className="flex-1 flex justify-between items-center min-w-0 text-left active:scale-[0.98] transition-transform">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                        <p className="text-xs text-muted mt-0.5">탄 {p.carbs}g · 단 {p.protein}g · 지 {p.fat}g</p>
                      </div>
                      <span className="text-sm font-bold text-accent shrink-0 ml-3">
                        {calculateCalories(p.carbs, p.protein, p.fat)}kcal
                      </span>
                    </button>
                    <button type="button" onClick={() => handleStartEditPreset(p)}
                      className="shrink-0 text-muted hover:text-accent transition-colors p-1">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => handleDeletePreset(p.id)}
                      className="shrink-0 text-muted hover:text-danger transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              )}

              {/* 더 보기 */}
              {!presetSearch && !showAllPresets && presets.length > PRESET_LIMIT && (
                <button type="button" onClick={() => setShowAllPresets(true)}
                  className="w-full text-xs text-muted hover:text-foreground py-2 transition-colors">
                  + {presets.length - PRESET_LIMIT}개 더 보기
                </button>
              )}
            </div>
          </div>
        )}

        {/* 직접 입력 탭 / 수정 모드 */}
        {(drawerTab === "form" || editingItemId) && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 space-y-5 pb-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted">식사 종류</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["아침", "점심", "저녁", "간식"] as MealType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMealType(t)}
                      disabled={!!editingItemId}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors ${mealType === t ? "bg-accent text-background" : "bg-background text-foreground border border-border"} disabled:opacity-50`}
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
                {[
                  { label: "탄수화물 (g)", val: carbs, set: setCarbs },
                  { label: "단백질 (g)",   val: protein, set: setProtein },
                  { label: "지방 (g)",     val: fat, set: setFat },
                ].map(({ label, val, set }) => (
                  <div key={label} className="space-y-2">
                    <label className="text-sm font-medium text-muted">{label}</label>
                    <input type="number" required value={val} onChange={(e) => set(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-center focus:outline-none focus:border-accent transition-colors" />
                  </div>
                ))}
              </div>

              {!editingItemId && (
                <button
                  type="button"
                  onClick={handleSavePreset}
                  disabled={!foodName.trim() || !carbs || !protein || !fat || presets.some(p => p.name === foodName.trim())}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-amber-400/60 text-amber-500 font-semibold text-sm bg-amber-400/5 hover:bg-amber-400/10 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  <Star size={15} fill={foodName.trim() && carbs && protein && fat && !presets.some(p => p.name === foodName.trim()) ? "currentColor" : "none"} />
                  {presets.some(p => p.name === foodName.trim()) ? "이미 즐겨찾기에 있음" : "즐겨찾기에 저장"}
                </button>
              )}
            </div>

            <div className="shrink-0 px-6 pb-6 pt-4 border-t border-border">
              <div className="flex justify-between items-center mb-4">
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
        )}
      </Drawer>
    </main>
  );
}
