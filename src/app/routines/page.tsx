"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, Play, Trash2, Edit, X } from "lucide-react";
import { getRoutines, saveRoutine, deleteRoutine } from "@/utils/storage";
import { Routine } from "@/types";

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [routineName, setRoutineName] = useState("");
  const [exercises, setExercises] = useState<string[]>([]);
  const [exerciseInput, setExerciseInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRoutines(getRoutines());
  }, []);

  const openAddModal = () => {
    if (routines.length >= 7) {
      alert("루틴은 최대 7개까지만 생성 가능합니다.");
      return;
    }
    setEditingId(null);
    setRoutineName("");
    setExercises([]);
    setExerciseInput("");
    setIsModalOpen(true);
  };

  const openEditModal = (routine: Routine) => {
    setEditingId(routine.id);
    setRoutineName(routine.name);
    setExercises([...routine.exercises]);
    setExerciseInput("");
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      deleteRoutine(id);
      setRoutines(getRoutines());
    }
  };

  const addExercise = () => {
    const trimmed = exerciseInput.trim();
    if (trimmed && !exercises.includes(trimmed)) {
      setExercises(prev => [...prev, trimmed]);
      setExerciseInput("");
      inputRef.current?.focus();
    }
  };

  const removeExercise = (idx: number) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addExercise();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineName.trim() || exercises.length === 0) return;

    const newRoutine: Routine = {
      id: editingId || crypto.randomUUID(),
      name: routineName,
      exercises,
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
          className="w-10 h-10 bg-foreground text-background rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
          disabled={routines.length >= 7}
        >
          <Plus size={24} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-24">
        {routines.map((routine) => (
          <div key={routine.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm group relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">{routine.name}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => openEditModal(routine)} className="text-muted hover:text-foreground p-1">
                  <Edit size={18} />
                </button>
                <button onClick={() => handleDelete(routine.id)} className="text-muted hover:text-danger p-1">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {routine.exercises.map((ex, idx) => (
                <span key={idx} className="bg-background px-3 py-1 text-xs font-medium rounded-full text-muted border border-border">
                  {ex}
                </span>
              ))}
            </div>

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

      {/* Routine Modal */}
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

              {/* #8: 태그 기반 종목 입력 UI */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted">운동 종목</label>
                
                {/* 등록된 종목 태그 */}
                {exercises.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {exercises.map((ex, idx) => (
                      <span
                        key={idx}
                        className="flex items-center gap-1.5 bg-accent/15 text-accent px-3 py-1.5 text-sm font-medium rounded-full border border-accent/30"
                      >
                        <span className="text-muted text-xs mr-0.5">{idx + 1}</span>
                        {ex}
                        <button
                          type="button"
                          onClick={() => removeExercise(idx)}
                          className="hover:text-danger transition-colors ml-0.5"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* 입력 필드 + 추가 버튼 */}
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={exerciseInput}
                    onChange={(e) => setExerciseInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="종목명 입력 후 Enter 또는 추가"
                    className="flex-1 bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-accent transition-colors text-sm"
                  />
                  <button
                    type="button"
                    onClick={addExercise}
                    disabled={!exerciseInput.trim()}
                    className="px-4 bg-accent text-background rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-30"
                  >
                    추가
                  </button>
                </div>
                <p className="text-[11px] text-muted">종목 이름을 입력하고 Enter 또는 추가 버튼을 눌러주세요.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 font-bold text-muted hover:text-foreground transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={exercises.length === 0}
                  className="flex-1 bg-foreground text-background font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-30"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
