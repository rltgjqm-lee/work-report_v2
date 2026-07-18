import type { ReactNode } from "react";

const BottomBar = ({ children }: { children: ReactNode }) => (
  <div className="flex-none bg-white px-5 pt-3.5 pb-[18px] flex flex-col gap-2.5 border-t border-[#f2f4f6]">
    {children}
  </div>
);

export const BottomBarRow = ({ children }: { children: ReactNode }) => (
  <div className="flex gap-2.5">{children}</div>
);

export default BottomBar;
