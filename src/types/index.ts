export type WeightUnit = "kg" | "lb";

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

export interface Routine {
  id: string;
  name: string;
  exercises: string[]; // 종목 이름 목록
}

export interface WorkoutSession {
  id: string; // 고유 세션 ID
  routineId: string;
  date: string; // ISO string
  exercises: ExerciseRecord[];
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
