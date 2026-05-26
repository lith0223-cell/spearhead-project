"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, Search, Star, Trash2, X } from "lucide-react";
import { Drawer } from "./Drawer";
import { FoodPreset, MealItem, MealType } from "@/types";
import {
  addItemToDietRecord,
  calculateCalories,
  deleteFoodPreset,
  getFoodPresets,
  saveFoodPreset,
  updateDietItem,
  updateFoodPreset,
} from "@/utils/storage";

const MEAL_TYPES: MealType[] = ["아침", "점심", "저녁", "간식"];
const PRESET_LIMIT = 4;

export interface DietItemDrawerEditing {
  recordId: string;
  itemId: string;
  mealType: MealType;
  foodName: string;
  carbs: number;
  protein: number;
  fat: number;
}

export interface DietItemDrawerProps {
  open: boolean;
  onClose: () => void;
  date: string;
  editing?: DietItemDrawerEditing | null;
  defaultMealType?: MealType;
  onSaved: () => void;
}

export function DietItemDrawer({ open, onClose, date, editing, defaultMealType = "점심", onSaved }: DietItemDrawerProps) {
  const isEdit = !!editing;

  const [mealType, setMealType] = useState<MealType>(defaultMealType);
  const [foodName, setFoodName] = useState("");
  const [carbs, setCarbs] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");

  const [presets, setPresets] = useState<FoodPreset[]>([]);
  const [presetSearch, setPresetSearch] = useState("");
  const [showAllPresets, setShowAllPresets] = useState(false);
  const [editingPreset, setEditingPreset] = useState<FoodPreset | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", carbs: "", protein: "", fat: "" });
  const [drawerTab, setDrawerTab] = useState<"presets" | "form">("presets");

  // open될 때마다 상태 초기화 (편집 모드 / 추가 모드 분기)
  useEffect(() => {
    if (!open) return;
    const loaded = getFoodPresets();
    setPresets(loaded);
    setPresetSearch("");
    setShowAllPresets(false);
    setEditingPreset(null);

    if (editing) {
      setMealType(editing.mealType);
      setFoodName(editing.foodName);
      setCarbs(String(editing.carbs));
      setProtein(String(editing.protein));
      setFat(String(editing.fat));
      setDrawerTab("form");
    } else {
      setMealType(defaultMealType);
      setFoodName("");
      setCarbs("");
      setProtein("");
      setFat("");
      setDrawerTab(loaded.length > 0 ? "presets" : "form");
    }
  }, [open, editing, defaultMealType]);

  const refreshPresets = () => setPresets(getFoodPresets());

  const handleApplyAndRecord = (preset: FoodPreset) => {
    addItemToDietRecord(date, mealType, {
      id: crypto.randomUUID(),
      name: preset.name,
      carbs: preset.carbs,
      protein: preset.protein,
      fat: preset.fat,
    });
    onSaved();
    onClose();
  };

  const handleDeletePreset = (id: string) => {
    deleteFoodPreset(id);
    refreshPresets();
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
    refreshPresets();
    setEditingPreset(null);
  };

  const handleSavePreset = () => {
    if (!foodName.trim() || !carbs || !protein || !fat) return;
    if (presets.some((p) => p.name === foodName.trim())) return;
    saveFoodPreset({
      id: crypto.randomUUID(),
      name: foodName.trim(),
      carbs: Number(carbs),
      protein: Number(protein),
      fat: Number(fat),
    });
    refreshPresets();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName || !carbs || !protein || !fat) return;

    if (isEdit && editing) {
      const updatedItem: MealItem = {
        id: editing.itemId,
        name: foodName,
        carbs: Number(carbs),
        protein: Number(protein),
        fat: Number(fat),
      };
      updateDietItem(editing.recordId, updatedItem);
    } else {
      addItemToDietRecord(date, mealType, {
        id: crypto.randomUUID(),
        name: foodName,
        carbs: Number(carbs),
        protein: Number(protein),
        fat: Number(fat),
      });
    }
    onSaved();
    onClose();
  };

  const filteredPresets = presets
    .filter((p) => p.name.toLowerCase().includes(presetSearch.toLowerCase()))
    .slice(0, showAllPresets || presetSearch ? presets.length : PRESET_LIMIT);

  const calPreview = calculateCalories(Number(carbs) || 0, Number(protein) || 0, Number(fat) || 0);
  const isPresetDuplicate = presets.some((p) => p.name === foodName.trim());

  return (
    <Drawer open={open} onClose={onClose} height="85vh" zIndex={60} ariaLabel={isEdit ? "식단 수정" : "식단 추가"}>
      {/* 헤더 */}
      <div className="flex justify-between items-center shrink-0 px-6 pt-3 pb-3">
        <h2 className="text-xl font-bold">{isEdit ? "식단 수정" : "식단 추가"}</h2>
        <button onClick={onClose} aria-label="닫기" className="p-2 -mr-2 text-muted hover:text-foreground">
          <X size={24} />
        </button>
      </div>

      {/* 탭 — 수정 모드 또는 즐겨찾기 없을 때 숨김 */}
      {!isEdit && presets.length > 0 && (
        <div className="flex gap-1 shrink-0 px-6 pb-3">
          {(["presets", "form"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setDrawerTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                drawerTab === tab ? "bg-accent text-background" : "bg-background border border-border text-muted"
              }`}
            >
              {tab === "presets" ? "즐겨찾기" : "직접 입력"}
            </button>
          ))}
        </div>
      )}

      {/* 즐겨찾기 탭 */}
      {drawerTab === "presets" && !isEdit && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* 식사 종류 선택 */}
          <div className="shrink-0 px-6 pb-3 space-y-2">
            <label className="text-sm font-medium text-muted">식사 종류</label>
            <div className="grid grid-cols-4 gap-2">
              {MEAL_TYPES.map((t) => (
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
                          inputMode="decimal"
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
                <div key={p.id} className="flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-3">
                  <button type="button" onClick={() => handleApplyAndRecord(p)}
                    aria-label={`${p.name} 기록하기`}
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
                    aria-label="즐겨찾기 편집"
                    className="shrink-0 text-muted hover:text-accent transition-colors p-1">
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={() => handleDeletePreset(p.id)}
                    aria-label="즐겨찾기 삭제"
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
      {(drawerTab === "form" || isEdit) && (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 space-y-5 pb-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">식사 종류</label>
              <div className="grid grid-cols-4 gap-2">
                {MEAL_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMealType(t)}
                    disabled={isEdit}
                    className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                      mealType === t ? "bg-accent text-background" : "bg-background text-foreground border border-border"
                    } disabled:opacity-50`}
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
                  <input
                    type="number"
                    inputMode="decimal"
                    required
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-center focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              ))}
            </div>

            {!isEdit && (
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!foodName.trim() || !carbs || !protein || !fat || isPresetDuplicate}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-amber-400/60 text-amber-500 font-semibold text-sm bg-amber-400/5 hover:bg-amber-400/10 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <Star size={15} fill={foodName.trim() && carbs && protein && fat && !isPresetDuplicate ? "currentColor" : "none"} />
                {isPresetDuplicate ? "이미 즐겨찾기에 있음" : "즐겨찾기에 저장"}
              </button>
            )}
          </div>

          <div className="shrink-0 px-6 pb-6 pt-4 border-t border-border">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-muted">예상 칼로리</span>
              <span className="text-lg font-bold">{calPreview} kcal</span>
            </div>
            <button
              type="submit"
              disabled={!foodName || !carbs || !protein || !fat}
              className="w-full bg-foreground text-background font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-40"
            >
              {isEdit ? "수정하기" : "기록하기"}
            </button>
          </div>
        </form>
      )}
    </Drawer>
  );
}
