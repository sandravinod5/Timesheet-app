"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: number;
  title: string;
  message?: string;
  variant: ToastVariant;
  durationMs: number;
};

type ToastInput = {
  title: string;
  message?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 3600,
  info: 4500,
  error: 5500
};

function getToastIcon(variant: ToastVariant) {
  if (variant === "success") {
    return <CheckCircle2 size={18} />;
  }

  if (variant === "error") {
    return <TriangleAlert size={18} />;
  }

  return <Info size={18} />;
}

export function ToastProvider({ children }: React.PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const showToast = ({ title, message, variant = "info", durationMs }: ToastInput) => {
    setToasts((current) => {
      const duplicate = current.find(
        (toast) => toast.title === title && toast.message === message && toast.variant === variant
      );

      if (duplicate) {
        return current;
      }

      const toast: ToastItem = {
        id: nextIdRef.current++,
        title,
        message,
        variant,
        durationMs: durationMs ?? DEFAULT_DURATIONS[variant]
      };

      return [toast, ...current].slice(0, 3);
    });
  };

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, toast.durationMs)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-card toast-card--${toast.variant}`} role="status">
            <div className={`toast-icon toast-icon--${toast.variant}`} aria-hidden="true">
              {getToastIcon(toast.variant)}
            </div>
            <div className="toast-copy">
              <p className="toast-title">{toast.title}</p>
              {toast.message ? <p className="toast-message">{toast.message}</p> : null}
            </div>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}
