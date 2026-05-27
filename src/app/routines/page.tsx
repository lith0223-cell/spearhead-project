"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, Play, Trash2, Edit, X, GripVertical, Minus, Search, Check, Copy, Timer } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { useActiveWorkout } from "@/providers/ActiveWorkoutProvider";
import {
  getRoutines, saveRoutine, deleteRoutine, saveRoutinesOrder,
  getExerciseLibrary, saveExerciseToLibrary, updateExerciseInLibrary, deleteExerciseFromLibrary,
  estimateRoutineCalories,
} from "@/utils/storage";
import { Routine, RoutineExerciseConfig, RoutineSetTemplate, ExerciseTemplate, ExerciseCategory, WeightMode } from "@/types";

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
  const { isActive } = useActiveWorkout();
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

  // ── 세트 모드 피커 ──
  const [configSetModePicker, setConfigSetModePicker] = useState<{ exIdx: number; setIdx: number; current: WeightMode } | null>(null);
  const [configRestPickerState, setConfigRestPickerState] = useState<{ exIdx: number; setIdx: number } | null>(null);

  // ── 종목 상세 (기본 세트 설정) ──
  const [libDetailEx, setLibDetailEx] = useState<ExerciseTemplate | null>(null);
  const [libDetailSets, setLibDetailSets] = useState<RoutineSetTemplate[]>([]);
  const [libDetailModePicker, setLibDetailModePicker] = useState<{ setIdx: number; current: WeightMode } | null>(null);
  const [libDetailRestPicker, setLibDetailRestPicker] = useState<{ setIdx: number } | null>(null);

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
  const [flashRoutineIdx, setFlashRoutineIdx] = useState<number | null>(null);
  const touchStartIndexRef = useRef<number | null>(null);

  // ── 종목 드래그앤드롭 (모달 내) ──
  const [exDragIdx, setExDragIdx] = useState<number | null>(null);
  const [exDragOverIdx, setExDragOverIdx] = useState<number | null>(null);
  const [flashExIdx, setFlashExIdx] = useState<number | null>(null);
  const exTouchRef = useRef<number | null>(null);
  const exerciseListRef = useRef<HTMLDivElement>(null);

  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
  };

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
    setFlashRoutineIdx(to);
    vibrate([15, 60, 15]);
    setTimeout(() => setFlashRoutineIdx(null), 700);
  };
  const handleDragStart = (e: React.DragEvent, idx: number) => { setDragIndex(idx); e.dataTransfer.effectAllowed = "move"; vibrate(25); };
  const handleDragOver  = (e: React.DragEvent, idx: number) => { e.preventDefault(); if (dragOverIndex !== idx) setDragOverIndex(idx); };
  const handleDrop      = (e: React.DragEvent, idx: number) => { e.preventDefault(); if (dragIndex !== null) reorderRoutines(dragIndex, idx); setDragIndex(null); setDragOverIndex(null); };
  const handleDragEnd   = () => { setDragIndex(null); setDragOverIndex(null); };
  const handleTouchStart = (e: React.TouchEvent, idx: number) => { touchStartIndexRef.current = idx; setDragIndex(idx); vibrate(25); };
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
    setFlashExIdx(to);
    vibrate([15, 60, 15]);
    setTimeout(() => setFlashExIdx(null), 700);
  };
  const exDragStart = (idx: number) => (e: React.DragEvent) => { setExDragIdx(idx); e.dataTransfer.effectAllowed = "move"; vibrate(25); };
  const exDragOver  = (idx: number) => (e: React.DragEvent) => { e.preventDefault(); if (exDragOverIdx !== idx) setExDragOverIdx(idx); };
  const exDrop      = (idx: number) => (e: React.DragEvent) => { e.preventDefault(); if (exDragIdx !== null) reorderExercises(exDragIdx, idx); setExDragIdx(null); setExDragOverIdx(null); };
  const exDragEnd   = () => { setExDragIdx(null); setExDragOverIdx(null); };
  const exTouchStart = (idx: number) => (e: React.TouchEvent) => { exTouchRef.current = idx; setExDragIdx(idx); vibrate(25); };
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

  // ── 종목 라이브러리 상세 (기본 세트 설정) ──
  const openLibDetail = (ex: ExerciseTemplate) => {
    setLibDetailEx(ex);
    setLibDetailSets(ex.defaultSets ? [...ex.defaultSets] : []);
  };
  const saveLibDetail = () => {
    if (!libDetailEx) return;
    const updated: ExerciseTemplate = {
      ...libDetailEx,
      defaultSets: libDetailSets.length > 0 ? libDetailSets : undefined,
    };
    updateExerciseInLibrary(updated);
    setLibrary(getExerciseLibrary());
    setLibDetailEx(null);
  };
  const updateLibDetailSet = (setIdx: number, field: "weight" | "reps" | "restTime", value: number) => {
    setLibDetailSets((prev) => prev.map((s, i) => i !== setIdx ? s : { ...s, [field]: value }));
  };
  const updateLibDetailSetMode = (setIdx: number, mode: WeightMode) => {
    setLibDetailSets((prev) => prev.map((s, i) =>
      i !== setIdx ? s : { ...s, weightMode: mode, weight: mode === "bodyweight" ? 0 : s.weight }
    ));
    setLibDetailModePicker(null);
  };
  const addLibDetailSet = () => {
    setLibDetailSets((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, {
        weight: last?.weightMode === "bodyweight" ? 0 : (last?.weight ?? 0),
        reps: last?.reps ?? 0,
        restTime: last?.restTime ?? DEFAULT_REST,
        weightMode: last?.weightMode,
      }];
    });
  };
  const removeLibDetailSet = (setIdx: number) => {
    setLibDetailSets((prev) => prev.filter((_, i) => i !== setIdx));
  };

  // ── 세트 설정 CRUD ──
  const updateConfigSet = (exIdx: number, setIdx: number, field: "weight" | "reps" | "restTime", value: number) => {
    setExerciseConfigs((prev) =>
      prev.map((c, i) => i !== exIdx ? c : { ...c, sets: c.sets.map((s, si) => si !== setIdx ? s : { ...s, [field]: value }) })
    );
  };
  const updateConfigSetMode = (exIdx: number, setIdx: number, mode: WeightMode) => {
    setExerciseConfigs((prev) =>
      prev.map((c, i) => i !== exIdx ? c : {
        ...c,
        sets: c.sets.map((s, si) =>
          si !== setIdx ? s : { ...s, weightMode: mode, weight: mode === "bodyweight" ? 0 : s.weight }
        ),
      })
    );
    setConfigSetModePicker(null);
  };
  const addConfigSet = (exIdx: number) => {
    setExerciseConfigs((prev) => prev.map((c, i) => {
      if (i !== exIdx) return c;
      const last = c.sets[c.sets.length - 1];
      return { ...c, sets: [...c.sets, {
        weight: last?.weightMode === "bodyweight" ? 0 : (last?.weight ?? 0),
        reps: last?.reps ?? 0,
        restTime: last?.restTime ?? DEFAULT_REST,
        weightMode: last?.weightMode,
      }] };
    }));
  };
  const removeConfigSet = (exIdx: number, setIdx: number) => {
    setExerciseConfigs((prev) => prev.map((c, i) => {
      if (i !== exIdx) return c;
      if (c.sets.length <= 1) return c; // 최소 1세트 보장
      return { ...c, sets: c.sets.filter((_, si) => si !== setIdx) };
    }));
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
  const handleCopy = (routine: Routine) => {
    if (routines.length >= 7) { alert("루틴은 최대 7개까지만 생성 가능합니다."); return; }
    saveRoutine({ ...routine, id: crypto.randomUUID(), name: `${routine.name} (복사)` });
    setRoutines(getRoutines());
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
    const defaultSets: RoutineSetTemplate[] = ex.defaultSets && ex.defaultSets.length > 0 ? [...ex.defaultSets] : [];
    if (pickerTargetIdx === -1) {
      setExerciseConfigs((prev) => [...prev, { name: ex.name, sets: defaultSets, category: ex.category }]);
    } else {
      setExerciseConfigs((prev) => prev.map((c, i) =>
        i === pickerTargetIdx ? { ...c, name: ex.name, category: ex.category, sets: defaultSets } : c
      ));
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
      <header className="bg-card border-b border-border sticky top-0 z-10 px-6 pt-6 pb-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">운동</h1>
          <button
            onClick={activeTab === "routines" ? openAddModal : () => setIsAddExOpen(true)}
            className="w-10 h-10 bg-foreground text-background rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            <Plus size={22} />
          </button>
        </div>
        <div className="flex gap-1 bg-background rounded-xl p-1">
          {(["routines", "exercises"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted"
              }`}
            >
              {tab === "routines" ? `루틴 (${routines.length}/7)` : "종목"}
            </button>
          ))}
        </div>
      </header>

      {/* ── 루틴 탭 ── */}
      {activeTab === "routines" && (
        <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${isActive ? "pb-24" : "pb-8"}`}>
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
                className={`bg-card border rounded-2xl p-5 shadow-sm transition-all duration-150 select-none ${
                  flashRoutineIdx === idx
                    ? "border-accent bg-accent/10 shadow-lg shadow-accent/25"
                    : dragIndex === idx
                    ? "opacity-20 scale-95 border-border shadow-none"
                    : dragOverIndex === idx && dragIndex !== idx
                    ? "border-accent bg-accent/10 scale-[1.02] shadow-xl shadow-accent/20"
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
                    <button onClick={() => handleCopy(routine)} className="text-muted hover:text-foreground p-1" title="복사"><Copy size={16} /></button>
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
            <div className="flex flex-col items-center justify-center text-muted h-64 text-center gap-4">
              <div>
                <p className="font-semibold">루틴이 없습니다.</p>
                <p className="text-sm mt-1">나만의 루틴을 만들어 운동을 시작해보세요.</p>
              </div>
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background text-sm font-bold rounded-xl active:scale-95 transition-transform"
              >
                <Plus size={16} />
                새 루틴 만들기
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 종목 라이브러리 탭 ── */}
      {activeTab === "exercises" && (
        <div className={`flex-1 overflow-y-auto ${isActive ? "pb-24" : "pb-8"}`}>
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
                <button
                  onClick={() => openLibDetail(ex)}
                  className="flex-1 flex items-center justify-between gap-2 min-w-0 text-left"
                >
                  <span className="text-sm font-medium truncate">{ex.name}</span>
                  {ex.defaultSets && ex.defaultSets.length > 0 && (
                    <span className="text-xs font-semibold text-accent shrink-0">{ex.defaultSets.length}세트</span>
                  )}
                </button>
                <button onClick={() => handleDeleteFromLibrary(ex.id)} className="text-muted hover:text-danger p-1 transition-colors shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {libFiltered.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12">
                <p className="text-center text-muted text-sm">종목이 없습니다.</p>
                {libCat !== "전체" && (
                  <button
                    onClick={() => setLibCat("전체")}
                    className="text-xs text-accent font-semibold px-3 py-1.5 border border-accent/40 rounded-full hover:bg-accent/10 transition-colors"
                  >
                    전체 보기
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 루틴 Drawer ── */}
      <Drawer open={isModalOpen} onClose={() => setIsModalOpen(false)} height="85vh" zIndex={60}>
        <div className="flex justify-between items-center px-6 pt-4 pb-4 shrink-0">
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
                  className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 transition-all duration-150 select-none ${
                    flashExIdx === idx
                      ? "bg-accent/10 border-accent shadow-md shadow-accent/20"
                      : exDragIdx === idx
                      ? "opacity-20 scale-95 border-border bg-card shadow-none"
                      : exDragOverIdx === idx && exDragIdx !== idx
                      ? "bg-accent/10 border-accent scale-[1.02] shadow-lg shadow-accent/15"
                      : "bg-card border-border shadow-sm"
                  }`}
                >
                  <button
                    type="button"
                    onTouchStart={exTouchStart(idx)}
                    className="text-muted hover:text-foreground cursor-grab active:cursor-grabbing touch-none shrink-0"
                    aria-label="순서 변경"
                  >
                    <GripVertical size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => openPicker(idx)}
                    className="flex-1 min-w-0 text-sm font-medium text-left truncate hover:text-accent transition-colors"
                  >
                    {config.name || <span className="text-muted">종목 선택...</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => config.name.trim() && setConfigExIdx(idx)}
                    disabled={!config.name.trim()}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors ${
                      config.sets.length > 0
                        ? "bg-accent/20 text-accent"
                        : "bg-background border border-border text-muted hover:border-accent hover:text-accent"
                    } disabled:opacity-30`}
                  >
                    {config.sets.length > 0 ? `${config.sets.length}세트` : "설정"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setExerciseConfigs((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-muted hover:text-danger shrink-0 transition-colors"
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
      </Drawer>

      {/* ── 종목 피커 Drawer ── */}
      <Drawer open={isPickerOpen} onClose={() => setIsPickerOpen(false)} height="80vh" zIndex={70}>
        <div className="flex justify-between items-center px-6 pt-3 pb-3 shrink-0">
          <h3 className="text-lg font-bold">종목 선택</h3>
          <button onClick={() => setIsPickerOpen(false)} className="p-2 -mr-2 text-muted hover:text-foreground"><X size={22} /></button>
        </div>

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
      </Drawer>

      {/* ── 종목 추가 Drawer (라이브러리 탭) ── */}
      <Drawer open={isAddExOpen} onClose={() => setIsAddExOpen(false)} height="62vh" zIndex={60}>
        <div className="flex justify-between items-center px-6 pt-3 pb-4 shrink-0">
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
      </Drawer>

      {/* ── 세트 설정 Drawer ── */}
      {configExIdx !== null && exerciseConfigs[configExIdx] && (() => {
        const isCardioConfig = exerciseConfigs[configExIdx].category === "유산소";
        return (
          <Drawer open={true} onClose={() => setConfigExIdx(null)} height="82vh" zIndex={80}>
            <div className="flex justify-between items-center px-6 pt-3 pb-1 shrink-0">
              <h3 className="text-lg font-bold">{exerciseConfigs[configExIdx].name}</h3>
              <button type="button" onClick={() => setConfigExIdx(null)} className="p-2 -mr-2 text-muted hover:text-foreground"><X size={24} /></button>
            </div>
            <p className="text-xs text-muted px-6 pb-3 shrink-0">기본 세트를 설정하면 운동 시작 시 자동으로 적용됩니다.</p>

            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
              {/* 컬럼 헤더 */}
              {exerciseConfigs[configExIdx].sets.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-10 text-center text-xs font-medium text-muted">{isCardioConfig ? "구간" : "세트"}</span>
                  <span className="flex-1 text-center text-xs font-medium text-muted">{isCardioConfig ? "거리(km)" : "무게(kg)"}</span>
                  <span className="flex-1 text-center text-xs font-medium text-muted">{isCardioConfig ? "시간(분)" : "횟수"}</span>
                  <span className="w-8" />
                </div>
              )}

              {exerciseConfigs[configExIdx].sets.map((set, sIdx) => (
                <div key={sIdx} className="mb-2">
                  {/* 메인 행 — 외부 카드 없음, 운동 화면과 동일 구조 */}
                  <div className="flex items-center gap-2 py-0.5">
                    {/* 모드 버튼 */}
                    {!isCardioConfig ? (
                      <button
                        type="button"
                        onClick={() => setConfigSetModePicker({ exIdx: configExIdx, setIdx: sIdx, current: set.weightMode ?? "weighted" })}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold shrink-0 transition-all active:scale-90 ${
                          set.weightMode === "bodyweight"
                            ? "bg-blue-500/15 text-blue-400"
                            : set.weightMode === "assisted"
                            ? "bg-purple-500/15 text-purple-400"
                            : "bg-background text-muted"
                        }`}
                      >
                        {set.weightMode === "bodyweight" ? "BW" : set.weightMode === "assisted" ? "AS" : sIdx + 1}
                      </button>
                    ) : (
                      <span className="w-10 h-10 flex items-center justify-center text-xs font-bold text-muted shrink-0">{sIdx + 1}</span>
                    )}

                    {/* 무게/거리 */}
                    {isCardioConfig ? (
                      <input type="text" inputMode="decimal"
                        value={set.weight || ""}
                        onChange={(e) => updateConfigSet(configExIdx, sIdx, "weight", Number(e.target.value))}
                        onFocus={(e) => e.target.select()} placeholder="0"
                        className="flex-1 min-w-0 text-center rounded-xl py-2.5 text-lg font-bold bg-background focus:outline-none focus:ring-1 focus:ring-accent text-foreground"
                      />
                    ) : set.weightMode !== "bodyweight" ? (
                      <input type="text" inputMode="decimal"
                        value={set.weight || ""}
                        onChange={(e) => updateConfigSet(configExIdx, sIdx, "weight", Number(e.target.value))}
                        onFocus={(e) => e.target.select()} placeholder="0"
                        className={`flex-1 min-w-0 text-center rounded-xl py-2.5 text-lg font-bold bg-background focus:outline-none focus:ring-1 text-foreground ${
                          set.weightMode === "assisted" ? "focus:ring-purple-400" : "focus:ring-accent"
                        }`}
                      />
                    ) : (
                      <div className="flex-1 flex items-center justify-center py-2.5 bg-background rounded-xl">
                        <span className="text-lg font-bold text-muted/40">—</span>
                      </div>
                    )}

                    {/* 횟수/시간 */}
                    <input type="text" inputMode="decimal"
                      value={set.reps || ""}
                      onChange={(e) => updateConfigSet(configExIdx, sIdx, "reps", Number(e.target.value))}
                      onFocus={(e) => e.target.select()} placeholder="0"
                      className="flex-1 min-w-0 text-center rounded-xl py-2.5 text-lg font-bold bg-background focus:outline-none focus:ring-1 focus:ring-accent text-foreground"
                    />

                    {/* 삭제 */}
                    <button type="button"
                      onClick={() => removeConfigSet(configExIdx, sIdx)}
                      disabled={exerciseConfigs[configExIdx].sets.length <= 1}
                      className="w-8 h-8 flex items-center justify-center text-muted hover:text-danger transition-colors shrink-0 disabled:opacity-20"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* 휴식 타이머 아이콘 */}
                  {!isCardioConfig && (
                    <div className="flex justify-end mt-0.5 min-h-[20px]">
                      <button
                        type="button"
                        onClick={() => setConfigRestPickerState({ exIdx: configExIdx, setIdx: sIdx })}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-muted hover:text-accent active:scale-90 transition-all"
                      >
                        <Timer size={12} />
                        <span className="text-xs font-bold whitespace-nowrap">{set.restTime || DEFAULT_REST}초</span>
                      </button>
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
          </Drawer>
        );
      })()}

      {/* ── 루틴 세트 휴식 타이머 설정 Bottom Sheet ── */}
      <Drawer open={!!configRestPickerState} onClose={() => setConfigRestPickerState(null)} height="auto" zIndex={95}>
        {configRestPickerState && (() => {
          const currentRest = exerciseConfigs[configRestPickerState.exIdx]?.sets[configRestPickerState.setIdx]?.restTime || DEFAULT_REST;
          const PRESETS = [30, 60, 90, 120, 150, 180, 210, 240];
          return (
            <div className="px-6 pt-5 pb-8">
              <div className="flex items-center gap-2 mb-1">
                <Timer size={18} className="text-accent" />
                <h3 className="text-base font-bold">세트별 휴식 타이머 설정</h3>
              </div>
              <p className="text-xs text-muted mb-5">
                {exerciseConfigs[configRestPickerState.exIdx]?.name} — {configRestPickerState.setIdx + 1}세트
              </p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {PRESETS.map((sec) => (
                  <button key={sec} type="button"
                    onClick={() => updateConfigSet(configRestPickerState.exIdx, configRestPickerState.setIdx, "restTime", sec)}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                      currentRest === sec
                        ? "bg-accent text-background border-accent shadow-md shadow-accent/30"
                        : "bg-card border-border text-foreground hover:border-accent"
                    }`}
                  >
                    {sec}초
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 mb-5">
                <button type="button"
                  onClick={() => updateConfigSet(configRestPickerState.exIdx, configRestPickerState.setIdx, "restTime", Math.max(REST_STEP, currentRest - REST_STEP))}
                  disabled={currentRest <= REST_STEP}
                  className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted disabled:opacity-30 active:scale-90"
                >
                  <Minus size={16} />
                </button>
                <span className="text-3xl font-extrabold w-24 text-center text-accent">{currentRest}초</span>
                <button type="button"
                  onClick={() => updateConfigSet(configRestPickerState.exIdx, configRestPickerState.setIdx, "restTime", Math.min(MAX_REST, currentRest + REST_STEP))}
                  disabled={currentRest >= MAX_REST}
                  className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted disabled:opacity-30 active:scale-90"
                >
                  <Plus size={16} />
                </button>
              </div>
              <button type="button"
                onClick={() => setConfigRestPickerState(null)}
                className="w-full py-4 bg-foreground text-background font-bold rounded-xl active:scale-95 transition-transform"
              >
                확인
              </button>
            </div>
          );
        })()}
      </Drawer>

      {/* ── 종목 상세 Drawer (기본 세트 설정) ── */}
      {libDetailEx && (() => {
        const isCardio = libDetailEx.category === "유산소";
        return (
          <Drawer open={true} onClose={() => setLibDetailEx(null)} height="82vh" zIndex={80}>
            <div className="flex justify-between items-center px-6 pt-3 pb-1 shrink-0">
              <div>
                <h3 className="text-lg font-bold">{libDetailEx.name}</h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_COLORS[libDetailEx.category]}`}>{libDetailEx.category}</span>
              </div>
              <button type="button" onClick={() => setLibDetailEx(null)} className="p-2 -mr-2 text-muted hover:text-foreground"><X size={24} /></button>
            </div>
            <p className="text-xs text-muted px-6 pb-3 shrink-0">기본 세트를 설정하면 루틴에 추가 시 자동으로 적용됩니다.</p>

            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
              {libDetailSets.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-10 text-center text-xs font-medium text-muted">{isCardio ? "구간" : "세트"}</span>
                  <span className="flex-1 text-center text-xs font-medium text-muted">{isCardio ? "거리(km)" : "무게(kg)"}</span>
                  <span className="flex-1 text-center text-xs font-medium text-muted">{isCardio ? "시간(분)" : "횟수"}</span>
                  <span className="w-8" />
                </div>
              )}

              {libDetailSets.map((set, sIdx) => (
                <div key={sIdx} className="mb-2">
                  <div className="flex items-center gap-2 py-0.5">
                    {!isCardio ? (
                      <button
                        type="button"
                        onClick={() => setLibDetailModePicker({ setIdx: sIdx, current: set.weightMode ?? "weighted" })}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold shrink-0 transition-all active:scale-90 ${
                          set.weightMode === "bodyweight"
                            ? "bg-blue-500/15 text-blue-400"
                            : set.weightMode === "assisted"
                            ? "bg-purple-500/15 text-purple-400"
                            : "bg-background text-muted"
                        }`}
                      >
                        {set.weightMode === "bodyweight" ? "BW" : set.weightMode === "assisted" ? "AS" : sIdx + 1}
                      </button>
                    ) : (
                      <span className="w-10 h-10 flex items-center justify-center text-xs font-bold text-muted shrink-0">{sIdx + 1}</span>
                    )}

                    {isCardio ? (
                      <input type="text" inputMode="decimal"
                        value={set.weight || ""}
                        onChange={(e) => updateLibDetailSet(sIdx, "weight", Number(e.target.value))}
                        onFocus={(e) => e.target.select()} placeholder="0"
                        className="flex-1 min-w-0 text-center rounded-xl py-2.5 text-lg font-bold bg-background focus:outline-none focus:ring-1 focus:ring-accent text-foreground"
                      />
                    ) : set.weightMode !== "bodyweight" ? (
                      <input type="text" inputMode="decimal"
                        value={set.weight || ""}
                        onChange={(e) => updateLibDetailSet(sIdx, "weight", Number(e.target.value))}
                        onFocus={(e) => e.target.select()} placeholder="0"
                        className={`flex-1 min-w-0 text-center rounded-xl py-2.5 text-lg font-bold bg-background focus:outline-none focus:ring-1 text-foreground ${
                          set.weightMode === "assisted" ? "focus:ring-purple-400" : "focus:ring-accent"
                        }`}
                      />
                    ) : (
                      <div className="flex-1 flex items-center justify-center py-2.5 bg-background rounded-xl">
                        <span className="text-lg font-bold text-muted/40">—</span>
                      </div>
                    )}

                    <input type="text" inputMode="decimal"
                      value={set.reps || ""}
                      onChange={(e) => updateLibDetailSet(sIdx, "reps", Number(e.target.value))}
                      onFocus={(e) => e.target.select()} placeholder="0"
                      className="flex-1 min-w-0 text-center rounded-xl py-2.5 text-lg font-bold bg-background focus:outline-none focus:ring-1 focus:ring-accent text-foreground"
                    />

                    <button type="button"
                      onClick={() => removeLibDetailSet(sIdx)}
                      className="w-8 h-8 flex items-center justify-center text-muted hover:text-danger transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {!isCardio && (
                    <div className="flex justify-end mt-0.5 min-h-[20px]">
                      <button
                        type="button"
                        onClick={() => setLibDetailRestPicker({ setIdx: sIdx })}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-muted hover:text-accent active:scale-90 transition-all"
                      >
                        <Timer size={12} />
                        <span className="text-xs font-bold whitespace-nowrap">{set.restTime || DEFAULT_REST}초</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {libDetailSets.length === 0 && (
                <p className="text-center text-xs text-muted py-6">아래 버튼으로 기본 세트를 추가해주세요.</p>
              )}
            </div>

            <div className="shrink-0 px-6 pb-6 pt-2 space-y-2">
              <button type="button" onClick={addLibDetailSet}
                className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:border-muted transition-colors"
              >
                + {isCardio ? "구간 추가" : "세트 추가"}
              </button>
              <button type="button" onClick={saveLibDetail}
                className="w-full py-4 bg-foreground text-background font-bold rounded-xl active:scale-95 transition-transform"
              >
                저장
              </button>
            </div>
          </Drawer>
        );
      })()}

      {/* ── 종목 상세 — 휴식 타이머 설정 ── */}
      <Drawer open={!!libDetailRestPicker} onClose={() => setLibDetailRestPicker(null)} height="auto" zIndex={95}>
        {libDetailRestPicker && (() => {
          const currentRest = libDetailSets[libDetailRestPicker.setIdx]?.restTime || DEFAULT_REST;
          const PRESETS = [30, 60, 90, 120, 150, 180, 210, 240];
          return (
            <div className="px-6 pt-5 pb-8">
              <div className="flex items-center gap-2 mb-1">
                <Timer size={18} className="text-accent" />
                <h3 className="text-base font-bold">세트별 휴식 타이머 설정</h3>
              </div>
              <p className="text-xs text-muted mb-5">
                {libDetailEx?.name} — {libDetailRestPicker.setIdx + 1}세트
              </p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {PRESETS.map((sec) => (
                  <button key={sec} type="button"
                    onClick={() => updateLibDetailSet(libDetailRestPicker.setIdx, "restTime", sec)}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                      currentRest === sec
                        ? "bg-accent text-background border-accent shadow-md shadow-accent/30"
                        : "bg-card border-border text-foreground hover:border-accent"
                    }`}
                  >
                    {sec}초
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 mb-5">
                <button type="button"
                  onClick={() => updateLibDetailSet(libDetailRestPicker.setIdx, "restTime", Math.max(REST_STEP, currentRest - REST_STEP))}
                  disabled={currentRest <= REST_STEP}
                  className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted disabled:opacity-30 active:scale-90"
                >
                  <Minus size={16} />
                </button>
                <span className="text-3xl font-extrabold w-24 text-center text-accent">{currentRest}초</span>
                <button type="button"
                  onClick={() => updateLibDetailSet(libDetailRestPicker.setIdx, "restTime", Math.min(MAX_REST, currentRest + REST_STEP))}
                  disabled={currentRest >= MAX_REST}
                  className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted disabled:opacity-30 active:scale-90"
                >
                  <Plus size={16} />
                </button>
              </div>
              <button type="button"
                onClick={() => setLibDetailRestPicker(null)}
                className="w-full py-4 bg-foreground text-background font-bold rounded-xl active:scale-95 transition-transform"
              >
                확인
              </button>
            </div>
          );
        })()}
      </Drawer>

      {/* ── 종목 상세 — 세트 모드 선택 ── */}
      <Drawer open={!!libDetailModePicker} onClose={() => setLibDetailModePicker(null)} height="auto" zIndex={90}>
        <div className="px-6 pt-5 pb-8">
          <h3 className="text-base font-bold mb-0.5">세트 모드</h3>
          <p className="text-xs text-muted mb-4">
            {libDetailEx?.name ?? ""} — {libDetailModePicker ? libDetailModePicker.setIdx + 1 : 0}세트
          </p>
          <div className="space-y-2">
            {([
              { mode: "weighted" as WeightMode,   label: "가중", desc: "추가 무게를 달고 하는 운동",              color: "text-foreground"  },
              { mode: "bodyweight" as WeightMode,  label: "맨몸", desc: "체중만으로 하는 운동 (무게 미입력)",      color: "text-blue-400"    },
              { mode: "assisted" as WeightMode,    label: "보조", desc: "밴드·머신으로 체중 일부를 보조받는 운동", color: "text-purple-400"  },
            ]).map(({ mode, label, desc, color }) => {
              const isSelected = (libDetailModePicker?.current ?? "weighted") === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => libDetailModePicker && updateLibDetailSetMode(libDetailModePicker.setIdx, mode)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                    isSelected ? "border-accent bg-accent/10" : "border-border bg-card"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "border-accent" : "border-border"
                  }`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-bold ${isSelected ? color : "text-foreground"}`}>{label}</p>
                    <p className="text-xs text-muted mt-0.5">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Drawer>

      {/* ── 세트 모드 선택 Bottom Sheet ── */}
      <Drawer open={!!configSetModePicker} onClose={() => setConfigSetModePicker(null)} height="auto" zIndex={90}>
        <div className="px-6 pt-5 pb-8">
          <h3 className="text-base font-bold mb-0.5">세트 모드</h3>
          <p className="text-xs text-muted mb-4">
            {configSetModePicker
              ? `${exerciseConfigs[configSetModePicker.exIdx]?.name ?? ""} — ${configSetModePicker.setIdx + 1}세트`
              : ""}
          </p>
          <div className="space-y-2">
            {([
              { mode: "weighted" as WeightMode,   label: "가중", desc: "추가 무게를 달고 하는 운동",              color: "text-foreground"  },
              { mode: "bodyweight" as WeightMode,  label: "맨몸", desc: "체중만으로 하는 운동 (무게 미입력)",      color: "text-blue-400"    },
              { mode: "assisted" as WeightMode,    label: "보조", desc: "밴드·머신으로 체중 일부를 보조받는 운동", color: "text-purple-400"  },
            ]).map(({ mode, label, desc, color }) => {
              const isSelected = (configSetModePicker?.current ?? "weighted") === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => configSetModePicker && updateConfigSetMode(configSetModePicker.exIdx, configSetModePicker.setIdx, mode)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                    isSelected ? "border-accent bg-accent/10" : "border-border bg-card"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "border-accent" : "border-border"
                  }`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-bold ${isSelected ? color : "text-foreground"}`}>{label}</p>
                    <p className="text-xs text-muted mt-0.5">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Drawer>
    </main>
  );
}
