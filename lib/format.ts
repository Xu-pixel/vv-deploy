export function shortSha(sha: string | null): string {
  return sha ? sha.slice(0, 7) : "—";
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const statusLabel: Record<string, string> = {
  idle: "未部署",
  cloning: "拉取中",
  building: "部署中",
  running: "运行中",
  stopped: "已停止",
  error: "失败",
};
