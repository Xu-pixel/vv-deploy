"use client";

import { StatusDot } from "./status-dot";
import { useProjectProgress } from "./project-progress";

export function LiveStatus() {
  const { status } = useProjectProgress();
  return <StatusDot status={status} />;
}
