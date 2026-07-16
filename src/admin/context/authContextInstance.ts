import { createContext } from "react";

import type { AdminSession } from "../types";

export type AuthState = {
  admin: AdminSession | null;
  loading: boolean;
};

export type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
