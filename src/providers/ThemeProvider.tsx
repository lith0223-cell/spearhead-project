"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type AccentColor = "yellow" | "cyan" | "red" | "purple";
export type ColorMode = "dark" | "light";

interface ThemeContextType {
  accent: AccentColor;
  mode: ColorMode;
  setAccent: (accent: AccentColor) => void;
  setMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentColor>("cyan");
  const [mode, setModeState] = useState<ColorMode>("dark");

  useEffect(() => {
    const raw = localStorage.getItem("ph_accent");
    const savedAccent: AccentColor = (raw === "green" ? "purple" : raw as AccentColor) || "cyan";
    const savedMode = (localStorage.getItem("ph_mode") as ColorMode) || "dark";
    setAccentState(savedAccent);
    setModeState(savedMode);
  }, []);

  const setAccent = (a: AccentColor) => {
    setAccentState(a);
    localStorage.setItem("ph_accent", a);
    document.documentElement.setAttribute("data-accent", a);
  };

  const setMode = (m: ColorMode) => {
    setModeState(m);
    localStorage.setItem("ph_mode", m);
    document.documentElement.setAttribute("data-mode", m);
  };

  return (
    <ThemeContext.Provider value={{ accent, mode, setAccent, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
