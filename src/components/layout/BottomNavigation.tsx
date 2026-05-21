"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Dumbbell, Utensils, CalendarDays, Settings } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function BottomNavigation() {
  const pathname = usePathname();
  const [activeWorkout, setActiveWorkout] = useState<{ routineId: string; routineName: string } | null>(null);

  useEffect(() => {
    const check = () => {
      try {
        const saved = localStorage.getItem("ph_active_workout");
        if (saved) {
          const data = JSON.parse(saved);
          const hasProgress = data.exercisesData?.some((ex: { sets: { isCompleted: boolean }[] }) =>
            ex.sets.some((s) => s.isCompleted)
          );
          if (data.routineId && data.routineName && hasProgress) {
            setActiveWorkout({ routineId: data.routineId, routineName: data.routineName });
            return;
          }
        }
      } catch {}
      setActiveWorkout(null);
    };
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, [pathname]);

  const navItems = [
    { label: "홈",       href: "/",         icon: Home        },
    { label: "운동",     href: "/routines", icon: Dumbbell    },
    { label: "식단",     href: "/diet",     icon: Utensils    },
    { label: "기록",     href: "/history",  icon: CalendarDays},
    { label: "설정",     href: "/settings", icon: Settings    },
  ];

  if (pathname.startsWith("/workout/")) {
    return null;
  }

  return (
    <div className="relative z-50 shrink-0">
      {/* 이어하기 배너 — 네비 위에 absolute floating, 네비 높이 불변 */}
      {activeWorkout && (
        <div className="absolute bottom-full left-0 right-0 pb-2 pointer-events-none">
          <div className="max-w-md mx-auto px-4 pointer-events-auto">
            <Link href={`/workout/${activeWorkout.routineId}?resume=true`}>
              <div className="bg-accent text-background rounded-xl py-2.5 px-4 flex items-center gap-3 shadow-lg shadow-black/20">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span>
                <span className="flex-1 text-sm font-bold truncate">{activeWorkout.routineName} 진행 중</span>
                <span className="text-sm font-extrabold shrink-0">이어하기 →</span>
              </div>
            </Link>
          </div>
        </div>
      )}
      {/* 내비게이션 — 높이 항상 고정 */}
      <div className="bg-card border-t border-border pb-safe">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors relative",
                  isActive ? "text-accent" : "text-muted hover:text-foreground"
                )}
              >
                <Icon size={24} strokeWidth={2} />
                <span className="text-[10px] font-medium">{item.label}</span>
                <span className={cn("w-1 h-1 rounded-full mt-0.5 transition-colors", isActive ? "bg-accent" : "bg-transparent")} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
