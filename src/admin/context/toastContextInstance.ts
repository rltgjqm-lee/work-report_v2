import { createContext } from "react";

export type ToastContextValue = {
  showToast: (message: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
