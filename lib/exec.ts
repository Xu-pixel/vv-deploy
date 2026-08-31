export type RunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export class CommandAbortedError extends Error {
  constructor() {
    super("已取消");
    this.name = "CommandAbortedError";
  }
}

export async function runCommand(
  argv: string[],
  opts?: {
    cwd?: string;
    env?: Record<string, string>;
    onChunk?: (chunk: string) => void;
    signal?: AbortSignal;
  },
): Promise<RunResult> {
  if (opts?.signal?.aborted) throw new CommandAbortedError();

  const proc = Bun.spawn(argv, {
    cwd: opts?.cwd,
    env: { ...process.env, ...opts?.env },
    stdout: "pipe",
    stderr: "pipe",
  });

  const kill = () => {
    try {
      proc.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  };
  opts?.signal?.addEventListener("abort", kill, { once: true });

  let stdout = "";
  let stderr = "";

  const read = async (
    stream: ReadableStream<Uint8Array>,
    kind: "out" | "err",
  ) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      if (kind === "out") stdout += chunk;
      else stderr += chunk;
      opts?.onChunk?.(chunk);
    }
  };

  try {
    await Promise.all([read(proc.stdout, "out"), read(proc.stderr, "err")]);
    const code = await proc.exited;
    if (opts?.signal?.aborted) throw new CommandAbortedError();
    return { code, stdout, stderr };
  } finally {
    opts?.signal?.removeEventListener("abort", kill);
  }
}

export function cleanCommandOutput(text: string): string {
  return text
    .replace(/\u0004/g, "")
    .replace(/\u001b\[\??[0-9;]*[A-Za-z]/g, "")
    .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatResult(result: RunResult): string {
  const parts = [result.stdout, result.stderr]
    .map((part) => cleanCommandOutput(part))
    .filter(Boolean);
  if (result.code !== 0) parts.push(`exit ${result.code}`);
  return parts.join("\n");
}
