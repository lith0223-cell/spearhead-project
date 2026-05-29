"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  MoreHorizontal,
  GripVertical,
  Plus,
  Play,
  Trash2,
  Search,
  Check,
  X,
} from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { useActiveWorkout } from "@/providers/ActiveWorkoutProvider";
import {
  getRoutines,
  saveRoutine,
  getExerciseLibrary,
  saveExerciseToLibrary,
  estimateRoutineCalories,
} from "@/utils/storage";
import {
  Routine,
  RoutineExerciseConfig,
  ExerciseTemplate,
  ExerciseCategory,
} from "@/types";

const CATEGORIES: ExerciseCategory[] = [
  "가슴", "등", "어깨", "팔", "하체", "코어", "유산소", "기타",
];

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

export default function RoutineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isActive } = useActiveWorkout();
  const routineId = params.routineId as string;

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<RoutineExerciseConfig[]>([]);

  // ── 순서 변경 모드 ──
  const [isReorderMode, setIsReorderMode] = useState(false);
  const reorderSnapshotRef = useRef<RoutineExerciseConfig[]>([]);

  // ── 스와이프 삭제 ──
  const [swipeRevealedIdx, setSwipeRevealedIdx] = useState<number | null>(null);
  const swipeTouchRef = useRef<{
    startX: number;
    startY: number;
    idx: number;
    locked: boolean;
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
  const [library, setLibrary] = useState<ExerciseTemplate[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExCat, setNewExCat] = useState<ExerciseCategory>("기타");

  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate)
      navigator.vibrate(pattern);
  };

  useEffect(() => {
    const routines = getRoutines();
    const found = routines.find((r) => r.id === routineId);
    if (!found) { router.replace("/routines"); return; }
    setRoutine(found);
    setExercises(
      found.exerciseConfigs
        ? [...found.exerciseConfigs]
        : found.exercises.map((name) => ({ name, sets: [] }))
    );
    setLibrary(getExerciseLibrary());
  }, [routineId, router]);

  const persistExercises = useCallback(
    (next: RoutineExerciseConfig[]) => {
      if (!routine) return;
      const updated: Routine = {
        ...routine,
        exercises: next.map((c) => c.name),
        exerciseConfigs: next,
      };
      saveRoutine(updated);
      setRoutine(updated);
      setExercises(next);
    },
    [routine]
  );

  // ── 순서 변경 모드 진입/취소/완료 ──
  const enterReorderMode = () => {
    reorderSnapshotRef.current = exercises.map((ex) => ({ ...ex }));
    setIsReorderMode(true);
    setSwipeRevealedIdx(null);
  };
  const cancelReorderMode = () => {
    persistExercises(reorderSnapshotRef.current);
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
    if (Math.abs(deltaY) > Math.abs(deltaX) + 5) {
      swipeTouchRef.current.locked = true;
      return;
    }

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
    persistExercises(next);
    setFlashIdx(to);
    vibrate([15, 60, 15]);
    setTimeout(() => setFlashIdx(null), 700);
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    vibrate(25);
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  };
  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx !== null) reorder(dragIdx, idx);
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  const handleGripTouchStart = (e: React.TouchEvent, idx: number) => {
    dragTouchRef.current = idx;
    setDragIdx(idx);
    vibrate(25);
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
    dragTouchRef.current = null;
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // ── 단일 삭제 ──
  const deleteSingle = (idx: number) => {
    persistExercises(exercises.filter((_, i) => i !== idx));
    setSwipeRevealedIdx(null);
    setMenuIdx(null);
  };

  // ── 종목 추가 ──
  const openSearch = () => {
    setSearchQuery("");
    setSearchCat("전체");
    setSelectedAddSet(new Set());
    setShowNewForm(false);
    setNewExName("");
    setNewExCat("기타");
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
    if (toAdd.length > 0) persistExercises([...exercises, ...toAdd]);
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
      persistExercises([...exercises, { name: trimmed, category: newExCat, sets: [] }]);
    }
    setIsSearchOpen(false);
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

  if (!routine) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        로딩 중...
      </div>
    );
  }

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
          className="p-2 -ml-2 text-muted hover:text-foreground transition-colors"
          aria-label="뒤로"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-lg font-bold truncate">{routine.name}</h1>
        {!isReorderMode && (
          <button
            onClick={openSearch}
            className="p-2 -mr-1 text-muted hover:text-foreground transition-colors"
            aria-label="종목 추가"
          >
            <Plus size={22} />
          </button>
        )}
        {isReorderMode && (
          <>
            <button
              onClick={cancelReorderMode}
              className="px-3 py-1.5 text-sm font-semibold text-muted transition-colors"
            >
              취소
            </button>
            <button
              onClick={confirmReorderMode}
              className="px-3 py-1.5 text-sm font-semibold text-accent transition-colors"
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
              : isRevealed
              ? -72
              : 0;

          const isDeleteVisible =
            isRevealed ||
            (swipeActiveIdxRef.current === idx && swipeDeltaX < -5);

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
                  if (swipeRevealedIdx !== null) {
                    setSwipeRevealedIdx(null);
                  } else {
                    router.push(`/workout/${routineId}?startIdx=${idx}`);
                  }
                }}
              >
                {/* 순서 변경 모드: drag handle */}
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

                {/* 종목 이름 + 카테고리 뱃지 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate">
                    {config.name}
                  </p>
                  {config.category && (
                    <span
                      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                        CAT_COLORS[config.category]
                      }`}
                    >
                      {config.category}
                    </span>
                  )}
                </div>

                {/* 세트 수 */}
                {config.sets.length > 0 ? (
                  <span className="text-xs font-bold text-accent shrink-0">
                    {config.sets.length}세트
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-muted/60 bg-muted/10 px-2 py-0.5 rounded-full shrink-0">
                    미설정
                  </span>
                )}

                {/* ... 버튼 */}
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

      {/* ── 운동 시작 플로팅 버튼 ── */}
      {!isActive && !isReorderMode && (
        <div className="fixed left-0 right-0 max-w-md mx-auto px-4 pb-2 z-40" style={{ bottom: floatingBottom }}>
          <Link
            href={`/workout/${routineId}`}
            className="flex items-center justify-center gap-2 w-full bg-accent text-background font-bold py-3.5 rounded-2xl shadow-xl shadow-accent/30 hover:bg-accent/90 transition-colors active:scale-[0.97]"
          >
            <Play size={18} fill="currentColor" />
            시작하기
          </Link>
        </div>
      )}

      {/* ── per-item ... 메뉴 ── */}
      <Drawer
        open={menuIdx !== null && menuIdx >= 0}
        onClose={() => setMenuIdx(null)}
        height="auto"
        zIndex={70}
      >
        {menuIdx !== null && menuIdx >= 0 && exercises[menuIdx] && (
          <div className="px-6 pt-4 pb-8">
            <p className="text-base font-bold mb-1">{exercises[menuIdx].name}</p>
            {exercises[menuIdx].category && (
              <span
                className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-4 ${
                  CAT_COLORS[exercises[menuIdx].category!]
                }`}
              >
                {exercises[menuIdx].category}
              </span>
            )}
            <div className="space-y-2">
              <button
                onClick={() => {
                  enterReorderMode();
                  setMenuIdx(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-background text-foreground font-semibold text-sm active:scale-95 transition-transform"
              >
                <GripVertical size={16} />
                순서 변경
              </button>
            </div>
          </div>
        )}
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
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isChosen ? "bg-accent border-accent" : alreadyAdded ? "border-border bg-border" : "border-border"
                  }`}
                >
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
