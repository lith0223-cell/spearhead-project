"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, MoreHorizontal, GripVertical, Plus, Trash2,
  Search, Check, X, Timer, Minus,
} from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { useActiveWorkout } from "@/providers/ActiveWorkoutProvider";
import {
  getRoutines, saveRoutine, getExerciseLibrary, saveExerciseToLibrary,
} from "@/utils/storage";
import {
  Routine, RoutineExerciseConfig,
  ExerciseTemplate, ExerciseCategory, WeightMode,
} from "@/types";

const CATEGORIES: ExerciseCategory[] = ["가슴", "등", "어깨", "팔", "하체", "코어", "유산소", "기타"];

const CAT_COLORS: Record<ExerciseCategory, string> = {
  가슴: "bg-red-500/20 text-red-400",
  등: "bg-blue-500/20 text-blue-400",
  어깨: "bg-purple-500/20 text-purple-400",
  팔: "bg-orange-500/20 text-orange-400",
  하체: "bg-green-500/20 text-green-400",
  코어: "bg-yellow-500/20 text-yellow-400",
  유산소: "bg-cyan-500/20 text-cyan-400",
  기타: "bg-zinc-500/20 text-zinc-400",
};

const DEFAULT_REST = 60;
const MAX_REST = 240;
const REST_STEP = 30;

export default function RoutineNewPage() {
  const router = useRouter();
  const { isActive } = useActiveWorkout();

  const [routineName, setRoutineName] = useState("");
  const [exercises, setExercises] = useState<RoutineExerciseConfig[]>([]);
  const [library, setLibrary] = useState<ExerciseTemplate[]>([]);
  const [limitError, setLimitError] = useState<string | null>(null);

  // ── 순서 변경 모드 ──
  const [isReorderMode, setIsReorderMode] = useState(false);
  const reorderSnapshotRef = useRef<RoutineExerciseConfig[]>([]);

  // ── 스와이프 삭제 ──
  const [swipeRevealedIdx, setSwipeRevealedIdx] = useState<number | null>(null);
  const swipeTouchRef = useRef<{
    startX: number; startY: number; idx: number; locked: boolean;
  } | null>(null);
  const [swipeDeltaX, setSwipeDeltaX] = useState(0);
  const swipeActiveIdxRef = useRef<number | null>(null);

  // ── 드래그 순서 변경 ──
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const dragTouchRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── per-item ... 메뉴 ──
  const [menuIdx, setMenuIdx] = useState<number | null>(null);

  // ── 종목 추가 검색 Drawer ──
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCat, setSearchCat] = useState<ExerciseCategory | "전체">("전체");
  const [selectedAddSet, setSelectedAddSet] = useState<Set<string>>(new Set());
  const [showNewForm, setShowNewForm] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExCat, setNewExCat] = useState<ExerciseCategory>("기타");

  // ── 세트 설정 Drawer ──
  const [configExIdx, setConfigExIdx] = useState<number | null>(null);
  const [configInputDrafts, setConfigInputDrafts] = useState<Record<string, string>>({});
  const [configSetModePicker, setConfigSetModePicker] = useState<{
    exIdx: number; setIdx: number; current: WeightMode;
  } | null>(null);
  const [configRestPickerState, setConfigRestPickerState] = useState<{
    exIdx: number; setIdx: number;
  } | null>(null);

  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
  };

  useEffect(() => {
    setLibrary(getExerciseLibrary());
    // 루틴 최대 개수 체크
    const routines = getRoutines();
    if (routines.length >= 8) {
      setLimitError("루틴은 최대 8개까지만 생성 가능합니다.");
    }
  }, []);

  useEffect(() => { setConfigInputDrafts({}); }, [configExIdx]);

  // ── 저장 ──
  const handleSave = () => {
    if (!routineName.trim()) return;
    const valid = exercises.filter((c) => c.name.trim());
    if (valid.length === 0) return;
    const routines = getRoutines();
    if (routines.length >= 8) {
      setLimitError("루틴은 최대 8개까지만 생성 가능합니다.");
      return;
    }
    const newRoutine: Routine = {
      id: crypto.randomUUID(),
      name: routineName.trim(),
      exercises: valid.map((c) => c.name),
      exerciseConfigs: valid,
    };
    saveRoutine(newRoutine);
    router.replace("/routines");
  };

  // ── 순서 변경 모드 ──
  const enterReorderMode = () => {
    reorderSnapshotRef.current = exercises.map((ex) => ({ ...ex }));
    setIsReorderMode(true);
    setSwipeRevealedIdx(null);
  };
  const cancelReorderMode = () => {
    setExercises(reorderSnapshotRef.current);
    setIsReorderMode(false);
  };
  const confirmReorderMode = () => setIsReorderMode(false);

  // ── 스와이프 핸들러 ──
  const handleSwipeTouchStart = (e: React.TouchEvent, idx: number) => {
    if (isReorderMode || dragIdx !== null) return;
    swipeTouchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      idx,
      locked: false,
    };
    swipeActiveIdxRef.current = idx;
  };
  const handleSwipeTouchMove = (e: React.TouchEvent, idx: number) => {
    if (!swipeTouchRef.current || swipeTouchRef.current.idx !== idx) return;
    if (swipeTouchRef.current.locked) return;
    const deltaX = e.touches[0].clientX - swipeTouchRef.current.startX;
    const deltaY = e.touches[0].clientY - swipeTouchRef.current.startY;
    if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return;
    if (Math.abs(deltaY) > Math.abs(deltaX) + 5) { swipeTouchRef.current.locked = true; return; }
    e.preventDefault();
    if (deltaX < 0) setSwipeDeltaX(Math.max(-72, deltaX));
  };
  const handleSwipeTouchEnd = (idx: number) => {
    if (!swipeTouchRef.current || swipeTouchRef.current.idx !== idx) return;
    if (!swipeTouchRef.current.locked && swipeDeltaX < -50) {
      setSwipeRevealedIdx(idx);
    } else {
      setSwipeRevealedIdx(null);
    }
    swipeTouchRef.current = null;
    swipeActiveIdxRef.current = null;
    setSwipeDeltaX(0);
  };

  // ── 드래그 핸들러 ──
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...exercises];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setExercises(next);
    setFlashIdx(to);
    vibrate([15, 60, 15]);
    setTimeout(() => setFlashIdx(null), 700);
  };
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; vibrate(25);
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault(); if (dragOverIdx !== idx) setDragOverIdx(idx);
  };
  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault(); if (dragIdx !== null) reorder(dragIdx, idx);
    setDragIdx(null); setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };
  const handleGripTouchStart = (e: React.TouchEvent, idx: number) => {
    dragTouchRef.current = idx; setDragIdx(idx); vibrate(25);
  };
  const handleGripTouchMove = (e: React.TouchEvent) => {
    if (dragTouchRef.current === null) return;
    const touch = e.touches[0];
    const els = listRef.current?.querySelectorAll("[data-ex-idx]") ?? [];
    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const over = parseInt(el.getAttribute("data-ex-idx") ?? "-1");
        if (over >= 0 && over !== dragOverIdx) setDragOverIdx(over);
      }
    });
  };
  const handleGripTouchEnd = () => {
    if (dragTouchRef.current === null) return;
    if (dragOverIdx !== null) reorder(dragTouchRef.current, dragOverIdx);
    dragTouchRef.current = null; setDragIdx(null); setDragOverIdx(null);
  };

  // ── 단일 삭제 ──
  const deleteSingle = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
    setSwipeRevealedIdx(null);
    setMenuIdx(null);
  };

  // ── 종목 추가 ──
  const openSearch = () => {
    setSearchQuery(""); setSearchCat("전체");
    setSelectedAddSet(new Set());
    setShowNewForm(false); setNewExName(""); setNewExCat("기타");
    setIsSearchOpen(true);
  };
  const toggleAddSelect = (id: string) => {
    setSelectedAddSet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const confirmAdd = () => {
    const existingNames = new Set(exercises.map((c) => c.name));
    const libMap = new Map(library.map((ex) => [ex.id, ex]));
    const toAdd = [...selectedAddSet]
      .map((id) => libMap.get(id))
      .filter((ex): ex is ExerciseTemplate => !!ex && !existingNames.has(ex.name))
      .map((ex) => ({
        name: ex.name,
        category: ex.category,
        sets: ex.defaultSets ? [...ex.defaultSets] : [],
      }));
    if (toAdd.length > 0) setExercises((prev) => [...prev, ...toAdd]);
    setIsSearchOpen(false);
  };
  const handleCreateAndAdd = () => {
    const trimmed = newExName.trim();
    if (!trimmed) return;
    if (library.some((e) => e.name === trimmed)) { alert("이미 등록된 종목 이름입니다."); return; }
    const newEx: ExerciseTemplate = { id: crypto.randomUUID(), name: trimmed, category: newExCat };
    saveExerciseToLibrary(newEx);
    const updated = getExerciseLibrary();
    setLibrary(updated);
    const existingNames = new Set(exercises.map((c) => c.name));
    if (!existingNames.has(trimmed)) {
      setExercises((prev) => [...prev, { name: trimmed, category: newExCat, sets: [] }]);
    }
    setIsSearchOpen(false);
  };

  // ── 세트 설정 CRUD ──
  const updateConfigSet = (
    exIdx: number, setIdx: number,
    field: "weight" | "reps" | "restTime", value: number
  ) => {
    setExercises((prev) =>
      prev.map((c, i) =>
        i !== exIdx ? c : { ...c, sets: c.sets.map((s, si) => si !== setIdx ? s : { ...s, [field]: value }) }
      )
    );
  };
  const updateConfigSetMode = (exIdx: number, setIdx: number, mode: WeightMode) => {
    setExercises((prev) =>
      prev.map((c, i) =>
        i !== exIdx ? c : {
          ...c,
          sets: c.sets.map((s, si) =>
            si !== setIdx ? s : { ...s, weightMode: mode, weight: mode === "bodyweight" ? 0 : s.weight }
          ),
        }
      )
    );
    setConfigSetModePicker(null);
  };
  const addConfigSet = (exIdx: number) => {
    setExercises((prev) => prev.map((c, i) => {
      if (i !== exIdx) return c;
      const last = c.sets[c.sets.length - 1];
      return {
        ...c, sets: [...c.sets, {
          weight: last?.weightMode === "bodyweight" ? 0 : (last?.weight ?? 0),
          reps: last?.reps ?? 0,
          restTime: last?.restTime ?? DEFAULT_REST,
          weightMode: last?.weightMode,
        }],
      };
    }));
  };
  const removeConfigSet = (exIdx: number, setIdx: number) => {
    setExercises((prev) => prev.map((c, i) => {
      if (i !== exIdx) return c;
      if (c.sets.length <= 1) return c;
      return { ...c, sets: c.sets.filter((_, si) => si !== setIdx) };
    }));
  };

  const sortByCategory = (a: ExerciseTemplate, b: ExerciseTemplate) =>
    CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);

  const filteredLibrary = library
    .filter((ex) => {
      const matchCat = searchCat === "전체" || ex.category === searchCat;
      return matchCat && ex.name.includes(searchQuery);
    })
    .sort(searchCat === "전체" ? sortByCategory : () => 0);

  const existingNames = new Set(exercises.map((c) => c.name));
  const floatingBottom = isActive
    ? "calc(8rem + env(safe-area-inset-bottom, 0px))"
    : "calc(5.5rem + env(safe-area-inset-bottom, 0px))";

  return (
    <main
      className="flex flex-col h-full animate-in fade-in duration-300"
      onClick={() => { if (swipeRevealedIdx !== null) setSwipeRevealedIdx(null); }}
    >
      {/* ── 헤더 ── */}
      <header className="shrink-0 bg-card border-b border-border px-4 pt-5 pb-3 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-muted hover:text-foreground transition-colors shrink-0"
          aria-label="뒤로"
        >
          <ChevronLeft size={24} />
        </button>
        <input
          type="text"
          value={routineName}
          onChange={(e) => setRoutineName(e.target.value)}
          placeholder="루틴 이름 입력"
          autoFocus
          className="flex-1 min-w-0 text-lg font-bold bg-transparent focus:outline-none placeholder:text-muted/50 placeholder:font-normal truncate"
        />
        {!isReorderMode && (
          <button
            onClick={openSearch}
            className="p-2 -mr-1 text-muted hover:text-foreground transition-colors shrink-0"
            aria-label="종목 추가"
          >
            <Plus size={22} />
          </button>
        )}
        {isReorderMode && (
          <>
            <button
              onClick={cancelReorderMode}
              className="px-3 py-1.5 text-sm font-semibold text-muted transition-colors shrink-0"
            >
              취소
            </button>
            <button
              onClick={confirmReorderMode}
              className="px-3 py-1.5 text-sm font-semibold text-accent transition-colors shrink-0"
            >
              완료
            </button>
          </>
        )}
      </header>

      {/* 순서 변경 모드 안내 배너 */}
      {isReorderMode && (
        <div className="shrink-0 bg-accent/10 border-b border-accent/20 px-4 py-2 flex items-center gap-2">
          <GripVertical size={13} className="text-accent shrink-0" />
          <p className="text-xs font-medium text-accent">드래그하여 순서를 변경하세요</p>
        </div>
      )}

      {/* 에러 메시지 */}
      {limitError && (
        <div className="mx-4 mt-3 px-4 py-2.5 bg-danger/10 text-danger text-xs font-semibold rounded-xl border border-danger/20">
          {limitError}
        </div>
      )}

      {/* ── 종목 리스트 ── */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto pb-28"
        onTouchMove={handleGripTouchMove}
        onTouchEnd={handleGripTouchEnd}
      >
        {exercises.length === 0 && (
          <div className="flex items-center justify-center h-48 text-muted text-sm">
            <p>상단 + 버튼으로 종목을 추가하세요.</p>
          </div>
        )}

        {exercises.map((config, idx) => {
          const isRevealed = !isReorderMode && swipeRevealedIdx === idx;
          const isDragging = dragIdx === idx;
          const isDragOver = dragOverIdx === idx && dragIdx !== idx;
          const isFlash = flashIdx === idx;

          const translateX =
            swipeActiveIdxRef.current === idx && swipeDeltaX < 0 && !isReorderMode
              ? swipeDeltaX
              : isRevealed ? -72 : 0;

          const isDeleteVisible =
            isRevealed || (swipeActiveIdxRef.current === idx && swipeDeltaX < -5);

          return (
            <div
              key={idx}
              data-ex-idx={idx}
              className={`relative overflow-hidden transition-colors duration-150 ${
                isFlash ? "drop-bounce bg-accent/10" : isDragOver ? "bg-accent/10" : ""
              } ${isDragging ? "opacity-40 scale-[1.02] shadow-xl z-10" : ""}`}
              draggable={isReorderMode}
              onDragStart={(e) => isReorderMode && handleDragStart(e, idx)}
              onDragOver={(e) => isReorderMode && handleDragOver(e, idx)}
              onDrop={(e) => isReorderMode && handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
            >
              {/* 스와이프 삭제 버튼 */}
              <div
                className={`absolute right-0 top-0 bottom-0 w-[72px] flex items-center justify-center bg-danger transition-opacity duration-150 ${
                  isDeleteVisible ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <button
                  onClick={() => deleteSingle(idx)}
                  className="flex flex-col items-center gap-0.5 text-white active:opacity-80"
                >
                  <Trash2 size={18} />
                  <span className="text-[10px] font-bold">삭제</span>
                </button>
              </div>

              {/* 아이템 본체 */}
              <div
                style={{
                  transform: `translateX(${translateX}px)`,
                  transition: swipeDeltaX !== 0 ? "none" : "transform 0.2s ease",
                }}
                className="relative flex items-center gap-3 px-4 py-4 bg-card select-none"
                onTouchStart={(e) => !isReorderMode && handleSwipeTouchStart(e, idx)}
                onTouchMove={(e) => !isReorderMode && handleSwipeTouchMove(e, idx)}
                onTouchEnd={() => !isReorderMode && handleSwipeTouchEnd(idx)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isReorderMode) return;
                  if (swipeRevealedIdx !== null) { setSwipeRevealedIdx(null); return; }
                  setConfigExIdx(idx);
                }}
              >
                {isReorderMode && (
                  <button
                    className="text-muted cursor-grab active:cursor-grabbing touch-none shrink-0 p-0.5"
                    onTouchStart={(e) => { e.stopPropagation(); handleGripTouchStart(e, idx); }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="순서 변경"
                  >
                    <GripVertical size={17} />
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate">{config.name}</p>
                  {config.category && (
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${CAT_COLORS[config.category]}`}>
                      {config.category}
                    </span>
                  )}
                </div>

                {config.sets.length > 0 ? (
                  <span className="text-xs font-bold text-accent shrink-0">
                    {config.sets.length}세트
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-muted/60 bg-muted/10 px-2 py-0.5 rounded-full shrink-0">
                    미설정
                  </span>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); setMenuIdx(idx); }}
                  className="p-1.5 -mr-1 text-muted hover:text-foreground transition-colors shrink-0"
                  aria-label="더보기"
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 저장 플로팅 버튼 ── */}
      {!isReorderMode && (
        <div className="fixed left-0 right-0 max-w-md mx-auto px-4 pb-2 z-40" style={{ bottom: floatingBottom }}>
          <button
            onClick={handleSave}
            disabled={!routineName.trim() || exercises.filter((c) => c.name.trim()).length === 0}
            className="w-full bg-accent text-background font-bold py-3.5 rounded-2xl shadow-xl shadow-accent/30 hover:bg-accent/90 transition-colors active:scale-[0.97] disabled:opacity-30"
          >
            저장
          </button>
        </div>
      )}

      {/* ── per-item ... 메뉴 ── */}
      <Drawer open={menuIdx !== null && menuIdx >= 0} onClose={() => setMenuIdx(null)} height="auto" zIndex={70}>
        {menuIdx !== null && menuIdx >= 0 && exercises[menuIdx] && (
          <div className="px-6 pt-4 pb-8">
            <p className="text-base font-bold mb-1">{exercises[menuIdx].name}</p>
            {exercises[menuIdx].category && (
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-4 ${CAT_COLORS[exercises[menuIdx].category!]}`}>
                {exercises[menuIdx].category}
              </span>
            )}
            <div className="space-y-2">
              <button
                onClick={() => { enterReorderMode(); setMenuIdx(null); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-background text-foreground font-semibold text-sm active:scale-95 transition-transform"
              >
                <GripVertical size={16} />
                순서 변경
              </button>
              <button
                onClick={() => deleteSingle(menuIdx)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-background text-danger font-semibold text-sm active:scale-95 transition-transform"
              >
                <Trash2 size={16} />
                삭제
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── 세트 설정 Drawer ── */}
      {configExIdx !== null && exercises[configExIdx] && (() => {
        const ex = exercises[configExIdx];
        const isCardio = ex.category === "유산소";
        return (
          <Drawer open={true} onClose={() => setConfigExIdx(null)} height="82vh" zIndex={80}>
            <div className="flex justify-between items-center px-6 pt-3 pb-1 shrink-0">
              <h3 className="text-lg font-bold">{ex.name}</h3>
              <button type="button" onClick={() => setConfigExIdx(null)} className="p-2 -mr-2 text-muted hover:text-foreground">
                <X size={24} />
              </button>
            </div>
            <p className="text-xs text-muted px-6 pb-3 shrink-0">
              기본 세트를 설정하면 운동 시작 시 자동으로 적용됩니다.
            </p>

            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
              {ex.sets.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-10 text-center text-xs font-medium text-muted">{isCardio ? "구간" : "세트"}</span>
                  <span className="flex-1 text-center text-xs font-medium text-muted">{isCardio ? "거리(km)" : "무게(kg)"}</span>
                  <span className="flex-1 text-center text-xs font-medium text-muted">{isCardio ? "시간(분)" : "횟수"}</span>
                  <span className="w-8" />
                </div>
              )}

              {ex.sets.map((set, sIdx) => (
                <div key={sIdx} className="mb-2">
                  <div className="flex items-center gap-2 py-0.5">
                    {!isCardio ? (
                      <button
                        type="button"
                        onClick={() => setConfigSetModePicker({ exIdx: configExIdx, setIdx: sIdx, current: set.weightMode ?? "weighted" })}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold shrink-0 transition-all active:scale-90 ${
                          set.weightMode === "bodyweight" ? "bg-blue-500/15 text-blue-400"
                            : set.weightMode === "assisted" ? "bg-purple-500/15 text-purple-400"
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
                        value={`cw-${sIdx}` in configInputDrafts ? configInputDrafts[`cw-${sIdx}`] : (set.weight || "")}
                        onChange={(e) => setConfigInputDrafts((p) => ({ ...p, [`cw-${sIdx}`]: e.target.value }))}
                        onFocus={(e) => { e.target.select(); setConfigInputDrafts((p) => ({ ...p, [`cw-${sIdx}`]: set.weight > 0 ? String(set.weight) : "" })); }}
                        onBlur={() => {
                          const k = `cw-${sIdx}`;
                          if (k in configInputDrafts) { const n = parseFloat(configInputDrafts[k]); updateConfigSet(configExIdx, sIdx, "weight", isNaN(n) ? 0 : n); setConfigInputDrafts((p) => { const x = { ...p }; delete x[k]; return x; }); }
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
                          if (k in configInputDrafts) { const n = parseFloat(configInputDrafts[k]); updateConfigSet(configExIdx, sIdx, "weight", isNaN(n) ? 0 : n); setConfigInputDrafts((p) => { const x = { ...p }; delete x[k]; return x; }); }
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
                      value={`cr-${sIdx}` in configInputDrafts ? configInputDrafts[`cr-${sIdx}`] : (set.reps || "")}
                      onChange={(e) => setConfigInputDrafts((p) => ({ ...p, [`cr-${sIdx}`]: e.target.value }))}
                      onFocus={(e) => { e.target.select(); setConfigInputDrafts((p) => ({ ...p, [`cr-${sIdx}`]: set.reps > 0 ? String(set.reps) : "" })); }}
                      onBlur={() => {
                        const k = `cr-${sIdx}`;
                        if (k in configInputDrafts) { const n = parseFloat(configInputDrafts[k]); updateConfigSet(configExIdx, sIdx, "reps", isNaN(n) ? 0 : n); setConfigInputDrafts((p) => { const x = { ...p }; delete x[k]; return x; }); }
                      }}
                      placeholder="0"
                      className="flex-1 min-w-0 text-center rounded-xl py-2.5 text-lg font-bold bg-background focus:outline-none focus:ring-1 focus:ring-accent text-foreground"
                    />

                    <button type="button"
                      onClick={() => removeConfigSet(configExIdx, sIdx)}
                      disabled={ex.sets.length <= 1}
                      className="w-8 h-8 flex items-center justify-center text-muted hover:text-danger transition-colors shrink-0 disabled:opacity-20"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {!isCardio && (
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

              {ex.sets.length === 0 && (
                <p className="text-center text-xs text-muted py-6">아래 버튼으로 세트를 추가해주세요.</p>
              )}
            </div>

            <div className="shrink-0 px-6 pb-6 pt-2 space-y-2">
              <button type="button" onClick={() => addConfigSet(configExIdx)}
                className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:border-muted transition-colors"
              >
                + {isCardio ? "구간 추가" : "세트 추가"}
              </button>
              <button type="button" onClick={() => setConfigExIdx(null)}
                className="w-full py-4 bg-foreground text-background font-bold rounded-xl active:scale-95 transition-transform"
              >
                완료
              </button>
            </div>
          </Drawer>
        );
      })()}

      {/* ── 세트 휴식 타이머 설정 ── */}
      <Drawer open={!!configRestPickerState} onClose={() => setConfigRestPickerState(null)} height="auto" zIndex={95}>
        {configRestPickerState && (() => {
          const currentRest =
            exercises[configRestPickerState.exIdx]?.sets[configRestPickerState.setIdx]?.restTime || DEFAULT_REST;
          const PRESETS = [30, 60, 90, 120, 150, 180, 210, 240];
          return (
            <div className="px-6 pt-5 pb-8">
              <div className="flex items-center gap-2 mb-1">
                <Timer size={18} className="text-accent" />
                <h3 className="text-base font-bold">세트별 휴식 타이머 설정</h3>
              </div>
              <p className="text-xs text-muted mb-5">
                {exercises[configRestPickerState.exIdx]?.name} — {configRestPickerState.setIdx + 1}세트
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

      {/* ── 세트 모드 선택 ── */}
      <Drawer open={!!configSetModePicker} onClose={() => setConfigSetModePicker(null)} height="auto" zIndex={90}>
        <div className="px-6 pt-5 pb-8">
          <h3 className="text-base font-bold mb-0.5">세트 모드</h3>
          <p className="text-xs text-muted mb-4">
            {configSetModePicker
              ? `${exercises[configSetModePicker.exIdx]?.name ?? ""} — ${configSetModePicker.setIdx + 1}세트`
              : ""}
          </p>
          <div className="space-y-2">
            {([
              { mode: "weighted" as WeightMode, label: "가중", desc: "추가 무게를 달고 하는 운동", color: "text-foreground" },
              { mode: "bodyweight" as WeightMode, label: "맨몸", desc: "체중만으로 하는 운동 (무게 미입력)", color: "text-blue-400" },
              { mode: "assisted" as WeightMode, label: "보조", desc: "밴드·머신으로 체중 일부를 보조받는 운동", color: "text-purple-400" },
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

      {/* ── 종목 추가 검색 Drawer ── */}
      <Drawer open={isSearchOpen} onClose={() => setIsSearchOpen(false)} height="88vh" zIndex={70}>
        <div className="flex justify-between items-center px-5 pt-4 pb-3 shrink-0">
          <h3 className="text-lg font-bold">종목 추가</h3>
          <button onClick={() => setIsSearchOpen(false)} className="p-2 -mr-2 text-muted hover:text-foreground">
            <X size={22} />
          </button>
        </div>

        <div className="px-5 pb-3 shrink-0">
          <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2.5">
            <Search size={15} className="text-muted shrink-0" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="종목 검색..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-muted"><X size={14} /></button>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-3 overflow-x-auto scrollbar-none shrink-0">
          {(["전체", ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSearchCat(cat as typeof searchCat)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                searchCat === cat
                  ? "bg-accent text-background border-accent"
                  : "bg-card border-border text-muted"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {selectedAddSet.size > 0 && (
          <div className="px-5 pb-2 shrink-0">
            <p className="text-xs text-accent font-semibold">{selectedAddSet.size}개 선택됨</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-0.5">
          {filteredLibrary.map((ex) => {
            const alreadyAdded = existingNames.has(ex.name);
            const isChosen = selectedAddSet.has(ex.id);
            return (
              <button
                key={ex.id}
                onClick={() => !alreadyAdded && toggleAddSelect(ex.id)}
                disabled={alreadyAdded}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left ${
                  isChosen ? "bg-accent/10" : alreadyAdded ? "opacity-40" : "hover:bg-background active:bg-background"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isChosen ? "bg-accent border-accent" : alreadyAdded ? "border-border bg-border" : "border-border"
                }`}>
                  {(isChosen || alreadyAdded) && <Check size={11} className="text-background" strokeWidth={3} />}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${CAT_COLORS[ex.category]}`}>
                  {ex.category}
                </span>
                <span className="flex-1 text-sm font-medium truncate">{ex.name}</span>
                {alreadyAdded && <span className="text-[10px] text-muted shrink-0">추가됨</span>}
              </button>
            );
          })}
          {filteredLibrary.length === 0 && !showNewForm && (
            <p className="text-center text-muted text-sm py-8">검색 결과 없음</p>
          )}
        </div>

        <div className="shrink-0 px-5 pt-2 pb-6 border-t border-border space-y-2">
          {showNewForm ? (
            <div className="space-y-2">
              <input
                autoFocus
                type="text"
                value={newExName}
                onChange={(e) => setNewExName(e.target.value)}
                placeholder="종목명 입력"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNewExCat(cat)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      newExCat === cat ? "bg-accent text-background border-accent" : "bg-background border-border text-muted"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewForm(false)} className="flex-1 py-2.5 text-sm font-bold text-muted">취소</button>
                <button
                  onClick={handleCreateAndAdd}
                  disabled={!newExName.trim()}
                  className="flex-[2] py-2.5 bg-foreground text-background text-sm font-bold rounded-xl disabled:opacity-30"
                >
                  추가
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowNewForm(true)}
                className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:border-muted transition-colors"
              >
                + 새 종목 만들기
              </button>
              <button
                onClick={confirmAdd}
                disabled={selectedAddSet.size === 0}
                className="w-full py-3.5 bg-foreground text-background font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-30"
              >
                {selectedAddSet.size > 0 ? `${selectedAddSet.size}개 추가하기` : "종목을 선택하세요"}
              </button>
            </>
          )}
        </div>
      </Drawer>
    </main>
  );
}
