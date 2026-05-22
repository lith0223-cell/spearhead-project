"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, Play, Trash2, Edit, X, GripVertical, Minus, Search, Check } from "lucide-react";
import {
  getRoutines, saveRoutine, deleteRoutine, saveRoutinesOrder,
  getExerciseLibrary, saveExerciseToLibrary, deleteExerciseFromLibrary,
  estimateRoutineCalories,
} from "@/utils/storage";
import { Routine, RoutineExerciseConfig, ExerciseTemplate, ExerciseCategory } from "@/types";

const DEFAULT_REST = 60;
const MAX_REST = 240;
const REST_STEP = 30;

const CATEGORIES: ExerciseCategory[] = ["가슴", "등", "어깨", "팔", "하체", "코어", "유산소", "기타"];

const CAT_COLORS: Record<ExerciseCategory, string> = {
  "가슴": "bg-red-500/15 text-red-400",
  "등":   "bg-blue-500/15 text-blue-400",
  "어깨": "bg-purple-500/15 text-purple-400",
  "팔":   "bg-orange-500/15 text-orange-400",
  "하체": "bg-green-500/15 text-green-400",
  "코어": "bg-yellow-500/15 text-yellow-400",
  "유산소": "bg-cyan-500/15 text-cyan-400",
  "기타": "bg-zinc-500/15 text-zinc-400",
};

export default function RoutinesPage() {
  const [activeTab, setActiveTab] = useState<"routines" | "exercises">("routines");

  // ── 루틴 상태 ──
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [userWeight, setUserWeight] = useState(70);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [routineName, setRoutineName] = useState("");
  const [exerciseConfigs, setExerciseConfigs] = useState<RoutineExerciseConfig[]>([]);
  const [configExIdx, setConfigExIdx] = useState<number | null>(null);

  // ── 종목 라이브러리 상태 ──
  const [library, setLibrary] = useState<ExerciseTemplate[]>([]);
  const [libCat, setLibCat] = useState<ExerciseCategory | "전체">("전체");
  const [isAddExOpen, setIsAddExOpen] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExCat, setNewExCat] = useState<ExerciseCategory>("기타");

  // ── 피커 상태 ──
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTargetIdx, setPickerTargetIdx] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCat, setPickerCat] = useState<ExerciseCategory | "전체">("전체");
  const [pickerNewName, setPickerNewName] = useState("");
  const [pickerNewCat, setPickerNewCat] = useState<ExerciseCategory>("기타");
  const [showPickerNewForm, setShowPickerNewForm] = useState(false);

  // ── 루틴 카드 드래그앤드롭 ──
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchStartIndexRef = useRef<number | null>(null);

  // ── 종목 드래그앤드롭 (모달 내) ──
  const [exDragIdx, setExDragIdx] = useState<number | null>(null);
  const [exDragOverIdx, setExDragOverIdx] = useState<number | null>(null);
  const exTouchRef = useRef<number | null>(null);
  const exerciseListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRoutines(getRoutines());
    setLibrary(getExerciseLibrary());
    setUserWeight(parseInt(localStorage.getItem("ph_user_weight") || "70"));
  }, []);

  // ── 루틴 카드 드래그앤드롭 ──
  const reorderRoutines = (from: number, to: number) => {
    if (from === to) return;
    const next = [...routines];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    saveRoutinesOrder(next);
    setRoutines(next);
  };
  const handleDragStart = (e: React.DragEvent, idx: number) => { setDragIndex(idx); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver  = (e: React.DragEvent, idx: number) => { e.preventDefault(); if (dragOverIndex !== idx) setDragOverIndex(idx); };
  const handleDrop      = (e: React.DragEvent, idx: number) => { e.preventDefault(); if (dragIndex !== null) reorderRoutines(dragIndex, idx); setDragIndex(null); setDragOverIndex(null); };
  const handleDragEnd   = () => { setDragIndex(null); setDragOverIndex(null); };
  const handleTouchStart = (e: React.TouchEvent, idx: number) => { touchStartIndexRef.current = idx; setDragIndex(idx); };
  const handleTouchMove  = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    Array.from(document.querySelectorAll("[data-ridx]")).forEach((card) => {
      const rect = card.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const over = parseInt(card.getAttribute("data-ridx") ?? "-1");
        if (over >= 0 && over !== dragOverIndex) setDragOverIndex(over);
      }
    });
  };
  const handleTouchEnd = () => {
    if (touchStartIndexRef.current !== null && dragOverIndex !== null) reorderRoutines(touchStartIndexRef.current, dragOverIndex);
    touchStartIndexRef.current = null; setDragIndex(null); setDragOverIndex(null);
  };

  // ── 종목 드래그앤드롭 (모달 내) ──
  const reorderExercises = (from: number, to: number) => {
    if (from === to) return;
    const next = [...exerciseConfigs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setExerciseConfigs(next);
  };
  const exDragStart = (idx: number) => (e: React.DragEvent) => { setExDragIdx(idx); e.dataTransfer.effectAllowed = "move"; };
  const exDragOver  = (idx: number) => (e: React.DragEvent) => { e.preventDefault(); if (exDragOverIdx !== idx) setExDragOverIdx(idx); };
  const exDrop      = (idx: number) => (e: React.DragEvent) => { e.preventDefault(); if (exDragIdx !== null) reorderExercises(exDragIdx, idx); setExDragIdx(null); setExDragOverIdx(null); };
  const exDragEnd   = () => { setExDragIdx(null); setExDragOverIdx(null); };
  const exTouchStart = (idx: number) => (e: React.TouchEvent) => { exTouchRef.current = idx; setExDragIdx(idx); };
  const exTouchMove  = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const els = exerciseListRef.current?.querySelectorAll("[data-ex-idx]") ?? [];
    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const over = parseInt(el.getAttribute("data-ex-idx") ?? "-1");
        if (over >= 0 && over !== exDragOverIdx) setExDragOverIdx(over);
      }
    });
  };
  const exTouchEnd = () => {
    if (exTouchRef.current !== null && exDragOverIdx !== null) reorderExercises(exTouchRef.current, exDragOverIdx);
    exTouchRef.current = null; setExDragIdx(null); setExDragOverIdx(null);
  };

  // ── 세트 설정 CRUD ──
  const updateConfigSet = (exIdx: number, setIdx: number, field: "weight" | "reps" | "restTime", value: number) => {
    setExerciseConfigs((prev) =>
      prev.map((c, i) => i !== exIdx ? c : { ...c, sets: c.sets.map((s, si) => si !== setIdx ? s : { ...s, [field]: value }) })
    );
  };
  const addConfigSet = (exIdx: number) => {
    setExerciseConfigs((prev) => prev.map((c, i) => {
      if (i !== exIdx) return c;
      const last = c.sets[c.sets.length - 1];
      return { ...c, sets: [...c.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? 0, restTime: last?.restTime ?? DEFAULT_REST }] };
    }));
  };
  const removeConfigSet = (exIdx: number, setIdx: number) => {
    setExerciseConfigs((prev) => prev.map((c, i) => i !== exIdx ? c : { ...c, sets: c.sets.filter((_, si) => si !== setIdx) }));
  };

  // ── 루틴 모달 ──
  const openAddModal = () => {
    if (routines.length >= 7) { alert("루틴은 최대 7개까지만 생성 가능합니다."); return; }
    setEditingId(null); setRoutineName(""); setExerciseConfigs([]); setIsModalOpen(true);
  };
  const openEditModal = (routine: Routine) => {
    setEditingId(routine.id);
    setRoutineName(routine.name);
    const configs = routine.exerciseConfigs ? [...routine.exerciseConfigs] : routine.exercises.map((name) => ({ name, sets: [] }));
    setExerciseConfigs(configs);
    setIsModalOpen(true);
  };
  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) { deleteRoutine(id); setRoutines(getRoutines()); }
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = exerciseConfigs.filter((c) => c.name.trim());
    if (!routineName.trim() || valid.length === 0) return;
    const newRoutine: Routine = {
      id: editingId || crypto.randomUUID(),
      name: routineName,
      exercises: valid.map((c) => c.name),
      exerciseConfigs: valid,
    };
    saveRoutine(newRoutine);
    setRoutines(getRoutines());
    setIsModalOpen(false);
  };

  // ── 피커 ──
  const openPicker = (targetIdx: number) => {
    setPickerTargetIdx(targetIdx);
    setPickerSearch(""); setPickerCat("전체");
    setPickerNewName(""); setPickerNewCat("기타"); setShowPickerNewForm(false);
    setIsPickerOpen(true);
  };
  const handlePickExercise = (ex: ExerciseTemplate) => {
    if (pickerTargetIdx === null) return;
    if (pickerTargetIdx === -1) {
      setExerciseConfigs((prev) => [...prev, { name: ex.name, sets: [], category: ex.category }]);
    } else {
      setExerciseConfigs((prev) => prev.map((c, i) => i === pickerTargetIdx ? { ...c, name: ex.name, category: ex.category } : c));
    }
    setIsPickerOpen(false); setPickerTargetIdx(null);
  };
  const handlePickerAddNew = () => {
    if (!pickerNewName.trim()) return;
    const newEx: ExerciseTemplate = { id: crypto.randomUUID(), name: pickerNewName.trim(), category: pickerNewCat };
    saveExerciseToLibrary(newEx);
    setLibrary(getExerciseLibrary());
    handlePickExercise(newEx);
  };

  const sortByCategory = (a: ExerciseTemplate, b: ExerciseTemplate) =>
    CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);

  const pickerFiltered = library
    .filter((ex) => {
      const matchCat = pickerCat === "전체" || ex.category === pickerCat;
      const matchSearch = ex.name.includes(pickerSearch);
      return matchCat && matchSearch;
    })
    .sort(pickerCat === "전체" ? sortByCategory : () => 0);
  const addedNames = new Set(exerciseConfigs.map((c) => c.name));

  // ── 종목 라이브러리 ──
  const libFiltered = library
    .filter((ex) => libCat === "전체" || ex.category === libCat)
    .sort(libCat === "전체" ? sortByCategory : () => 0);
  const handleAddExerciseToLibrary = () => {
    if (!newExName.trim()) return;
    const newEx: ExerciseTemplate = { id: crypto.randomUUID(), name: newExName.trim(), category: newExCat };
    saveExerciseToLibrary(newEx);
    setLibrary(getExerciseLibrary());
    setNewExName(""); setIsAddExOpen(false);
  };
  const handleDeleteFromLibrary = (id: string) => {
    deleteExerciseFromLibrary(id);
    setLibrary(getExerciseLibrary());
  };

  return (
    <main className="flex flex-col h-full animate-in fade-in duration-300">
      {/* 헤더 + 탭 */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-6 pt-6 pb-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold">운동</h1>
          <button
            onClick={activeTab === "routines" ? openAddModal : () => setIsAddExOpen(true)}
            className="w-10 h-10 bg-foreground text-background rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            <Plus size={22} />
          </button>
        </div>
        <div className="flex px-6 gap-1 pb-0">
          {(["routines", "exercises"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab === "routines" ? `루틴 (${routines.length}/7)` : "종목"}
            </button>
          ))}
        </div>
      </header>

      {/* ── 루틴 탭 ── */}
      {activeTab === "routines" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-8">
          {routines.map((routine, idx) => {
            const kcal = estimateRoutineCalories(routine, userWeight);
            return (
              <div
                key={routine.id}
                data-ridx={idx}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`bg-card border rounded-2xl p-5 shadow-sm transition-all select-none ${
                  dragIndex === idx ? "opacity-40 scale-[0.97] border-border"
                  : dragOverIndex === idx && dragIndex !== idx ? "border-accent scale-[1.02] shadow-lg shadow-accent/10"
                  : "border-border"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <button
                    className="text-muted hover:text-foreground p-1 -ml-1 cursor-grab active:cursor-grabbing touch-none"
                    onTouchStart={(e) => handleTouchStart(e, idx)}
                    aria-label="순서 변경"
                  >
                    <GripVertical size={20} />
                  </button>
                  <h2 className="flex-1 text-xl font-bold ml-2">{routine.name}</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditModal(routine)} className="text-muted hover:text-foreground p-1"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(routine.id)} className="text-muted hover:text-danger p-1"><Trash2 size={18} /></button>
                  </div>
                </div>
                {(() => {
                  const tSets = routine.exerciseConfigs?.reduce((s, c) => s + c.sets.length, 0) ?? 0;
                  const parts = [
                    `${routine.exercises.length}종목`,
                    ...(tSets > 0 ? [`${tSets}세트`] : []),
                    ...(kcal > 0 ? [`약 ${kcal}kcal`] : []),
                  ];
                  return <p className="text-xs text-muted mb-4 ml-7">{parts.join(" · ")}</p>;
                })()}
                <Link
                  href={`/workout/${routine.id}`}
                  className="flex items-center justify-center gap-2 w-full bg-accent text-background font-bold py-3 rounded-xl hover:bg-accent-hover transition-colors active:scale-95"
                >
                  <Play size={20} fill="currentColor" />
                  운동 시작
                </Link>
              </div>
            );
          })}
          {routines.length === 0 && (
            <div className="flex flex-col items-center justify-center text-muted h-64 text-center">
              <p>루틴이 없습니다.</p>
              <p className="text-sm mt-1">상단의 + 버튼을 눌러 새 루틴을 만드세요.</p>
            </div>
          )}
        </div>
      )}

      {/* ── 종목 라이브러리 탭 ── */}
      {activeTab === "exercises" && (
        <div className="flex-1 overflow-y-auto pb-8">
          {/* 카테고리 필터 */}
          <div className="flex gap-2 px-6 py-3 overflow-x-auto scrollbar-none">
            {(["전체", ...CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setLibCat(cat as typeof libCat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  libCat === cat ? "bg-accent text-background border-accent" : "bg-card border-border text-muted hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="px-6 space-y-2">
            {libFiltered.map((ex) => (
              <div key={ex.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${CAT_COLORS[ex.category]}`}>{ex.category}</span>
                <span className="flex-1 text-sm font-medium">{ex.name}</span>
                <button onClick={() => handleDeleteFromLibrary(ex.id)} className="text-muted hover:text-danger p-1 transition-colors shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {libFiltered.length === 0 && (
              <p className="text-center text-muted text-sm py-12">종목이 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* ── 루틴 모달 ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl animate-in slide-in-from-bottom-8 h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 pt-6 pb-4 shrink-0">
              <h2 className="text-xl font-bold">{editingId ? "루틴 수정" : "새 루틴 만들기"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 -mr-2 text-muted hover:text-foreground"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted">루틴 이름</label>
                <input
                  type="text"
                  required
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  placeholder="예: 가슴/삼두"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted">운동 종목</label>
                <div ref={exerciseListRef} className="space-y-2">
                  {exerciseConfigs.map((config, idx) => (
                    <div
                      key={idx}
                      data-ex-idx={idx}
                      draggable
                      onDragStart={exDragStart(idx)}
                      onDragOver={exDragOver(idx)}
                      onDrop={exDrop(idx)}
                      onDragEnd={exDragEnd}
                      onTouchMove={exTouchMove}
                      onTouchEnd={exTouchEnd}
                      className={`flex items-center gap-1.5 transition-all ${
                        exDragIdx === idx ? "opacity-40 scale-[0.97]"
                        : exDragOverIdx === idx && exDragIdx !== idx ? "scale-[1.02]" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onTouchStart={exTouchStart(idx)}
                        className="text-muted hover:text-foreground cursor-grab active:cursor-grabbing touch-none p-1 shrink-0"
                        aria-label="순서 변경"
                      >
                        <GripVertical size={14} />
                      </button>

                      {/* 종목 선택 영역 */}
                      <button
                        type="button"
                        onClick={() => openPicker(idx)}
                        className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2.5 py-2 text-sm text-left truncate hover:border-accent transition-colors"
                      >
                        {config.name || <span className="text-muted">종목 선택...</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => config.name.trim() && setConfigExIdx(idx)}
                        disabled={!config.name.trim()}
                        className={`text-xs px-2 py-1 rounded-lg font-medium shrink-0 transition-colors ${
                          config.sets.length > 0 ? "bg-accent/20 text-accent" : "bg-background border border-border text-muted hover:border-accent hover:text-accent"
                        } disabled:opacity-30`}
                      >
                        {config.sets.length > 0 ? `${config.sets.length}세트` : "설정"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setExerciseConfigs((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-muted hover:text-danger p-1 shrink-0 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => openPicker(-1)}
                  className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:border-muted transition-colors"
                >
                  + 종목 추가
                </button>
              </div>

              </div>
              <div className="shrink-0 px-6 pb-6 pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-muted hover:text-foreground transition-colors">
                  취소
                </button>
                <button
                  type="submit"
                  disabled={exerciseConfigs.filter((c) => c.name.trim()).length === 0}
                  className="flex-1 bg-foreground text-background font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-30"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 종목 피커 (루틴 빌더용) ── */}
      {isPickerOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[70] flex items-end justify-center animate-in fade-in" onClick={() => setIsPickerOpen(false)}>
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl border border-border shadow-2xl h-[80vh] flex flex-col animate-in slide-in-from-bottom-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 pt-6 pb-3 shrink-0">
              <h3 className="text-lg font-bold">종목 선택</h3>
              <button onClick={() => setIsPickerOpen(false)} className="p-2 -mr-2 text-muted hover:text-foreground"><X size={22} /></button>
            </div>

            {/* 검색 */}
            <div className="px-6 pb-2 shrink-0">
              <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2.5">
                <Search size={16} className="text-muted shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="종목 검색..."
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* 카테고리 필터 */}
            <div className="flex gap-2 px-6 pb-3 overflow-x-auto scrollbar-none shrink-0">
              {(["전체", ...CATEGORIES] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setPickerCat(cat as typeof pickerCat)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    pickerCat === cat ? "bg-accent text-background border-accent" : "bg-background border-border text-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 종목 리스트 */}
            <div className="flex-1 overflow-y-auto px-6 pb-3 space-y-1.5">
              {pickerFiltered.map((ex) => {
                const alreadyAdded = addedNames.has(ex.name);
                return (
                  <button
                    key={ex.id}
                    onClick={() => handlePickExercise(ex)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-background transition-colors text-left"
                  >
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${CAT_COLORS[ex.category]}`}>{ex.category}</span>
                    <span className="flex-1 text-sm font-medium">{ex.name}</span>
                    {alreadyAdded && <Check size={15} className="text-accent shrink-0" />}
                  </button>
                );
              })}
              {pickerFiltered.length === 0 && !showPickerNewForm && (
                <p className="text-center text-muted text-sm py-6">검색 결과 없음</p>
              )}
            </div>

            {/* 새 종목 추가 */}
            <div className="px-6 pb-6 pt-2 border-t border-border shrink-0">
              {showPickerNewForm ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    type="text"
                    value={pickerNewName}
                    onChange={(e) => setPickerNewName(e.target.value)}
                    placeholder="종목명 입력"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                  />
                  <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setPickerNewCat(cat)}
                        className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          pickerNewCat === cat ? "bg-accent text-background border-accent" : "bg-background border-border text-muted"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowPickerNewForm(false)} className="flex-1 py-2.5 text-sm font-bold text-muted">취소</button>
                    <button
                      onClick={handlePickerAddNew}
                      disabled={!pickerNewName.trim()}
                      className="flex-[2] py-2.5 bg-foreground text-background text-sm font-bold rounded-xl disabled:opacity-30"
                    >
                      추가하고 선택
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowPickerNewForm(true)}
                  className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:border-muted transition-colors"
                >
                  + 새 종목 만들기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 종목 추가 모달 (라이브러리 탭) ── */}
      {isAddExOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-end justify-center animate-in fade-in" onClick={() => setIsAddExOpen(false)}>
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl border border-border shadow-2xl h-[62vh] flex flex-col animate-in slide-in-from-bottom-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 pt-6 pb-4 shrink-0">
              <h3 className="text-lg font-bold">종목 추가</h3>
              <button onClick={() => setIsAddExOpen(false)} className="p-2 -mr-2 text-muted hover:text-foreground"><X size={22} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 space-y-4">
              <input
                autoFocus
                type="text"
                value={newExName}
                onChange={(e) => setNewExName(e.target.value)}
                placeholder="종목명 입력"
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-accent transition-colors"
              />
              <div>
                <p className="text-sm font-medium text-muted mb-2">카테고리</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewExCat(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        newExCat === cat ? "bg-accent text-background border-accent" : "bg-background border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="shrink-0 px-6 pb-6 pt-2 flex gap-3">
              <button onClick={() => setIsAddExOpen(false)} className="flex-1 py-4 font-bold text-muted">취소</button>
              <button
                onClick={handleAddExerciseToLibrary}
                disabled={!newExName.trim()}
                className="flex-[2] py-4 bg-foreground text-background font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-30"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 세트 설정 서브 모달 ── */}
      {configExIdx !== null && exerciseConfigs[configExIdx] && (() => {
        const isCardioConfig = exerciseConfigs[configExIdx].category === "유산소";
        return (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[80] flex items-end justify-center animate-in fade-in" onClick={() => setConfigExIdx(null)}>
            <div className="bg-card w-full sm:max-w-sm rounded-t-3xl border border-border shadow-2xl h-[82vh] flex flex-col animate-in slide-in-from-bottom-8" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center px-6 pt-6 pb-1 shrink-0">
                <h3 className="text-lg font-bold">{exerciseConfigs[configExIdx].name}</h3>
                <button type="button" onClick={() => setConfigExIdx(null)} className="p-2 -mr-2 text-muted hover:text-foreground"><X size={24} /></button>
              </div>
              <p className="text-xs text-muted px-6 pb-3 shrink-0">기본 세트를 설정하면 운동 시작 시 자동으로 적용됩니다.</p>

              <div className="flex-1 overflow-y-auto px-6 space-y-2 pb-2">
                {exerciseConfigs[configExIdx].sets.map((set, sIdx) => (
                  <div key={sIdx} className="p-3 bg-background rounded-xl border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted w-5 text-center shrink-0">{sIdx + 1}</span>
                      {isCardioConfig ? (
                        <>
                          <input type="number" value={set.weight || ""} onChange={(e) => updateConfigSet(configExIdx, sIdx, "weight", Number(e.target.value))} onFocus={(e) => e.target.select()} placeholder="0" className="flex-1 min-w-0 text-center bg-card border border-border rounded-lg px-2 py-2 text-sm font-bold focus:outline-none focus:border-accent" />
                          <span className="text-xs text-muted shrink-0">km</span>
                          <input type="number" value={set.reps || ""} onChange={(e) => updateConfigSet(configExIdx, sIdx, "reps", Number(e.target.value))} onFocus={(e) => e.target.select()} placeholder="0" className="flex-1 min-w-0 text-center bg-card border border-border rounded-lg px-2 py-2 text-sm font-bold focus:outline-none focus:border-accent" />
                          <span className="text-xs text-muted shrink-0">분</span>
                        </>
                      ) : (
                        <>
                          <input type="number" value={set.weight || ""} onChange={(e) => updateConfigSet(configExIdx, sIdx, "weight", Number(e.target.value))} onFocus={(e) => e.target.select()} placeholder="0" className="flex-1 min-w-0 text-center bg-card border border-border rounded-lg px-2 py-2 text-sm font-bold focus:outline-none focus:border-accent" />
                          <span className="text-xs text-muted shrink-0">kg ×</span>
                          <input type="number" value={set.reps || ""} onChange={(e) => updateConfigSet(configExIdx, sIdx, "reps", Number(e.target.value))} onFocus={(e) => e.target.select()} placeholder="0" className="flex-1 min-w-0 text-center bg-card border border-border rounded-lg px-2 py-2 text-sm font-bold focus:outline-none focus:border-accent" />
                          <span className="text-xs text-muted shrink-0">회</span>
                        </>
                      )}
                      <button type="button" onClick={() => removeConfigSet(configExIdx, sIdx)} className="text-muted hover:text-danger p-1 shrink-0 transition-colors"><Trash2 size={14} /></button>
                    </div>
                    {!isCardioConfig && (
                      <div className="flex items-center justify-between pl-6">
                        <span className="text-xs text-muted">휴식</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => updateConfigSet(configExIdx, sIdx, "restTime", Math.max(REST_STEP, (set.restTime || DEFAULT_REST) - REST_STEP))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border text-muted hover:text-foreground active:scale-90 transition-all"><Minus size={13} /></button>
                          <span className="text-sm font-bold w-12 text-center">{set.restTime || DEFAULT_REST}초</span>
                          <button type="button" onClick={() => updateConfigSet(configExIdx, sIdx, "restTime", Math.min(MAX_REST, (set.restTime || DEFAULT_REST) + REST_STEP))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border text-muted hover:text-foreground active:scale-90 transition-all"><Plus size={13} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {exerciseConfigs[configExIdx].sets.length === 0 && (
                  <p className="text-center text-xs text-muted py-6">아래 버튼으로 세트를 추가해주세요.</p>
                )}
              </div>

              <div className="shrink-0 px-6 pb-6 pt-2 space-y-2">
              <button type="button" onClick={() => addConfigSet(configExIdx)} className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:border-muted transition-colors">
                + {isCardioConfig ? "구간 추가" : "세트 추가"}
              </button>
              <button type="button" onClick={() => setConfigExIdx(null)} className="w-full py-4 bg-foreground text-background font-bold rounded-xl active:scale-95 transition-transform">
                완료
              </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
