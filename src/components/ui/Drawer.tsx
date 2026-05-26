"use client";

import { useEffect, useRef, useState } from "react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: string;
  zIndex?: number;
  ariaLabel?: string;
}

const EXIT_DURATION_MS = 220;

export function Drawer({ open, onClose, children, height = "85vh", zIndex = 60, ariaLabel }: DrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // open <-> close 전환 시 exit 애니메이션 후 언마운트
  useEffect(() => {
    if (open) {
      setMounted(true);
      setIsClosing(false);
    } else if (mounted) {
      setIsClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setIsClosing(false);
      }, EXIT_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  // body 스크롤 잠금 + 포커스 복원
  useEffect(() => {
    if (!mounted) return;
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 첫 포커스 이동 — 컨테이너 자체로 포커스해 키보드 접근 가능하게
    panelRef.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [mounted]);

  // ESC로 닫기
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  const showAsClosing = isClosing || !open;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          showAsClosing ? "opacity-0" : "opacity-100"
        }`}
        style={{ zIndex }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? "대화 상자"}
        tabIndex={-1}
        className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card rounded-t-3xl shadow-2xl flex flex-col outline-none transition-transform duration-300 ${
          showAsClosing ? "translate-y-full" : "translate-y-0"
        }`}
        style={{ zIndex: zIndex + 1, height }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>
        {children}
      </div>
    </>
  );
}
