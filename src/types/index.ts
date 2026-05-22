export type WeightUnit = "kg" | "lb";

// 종목 카테고리
export type ExerciseCategory = "가슴" | "등" | "어깨" | "팔" | "하체" | "코어" | "유산소" | "기타";

export interface SetRecord {
  id: string;
  weight: number;
  reps: number;
  isCompleted: boolean;
  restTime?: number; // 세트별 휴식 시간(초), 미지정 시 기본값 사용
}

export interface ExerciseRecord {
  id: string; // 종목 식별자 (예: 벤치프레스)
  name: string;
  sets: SetRecord[];
}

export interface RoutineSetTemplate {
  weight: number;
  reps: number;
  restTime: number;
}

export interface RoutineExerciseConfig {
  name: string;
  sets: RoutineSetTemplate[];
  category?: ExerciseCategory;
}

export interface Routine {
  id: string;
  name: string;
  exercises: string[];
  exerciseConfigs?: RoutineExerciseConfig[];
}

export interface WorkoutSession {
  id: string; // 고유 세션 ID
  routineId: string;
  date: string; // ISO string
  exercises: ExerciseRecord[];
}

// 종목 라이브러리
export interface ExerciseTemplate {
  id: string;
  name: string;
  category: ExerciseCategory;
}

// 식품 프리셋
export interface FoodPreset {
  id: string;
  name: string;
  carbs: number;
  protein: number;
  fat: number;
}

// 식단 관련 타입
export type MealType = "아침" | "점심" | "저녁" | "간식";

export interface MealItem {
  id: string;
  name: string;
  carbs: number; // g
  protein: number; // g
  fat: number; // g
}

export interface DietRecord {
  id: string;
  date: string; // ISO string (YYYY-MM-DD)
  mealType: MealType;
  items: MealItem[];
}
