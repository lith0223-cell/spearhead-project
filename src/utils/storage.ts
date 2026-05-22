import { DietRecord, ExerciseCategory, ExerciseTemplate, FoodPreset, MealItem, MealType, Routine, SetRecord, WorkoutSession } from "@/types";
import { DUMMY_DIET_RECORDS, DUMMY_ROUTINES, DUMMY_WORKOUT_SESSIONS } from "./dummyData";

const STORAGE_KEYS = {
  ROUTINES: "ph_routines",
  SESSIONS: "ph_sessions",
  DIETS: "ph_diets",
  HAS_INITIALIZED: "ph_initialized",
  EXERCISE_LIBRARY: "ph_exercise_library",
  FOOD_PRESETS: "ph_food_presets",
};

const DEFAULT_EXERCISE_LIBRARY: ExerciseTemplate[] = [
  { id: "ex-001", name: "바벨 벤치프레스",      category: "가슴" },
  { id: "ex-002", name: "덤벨 벤치프레스",      category: "가슴" },
  { id: "ex-003", name: "인클라인 벤치프레스",  category: "가슴" },
  { id: "ex-004", name: "딥스",                category: "가슴" },
  { id: "ex-005", name: "케이블 플라이",        category: "가슴" },
  { id: "ex-006", name: "풀업",                category: "등"   },
  { id: "ex-007", name: "바벨 데드리프트",      category: "등"   },
  { id: "ex-008", name: "바벨 로우",           category: "등"   },
  { id: "ex-009", name: "랫 풀다운",           category: "등"   },
  { id: "ex-010", name: "시티드 케이블 로우",   category: "등"   },
  { id: "ex-011", name: "오버헤드 프레스",      category: "어깨" },
  { id: "ex-012", name: "덤벨 레터럴 레이즈",  category: "어깨" },
  { id: "ex-013", name: "리어 델트 플라이",     category: "어깨" },
  { id: "ex-014", name: "바벨 컬",            category: "팔"   },
  { id: "ex-015", name: "해머 컬",            category: "팔"   },
  { id: "ex-016", name: "스컬 크러셔",         category: "팔"   },
  { id: "ex-017", name: "트라이셉스 푸시다운", category: "팔"   },
  { id: "ex-018", name: "바벨 스쿼트",         category: "하체" },
  { id: "ex-019", name: "레그 프레스",         category: "하체" },
  { id: "ex-020", name: "런지",               category: "하체" },
  { id: "ex-021", name: "레그 컬",            category: "하체" },
  { id: "ex-022", name: "레그 익스텐션",       category: "하체" },
  { id: "ex-023", name: "카프 레이즈",         category: "하체" },
  { id: "ex-024", name: "플랭크",             category: "코어" },
  { id: "ex-025", name: "크런치",             category: "코어" },
  { id: "ex-026", name: "레그 레이즈",         category: "코어" },
  { id: "ex-027", name: "트레드밀",            category: "유산소" },
  { id: "ex-028", name: "사이클",             category: "유산소" },
  { id: "ex-029", name: "로잉머신",            category: "유산소" },
];

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

// --- Exercise Library ---
export const getExerciseLibrary = (): ExerciseTemplate[] => {
  if (typeof window === "undefined") return DEFAULT_EXERCISE_LIBRARY;
  const data = localStorage.getItem(STORAGE_KEYS.EXERCISE_LIBRARY);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.EXERCISE_LIBRARY, JSON.stringify(DEFAULT_EXERCISE_LIBRARY));
    return DEFAULT_EXERCISE_LIBRARY;
  }
  return JSON.parse(data);
};

export const saveExerciseToLibrary = (ex: ExerciseTemplate) => {
  if (typeof window === "undefined") return;
  const lib = getExerciseLibrary();
  lib.push(ex);
  localStorage.setItem(STORAGE_KEYS.EXERCISE_LIBRARY, JSON.stringify(lib));
};

export const deleteExerciseFromLibrary = (id: string) => {
  if (typeof window === "undefined") return;
  const lib = getExerciseLibrary().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEYS.EXERCISE_LIBRARY, JSON.stringify(lib));
};

// --- Calorie estimate ---
export const estimateRoutineCalories = (routine: Routine, weightKg: number): number => {
  const configs = routine.exerciseConfigs ?? [];
  if (configs.length === 0) return 0;
  let totalCal = 0;
  for (const ex of configs) {
    const isCardio = ex.category === "유산소";
    if (isCardio) {
      const sets = ex.sets.length > 0 ? ex.sets : [{ restTime: 0, weight: 0, reps: 30 }];
      for (const s of sets) totalCal += 7.5 * weightKg * ((s.reps || 30) / 60);
    } else {
      const sets = ex.sets.length > 0 ? ex.sets : [{ restTime: 60, weight: 0, reps: 0 }, { restTime: 60, weight: 0, reps: 0 }, { restTime: 60, weight: 0, reps: 0 }];
      for (const s of sets) totalCal += 4.5 * weightKg * ((40 + (s.restTime || 60)) / 3600);
    }
  }
  return Math.round(totalCal);
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

// --- Food Presets ---
export const getFoodPresets = (): FoodPreset[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEYS.FOOD_PRESETS);
  return data ? JSON.parse(data) : [];
};

export const saveFoodPreset = (preset: FoodPreset) => {
  if (typeof window === "undefined") return;
  const presets = getFoodPresets();
  presets.push(preset);
  localStorage.setItem(STORAGE_KEYS.FOOD_PRESETS, JSON.stringify(presets));
};

export const deleteFoodPreset = (id: string) => {
  if (typeof window === "undefined") return;
  const presets = getFoodPresets().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEYS.FOOD_PRESETS, JSON.stringify(presets));
};

// --- Analytics ---
export const getSessionsByExerciseName = (name: string): { date: string; sets: SetRecord[] }[] => {
  const sessions = getWorkoutSessions();
  return sessions
    .filter(s => s.exercises.some(e => e.name === name))
    .map(s => ({
      date: s.date,
      sets: s.exercises.find(e => e.name === name)!.sets.filter(set => set.isCompleted),
    }))
    .filter(s => s.sets.length > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// --- Workout Stats ---
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const getWorkoutStreak = (): number => {
  if (typeof window === "undefined") return 0;
  const sessions = getWorkoutSessions();
  const workoutDates = new Set(sessions.map(s => toDateStr(new Date(s.date))));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (workoutDates.has(toDateStr(d))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getWeeklyWorkoutCount = (): number => {
  if (typeof window === "undefined") return 0;
  const sessions = getWorkoutSessions();
  const monday = getMondayOfWeek(new Date());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return new Set(
    sessions
      .filter(s => { const d = new Date(s.date); return d >= monday && d <= sunday; })
      .map(s => toDateStr(new Date(s.date)))
  ).size;
};

export const getWorkoutDaysThisWeek = (): boolean[] => {
  if (typeof window === "undefined") return Array(7).fill(false);
  const sessions = getWorkoutSessions();
  const workoutDates = new Set(sessions.map(s => toDateStr(new Date(s.date))));
  const monday = getMondayOfWeek(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return workoutDates.has(toDateStr(d));
  });
};

export const getLastWorkoutDaysAgo = (): number | null => {
  if (typeof window === "undefined") return null;
  const sessions = getWorkoutSessions();
  if (sessions.length === 0) return null;
  const sorted = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const last = new Date(sorted[0].date);
  const today = new Date();
  last.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - last.getTime()) / 86400000);
};

// --- Data Export/Import ---
export const exportAllData = (): string => {
  if (typeof window === "undefined") return "{}";
  const data: Record<string, string> = {};
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("ph_")) data[key] = localStorage.getItem(key)!;
  }
  return JSON.stringify(data, null, 2);
};

export const importAllData = (json: string) => {
  if (typeof window === "undefined") return;
  const data = JSON.parse(json) as Record<string, string>;
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith("ph_")) localStorage.setItem(k, v);
  }
};
