import { DietRecord, Routine, WorkoutSession } from "@/types";

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export const DUMMY_ROUTINES: Routine[] = [
  {
    id: "routine-1",
    name: "무분할 전신 A",
    exercises: ["스쿼트", "벤치프레스", "바벨로우", "오버헤드프레스"],
  },
  {
    id: "routine-2",
    name: "무분할 전신 B",
    exercises: ["데드리프트", "풀업", "인클라인 덤벨프레스", "사이드 레터럴 레이즈"],
  },
];

export const DUMMY_WORKOUT_SESSIONS: WorkoutSession[] = [
  {
    id: "session-1",
    routineId: "routine-1",
    date: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    exercises: [
      {
        id: "스쿼트",
        name: "스쿼트",
        sets: [
          { id: "s1", weight: 80, reps: 5, isCompleted: true },
          { id: "s2", weight: 80, reps: 5, isCompleted: true },
          { id: "s3", weight: 80, reps: 5, isCompleted: true },
        ],
      },
      {
        id: "벤치프레스",
        name: "벤치프레스",
        sets: [
          { id: "b1", weight: 60, reps: 8, isCompleted: true },
          { id: "b2", weight: 60, reps: 8, isCompleted: true },
        ],
      },
    ],
  },
];

export const DUMMY_DIET_RECORDS: DietRecord[] = [
  {
    id: "diet-1",
    date: todayStr(),
    mealType: "점심",
    items: [
      { id: "m1", name: "닭가슴살 볶음밥", carbs: 60, protein: 35, fat: 10 },
      { id: "m2", name: "아몬드 10알", carbs: 2, protein: 3, fat: 6 },
    ],
  },
];
