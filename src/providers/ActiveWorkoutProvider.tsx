"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ACTIVE_WORKOUT_EVENT, getActiveWorkout } from "@/utils/storage";

interface ActiveWorkoutCtx {
  isActive: boolean;
}

const Ctx = createContext<ActiveWorkoutCtx>({ isActive: false });

export function useActiveWorkout() {
  return useContext(Ctx);
}

function readIsActive(): boolean {
  const data = getActiveWorkout();
  if (!data) return false;
  const hasProgress = data.exercisesData?.some((ex) => ex.sets.some((s) => s.isCompleted));
  return !!(data.routineId && hasProgress);
}

export function ActiveWorkoutProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const pathname = usePathname();

  const check = useCallback(() => setIsActive(readIsActive()), []);

  // paint 전에 실행 → hydration 후 첫 렌더부터 올바른 위치 보장
  useLayoutEffect(() => {
    check();
  }, [check, pathname]);

  useEffect(() => {
    // 같은 탭에서의 변경은 커스텀 이벤트로, 다른 탭은 storage 이벤트로 감지
    window.addEventListener(ACTIVE_WORKOUT_EVENT, check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener(ACTIVE_WORKOUT_EVENT, check);
      window.removeEventListener("storage", check);
    };
  }, [check]);

  return <Ctx.Provider value={{ isActive }}>{children}</Ctx.Provider>;
}
