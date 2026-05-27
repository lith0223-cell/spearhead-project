import { DietRecord, Routine, WorkoutSession } from "@/types";

// ── 날짜 헬퍼 ──
const isoAgo = (days: number) =>
  new Date(Date.now() - 86400000 * days).toISOString();

const dateStrAgo = (days: number) => {
  const d = new Date(Date.now() - 86400000 * days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ── 루틴 (exerciseConfigs 포함, 라이브러리 종목명 일치) ──
export const DUMMY_ROUTINES: Routine[] = [
  {
    id: "routine-1",
    name: "가슴 / 삼두",
    exercises: ["바벨 벤치프레스", "인클라인 벤치프레스", "케이블 플라이", "트라이셉스 푸시다운", "스컬 크러셔"],
    exerciseConfigs: [
      {
        name: "바벨 벤치프레스",
        category: "가슴",
        sets: [
          { weight: 82.5, reps: 8, restTime: 90 },
          { weight: 82.5, reps: 8, restTime: 90 },
          { weight: 82.5, reps: 8, restTime: 90 },
          { weight: 80,   reps: 8, restTime: 90 },
        ],
      },
      {
        name: "인클라인 벤치프레스",
        category: "가슴",
        sets: [
          { weight: 65, reps: 10, restTime: 90 },
          { weight: 65, reps: 10, restTime: 90 },
          { weight: 65, reps: 10, restTime: 90 },
        ],
      },
      {
        name: "케이블 플라이",
        category: "가슴",
        sets: [
          { weight: 32.5, reps: 12, restTime: 60 },
          { weight: 32.5, reps: 12, restTime: 60 },
          { weight: 32.5, reps: 12, restTime: 60 },
        ],
      },
      {
        name: "트라이셉스 푸시다운",
        category: "팔",
        sets: [
          { weight: 27.5, reps: 12, restTime: 60 },
          { weight: 27.5, reps: 12, restTime: 60 },
          { weight: 27.5, reps: 12, restTime: 60 },
        ],
      },
      {
        name: "스컬 크러셔",
        category: "팔",
        sets: [
          { weight: 30, reps: 10, restTime: 90 },
          { weight: 30, reps: 10, restTime: 90 },
          { weight: 30, reps: 10, restTime: 90 },
        ],
      },
    ],
  },
  {
    id: "routine-2",
    name: "등 / 이두",
    exercises: ["바벨 데드리프트", "풀업", "바벨 로우", "랫 풀다운", "바벨 컬"],
    exerciseConfigs: [
      {
        name: "바벨 데드리프트",
        category: "등",
        sets: [
          { weight: 100, reps: 5, restTime: 120 },
          { weight: 100, reps: 5, restTime: 120 },
          { weight: 100, reps: 5, restTime: 120 },
          { weight: 100, reps: 5, restTime: 120 },
        ],
      },
      {
        name: "풀업",
        category: "등",
        sets: [
          { weight: 0, reps: 8, restTime: 90, weightMode: "bodyweight" as const },
          { weight: 0, reps: 8, restTime: 90, weightMode: "bodyweight" as const },
          { weight: 0, reps: 7, restTime: 90, weightMode: "bodyweight" as const },
          { weight: 0, reps: 6, restTime: 90, weightMode: "bodyweight" as const },
        ],
      },
      {
        name: "바벨 로우",
        category: "등",
        sets: [
          { weight: 70, reps: 8, restTime: 90 },
          { weight: 70, reps: 8, restTime: 90 },
          { weight: 70, reps: 8, restTime: 90 },
        ],
      },
      {
        name: "랫 풀다운",
        category: "등",
        sets: [
          { weight: 62.5, reps: 10, restTime: 60 },
          { weight: 62.5, reps: 10, restTime: 60 },
          { weight: 62.5, reps: 10, restTime: 60 },
        ],
      },
      {
        name: "바벨 컬",
        category: "팔",
        sets: [
          { weight: 35, reps: 10, restTime: 60 },
          { weight: 35, reps: 10, restTime: 60 },
          { weight: 35, reps: 10, restTime: 60 },
        ],
      },
    ],
  },
  {
    id: "routine-3",
    name: "하체 / 어깨",
    exercises: ["바벨 스쿼트", "레그 프레스", "레그 컬", "오버헤드 프레스", "덤벨 레터럴 레이즈"],
    exerciseConfigs: [
      {
        name: "바벨 스쿼트",
        category: "하체",
        sets: [
          { weight: 90, reps: 5, restTime: 120 },
          { weight: 90, reps: 5, restTime: 120 },
          { weight: 90, reps: 5, restTime: 120 },
          { weight: 90, reps: 5, restTime: 120 },
          { weight: 90, reps: 5, restTime: 120 },
        ],
      },
      {
        name: "레그 프레스",
        category: "하체",
        sets: [
          { weight: 150, reps: 10, restTime: 90 },
          { weight: 150, reps: 10, restTime: 90 },
          { weight: 150, reps: 10, restTime: 90 },
        ],
      },
      {
        name: "레그 컬",
        category: "하체",
        sets: [
          { weight: 50, reps: 12, restTime: 60 },
          { weight: 50, reps: 12, restTime: 60 },
          { weight: 50, reps: 12, restTime: 60 },
        ],
      },
      {
        name: "오버헤드 프레스",
        category: "어깨",
        sets: [
          { weight: 52.5, reps: 8, restTime: 90 },
          { weight: 52.5, reps: 8, restTime: 90 },
          { weight: 52.5, reps: 8, restTime: 90 },
          { weight: 50,   reps: 8, restTime: 90 },
        ],
      },
      {
        name: "덤벨 레터럴 레이즈",
        category: "어깨",
        sets: [
          { weight: 12, reps: 15, restTime: 60 },
          { weight: 12, reps: 15, restTime: 60 },
          { weight: 12, reps: 15, restTime: 60 },
        ],
      },
    ],
  },
];

// ── 운동 세션 (5개, 총 10일 스팬) ──
// session-1: 7일 전 — 가슴/삼두 (기준 무게)
// session-2: 5일 전 — 등/이두
// session-3: 3일 전 — 가슴/삼두 (조금 더 무거워짐, prevSession으로 사용)
// session-4: 어제   — 등/이두 (약간 향상)
// session-5: 오늘   — 하체/어깨
// → 연속 운동 2일(오늘+어제), lastWorkoutDaysAgo=0
export const DUMMY_WORKOUT_SESSIONS: WorkoutSession[] = [
  // ── session-1: 7일 전, 가슴/삼두 (기준) ──
  {
    id: "session-1",
    routineId: "routine-1",
    date: isoAgo(7),
    exercises: [
      {
        id: "바벨 벤치프레스",
        name: "바벨 벤치프레스",
        sets: [
          { id: "s1-b1", weight: 77.5, reps: 8, isCompleted: true, restTime: 90, rpe: 7 },
          { id: "s1-b2", weight: 77.5, reps: 7, isCompleted: true, restTime: 90, rpe: 8 },
          { id: "s1-b3", weight: 75,   reps: 8, isCompleted: true, restTime: 90 },
          { id: "s1-b4", weight: 75,   reps: 6, isCompleted: true, restTime: 90, rpe: 9 },
        ],
      },
      {
        id: "인클라인 벤치프레스",
        name: "인클라인 벤치프레스",
        sets: [
          { id: "s1-i1", weight: 60, reps: 10, isCompleted: true, restTime: 90 },
          { id: "s1-i2", weight: 60, reps: 9,  isCompleted: true, restTime: 90 },
          { id: "s1-i3", weight: 60, reps: 8,  isCompleted: true, restTime: 90 },
        ],
      },
      {
        id: "케이블 플라이",
        name: "케이블 플라이",
        sets: [
          { id: "s1-f1", weight: 30, reps: 12, isCompleted: true, restTime: 60 },
          { id: "s1-f2", weight: 30, reps: 12, isCompleted: true, restTime: 60 },
          { id: "s1-f3", weight: 30, reps: 10, isCompleted: true, restTime: 60 },
        ],
      },
      {
        id: "트라이셉스 푸시다운",
        name: "트라이셉스 푸시다운",
        sets: [
          { id: "s1-t1", weight: 25, reps: 12, isCompleted: true, restTime: 60 },
          { id: "s1-t2", weight: 25, reps: 11, isCompleted: true, restTime: 60 },
          { id: "s1-t3", weight: 22.5, reps: 12, isCompleted: true, restTime: 60 },
        ],
      },
      {
        id: "스컬 크러셔",
        name: "스컬 크러셔",
        sets: [
          { id: "s1-sk1", weight: 27.5, reps: 10, isCompleted: true, restTime: 90 },
          { id: "s1-sk2", weight: 27.5, reps: 8,  isCompleted: true, restTime: 90 },
          { id: "s1-sk3", weight: 27.5, reps: 7,  isCompleted: true, restTime: 90 },
        ],
      },
    ],
  },

  // ── session-2: 5일 전, 등/이두 ──
  {
    id: "session-2",
    routineId: "routine-2",
    date: isoAgo(5),
    exercises: [
      {
        id: "바벨 데드리프트",
        name: "바벨 데드리프트",
        sets: [
          { id: "s2-d1", weight: 100, reps: 5, isCompleted: true, restTime: 120, rpe: 8 },
          { id: "s2-d2", weight: 100, reps: 5, isCompleted: true, restTime: 120, rpe: 8 },
          { id: "s2-d3", weight: 100, reps: 5, isCompleted: true, restTime: 120, rpe: 9 },
          { id: "s2-d4", weight: 100, reps: 4, isCompleted: true, restTime: 120, rpe: 9 },
        ],
      },
      {
        id: "풀업",
        name: "풀업",
        sets: [
          { id: "s2-p1", weight: 0, reps: 8, isCompleted: true, restTime: 90, weightMode: "bodyweight" },
          { id: "s2-p2", weight: 0, reps: 7, isCompleted: true, restTime: 90, weightMode: "bodyweight" },
          { id: "s2-p3", weight: 0, reps: 6, isCompleted: true, restTime: 90, weightMode: "bodyweight" },
          { id: "s2-p4", weight: 0, reps: 5, isCompleted: true, restTime: 90, weightMode: "bodyweight", rpe: 9 },
        ],
      },
      {
        id: "바벨 로우",
        name: "바벨 로우",
        sets: [
          { id: "s2-r1", weight: 70, reps: 8, isCompleted: true, restTime: 90 },
          { id: "s2-r2", weight: 70, reps: 8, isCompleted: true, restTime: 90 },
          { id: "s2-r3", weight: 70, reps: 7, isCompleted: true, restTime: 90 },
        ],
      },
      {
        id: "랫 풀다운",
        name: "랫 풀다운",
        sets: [
          { id: "s2-l1", weight: 60, reps: 10, isCompleted: true, restTime: 60 },
          { id: "s2-l2", weight: 60, reps: 10, isCompleted: true, restTime: 60 },
          { id: "s2-l3", weight: 60, reps: 9,  isCompleted: true, restTime: 60 },
        ],
      },
      {
        id: "바벨 컬",
        name: "바벨 컬",
        sets: [
          { id: "s2-c1", weight: 35, reps: 10, isCompleted: true, restTime: 60 },
          { id: "s2-c2", weight: 35, reps: 9,  isCompleted: true, restTime: 60 },
          { id: "s2-c3", weight: 35, reps: 8,  isCompleted: true, restTime: 60 },
        ],
      },
    ],
  },

  // ── session-3: 3일 전, 가슴/삼두 (약간 향상, prevSession 역할) ──
  {
    id: "session-3",
    routineId: "routine-1",
    date: isoAgo(3),
    exercises: [
      {
        id: "바벨 벤치프레스",
        name: "바벨 벤치프레스",
        sets: [
          { id: "s3-b1", weight: 80, reps: 8, isCompleted: true, restTime: 90, rpe: 7 },
          { id: "s3-b2", weight: 80, reps: 7, isCompleted: true, restTime: 90, rpe: 8 },
          { id: "s3-b3", weight: 80, reps: 6, isCompleted: true, restTime: 90, rpe: 9 },
          { id: "s3-b4", weight: 77.5, reps: 8, isCompleted: true, restTime: 90 },
        ],
      },
      {
        id: "인클라인 벤치프레스",
        name: "인클라인 벤치프레스",
        sets: [
          { id: "s3-i1", weight: 62.5, reps: 10, isCompleted: true, restTime: 90 },
          { id: "s3-i2", weight: 62.5, reps: 9,  isCompleted: true, restTime: 90 },
          { id: "s3-i3", weight: 62.5, reps: 8,  isCompleted: true, restTime: 90 },
        ],
      },
      {
        id: "케이블 플라이",
        name: "케이블 플라이",
        sets: [
          { id: "s3-f1", weight: 30, reps: 12, isCompleted: true, restTime: 60 },
          { id: "s3-f2", weight: 30, reps: 12, isCompleted: true, restTime: 60 },
          { id: "s3-f3", weight: 30, reps: 12, isCompleted: true, restTime: 60 },
        ],
      },
      {
        id: "트라이셉스 푸시다운",
        name: "트라이셉스 푸시다운",
        sets: [
          { id: "s3-t1", weight: 25, reps: 12, isCompleted: true, restTime: 60 },
          { id: "s3-t2", weight: 25, reps: 12, isCompleted: true, restTime: 60 },
          { id: "s3-t3", weight: 25, reps: 10, isCompleted: true, restTime: 60 },
        ],
      },
      {
        id: "스컬 크러셔",
        name: "스컬 크러셔",
        sets: [
          { id: "s3-sk1", weight: 27.5, reps: 10, isCompleted: true, restTime: 90 },
          { id: "s3-sk2", weight: 27.5, reps: 10, isCompleted: true, restTime: 90 },
          { id: "s3-sk3", weight: 27.5, reps: 8,  isCompleted: true, restTime: 90 },
        ],
      },
    ],
  },

  // ── session-4: 어제, 등/이두 (향상) → 연속 2일 streak ──
  {
    id: "session-4",
    routineId: "routine-2",
    date: isoAgo(1),
    exercises: [
      {
        id: "바벨 데드리프트",
        name: "바벨 데드리프트",
        sets: [
          { id: "s4-d1", weight: 102.5, reps: 5, isCompleted: true, restTime: 120, rpe: 8 },
          { id: "s4-d2", weight: 102.5, reps: 5, isCompleted: true, restTime: 120, rpe: 8 },
          { id: "s4-d3", weight: 102.5, reps: 5, isCompleted: true, restTime: 120, rpe: 9 },
          { id: "s4-d4", weight: 100,   reps: 5, isCompleted: true, restTime: 120 },
        ],
      },
      {
        id: "풀업",
        name: "풀업",
        sets: [
          { id: "s4-p1", weight: 0, reps: 8, isCompleted: true, restTime: 90, weightMode: "bodyweight" },
          { id: "s4-p2", weight: 0, reps: 8, isCompleted: true, restTime: 90, weightMode: "bodyweight" },
          { id: "s4-p3", weight: 0, reps: 7, isCompleted: true, restTime: 90, weightMode: "bodyweight" },
          { id: "s4-p4", weight: 0, reps: 6, isCompleted: true, restTime: 90, weightMode: "bodyweight" },
        ],
      },
      {
        id: "바벨 로우",
        name: "바벨 로우",
        sets: [
          { id: "s4-r1", weight: 70, reps: 8, isCompleted: true, restTime: 90 },
          { id: "s4-r2", weight: 70, reps: 8, isCompleted: true, restTime: 90 },
          { id: "s4-r3", weight: 70, reps: 8, isCompleted: true, restTime: 90 },
        ],
      },
      {
        id: "랫 풀다운",
        name: "랫 풀다운",
        sets: [
          { id: "s4-l1", weight: 62.5, reps: 10, isCompleted: true, restTime: 60 },
          { id: "s4-l2", weight: 62.5, reps: 10, isCompleted: true, restTime: 60 },
          { id: "s4-l3", weight: 62.5, reps: 9,  isCompleted: true, restTime: 60 },
        ],
      },
      {
        id: "바벨 컬",
        name: "바벨 컬",
        sets: [
          { id: "s4-c1", weight: 35, reps: 10, isCompleted: true, restTime: 60 },
          { id: "s4-c2", weight: 35, reps: 10, isCompleted: true, restTime: 60 },
          { id: "s4-c3", weight: 35, reps: 9,  isCompleted: true, restTime: 60 },
        ],
      },
    ],
  },

  // ── session-5: 오늘, 하체/어깨 → streak=2 (오늘+어제) ──
  {
    id: "session-5",
    routineId: "routine-3",
    date: isoAgo(0),
    exercises: [
      {
        id: "바벨 스쿼트",
        name: "바벨 스쿼트",
        sets: [
          { id: "s5-sq1", weight: 90, reps: 5, isCompleted: true, restTime: 120, rpe: 7 },
          { id: "s5-sq2", weight: 90, reps: 5, isCompleted: true, restTime: 120, rpe: 8 },
          { id: "s5-sq3", weight: 90, reps: 5, isCompleted: true, restTime: 120, rpe: 8 },
          { id: "s5-sq4", weight: 90, reps: 5, isCompleted: true, restTime: 120, rpe: 9 },
          { id: "s5-sq5", weight: 87.5, reps: 5, isCompleted: true, restTime: 120, rpe: 9 },
        ],
      },
      {
        id: "레그 프레스",
        name: "레그 프레스",
        sets: [
          { id: "s5-lp1", weight: 150, reps: 10, isCompleted: true, restTime: 90 },
          { id: "s5-lp2", weight: 150, reps: 10, isCompleted: true, restTime: 90 },
          { id: "s5-lp3", weight: 150, reps: 9,  isCompleted: true, restTime: 90 },
        ],
      },
      {
        id: "레그 컬",
        name: "레그 컬",
        sets: [
          { id: "s5-lc1", weight: 50, reps: 12, isCompleted: true, restTime: 60 },
          { id: "s5-lc2", weight: 50, reps: 11, isCompleted: true, restTime: 60 },
          { id: "s5-lc3", weight: 50, reps: 10, isCompleted: true, restTime: 60 },
        ],
      },
      {
        id: "오버헤드 프레스",
        name: "오버헤드 프레스",
        sets: [
          { id: "s5-op1", weight: 50, reps: 8, isCompleted: true, restTime: 90, rpe: 7 },
          { id: "s5-op2", weight: 50, reps: 8, isCompleted: true, restTime: 90, rpe: 8 },
          { id: "s5-op3", weight: 50, reps: 7, isCompleted: true, restTime: 90, rpe: 9 },
          { id: "s5-op4", weight: 47.5, reps: 8, isCompleted: true, restTime: 90 },
        ],
      },
      {
        id: "덤벨 레터럴 레이즈",
        name: "덤벨 레터럴 레이즈",
        sets: [
          { id: "s5-lr1", weight: 12, reps: 15, isCompleted: true, restTime: 60 },
          { id: "s5-lr2", weight: 12, reps: 14, isCompleted: true, restTime: 60 },
          { id: "s5-lr3", weight: 12, reps: 13, isCompleted: true, restTime: 60 },
        ],
      },
    ],
  },
];

// ── 식단 기록 (오늘 + 어제) ──
export const DUMMY_DIET_RECORDS: DietRecord[] = [
  // 어제 저녁
  {
    id: "diet-y1",
    date: dateStrAgo(1),
    mealType: "저녁",
    items: [
      { id: "dy1-1", name: "현미밥 1공기",    carbs: 65, protein: 5,  fat: 1  },
      { id: "dy1-2", name: "소고기 불고기 200g", carbs: 12, protein: 28, fat: 16 },
      { id: "dy1-3", name: "두부 반모",         carbs: 4,  protein: 10, fat: 5  },
    ],
  },
  // 오늘 아침
  {
    id: "diet-t1",
    date: dateStrAgo(0),
    mealType: "아침",
    items: [
      { id: "dt1-1", name: "오트밀 60g",    carbs: 38, protein: 5,  fat: 3 },
      { id: "dt1-2", name: "삶은 달걀 2개", carbs: 1,  protein: 13, fat: 10 },
      { id: "dt1-3", name: "바나나 1개",    carbs: 27, protein: 1,  fat: 0  },
    ],
  },
  // 오늘 점심
  {
    id: "diet-t2",
    date: dateStrAgo(0),
    mealType: "점심",
    items: [
      { id: "dt2-1", name: "닭가슴살 볶음밥", carbs: 60, protein: 35, fat: 8  },
      { id: "dt2-2", name: "두유 200ml",      carbs: 8,  protein: 7,  fat: 4  },
      { id: "dt2-3", name: "아몬드 15알",     carbs: 3,  protein: 4,  fat: 9  },
    ],
  },
];
