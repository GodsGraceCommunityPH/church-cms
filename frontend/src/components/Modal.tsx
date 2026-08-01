import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => !element.hasAttribute("hidden"));
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 0, 0, 0.5)", padding: "16px" }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", maxWidth: "576px", maxHeight: "calc(100vh - 32px)", overflowY: "auto", borderRadius: "16px", background: "white", boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)" }}
        className="
w-full
max-w-xl
overflow-hidden
rounded-2xl
bg-white
shadow-2xl
"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", borderBottom: "1px solid #e5e7eb", padding: "20px 24px" }}>
          <h2 id={titleId} className="text-xl font-bold text-gray-900" style={{ margin: 0, fontSize: "20px" }}>{title}</h2>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-2xl leading-none text-gray-500 hover:text-black"
            aria-label="Close dialog"
            style={{ border: 0, background: "transparent", padding: "4px 8px", color: "#64748b", cursor: "pointer", fontSize: "24px", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6" style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
}
