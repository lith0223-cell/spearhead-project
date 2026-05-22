"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

interface ActiveWorkoutCtx {
  isActive: boolean;
}

const Ctx = createContext<ActiveWorkoutCtx>({ isActive: false });

export function useActiveWorkout() {
  return useContext(Ctx);
}

function readIsActive(): boolean {
  try {
    const saved = localStorage.getItem("ph_active_workout");
    if (saved) {
      const data = JSON.parse(saved);
      const hasProgress = data.exercisesData?.some(
        (ex: { sets: { isCompleted: boolean }[] }) => ex.sets.some((s) => s.isCompleted)
      );
      return !!(data.routineId && hasProgress);
    }
  } catch {}
  return false;
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
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, [check]);

  return <Ctx.Provider value={{ isActive }}>{children}</Ctx.Provider>;
}
