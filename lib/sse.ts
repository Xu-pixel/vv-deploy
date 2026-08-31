const HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  "X-Content-Type-Options": "nosniff",
};

export function sseResponse(
  request: Request,
  setup: (send: (data: unknown) => void) => () => void,
): Response {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      cleanup = setup(send);
      const abort = () => {
        cleanup?.();
        cleanup = undefined;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", abort, { once: true });
    },
    cancel() {
      cleanup?.();
      cleanup = undefined;
    },
  });
  return new Response(stream, { headers: HEADERS });
}
