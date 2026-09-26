import { NextResponse } from "next/server";
import { SANDBOX } from "@/lib/config";
import { logger, requestIdFrom } from "@/lib/log";
import {
  cloneTemplateDocuments,
  countRecentSandboxes,
  createSandboxAccount,
  deleteUsersByIds,
  findTemplateUserId,
} from "@/lib/demo/sandbox";

export const dynamic = "force-dynamic";

/** Cloning is row copies, so a minute is generous. */
export const maxDuration = 60;

/**
 * Mints an isolated throwaway account pre-loaded with the demo corpus.
 *
 * Unauthenticated on purpose — it is the front door for signed-out visitors.
 * The only abuse guard an anonymous endpoint can afford is a global creation
 * ceiling, plus the housekeeping job that reaps these accounts after a day.
 * The response carries a single-use password so the client can sign straight
 * in through the normal session flow.
 */
export async function POST(request: Request) {
  const log = logger(requestIdFrom(request));

  try {
    const recent = await countRecentSandboxes().catch(() => null);
    if (recent !== null && recent >= SANDBOX.maxPerHour) {
      return NextResponse.json(
        { error: "The demo is busy right now. Please try again later." },
        { status: 429 },
      );
    }

    const templateId = await findTemplateUserId();
    if (!templateId) {
      return NextResponse.json(
        { error: "Demo content is unavailable right now." },
        { status: 503 },
      );
    }

    const sandbox = await createSandboxAccount();

    try {
      await cloneTemplateDocuments(templateId, sandbox.userId);
    } catch (err) {
      // Never hand out a half-seeded account.
      log.error("[demo/sandbox] clone failed", { error: err });
      await deleteUsersByIds([sandbox.userId]).catch(() => {});
      return NextResponse.json(
        { error: "Could not prepare the demo. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      email: sandbox.email,
      password: sandbox.password,
    });
  } catch (err) {
    log.error("[demo/sandbox] failed", { error: err });
    return NextResponse.json(
      { error: "Could not start the demo" },
      { status: 500 },
    );
  }
}
