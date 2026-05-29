"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit, X, GripVertical, Minus, Search, Check, Copy, Timer, MoreHorizontal, Clock, Flame, Dumbbell, ChevronLeft, Pencil } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { useActiveWorkout } from "@/providers/ActiveWorkoutProvider";
import {
  getRoutines, saveRoutine, deleteRoutine, saveRoutinesOrder,
  getExerciseLibrary, saveExerciseToLibrary, updateExerciseInLibrary, deleteExerciseFromLibrary,
  estimateRoutineCalories, getWorkoutSessions,
} from "@/utils/storage";
import { Routine, RoutineExerciseConfig, RoutineSetTemplate, ExerciseTemplate, ExerciseCategory, WeightMode } from "@/types";

const DEFAULT_REST = 60;
const MAX_REST = 240;
const REST_STEP = 30;

const CATEGORIES: ExerciseCategory[] = ["가슴", "등", "어깨", "팔", "하체", "코어", "유산소", "기타"];

const CAT_COLORS: Record<ExerciseCategory, string> = {
  "가슴": "bg-red-500/20 text-red-400",
  "등":   "bg-blue-500/20 text-blue-400",
  "어깨": "bg-purple-500/20 text-purple-400",
  "팔":   "bg-orange-500/20 text-orange-400",
  "하체": "bg-green-500/20 text-green-400",
  "코어": "bg-yellow-500/20 text-yellow-400",
  "유산소": "bg-cyan-500/20 text-cyan-400",
  "기타": "bg-zinc-500/20 text-zinc-400",
};

export default function RoutinesPage() {
  const router = useRouter();
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

  // ── 소수점 입력을 위한 draft 상태 ──
  const [configInputDrafts, setConfigInputDrafts] = useState<Record<string, string>>({});
  const [libDetailInputDrafts, setLibDetailInputDrafts] = useState<Record<string, string>>({});

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
  const [pickerSelectedSet, setPickerSelectedSet] = useState<Set<string>>(new Set());

  // ── 루틴 카드 ... 메뉴 ──
  const [cardMenuRoutine, setCardMenuRoutine] = useState<Routine | null>(null);

  // ── 루틴 이름 변경 ──
  const [renameRoutine, setRenameRoutine] = useState<Routine | null>(null);
  const [renameNameDraft, setRenameNameDraft] = useState("");

  // ── 인라인 에러 상태 ──
  const [routineAddError, setRoutineAddError] = useState<string | null>(null);
  const [pickerNewNameError, setPickerNewNameError] = useState<string | null>(null);
  const [addExError, setAddExError] = useState<string | null>(null);

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

  // Drawer 열릴 때 draft 초기화
  useEffect(() => { setConfigInputDrafts({}); }, [configExIdx]);
  useEffect(() => { setLibDetailInputDrafts({}); }, [libDetailEx]);

  // ── 루틴 최근 사용순 정렬 ──
  const sortRoutinesByRecentUse = (rList: Routine[]): Routine[] => {
    const sessions = getWorkoutSessions();
    const lastUsed: Record<string, number> = {};
    for (const s of sessions) {
      const t = new Date(s.date).getTime();
      if (!lastUsed[s.routineId] || t > lastUsed[s.routineId]) {
        lastUsed[s.routineId] = t;
      }
    }
    return [...rList].sort((a, b) => {
      const ta = lastUsed[a.id] ?? 0;
      const tb = lastUsed[b.id] ?? 0;
      return tb - ta;
    });
  };

  // ── 마지막 운동 날짜 포맷 ──
  const formatLastDate = (timestamp: number | undefined): string => {
    if (!timestamp) return "기록 없음";
    const diff = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return "오늘";
    if (diff === 1) return "어제";
    if (diff < 7) return `${diff}일 전`;
    if (diff < 30) return `${Math.floor(diff / 7)}주 전`;
    return `${Math.floor(diff / 30)}개월 전`;
  };

  // ── 소요 시간 추정 (분) ──
  const estimateRoutineMinutes = (routine: Routine): number => {
    const configs = routine.exerciseConfigs ?? [];
    if (configs.length === 0) return 0;
    let sec = 0;
    for (const ex of configs) {
      const sets = ex.sets.length > 0 ? ex.sets : [{ restTime: 60 }, { restTime: 60 }, { restTime: 60 }];
      for (const s of sets) sec += 30 + (s.restTime ?? 60);
    }
    return Math.max(1, Math.round(sec / 60));
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
    if (routines.length >= 8) {
      setRoutineAddError("루틴은 최대 8개까지만 생성 가능합니다.");
      setTimeout(() => setRoutineAddError(null), 3000);
      return;
    }
    router.push("/routines/new");
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
  const openRenameModal = (routine: Routine) => {
    setRenameRoutine(routine);
    setRenameNameDraft(routine.name);
  };
  const handleRenameConfirm = () => {
    if (!renameRoutine || !renameNameDraft.trim()) return;
    saveRoutine({ ...renameRoutine, name: renameNameDraft.trim() });
    setRoutines(getRoutines());
    setRenameRoutine(null);
  };
  const handleCopy = (routine: Routine) => {
    if (routines.length >= 8) {
      setRoutineAddError("루틴은 최대 8개까지만 생성 가능합니다.");
      setTimeout(() => setRoutineAddError(null), 3000);
      return;
    }
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
    setPickerSelectedSet(new Set());
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
  const confirmPickerAdd = () => {
    const currentNames = new Set(exerciseConfigs.map((c) => c.name));
    const toAdd = library
      .filter((ex) => pickerSelectedSet.has(ex.id) && !currentNames.has(ex.name))
      .map((ex): RoutineExerciseConfig => ({
        name: ex.name,
        category: ex.category,
        sets: ex.defaultSets ? [...ex.defaultSets] : [],
      }));
    if (toAdd.length > 0) setExerciseConfigs((prev) => [...prev, ...toAdd]);
    setIsPickerOpen(false);
    setPickerTargetIdx(null);
  };

  const handlePickerAddNew = () => {
    if (!pickerNewName.trim()) return;
    const trimmedName = pickerNewName.trim();
    if (library.some((e) => e.name === trimmedName)) {
      setPickerNewNameError("이미 등록된 종목 이름입니다.");
      return;
    }
    setPickerNewNameError(null);
    const newEx: ExerciseTemplate = { id: crypto.randomUUID(), name: trimmedName, category: pickerNewCat };
    saveExerciseToLibrary(newEx);
    setLibrary(getExerciseLibrary());
    if (pickerTargetIdx === -1) {
      const currentNames = new Set(exerciseConfigs.map((c) => c.name));
      if (!currentNames.has(trimmedName)) {
        setExerciseConfigs((prev) => [...prev, { name: trimmedName, category: pickerNewCat, sets: [] }]);
      }
      setIsPickerOpen(false);
      setPickerTargetIdx(null);
    } else {
      handlePickExercise(newEx);
    }
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
    const trimmedName = newExName.trim();
    if (!trimmedName) return;
    if (library.some((e) => e.name === trimmedName)) {
      setAddExError("이미 등록된 종목 이름입니다.");
      return;
    }
    setAddExError(null);
    const newEx: ExerciseTemplate = { id: crypto.randomUUID(), name: trimmedName, category: newExCat };
    saveExerciseToLibrary(newEx);
    setLibrary(getExerciseLibrary());
    setNewExName(""); setIsAddExOpen(false);
  };
  const handleDeleteFromLibrary = (id: string) => {
    if (!confirm("이 종목을 라이브러리에서 삭제하시겠습니까?")) return;
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
            className="p-2 -mr-1 text-muted hover:text-foreground transition-colors"
            aria-label={activeTab === "routines" ? "루틴 추가" : "종목 추가"}
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
              {tab === "routines" ? `루틴 (${routines.length}/8)` : "종목"}
            </button>
          ))}
        </div>
      </header>

      {/* ── 루틴 탭 ── */}
      {activeTab === "routines" && (
        <div className={`flex-1 overflow-y-auto px-4 pt-4 ${isActive ? "pb-24" : "pb-8"}`}>
          {routineAddError && (
            <div className="mb-3 px-4 py-2.5 bg-danger/10 text-danger text-xs font-semibold rounded-xl border border-danger/20">
              {routineAddError}
            </div>
          )}
          {routines.length === 0 ? (
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
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(() => {
                const allSessions = getWorkoutSessions();
                const lastUsedMap: Record<string, number> = {};
                for (const s of allSessions) {
                  const t = new Date(s.date).getTime();
                  if (!lastUsedMap[s.routineId] || t > lastUsedMap[s.routineId]) {
                    lastUsedMap[s.routineId] = t;
                  }
                }
                return sortRoutinesByRecentUse(routines).map((routine) => {
                const kcal = estimateRoutineCalories(routine, userWeight);
                const mins = estimateRoutineMinutes(routine);
                const tSets = routine.exerciseConfigs?.reduce((s, c) => s + c.sets.length, 0) ?? 0;
                const uniqueCats = [...new Set(
                  routine.exerciseConfigs?.map((c) => c.category).filter(Boolean) ?? []
                )].slice(0, 3) as string[];
                return (
                  <div
                    key={routine.id}
                    onClick={() => router.push(`/routines/${routine.id}`)}
                    className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2 cursor-pointer active:scale-[0.97] transition-transform select-none"
                  >
                    {/* 이름 + ... 버튼 */}
                    <div className="flex items-start justify-between gap-1">
                      <h2 className="text-sm font-bold leading-snug flex-1 min-w-0 line-clamp-2">{routine.name}</h2>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCardMenuRoutine(routine); }}
                        className="p-1 -mr-1 -mt-0.5 text-muted hover:text-foreground shrink-0"
                        aria-label="추가 옵션"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>

                    {/* 카테고리 태그 */}
                    {uniqueCats.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {uniqueCats.map((cat) => (
                          <span key={cat} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CAT_COLORS[cat as ExerciseCategory]}`}>
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 통계 */}
                    <div className="flex flex-col gap-1 mt-auto">
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <Dumbbell size={11} className="shrink-0" />
                        <span>{routine.exercises.length}종목</span>
                      </div>
                      {mins > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <Clock size={11} className="shrink-0" />
                          <span>{mins}분</span>
                        </div>
                      )}
                      {kcal > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <Flame size={11} className="shrink-0" />
                          <span>{kcal}kcal</span>
                        </div>
                      )}
                    </div>

                    {/* 세트 수 + 마지막 운동 날짜 */}
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      {tSets > 0 && (
                        <p className="text-[10px] text-muted/70">{tSets}세트</p>
                      )}
                      <p className="text-[10px] text-muted/60 ml-auto">
                        {formatLastDate(lastUsedMap[routine.id])}
                      </p>
                    </div>
                  </div>
                );
              });
              })()}
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
        <header className="shrink-0 border-b border-border px-4 pt-5 pb-3 flex items-center gap-2">
          <button onClick={() => setIsModalOpen(false)} className="p-2 -ml-2 text-muted hover:text-foreground transition-colors">
            <ChevronLeft size={24} />
          </button>
          <input
            type="text"
            value={routineName}
            onChange={(e) => setRoutineName(e.target.value)}
            placeholder={editingId ? "루틴 이름" : "새 루틴 이름"}
            className="flex-1 text-lg font-bold bg-transparent focus:outline-none placeholder:text-muted/50 placeholder:font-normal truncate"
          />
          <button
            type="button"
            onClick={() => openPicker(-1)}
            className="p-2 -mr-1 text-muted hover:text-foreground transition-colors"
            aria-label="종목 추가"
          >
            <Plus size={22} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 pb-2 pt-4 space-y-3">
            <div ref={exerciseListRef} className="divide-y divide-border/50 border border-border/50 rounded-xl overflow-hidden">
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
                  className={`flex items-center gap-2 px-3 py-3 transition-all duration-150 select-none bg-card ${
                    flashExIdx === idx
                      ? "bg-accent/10"
                      : exDragIdx === idx
                      ? "opacity-20"
                      : exDragOverIdx === idx && exDragIdx !== idx
                      ? "bg-accent/10"
                      : ""
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
            {exerciseConfigs.length === 0 && (
              <p className="text-center text-xs text-muted py-6">상단 + 버튼으로 종목을 추가하세요.</p>
            )}
          </div>
          <div className="shrink-0 px-6 pb-6 pt-2 flex gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-muted hover:text-foreground transition-colors">
              취소
            </button>
            <button
              type="submit"
              disabled={!routineName.trim() || exerciseConfigs.filter((c) => c.name.trim()).length === 0}
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

        {pickerTargetIdx === -1 && pickerSelectedSet.size > 0 && (
          <div className="px-6 pb-2 shrink-0">
            <p className="text-xs text-accent font-semibold">{pickerSelectedSet.size}개 선택됨</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 pb-3 space-y-0.5">
          {pickerFiltered.map((ex) => {
            const alreadyAdded = addedNames.has(ex.name);
            const isMulti = pickerTargetIdx === -1;
            const isChosen = pickerSelectedSet.has(ex.id);
            return (
              <button
                key={ex.id}
                onClick={() => {
                  if (isMulti) {
                    if (alreadyAdded) return;
                    setPickerSelectedSet((prev) => {
                      const next = new Set(prev);
                      next.has(ex.id) ? next.delete(ex.id) : next.add(ex.id);
                      return next;
                    });
                  } else {
                    handlePickExercise(ex);
                  }
                }}
                disabled={isMulti && alreadyAdded}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left ${
                  isMulti
                    ? isChosen ? "bg-accent/10" : alreadyAdded ? "opacity-40" : "hover:bg-background active:bg-background"
                    : "hover:bg-background"
                }`}
              >
                {isMulti && (
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isChosen ? "bg-accent border-accent" : alreadyAdded ? "border-border bg-border" : "border-border"
                  }`}>
                    {(isChosen || alreadyAdded) && <Check size={11} className="text-background" strokeWidth={3} />}
                  </div>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${CAT_COLORS[ex.category]}`}>{ex.category}</span>
                <span className="flex-1 text-sm font-medium">{ex.name}</span>
                {isMulti && alreadyAdded && <span className="text-[10px] text-muted shrink-0">추가됨</span>}
                {!isMulti && alreadyAdded && <Check size={15} className="text-accent shrink-0" />}
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
                onChange={(e) => { setPickerNewName(e.target.value); if (pickerNewNameError) setPickerNewNameError(null); }}
                placeholder="종목명 입력"
                className={`w-full bg-background border rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors ${pickerNewNameError ? "border-danger focus:border-danger" : "border-border focus:border-accent"}`}
              />
              {pickerNewNameError && (
                <p className="text-xs text-danger font-medium px-1">{pickerNewNameError}</p>
              )}
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
            <>
              <button
                onClick={() => setShowPickerNewForm(true)}
                className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:border-muted transition-colors"
              >
                + 새 종목 만들기
              </button>
              {pickerTargetIdx === -1 && (
                <button
                  onClick={confirmPickerAdd}
                  disabled={pickerSelectedSet.size === 0}
                  className="w-full mt-2 py-3.5 bg-foreground text-background font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-30"
                >
                  {pickerSelectedSet.size > 0 ? `${pickerSelectedSet.size}개 추가하기` : "종목을 선택하세요"}
                </button>
              )}
            </>
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
          <div className="space-y-1.5">
            <input
              autoFocus
              type="text"
              value={newExName}
              onChange={(e) => { setNewExName(e.target.value); if (addExError) setAddExError(null); }}
              placeholder="종목명 입력"
              className={`w-full bg-background border rounded-xl px-4 py-3 focus:outline-none transition-colors ${addExError ? "border-danger focus:border-danger" : "border-border focus:border-accent"}`}
            />
            {addExError && (
              <p className="text-xs text-danger font-medium px-1">{addExError}</p>
            )}
          </div>
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
                        value={`cw-${sIdx}` in configInputDrafts ? configInputDrafts[`cw-${sIdx}`] : (set.weight || "")}
                        onChange={(e) => setConfigInputDrafts((p) => ({ ...p, [`cw-${sIdx}`]: e.target.value }))}
                        onFocus={(e) => { e.target.select(); setConfigInputDrafts((p) => ({ ...p, [`cw-${sIdx}`]: set.weight > 0 ? String(set.weight) : "" })); }}
                        onBlur={() => {
                          const k = `cw-${sIdx}`;
                          if (k in configInputDrafts) { const n = parseFloat(configInputDrafts[k]); updateConfigSet(configExIdx, sIdx, "weight", isNaN(n) ? 0 : n); setConfigInputDrafts((p) => { const x = {...p}; delete x[k]; return x; }); }
                        }}
                        placeholder="0"
                        className="flex-1 min-w-0 text-center rounded-xl py-2.5 text-lg font-bold bg-background focus:outline-none focus:ring-1 focus:ring-accent text-foreground"
                      />
                    ) : set.weightMode !== "bodyweight" ? (
                      <input type="text" inputMode="decimal"
                        value={`cw-${sIdx}` in configInputDrafts ? configInputDrafts[`cw-${sIdx}`] : (set.weight || "")}
                        onChange={(e) => setConfigInputDrafts((p) => ({ ...p, [`cw-${sIdx}`]: e.target.value }))}
                        onFocus={(e) => { e.target.select(); setConfigInputDrafts((p) => ({ ...p, [`cw-${sIdx}`]: set.weight > 0 ? String(set.weight) : "" })); }}
                        onBlur={() => {
                          const k = `cw-${sIdx}`;
                          if (k in configInputDrafts) { const n = parseFloat(configInputDrafts[k]); updateConfigSet(configExIdx, sIdx, "weight", isNaN(n) ? 0 : n); setConfigInputDrafts((p) => { const x = {...p}; delete x[k]; return x; }); }
                        }}
                        placeholder="0"
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
                      value={`cr-${sIdx}` in configInputDrafts ? configInputDrafts[`cr-${sIdx}`] : (set.reps || "")}
                      onChange={(e) => setConfigInputDrafts((p) => ({ ...p, [`cr-${sIdx}`]: e.target.value }))}
                      onFocus={(e) => { e.target.select(); setConfigInputDrafts((p) => ({ ...p, [`cr-${sIdx}`]: set.reps > 0 ? String(set.reps) : "" })); }}
                      onBlur={() => {
                        const k = `cr-${sIdx}`;
                        if (k in configInputDrafts) { const n = parseFloat(configInputDrafts[k]); updateConfigSet(configExIdx, sIdx, "reps", isNaN(n) ? 0 : n); setConfigInputDrafts((p) => { const x = {...p}; delete x[k]; return x; }); }
                      }}
                      placeholder="0"
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
                        value={`lw-${sIdx}` in libDetailInputDrafts ? libDetailInputDrafts[`lw-${sIdx}`] : (set.weight || "")}
                        onChange={(e) => setLibDetailInputDrafts((p) => ({ ...p, [`lw-${sIdx}`]: e.target.value }))}
                        onFocus={(e) => { e.target.select(); setLibDetailInputDrafts((p) => ({ ...p, [`lw-${sIdx}`]: set.weight > 0 ? String(set.weight) : "" })); }}
                        onBlur={() => {
                          const k = `lw-${sIdx}`;
                          if (k in libDetailInputDrafts) { const n = parseFloat(libDetailInputDrafts[k]); updateLibDetailSet(sIdx, "weight", isNaN(n) ? 0 : n); setLibDetailInputDrafts((p) => { const x = {...p}; delete x[k]; return x; }); }
                        }}
                        placeholder="0"
                        className="flex-1 min-w-0 text-center rounded-xl py-2.5 text-lg font-bold bg-background focus:outline-none focus:ring-1 focus:ring-accent text-foreground"
                      />
                    ) : set.weightMode !== "bodyweight" ? (
                      <input type="text" inputMode="decimal"
                        value={`lw-${sIdx}` in libDetailInputDrafts ? libDetailInputDrafts[`lw-${sIdx}`] : (set.weight || "")}
                        onChange={(e) => setLibDetailInputDrafts((p) => ({ ...p, [`lw-${sIdx}`]: e.target.value }))}
                        onFocus={(e) => { e.target.select(); setLibDetailInputDrafts((p) => ({ ...p, [`lw-${sIdx}`]: set.weight > 0 ? String(set.weight) : "" })); }}
                        onBlur={() => {
                          const k = `lw-${sIdx}`;
                          if (k in libDetailInputDrafts) { const n = parseFloat(libDetailInputDrafts[k]); updateLibDetailSet(sIdx, "weight", isNaN(n) ? 0 : n); setLibDetailInputDrafts((p) => { const x = {...p}; delete x[k]; return x; }); }
                        }}
                        placeholder="0"
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
                      value={`lr-${sIdx}` in libDetailInputDrafts ? libDetailInputDrafts[`lr-${sIdx}`] : (set.reps || "")}
                      onChange={(e) => setLibDetailInputDrafts((p) => ({ ...p, [`lr-${sIdx}`]: e.target.value }))}
                      onFocus={(e) => { e.target.select(); setLibDetailInputDrafts((p) => ({ ...p, [`lr-${sIdx}`]: set.reps > 0 ? String(set.reps) : "" })); }}
                      onBlur={() => {
                        const k = `lr-${sIdx}`;
                        if (k in libDetailInputDrafts) { const n = parseFloat(libDetailInputDrafts[k]); updateLibDetailSet(sIdx, "reps", isNaN(n) ? 0 : n); setLibDetailInputDrafts((p) => { const x = {...p}; delete x[k]; return x; }); }
                      }}
                      placeholder="0"
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

      {/* ── 루틴 카드 ... 메뉴 ── */}
      <Drawer open={!!cardMenuRoutine} onClose={() => setCardMenuRoutine(null)} height="auto" zIndex={60}>
        {cardMenuRoutine && (
          <div className="px-6 pt-4 pb-8">
            <p className="text-base font-bold mb-4 truncate">{cardMenuRoutine.name}</p>
            <div className="space-y-2">
              <button
                onClick={() => { openRenameModal(cardMenuRoutine); setCardMenuRoutine(null); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-background text-foreground font-semibold text-sm active:scale-95 transition-transform"
              >
                <Pencil size={16} />
                루틴 이름 변경
              </button>
              <button
                onClick={() => { router.push(`/routines/${cardMenuRoutine.id}/edit`); setCardMenuRoutine(null); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-background text-foreground font-semibold text-sm active:scale-95 transition-transform"
              >
                <Edit size={16} />
                루틴 수정
              </button>
              <button
                onClick={() => { handleCopy(cardMenuRoutine); setCardMenuRoutine(null); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-background text-foreground font-semibold text-sm active:scale-95 transition-transform"
              >
                <Copy size={16} />
                복사
              </button>
              <button
                onClick={() => { handleDelete(cardMenuRoutine.id); setCardMenuRoutine(null); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-background text-danger font-semibold text-sm active:scale-95 transition-transform"
              >
                <Trash2 size={16} />
                삭제
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── 루틴 이름 변경 Drawer ── */}
      <Drawer open={!!renameRoutine} onClose={() => setRenameRoutine(null)} height="auto" zIndex={70}>
        {renameRoutine && (
          <div className="px-6 pt-4 pb-8">
            <h2 className="text-lg font-bold mb-4">루틴 이름 변경</h2>
            <input
              autoFocus
              type="text"
              value={renameNameDraft}
              onChange={(e) => setRenameNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameConfirm()}
              placeholder="루틴 이름"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:border-accent transition-colors mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRenameRoutine(null)}
                className="flex-1 py-4 font-bold text-muted"
              >
                취소
              </button>
              <button
                onClick={handleRenameConfirm}
                disabled={!renameNameDraft.trim()}
                className="flex-[2] py-4 bg-foreground text-background font-bold rounded-xl disabled:opacity-30"
              >
                확인
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </main>
  );
}
