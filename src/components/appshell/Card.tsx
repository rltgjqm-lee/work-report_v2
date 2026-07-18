import type { ReactNode } from "react";

import { cardClass } from "./classes";

const Card = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => <div className={`${cardClass} ${className}`}>{children}</div>;

export default Card;
