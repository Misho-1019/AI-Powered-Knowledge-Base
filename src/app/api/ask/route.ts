import { requireUser } from "@/lib/auth/require-user";
import { enforceRateLimit } from "@/lib/rate-limit";
import { runRag, runRagStream } from "@/lib/services/ragService";
import { askSchema, parseJsonBody } from "@/lib/validation";
import { NextResponse } from "next/server";

/** Streaming answers can outlive the default serverless budget. */
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const limited = await enforceRateLimit(auth.user.id, "ask");
    if (limited) return limited;

    const parsed = await parseJsonBody(request, askSchema);
    if (!parsed.ok) return parsed.response;

    const { query, k, documentId, stream } = parsed.data;

    const params = {
      userId: auth.user.id,
      query,
      k,
      documentId,
    };

    if (!stream) {
      const result = await runRag(params);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json(result);
    }

    // Server-Sent Events: sources first, then answer tokens, then done.
    const encoder = new TextEncoder();

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        };

        try {
          for await (const event of runRagStream(params)) {
            send(event);
          }
        } catch (err) {
          // runRagStream handles its own failures; this is a last resort so the
          // client is never left waiting on a stream that will not close.
          console.error("[ask] stream failed unexpectedly:", err);
          send({
            type: "done",
            degraded: true,
            note: "The answer could not be generated. Please try again.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Stops reverse proxies from buffering the stream.
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[ask] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
