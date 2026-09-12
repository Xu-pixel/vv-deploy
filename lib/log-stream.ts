import { composeFilePath, composeLogsArgs } from "./docker";

export function startComposeLogStream(
  slug: string,
  opts: { service?: string; tail: number },
  onLine: (line: string) => void,
): () => void {
  if (!composeFilePath(slug)) {
    onLine("还没有 docker-compose.deploy.yaml，无法读日志");
    return () => {};
  }

  const proc = Bun.spawn(
    composeLogsArgs(slug, { ...opts, follow: true }),
    { stdout: "pipe", stderr: "pipe" },
  );

  let leftover = "";
  const flush = (chunk: string) => {
    leftover += chunk;
    const parts = leftover.split("\n");
    leftover = parts.pop() ?? "";
    for (const line of parts) {
      if (line) onLine(line);
    }
  };

  const read = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      flush(decoder.decode(value, { stream: true }));
    }
  };

  void Promise.all([read(proc.stdout), read(proc.stderr)]).then(() => {
    if (leftover) onLine(leftover);
  });

  return () => {
    try {
      proc.kill();
    } catch {
      /* already gone */
    }
  };
}
