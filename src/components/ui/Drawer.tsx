"use client";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: string;
  zIndex?: number;
}

export function Drawer({ open, onClose, children, height = "85vh", zIndex = 60 }: DrawerProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        style={{ zIndex }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300"
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
