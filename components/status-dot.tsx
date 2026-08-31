import { statusLabel } from "@/lib/format";

const tone: Record<string, string> = {
  idle: "bg-[var(--mute)]",
  cloning: "bg-[var(--busy)] animate-pulse",
  building: "bg-[var(--busy)] animate-pulse",
  running: "bg-[var(--run)]",
  stopped: "bg-[var(--mute)]",
  error: "bg-[var(--err)]",
};

export function StatusDot({ status }: { status: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs tracking-wide text-[var(--mute)]">
      <span className={`size-2 rounded-full ${tone[status] ?? "bg-[var(--mute)]"}`} />
      {statusLabel[status] ?? status}
    </span>
  );
}
