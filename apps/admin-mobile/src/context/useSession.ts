import { useContext } from "react";

import { SessionContext, type SessionContextValue } from "./sessionContextInstance";

export const useSession = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
};
