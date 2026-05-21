"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, Play, Trash2, Edit, X, GripVertical, Minus } from "lucide-react";
import { getRoutines, saveRoutine, deleteRoutine, saveRoutinesOrder } from "@/utils/storage";
import { Routine, RoutineExerciseConfig } from "@/types";

const DEFAULT_REST = 60;
const MAX_REST = 240;
const REST_STEP = 30;

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [routineName, setRoutineName] = useState("");
  const [exerciseConfigs, setExerciseConfigs] = useState<RoutineExerciseConfig[]>([{ name: "", sets: [] }]);

  // 세트 설정 서브 모달
  const [configExIdx, setConfigExIdx] = useState<number | null>(null);

  // 종목 리스트 ref (자동 포커스용)
  const exerciseListRef = useRef<HTMLDivElement>(null);

  // 루틴 카드 드래그앤드롭 상태
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchStartIndexRef = useRef<number | null>(null);

  // 종목 드래그앤드롭 상태 (모달 내)
  const [exDragIdx, setExDragIdx] = useState<number | null>(null);
  const [exDragOverIdx, setExDragOverIdx] = useState<number | null>(null);
  const exTouchRef = useRef<number | null>(null);

  useEffect(() => {
    setRoutines(getRoutines());
  }, []);

  // 종목 추가 시 새 인풋 자동 포커스
  useEffect(() => {
    if (!isModalOpen) return;
    if (exerciseConfigs.length > 0 && exerciseConfigs[exerciseConfigs.length - 1].name === "") {
      const inputs = exerciseListRef.current?.querySelectorAll<HTMLInputElement>("input[type=text]");
      if (inputs && inputs.length > 0) inputs[inputs.length - 1].focus();
    }
  }, [exerciseConfigs.length, isModalOpen]);

  // ── 루틴 카드 드래그앤드롭 ──
  const reorderRoutines = (from: number, to: number) => {
    if (from === to) return;
    const next = [...routines];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    saveRoutinesOrder(next);
    setRoutines(next);
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragOverIndex !== idx) setDragOverIndex(idx);
  };
  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex !== null) reorderRoutines(dragIndex, idx);
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleTouchStart = (e: React.TouchEvent, idx: number) => {
    touchStartIndexRef.current = idx;
    setDragIndex(idx);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
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
    if (touchStartIndexRef.current !== null && dragOverIndex !== null)
      reorderRoutines(touchStartIndexRef.current, dragOverIndex);
    touchStartIndexRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ── 종목 리스트 드래그앤드롭 (모달 내) ──
  const reorderExercises = (from: number, to: number) => {
    if (from === to) return;
    const next = [...exerciseConfigs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setExerciseConfigs(next);
  };

  const exDragStart = (idx: number) => (e: React.DragEvent) => {
    setExDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };
  const exDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (exDragOverIdx !== idx) setExDragOverIdx(idx);
  };
  const exDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (exDragIdx !== null) reorderExercises(exDragIdx, idx);
    setExDragIdx(null);
    setExDragOverIdx(null);
  };
  const exDragEnd = () => {
    setExDragIdx(null);
    setExDragOverIdx(null);
  };
  const exTouchStart = (idx: number) => (e: React.TouchEvent) => {
    exTouchRef.current = idx;
    setExDragIdx(idx);
  };
  const exTouchMove = (e: React.TouchEvent) => {
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
    if (exTouchRef.current !== null && exDragOverIdx !== null)
      reorderExercises(exTouchRef.current, exDragOverIdx);
    exTouchRef.current = null;
    setExDragIdx(null);
    setExDragOverIdx(null);
  };

  // ── 종목 CRUD ──
  const updateExercise = (idx: number, value: string) =>
    setExerciseConfigs((prev) => prev.map((c, i) => (i === idx ? { ...c, name: value } : c)));

  const addExercise = () => setExerciseConfigs((prev) => [...prev, { name: "", sets: [] }]);

  const removeExercise = (idx: number) =>
    setExerciseConfigs((prev) => prev.filter((_, i) => i !== idx));

  const handleExerciseKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (idx === exerciseConfigs.length - 1) {
      addExercise();
    } else {
      const inputs = exerciseListRef.current?.querySelectorAll<HTMLInputElement>("input[type=text]");
      if (inputs?.[idx + 1]) inputs[idx + 1].focus();
    }
  };

  // ── 세트 설정 CRUD ──
  const updateConfigSet = (
    exIdx: number,
    setIdx: number,
    field: "weight" | "reps" | "restTime",
    value: number
  ) => {
    setExerciseConfigs((prev) =>
      prev.map((c, i) =>
        i !== exIdx
          ? c
          : { ...c, sets: c.sets.map((s, si) => (si !== setIdx ? s : { ...s, [field]: value })) }
      )
    );
  };

  const addConfigSet = (exIdx: number) => {
    setExerciseConfigs((prev) =>
      prev.map((c, i) => {
        if (i !== exIdx) return c;
        const last = c.sets[c.sets.length - 1];
        return {
          ...c,
          sets: [
            ...c.sets,
            {
              weight: last?.weight ?? 0,
              reps: last?.reps ?? 0,
              restTime: last?.restTime ?? DEFAULT_REST,
            },
          ],
        };
      })
    );
  };

  const removeConfigSet = (exIdx: number, setIdx: number) => {
    setExerciseConfigs((prev) =>
      prev.map((c, i) =>
        i !== exIdx ? c : { ...c, sets: c.sets.filter((_, si) => si !== setIdx) }
      )
    );
  };

  // ── 루틴 모달 ──
  const openAddModal = () => {
    if (routines.length >= 7) { alert("루틴은 최대 7개까지만 생성 가능합니다."); return; }
    setEditingId(null);
    setRoutineName("");
    setExerciseConfigs([{ name: "", sets: [] }]);
    setIsModalOpen(true);
  };

  const openEditModal = (routine: Routine) => {
    setEditingId(routine.id);
    setRoutineName(routine.name);
    const configs = routine.exerciseConfigs
      ? [...routine.exerciseConfigs]
      : routine.exercises.map((name) => ({ name, sets: [] }));
    setExerciseConfigs(configs.length > 0 ? configs : [{ name: "", sets: [] }]);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      deleteRoutine(id);
      setRoutines(getRoutines());
    }
  };

  const validExercises = exerciseConfigs.filter((c) => c.name.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineName.trim() || validExercises.length === 0) return;
    const newRoutine: Routine = {
      id: editingId || crypto.randomUUID(),
      name: routineName,
      exercises: validExercises.map((c) => c.name),
      exerciseConfigs: validExercises,
    };
    saveRoutine(newRoutine);
    setRoutines(getRoutines());
    setIsModalOpen(false);
  };

  return (
    <main className="flex flex-col h-full animate-in fade-in duration-300">
      <header className="px-6 py-6 border-b border-border bg-card sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">루틴 관리</h1>
          <p className="text-sm text-muted mt-1">{routines.length} / 7 개의 루틴</p>
        </div>
        <button
          onClick={openAddModal}
          disabled={routines.length >= 7}
          className="w-10 h-10 bg-foreground text-background rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
        >
          <Plus size={24} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-24">
        {routines.map((routine, idx) => (
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
              dragIndex === idx
                ? "opacity-40 scale-[0.97] border-border"
                : dragOverIndex === idx && dragIndex !== idx
                ? "border-accent scale-[1.02] shadow-lg shadow-accent/10"
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
                <button onClick={() => openEditModal(routine)} className="text-muted hover:text-foreground p-1">
                  <Edit size={18} />
                </button>
                <button onClick={() => handleDelete(routine.id)} className="text-muted hover:text-danger p-1">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            {(() => {
              const tSets = routine.exerciseConfigs?.reduce((s, c) => s + c.sets.length, 0) ?? 0;
              const tVol = routine.exerciseConfigs?.reduce((s, c) =>
                s + c.sets.reduce((v, set) => v + set.weight * set.reps, 0), 0) ?? 0;
              const info = [
                `${routine.exercises.length}종목`,
                ...(tSets > 0 ? [`${tSets}세트`] : []),
                ...(tVol > 0 ? [`${tVol.toLocaleString()}kg 볼륨`] : []),
              ].join(" · ");
              return <p className="text-xs text-muted mb-4 ml-7">{info}</p>;
            })()}

            <Link
              href={`/workout/${routine.id}`}
              className="flex items-center justify-center gap-2 w-full bg-accent text-background font-bold py-3 rounded-xl hover:bg-accent-hover transition-colors active:scale-95"
            >
              <Play size={20} fill="currentColor" />
              운동 시작
            </Link>
          </div>
        ))}

        {routines.length === 0 && (
          <div className="flex flex-col items-center justify-center text-muted h-64 text-center">
            <p>루틴이 없습니다.</p>
            <p className="text-sm mt-1">상단의 + 버튼을 눌러 새 루틴을 만드세요.</p>
          </div>
        )}
      </div>

      {/* 루틴 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in">
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-border p-6 shadow-2xl animate-in slide-in-from-bottom-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingId ? "루틴 수정" : "새 루틴 만들기"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 -mr-2 text-muted hover:text-foreground">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 루틴 이름 */}
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

              {/* 운동 종목 */}
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
                        exDragIdx === idx
                          ? "opacity-40 scale-[0.97]"
                          : exDragOverIdx === idx && exDragIdx !== idx
                          ? "scale-[1.02]"
                          : ""
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

                      <input
                        type="text"
                        value={config.name}
                        onChange={(e) => updateExercise(idx, e.target.value)}
                        onKeyDown={(e) => handleExerciseKeyDown(e, idx)}
                        placeholder={`종목 ${idx + 1}`}
                        className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
                      />

                      {/* 세트 설정 버튼 */}
                      <button
                        type="button"
                        onClick={() => config.name.trim() && setConfigExIdx(idx)}
                        disabled={!config.name.trim()}
                        className={`text-xs px-2 py-1 rounded-lg font-medium shrink-0 transition-colors ${
                          config.sets.length > 0
                            ? "bg-accent/20 text-accent"
                            : "bg-background border border-border text-muted hover:border-accent hover:text-accent"
                        } disabled:opacity-30`}
                      >
                        {config.sets.length > 0 ? `${config.sets.length}세트` : "설정"}
                      </button>

                      <button
                        type="button"
                        onClick={() => removeExercise(idx)}
                        disabled={exerciseConfigs.length <= 1}
                        className="text-muted hover:text-danger disabled:opacity-20 p-1 shrink-0 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addExercise}
                  className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:border-muted transition-colors"
                >
                  + 운동 추가
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 font-bold text-muted hover:text-foreground transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={validExercises.length === 0}
                  className="flex-1 bg-foreground text-background font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-30"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 세트 설정 서브 모달 */}
      {configExIdx !== null && exerciseConfigs[configExIdx] && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[70] flex items-end justify-center animate-in fade-in">
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl border border-border p-6 shadow-2xl max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-lg font-bold">{exerciseConfigs[configExIdx].name}</h3>
              <button
                type="button"
                onClick={() => setConfigExIdx(null)}
                className="p-2 -mr-2 text-muted hover:text-foreground"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-xs text-muted mb-4">
              기본 세트를 설정하면 운동 시작 시 자동으로 적용됩니다.
            </p>

            {/* 세트 목록 */}
            <div className="space-y-2 mb-3">
              {exerciseConfigs[configExIdx].sets.map((set, sIdx) => (
                <div key={sIdx} className="p-3 bg-background rounded-xl border border-border space-y-2">
                  {/* Row 1: 세트번호 + 무게/횟수 + 삭제 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted w-5 text-center shrink-0">{sIdx + 1}</span>
                    <input
                      type="number"
                      value={set.weight || ""}
                      onChange={(e) => updateConfigSet(configExIdx, sIdx, "weight", Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="flex-1 min-w-0 text-center bg-card border border-border rounded-lg px-2 py-2 text-sm font-bold focus:outline-none focus:border-accent"
                    />
                    <span className="text-xs text-muted shrink-0">kg ×</span>
                    <input
                      type="number"
                      value={set.reps || ""}
                      onChange={(e) => updateConfigSet(configExIdx, sIdx, "reps", Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="flex-1 min-w-0 text-center bg-card border border-border rounded-lg px-2 py-2 text-sm font-bold focus:outline-none focus:border-accent"
                    />
                    <span className="text-xs text-muted shrink-0">회</span>
                    <button
                      type="button"
                      onClick={() => removeConfigSet(configExIdx, sIdx)}
                      className="text-muted hover:text-danger p-1 shrink-0 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {/* Row 2: 휴식 시간 */}
                  <div className="flex items-center justify-between pl-6">
                    <span className="text-xs text-muted">휴식</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateConfigSet(configExIdx, sIdx, "restTime", Math.max(REST_STEP, (set.restTime || DEFAULT_REST) - REST_STEP))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border text-muted hover:text-foreground active:scale-90 transition-all"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="text-sm font-bold w-12 text-center">{set.restTime || DEFAULT_REST}초</span>
                      <button
                        type="button"
                        onClick={() => updateConfigSet(configExIdx, sIdx, "restTime", Math.min(MAX_REST, (set.restTime || DEFAULT_REST) + REST_STEP))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border text-muted hover:text-foreground active:scale-90 transition-all"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {exerciseConfigs[configExIdx].sets.length === 0 && (
                <p className="text-center text-xs text-muted py-6">
                  아래 버튼으로 세트를 추가해주세요.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => addConfigSet(configExIdx)}
              className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:border-muted transition-colors mb-4"
            >
              + 세트 추가
            </button>

            <button
              type="button"
              onClick={() => setConfigExIdx(null)}
              className="w-full py-4 bg-foreground text-background font-bold rounded-xl active:scale-95 transition-transform"
            >
              완료
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
