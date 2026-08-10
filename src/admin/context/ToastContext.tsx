import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { ToastContext, type ToastContextValue } from "./toastContextInstance";

type ToastItem = {
  id: number;
  message: string;
};

const TOAST_DURATION_MS = 3000;

/**
 * 관리자 콘솔 전역 토스트입니다. 화면 우측 하단에 고정으로 뜨며 몇 초 후 자동으로
 * 사라집니다 — 모달 위에도 보이도록 z-index를 가장 높게 둡니다.
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const showToast = useCallback((message: string) => {
    const id = nextIdRef.current++;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-text-strong text-white text-[13px] font-medium pl-3.5 pr-4 py-3 rounded-[4px] shadow-lg border-l-[3px] border-l-admin-status-ok-text"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
