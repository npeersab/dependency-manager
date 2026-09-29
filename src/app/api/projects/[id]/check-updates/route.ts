import { NextResponse } from "next/server";
import { runCheckUpdates } from "@/lib/actions";
import type { CheckSummary } from "@/lib/actions";

/** Event streamed to the client: one `progress` per member, then a final `done` (or `error`). */
type StreamEvent =
  | { type: "progress"; checked: number; total: number }
  | { type: "done"; summary: CheckSummary }
  | { type: "error"; message?: string };

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const projectId = Number(params.id);
  if (Number.isNaN(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const onProgress = ({ checked, total }: { checked: number; total: number }) => {
        send({ type: "progress", checked, total });
      };

      try {
        const summary = await runCheckUpdates(projectId, onProgress);
        send({ type: "done", summary });
      } catch {
        send({ type: "error", message: "Update check failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Allow proxies to pass the stream through unbuffered.
      "X-Accel-Buffering": "no",
    },
  });
}
