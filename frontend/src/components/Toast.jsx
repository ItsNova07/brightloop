import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);
const SHOW_FOR = 3600;
const EXIT_TIME = 200;

// Small confirmation messages after an action.
//   const toast = useToast();
//   toast("Customer added");
//   toast("Couldn't delete this customer", "error");
// The provider wraps the whole app in main.jsx.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), EXIT_TIME);
  }, []);

  const toast = useCallback(
    (message, tone = "success") => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, message, tone, leaving: false }]);
      setTimeout(() => dismiss(id), SHOW_FOR);
    },
    [dismiss]
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone} ${t.leaving ? "toast-leaving" : ""}`} role="status">
            <span className="toast-icon" aria-hidden="true">
              {t.tone === "error" ? <ErrorIcon /> : <CheckIcon />}
            </span>
            <p className="toast-message">{t.message}</p>
            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <ToastProvider>");
  return toast;
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path className="toast-check" d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path d="M8 4.5v4.5M8 11.5v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
