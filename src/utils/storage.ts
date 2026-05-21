import { DietRecord, MealItem, MealType, Routine, WorkoutSession } from "@/types";
import { DUMMY_DIET_RECORDS, DUMMY_ROUTINES, DUMMY_WORKOUT_SESSIONS } from "./dummyData";

const STORAGE_KEYS = {
  ROUTINES: "ph_routines",
  SESSIONS: "ph_sessions",
  DIETS: "ph_diets",
  HAS_INITIALIZED: "ph_initialized",
};

// --- Initialization ---
export const initializeDummyData = () => {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(STORAGE_KEYS.HAS_INITIALIZED)) {
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(DUMMY_ROUTINES));
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(DUMMY_WORKOUT_SESSIONS));
    localStorage.setItem(STORAGE_KEYS.DIETS, JSON.stringify(DUMMY_DIET_RECORDS));
    localStorage.setItem(STORAGE_KEYS.HAS_INITIALIZED, "true");
  }
};

// --- Routines ---
export const getRoutines = (): Routine[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEYS.ROUTINES);
  return data ? JSON.parse(data) : [];
};

export const saveRoutine = (routine: Routine) => {
  if (typeof window === "undefined") return;
  const routines = getRoutines();
  const existingIndex = routines.findIndex((r) => r.id === routine.id);
  if (existingIndex >= 0) {
    routines[existingIndex] = routine;
  } else {
    if (routines.length >= 7) {
      throw new Error("루틴은 최대 7개까지만 생성할 수 있습니다.");
    }
    routines.push(routine);
  }
  localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
};

export const deleteRoutine = (id: string) => {
  if (typeof window === "undefined") return;
  const routines = getRoutines().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
};

export const saveRoutinesOrder = (orderedRoutines: Routine[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(orderedRoutines));
};

// --- Workout Sessions ---
export const getWorkoutSessions = (): WorkoutSession[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  return data ? JSON.parse(data) : [];
};

export const saveWorkoutSession = (session: WorkoutSession) => {
  if (typeof window === "undefined") return;
  const sessions = getWorkoutSessions();
  sessions.push(session);
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
};

export const deleteWorkoutSession = (sessionId: string) => {
  if (typeof window === "undefined") return;
  const sessions = getWorkoutSessions().filter((s) => s.id !== sessionId);
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
};

export const updateWorkoutSession = (session: WorkoutSession) => {
  if (typeof window === "undefined") return;
  const sessions = getWorkoutSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
};

export const getRecentSessionsByExercise = (exerciseName: string, limit = 7): WorkoutSession[] => {
  const sessions = getWorkoutSessions();
  sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return sessions
    .filter(s => s.exercises.some(e => e.name === exerciseName && e.sets.some(set => set.isCompleted)))
    .slice(0, limit);
};

export const getLastSessionByExercise = (exerciseName: string): WorkoutSession | null => {
  const sessions = getWorkoutSessions();
  // Sort by date desc
  sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  for (const session of sessions) {
    const hasExercise = session.exercises.some((e) => e.name === exerciseName && e.sets.some(s => s.isCompleted));
    if (hasExercise) return session;
  }
  return null;
};

// --- Diet ---
export const getAllDietRecords = (): DietRecord[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEYS.DIETS);
  return data ? JSON.parse(data) : [];
};

export const getDietRecordsByDate = (dateString: string): DietRecord[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEYS.DIETS);
  const allDiets: DietRecord[] = data ? JSON.parse(data) : [];
  return allDiets.filter((d) => d.date === dateString);
};

export const saveDietRecord = (record: DietRecord) => {
  if (typeof window === "undefined") return;
  const data = localStorage.getItem(STORAGE_KEYS.DIETS);
  const allDiets: DietRecord[] = data ? JSON.parse(data) : [];
  allDiets.push(record);
  localStorage.setItem(STORAGE_KEYS.DIETS, JSON.stringify(allDiets));
};

export const deleteDietItem = (recordId: string, itemId: string) => {
  if (typeof window === "undefined") return;
  const data = localStorage.getItem(STORAGE_KEYS.DIETS);
  const allDiets: DietRecord[] = data ? JSON.parse(data) : [];
  const record = allDiets.find(d => d.id === recordId);
  if (record) {
    record.items = record.items.filter(item => item.id !== itemId);
    if (record.items.length === 0) {
      const idx = allDiets.findIndex(d => d.id === recordId);
      allDiets.splice(idx, 1);
    }
  }
  localStorage.setItem(STORAGE_KEYS.DIETS, JSON.stringify(allDiets));
};

export const addItemToDietRecord = (date: string, mealType: MealType, item: MealItem) => {
  if (typeof window === "undefined") return;
  const allDiets = getAllDietRecords();
  const existing = allDiets.find((r) => r.date === date && r.mealType === mealType);
  if (existing) {
    existing.items.push(item);
  } else {
    allDiets.push({ id: crypto.randomUUID(), date, mealType, items: [item] });
  }
  localStorage.setItem(STORAGE_KEYS.DIETS, JSON.stringify(allDiets));
};

export const updateDietItem = (recordId: string, updatedItem: MealItem) => {
  if (typeof window === "undefined") return;
  const data = localStorage.getItem(STORAGE_KEYS.DIETS);
  const allDiets: DietRecord[] = data ? JSON.parse(data) : [];
  const record = allDiets.find(d => d.id === recordId);
  if (record) {
    const idx = record.items.findIndex(item => item.id === updatedItem.id);
    if (idx >= 0) {
      record.items[idx] = updatedItem;
    }
  }
  localStorage.setItem(STORAGE_KEYS.DIETS, JSON.stringify(allDiets));
};

// --- Utilities ---
export const calculate1RM = (weight: number, reps: number): number => {
  if (reps === 1) return weight;
  // Epley Formula: 1RM = Weight * (1 + 0.0333 * Reps)
  return Math.round(weight * (1 + 0.0333 * reps));
};

export const calculateCalories = (carbs: number, protein: number, fat: number): number => {
  return (carbs * 4) + (protein * 4) + (fat * 9);
};
