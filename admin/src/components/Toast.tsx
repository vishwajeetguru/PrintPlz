import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastCtx {
  notify: (message: string, tone?: ToastTone) => void;
}

const Ctx = createContext<ToastCtx>({ notify: () => {} });

export function useToast() {
  return useContext(Ctx);
}

/**
 * Toast host. Use `notify()` for lightweight feedback instead of `alert()`.
 * Errors that block a workflow should still use `Modal`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3400);
  }, []);

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
