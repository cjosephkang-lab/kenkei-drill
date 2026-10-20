import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
