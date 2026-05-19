"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, Utensils, Settings } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function BottomNavigation() {
  const pathname = usePathname();

  const navItems = [
    { label: "대시보드", href: "/",         icon: Home     },
    { label: "운동",     href: "/routines", icon: Dumbbell },
    { label: "식단",     href: "/diet",     icon: Utensils },
    { label: "설정",     href: "/settings", icon: Settings },
  ];

  // Do not show bottom nav on workout execution screen
  if (pathname.startsWith("/workout/")) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          // Match /routines but also allow other paths if needed. Currently exact match or starts with for routines is fine,
          // but let's just do exact or parent path matching.
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-accent" : "text-muted hover:text-foreground"
              )}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
