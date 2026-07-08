import { createContext } from "react";

import type { Role } from "../types";

export type AuthState = {
  token: string | null;
  username: string | null;
  role: Role | null;
  organizationId: number | null;
};

export type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
