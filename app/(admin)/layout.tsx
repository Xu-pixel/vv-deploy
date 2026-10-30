import type { ReactNode } from "react";
import { AdminBar } from "@/components/admin-bar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col"><AdminBar />{children}</div>;
}
