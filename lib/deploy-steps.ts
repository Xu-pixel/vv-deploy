export function deployStep(status: string, percent: number | null): number {
  if (status === "running") return 3;
  if (status === "cloning") return 0;
  if (status !== "building" && status !== "error") return -1;
  if (percent == null || !Number.isFinite(percent)) return -1;
  if (percent < 12) return 0;
  if (percent < 15) return 1;
  return 2;
}
